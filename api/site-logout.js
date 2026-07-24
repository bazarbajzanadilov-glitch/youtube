import { SITE_COOKIE_NAME } from '../server/siteSession.js'

export default function handler(request, response) {
  const secure = process.env.VERCEL_ENV !== 'development'
  response.setHeader(
    'Set-Cookie',
    [
      `${SITE_COOKIE_NAME}=`,
      'Path=/',
      'Max-Age=0',
      'HttpOnly',
      'SameSite=Lax',
      secure ? 'Secure' : '',
    ].filter(Boolean).join('; '),
  )
  response.setHeader('Location', '/api/site-login')
  return response.status(303).end()
}
