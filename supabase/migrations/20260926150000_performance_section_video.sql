begin;

-- Кнопки «?» (Shorts) и «✦» (Видео) в верхней панели открывают аналитику
-- настоящего ролика канала, выбранного в админке. Пусто — самый новый ролик
-- нужного формата.
alter table public.video_performance_sections
  add column if not exists video_id text references public.videos(id) on delete set null;

commit;
