import { Link } from 'react-router-dom'
import { Sparkles, Terminal } from 'lucide-react'
import { HyperspeedBackground } from '@/components/Hyperspeed/HyperspeedBackground'

export function LandingPage() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-zinc-950 text-zinc-100">
      <HyperspeedBackground />
      <div
        className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_90%_60%_at_50%_20%,rgba(16,185,129,0.12),transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-zinc-950/85 via-zinc-950/55 to-zinc-950/90"
        aria-hidden
      />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <Link
          to="/"
          className="text-sm font-semibold tracking-tight text-zinc-100 transition hover:text-emerald-400"
        >
          Sathcode
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link
            to="/editor"
            className="hidden rounded-lg px-3 py-2 text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100 sm:inline-block"
          >
            Editor
          </Link>
          <Link
            to="/practice"
            className="hidden rounded-lg px-3 py-2 text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100 md:inline-block"
          >
            Practice
          </Link>
          <Link
            to="/signup"
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 font-medium text-zinc-100 transition hover:border-emerald-500/40 hover:bg-emerald-500/10"
          >
            Sign up
          </Link>
        </nav>
      </header>

      <main className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-6 pb-24 pt-16 text-center sm:pt-24">
        <div className="mb-8 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-medium text-emerald-400/95 ring-1 ring-white/5 backdrop-blur-sm">
          <Sparkles className="size-3.5 shrink-0" aria-hidden />
          Online editor · AI-assisted practice
        </div>

        <h1 className="text-balance text-4xl font-bold tracking-tight text-white sm:text-5xl sm:leading-[1.1]">
          Welcome to Sathcode
        </h1>

        <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-zinc-400 sm:text-xl">
          An online code editor with an{' '}
          <span className="font-medium text-zinc-300">AI assistant</span> — get
          hints, explanations, and guidance while you solve problems, just like
          in a real interview prep session.
        </p>

        <div className="mt-10 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/editor"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
          >
            <Terminal className="size-4" aria-hidden />
            Open editor
          </Link>
          <Link
            to="/signup"
            className="inline-flex items-center justify-center rounded-xl border border-white/18 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white transition hover:border-emerald-400/35 hover:bg-emerald-500/10"
          >
            Create account
          </Link>
        </div>

        <p className="mt-12 text-xs text-zinc-600">
          Structured practice · Multiple languages · Progress coming soon
        </p>
      </main>
    </div>
  )
}
