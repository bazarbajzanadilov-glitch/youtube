begin;

-- Keep the stored series positive and deterministic, but add modest
-- day-to-day variation so the daily chart does not look artificially smooth.
with indexed_history as (
  select
    id,
    (date - date '2025-07-24')::integer as weight_index
  from public.subscriber_daily_stats
  where channel_id = '00000000-0000-0000-0000-000000000001'::uuid
),
varied_weights as (
  select
    id,
    (
      (
        80
        + weight_index * 0.6
        + 24 * (1 + sin(weight_index * 0.52))
        + 12 * (1 + sin(weight_index * 0.17))
      )
      * (
        1
        + 0.08 * sin(weight_index * 2.41 + 1.74)
        + 0.10 * power(
          greatest(0::double precision, sin((weight_index + 4) * 1.13)),
          6
        )
      )
    )::numeric as share_weight
  from indexed_history
)
update public.subscriber_daily_stats as stats
set share_weight = varied_weights.share_weight
from varied_weights
where stats.id = varied_weights.id;

select private.rescale_subscriber_daily_stats(
  '00000000-0000-0000-0000-000000000001'::uuid,
  subscriber_count
)
from public.channels
where id = '00000000-0000-0000-0000-000000000001'::uuid;

commit;
