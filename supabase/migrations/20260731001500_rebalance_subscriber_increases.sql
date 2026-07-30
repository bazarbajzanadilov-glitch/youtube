begin;

-- Reconcile both increases and reductions by redistributing the authoritative
-- total across the complete stored history. The previous implementation sent
-- every positive delta into the newest 28 days, so a large channel edit could
-- turn one analytics period into an implausible spike.
create or replace function private.reconcile_subscriber_daily_stats(
  p_channel_id uuid,
  p_target_total bigint,
  p_end_date date default (
    (now() at time zone 'Asia/Almaty')::date - 1
  ),
  p_window_days integer default 28
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_total bigint;
  channel_join_date date;
  history_end date := least(
    coalesce(p_end_date, (now() at time zone 'Asia/Almaty')::date - 1),
    (now() at time zone 'Asia/Almaty')::date - 1
  );
  comparison_days integer := greatest(
    1,
    least(365, coalesce(p_window_days, 28))
  );
  row_count integer;
  allocation_start date;
  current_total bigint;
  delta bigint;
  current_window_total bigint := 0;
  previous_window_total bigint := 0;
  needs_collapsed_history_repair boolean := false;
  needs_inflated_history_repair boolean := false;
  collapsed_fill_average bigint := 1;
  allocated_total bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('subscriber:' || p_channel_id::text, 0)
  );

  select
    greatest(0, coalesce(channels.subscriber_count, p_target_total, 0)),
    channels.join_date
  into target_total, channel_join_date
  from public.channels
  where channels.id = p_channel_id;

  if not found or channel_join_date > history_end then
    return;
  end if;

  select count(*)
  into row_count
  from public.subscriber_daily_stats
  where channel_id = p_channel_id;

  allocation_start := case
    when row_count = 0 then greatest(channel_join_date, history_end - 364)
    else greatest(
      channel_join_date,
      history_end - comparison_days + 1
    )
  end;

  insert into public.subscriber_daily_stats (channel_id, date, gained, lost)
  select p_channel_id, generated.day::date, 0, 0
  from pg_catalog.generate_series(
    allocation_start,
    history_end,
    interval '1 day'
  ) as generated(day)
  on conflict (channel_id, date) do nothing;

  select count(*), coalesce(sum(gained::bigint), 0)
  into row_count, current_total
  from public.subscriber_daily_stats
  where channel_id = p_channel_id;

  delta := target_total - current_total;

  -- Preserve the narrow repair from the preceding migration: only an entirely
  -- empty current comparison window next to a positive previous window is
  -- considered collapsed. Ordinary zero-growth days remain valid.
  with positioned as (
    select
      stats.gained,
      row_number() over (order by stats.date, stats.id) - 1 as position,
      count(*) over () as total_rows
    from public.subscriber_daily_stats as stats
    where stats.channel_id = p_channel_id
  )
  select
    coalesce(sum(gained::bigint) filter (
      where position >= greatest(0, total_rows - comparison_days)
    ), 0),
    coalesce(sum(gained::bigint) filter (
      where position >= greatest(0, total_rows - (comparison_days * 2))
        and position < greatest(0, total_rows - comparison_days)
    ), 0)
  into current_window_total, previous_window_total
  from positioned;

  needs_collapsed_history_repair := (
    target_total > 0
    and current_window_total = 0
    and previous_window_total > 0
  );
  needs_inflated_history_repair := (
    target_total > 0
    and current_window_total::numeric > target_total::numeric * 0.10
  );

  if delta = 0
    and not needs_collapsed_history_repair
    and not needs_inflated_history_repair
  then
    return;
  end if;

  collapsed_fill_average := greatest(
    1::bigint,
    round(current_total::numeric / greatest(1, row_count))::bigint
  );

  -- `is_manual`, `share_weight`, and `manual_multiplier` are deliberately not
  -- updated. Manual values still influence their row weights through `gained`;
  -- exact reconciliation may resize them only when the channel total changes.
  with positioned as (
    select
      stats.id,
      stats.date,
      stats.gained,
      stats.is_manual,
      row_number() over (order by stats.date, stats.id) - 1 as position,
      count(*) over () as total_rows
    from public.subscriber_daily_stats as stats
    where stats.channel_id = p_channel_id
  ),
  protected as (
    select
      positioned.*,
      greatest(0, total_rows - (comparison_days * 2)) as protected_start,
      greatest(
        greatest(0, total_rows - (comparison_days * 2)),
        total_rows - comparison_days
      ) as current_start
    from positioned
  ),
  source_values as (
    select
      protected.*,
      case
        when needs_inflated_history_repair then 1::numeric
        when needs_collapsed_history_repair
          and protected.position >= protected.protected_start
          and protected.gained = 0
          then collapsed_fill_average::numeric
        else protected.gained::numeric
      end as source_gained
    from protected
  ),
  bounded_source as (
    select
      source_values.*,
      avg(source_gained) over () as source_daily_average
    from source_values
  ),
  floor_candidates as (
    select
      bounded_source.id,
      case
        when position >= current_start then position - current_start
        else position - protected_start
      end as period_offset,
      case when position >= current_start then 0 else 1 end as period_order
    from bounded_source
    where position >= protected_start
  ),
  floor_priorities as (
    select
      floor_candidates.id,
      row_number() over (
        order by period_offset, period_order, id
      ) as floor_rank
    from floor_candidates
  ),
  weighted as (
    select
      bounded_source.id,
      bounded_source.date,
      case
        when floor_priorities.floor_rank <= target_total then 1::bigint
        else 0::bigint
      end as floor_value,
      (
        greatest(
          0.75::numeric,
          least(
            1.25::numeric,
            bounded_source.source_gained
              / greatest(1::numeric, bounded_source.source_daily_average)
          )
        )::double precision
        * pg_catalog.exp(
          0.24 * pg_catalog.sin(
            (
              2 * pg_catalog.pi()
              * (
                bounded_source.date - date '1970-01-01'
              )::double precision
              / 83
            )
            + (
              pg_catalog.ln(1 + target_total::numeric)::double precision
              * 0.83
            )
          )
          + 0.08 * pg_catalog.sin(
            (
              2 * pg_catalog.pi()
              * (
                bounded_source.date - date '1970-01-01'
              )::double precision
              / 29
            )
            - (
              pg_catalog.ln(1 + target_total::numeric)::double precision
              * 0.83
              * 0.37
            )
          )
        )
      )::numeric as weight
    from bounded_source
    left join floor_priorities
      on floor_priorities.id = bounded_source.id
  ),
  normalized as (
    select
      weighted.*,
      greatest(
        0::bigint,
        target_total - sum(floor_value) over ()
      ) as distributable,
      sum(weight) over () as weight_total
    from weighted
  ),
  exact_values as (
    select
      normalized.*,
      case
        when distributable > 0 and weight_total > 0
          then distributable::numeric * weight / weight_total
        else 0::numeric
      end as exact_value
    from normalized
  ),
  floored as (
    select
      exact_values.*,
      floor(exact_value)::bigint as base_value,
      exact_value - floor(exact_value) as fraction
    from exact_values
  ),
  ranked as (
    select
      floored.*,
      row_number() over (
        order by fraction desc, date, id
      ) as allocation_rank,
      target_total
        - sum(floor_value + base_value) over () as remainder
    from floored
  )
  update public.subscriber_daily_stats as stats
  set
    gained = (
      ranked.floor_value
      + ranked.base_value
      + case
          when ranked.allocation_rank <= ranked.remainder then 1
          else 0
        end
    )::integer,
    lost = 0
  from ranked
  where stats.id = ranked.id;

  select coalesce(sum(gained::bigint), 0)
  into allocated_total
  from public.subscriber_daily_stats
  where channel_id = p_channel_id;

  if allocated_total <> target_total then
    raise exception
      'subscriber history reconciliation mismatch: expected %, allocated %',
      target_total,
      allocated_total;
  end if;
end;
$$;

revoke all on function private.reconcile_subscriber_daily_stats(
  uuid, bigint, date, integer
) from public, anon, authenticated;
grant execute on function private.reconcile_subscriber_daily_stats(
  uuid, bigint, date, integer
) to authenticated;

-- One-time repair for histories created by the former positive-delta branch.
-- Only channels whose newest 28 rows exceed 10% of the authoritative total
-- are rebased. Resetting weights to one is deterministic and touches only
-- `gained`/`lost`; the reconciliation function then performs the exact,
-- target-tilted allocation while preserving all manual metadata.
do $$
declare
  channel_record record;
begin
  for channel_record in
    with ranked_history as (
      select
        stats.channel_id,
        stats.gained,
        row_number() over (
          partition by stats.channel_id
          order by stats.date desc, stats.id desc
        ) as recency_rank
      from public.subscriber_daily_stats as stats
    ),
    channel_history as (
      select
        ranked_history.channel_id,
        coalesce(sum(ranked_history.gained::bigint), 0) as history_total,
        coalesce(sum(ranked_history.gained::bigint) filter (
          where ranked_history.recency_rank <= 28
        ), 0) as current_28_total
      from ranked_history
      group by ranked_history.channel_id
    )
    select
      channels.id,
      channels.subscriber_count
    from public.channels as channels
    join channel_history
      on channel_history.channel_id = channels.id
    where channels.subscriber_count > 0
      and channel_history.current_28_total::numeric
        > channels.subscriber_count::numeric * 0.10
    order by channels.id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'subscriber:' || channel_record.id::text,
        0
      )
    );

    update public.subscriber_daily_stats
    set
      gained = 1,
      lost = 0
    where channel_id = channel_record.id;

    perform private.reconcile_subscriber_daily_stats(
      channel_record.id,
      channel_record.subscriber_count
    );
  end loop;
end;
$$;

commit;
