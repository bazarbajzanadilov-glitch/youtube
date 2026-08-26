import { next } from '@vercel/functions'
import {
  isSiteRequestAuthorized,
} from './server/siteSession.js'

export const config = {
  matcher: '/((?!api/site-login|api/site-logout).*)',
  runtime: 'nodejs',
}

export default function middleware(request) {
  const url = new URL(request.url)
  // Админка имеет отдельную авторизацию Supabase. Hash-маршрут #/admin
  // сервер не видит, поэтому используем явный /admin как точку входа.
  if (url.pathname === '/admin' || isSiteRequestAuthorized(request)) return next()

  const loginUrl = new URL('/api/site-login', url)
  loginUrl.searchParams.set('returnTo', `${url.pathname}${url.search}`)
  return Response.redirect(loginUrl, 307)
}
