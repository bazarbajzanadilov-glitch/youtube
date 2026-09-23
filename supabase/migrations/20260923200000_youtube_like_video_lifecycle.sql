begin;

-- Дневная история роликов как в YouTube: основная часть просмотров приходится
-- на первые дни после публикации, дальше спад к длинному хвосту с недельными
-- колебаниями, всплесками рекомендаций и шумом. Прежние формы давали почти
-- ровные дневные значения, из-за чего накопленный график был прямой линией.
create or replace function private.video_initial_history_weight(
  p_video_id text,
  p_date date,
  p_published_at date,
  p_profile text
)
returns numeric
language sql
immutable
parallel safe
security invoker
set search_path = ''
as $$
  with seed as (
    select
      pg_catalog.decode(pg_catalog.md5(p_video_id), 'hex') as video_seed,
      pg_catalog.decode(pg_catalog.md5(p_video_id || ':' || p_date::text), 'hex') as day_seed
  ),
  inputs as (
    select
      greatest(0, p_date - p_published_at)::double precision as age,
      (pg_catalog.get_byte(video_seed, 0)::double precision / 255.0) * 2 * pi() as phase,
      1.6 + (pg_catalog.get_byte(video_seed, 1)::double precision / 255.0) * 2.4 as early_decay,
      8.0 + (pg_catalog.get_byte(video_seed, 2)::double precision / 255.0) * 16.0 as second_wave,
      0.35 + (pg_catalog.get_byte(video_seed, 3)::double precision / 255.0) * 0.55 as wave_height,
      0.84 + (pg_catalog.get_byte(day_seed, 0)::double precision / 255.0) * 0.32 as ordinary_noise,
      pg_catalog.get_byte(day_seed, 1)::double precision / 255.0 as shock,
      case when extract(isodow from p_date) >= 6 then 1.09 else 1.0 end as weekend
    from seed
  ),
  shaped as (
    select
      inputs.*,
      case when inputs.age = 0 then 0.62 else 1.0 end as upload_day,
      case coalesce(p_profile, 'gradualGrowth')
        when 'viralSpike' then
          0.05
          + 7.5 * exp(-greatest(0, inputs.age - 1) / inputs.early_decay)
          + inputs.wave_height * 1.4 * exp(-power((inputs.age - inputs.second_wave) / 3.0, 2))
          + 0.30 * exp(-inputs.age / 30.0)
        when 'decayAfterPeak' then
          0.07
          + 4.2 * exp(-greatest(0, inputs.age - 1) / (inputs.early_decay * 2.2))
          + 0.45 * exp(-inputs.age / 45.0)
          + inputs.wave_height * 0.6 * exp(-power((inputs.age - inputs.second_wave) / 4.0, 2))
        when 'steady' then
          0.30
          + 2.2 * exp(-greatest(0, inputs.age - 1) / (inputs.early_decay * 3.0))
          + 0.10 * sin(2 * pi() * inputs.age / 17.0 + inputs.phase)
        when 'seasonal' then
          0.28
          + 2.4 * exp(-greatest(0, inputs.age - 1) / (inputs.early_decay * 2.5))
          + 0.22 * (1 + sin(2 * pi() * inputs.age / 14.0 + inputs.phase))
          + inputs.wave_height * 0.7 * exp(-power((inputs.age - inputs.second_wave) / 3.5, 2))
        else
          0.12
          + 2.6 * (1 - exp(-(inputs.age + 1) / 2.5)) * exp(-inputs.age / (inputs.early_decay * 6.0))
          + 0.30 * exp(-inputs.age / 60.0)
          + inputs.wave_height * 0.8 * exp(-power((inputs.age - inputs.second_wave) / 4.0, 2))
      end as base
    from inputs
  )
  select greatest(
    0.02::double precision,
    shaped.base
      * shaped.upload_day
      * shaped.weekend
      * shaped.ordinary_noise
      * case
          when shaped.shock > 0.96 then 1.25 + ((shaped.shock - 0.96) / 0.04) * 0.45
          when shaped.shock < 0.04 then 0.72
          else 1.0
        end
  )::numeric
  from shaped;
$$;

-- Следующий день продолжает форму ролика: отношение весов «сегодня / прошлая
-- неделя» переносится на реальный недавний уровень. Ограничения шире прежних,
-- чтобы спад после старта и всплески рекомендаций были видны.
create or replace function private.video_next_daily_views(
  p_video_id text,
  p_date date,
  p_published_at date,
  p_profile text
)
returns bigint
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  lifetime_views bigint;
  trailing_median numeric;
  last_views numeric;
  base numeric;
  target_weight numeric;
  previous_weight numeric;
  noise numeric;
  candidate numeric;
begin
  select views into lifetime_views from public.videos where id = p_video_id;

  select
    percentile_cont(0.5) within group (order by views),
    (array_agg(views order by date desc))[1]
  into trailing_median, last_views
  from public.video_daily_stats
  where video_id = p_video_id
    and date between p_date - 7 and p_date - 1
    and views > 0;

  base := coalesce(
    trailing_median,
    greatest(1, round(greatest(0, coalesce(lifetime_views, 0))::numeric
      / greatest(1, p_date - p_published_at + 1)))
  );
  last_views := coalesce(last_views, base);
  target_weight := private.video_initial_history_weight(p_video_id, p_date, p_published_at, p_profile);

  select avg(private.video_initial_history_weight(p_video_id, day::date, p_published_at, p_profile))
  into previous_weight
  from generate_series(p_date - 7, p_date - 1, interval '1 day') as day;

  noise := 0.90 + (
    pg_catalog.get_byte(
      pg_catalog.decode(pg_catalog.md5(p_video_id || ':' || p_date::text || ':views'), 'hex'),
      0
    )::numeric / 255
  ) * 0.20;

  candidate := base * target_weight / greatest(0.02, coalesce(previous_weight, target_weight)) * noise;
  candidate := least(base * 2.2, greatest(base * 0.35, candidate));
  candidate := least(last_views * 1.8, greatest(last_views * 0.5, candidate));

  return greatest(1, round(candidate)::bigint);
end;
$$;

revoke all on function private.video_next_daily_views(text, date, date, text)
  from public, anon, authenticated;

-- Перераспределить уже накопленную историю по новой форме. Итоги роликов
-- (videos.views, likes, revenue и т. д.) не меняются — меняется только то,
-- в какие дни эти просмотры пришли.
do $$
declare
  v_id text;
begin
  for v_id in select id from public.videos loop
    delete from public.video_daily_stats where video_daily_stats.video_id = v_id;
    perform private.reconcile_video_daily_stats(v_id);
  end loop;
end;
$$;

commit;
