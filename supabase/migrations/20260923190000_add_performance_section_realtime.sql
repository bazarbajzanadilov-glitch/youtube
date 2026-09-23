begin;

-- Карточка «Текущая статистика» справа в разделе «С момента публикации».
alter table public.video_performance_sections
  add column if not exists realtime_views_48h bigint not null default 59355
    check (realtime_views_48h >= 0),
  add column if not exists traffic_sources jsonb not null default '[
    {"label": "Плейлисты", "percent": 48.1},
    {"label": "Функции выбора контента", "percent": 17.3},
    {"label": "Рекомендованные видео", "percent": 9.7},
    {"label": "Поиск на YouTube", "percent": 6.4},
    {"label": "Адресная строка, закладки и т. п.", "percent": 2.1}
  ]'::jsonb;

alter table public.video_performance_sections
  drop constraint if exists video_performance_sections_traffic_sources_array;
alter table public.video_performance_sections
  add constraint video_performance_sections_traffic_sources_array
  check (jsonb_typeof(traffic_sources) = 'array');

commit;
