begin;

-- Аналитика канала: «На 999 % больше, чем за предыдущие 28 дней» под
-- просмотрами, временем просмотра и подписчиками. Процент задаётся в админке
-- и не меняется со временем. Нет строки — процент считается автоматически.

create table if not exists public.channel_kpi_overrides (
  metric text primary key check (metric in ('views', 'watch', 'subscribers')),
  channel_id uuid not null references public.channels(id) on delete cascade,
  delta_percent numeric(12, 1) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists channel_kpi_overrides_channel_idx
  on public.channel_kpi_overrides (channel_id);

drop trigger if exists channel_kpi_overrides_set_updated_at
  on public.channel_kpi_overrides;
create trigger channel_kpi_overrides_set_updated_at
before update on public.channel_kpi_overrides
for each row execute function private.set_updated_at();

alter table public.channel_kpi_overrides enable row level security;
revoke all on public.channel_kpi_overrides from anon;
grant select, insert, update, delete on public.channel_kpi_overrides to authenticated;

drop policy if exists "admins read kpi overrides" on public.channel_kpi_overrides;
create policy "admins read kpi overrides"
on public.channel_kpi_overrides for select to authenticated
using ((select private.is_studio_admin()));

drop policy if exists "admins insert kpi overrides" on public.channel_kpi_overrides;
create policy "admins insert kpi overrides"
on public.channel_kpi_overrides for insert to authenticated
with check ((select private.is_studio_admin()));

drop policy if exists "admins update kpi overrides" on public.channel_kpi_overrides;
create policy "admins update kpi overrides"
on public.channel_kpi_overrides for update to authenticated
using ((select private.is_studio_admin()))
with check ((select private.is_studio_admin()));

drop policy if exists "admins delete kpi overrides" on public.channel_kpi_overrides;
create policy "admins delete kpi overrides"
on public.channel_kpi_overrides for delete to authenticated
using ((select private.is_studio_admin()));

commit;
