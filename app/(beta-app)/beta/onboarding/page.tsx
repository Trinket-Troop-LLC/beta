import Link from "next/link";

export default function BetaOnboardingPage() {
  return (
    <main className="min-h-screen bg-background px-4 pt-10 pb-44 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 rounded-3xl border border-border bg-card p-8 shadow-sm sm:p-10">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            Beta onboarding
          </p>
          <h1 className="text-3xl font-semibold sm:text-4xl">
            *Welcome message
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            This is the first screen new beta users will see after they open the invite link.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-background p-6">
          <h2 className="text-xl font-semibold text-foreground">Quick tips</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
            <li>• *insert tips</li>
            <li>• *insert tips</li>
            <li>• *insert tips</li>
          </ul>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            Continue
          </Link>
          <Link
            href="/beta/apply"
            className="rounded-lg border border-border px-5 py-3 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            View beta apply page
          </Link>
        </div>
      </div>
    </main>
  );
}
