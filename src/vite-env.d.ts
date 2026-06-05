/// <reference types="vite/client" />

import type { Api } from '../electron/preload'

declare global {
  interface Window {
    api: Api
  }
}
