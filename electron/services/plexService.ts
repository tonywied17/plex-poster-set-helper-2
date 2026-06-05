import Fuse from 'fuse.js'
import { Logger } from './logger'
import { ConfigService } from './config'
import type {
  ConnectReq, ConnectRes, Library,
  FindItemReq, PlexItem, UploadReq, UploadRes,
  LabelReq, ResetReq,
} from '../ipc/types'

// ─── Internal state ───────────────────────────────────────────────────────────

interface PlexConnection {
  baseUrl: string
  token: string
  serverName: string
  libraries: Library[]
}

let _conn: PlexConnection | null = null

// ─── Helpers ──────────────────────────────────────────────────────────────────

function plexHeaders(token: string): Record<string, string> {
  return {
    'X-Plex-Token': token,
    'X-Plex-Client-Identifier': ConfigService.get().clientIdentifier,
    'X-Plex-Product': 'Plex Poster Set Helper',
    'Accept': 'application/json',
  }
}

async function plexFetch(
  baseUrl: string,
  token: string,
  path: string,
  options?: RequestInit,
): Promise<unknown> {
  const url = `${baseUrl.replace(/\/$/, '')}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      ...plexHeaders(token),
      ...(options?.headers as Record<string, string> ?? {}),
    },
  })
  if (!res.ok) throw new Error(`Plex ${res.status} ${res.statusText} — ${path}`)
  const text = await res.text()
  if (!text.trim()) return {}
  try { return JSON.parse(text) } catch { return text }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMetadata(m: any, libraryTitle: string, libraryType: 'movie' | 'show'): PlexItem {
  return {
    key: m.ratingKey as string,
    title: m.title as string,
    year: m.year as number | undefined,
    type: libraryType === 'movie' ? 'movie' : 'show',
    libraryTitle,
    thumb: m.thumb as string | undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    labels: ((m.Label ?? []) as any[]).map(l => l.tag as string),
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const PlexService = {
  getConnection: () => _conn,

  // ── Connect ─────────────────────────────────────────────────────────────────
  async connect(req: ConnectReq): Promise<ConnectRes> {
    try {
      const data = await plexFetch(req.baseUrl, req.token, '/') as { MediaContainer?: { friendlyName?: string } }
      const serverName = data?.MediaContainer?.friendlyName ?? 'Plex Server'
      const libraries = await PlexService.fetchLibraries(req.baseUrl, req.token)
      _conn = { baseUrl: req.baseUrl, token: req.token, serverName, libraries }
      Logger.success('Plex', `Connected to "${serverName}" — ${libraries.length} libraries`)
      return { success: true, serverName, libraryCount: libraries.length }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      Logger.error('Plex', `Connection failed: ${error}`)
      _conn = null
      return { success: false, error }
    }
  },

  // ── Libraries ────────────────────────────────────────────────────────────────
  async fetchLibraries(baseUrl: string, token: string): Promise<Library[]> {
    const data = await plexFetch(baseUrl, token, '/library/sections') as {
      MediaContainer?: { Directory?: Array<{ key: string; title: string; type: string }> }
    }
    return (data?.MediaContainer?.Directory ?? [])
      .filter(d => d.type === 'movie' || d.type === 'show')
      .map(d => ({ key: d.key, title: d.title, type: d.type as 'movie' | 'show' }))
  },

  // ── Find item (fuzzy) ────────────────────────────────────────────────────────
  async findInLibrary(req: FindItemReq): Promise<PlexItem | null> {
    if (!_conn) return null
    const { baseUrl, token, libraries: allLibs } = _conn
    const { title, year, libraries: filterNames } = req

    const candidates: PlexItem[] = []
    for (const lib of allLibs) {
      if (filterNames.length && !filterNames.includes(lib.title)) continue
      const type = lib.type === 'movie' ? 1 : 2
      try {
        const data = await plexFetch(
          baseUrl, token,
          `/library/sections/${lib.key}/search?query=${encodeURIComponent(title)}&type=${type}&limit=20`,
        ) as { MediaContainer?: { Metadata?: unknown[] } }
        for (const m of data?.MediaContainer?.Metadata ?? []) {
          candidates.push(mapMetadata(m, lib.title, lib.type as 'movie' | 'show'))
        }
      } catch {
        // section may not support the search type — skip silently
      }
    }
    if (!candidates.length) return null

    // Exact match first
    const exact = candidates.find(
      i => i.title.toLowerCase() === title.toLowerCase() && (!year || i.year === year),
    )
    if (exact) return exact

    // Fuzzy fallback
    const fuse = new Fuse(candidates, { keys: ['title'], threshold: 0.35 })
    return fuse.search(title)[0]?.item ?? null
  },

  // ── Labeled items ────────────────────────────────────────────────────────────
  async getLabeledItems(req: LabelReq): Promise<PlexItem[]> {
    if (!_conn) return []
    const { baseUrl, token, libraries: allLibs } = _conn
    const items: PlexItem[] = []

    for (const lib of allLibs) {
      const type = lib.type === 'movie' ? 1 : 2
      try {
        const data = await plexFetch(
          baseUrl, token,
          `/library/sections/${lib.key}/all?type=${type}&label.tag.tag=${encodeURIComponent(req.label)}`,
        ) as { MediaContainer?: { Metadata?: unknown[] } }
        for (const m of data?.MediaContainer?.Metadata ?? []) {
          items.push(mapMetadata(m, lib.title, lib.type as 'movie' | 'show'))
        }
      } catch {
        // label filter unsupported on this section version — skip
      }
    }
    return items
  },

  // ── Upload poster ────────────────────────────────────────────────────────────
  async uploadPoster(req: UploadReq): Promise<UploadRes> {
    if (!_conn) return { success: false, error: 'Not connected to Plex' }
    const { baseUrl, token } = _conn
    const { itemKey, imageUrl, source } = req
    const labelTag = source === 'mediux' ? 'MediUX' : 'ThePosterDB'

    try {
      // Download image from source URL
      const imgRes = await fetch(imageUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      })
      if (!imgRes.ok) throw new Error(`Image download failed: ${imgRes.status}`)
      const imgBuf = Buffer.from(await imgRes.arrayBuffer())
      const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg'

      // Upload binary to Plex
      await plexFetch(baseUrl, token, `/library/metadata/${itemKey}/posters`, {
        method: 'POST',
        headers: { 'Content-Type': contentType },
        body: imgBuf,
      })

      // Tag item with source label
      await plexFetch(
        baseUrl, token,
        `/library/metadata/${itemKey}?label[].tag.tag=${encodeURIComponent(labelTag)}&label.locked=1`,
        { method: 'PUT' },
      )

      Logger.success('Plex', `Poster uploaded — key ${itemKey} [${source}]`)
      return { success: true }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      Logger.error('Plex', `Upload failed — key ${itemKey}: ${error}`)
      return { success: false, error }
    }
  },

  // ── Reset poster ─────────────────────────────────────────────────────────────
  async resetPoster(req: ResetReq): Promise<void> {
    if (!_conn) throw new Error('Not connected to Plex')
    const { baseUrl, token } = _conn
    const { itemKey, hierarchical } = req

    // Get available posters and select the original provider poster
    const postersData = await plexFetch(baseUrl, token, `/library/metadata/${itemKey}/posters`) as {
      MediaContainer?: { Metadata?: Array<{ ratingKey?: string; thumb?: string; selected?: boolean; provider?: string }> }
    }
    const posters = postersData?.MediaContainer?.Metadata ?? []

    // Find any poster that isn't from the custom upload provider
    const original = posters.find(p => {
      const src = p.provider ?? ''
      return src !== 'custom' && src !== ''
    }) ?? posters.find(p => !p.selected)

    if (original) {
      const posterKey = original.ratingKey ?? original.thumb ?? ''
      if (posterKey) {
        await plexFetch(
          baseUrl, token,
          `/library/metadata/${itemKey}/poster?url=${encodeURIComponent(posterKey)}`,
          { method: 'PUT' },
        )
      }
    }

    // Remove source labels
    for (const label of ['MediUX', 'ThePosterDB']) {
      try {
        await plexFetch(
          baseUrl, token,
          `/library/metadata/${itemKey}?label[].tag.tag=${encodeURIComponent(label)}&label[].tag.locked=0`,
          { method: 'PUT' },
        )
      } catch {
        // label may not exist on this item
      }
    }

    // Recurse into children (seasons → episodes) when hierarchical
    if (hierarchical) {
      try {
        const childData = await plexFetch(baseUrl, token, `/library/metadata/${itemKey}/children`) as {
          MediaContainer?: { Metadata?: Array<{ ratingKey: string }> }
        }
        for (const child of childData?.MediaContainer?.Metadata ?? []) {
          await PlexService.resetPoster({ itemKey: child.ratingKey, hierarchical: true })
        }
      } catch {
        // no children or server error — skip
      }
    }

    Logger.info('Plex', `Poster reset — key ${itemKey}`)
  },

  // ── Stats ────────────────────────────────────────────────────────────────────
  async getStats(): Promise<Record<string, number>> {
    const [mediuxItems, posterdbItems] = await Promise.all([
      PlexService.getLabeledItems({ label: 'MediUX' }),
      PlexService.getLabeledItems({ label: 'ThePosterDB' }),
    ])
    const all = [...mediuxItems, ...posterdbItems]
    return {
      mediux:   mediuxItems.length,
      posterdb: posterdbItems.length,
      total:    all.length,
      movies:   all.filter(i => i.type === 'movie').length,
      shows:    all.filter(i => i.type === 'show').length,
    }
  },

  // ── Auto-reconnect from saved config ─────────────────────────────────────────
  async tryRestoreFromConfig(): Promise<boolean> {
    const cfg = ConfigService.get()
    if (!cfg.baseUrl || !cfg.token) return false
    const result = await PlexService.connect({ baseUrl: cfg.baseUrl, token: cfg.token })
    return result.success
  },
}
