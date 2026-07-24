import { next } from '@vercel/functions'
import {
  isSiteRequestAuthorized,
} from './server/siteSession.js'

export const config = {
  matcher: '/((?!api/site-login|api/site-logout).*)',
  runtime: 'nodejs',
}

export default function middleware(request) {
  if (isSiteRequestAuthorized(request)) return next()

  const url = new URL(request.url)
  const loginUrl = new URL('/api/site-login', url)
  loginUrl.searchParams.set('returnTo', `${url.pathname}${url.search}`)
  return Response.redirect(loginUrl, 307)
}
