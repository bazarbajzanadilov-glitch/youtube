create table if not exists public.site_settings (
  id text primary key,
  site_password_hash text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint site_settings_singleton check (id = 'primary')
);

alter table public.site_settings enable row level security;

revoke all on table public.site_settings from anon, authenticated;
grant select, insert, update on table public.site_settings to service_role;

insert into public.site_settings (id)
values ('primary')
on conflict (id) do nothing;

comment on table public.site_settings is
  'Server-only settings. The site password is stored as a salted scrypt hash.';
