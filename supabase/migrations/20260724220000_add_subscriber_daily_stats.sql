create table public.subscriber_daily_stats (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  date date not null,
  gained integer not null default 0 check (gained >= 0),
  lost integer not null default 0 check (lost >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_id, date)
);

create index subscriber_daily_stats_channel_date_idx
  on public.subscriber_daily_stats (channel_id, date);

create trigger subscriber_daily_stats_set_updated_at
before update on public.subscriber_daily_stats
for each row execute function private.set_updated_at();

alter table public.subscriber_daily_stats enable row level security;

revoke all on public.subscriber_daily_stats from anon;
grant select, insert, update, delete on public.subscriber_daily_stats to authenticated;

create policy "admins read subscriber daily stats"
on public.subscriber_daily_stats for select to authenticated
using ((select private.is_studio_admin()));

create policy "admins insert subscriber daily stats"
on public.subscriber_daily_stats for insert to authenticated
with check ((select private.is_studio_admin()));

create policy "admins update subscriber daily stats"
on public.subscriber_daily_stats for update to authenticated
using ((select private.is_studio_admin()))
with check ((select private.is_studio_admin()));

create policy "admins delete subscriber daily stats"
on public.subscriber_daily_stats for delete to authenticated
using ((select private.is_studio_admin()));

create or replace function public.replace_subscriber_daily_stats(p_stats jsonb)
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

  delete from public.subscriber_daily_stats
  where channel_id = studio_channel_id;

  insert into public.subscriber_daily_stats (
    channel_id,
    date,
    gained,
    lost
  )
  select
    studio_channel_id,
    item.date,
    greatest(0, coalesce(item.gained, 0)),
    greatest(0, coalesce(item.lost, 0))
  from jsonb_to_recordset(coalesce(p_stats, '[]'::jsonb)) as item(
    date date,
    gained integer,
    lost integer
  )
  where item.date is not null;
end;
$$;

revoke all on function public.replace_subscriber_daily_stats(jsonb) from public, anon;
grant execute on function public.replace_subscriber_daily_stats(jsonb) to authenticated;

with seeded_days as (
  select
    day::date as date,
    day::date - date '2026-04-25' as day_offset
  from generate_series(
    date '2026-04-25',
    date '2026-07-23',
    interval '1 day'
  ) as day
),
seeded_stats as (
  select
    date,
    case
      when day_offset = 89 then 1
      when mod(day_offset, 29) = 0 then 2
      when mod(day_offset, 6) in (1, 3) then 1
      else 0
    end as gained,
    case when mod(day_offset, 17) = 0 then 1 else 0 end as lost
  from seeded_days
)
insert into public.subscriber_daily_stats (channel_id, date, gained, lost)
select
  channels.id,
  seeded_stats.date,
  seeded_stats.gained,
  seeded_stats.lost
from seeded_stats
cross join public.channels
where channels.id = '00000000-0000-0000-0000-000000000001'::uuid
on conflict (channel_id, date) do nothing;
