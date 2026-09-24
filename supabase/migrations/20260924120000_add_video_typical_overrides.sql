begin;

-- «Обычные показатели» конкретного ролика на странице «Аналитика видео»:
-- подпись «На 5,9 млн больше, чем обычно» под просмотрами и временем просмотра.
-- Хранится сама разница с обычным значением: плюс — «больше», минус — «меньше».
-- Пусто (null) — значение считается автоматически по другим роликам канала.

create table if not exists public.video_typical_overrides (
  video_id text primary key references public.videos(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  views_diff bigint,
  watch_hours_diff numeric(14, 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists video_typical_overrides_channel_idx
  on public.video_typical_overrides (channel_id);

drop trigger if exists video_typical_overrides_set_updated_at
  on public.video_typical_overrides;
create trigger video_typical_overrides_set_updated_at
before update on public.video_typical_overrides
for each row execute function private.set_updated_at();

alter table public.video_typical_overrides enable row level security;
revoke all on public.video_typical_overrides from anon;
grant select, insert, update, delete on public.video_typical_overrides to authenticated;

drop policy if exists "admins read typical overrides" on public.video_typical_overrides;
create policy "admins read typical overrides"
on public.video_typical_overrides for select to authenticated
using ((select private.is_studio_admin()));

drop policy if exists "admins insert typical overrides" on public.video_typical_overrides;
create policy "admins insert typical overrides"
on public.video_typical_overrides for insert to authenticated
with check ((select private.is_studio_admin()));

drop policy if exists "admins update typical overrides" on public.video_typical_overrides;
create policy "admins update typical overrides"
on public.video_typical_overrides for update to authenticated
using ((select private.is_studio_admin()))
with check ((select private.is_studio_admin()));

drop policy if exists "admins delete typical overrides" on public.video_typical_overrides;
create policy "admins delete typical overrides"
on public.video_typical_overrides for delete to authenticated
using ((select private.is_studio_admin()));

commit;
