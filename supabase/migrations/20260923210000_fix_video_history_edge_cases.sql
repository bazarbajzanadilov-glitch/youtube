begin;

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

      -- Ролик ещё без истории (опубликован сегодня или вчера): введённые в
      -- админке просмотры уже набраны, их нужно распределить по прошедшим
      -- дням, а не прибавить к счётчику второй раз.
      if not exists (
        select 1 from public.video_daily_stats
        where video_id = video_record.id and views > 0
      ) then
        perform private.reconcile_video_daily_stats(video_record.id, target_date);
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

revoke all on function private.roll_video_daily_analytics(date, integer)
  from public, anon, authenticated;

-- После простоя cron догоняем до 30 дней, а не 7, чтобы не оставались дни
-- с нулевыми просмотрами.
create or replace function private.roll_daily_analytics()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  completed_date date := (now() at time zone 'Asia/Almaty')::date - 1;
begin
  perform private.roll_video_daily_analytics(completed_date, 30);

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

-- Смена даты публикации перестраивает всю историю ролика от новой даты,
-- иначе часть дней оставалась пустой, а стартовый всплеск уезжал в хвост.
create or replace function private.sync_video_daily_stats()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.reconcile_video_daily_stats(new.id);
  elsif new.published_at is distinct from old.published_at
    or new.analytics_profile is distinct from old.analytics_profile
  then
    delete from public.video_daily_stats where video_id = new.id;
    perform private.reconcile_video_daily_stats(new.id);
  elsif new.channel_id is distinct from old.channel_id
    or new.duration_seconds is distinct from old.duration_seconds
    or new.views is distinct from old.views
    or new.likes is distinct from old.likes
    or new.revenue is distinct from old.revenue
    or new.average_view_percentage is distinct from old.average_view_percentage
  then
    perform private.reconcile_video_daily_stats(new.id);
  end if;

  return new;
end;
$$;

revoke all on function private.sync_video_daily_stats()
  from public, anon, authenticated;
grant execute on function private.sync_video_daily_stats() to authenticated;

commit;
