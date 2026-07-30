begin;

-- A large downward edit used to consume the newest 28 days first. That could
-- leave the current analytics period at zero while the previous period stayed
-- positive, producing a false -100% subscriber comparison.
--
-- Keep the existing delta-only behavior for increases. For reductions,
-- redistribute the exact target across the complete stored history. The most
-- recent two comparison windows receive a one-subscriber floor when the target
-- can afford it, and a bounded target-dependent temporal tilt keeps different
-- channel totals from producing an invariant current/previous percentage.
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
  source_daily_average bigint := 1;
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

  if delta > 0 then
    -- Preserve manual dates. Automatic rows absorb an increase; if the whole
    -- window is manual, all rows participate so the exact total is reachable.
    with source as (
      select
        id,
        date,
        is_manual,
        avg(gained::numeric) over (
          order by date
          rows between 6 preceding and current row
        ) as smoothed,
        count(*) filter (where not is_manual) over () as automatic_rows
      from public.subscriber_daily_stats
      where channel_id = p_channel_id
        and date between allocation_start and history_end
    ),
    weighted as (
      select
        id,
        date,
        case
          when max(coalesce(smoothed, 0)) over () > 0
            then greatest(1::numeric, coalesce(smoothed, 0))
          else private.subscriber_daily_growth_factor(p_channel_id, date)
        end as weight
      from source
      where not is_manual or automatic_rows = 0
    ),
    normalized as (
      select
        *,
        delta::numeric * weight / nullif(sum(weight) over (), 0) as exact_value
      from weighted
    ),
    floored as (
      select
        *,
        floor(exact_value)::bigint as base_value,
        exact_value - floor(exact_value) as fraction
      from normalized
    ),
    ranked as (
      select
        *,
        row_number() over (order by fraction desc, date, id) as rank,
        delta - sum(base_value) over () as remainder
      from floored
    )
    update public.subscriber_daily_stats as stats
    set gained = (
      stats.gained
      + ranked.base_value
      + case when ranked.rank <= ranked.remainder then 1 else 0 end
    )::integer
    from ranked
    where stats.id = ranked.id;

    return;
  end if;

  -- Only repair the concrete damaged shape: the entire current window is zero
  -- while the adjacent previous window is positive. Ordinary zero-growth days
  -- remain untouched when the stored total already matches the channel.
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

  source_daily_average := greatest(
    1::bigint,
    round(current_total::numeric / greatest(1, row_count))::bigint
  );

  if delta < 0 or needs_collapsed_history_repair then
    -- `is_manual`, `share_weight`, and `manual_multiplier` remain untouched.
    -- A manual value still affects its row's weight through the current
    -- `gained` amount, but exact reconciliation is allowed to reduce it when
    -- the channel total is below the sum of all manually supplied history.
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
    floor_candidates as (
      select
        protected.id,
        case
          when position >= current_start then position - current_start
          else position - protected_start
        end as period_offset,
        case when position >= current_start then 0 else 1 end as period_order
      from protected
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
        protected.id,
        protected.date,
        case
          when floor_priorities.floor_rank <= target_total then 1::bigint
          else 0::bigint
        end as floor_value,
        (
          greatest(
            1::bigint,
            case
              when needs_collapsed_history_repair
                and protected.position >= protected.protected_start
                and protected.gained = 0
                then source_daily_average
              else protected.gained::bigint
            end
          )::double precision
          * pg_catalog.exp(
            0.24 * pg_catalog.sin(
              (
                2 * pg_catalog.pi()
                * (
                  protected.date - date '1970-01-01'
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
                  protected.date - date '1970-01-01'
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
      from protected
      left join floor_priorities
        on floor_priorities.id = protected.id
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
  end if;
end;
$$;

revoke all on function private.reconcile_subscriber_daily_stats(
  uuid, bigint, date, integer
) from public, anon, authenticated;
grant execute on function private.reconcile_subscriber_daily_stats(
  uuid, bigint, date, integer
) to authenticated;

-- Repair any already-zeroed current comparison period. Healthy equal-total
-- histories are detected inside the function and left byte-for-byte intact.
do $$
declare
  channel_record record;
begin
  for channel_record in
    select id, subscriber_count
    from public.channels
    order by id
  loop
    perform private.reconcile_subscriber_daily_stats(
      channel_record.id,
      channel_record.subscriber_count
    );
  end loop;
end;
$$;

commit;
