create schema if not exists private;

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  channel_name text not null check (length(trim(channel_name)) > 0),
  country text not null default 'KZ' check (country ~ '^[A-Z]{2}$'),
  subscriber_count bigint not null default 0 check (subscriber_count >= 0),
  monetization_enabled boolean not null default true,
  join_date date not null,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.videos (
  id text primary key check (length(trim(id)) > 0),
  channel_id uuid not null references public.channels(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  cover_path text,
  published_at date not null,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  content_type text not null default 'video'
    check (content_type in ('video', 'short', 'live')),
  views bigint not null default 0 check (views >= 0),
  likes bigint not null default 0 check (likes >= 0),
  dislikes bigint not null default 0 check (dislikes >= 0),
  revenue numeric(14, 2) not null default 0 check (revenue >= 0),
  analytics_profile text not null default 'gradualGrowth'
    check (analytics_profile in ('gradualGrowth', 'viralSpike', 'steady', 'decayAfterPeak', 'seasonal')),
  auto_views boolean not null default false,
  auto_revenue boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dashboard_comments (
  id text primary key check (length(trim(id)) > 0),
  channel_id uuid not null references public.channels(id) on delete cascade,
  author text not null default '',
  age_label text not null default '',
  body text not null default '',
  avatar_color text not null default '#525252'
    check (avatar_color ~ '^#[0-9A-Fa-f]{6}$'),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recent_subscribers (
  id text primary key check (length(trim(id)) > 0),
  channel_id uuid not null references public.channels(id) on delete cascade,
  name text not null default '',
  count_label text not null default '',
  avatar_color text not null default '#525252'
    check (avatar_color ~ '^#[0-9A-Fa-f]{6}$'),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function private.enroll_studio_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lower(coalesce(new.email, '')) = 'bazarbajzanadilov@gmail.com' then
    insert into public.admin_users (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger enroll_studio_admin_after_signup
after insert or update of email on auth.users
for each row execute function private.enroll_studio_admin();

insert into public.admin_users (user_id)
select id
from auth.users
where lower(email) = 'bazarbajzanadilov@gmail.com'
on conflict (user_id) do nothing;

create index videos_channel_published_idx
  on public.videos (channel_id, published_at desc);
create index dashboard_comments_channel_position_idx
  on public.dashboard_comments (channel_id, position);
create index recent_subscribers_channel_position_idx
  on public.recent_subscribers (channel_id, position);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger channels_set_updated_at
before update on public.channels
for each row execute function private.set_updated_at();

create trigger videos_set_updated_at
before update on public.videos
for each row execute function private.set_updated_at();

create trigger dashboard_comments_set_updated_at
before update on public.dashboard_comments
for each row execute function private.set_updated_at();

create trigger recent_subscribers_set_updated_at
before update on public.recent_subscribers
for each row execute function private.set_updated_at();

create or replace function private.is_studio_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_studio_admin() from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_studio_admin() to authenticated;

alter table public.channels enable row level security;
alter table public.videos enable row level security;
alter table public.dashboard_comments enable row level security;
alter table public.recent_subscribers enable row level security;
alter table public.admin_users enable row level security;

revoke all on public.channels from anon;
revoke all on public.videos from anon;
revoke all on public.dashboard_comments from anon;
revoke all on public.recent_subscribers from anon;
revoke all on public.admin_users from anon;

grant select, insert, update, delete on public.channels to authenticated;
grant select, insert, update, delete on public.videos to authenticated;
grant select, insert, update, delete on public.dashboard_comments to authenticated;
grant select, insert, update, delete on public.recent_subscribers to authenticated;
grant select on public.admin_users to authenticated;

create policy "admins read channel"
on public.channels for select to authenticated
using ((select private.is_studio_admin()));

create policy "admins insert channel"
on public.channels for insert to authenticated
with check ((select private.is_studio_admin()));

create policy "admins update channel"
on public.channels for update to authenticated
using ((select private.is_studio_admin()))
with check ((select private.is_studio_admin()));

create policy "admins delete channel"
on public.channels for delete to authenticated
using ((select private.is_studio_admin()));

create policy "admins read videos"
on public.videos for select to authenticated
using ((select private.is_studio_admin()));

create policy "admins insert videos"
on public.videos for insert to authenticated
with check ((select private.is_studio_admin()));

create policy "admins update videos"
on public.videos for update to authenticated
using ((select private.is_studio_admin()))
with check ((select private.is_studio_admin()));

create policy "admins delete videos"
on public.videos for delete to authenticated
using ((select private.is_studio_admin()));

create policy "admins read comments"
on public.dashboard_comments for select to authenticated
using ((select private.is_studio_admin()));

create policy "admins insert comments"
on public.dashboard_comments for insert to authenticated
with check ((select private.is_studio_admin()));

create policy "admins update comments"
on public.dashboard_comments for update to authenticated
using ((select private.is_studio_admin()))
with check ((select private.is_studio_admin()));

create policy "admins delete comments"
on public.dashboard_comments for delete to authenticated
using ((select private.is_studio_admin()));

create policy "admins read subscribers"
on public.recent_subscribers for select to authenticated
using ((select private.is_studio_admin()));

create policy "admins insert subscribers"
on public.recent_subscribers for insert to authenticated
with check ((select private.is_studio_admin()));

create policy "admins update subscribers"
on public.recent_subscribers for update to authenticated
using ((select private.is_studio_admin()))
with check ((select private.is_studio_admin()));

create policy "admins delete subscribers"
on public.recent_subscribers for delete to authenticated
using ((select private.is_studio_admin()));

create policy "admins read own membership"
on public.admin_users for select to authenticated
using (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'studio-media',
  'studio-media',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "studio admins read media"
on storage.objects for select to authenticated
using (
  bucket_id = 'studio-media'
  and (select private.is_studio_admin())
);

create policy "studio admins upload media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'studio-media'
  and (select private.is_studio_admin())
);

create policy "studio admins update media"
on storage.objects for update to authenticated
using (
  bucket_id = 'studio-media'
  and (select private.is_studio_admin())
)
with check (
  bucket_id = 'studio-media'
  and (select private.is_studio_admin())
);

create policy "studio admins delete media"
on storage.objects for delete to authenticated
using (
  bucket_id = 'studio-media'
  and (select private.is_studio_admin())
);

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
    revenue numeric,
    analytics_profile text,
    auto_views boolean,
    auto_revenue boolean,
    created_at timestamptz
  );
end;
$$;

create or replace function public.save_channel_project(
  p_channel jsonb,
  p_comments jsonb,
  p_subscribers jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  studio_channel_id constant uuid := '00000000-0000-0000-0000-000000000001'::uuid;
begin
  if not (select private.is_studio_admin()) then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  insert into public.channels (
    id,
    channel_name,
    country,
    subscriber_count,
    monetization_enabled,
    join_date,
    avatar_path
  )
  values (
    studio_channel_id,
    coalesce(p_channel ->> 'channel_name', 'TRADING INSIDER'),
    coalesce(p_channel ->> 'country', 'KZ'),
    coalesce((p_channel ->> 'subscriber_count')::bigint, 0),
    coalesce((p_channel ->> 'monetization_enabled')::boolean, true),
    coalesce((p_channel ->> 'join_date')::date, current_date),
    nullif(p_channel ->> 'avatar_path', '')
  )
  on conflict (id) do update
  set channel_name = excluded.channel_name,
      country = excluded.country,
      subscriber_count = excluded.subscriber_count,
      monetization_enabled = excluded.monetization_enabled,
      join_date = excluded.join_date,
      avatar_path = excluded.avatar_path;

  delete from public.dashboard_comments where channel_id = studio_channel_id;
  insert into public.dashboard_comments (
    id,
    channel_id,
    author,
    age_label,
    body,
    avatar_color,
    position
  )
  select
    item.id,
    studio_channel_id,
    coalesce(item.author, ''),
    coalesce(item.age_label, ''),
    coalesce(item.body, ''),
    coalesce(item.avatar_color, '#525252'),
    coalesce(item.position, 0)
  from jsonb_to_recordset(coalesce(p_comments, '[]'::jsonb)) as item(
    id text,
    channel_id uuid,
    author text,
    age_label text,
    body text,
    avatar_color text,
    position integer
  );

  delete from public.recent_subscribers where channel_id = studio_channel_id;
  insert into public.recent_subscribers (
    id,
    channel_id,
    name,
    count_label,
    avatar_color,
    position
  )
  select
    item.id,
    studio_channel_id,
    coalesce(item.name, ''),
    coalesce(item.count_label, ''),
    coalesce(item.avatar_color, '#525252'),
    coalesce(item.position, 0)
  from jsonb_to_recordset(coalesce(p_subscribers, '[]'::jsonb)) as item(
    id text,
    channel_id uuid,
    name text,
    count_label text,
    avatar_color text,
    position integer
  );
end;
$$;

create or replace function public.replace_project(
  p_channel jsonb,
  p_videos jsonb,
  p_comments jsonb,
  p_subscribers jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.is_studio_admin()) then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  perform public.save_channel_project(p_channel, p_comments, p_subscribers);
  perform public.replace_videos(p_videos);
end;
$$;

revoke all on function public.replace_videos(jsonb) from public, anon;
revoke all on function public.save_channel_project(jsonb, jsonb, jsonb) from public, anon;
revoke all on function public.replace_project(jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.replace_videos(jsonb) to authenticated;
grant execute on function public.save_channel_project(jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.replace_project(jsonb, jsonb, jsonb, jsonb) to authenticated;
