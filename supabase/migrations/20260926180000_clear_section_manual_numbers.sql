begin;

-- Страницы «?» и «✦» теперь показывают настоящее видео. Вписанные вручную
-- числа (просмотры, доход, источники трафика) больше нигде не используются —
-- обнуляем их, чтобы в базе не оставалось выдуманных значений.
update public.video_performance_sections
set total_views = 0,
    typical_views = 0,
    watch_hours = 0,
    typical_watch_hours = 0,
    subscribers_gained = 0,
    revenue_tenge = 0,
    realtime_views_48h = 0,
    traffic_sources = '[]'::jsonb;

commit;
