/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string
  readonly VITE_GROQ_API_KEY: string
  readonly VITE_GOOGLE_CLIENT_ID: string
  readonly VITE_API_URL: string
}

declare global {
  namespace ImportMeta {
    interface Env extends ImportMetaEnv {}
  }
}
