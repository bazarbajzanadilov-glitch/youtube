import { createServer as createHttpServer } from 'node:http'
import { createServer as createViteServer } from 'vite'
import adminLoginHandler from '../api/admin-login.js'
import adminSitePasswordHandler from '../api/admin-site-password.js'
import siteDataHandler from '../api/site-data.js'
import siteLoginHandler from '../api/site-login.js'
import siteLogoutHandler from '../api/site-logout.js'
import { isSiteRequestAuthorized } from '../server/siteSession.js'

async function readStdinEnvironment() {
  if (!process.argv.includes('--stdin-env')) return
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === 'string') process.env[key] = value
  }
}

function decorateResponse(response) {
  response.status = (statusCode) => {
    response.statusCode = statusCode
    return response
  }
  response.json = (value) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.end(JSON.stringify(value))
  }
  response.send = (value) => response.end(value)
  return response
}

async function readBody(request) {
  if (!['POST', 'PUT', 'PATCH'].includes(request.method || '')) return {}
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  const contentType = String(request.headers['content-type'] || '')
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }
  return Object.fromEntries(new URLSearchParams(raw))
}

await readStdinEnvironment()

const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: 'spa',
})

const server = createHttpServer(async (request, response) => {
  const url = new URL(request.url || '/', 'http://localhost')
  request.query = Object.fromEntries(url.searchParams)
  request.body = await readBody(request)
  decorateResponse(response)

  if (url.pathname === '/api/site-login') return siteLoginHandler(request, response)
  if (url.pathname === '/api/site-logout') return siteLogoutHandler(request, response)
  if (url.pathname === '/api/site-data') return siteDataHandler(request, response)
  if (url.pathname === '/api/admin-login') return adminLoginHandler(request, response)
  if (url.pathname === '/api/admin-site-password') return adminSitePasswordHandler(request, response)

  if (!isSiteRequestAuthorized(request)) {
    response.statusCode = 307
    response.setHeader(
      'Location',
      `/api/site-login?returnTo=${encodeURIComponent(`${url.pathname}${url.search}${url.hash}`)}`,
    )
    response.end()
    return
  }

  vite.middlewares(request, response, (error) => {
    if (error) {
      response.statusCode = 500
      response.end('Development server error')
    }
  })
})

const port = Number(process.env.PORT) || 5173
server.listen(port, '127.0.0.1', () => {
  console.log(`Secure local server: http://localhost:${port}`)
})
