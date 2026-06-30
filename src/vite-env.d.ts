/// <reference types="vite/client" />

import type { Api } from '../electron/preload'

declare global {
  interface Window {
    /** Set by Electron preload in the desktop app; created at runtime in web mode. */
    api: Api
  }
}
