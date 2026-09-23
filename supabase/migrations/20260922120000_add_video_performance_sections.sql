begin;

-- Раздел «С момента публикации»: статистика одного видео (Shorts / обычное),
-- как на странице аналитики видео в YouTube Studio. Данные вводятся в админке
-- и не зависят от диапазона аналитики канала.

create table if not exists public.video_performance_sections (
  variant text primary key check (variant in ('shorts', 'video')),
  channel_id uuid not null references public.channels(id) on delete cascade,
  published_at date not null,
  total_views bigint not null default 0 check (total_views >= 0),
  typical_views bigint not null default 0 check (typical_views >= 0),
  watch_hours numeric(14, 1) not null default 0 check (watch_hours >= 0),
  typical_watch_hours numeric(14, 1) not null default 0 check (typical_watch_hours >= 0),
  subscribers_gained bigint not null default 0 check (subscribers_gained >= 0),
  revenue_tenge numeric(14, 2) not null default 0 check (revenue_tenge >= 0),
  curve_shape text not null default 'burst'
    check (curve_shape in ('burst', 'gradual', 'even')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists video_performance_sections_channel_idx
  on public.video_performance_sections (channel_id);

drop trigger if exists video_performance_sections_set_updated_at
  on public.video_performance_sections;
create trigger video_performance_sections_set_updated_at
before update on public.video_performance_sections
for each row execute function private.set_updated_at();

alter table public.video_performance_sections enable row level security;
revoke all on public.video_performance_sections from anon;
grant select, insert, update, delete on public.video_performance_sections to authenticated;

drop policy if exists "admins read performance sections" on public.video_performance_sections;
create policy "admins read performance sections"
on public.video_performance_sections for select to authenticated
using ((select private.is_studio_admin()));

drop policy if exists "admins insert performance sections" on public.video_performance_sections;
create policy "admins insert performance sections"
on public.video_performance_sections for insert to authenticated
with check ((select private.is_studio_admin()));

drop policy if exists "admins update performance sections" on public.video_performance_sections;
create policy "admins update performance sections"
on public.video_performance_sections for update to authenticated
using ((select private.is_studio_admin()))
with check ((select private.is_studio_admin()));

drop policy if exists "admins delete performance sections" on public.video_performance_sections;
create policy "admins delete performance sections"
on public.video_performance_sections for delete to authenticated
using ((select private.is_studio_admin()));

-- Значения по умолчанию — со скриншотов клиента.
insert into public.video_performance_sections (
  variant, channel_id, published_at, total_views, typical_views,
  watch_hours, typical_watch_hours, subscribers_gained, revenue_tenge, curve_shape
)
values
  (
    'shorts',
    '00000000-0000-0000-0000-000000000001'::uuid,
    ((now() at time zone 'Asia/Almaty')::date - 630),
    81022050, 0, 0, 0, 204300, 1253155.42, 'burst'
  ),
  (
    'video',
    '00000000-0000-0000-0000-000000000001'::uuid,
    ((now() at time zone 'Asia/Almaty')::date - 1386),
    5942494, 0, 254100, 1400, 14900, 7365.63, 'burst'
  )
on conflict (variant) do nothing;

commit;
