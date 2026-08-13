# Trinket Troop

A friendlier way to buy, sell, trade, and gift secondhand treasures in New York City.

This repo currently holds the public site (landing page, general interest waitlist, beta application form) and the admin
review dashboard. The beta app itself — post a listing, browse, message another member — is being built now. See
[the 2-week build plan](https://claude.ai/code/artifact/453ed524-b4e0-453b-aef1-ad5bd3e58559) and the tracked
[`beta-app` issues](https://github.com/trinket-troop/beta/issues?q=is%3Aissue+label%3Abeta-app) for scope and status.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- [Supabase](https://supabase.com) — Postgres, Auth, Storage, Realtime
- Tailwind CSS + [shadcn/ui](https://ui.shadcn.com/) (design tokens live in `app/globals.css`)
- [Resend](https://resend.com) for transactional email; Twilio for SMS message notifications (beta app)
- Deployed on Vercel, auto-deploying from `main`

## Deployment flow

- `beta-internal` is the long-lived staging branch. Feature work is reviewed and merged there first so Vercel can deploy
  it to the internal beta domain.
- After internal testing, open a pull request from `beta-internal` into `main`. Merging that pull request deploys the public
  beta site.
- Keep staging credentials and data separate from production wherever possible, especially for Supabase, Resend, and
  Twilio.

## Local setup

1. Copy `.env.local` from whoever last had it, or create one with:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
   RESEND_API_KEY=...
   RESEND_FROM_EMAIL=...
   ```

2. Install and run:

   ```bash
   npm install
   npm run dev
   ```

   Runs on [localhost:3000](http://localhost:3000/).

3. Type-check and build before opening a PR:

   ```bash
   npx tsc --noEmit
   npm run build
   ```

## Database changes

**Every schema or RLS change is a migration file in `supabase/migrations/`, committed before it's run — never
hand-configured directly in the Supabase dashboard.** Two tables in this project (`applicants`, `public.users`) were set up
by hand outside migrations, and that blind spot has already caused two separate silent-failure bugs in production. Don't add
a third.

Migrations are applied manually via the Supabase SQL editor by whoever's the designated migration-owner for the current
work — not automatically on deploy.

## Working on this repo

- Branch off `beta-internal` for normal feature work, keep branches short-lived, and pull before you start each session.
  Use `main` only as the public-beta release branch (or for an emergency hotfix that is immediately merged back into
  `beta-internal`) — a merge collision from a stale branch has already shipped a real bug to `main` once.
- PRs require review before merge (branch protection enforces this on `main`).
- If you're touching `app/beta/apply/` or `app/apply/`, check open PRs first — these files have collided with concurrent
  work more than once.
