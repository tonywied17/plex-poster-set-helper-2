import { shell } from 'electron'
import type { BrowserWindow } from 'electron'
import { ConfigService } from './config'
import { Logger } from './logger'
import type { PlexAuthStatus } from '../ipc/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const PLEX_TV = 'https://plex.tv'
const POLL_INTERVAL_MS = 2000
const POLL_MAX_ATTEMPTS = 150 // 5 minutes

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clientHeaders(clientId: string): Record<string, string> {
  return {
    'X-Plex-Product': 'Plex Poster Set Helper',
    'X-Plex-Client-Identifier': clientId,
    'X-Plex-Device': 'Desktop',
    'X-Plex-Device-Name': 'Plex Poster Set Helper',
    'X-Plex-Version': '2.0.0',
    'Accept': 'application/json',
  }
}

// ─── Module state ─────────────────────────────────────────────────────────────

let _pollTimer: ReturnType<typeof setInterval> | null = null

function stopPoll() {
  if (_pollTimer) {
    clearInterval(_pollTimer)
    _pollTimer = null
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const PlexAuthService = {
  // ── Sign in via PIN flow ─────────────────────────────────────────────────────
  async signIn(
    _win: BrowserWindow,
    onStatus: (status: PlexAuthStatus) => void,
  ): Promise<string> {
    stopPoll()
    const clientId = ConfigService.get().clientIdentifier
    const hdrs = clientHeaders(clientId)

    onStatus({ status: 'waiting' })

    // Step 1: Request a PIN from plex.tv
    const pinRes = await fetch(`${PLEX_TV}/api/v2/pins`, {
      method: 'POST',
      headers: { ...hdrs, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'strong=true',
    })
    if (!pinRes.ok) throw new Error(`PIN request failed: ${pinRes.status}`)
    const pin = await pinRes.json() as { id: number; code: string }

    Logger.info('PlexAuth', `PIN flow started — code: ${pin.code}`)
    onStatus({ status: 'waiting', pin: pin.code })

    // Step 2: Open the Plex auth page in the user's browser
    const authUrl =
      `https://app.plex.tv/auth#?` +
      `clientID=${encodeURIComponent(clientId)}` +
      `&code=${encodeURIComponent(pin.code)}` +
      `&context[device][product]=${encodeURIComponent('Plex Poster Set Helper')}`
    await shell.openExternal(authUrl)

    // Step 3: Poll plex.tv every 2s until the user authorises (or timeout)
    return new Promise<string>((resolve, reject) => {
      let attempts = 0

      _pollTimer = setInterval(async () => {
        attempts++
        if (attempts >= POLL_MAX_ATTEMPTS) {
          stopPoll()
          Logger.warn('PlexAuth', 'Auth timed out after 5 minutes')
          onStatus({ status: 'timeout' })
          reject(new Error('Plex auth timed out (5 minutes)'))
          return
        }

        try {
          const checkRes = await fetch(`${PLEX_TV}/api/v2/pins/${pin.id}`, { headers: hdrs })
          if (!checkRes.ok) return
          const data = await checkRes.json() as { authToken?: string }
          if (data.authToken) {
            stopPoll()
            await PlexAuthService._finalise(data.authToken, clientId, hdrs, onStatus)
            resolve(data.authToken)
          }
        } catch {
          // transient network error — keep polling
        }
      }, POLL_INTERVAL_MS)
    })
  },

  // ── Finalise auth: save token + fetch account info ───────────────────────────
  async _finalise(
    token: string,
    clientId: string,
    hdrs: Record<string, string>,
    onStatus: (status: PlexAuthStatus) => void,
  ) {
    try {
      const userRes = await fetch(`${PLEX_TV}/api/v2/user`, {
        headers: { ...hdrs, 'X-Plex-Token': token },
      })
      if (userRes.ok) {
        const user = await userRes.json() as {
          username?: string; friendlyName?: string; email?: string; thumb?: string
        }
        ConfigService.set({
          token,
          plexAccountName:  user.username ?? user.friendlyName ?? '',
          plexAccountEmail: user.email ?? '',
          plexAccountThumb: user.thumb ?? '',
        })
        Logger.success('PlexAuth', `Authenticated as ${user.username ?? user.friendlyName ?? 'unknown'}`)
      } else {
        ConfigService.set({ token })
        Logger.success('PlexAuth', 'Authenticated (user info unavailable)')
      }
    } catch {
      ConfigService.set({ token })
      Logger.success('PlexAuth', 'Authenticated (user info fetch failed)')
    }
    onStatus({ status: 'authorized', token })
    void clientId // suppress unused warning
  },

  // ── Cancel an in-progress sign-in ────────────────────────────────────────────
  cancel() {
    stopPoll()
    Logger.info('PlexAuth', 'Auth flow cancelled by user')
  },

  // ── Disconnect ────────────────────────────────────────────────────────────────
  async disconnect() {
    stopPoll()
    ConfigService.set({
      token: '',
      plexAccountName: '',
      plexAccountEmail: '',
      plexAccountThumb: '',
    })
    Logger.info('PlexAuth', 'Disconnected from Plex')
  },

  // ── Current status (sync, from config) ───────────────────────────────────────
  getStatus(): PlexAuthStatus {
    const cfg = ConfigService.get()
    return cfg.token ? { status: 'authorized' } : { status: 'idle' }
  },
}
