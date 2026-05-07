import { Link } from 'react-router-dom'
import type { SampleProblem } from '@/data/sampleProblem'

type PracticeHeaderProps = {
  problem: Pick<SampleProblem, 'title' | 'difficulty' | 'id'>
}

const difficultyStyles: Record<SampleProblem['difficulty'], string> = {
  Easy: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30',
  Medium: 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30',
  Hard: 'bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/30',
}

export function PracticeHeader({ problem }: PracticeHeaderProps) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          to="/"
          className="shrink-0 text-sm font-semibold tracking-tight text-zinc-100 transition hover:text-emerald-400"
        >
          Sathcode
        </Link>
        <span className="hidden h-4 w-px bg-zinc-700 sm:block" aria-hidden />
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-zinc-200">
            {problem.title}
          </span>
          <span
            className={`shrink-0 rounded-md px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide ${difficultyStyles[problem.difficulty]}`}
          >
            {problem.difficulty}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="hidden text-xs text-zinc-500 md:inline">
          AI hints — soon
        </span>
        <button
          type="button"
          disabled
          className="rounded-lg bg-emerald-600/90 px-3 py-1.5 text-xs font-semibold text-zinc-950 opacity-50 shadow-sm"
        >
          Run
        </button>
        <button
          type="button"
          disabled
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-400 opacity-60"
        >
          Submit
        </button>
      </div>
    </header>
  )
}
