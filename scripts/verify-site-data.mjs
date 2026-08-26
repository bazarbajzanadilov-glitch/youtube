import assert from 'node:assert/strict'

import { siteDataErrorDetails } from '../api/site-data.js'

const missingPostgrestTable = Object.assign(
  new Error("video_daily_stats: Could not find the table 'public.video_daily_stats' in the schema cache"),
  { code: 'PGRST205' },
)
assert.deepEqual(siteDataErrorDetails(missingPostgrestTable), {
  status: 503,
  message: 'Схема аналитики не готова: отсутствует таблица video_daily_stats. Примените миграции Supabase.',
})

const missingPostgresRelation = Object.assign(
  new Error('video_daily_stats: relation "public.video_daily_stats" does not exist'),
  { code: '42P01' },
)
assert.equal(siteDataErrorDetails(missingPostgresRelation).status, 503)

const otherMissingRelation = Object.assign(
  new Error("subscriber_daily_stats: Could not find the table 'public.subscriber_daily_stats' in the schema cache"),
  { code: 'PGRST205' },
)
assert.deepEqual(siteDataErrorDetails(otherMissingRelation), {
  status: 500,
  message: 'Не удалось загрузить данные сайта',
})

assert.deepEqual(siteDataErrorDetails(new Error('network failure')), {
  status: 500,
  message: 'Не удалось загрузить данные сайта',
})

console.log('site data verification passed')
