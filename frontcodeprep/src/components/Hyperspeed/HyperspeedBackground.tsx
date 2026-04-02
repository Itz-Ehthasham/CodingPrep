import Hyperspeed from '@/components/Hyperspeed/Hyperspeed.jsx'
import { hyperspeedPresets } from '@/components/Hyperspeed/HyperSpeedPresets.js'

/** Full-viewport Hyperspeed layer (Cyberpunk-style preset one). */
export function HyperspeedBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 min-h-dvh w-full [&_#lights]:min-h-dvh"
      aria-hidden
    >
      <Hyperspeed effectOptions={hyperspeedPresets.one} />
    </div>
  )
}
