import Link from "next/link";

import { BetaOnboardingModal } from "@/components/beta-onboarding-modal";

const appSections = [
  {
    title: "Browse",
    description: "Explore listings and discover what other people are sharing.",
    href: "/beta/apply",
  },
  {
    title: "Post",
    description: "Create your first listing or share something you want to pass along.",
    href: "/beta/apply",
  },
  {
    title: "Messages",
    description: "Start conversations and coordinate pickups or swaps.",
    href: "/beta/apply",
  },
  {
    title: "Profile",
    description: "Set up your account details and share a bit about yourself.",
    href: "/beta/apply",
  },
  {
    title: "Welcome page",
    description: "Keep the public landing and sign-up flow separate from the app experience.",
    href: "/",
  },
];

export default function BetaHomePage() {
  return (
    <main className="min-h-screen bg-[#faf7f0] px-4 py-10 text-[#30392d] sm:px-6 lg:px-8">
      <BetaOnboardingModal />

      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <section className="rounded-3xl border border-[#ded8cc] bg-[#fffdf9] p-8 shadow-sm sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#5f7258]">
            Beta app home
          </p>
          <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">
            This will become the main home screen for the app.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#625f58]">
            The public welcome page can stay in place for sign-ups and interest forms, while this screen becomes the actual app experience later.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {appSections.map((section) => (
            <Link
              key={section.title}
              href={section.href}
              className="rounded-2xl border border-[#ded8cc] bg-[#fffdf9] p-5 shadow-sm transition hover:-translate-y-0.5 hover:bg-[#f5efe5]"
            >
              <h2 className="text-lg font-semibold text-[#30392d]">{section.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#625f58]">{section.description}</p>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
