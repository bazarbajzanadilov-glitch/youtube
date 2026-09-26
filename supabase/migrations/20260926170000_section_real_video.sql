begin;

-- Страницы «?» (Shorts) и «✦» (Видео) показывают аналитику настоящего видео
-- канала, выбранного в админке. Пусто — самое новое видео нужного формата.
alter table public.video_performance_sections
  add column if not exists video_id text references public.videos(id) on delete set null;

commit;
