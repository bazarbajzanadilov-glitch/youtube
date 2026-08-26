begin;

-- This hardening intentionally depends on both daily-analytics migrations.
-- Fail before touching public.videos when they have not been installed in the
-- required order, rather than leaving the database only partially repaired.
do $$
begin
  if to_regclass('public.video_daily_stats') is null then
    raise exception
      'public.video_daily_stats is missing'
      using
        errcode = '55000',
        hint = 'Apply 20260730121408_adaptive_daily_analytics.sql first.';
  end if;

  if to_regprocedure(
    'private.reconcile_video_daily_stats(text,date,integer)'
  ) is null then
    raise exception
      'private.reconcile_video_daily_stats(text,date,integer) is missing'
      using
        errcode = '55000',
        hint = 'Apply 20260730121408_adaptive_daily_analytics.sql first.';
  end if;

  if to_regprocedure(
    'private.video_watch_history_factor(text,date,date)'
  ) is null then
    raise exception
      'private.video_watch_history_factor(text,date,date) is missing'
      using
        errcode = '55000',
        hint = 'Apply 20260730230725_decouple_watch_time_history.sql first.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_trigger
    where tgrelid = 'public.videos'::regclass
      and tgname = 'videos_reconcile_daily_stats'
      and not tgisinternal
  ) then
    raise exception
      'videos_reconcile_daily_stats trigger is missing'
      using
        errcode = '55000',
        hint = 'Apply 20260730121408_adaptive_daily_analytics.sql first.';
  end if;
end
$$;

alter table public.videos
add column if not exists average_view_percentage numeric(5, 2);

-- New inserts receive the canonical automatic value. Existing explicit
-- values, including 0 and 0.01, are deliberately preserved.
alter table public.videos
alter column average_view_percentage set default 45.10;

update public.videos
set average_view_percentage = 45.10
where average_view_percentage is null;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'videos_average_view_percentage_check'
      and conrelid = 'public.videos'::regclass
  ) then
    alter table public.videos
    add constraint videos_average_view_percentage_check
    check (average_view_percentage between 0 and 100);
  end if;
end
$$;

alter table public.videos
validate constraint videos_average_view_percentage_check;

alter table public.videos
alter column average_view_percentage set not null;

-- The NULL backfill fires the reconciliation trigger for affected rows. Run
-- an explicit all-video pass as well so previously non-NULL videos and any
-- partially seeded history are brought to the same invariant.
do $$
declare
  video_record record;
begin
  for video_record in
    select id
    from public.videos
    order by id
  loop
    perform private.reconcile_video_daily_stats(video_record.id);
  end loop;
end
$$;

commit;
