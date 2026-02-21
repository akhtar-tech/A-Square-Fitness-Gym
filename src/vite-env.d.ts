/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_DEFAULT_FEES_PATH?: string
  readonly VITE_DEFAULT_ENTRY_PATH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
