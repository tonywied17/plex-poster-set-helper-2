import { randomUUID } from 'crypto'

const sessions = new Set<string>()
const COOKIE_NAME = 'ppsh_session'

export function createSession(): string {
  const id = randomUUID()
  sessions.add(id)
  return id
}

export function destroySession(id: string): void {
  sessions.delete(id)
}

export function isValidSession(id: string | undefined): boolean {
  return !!id && sessions.has(id)
}

export function parseSessionCookie(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === COOKIE_NAME) return rest.join('=')
  }
  return undefined
}

export function sessionCookieHeader(sessionId: string, maxAgeSec = 60 * 60 * 24 * 365): string {
  return `${COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}`
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}

export { COOKIE_NAME }
