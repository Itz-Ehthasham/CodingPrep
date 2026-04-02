import { type FormEvent, useState } from 'react'
import { GlitchBackground } from '@/components/GlitchBackground'

const outlineButtonClassName =
  'w-full rounded-xl border border-white/18 bg-white/5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:border-emerald-400/35 hover:bg-emerald-500/10 hover:text-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400/60'

export function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    // Wire to API when auth routes exist
  }

  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-[#121f1a] text-zinc-100">
      <GlitchBackground />

      <div className="relative z-10 flex min-h-dvh items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-[400px] rounded-2xl border border-white/15 bg-white/10 p-8 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.65)] backdrop-blur-xl">
          <div className="mb-8 text-center">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-400/90">
              CodingPrep
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              Create account
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Start your AI-guided interview prep.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label
                htmlFor="signup-email"
                className="block text-xs font-medium text-zinc-400"
              >
                Email
              </label>
              <input
                id="signup-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-zinc-950/50 px-3.5 py-2.5 text-sm text-white outline-none ring-emerald-400/0 transition-[box-shadow,border-color] placeholder:text-zinc-600 focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/25"
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="signup-password"
                className="block text-xs font-medium text-zinc-400"
              >
                Password
              </label>
              <input
                id="signup-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-zinc-950/50 px-3.5 py-2.5 text-sm text-white outline-none ring-emerald-400/0 transition-[box-shadow,border-color] placeholder:text-zinc-600 focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/25"
                placeholder="••••••••"
              />
            </div>

            <button type="submit" className={outlineButtonClassName}>
              Create Account
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-zinc-500">
            Already have an account?{' '}
            <span className="font-medium text-zinc-300">Sign in</span>
            {/* Replace span with <Link> when routing exists */}
          </p>
        </div>
      </div>
    </div>
  )
}
