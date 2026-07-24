alter table public.subscriber_daily_stats
add column if not exists share_weight numeric not null default 1
check (share_weight >= 0);

with indexed_history as (
  select
    id,
    row_number() over (
      partition by channel_id
      order by date, id
    ) - 1 as day_index
  from public.subscriber_daily_stats
)
update public.subscriber_daily_stats as stats
set share_weight = (
  80
  + indexed_history.day_index * 0.6
  + 24 * (1 + sin(indexed_history.day_index * 0.52))
  + 12 * (1 + sin(indexed_history.day_index * 0.17))
)::numeric
from indexed_history
where stats.id = indexed_history.id;

create or replace function private.rescale_subscriber_daily_stats(
  p_channel_id uuid,
  p_target_total bigint
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  history_rows integer;
  current_weight_total numeric;
  target_total bigint := greatest(0, coalesce(p_target_total, 0));
begin
  select count(*), coalesce(sum(share_weight), 0)
  into history_rows, current_weight_total
  from public.subscriber_daily_stats
  where channel_id = p_channel_id;

  if history_rows = 0 then
    return;
  end if;

  with weighted as (
    select
      id,
      date,
      case
        when current_weight_total > 0 then greatest(0, share_weight)
        else 1::numeric
      end as weight
    from public.subscriber_daily_stats
    where channel_id = p_channel_id
  ),
  normalized as (
    select
      *,
      weight * target_total / sum(weight) over () as exact_value
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
      row_number() over (order by fraction desc, date, id) as fraction_rank,
      target_total - sum(gained_floor) over () as remainder
    from floored
  )
  update public.subscriber_daily_stats as stats
  set
    gained = (
      ranked.gained_floor
      + case when ranked.fraction_rank <= ranked.remainder then 1 else 0 end
    )::integer,
    lost = 0
  from ranked
  where stats.id = ranked.id;
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
    perform private.rescale_subscriber_daily_stats(new.id, new.subscriber_count);
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

create or replace function public.replace_subscriber_daily_stats(p_stats jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  studio_channel_id constant uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  channel_total bigint;
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
    lost,
    share_weight
  )
  select
    studio_channel_id,
    item.date,
    greatest(0, coalesce(item.gained, 0)),
    0,
    greatest(0, coalesce(item.gained, 0))
  from jsonb_to_recordset(coalesce(p_stats, '[]'::jsonb)) as item(
    date date,
    gained integer,
    lost integer
  )
  where item.date is not null;

  select subscriber_count
  into channel_total
  from public.channels
  where id = studio_channel_id;

  perform private.rescale_subscriber_daily_stats(
    studio_channel_id,
    coalesce(channel_total, 0)
  );
end;
$$;

revoke all on function public.replace_subscriber_daily_stats(jsonb)
from public, anon;
grant execute on function public.replace_subscriber_daily_stats(jsonb)
to authenticated;

do $$
declare
  channel_row record;
begin
  for channel_row in
    select id, subscriber_count
    from public.channels
  loop
    perform private.rescale_subscriber_daily_stats(
      channel_row.id,
      channel_row.subscriber_count
    );
  end loop;
end;
$$;
