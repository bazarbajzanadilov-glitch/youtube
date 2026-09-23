import { spawnSync } from 'node:child_process'

const url = process.env.VITE_SUPABASE_URL || ''
const password = process.env.SUPABASE_DB_PASSWORD
const host = process.env.SUPABASE_DB_POOLER_HOST
const ref = /^https:\/\/([a-z0-9]+)\.supabase\.co/.exec(url)?.[1]

if (!ref || !password || !host) {
  console.error('Нужны VITE_SUPABASE_URL, SUPABASE_DB_PASSWORD и SUPABASE_DB_POOLER_HOST в .env.local')
  process.exit(1)
}

// Прямой хост db.<ref>.supabase.co доступен только по IPv6, поэтому идём через пулер.
const dbUrl = `postgresql://postgres.${ref}:${encodeURIComponent(password)}@${host}:5432/postgres`
const command = process.argv[2] === 'list' ? ['migration', 'list'] : ['db', 'push', '--yes']
const result = spawnSync('npx', ['supabase', ...command, '--db-url', dbUrl], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
process.exit(result.status ?? 1)
