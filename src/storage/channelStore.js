const DEFAULT_DASHBOARD_COMMENTS = [
  {
    id: 'comment-risk-plan',
    author: '@risk.plan',
    age: '2 дня назад',
    text: 'Разбор по риску понятный, жду продолжение по входам.',
    avatarColor: '#245c5a',
  },
  {
    id: 'comment-market-watch',
    author: '@market.watch',
    age: '5 дней назад',
    text: 'Сетап отработал почти по плану, спасибо за уровни.',
    avatarColor: '#3b5f38',
  },
  {
    id: 'comment-profit-log',
    author: '@profit.log',
    age: '1 неделю назад',
    text: 'Формат с доходом за неделю заходит лучше всего.',
    avatarColor: '#625527',
  },
]

const DEFAULT_RECENT_SUBSCRIBERS = [
  { id: 'sub-scalper', name: 'Scalper KZ', count: '3,24 тыс. подписчиков', avatarColor: '#245c5a' },
  { id: 'sub-crypto-desk', name: 'Crypto Desk', count: '105 подписчиков', avatarColor: '#4a5f36' },
  { id: 'sub-futures-room', name: 'Futures Room', count: '23 подписчика', avatarColor: '#625527' },
]

export const CHANNEL_DEFAULTS = {
  channelName: 'TRADING INSIDER',
  country: 'KZ',
  subscriberCount: 79,
  monetizationEnabled: true,
  joinDate: '2022-01-15',
  avatar: null,
  avatarPath: null,
  dashboardComments: DEFAULT_DASHBOARD_COMMENTS,
  recentSubscribers: DEFAULT_RECENT_SUBSCRIBERS,
  subscriberDailyStats: [],
}
