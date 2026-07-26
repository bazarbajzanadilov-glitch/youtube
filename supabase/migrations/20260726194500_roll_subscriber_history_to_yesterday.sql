begin;

-- One-time replacement of the previously generated demo window. The product
-- now stores one positive daily-growth series and never rebuilds it in the UI.
delete from public.subscriber_daily_stats
where channel_id = '00000000-0000-0000-0000-000000000001'::uuid
  and date < date '2025-07-26';

with missing_days(date, day_index) as (
  values
    (date '2026-07-24', 365),
    (date '2026-07-25', 366)
)
insert into public.subscriber_daily_stats (
  channel_id,
  date,
  gained,
  lost,
  share_weight
)
select
  c.id,
  missing_days.date,
  0,
  0,
  (
    80
    + missing_days.day_index * 0.6
    + 24 * (1 + sin(missing_days.day_index * 0.52))
    + 12 * (1 + sin(missing_days.day_index * 0.17))
  )::numeric
from missing_days
join public.channels as c
  on c.id = '00000000-0000-0000-0000-000000000001'::uuid
on conflict (channel_id, date) do nothing;

select private.rescale_subscriber_daily_stats(
  '00000000-0000-0000-0000-000000000001'::uuid,
  subscriber_count
)
from public.channels
where id = '00000000-0000-0000-0000-000000000001'::uuid;

commit;
