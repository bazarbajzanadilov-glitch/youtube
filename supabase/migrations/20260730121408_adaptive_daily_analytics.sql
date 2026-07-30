begin;

-- Persisted analytics history. Lifetime counters remain on public.videos,
-- while every chart and period comparison is built from these completed
-- Asia/Almaty calendar days.
create table public.video_daily_stats (
  id uuid primary key default gen_random_uuid(),
  video_id text not null references public.videos(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  date date not null,
  views bigint not null default 0 check (views >= 0),
  watch_seconds bigint not null default 0 check (watch_seconds >= 0),
  engaged_views bigint not null default 0 check (engaged_views >= 0),
  impressions bigint not null default 0 check (impressions >= 0),
  likes bigint not null default 0 check (likes >= 0),
  comments bigint not null default 0 check (comments >= 0),
  revenue numeric(14, 2) not null default 0 check (revenue >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (video_id, date)
);

create index video_daily_stats_channel_date_idx
  on public.video_daily_stats (channel_id, date);

create trigger video_daily_stats_set_updated_at
before update on public.video_daily_stats
for each row execute function private.set_updated_at();

alter table public.video_daily_stats enable row level security;

revoke all on table public.video_daily_stats
from public, anon, authenticated;
grant select, insert, update, delete on table public.video_daily_stats
to authenticated;
grant select, insert, update, delete on table public.video_daily_stats
to service_role;

create policy "admins read video daily stats"
on public.video_daily_stats for select to authenticated
using ((select private.is_studio_admin()));

create policy "admins insert video daily stats"
on public.video_daily_stats for insert to authenticated
with check ((select private.is_studio_admin()));

create policy "admins update video daily stats"
on public.video_daily_stats for update to authenticated
using ((select private.is_studio_admin()))
with check ((select private.is_studio_admin()));

create policy "admins delete video daily stats"
on public.video_daily_stats for delete to authenticated
using ((select private.is_studio_admin()));

-- The seed is stable for a video/date and never includes a mutable total.
-- It is used only when no real daily history exists yet. Subsequent changes
-- use seven-day smoothed values already stored in the table.
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
  with inputs as (
    select
      greatest(0, p_date - p_published_at)::double precision as age,
      greatest(1, p_date - p_published_at + 1)::double precision as span,
      (
        pg_catalog.get_byte(
          pg_catalog.decode(pg_catalog.md5(p_video_id), 'hex'),
          0
        )::double precision / 255.0
      ) * 2 * pi() as phase
  )
  select greatest(
    0.05::double precision,
    (
      case coalesce(p_profile, 'gradualGrowth')
        when 'viralSpike' then
          0.20 + 4.8 * exp(-power((inputs.age - 2.0) / 4.5, 2))
        when 'decayAfterPeak' then
          0.20 + 2.8 * exp(-inputs.age / 35.0)
        when 'steady' then 1.0
        when 'seasonal' then
          1.0 + 0.32 * sin(2 * pi() * inputs.age / 30.0 + inputs.phase)
        else
          0.55 + 0.90 * inputs.age / inputs.span
      end
    )
    * (
      1.0
      + 0.11 * sin(2 * pi() * inputs.age / 7.0 + inputs.phase)
      + 0.05 * sin(2 * pi() * inputs.age / 17.0 + 0.7)
    )
  )::numeric
  from inputs;
$$;

revoke all on function private.video_initial_history_weight(
  text, date, date, text
) from public, anon, authenticated;
grant execute on function private.video_initial_history_weight(
  text, date, date, text
) to authenticated;

-- Remove an exact amount from one date range without taking a row below zero.
create or replace function private.reduce_video_metric_range(
  p_video_id text,
  p_column text,
  p_amount bigint,
  p_start_date date,
  p_end_date date,
  p_scale integer default 1
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  available bigint;
  batch bigint;
begin
  if p_amount <= 0 or p_start_date is null or p_end_date is null then
    return 0;
  end if;

  if p_column not in (
    'views', 'watch_seconds', 'engaged_views', 'impressions',
    'likes', 'comments', 'revenue'
  ) then
    raise exception 'unsupported analytics metric: %', p_column;
  end if;

  execute format(
    'select coalesce(sum(round(%I * $4)::bigint), 0)
       from public.video_daily_stats
      where video_id = $1 and date between $2 and $3',
    p_column
  )
  into available
  using p_video_id, p_start_date, p_end_date, p_scale;

  batch := least(p_amount, available);
  if batch <= 0 then
    return 0;
  end if;

  execute format(
    $sql$
      with candidates as (
        select
          id,
          date,
          round(%1$I * $5)::bigint as value
        from public.video_daily_stats
        where video_id = $1
          and date between $2 and $3
          and %1$I > 0
      ),
      normalized as (
        select
          *,
          ($4::numeric * value / nullif(sum(value) over (), 0)) as exact_value
        from candidates
      ),
      floored as (
        select
          *,
          floor(exact_value)::bigint as base_value,
          exact_value - floor(exact_value) as fraction
        from normalized
      ),
      ranked as (
        select
          *,
          row_number() over (order by fraction desc, date desc, id) as rank,
          $4 - sum(base_value) over () as remainder
        from floored
      ),
      allocation as (
        select
          id,
          base_value + case when rank <= remainder then 1 else 0 end as amount
        from ranked
      )
      update public.video_daily_stats as stats
      set %1$I = (
        (
          round(stats.%1$I * $5)::bigint
          - allocation.amount
        )::numeric / $5
      )
      from allocation
      where stats.id = allocation.id
    $sql$,
    p_column
  )
  using p_video_id, p_start_date, p_end_date, batch, p_scale;

  return batch;
end;
$$;

revoke all on function private.reduce_video_metric_range(
  text, text, bigint, date, date, integer
) from public, anon, authenticated;
grant execute on function private.reduce_video_metric_range(
  text, text, bigint, date, date, integer
) to authenticated;

-- Reconcile one lifetime target. Positive deltas are spread over only the
-- trailing window using the stored seven-day moving average. A reduction
-- starts in that window and touches older rows only when mathematically
-- necessary to keep every daily value non-negative.
create or replace function private.reconcile_video_metric(
  p_video_id text,
  p_column text,
  p_target bigint,
  p_start_date date,
  p_end_date date,
  p_published_at date,
  p_profile text,
  p_scale integer default 1
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_total bigint;
  delta bigint;
  reduced bigint;
  older_start date;
begin
  if p_column not in (
    'views', 'watch_seconds', 'engaged_views', 'impressions',
    'likes', 'comments', 'revenue'
  ) then
    raise exception 'unsupported analytics metric: %', p_column;
  end if;

  execute format(
    'select coalesce(sum(round(%I * $2)::bigint), 0)
       from public.video_daily_stats
      where video_id = $1',
    p_column
  )
  into current_total
  using p_video_id, p_scale;

  delta := greatest(0, coalesce(p_target, 0)) - current_total;

  if delta > 0 then
    execute format(
      $sql$
        with source as (
          select
            id,
            date,
            avg(round(%1$I * $5)::numeric) over (
              order by date
              rows between 6 preceding and current row
            ) as smoothed
          from public.video_daily_stats
          where video_id = $1
            and date between $2 and $3
        ),
        weighted as (
          select
            id,
            date,
            case
              when max(coalesce(smoothed, 0)) over () > 0
                then greatest(1::numeric, coalesce(smoothed, 0))
              else private.video_initial_history_weight(
                $1, date, $6, $7
              )
            end as weight
          from source
        ),
        normalized as (
          select
            *,
            ($4::numeric * weight / nullif(sum(weight) over (), 0))
              as exact_value
          from weighted
        ),
        floored as (
          select
            *,
            floor(exact_value)::bigint as base_value,
            exact_value - floor(exact_value) as fraction
          from normalized
        ),
        ranked as (
          select
            *,
            row_number() over (order by fraction desc, date, id) as rank,
            $4 - sum(base_value) over () as remainder
          from floored
        ),
        allocation as (
          select
            id,
            base_value + case when rank <= remainder then 1 else 0 end as amount
          from ranked
        )
        update public.video_daily_stats as stats
        set %1$I = (
          (
            round(stats.%1$I * $5)::bigint
            + allocation.amount
          )::numeric / $5
        )
        from allocation
        where stats.id = allocation.id
      $sql$,
      p_column
    )
    using
      p_video_id,
      p_start_date,
      p_end_date,
      delta,
      p_scale,
      p_published_at,
      p_profile;
  elsif delta < 0 then
    reduced := private.reduce_video_metric_range(
      p_video_id,
      p_column,
      -delta,
      p_start_date,
      p_end_date,
      p_scale
    );

    if reduced < -delta then
      select min(date)
      into older_start
      from public.video_daily_stats
      where video_id = p_video_id
        and date < p_start_date;

      perform private.reduce_video_metric_range(
        p_video_id,
        p_column,
        -delta - reduced,
        older_start,
        p_start_date - 1,
        p_scale
      );
    end if;
  end if;
end;
$$;

revoke all on function private.reconcile_video_metric(
  text, text, bigint, date, date, date, text, integer
) from public, anon, authenticated;
grant execute on function private.reconcile_video_metric(
  text, text, bigint, date, date, date, text, integer
) to authenticated;

create or replace function private.reconcile_video_daily_stats(
  p_video_id text,
  p_end_date date default (
    (now() at time zone 'Asia/Almaty')::date - 1
  ),
  p_window_days integer default 28
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  video_row public.videos%rowtype;
  row_count integer;
  allocation_start date;
  history_end date := least(
    coalesce(p_end_date, (now() at time zone 'Asia/Almaty')::date - 1),
    (now() at time zone 'Asia/Almaty')::date - 1
  );
  retention numeric;
  target_watch_seconds bigint;
  target_engaged_views bigint;
  target_impressions bigint;
  target_comments bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('video:' || p_video_id, 0)
  );

  select *
  into video_row
  from public.videos
  where id = p_video_id;

  if not found then
    return;
  end if;

  delete from public.video_daily_stats
  where video_id = p_video_id
    and (date < video_row.published_at or date > history_end);

  if video_row.published_at > history_end then
    return;
  end if;

  update public.video_daily_stats
  set channel_id = video_row.channel_id
  where video_id = p_video_id
    and channel_id is distinct from video_row.channel_id;

  select count(*)
  into row_count
  from public.video_daily_stats
  where video_id = p_video_id;

  allocation_start := case
    when row_count = 0 then video_row.published_at
    else greatest(
      video_row.published_at,
      history_end - greatest(1, least(365, coalesce(p_window_days, 28))) + 1
    )
  end;

  insert into public.video_daily_stats (video_id, channel_id, date)
  select video_row.id, video_row.channel_id, generated.day::date
  from generate_series(
    allocation_start,
    history_end,
    interval '1 day'
  ) as generated(day)
  on conflict (video_id, date) do update
  set channel_id = excluded.channel_id;

  retention := coalesce(video_row.average_view_percentage, 45.10);
  target_watch_seconds := round(
    video_row.views::numeric
    * video_row.duration_seconds
    * retention / 100
  )::bigint;
  target_engaged_views := round(
    video_row.views::numeric * retention / 100
  )::bigint;
  target_impressions := case
    when video_row.views <= 0 then 0
    else ceil(video_row.views::numeric / 0.107)::bigint
  end;
  target_comments := round(video_row.views::numeric * 0.0025)::bigint;

  perform private.reconcile_video_metric(
    video_row.id, 'views', video_row.views,
    allocation_start, history_end, video_row.published_at,
    video_row.analytics_profile, 1
  );
  perform private.reconcile_video_metric(
    video_row.id, 'watch_seconds', target_watch_seconds,
    allocation_start, history_end, video_row.published_at,
    video_row.analytics_profile, 1
  );
  perform private.reconcile_video_metric(
    video_row.id, 'engaged_views', target_engaged_views,
    allocation_start, history_end, video_row.published_at,
    video_row.analytics_profile, 1
  );
  perform private.reconcile_video_metric(
    video_row.id, 'impressions', target_impressions,
    allocation_start, history_end, video_row.published_at,
    video_row.analytics_profile, 1
  );
  perform private.reconcile_video_metric(
    video_row.id, 'likes', video_row.likes,
    allocation_start, history_end, video_row.published_at,
    video_row.analytics_profile, 1
  );
  perform private.reconcile_video_metric(
    video_row.id, 'comments', target_comments,
    allocation_start, history_end, video_row.published_at,
    video_row.analytics_profile, 1
  );
  perform private.reconcile_video_metric(
    video_row.id, 'revenue', round(video_row.revenue * 100)::bigint,
    allocation_start, history_end, video_row.published_at,
    video_row.analytics_profile, 100
  );
end;
$$;

revoke all on function private.reconcile_video_daily_stats(
  text, date, integer
) from public, anon, authenticated;
grant execute on function private.reconcile_video_daily_stats(
  text, date, integer
) to authenticated;

create or replace function private.sync_video_daily_stats()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.reconcile_video_daily_stats(new.id);
  elsif new.channel_id is distinct from old.channel_id
    or new.published_at is distinct from old.published_at
    or new.duration_seconds is distinct from old.duration_seconds
    or new.views is distinct from old.views
    or new.likes is distinct from old.likes
    or new.revenue is distinct from old.revenue
    or new.average_view_percentage is distinct from old.average_view_percentage
    or new.analytics_profile is distinct from old.analytics_profile
  then
    perform private.reconcile_video_daily_stats(new.id);
  end if;

  return new;
end;
$$;

revoke all on function private.sync_video_daily_stats()
from public, anon, authenticated;
grant execute on function private.sync_video_daily_stats()
to authenticated;

create trigger videos_seed_daily_stats
after insert on public.videos
for each row execute function private.sync_video_daily_stats();

create trigger videos_reconcile_daily_stats
after update of
  channel_id,
  published_at,
  duration_seconds,
  views,
  likes,
  revenue,
  average_view_percentage,
  analytics_profile
on public.videos
for each row execute function private.sync_video_daily_stats();

-- Seed existing videos once. Every metric is allocated with largest-remainder
-- rounding, so its stored daily sum exactly equals the current lifetime target.
do $$
declare
  video_record record;
begin
  for video_record in
    select id from public.videos order by id
  loop
    perform private.reconcile_video_daily_stats(video_record.id);
  end loop;
end;
$$;

-- Subscriber reconciliation now changes only the delta. It never rescales
-- already stored history when subscriber_count changes.
alter table public.subscriber_daily_stats
add column if not exists is_manual boolean not null default false;

-- The product deliberately shows positive subscriber growth only.
update public.subscriber_daily_stats
set lost = 0
where lost <> 0;

alter table public.subscriber_daily_stats
add constraint subscriber_daily_stats_lost_zero
check (lost = 0);

create or replace function private.subscriber_daily_growth_factor(
  p_channel_id uuid,
  p_date date
)
returns numeric
language sql
immutable
parallel safe
security invoker
set search_path = ''
as $$
  select (
    1.0
    + 0.065 * sin(
      2 * pi() * ((p_date - date '2020-01-01')::double precision) / 13.0
      + (
        pg_catalog.get_byte(
          pg_catalog.decode(pg_catalog.md5(p_channel_id::text), 'hex'),
          0
        )::double precision / 255.0
      ) * 2 * pi()
    )
    + 0.025 * sin(
      2 * pi() * ((p_date - date '2020-01-01')::double precision) / 5.0
      + 0.8
    )
  )::numeric;
$$;

revoke all on function private.subscriber_daily_growth_factor(uuid, date)
from public, anon, authenticated;
grant execute on function private.subscriber_daily_growth_factor(uuid, date)
to authenticated;

create or replace function private.reduce_subscriber_gained_range(
  p_channel_id uuid,
  p_amount bigint,
  p_start_date date,
  p_end_date date,
  p_allow_manual boolean default false
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  available bigint;
  batch bigint;
begin
  if p_amount <= 0 or p_start_date is null or p_end_date is null then
    return 0;
  end if;

  select coalesce(sum(gained), 0)
  into available
  from public.subscriber_daily_stats
  where channel_id = p_channel_id
    and date between p_start_date and p_end_date
    and (p_allow_manual or not is_manual);

  batch := least(p_amount, available);
  if batch <= 0 then
    return 0;
  end if;

  with candidates as (
    select id, date, gained::bigint as value
    from public.subscriber_daily_stats
    where channel_id = p_channel_id
      and date between p_start_date and p_end_date
      and gained > 0
      and (p_allow_manual or not is_manual)
  ),
  normalized as (
    select
      *,
      batch::numeric * value / nullif(sum(value) over (), 0) as exact_value
    from candidates
  ),
  floored as (
    select
      *,
      floor(exact_value)::bigint as base_value,
      exact_value - floor(exact_value) as fraction
    from normalized
  ),
  ranked as (
    select
      *,
      row_number() over (order by fraction desc, date desc, id) as rank,
      batch - sum(base_value) over () as remainder
    from floored
  )
  update public.subscriber_daily_stats as stats
  set gained = (
    stats.gained
    - ranked.base_value
    - case when ranked.rank <= ranked.remainder then 1 else 0 end
  )::integer
  from ranked
  where stats.id = ranked.id;

  return batch;
end;
$$;

revoke all on function private.reduce_subscriber_gained_range(
  uuid, bigint, date, date, boolean
) from public, anon, authenticated;
grant execute on function private.reduce_subscriber_gained_range(
  uuid, bigint, date, date, boolean
) to authenticated;

create or replace function private.reconcile_subscriber_daily_stats(
  p_channel_id uuid,
  p_target_total bigint,
  p_end_date date default (
    (now() at time zone 'Asia/Almaty')::date - 1
  ),
  p_window_days integer default 28
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_total bigint;
  channel_join_date date;
  history_end date := least(
    coalesce(p_end_date, (now() at time zone 'Asia/Almaty')::date - 1),
    (now() at time zone 'Asia/Almaty')::date - 1
  );
  row_count integer;
  allocation_start date;
  current_total bigint;
  delta bigint;
  reduced bigint;
  reduced_older bigint := 0;
  reduced_manual bigint := 0;
  older_start date;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('subscriber:' || p_channel_id::text, 0)
  );

  select
    greatest(0, coalesce(channels.subscriber_count, p_target_total, 0)),
    channels.join_date
  into target_total, channel_join_date
  from public.channels
  where channels.id = p_channel_id;

  if not found or channel_join_date > history_end then
    return;
  end if;

  select count(*)
  into row_count
  from public.subscriber_daily_stats
  where channel_id = p_channel_id;

  allocation_start := case
    when row_count = 0 then greatest(channel_join_date, history_end - 364)
    else greatest(
      channel_join_date,
      history_end - greatest(1, least(365, coalesce(p_window_days, 28))) + 1
    )
  end;

  insert into public.subscriber_daily_stats (channel_id, date, gained, lost)
  select p_channel_id, generated.day::date, 0, 0
  from generate_series(allocation_start, history_end, interval '1 day')
    as generated(day)
  on conflict (channel_id, date) do nothing;

  select coalesce(sum(gained::bigint), 0)
  into current_total
  from public.subscriber_daily_stats
  where channel_id = p_channel_id;

  delta := target_total - current_total;

  if delta > 0 then
    with source as (
      select
        id,
        date,
        is_manual,
        avg(gained::numeric) over (
          order by date
          rows between 6 preceding and current row
        ) as smoothed,
        count(*) filter (where not is_manual) over () as automatic_rows
      from public.subscriber_daily_stats
      where channel_id = p_channel_id
        and date between allocation_start and history_end
    ),
    weighted as (
      select
        id,
        date,
        case
          when max(coalesce(smoothed, 0)) over () > 0
            then greatest(1::numeric, coalesce(smoothed, 0))
          else private.subscriber_daily_growth_factor(p_channel_id, date)
        end as weight
      from source
      where not is_manual or automatic_rows = 0
    ),
    normalized as (
      select
        *,
        delta::numeric * weight / nullif(sum(weight) over (), 0) as exact_value
      from weighted
    ),
    floored as (
      select
        *,
        floor(exact_value)::bigint as base_value,
        exact_value - floor(exact_value) as fraction
      from normalized
    ),
    ranked as (
      select
        *,
        row_number() over (order by fraction desc, date, id) as rank,
        delta - sum(base_value) over () as remainder
      from floored
    )
    update public.subscriber_daily_stats as stats
    set gained = (
      stats.gained
      + ranked.base_value
      + case when ranked.rank <= ranked.remainder then 1 else 0 end
    )::integer
    from ranked
    where stats.id = ranked.id;
  elsif delta < 0 then
    reduced := private.reduce_subscriber_gained_range(
      p_channel_id,
      -delta,
      allocation_start,
      history_end,
      false
    );

    if reduced < -delta then
      select min(date)
      into older_start
      from public.subscriber_daily_stats
      where channel_id = p_channel_id
        and date < allocation_start;

      reduced_older := private.reduce_subscriber_gained_range(
        p_channel_id,
        -delta - reduced,
        older_start,
        allocation_start - 1,
        false
      );

      reduced := reduced + reduced_older;
    end if;

    -- A manually edited day is the last resort. This branch is reached only
    -- when the requested channel total is lower than all automatic gains.
    if reduced < -delta then
      reduced_manual := private.reduce_subscriber_gained_range(
        p_channel_id,
        -delta - reduced,
        allocation_start,
        history_end,
        true
      );
      reduced := reduced + reduced_manual;
    end if;

    if reduced < -delta then
      perform private.reduce_subscriber_gained_range(
        p_channel_id,
        -delta - reduced,
        older_start,
        allocation_start - 1,
        true
      );
    end if;
  end if;
end;
$$;

revoke all on function private.reconcile_subscriber_daily_stats(
  uuid, bigint, date, integer
) from public, anon, authenticated;
grant execute on function private.reconcile_subscriber_daily_stats(
  uuid, bigint, date, integer
) to authenticated;

-- Keep the deployed private signatures, but change their behavior from a
-- full 365-day rescale to a trailing, delta-only reconciliation.
create or replace function private.refresh_subscriber_daily_stats(
  p_channel_id uuid,
  p_target_total bigint,
  p_end_date date default (
    (now() at time zone 'Asia/Almaty')::date - 1
  ),
  p_window_days integer default 28
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.reconcile_subscriber_daily_stats(
    p_channel_id,
    p_target_total,
    p_end_date,
    p_window_days
  );
end;
$$;

revoke all on function private.refresh_subscriber_daily_stats(
  uuid, bigint, date, integer
) from public, anon, authenticated;
grant execute on function private.refresh_subscriber_daily_stats(
  uuid, bigint, date, integer
) to authenticated;

create or replace function private.rescale_subscriber_daily_stats(
  p_channel_id uuid,
  p_target_total bigint
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.reconcile_subscriber_daily_stats(
    p_channel_id,
    p_target_total
  );
end;
$$;

revoke all on function private.rescale_subscriber_daily_stats(uuid, bigint)
from public, anon, authenticated;
grant execute on function private.rescale_subscriber_daily_stats(uuid, bigint)
to authenticated;

create or replace function private.sync_subscriber_history_after_channel_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.reconcile_subscriber_daily_stats(
      new.id,
      new.subscriber_count
    );
  elsif new.subscriber_count is distinct from old.subscriber_count then
    perform private.reconcile_subscriber_daily_stats(
      new.id,
      new.subscriber_count
    );
  end if;

  return new;
end;
$$;

revoke all on function private.sync_subscriber_history_after_channel_update()
from public, anon, authenticated;
grant execute on function private.sync_subscriber_history_after_channel_update()
to authenticated;

drop trigger if exists channels_sync_subscriber_history on public.channels;
create trigger channels_sync_subscriber_history
after update of subscriber_count on public.channels
for each row
execute function private.sync_subscriber_history_after_channel_update();

drop trigger if exists channels_seed_subscriber_history on public.channels;
create trigger channels_seed_subscriber_history
after insert on public.channels
for each row
execute function private.sync_subscriber_history_after_channel_update();

-- Daily history editing is an upsert, not a destructive replacement. Missing
-- dates and old periods therefore survive admin imports.
create or replace function public.replace_subscriber_daily_stats(p_stats jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  studio_channel_id constant uuid :=
    '00000000-0000-0000-0000-000000000001'::uuid;
  channel_total bigint;
begin
  if not (select private.is_studio_admin()) then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  with parsed as (
    select
      item.date,
      max(greatest(0, coalesce(item.gained, 0)))::integer as gained
    from jsonb_to_recordset(coalesce(p_stats, '[]'::jsonb)) as item(
      date date,
      gained integer,
      lost integer
    )
    where item.date is not null
      and item.date <= (now() at time zone 'Asia/Almaty')::date - 1
    group by item.date
  )
  insert into public.subscriber_daily_stats as stats (
    channel_id,
    date,
    gained,
    lost,
    share_weight,
    manual_multiplier,
    is_manual
  )
  select
    studio_channel_id,
    parsed.date,
    parsed.gained,
    0,
    greatest(1, parsed.gained),
    1,
    true
  from parsed
  on conflict (channel_id, date) do update
  set
    gained = excluded.gained,
    lost = 0,
    share_weight = excluded.share_weight,
    manual_multiplier = 1,
    is_manual = (
      stats.is_manual
      or stats.gained is distinct from excluded.gained
      or stats.lost <> 0
    );

  select subscriber_count
  into channel_total
  from public.channels
  where id = studio_channel_id;

  perform private.reconcile_subscriber_daily_stats(
    studio_channel_id,
    coalesce(channel_total, 0)
  );
end;
$$;

revoke all on function public.replace_subscriber_daily_stats(jsonb)
from public, anon;
grant execute on function public.replace_subscriber_daily_stats(jsonb)
to authenticated;

-- Preserve daily history for video IDs that survive a project import.
-- The former delete-then-insert implementation cascaded all stored history.
create or replace function public.replace_videos(p_videos jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  studio_channel_id constant uuid :=
    '00000000-0000-0000-0000-000000000001'::uuid;
begin
  if not (select private.is_studio_admin()) then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  insert into public.videos (
    id,
    channel_id,
    title,
    cover_path,
    published_at,
    duration_seconds,
    content_type,
    views,
    likes,
    dislikes,
    average_view_percentage,
    revenue,
    analytics_profile,
    auto_views,
    auto_revenue,
    created_at
  )
  select
    item.id,
    coalesce(item.channel_id, studio_channel_id),
    item.title,
    item.cover_path,
    item.published_at,
    coalesce(item.duration_seconds, 0),
    coalesce(item.content_type, 'video'),
    coalesce(item.views, 0),
    coalesce(item.likes, 0),
    coalesce(item.dislikes, 0),
    item.average_view_percentage,
    coalesce(item.revenue, 0),
    coalesce(item.analytics_profile, 'gradualGrowth'),
    coalesce(item.auto_views, false),
    coalesce(item.auto_revenue, false),
    coalesce(item.created_at, now())
  from jsonb_to_recordset(coalesce(p_videos, '[]'::jsonb)) as item(
    id text,
    channel_id uuid,
    title text,
    cover_path text,
    published_at date,
    duration_seconds integer,
    content_type text,
    views bigint,
    likes bigint,
    dislikes bigint,
    average_view_percentage numeric,
    revenue numeric,
    analytics_profile text,
    auto_views boolean,
    auto_revenue boolean,
    created_at timestamptz
  )
  on conflict (id) do update
  set
    channel_id = excluded.channel_id,
    title = excluded.title,
    cover_path = excluded.cover_path,
    published_at = excluded.published_at,
    duration_seconds = excluded.duration_seconds,
    content_type = excluded.content_type,
    views = excluded.views,
    likes = excluded.likes,
    dislikes = excluded.dislikes,
    average_view_percentage = excluded.average_view_percentage,
    revenue = excluded.revenue,
    analytics_profile = excluded.analytics_profile,
    auto_views = excluded.auto_views,
    auto_revenue = excluded.auto_revenue;

  delete from public.videos as videos
  where videos.channel_id = studio_channel_id
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(p_videos, '[]'::jsonb)) as item
      where item ->> 'id' = videos.id
    );
end;
$$;

revoke all on function public.replace_videos(jsonb) from public, anon;
grant execute on function public.replace_videos(jsonb) to authenticated;

-- Bring any pre-existing subscriber history to the authoritative total once,
-- using only a delta in the newest 28 days.
do $$
declare
  channel_record record;
begin
  for channel_record in
    select id, subscriber_count from public.channels order by id
  loop
    perform private.reconcile_subscriber_daily_stats(
      channel_record.id,
      channel_record.subscriber_count
    );
  end loop;
end;
$$;

-- Cron only creates the newly completed local day. It never regenerates or
-- rescales previous dates; counter edits are reconciled by the row triggers.
create or replace function private.roll_daily_analytics()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  completed_date date := (now() at time zone 'Asia/Almaty')::date - 1;
  video_record record;
begin
  insert into public.video_daily_stats (video_id, channel_id, date)
  select videos.id, videos.channel_id, completed_date
  from public.videos
  where videos.published_at <= completed_date
  on conflict (video_id, date) do nothing;

  -- Normally the trigger has already reconciled every lifetime counter. The
  -- one-day call matters for a video first published on the just-completed
  -- day; existing videos have a zero delta and no older row is changed.
  for video_record in
    select id
    from public.videos
    where published_at <= completed_date
  loop
    perform private.reconcile_video_daily_stats(
      video_record.id,
      completed_date,
      1
    );
  end loop;

  -- A newly completed day receives a small positive, date-stable gain. Only
  -- rows actually inserted by this run advance the lifetime counter, making
  -- retries idempotent. The channel trigger then observes zero reconciliation
  -- delta because the daily row and lifetime value increased together.
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

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'refresh-subscriber-daily-growth',
  '10 19 * * *',
  $cron$
    select private.roll_daily_analytics();
  $cron$
);

commit;
