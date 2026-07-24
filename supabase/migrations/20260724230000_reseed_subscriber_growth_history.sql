begin;

delete from public.subscriber_daily_stats
where channel_id = '00000000-0000-0000-0000-000000000001'::uuid;

with channel_target as (
  select
    id as channel_id,
    greatest(0, subscriber_count)::bigint as total_target,
    least(
      greatest(0, subscriber_count)::bigint,
      round(greatest(0, subscriber_count) * (9689.0 / 78453.0))::bigint
    ) as recent_target
  from public.channels
  where id = '00000000-0000-0000-0000-000000000001'::uuid
),
weighted as (
  select
    channel_target.channel_id,
    (date '2025-07-24' + day_offset)::date as date,
    day_offset,
    case when day_offset >= 337 then 'recent' else 'earlier' end as segment,
    case
      when day_offset >= 337 then channel_target.recent_target
      else channel_target.total_target - channel_target.recent_target
    end as segment_target,
    case
      when day_offset >= 337
        then 300 + floor((day_offset - 337) * 2.2) + mod(day_offset * 31, 71)
      else 160 + floor(day_offset * 0.22) + mod(day_offset * 47, 83)
    end::numeric as weight
  from channel_target
  cross join generate_series(0, 364) as day_offset
),
normalized as (
  select
    *,
    weight * segment_target
      / sum(weight) over (partition by channel_id, segment) as exact_value
  from weighted
),
floored as (
  select
    *,
    floor(exact_value)::bigint as gained_floor,
    exact_value - floor(exact_value) as fraction
  from normalized
),
ranked as (
  select
    *,
    row_number() over (
      partition by channel_id, segment
      order by fraction desc, day_offset
    ) as fraction_rank,
    segment_target - sum(gained_floor) over (
      partition by channel_id, segment
    ) as remainder
  from floored
)
insert into public.subscriber_daily_stats (channel_id, date, gained, lost)
select
  channel_id,
  date,
  (
    gained_floor
    + case when fraction_rank <= remainder then 1 else 0 end
  )::integer as gained,
  0 as lost
from ranked
order by date;

commit;
