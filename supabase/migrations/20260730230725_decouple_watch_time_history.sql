begin;

-- Watch time follows views, but daily retention naturally moves independently.
-- The factor is stable for a video/calendar date and never depends on a mutable
-- lifetime counter or on the analytics range selected in the UI.
create or replace function private.video_watch_history_factor(
  p_video_id text,
  p_date date,
  p_published_at date
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
      greatest(0, p_date - p_published_at)::double precision as age,
      (
        (
          pg_catalog.get_byte(
            pg_catalog.decode(pg_catalog.md5(p_video_id), 'hex'),
            0
          )::bigint * 16777216
          + pg_catalog.get_byte(
            pg_catalog.decode(pg_catalog.md5(p_video_id), 'hex'),
            1
          )::bigint * 65536
          + pg_catalog.get_byte(
            pg_catalog.decode(pg_catalog.md5(p_video_id), 'hex'),
            2
          )::bigint * 256
          + pg_catalog.get_byte(
            pg_catalog.decode(pg_catalog.md5(p_video_id), 'hex'),
            3
          )::bigint
        )::double precision
        / 4294967295.0
      ) * 2 * pi() as phase
  )
  select greatest(
    0.72::double precision,
    least(
      1.28::double precision,
      (
        case
          when inputs.age < 5 then 0.94 + inputs.age * 0.015
          else 1.0
        end
      )
      * exp(
        0.14 * sin(2 * pi() * inputs.age / 19.0 + inputs.phase)
        + 0.06 * sin(
          2 * pi() * inputs.age / 7.0
          + inputs.phase * 0.63
          + 1.1
        )
      )
    )
  )::numeric
  from inputs;
$$;

revoke all on function private.video_watch_history_factor(
  text, date, date
) from public, anon, authenticated;
grant execute on function private.video_watch_history_factor(
  text, date, date
) to authenticated;

-- Add watch seconds without ever exceeding the physical capacity of a day:
-- daily views multiplied by the full video duration. Water-filling repeats
-- only when a high-weight day reaches its capacity.
create or replace function private.increase_video_watch_range(
  p_video_id text,
  p_amount bigint,
  p_start_date date,
  p_end_date date
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  remaining bigint := greatest(0, coalesce(p_amount, 0));
  available_capacity numeric;
  batch bigint;
  allocated_round bigint;
  allocated_total bigint := 0;
begin
  if remaining <= 0 or p_start_date is null or p_end_date is null then
    return 0;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('video:' || p_video_id, 0)
  );

  loop
    select coalesce(sum(
      greatest(
        0::numeric,
        stats.views::numeric * videos.duration_seconds::numeric
          - stats.watch_seconds::numeric
      )
    ), 0::numeric)
    into available_capacity
    from public.video_daily_stats as stats
    join public.videos as videos on videos.id = stats.video_id
    where stats.video_id = p_video_id
      and stats.date between p_start_date and p_end_date;

    batch := least(remaining::numeric, available_capacity)::bigint;
    exit when batch <= 0;

    with active as (
      select
        stats.id,
        stats.date,
        (
          stats.views::numeric * videos.duration_seconds::numeric
            - stats.watch_seconds::numeric
        ) as capacity,
        greatest(
          0.000001::numeric,
          stats.views::numeric
          * private.video_watch_history_factor(
              stats.video_id,
              stats.date,
              videos.published_at
            )
        ) as weight
      from public.video_daily_stats as stats
      join public.videos as videos on videos.id = stats.video_id
      where stats.video_id = p_video_id
        and stats.date between p_start_date and p_end_date
        and stats.views::numeric * videos.duration_seconds::numeric
          > stats.watch_seconds::numeric
    ),
    weighted as (
      select
        *,
        batch::numeric * weight / nullif(sum(weight) over (), 0) as exact_value
      from active
    ),
    planned as (
      select
        id,
        least(capacity, floor(exact_value))::bigint as amount
      from weighted
    ),
    applied as (
      update public.video_daily_stats as stats
      set watch_seconds = stats.watch_seconds + planned.amount
      from planned
      where stats.id = planned.id
        and planned.amount > 0
      returning planned.amount
    )
    select coalesce(sum(amount), 0)::bigint
    into allocated_round
    from applied;

    if allocated_round > 0 then
      remaining := remaining - allocated_round;
      allocated_total := allocated_total + allocated_round;
      continue;
    end if;

    -- When every exact share is below one second, largest-weight rows receive
    -- one second each. The next loop repeats if more than one pass is needed.
    with candidates as (
      select
        stats.id,
        row_number() over (
          order by
            (
              stats.views::numeric
              * private.video_watch_history_factor(
                  stats.video_id,
                  stats.date,
                  videos.published_at
                )
            ) desc,
            stats.date,
            stats.id
        ) as allocation_rank
      from public.video_daily_stats as stats
      join public.videos as videos on videos.id = stats.video_id
      where stats.video_id = p_video_id
        and stats.date between p_start_date and p_end_date
        and stats.views::numeric * videos.duration_seconds::numeric
          > stats.watch_seconds::numeric
    ),
    applied as (
      update public.video_daily_stats as stats
      set watch_seconds = stats.watch_seconds + 1
      from candidates
      where stats.id = candidates.id
        and candidates.allocation_rank <= remaining
      returning 1 as amount
    )
    select coalesce(sum(amount), 0)::bigint
    into allocated_round
    from applied;

    exit when allocated_round <= 0;
    remaining := remaining - allocated_round;
    allocated_total := allocated_total + allocated_round;
  end loop;

  return allocated_total;
end;
$$;

revoke all on function private.increase_video_watch_range(
  text, bigint, date, date
) from public, anon, authenticated;
grant execute on function private.increase_video_watch_range(
  text, bigint, date, date
) to authenticated;

-- Keep the deployed signature. Watch time is rebuilt deterministically on
-- every reconciliation so view or duration reductions cannot leave any day
-- above its physical capacity. Other metrics retain delta reconciliation.
create or replace function private.reconcile_video_metric(
  p_video_id text,
  p_column text,
  p_target bigint,
  p_start_date date,
  p_end_date date,
  p_published_at date,
  p_profile text,
  p_scale integer default 1
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_total bigint;
  delta bigint;
  changed bigint;
  reduced bigint;
  older_start date;
  history_start date;
  history_end date;
  watch_target bigint := greatest(0, coalesce(p_target, 0));
  reconciled numeric;
  exceeds_capacity boolean;
begin
  if p_column not in (
    'views', 'watch_seconds', 'engaged_views', 'impressions',
    'likes', 'comments', 'revenue'
  ) then
    raise exception 'unsupported analytics metric: %', p_column;
  end if;

  if p_column = 'watch_seconds' and p_scale = 1 then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('video:' || p_video_id, 0)
    );

    select min(date), max(date)
    into history_start, history_end
    from public.video_daily_stats
    where video_id = p_video_id;

    update public.video_daily_stats
    set watch_seconds = 0
    where video_id = p_video_id;

    changed := private.increase_video_watch_range(
      p_video_id,
      watch_target,
      history_start,
      history_end
    );

    select
      coalesce(sum(stats.watch_seconds::numeric), 0::numeric),
      coalesce(
        bool_or(
          stats.watch_seconds::numeric
            > stats.views::numeric * videos.duration_seconds::numeric
        ),
        false
      )
    into reconciled, exceeds_capacity
    from public.video_daily_stats as stats
    join public.videos as videos on videos.id = stats.video_id
    where stats.video_id = p_video_id;

    if changed::numeric <> watch_target::numeric
      or reconciled <> watch_target::numeric
      or exceeds_capacity
    then
      raise exception
        'watch-time bounded reconciliation failed for video %',
        p_video_id;
    end if;

    return;
  end if;

  execute format(
    'select coalesce(sum(round(%I * $2)::bigint), 0)
       from public.video_daily_stats
      where video_id = $1',
    p_column
  )
  into current_total
  using p_video_id, p_scale;

  delta := greatest(0, coalesce(p_target, 0)) - current_total;

  if delta > 0 then
    execute format(
      $sql$
        with source as (
          select
            id,
            date,
            avg(round(%1$I * $5)::numeric) over (
              order by date
              rows between 6 preceding and current row
            ) as smoothed
          from public.video_daily_stats
          where video_id = $1
            and date between $2 and $3
        ),
        weighted as (
          select
            id,
            date,
            case
              when max(coalesce(smoothed, 0)) over () > 0
                then greatest(1::numeric, coalesce(smoothed, 0))
              else private.video_initial_history_weight(
                $1, date, $6, $7
              )
            end as weight
          from source
        ),
        normalized as (
          select
            *,
            ($4::numeric * weight / nullif(sum(weight) over (), 0))
              as exact_value
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
            $4 - sum(base_value) over () as remainder
          from floored
        ),
        allocation as (
          select
            id,
            base_value + case when rank <= remainder then 1 else 0 end as amount
          from ranked
        )
        update public.video_daily_stats as stats
        set %1$I = (
          (
            round(stats.%1$I * $5)::bigint
            + allocation.amount
          )::numeric / $5
        )
        from allocation
        where stats.id = allocation.id
      $sql$,
      p_column
    )
    using
      p_video_id,
      p_start_date,
      p_end_date,
      delta,
      p_scale,
      p_published_at,
      p_profile;
  elsif delta < 0 then
    reduced := private.reduce_video_metric_range(
      p_video_id,
      p_column,
      -delta,
      p_start_date,
      p_end_date,
      p_scale
    );

    if reduced < -delta then
      select min(date)
      into older_start
      from public.video_daily_stats
      where video_id = p_video_id
        and date < p_start_date;

      perform private.reduce_video_metric_range(
        p_video_id,
        p_column,
        -delta - reduced,
        older_start,
        p_start_date - 1,
        p_scale
      );
    end if;
  end if;
end;
$$;

revoke all on function private.reconcile_video_metric(
  text, text, bigint, date, date, date, text, integer
) from public, anon, authenticated;
grant execute on function private.reconcile_video_metric(
  text, text, bigint, date, date, date, text, integer
) to authenticated;

-- Existing persisted rows were seeded with watch_seconds proportional to
-- views. Reshape only watch time, preserve its exact lifetime sum, and verify
-- the physical capacity and reconciliation before committing the migration.
do $$
declare
  video_record record;
  first_date date;
  last_date date;
  target_total numeric;
  total_capacity numeric;
  allocated bigint;
  reconciled numeric;
  exceeds_capacity boolean;
begin
  for video_record in
    select distinct stats.video_id
    from public.video_daily_stats as stats
    order by stats.video_id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'video:' || video_record.video_id,
        0
      )
    );

    select
      min(stats.date),
      max(stats.date),
      coalesce(sum(stats.watch_seconds::numeric), 0::numeric),
      coalesce(
        sum(
          stats.views::numeric * videos.duration_seconds::numeric
        ),
        0::numeric
      )
    into first_date, last_date, target_total, total_capacity
    from public.video_daily_stats as stats
    join public.videos as videos on videos.id = stats.video_id
    where stats.video_id = video_record.video_id;

    if target_total > total_capacity then
      raise exception
        'stored watch time exceeds daily view capacity for video %',
        video_record.video_id;
    end if;

    if target_total > 9223372036854775807::numeric then
      raise exception
        'stored watch time exceeds bigint allocator range for video %',
        video_record.video_id;
    end if;

    update public.video_daily_stats
    set watch_seconds = 0
    where video_id = video_record.video_id;

    allocated := private.increase_video_watch_range(
      video_record.video_id,
      target_total::bigint,
      first_date,
      last_date
    );

    select
      coalesce(sum(stats.watch_seconds::numeric), 0::numeric),
      coalesce(
        bool_or(
          stats.watch_seconds::numeric
            > stats.views::numeric * videos.duration_seconds::numeric
        ),
        false
      )
    into reconciled, exceeds_capacity
    from public.video_daily_stats as stats
    join public.videos as videos on videos.id = stats.video_id
    where stats.video_id = video_record.video_id;

    if allocated::numeric <> target_total
      or reconciled <> target_total
      or exceeds_capacity
    then
      raise exception
        'watch-time bounded reconciliation failed for video %',
        video_record.video_id;
    end if;
  end loop;
end;
$$;

commit;
