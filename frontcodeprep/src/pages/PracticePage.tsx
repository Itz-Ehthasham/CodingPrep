import { CodeWorkspace } from '@/components/practice/CodeWorkspace'
import { PracticeHeader } from '@/components/practice/PracticeHeader'
import { ProblemPanel } from '@/components/practice/ProblemPanel'
import { SAMPLE_PROBLEM } from '@/data/sampleProblem'

/** Full-screen problem + editor workspace (LeetCode-style). */
export function PracticePage() {
  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <PracticeHeader problem={SAMPLE_PROBLEM} />
      <div className="flex min-h-0 flex-1">
        <ProblemPanel
          problem={SAMPLE_PROBLEM}
          className="hidden w-full max-w-md border-r md:flex lg:max-w-lg"
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col md:hidden">
          <details className="group border-b border-zinc-800 bg-zinc-900/80">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-zinc-200 marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between">
                Problem statement
                <span className="text-xs font-normal text-zinc-500 group-open:hidden">
                  Tap to expand
                </span>
                <span className="hidden text-xs font-normal text-zinc-500 group-open:inline">
                  Tap to collapse
                </span>
              </span>
            </summary>
            <div className="max-h-[40vh] overflow-y-auto border-t border-zinc-800">
              <ProblemPanel problem={SAMPLE_PROBLEM} className="border-0" />
            </div>
          </details>
          <div className="min-h-0 flex-1">
            <CodeWorkspace
              initialCode={SAMPLE_PROBLEM.starterCode}
              language="typescript"
              className="h-full"
            />
          </div>
        </div>
        <div className="hidden min-h-0 min-w-0 flex-1 md:flex">
          <CodeWorkspace
            initialCode={SAMPLE_PROBLEM.starterCode}
            language="typescript"
            className="h-full min-w-0 flex-1"
          />
        </div>
      </div>
    </div>
  )
}
