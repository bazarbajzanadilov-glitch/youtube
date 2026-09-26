begin;

-- Откат 20260926150000: страницы «?» и «✦» остаются отдельными, как просил клиент.
alter table public.video_performance_sections drop column if exists video_id;

commit;
