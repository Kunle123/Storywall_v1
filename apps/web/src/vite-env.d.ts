/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Absolute API origin (no trailing slash), e.g. http://127.0.0.1:3001. If unset, use Vite proxy `/api`. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
