begin;

-- Как в YouTube Studio «С момента публикации»: почти все просмотры ролик
-- набирает в первые недели (старт, вторая волна рекомендаций), дальше
-- накопленный график выходит на плато. Прежний постоянный «пол» веса давал
-- заметный линейный хвост — на длинной дистанции график шёл ровным ростом.
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
      pg_catalog.decode(pg_catalog.md5(p_video_id || ':' || p_date::text), 'hex') as day_seed,
      -- Периоды по 3 дня: рекомендации то разгоняют ролик, то затихают.
      pg_catalog.decode(pg_catalog.md5(
        p_video_id || ':block:' || floor(greatest(0, p_date - p_published_at) / 3.0)::text
      ), 'hex') as block_seed
  ),
  inputs as (
    select
      greatest(0, p_date - p_published_at)::double precision as age,
      (pg_catalog.get_byte(video_seed, 0)::double precision / 255.0) * 2 * pi() as phase,
      1.6 + (pg_catalog.get_byte(video_seed, 1)::double precision / 255.0) * 2.4 as early_decay,
      10.0 + (pg_catalog.get_byte(video_seed, 2)::double precision / 255.0) * 30.0 as second_wave,
      0.45 + (pg_catalog.get_byte(video_seed, 3)::double precision / 255.0) * 0.75 as wave_height,
      0.70 + (pg_catalog.get_byte(day_seed, 0)::double precision / 255.0) * 0.60 as ordinary_noise,
      0.50 + (pg_catalog.get_byte(block_seed, 0)::double precision / 255.0) * 0.90 as regime,
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
          0.002
          + 4.0 * exp(-greatest(0, inputs.age - 1) / inputs.early_decay)
          + 0.20 * exp(-inputs.age / 15.0)
          + inputs.wave_height * 0.5 * exp(-power((inputs.age - inputs.second_wave) / 3.0, 2))
        when 'decayAfterPeak' then
          0.002
          + 2.6 * exp(-greatest(0, inputs.age - 1) / inputs.early_decay)
          + 0.25 * exp(-inputs.age / 20.0)
          + inputs.wave_height * 0.3 * exp(-power((inputs.age - inputs.second_wave) / 4.0, 2))
        when 'steady' then
          0.004
          + 1.8 * exp(-greatest(0, inputs.age - 1) / inputs.early_decay)
          + 0.30 * exp(-inputs.age / 28.0)
          + 0.03 * sin(2 * pi() * inputs.age / 17.0 + inputs.phase) * exp(-inputs.age / 40.0)
        when 'seasonal' then
          0.003
          + 2.2 * exp(-greatest(0, inputs.age - 1) / inputs.early_decay)
          + 0.25 * exp(-inputs.age / 22.0)
          + 0.06 * (1 + sin(2 * pi() * inputs.age / 14.0 + inputs.phase)) * exp(-inputs.age / 40.0)
        else
          0.003
          + 2.0 * (1 - exp(-(inputs.age + 1) / 1.5)) * exp(-inputs.age / (inputs.early_decay * 1.3))
          + 0.28 * exp(-inputs.age / 24.0)
          + inputs.wave_height * 0.35 * exp(-power((inputs.age - inputs.second_wave) / 4.0, 2))
      end as base
    from inputs
  )
  select greatest(
    0.001::double precision,
    shaped.base
      * shaped.upload_day
      * shaped.weekend
      * shaped.ordinary_noise
      -- Первые дни — всегда самый сильный старт, колебания начинаются позже.
      * case when shaped.age < 4 then 1.0 else shaped.regime end
      * case
          when shaped.shock > 0.93 and shaped.age >= 5 then 1.5 + ((shaped.shock - 0.93) / 0.07) * 1.0
          when shaped.shock < 0.04 then 0.72
          else 1.0
        end
  )::numeric
  from shaped;
$$;

-- Перераспределить накопленную историю по новой форме. Итоги роликов
-- (videos.views, likes, revenue и т. д.) не меняются.
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
