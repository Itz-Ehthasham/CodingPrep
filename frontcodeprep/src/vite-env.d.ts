/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '@/components/Hyperspeed/Hyperspeed.jsx' {
  import type { FC } from 'react'
  const Hyperspeed: FC<{ effectOptions?: Record<string, unknown> }>
  export default Hyperspeed
}

declare module '@/components/Hyperspeed/HyperSpeedPresets.js' {
  export const hyperspeedPresets: Record<string, Record<string, unknown>>
}
