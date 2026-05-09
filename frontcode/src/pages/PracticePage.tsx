import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { EditorAssistChat } from '@/components/editor/EditorAssistChat'
import { CodeWorkspace } from '@/components/practice/CodeWorkspace'
import { PracticeHeader } from '@/components/practice/PracticeHeader'
import { ProblemPanel } from '@/components/practice/ProblemPanel'
import type { PracticeProblem } from '@/data/sampleProblem'
import {
  fetchLeetCodeProblem,
  fetchLeetCodeQuestionList,
  type LeetCodeListItem,
} from '@/services/api'

const PAGE_LIMIT = 60

const difficultyBadge: Record<
  string,
  { label: string; className: string }
> = {
  Easy: {
    label: 'E',
    className:
      'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/35',
  },
  Medium: {
    label: 'M',
    className:
      'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/35',
  },
  Hard: {
    label: 'H',
    className:
      'bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/35',
  },
}

function ProblemPanelSlot(props: {
  problem: PracticeProblem | null
  loading: boolean
  error: string | null
  hasSlug: boolean
  className?: string
}) {
  const { problem, loading, error, hasSlug, className = '' } = props

  if (!hasSlug) {
    return (
      <aside
        className={`flex flex-shrink-0 flex-col items-center justify-center border-zinc-800 bg-zinc-900/70 px-4 py-12 text-center text-sm text-zinc-500 md:w-full md:max-w-md md:border-r lg:max-w-lg ${className}`}
      >
        <p>Select a question from the list to load the statement and starter
          code.</p>
        <p className="mt-2 text-xs text-zinc-600">
          Data proxied via this app&apos;s backend (LeetCode GraphQL).
        </p>
      </aside>
    )
  }

  if (loading || !problem) {
    return (
      <aside
        className={`flex flex-shrink-0 flex-col items-center justify-center border-zinc-800 bg-zinc-900/70 py-16 text-zinc-500 md:w-full md:max-w-md md:border-r lg:max-w-lg ${className}`}
      >
        <Loader2 className="size-8 animate-spin text-emerald-500/80" />
        <p className="mt-4 text-xs">Fetching problem…</p>
      </aside>
    )
  }

  if (error) {
    return (
      <aside
        className={`flex flex-shrink-0 flex-col gap-2 border-zinc-800 bg-zinc-900/70 px-4 py-8 text-sm text-red-400 md:w-full md:max-w-md md:border-r lg:max-w-lg ${className}`}
      >
        {error}
      </aside>
    )
  }

  return (
    <ProblemPanel
      problem={problem}
      className={`flex-shrink-0 md:w-full md:max-w-md md:border-r lg:max-w-lg ${className}`}
    />
  )
}

/** Browse + workspace (CodingPrep `/api/leetcode`). */
export function PracticePage() {
  const { slug } = useParams<{ slug?: string }>()
  const [searchParams] = useSearchParams()
  const preferLang =
    typeof searchParams.get('lang') === 'string'
      ? (searchParams.get('lang') as string)
      : undefined

  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [questions, setQuestions] = useState<LeetCodeListItem[]>([])
  const [totalProblems, setTotalProblems] = useState(0)
  const [listSkip, setListSkip] = useState(0)
  const [listLoadingMore, setListLoadingMore] = useState(false)
  const [filter, setFilter] = useState('')

  const [problem, setProblem] = useState<PracticeProblem | null>(null)
  const [problemLoading, setProblemLoading] = useState(false)
  const [problemError, setProblemError] = useState<string | null>(null)
  const [assistOpen, setAssistOpen] = useState(false)
  const [workspaceCode, setWorkspaceCode] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setListLoading(true)
      setListError(null)
      try {
        const res = await fetchLeetCodeQuestionList({
          skip: 0,
          limit: PAGE_LIMIT,
        })
        if (cancelled) return
        setQuestions(res.questions)
        setTotalProblems(res.total)
        setListSkip(res.skip + res.questions.length)
      } catch (e) {
        if (!cancelled) {
          setListError(e instanceof Error ? e.message : String(e))
        }
      } finally {
        if (!cancelled) setListLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const loadMoreQuestions = useCallback(async () => {
    if (
      listLoading ||
      listLoadingMore ||
      questions.length >= totalProblems ||
      totalProblems === 0
    )
      return
    setListLoadingMore(true)
    try {
      const res = await fetchLeetCodeQuestionList({
        skip: listSkip,
        limit: PAGE_LIMIT,
      })
      setQuestions((prev) => [...prev, ...res.questions])
      setListSkip((s) => s + res.questions.length)
      setTotalProblems(res.total)
    } finally {
      setListLoadingMore(false)
    }
  }, [
    listLoading,
    listLoadingMore,
    listSkip,
    questions.length,
    totalProblems,
  ])

  useEffect(() => {
    let cancelled = false
    if (!slug) {
      setProblem(null)
      setProblemLoading(false)
      setProblemError(null)
      return () => {
        cancelled = true
      }
    }

    ;(async () => {
      setProblemLoading(true)
      setProblemError(null)
      try {
        const { problem: loaded } = await fetchLeetCodeProblem(slug, {
          editorLang: preferLang,
        })
        if (!cancelled) setProblem(loaded)
      } catch (e) {
        if (!cancelled) {
          setProblemError(e instanceof Error ? e.message : String(e))
        }
      } finally {
        if (!cancelled) setProblemLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug, preferLang])

  const filteredRows = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return questions
    return questions.filter((row) =>
      row.titleSlug.toLowerCase().includes(q) ||
      row.title.toLowerCase().includes(q),
    )
  }, [filter, questions])

  const workspaceLang = problem?.editorLang ?? 'javascript'
  const starter =
    problem?.starterCode ??
    '// Pick a question from the left to load starter code.'

  useEffect(() => {
    setWorkspaceCode(starter)
  }, [starter])

  const headerProblem = problem && slug
    ? {
        id: problem.titleSlug ?? problem.id,
        title: problem.title,
        difficulty: problem.difficulty,
      }
    : null

  const hasSlug = Boolean(slug)

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <PracticeHeader
        problem={headerProblem}
        assistOpen={assistOpen}
        onAssistToggle={() => setAssistOpen((o) => !o)}
      />

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Sidebar: problem bank */}
        <aside className="flex max-h-48 shrink-0 flex-col border-b border-zinc-800 bg-zinc-950 md:max-h-none md:h-auto md:w-[min(100%,17rem)] md:border-b-0 md:border-r lg:w-72">
          <div className="shrink-0 border-b border-zinc-800 px-3 py-2">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-zinc-500">
              Problems
            </p>
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by title…"
              className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-600/40"
            />
            <p className="mt-1 text-[0.65rem] text-zinc-600">
              {listLoading ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="size-3 animate-spin" aria-hidden />
                  Loading…
                </span>
              ) : (
                <>
                  {questions.length}
                  {totalProblems ? ` / ${totalProblems}` : ''} from LeetCode
                </>
              )}
            </p>
            {listError ? (
              <p className="mt-2 text-[0.7rem] text-red-400/90">{listError}</p>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <ul className="divide-y divide-zinc-800/80">
              {filteredRows.map((row) => {
                const slugPath = `/practice/${encodeURIComponent(row.titleSlug)}`
                const active = slug === row.titleSlug
                const bd =
                  difficultyBadge[row.difficulty] ?? difficultyBadge.Medium
                return (
                  <li key={row.titleSlug}>
                    <Link
                      to={slugPath}
                      className={`flex items-start gap-2 px-3 py-2 text-left transition ${
                        active
                          ? 'bg-emerald-500/14 text-zinc-100'
                          : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded text-[0.65rem] font-bold uppercase ${bd.className}`}
                        title={row.difficulty}
                      >
                        {bd.label}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-[0.8125rem] leading-snug">
                          {row.frontendId ? `${row.frontendId}. ` : ''}
                          {row.title}
                        </span>
                        <span className="mt-0.5 block truncate font-mono text-[0.65rem] text-zinc-600">
                          {row.titleSlug}
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>

          {!listLoading && questions.length < totalProblems ? (
            <div className="shrink-0 border-t border-zinc-800 p-2">
              <button
                type="button"
                disabled={listLoadingMore}
                onClick={() => void loadMoreQuestions()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:opacity-60"
              >
                {listLoadingMore ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : null}
                Load more
              </button>
            </div>
          ) : null}
        </aside>

        {/* Main workspace */}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex-row">
          <ProblemPanelSlot
            problem={problem}
            loading={problemLoading}
            error={problemError}
            hasSlug={hasSlug}
            className="hidden min-h-0 border-zinc-800 lg:flex lg:max-w-[min(100%,36rem)]"
          />

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="shrink-0 lg:hidden">
              <details className="group border-b border-zinc-800 bg-zinc-900/80">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-zinc-200 marker:content-none [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between">
                    Problem statement
                    <span className="text-xs font-normal text-zinc-500 group-open:hidden">
                      Tap to expand
                    </span>
                  </span>
                </summary>
                <div className="max-h-[40vh] overflow-y-auto border-t border-zinc-800">
                  <ProblemPanelSlot
                    problem={problem}
                    loading={problemLoading}
                    error={problemError}
                    hasSlug={hasSlug}
                    className="border-0"
                  />
                </div>
              </details>
            </div>
            <CodeWorkspace
              initialCode={starter}
              code={workspaceCode}
              onCodeChange={setWorkspaceCode}
              language={workspaceLang}
              className="h-full min-h-0 flex-1"
            />
          </div>

          {assistOpen ? (
            <>
              <button
                type="button"
                className="absolute inset-0 z-30 bg-black/55 md:hidden"
                onClick={() => setAssistOpen(false)}
                aria-label="Dismiss assistance"
              />
              <div className="absolute inset-y-0 right-0 z-40 flex h-full min-h-0 w-full max-w-md flex-col border-l border-zinc-800 md:static md:z-0 md:h-full md:w-[min(28rem,42vw)] md:max-w-none">
                <EditorAssistChat
                  code={workspaceCode}
                  languageId={workspaceLang}
                  onClose={() => setAssistOpen(false)}
                  className="min-h-0 flex-1 bg-zinc-950"
                />
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
