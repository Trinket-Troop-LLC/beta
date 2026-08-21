"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "trinket-troop-onboarding-seen";

export function BetaOnboardingModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const hasSeenOnboarding = window.localStorage.getItem(STORAGE_KEY);
    if (!hasSeenOnboarding) {
      setIsOpen(true);
    }
  }, []);

  const handleClose = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "true");
    }
    setIsOpen(false);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/70 px-4 py-6">
      <div className="w-full max-w-2xl rounded-3xl border border-border bg-card p-6 shadow-xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              Beta onboarding
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">
              *Welcome message
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground transition hover:bg-muted"
            aria-label="Close onboarding"
          >
            Skip
          </button>
        </div>

        <p className="mt-4 text-base leading-7 text-muted-foreground">
          This popup appears the first time someone lands on the homepage so they can quickly see what to do next.
        </p>

        <div className="mt-6 rounded-2xl border border-border bg-background p-5">
          <h3 className="text-lg font-semibold text-foreground">Quick tips</h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
            <li>• *insert tips</li>
            <li>• *insert tips</li>
            <li>• *insert tips</li>
          </ul>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
