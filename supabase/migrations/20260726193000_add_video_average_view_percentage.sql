begin;

alter table public.videos
add column if not exists average_view_percentage numeric(5, 2);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'videos_average_view_percentage_check'
      and conrelid = 'public.videos'::regclass
  ) then
    alter table public.videos
    add constraint videos_average_view_percentage_check
    check (
      average_view_percentage is null
      or average_view_percentage between 0 and 100
    );
  end if;
end
$$;

-- Preserve the value that was already visible before this metric became
-- database-backed. Future changes are stored explicitly and are never
-- recalculated in the browser.
update public.videos
set average_view_percentage = 45.10
where average_view_percentage is null;

create or replace function public.replace_videos(p_videos jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.is_studio_admin()) then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  delete from public.videos
  where channel_id = '00000000-0000-0000-0000-000000000001'::uuid;

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
    coalesce(item.channel_id, '00000000-0000-0000-0000-000000000001'::uuid),
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
  );
end;
$$;

revoke all on function public.replace_videos(jsonb) from public, anon;
grant execute on function public.replace_videos(jsonb) to authenticated;

commit;
