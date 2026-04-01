export function HomePage() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 py-16">
      <div className="max-w-lg text-center space-y-4">
        <p className="text-sm font-medium text-violet-600 dark:text-violet-400">
          CodingPrep
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Frontend is ready
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Tailwind is configured. Add routes, components, and API calls under{' '}
          <code className="rounded bg-neutral-200/80 px-1.5 py-0.5 text-sm dark:bg-neutral-800">
            src/
          </code>
          .
        </p>
      </div>
    </main>
  )
}
