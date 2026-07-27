insert into public.channels (
  id,
  channel_name,
  country,
  subscriber_count,
  monetization_enabled,
  join_date,
  avatar_path
)
values (
  '00000000-0000-0000-0000-000000000001',
  'TRADING INSIDER',
  'KZ',
  79,
  true,
  '2022-01-15',
  'channels/00000000-0000-0000-0000-000000000001/avatar/trading-avatar.svg'
)
on conflict (id) do update
set channel_name = excluded.channel_name,
    country = excluded.country,
    subscriber_count = excluded.subscriber_count,
    monetization_enabled = excluded.monetization_enabled,
    join_date = excluded.join_date,
    avatar_path = excluded.avatar_path;

insert into public.videos (
  id,
  channel_id,
  title,
  cover_path,
  published_at,
  duration_seconds,
  content_type,
  views,
  likes,
  dislikes,
  average_view_percentage,
  revenue,
  analytics_profile
)
values
  ('btc-orderbook-income-breakdown', '00000000-0000-0000-0000-000000000001', 'Разбор сделки по BTC: вход, риск, профит', 'channels/00000000-0000-0000-0000-000000000001/videos/seed/trading-thumb-1.svg', '2026-05-08', 134, 'video', 2504, 125, 26, 48.20, 146.80, 'steady'),
  ('june-trading-income-plan', '00000000-0000-0000-0000-000000000001', 'Доход от трейдинга: план на июнь', 'channels/00000000-0000-0000-0000-000000000001/videos/seed/trading-thumb-2.svg', '2026-05-19', 64, 'video', 6, 0, 0, 52.40, 12.40, 'gradualGrowth'),
  ('scalping-risk-management', '00000000-0000-0000-0000-000000000001', 'Скальпинг без эмоций: риск-менеджмент', 'channels/00000000-0000-0000-0000-000000000001/videos/seed/trading-thumb-3.svg', '2026-05-21', 3, 'short', 3, 0, 0, 73.10, 5.75, 'gradualGrowth'),
  ('daily-profit-trading-setup', '00000000-0000-0000-0000-000000000001', 'Сетап дня: как забрать движение рынка', 'channels/00000000-0000-0000-0000-000000000001/videos/seed/trading-thumb-4.svg', '2026-05-24', 1, 'short', 1, 0, 0, 68.70, 2.25, 'gradualGrowth'),
  ('btc-weekly-levels-may-28', '00000000-0000-0000-0000-000000000001', 'План по BTC на неделю: уровни и сценарии', 'channels/00000000-0000-0000-0000-000000000001/videos/seed/trading-thumb-1.svg', '2026-05-28', 102, 'video', 1360, 68, 14, 46.90, 18.20, 'steady'),
  ('false-breakout-entry-june-02', '00000000-0000-0000-0000-000000000001', 'Как я ищу вход после ложного пробоя', 'channels/00000000-0000-0000-0000-000000000001/videos/seed/trading-thumb-2.svg', '2026-06-02', 126, 'video', 1820, 91, 18, 49.60, 22.75, 'gradualGrowth'),
  ('eth-trade-short-june-02', '00000000-0000-0000-0000-000000000001', 'Shorts: быстрый разбор сделки по ETH', 'channels/00000000-0000-0000-0000-000000000001/videos/seed/trading-thumb-3.svg', '2026-06-02', 38, 'short', 940, 47, 9, 71.80, 8.60, 'gradualGrowth'),
  ('morning-watchlist-june-11', '00000000-0000-0000-0000-000000000001', 'Портфель трейдера: что смотреть утром', 'channels/00000000-0000-0000-0000-000000000001/videos/seed/trading-thumb-4.svg', '2026-06-11', 88, 'video', 2110, 106, 21, 51.30, 25.40, 'steady'),
  ('daily-risk-stop-june-15', '00000000-0000-0000-0000-000000000001', 'Риск на день: где ставить стоп', 'channels/00000000-0000-0000-0000-000000000001/videos/seed/trading-thumb-1.svg', '2026-06-15', 71, 'video', 1640, 82, 16, 47.80, 19.20, 'gradualGrowth'),
  ('entry-mistakes-short-june-15', '00000000-0000-0000-0000-000000000001', 'Shorts: три ошибки перед входом', 'channels/00000000-0000-0000-0000-000000000001/videos/seed/trading-thumb-2.svg', '2026-06-15', 42, 'short', 1210, 61, 12, 69.40, 10.90, 'gradualGrowth'),
  ('weekly-close-market-scenario', '00000000-0000-0000-0000-000000000001', 'Сценарий по рынку перед закрытием недели', 'channels/00000000-0000-0000-0000-000000000001/videos/seed/trading-thumb-3.svg', '2026-06-20', 93, 'video', 1500, 75, 15, 50.20, 16.80, 'steady'),
  ('recent-processing-june-22', '00000000-0000-0000-0000-000000000001', 'Утренний план рынка: уровни и риск', 'channels/00000000-0000-0000-0000-000000000001/videos/seed/trading-thumb-1.svg', '2026-06-22', 72, 'video', 148, 7, 1, 53.60, 8.20, 'steady'),
  ('recent-processing-june-23', '00000000-0000-0000-0000-000000000001', 'BTC после импульса: где ждать вход', 'channels/00000000-0000-0000-0000-000000000001/videos/seed/trading-thumb-2.svg', '2026-06-23', 58, 'short', 132, 7, 1, 72.30, 7.65, 'gradualGrowth'),
  ('recent-processing-june-24', '00000000-0000-0000-0000-000000000001', 'Сделка дня: план, стоп и фиксация', 'channels/00000000-0000-0000-0000-000000000001/videos/seed/trading-thumb-3.svg', '2026-06-24', 96, 'video', 169, 8, 2, 54.10, 9.84, 'steady'),
  ('btc-report-mini-june-24', '00000000-0000-0000-0000-000000000001', 'Мини-разбор BTC перед отчетом', 'channels/00000000-0000-0000-0000-000000000001/videos/seed/trading-thumb-4.svg', '2026-06-24', 50, 'short', 88, 4, 1, 70.60, 4.10, 'gradualGrowth')
on conflict (id) do update
set title = excluded.title,
    cover_path = excluded.cover_path,
    published_at = excluded.published_at,
    duration_seconds = excluded.duration_seconds,
    content_type = excluded.content_type,
    views = excluded.views,
    likes = excluded.likes,
    dislikes = excluded.dislikes,
    average_view_percentage = excluded.average_view_percentage,
    revenue = excluded.revenue,
    analytics_profile = excluded.analytics_profile;

insert into public.dashboard_comments (
  id,
  channel_id,
  author,
  age_label,
  body,
  avatar_color,
  position
)
values
  ('comment-risk-plan', '00000000-0000-0000-0000-000000000001', '@risk.plan', '2 дня назад', 'Разбор по риску понятный, жду продолжение по входам.', '#245c5a', 0),
  ('comment-market-watch', '00000000-0000-0000-0000-000000000001', '@market.watch', '5 дней назад', 'Сетап отработал почти по плану, спасибо за уровни.', '#3b5f38', 1),
  ('comment-profit-log', '00000000-0000-0000-0000-000000000001', '@profit.log', '1 неделю назад', 'Формат с доходом за неделю заходит лучше всего.', '#625527', 2)
on conflict (id) do update
set author = excluded.author,
    age_label = excluded.age_label,
    body = excluded.body,
    avatar_color = excluded.avatar_color,
    position = excluded.position;

insert into public.recent_subscribers (
  id,
  channel_id,
  name,
  count_label,
  avatar_color,
  position
)
values
  ('sub-scalper', '00000000-0000-0000-0000-000000000001', 'Scalper KZ', '3,24 тыс. подписчиков', '#245c5a', 0),
  ('sub-crypto-desk', '00000000-0000-0000-0000-000000000001', 'Crypto Desk', '105 подписчиков', '#4a5f36', 1),
  ('sub-futures-room', '00000000-0000-0000-0000-000000000001', 'Futures Room', '23 подписчика', '#625527', 2)
on conflict (id) do update
set name = excluded.name,
    count_label = excluded.count_label,
    avatar_color = excluded.avatar_color,
    position = excluded.position;

delete from public.subscriber_daily_stats
where channel_id = '00000000-0000-0000-0000-000000000001'::uuid;

-- The canonical function owns both the rolling dates and their bounded shape.
-- It always ends on yesterday in Asia/Almaty and avoids stale hardcoded dates.
select private.refresh_subscriber_daily_stats(
  id,
  subscriber_count
)
from public.channels
where id = '00000000-0000-0000-0000-000000000001'::uuid;
