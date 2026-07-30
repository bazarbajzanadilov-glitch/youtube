begin;

-- A slow, channel-stable growth regime makes adjacent 28-day periods
-- meaningfully different while the shorter waves preserve natural daily
-- movement. The phase comes from the channel id, so the history remains
-- deterministic and does not change when the UI range changes.
create or replace function private.subscriber_history_weight(
  p_date date,
  p_channel_id uuid
)
returns numeric
language sql
immutable
parallel safe
security invoker
set search_path = ''
as $$
  with inputs as (
    select
      (p_date - date '2020-01-01')::double precision as day_ordinal,
      (
        (
          pg_catalog.get_byte(
            pg_catalog.decode(pg_catalog.md5(p_channel_id::text), 'hex'),
            0
          )::bigint * 16777216
          + pg_catalog.get_byte(
            pg_catalog.decode(pg_catalog.md5(p_channel_id::text), 'hex'),
            1
          )::bigint * 65536
          + pg_catalog.get_byte(
            pg_catalog.decode(pg_catalog.md5(p_channel_id::text), 'hex'),
            2
          )::bigint * 256
          + pg_catalog.get_byte(
            pg_catalog.decode(pg_catalog.md5(p_channel_id::text), 'hex'),
            3
          )::bigint
        )::double precision
        / 4294967295.0
      ) as channel_seed
  )
  select greatest(
    0.4::double precision,
    least(
      1.8::double precision,
      exp(
        0.48 * sin(
          2 * pi() * inputs.day_ordinal / 112.0
          + 2 * pi() * inputs.channel_seed
          - 0.5
        )
        + 0.07 * sin(
          2 * pi() * inputs.day_ordinal / 11.0
          + 0.7
        )
        + 0.03 * sin(
          2 * pi() * inputs.day_ordinal / 5.0
          + 2.6
        )
      )
    )
  )::numeric
  from inputs;
$$;

revoke all on function private.subscriber_history_weight(date, uuid)
from public, anon, authenticated;
grant execute on function private.subscriber_history_weight(date, uuid)
to authenticated;

-- Keep the old private signature working for already-deployed stored calls.
-- New code always passes the channel id explicitly.
create or replace function private.subscriber_history_weight(p_date date)
returns numeric
language sql
immutable
parallel safe
security invoker
set search_path = ''
as $$
  select private.subscriber_history_weight(
    p_date,
    '00000000-0000-0000-0000-000000000001'::uuid
  );
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
    private.subscriber_history_weight(generated.day::date, p_channel_id),
    1
  from generate_series(
    history_start,
    p_end_date,
    interval '1 day'
  ) as generated(day)
  on conflict (channel_id, date) do nothing;

  update public.subscriber_daily_stats as stats
  set
    share_weight = (
      greatest(
        0.4,
        least(
          1.8,
          private.subscriber_history_weight(stats.date, p_channel_id)
          * greatest(0.9, least(1.1, stats.manual_multiplier))
        )
      )
    ),
    lost = 0
  where stats.channel_id = p_channel_id
    and stats.date between history_start and p_end_date;

  with weighted as (
    select
      id,
      date,
      greatest(0.4, least(1.8, share_weight)) as weight
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
        / nullif(
          private.subscriber_history_weight(parsed.date, studio_channel_id),
          0
        ) as raw_ratio
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
    private.subscriber_history_weight(normalized.date, studio_channel_id),
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

-- Rebuild the stored Supabase history once. Subsequent channel edits and the
-- existing daily cron continue to call the replaced refresh function.
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

commit;
