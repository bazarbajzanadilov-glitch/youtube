begin;

alter table public.subscriber_daily_stats
add column if not exists manual_multiplier numeric not null default 1
check (manual_multiplier between 0.9 and 1.1);

-- A date-stable, bounded wave. Unlike the old day_index * 0.6 weight, it
-- cannot grow without limit or turn the newest stored day into a spike.
create or replace function private.subscriber_history_weight(p_date date)
returns numeric
language sql
immutable
parallel safe
security invoker
set search_path = ''
as $$
  select greatest(
    0.8::double precision,
    least(
      1.2::double precision,
      1
      + 0.10 * sin(
        2 * pi() * ((p_date - date '2020-01-01')::double precision) / 11.0
        + 0.7
      )
      + 0.06 * sin(
        2 * pi() * ((p_date - date '2020-01-01')::double precision) / 29.0
        + 1.9
      )
      + 0.035 * sin(
        2 * pi() * ((p_date - date '2020-01-01')::double precision) / 5.0
        + 2.6
      )
    )
  )::numeric;
$$;

revoke all on function private.subscriber_history_weight(date)
from public, anon, authenticated;
grant execute on function private.subscriber_history_weight(date)
to authenticated;

create or replace function private.refresh_subscriber_daily_stats(
  p_channel_id uuid,
  p_target_total bigint,
  p_end_date date default (
    (now() at time zone 'Asia/Almaty')::date - 1
  ),
  p_window_days integer default 365
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_total bigint;
  window_days integer := greatest(1, least(3650, coalesce(p_window_days, 365)));
  history_days integer;
  history_start date;
begin
  -- Cron, the channel trigger and the admin editor may refresh concurrently.
  -- Serialize per channel, then read the authoritative total after acquiring
  -- the lock so an older cron snapshot can never overwrite a newer edit.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_channel_id::text, 0)
  );

  select greatest(0, coalesce(channels.subscriber_count, p_target_total, 0))
  into target_total
  from public.channels
  where channels.id = p_channel_id;

  if not found then
    return;
  end if;

  -- A positive integer for every stored day is possible only while the total
  -- is at least the number of days. Small channels therefore use a shorter
  -- window; normal channels keep the full 365 completed days.
  history_days := least(window_days::bigint, target_total)::integer;

  if history_days <= 0 then
    delete from public.subscriber_daily_stats
    where channel_id = p_channel_id;
    return;
  end if;

  history_start := p_end_date - (history_days - 1);

  delete from public.subscriber_daily_stats
  where channel_id = p_channel_id
    and (date < history_start or date > p_end_date);

  insert into public.subscriber_daily_stats (
    channel_id,
    date,
    gained,
    lost,
    share_weight,
    manual_multiplier
  )
  select
    p_channel_id,
    generated.day::date,
    1,
    0,
    private.subscriber_history_weight(generated.day::date),
    1
  from generate_series(
    history_start,
    p_end_date,
    interval '1 day'
  ) as generated(day)
  on conflict (channel_id, date) do nothing;

  -- Rebuild the bounded effective weight from the deterministic date wave and
  -- the optional bounded admin adjustment.
  update public.subscriber_daily_stats as stats
  set
    share_weight = (
      greatest(
        0.8,
        least(
          1.2,
          private.subscriber_history_weight(stats.date)
          * greatest(0.9, least(1.1, stats.manual_multiplier))
        )
      )
    ),
    lost = 0
  where stats.channel_id = p_channel_id
    and stats.date between history_start and p_end_date;

  -- Hamilton/largest-remainder allocation: every day receives one subscriber
  -- first, then the remaining total is distributed proportionally. Rounding
  -- leftovers are spread one-by-one, never dumped into the last date.
  with weighted as (
    select
      id,
      date,
      greatest(0.8, least(1.2, share_weight)) as weight
    from public.subscriber_daily_stats
    where channel_id = p_channel_id
      and date between history_start and p_end_date
  ),
  normalized as (
    select
      *,
      (
        (target_total - history_days)::numeric
        * weight
        / nullif(sum(weight) over (), 0)
      ) as exact_extra
    from weighted
  ),
  floored as (
    select
      *,
      floor(exact_extra)::bigint as gained_extra_floor,
      exact_extra - floor(exact_extra) as fraction
    from normalized
  ),
  ranked as (
    select
      *,
      row_number() over (order by fraction desc, date, id) as fraction_rank,
      (
        target_total
        - history_days
        - sum(gained_extra_floor) over ()
      ) as remainder
    from floored
  )
  update public.subscriber_daily_stats as stats
  set
    gained = (
      1
      + ranked.gained_extra_floor
      + case when ranked.fraction_rank <= ranked.remainder then 1 else 0 end
    )::integer,
    lost = 0
  from ranked
  where stats.id = ranked.id;
end;
$$;

revoke all on function private.refresh_subscriber_daily_stats(
  uuid,
  bigint,
  date,
  integer
)
from public, anon, authenticated;
grant execute on function private.refresh_subscriber_daily_stats(
  uuid,
  bigint,
  date,
  integer
)
to authenticated;

-- Keep the previous private function name as a compatibility wrapper for
-- already-deployed triggers and stored calls.
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
  perform private.refresh_subscriber_daily_stats(
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
  if new.subscriber_count is distinct from old.subscriber_count then
    perform private.refresh_subscriber_daily_stats(
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

-- Admin edits remain relative shape adjustments. Missing or explicitly zero
-- rows are restored to a positive automatic value by the refresh.
create or replace function public.replace_subscriber_daily_stats(p_stats jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  studio_channel_id constant uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  channel_total bigint;
  history_end date := (now() at time zone 'Asia/Almaty')::date - 1;
  history_days integer;
  history_start date;
begin
  if not (select private.is_studio_admin()) then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  select subscriber_count
  into channel_total
  from public.channels
  where id = studio_channel_id;

  history_days := least(365::bigint, greatest(0, coalesce(channel_total, 0)))::integer;
  history_start := history_end - greatest(0, history_days - 1);

  update public.subscriber_daily_stats
  set manual_multiplier = 1
  where channel_id = studio_channel_id;

  with parsed as (
    select
      item.date,
      max(greatest(0, coalesce(item.gained, 0)))::numeric as gained
    from jsonb_to_recordset(coalesce(p_stats, '[]'::jsonb)) as item(
      date date,
      gained integer,
      lost integer
    )
    where item.date is not null
      and history_days > 0
      and item.date between history_start and history_end
    group by item.date
  ),
  ratios as (
    select
      parsed.*,
      parsed.gained
        / nullif(private.subscriber_history_weight(parsed.date), 0) as raw_ratio
    from parsed
  ),
  normalized as (
    select
      *,
      avg(nullif(raw_ratio, 0)) over () as average_ratio
    from ratios
  )
  insert into public.subscriber_daily_stats (
    channel_id,
    date,
    gained,
    lost,
    share_weight,
    manual_multiplier
  )
  select
    studio_channel_id,
    normalized.date,
    normalized.gained::integer,
    0,
    private.subscriber_history_weight(normalized.date),
    case
      when coalesce(normalized.average_ratio, 0) <= 0 then 1
      else greatest(
        0.9,
        least(1.1, normalized.raw_ratio / normalized.average_ratio)
      )
    end
  from normalized
  on conflict (channel_id, date) do update
  set
    manual_multiplier = excluded.manual_multiplier,
    lost = 0;

  perform private.refresh_subscriber_daily_stats(
    studio_channel_id,
    coalesce(channel_total, 0)
  );
end;
$$;

revoke all on function public.replace_subscriber_daily_stats(jsonb)
from public, anon;
grant execute on function public.replace_subscriber_daily_stats(jsonb)
to authenticated;

-- Remove the previous unbounded weights, fill every completed day through
-- yesterday in Almaty, and immediately repair production data.
update public.subscriber_daily_stats
set
  manual_multiplier = 1,
  share_weight = private.subscriber_history_weight(date),
  lost = 0;

do $$
declare
  channel_row record;
begin
  for channel_row in
    select id, subscriber_count
    from public.channels
  loop
    perform private.refresh_subscriber_daily_stats(
      channel_row.id,
      channel_row.subscriber_count
    );
  end loop;
end;
$$;

-- Supabase Cron runs in UTC. 19:10 UTC is 00:10 in Asia/Almaty, so the new
-- completed local day is available shortly after midnight.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

select cron.schedule(
  'refresh-subscriber-daily-growth',
  '10 19 * * *',
  $cron$
    select private.refresh_subscriber_daily_stats(id, subscriber_count)
    from public.channels;
  $cron$
);

commit;
