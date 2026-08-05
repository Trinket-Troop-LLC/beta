import Link from "next/link";

export default function BetaOnboardingPage() {
  return (
    <main className="min-h-screen bg-[#faf7f0] px-4 py-10 text-[#30392d] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 rounded-3xl border border-[#ded8cc] bg-[#fffdf9] p-8 shadow-sm sm:p-10">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#5f7258]">
            Beta onboarding
          </p>
          <h1 className="text-3xl font-semibold sm:text-4xl">
            *Welcome message
          </h1>
          <p className="max-w-2xl text-base leading-7 text-[#625f58]">
            This is the first screen new beta users will see after they open the invite link.
          </p>
        </div>

        <div className="rounded-2xl border border-[#ded8cc] bg-[#faf7f0] p-6">
          <h2 className="text-xl font-semibold text-[#30392d]">Quick tips</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-[#4f4a41]">
            <li>• *insert tips</li>
            <li>• *insert tips</li>
            <li>• *insert tips</li>
          </ul>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-lg bg-[#7c9272] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#667b5f]"
          >
            Continue
          </Link>
          <Link
            href="/beta/apply"
            className="rounded-lg border border-[#ded8cc] px-5 py-3 text-sm font-medium text-[#30392d] transition hover:bg-[#f5efe5]"
          >
            View beta apply page
          </Link>
        </div>
      </div>
    </main>
  );
}
