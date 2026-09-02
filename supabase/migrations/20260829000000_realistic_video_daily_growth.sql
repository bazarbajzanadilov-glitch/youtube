begin;

-- Use the same deterministic profile vocabulary as the client. The weights
-- deliberately include discovery waves, quiet regimes and small date-stable
-- variation so channel charts do not collapse into one smooth synthetic hump.
create or replace function private.video_initial_history_weight(
  p_video_id text,
  p_date date,
  p_published_at date,
  p_profile text
)
returns numeric
language sql
immutable
parallel safe
security invoker
set search_path = ''
as $$
  with seed as (
    select
      pg_catalog.decode(pg_catalog.md5(p_video_id), 'hex') as video_seed,
      pg_catalog.decode(
        pg_catalog.md5(p_video_id || ':' || p_date::text),
        'hex'
      ) as day_seed
  ),
  inputs as (
    select
      greatest(0, p_date - p_published_at)::double precision as age,
      (
        pg_catalog.get_byte(video_seed, 0)::double precision / 255.0
      ) * 2 * pi() as phase,
      2.0 + (
        pg_catalog.get_byte(video_seed, 1)::double precision / 255.0
      ) * 2.5 as release_peak,
      10.0 + (
        pg_catalog.get_byte(video_seed, 2)::double precision / 255.0
      ) * 12.0 as second_wave,
      0.94 + (
        pg_catalog.get_byte(day_seed, 0)::double precision / 255.0
      ) * 0.12 as ordinary_noise,
      pg_catalog.get_byte(day_seed, 1)::double precision / 255.0 as shock,
      case when extract(isodow from p_date) >= 6 then 1.055 else 1.0 end
        as weekend
    from seed
  ),
  shaped as (
    select
      inputs.*,
      case coalesce(p_profile, 'gradualGrowth')
        when 'viralSpike' then
          0.14
          + 4.8 * exp(-power((inputs.age - inputs.release_peak) / 2.6, 2))
          + 0.52 * exp(-power((inputs.age - inputs.second_wave) / 3.8, 2))
          + 0.42 * exp(-inputs.age / 46.0)
        when 'decayAfterPeak' then
          0.20
          + 2.8 * exp(-inputs.age / 24.0)
          + 0.38 * exp(-power((inputs.age - inputs.second_wave) / 3.2, 2))
        when 'steady' then
          0.92
          + 0.07 * sin(2 * pi() * inputs.age / 15.0 + inputs.phase)
          + 0.04 * sin(2 * pi() * inputs.age / 37.0 + inputs.phase * 0.4)
        when 'seasonal' then
          0.88
          + 0.28 * sin(2 * pi() * inputs.age / 14.0 + inputs.phase)
          + 0.16 * sin(2 * pi() * inputs.age / 31.0 + inputs.phase * 0.55)
        else
          0.28
          + 1.36
            * (1 - exp(-inputs.age / 8.5))
            * exp(-greatest(0, inputs.age - 22.0) / 95.0)
          + 0.34 * exp(-power((inputs.age - inputs.second_wave) / 4.2, 2))
      end as base
    from inputs
  )
  select greatest(
    0.04::double precision,
    shaped.base
      * shaped.weekend
      * (1 + 0.045 * sin(2 * pi() * shaped.age / 7.0 + shaped.phase))
      * shaped.ordinary_noise
      * case
          when shaped.shock > 0.975
            then 1.14 + ((shaped.shock - 0.975) / 0.025) * 0.18
          when shaped.shock < 0.025 then 0.86
          else 1.0
        end
  )::numeric
  from shaped;
$$;

revoke all on function private.video_initial_history_weight(
  text, date, date, text
) from public, anon, authenticated;
grant execute on function private.video_initial_history_weight(
  text, date, date, text
) to authenticated;

-- Calculate one future day from the recent real level, adjusted by the
-- selected profile. All randomness is derived from video/date, so retries are
-- stable and a cron retry cannot invent a different value.
create or replace function private.video_next_daily_views(
  p_video_id text,
  p_date date,
  p_published_at date,
  p_profile text
)
returns bigint
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  lifetime_views bigint;
  trailing_median numeric;
  last_views numeric;
  base numeric;
  target_weight numeric;
  previous_weight numeric;
  noise numeric;
  candidate numeric;
begin
  select views
  into lifetime_views
  from public.videos
  where id = p_video_id;

  select
    percentile_cont(0.5) within group (order by views),
    (array_agg(views order by date desc))[1]
  into trailing_median, last_views
  from public.video_daily_stats
  where video_id = p_video_id
    and date between p_date - 7 and p_date - 1
    and views > 0;

  base := coalesce(
    trailing_median,
    greatest(
      1,
      round(
        greatest(0, coalesce(lifetime_views, 0))::numeric
        / greatest(1, p_date - p_published_at + 1)
      )
    )
  );
  last_views := coalesce(last_views, base);
  target_weight := private.video_initial_history_weight(
    p_video_id,
    p_date,
    p_published_at,
    p_profile
  );

  select avg(private.video_initial_history_weight(
    p_video_id,
    day::date,
    p_published_at,
    p_profile
  ))
  into previous_weight
  from generate_series(p_date - 7, p_date - 1, interval '1 day') as day;

  noise := 0.92 + (
    pg_catalog.get_byte(
      pg_catalog.decode(
        pg_catalog.md5(p_video_id || ':' || p_date::text || ':views'),
        'hex'
      ),
      0
    )::numeric / 255
  ) * 0.16;

  candidate := base
    * target_weight / greatest(0.05, coalesce(previous_weight, target_weight))
    * noise;
  candidate := least(base * 1.55, greatest(base * 0.60, candidate));
  candidate := least(last_views * 1.45, greatest(last_views * 0.65, candidate));

  return greatest(1, round(candidate)::bigint);
end;
$$;

revoke all on function private.video_next_daily_views(
  text, date, date, text
) from public, anon, authenticated;

-- Fill missing or structurally empty completed days and advance the lifetime
-- counters by exactly the inserted amount. Existing positive rows are never
-- rewritten, and a repeated run for the same date is a no-op.
create or replace function private.roll_video_daily_analytics(
  p_completed_date date,
  p_catchup_days integer default 7
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  completed_date date := least(
    coalesce(p_completed_date, (now() at time zone 'Asia/Almaty')::date - 1),
    (now() at time zone 'Asia/Almaty')::date - 1
  );
  catchup_days integer := greatest(1, least(30, coalesce(p_catchup_days, 7)));
  video_record record;
  target_date date;
  existing_record public.video_daily_stats%rowtype;
  changed_id uuid;
  daily_views bigint;
  daily_watch_seconds bigint;
  daily_engaged_views bigint;
  daily_impressions bigint;
  daily_comments bigint;
  daily_revenue numeric(14, 2);
  daily_likes bigint;
  retention numeric;
  revenue_per_view numeric;
  likes_per_view numeric;
  revenue_noise numeric;
  likes_noise numeric;
begin
  for video_record in
    select
      videos.*,
      channels.monetization_enabled
    from public.videos as videos
    join public.channels as channels on channels.id = videos.channel_id
    where videos.published_at <= completed_date
    order by videos.id
    for update of videos
  loop
    for target_date in
      select generated.day::date
      from generate_series(
        greatest(video_record.published_at, completed_date - catchup_days + 1),
        completed_date,
        interval '1 day'
      ) as generated(day)
      order by generated.day
    loop
      select *
      into existing_record
      from public.video_daily_stats
      where video_id = video_record.id
        and date = target_date;

      -- Views are the authoritative signal that this day's additive roll was
      -- completed. Reconciliation may prefill derived columns on later empty
      -- rows while an earlier catch-up day advances the lifetime counters.
      if found and existing_record.views > 0 then
        continue;
      end if;

      if video_record.views <= 0 then
        insert into public.video_daily_stats (video_id, channel_id, date)
        values (video_record.id, video_record.channel_id, target_date)
        on conflict (video_id, date) do nothing;
        continue;
      end if;

      daily_views := private.video_next_daily_views(
        video_record.id,
        target_date,
        video_record.published_at,
        video_record.analytics_profile
      );
      retention := coalesce(video_record.average_view_percentage, 45.10);
      daily_watch_seconds := greatest(
        0,
        round(
          daily_views::numeric
          * video_record.duration_seconds
          * retention / 100
        )::bigint
      );
      daily_engaged_views := least(
        daily_views,
        greatest(0, round(daily_views::numeric * retention / 100)::bigint)
      );
      daily_impressions := case
        when daily_views <= 0 then 0
        else ceil(daily_views::numeric / 0.107)::bigint
      end;
      daily_comments := greatest(
        0,
        round(daily_views::numeric * 0.0025)::bigint
      );

      select
        coalesce(
          sum(revenue) / nullif(sum(views), 0),
          video_record.revenue / nullif(video_record.views, 0),
          0
        ),
        coalesce(
          sum(likes)::numeric / nullif(sum(views), 0),
          video_record.likes::numeric / nullif(video_record.views, 0),
          0
        )
      into revenue_per_view, likes_per_view
      from public.video_daily_stats
      where video_id = video_record.id
        and date between target_date - 7 and target_date - 1
        and views > 0;

      revenue_noise := 0.94 + (
        pg_catalog.get_byte(
          pg_catalog.decode(
            pg_catalog.md5(video_record.id || ':' || target_date::text || ':revenue'),
            'hex'
          ),
          0
        )::numeric / 255
      ) * 0.12;
      likes_noise := 0.95 + (
        pg_catalog.get_byte(
          pg_catalog.decode(
            pg_catalog.md5(video_record.id || ':' || target_date::text || ':likes'),
            'hex'
          ),
          0
        )::numeric / 255
      ) * 0.10;

      daily_revenue := case
        when video_record.monetization_enabled is false
          or video_record.revenue <= 0 then 0
        else round(daily_views * revenue_per_view * revenue_noise, 2)
      end;
      daily_likes := least(
        daily_views,
        greatest(0, round(daily_views * likes_per_view * likes_noise)::bigint)
      );

      changed_id := null;
      insert into public.video_daily_stats as existing_stats (
        video_id,
        channel_id,
        date,
        views,
        watch_seconds,
        engaged_views,
        impressions,
        likes,
        comments,
        revenue
      )
      values (
        video_record.id,
        video_record.channel_id,
        target_date,
        daily_views,
        daily_watch_seconds,
        daily_engaged_views,
        daily_impressions,
        daily_likes,
        daily_comments,
        daily_revenue
      )
      on conflict (video_id, date) do update
      set
        channel_id = excluded.channel_id,
        views = excluded.views,
        watch_seconds = excluded.watch_seconds,
        engaged_views = excluded.engaged_views,
        impressions = excluded.impressions,
        likes = excluded.likes,
        comments = excluded.comments,
        revenue = excluded.revenue
      where existing_stats.views = 0
      returning id into changed_id;

      if changed_id is null then
        continue;
      end if;

      update public.videos
      set
        views = views + daily_views,
        likes = likes + daily_likes,
        revenue = revenue + daily_revenue
      where id = video_record.id;

      video_record.views := video_record.views + daily_views;
      video_record.likes := video_record.likes + daily_likes;
      video_record.revenue := video_record.revenue + daily_revenue;
    end loop;
  end loop;
end;
$$;

revoke all on function private.roll_video_daily_analytics(
  date, integer
) from public, anon, authenticated;

-- Keep the existing subscriber behavior, but replace the broken zero-row
-- video block with the additive, idempotent roll above.
create or replace function private.roll_daily_analytics()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  completed_date date := (now() at time zone 'Asia/Almaty')::date - 1;
begin
  perform private.roll_video_daily_analytics(completed_date, 7);

  with growth as (
    select
      channels.id as channel_id,
      greatest(
        1,
        round(
          greatest(channels.subscriber_count, 365)::numeric
          / 365
          * private.subscriber_daily_growth_factor(
              channels.id,
              completed_date
            )
        )::integer
      ) as gained,
      private.subscriber_daily_growth_factor(
        channels.id,
        completed_date
      ) as weight
    from public.channels
    where channels.join_date <= completed_date
  ),
  inserted as (
    insert into public.subscriber_daily_stats (
      channel_id,
      date,
      gained,
      lost,
      share_weight,
      manual_multiplier,
      is_manual
    )
    select
      growth.channel_id,
      completed_date,
      growth.gained,
      0,
      growth.weight,
      1,
      false
    from growth
    on conflict (channel_id, date) do nothing
    returning channel_id, gained
  ),
  inserted_totals as (
    select channel_id, sum(gained)::bigint as gained
    from inserted
    group by channel_id
  )
  update public.channels as channels
  set subscriber_count = channels.subscriber_count + inserted_totals.gained
  from inserted_totals
  where channels.id = inserted_totals.channel_id;
end;
$$;

revoke all on function private.roll_daily_analytics()
from public, anon, authenticated;

-- Assign the supported profiles without rewriting already valid daily history.
-- The migration is intentionally additive: only missing or structurally empty
-- completed days are filled by the catch-up roll below.
with ranked as (
  select
    id,
    row_number() over (order by published_at desc, id) as position
  from public.videos
), assigned as (
  select
    id,
    case mod(position - 1, 5)
      when 0 then 'viralSpike'
      when 1 then 'steady'
      when 2 then 'seasonal'
      when 3 then 'decayAfterPeak'
      else 'gradualGrowth'
    end as analytics_profile
  from ranked
)
update public.videos as videos
set analytics_profile = assigned.analytics_profile
from assigned
where videos.id = assigned.id
  and videos.analytics_profile is distinct from assigned.analytics_profile;

do $$
declare
  completed_date date := (now() at time zone 'Asia/Almaty')::date - 1;
begin
  perform private.roll_video_daily_analytics(
    completed_date,
    7
  );

  if exists (
    select 1
    from public.videos as videos
    left join public.video_daily_stats as stats
      on stats.video_id = videos.id
      and stats.date = completed_date
    where videos.published_at <= completed_date
      and videos.views > 0
      and coalesce(stats.views, 0) <= 0
  ) then
    raise exception
      'daily analytics catch-up left a completed video day without views';
  end if;
end;
$$;

commit;
