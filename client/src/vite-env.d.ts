/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Kept AI API. Defaults to /api (proxied to the server in dev). */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
