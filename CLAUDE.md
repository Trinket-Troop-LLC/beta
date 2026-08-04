# Trinket Troop

Peer-to-peer secondhand exchange app for NYC. This repo is the public site (landing page, waitlist form, beta application
form) plus an admin review dashboard, currently being extended into the real beta app (post/browse/chat). Next.js App
Router + TypeScript, Supabase (Postgres/Auth/Storage/Realtime), Tailwind + shadcn/ui, deployed on Vercel (auto-deploys from
`main`).

Full 2-week beta-app build plan, with scope/cuts/rationale: https://claude.ai/code/artifact/453ed524-b4e0-453b-aef1-ad5bd3e58559
Tracked as GitHub issues labeled `beta-app`.

## Hard rules, not suggestions

- **Every schema or RLS change is a migration file in `supabase/migrations/`, committed before it's applied.** Never
  hand-configure a table or policy directly in the Supabase dashboard. `applicants` and `public.users` were both set up
  that way before this rule existed, and both are now undocumented blind spots — auditing `public.users`' actual schema is
  the first task of the beta-app build specifically because of this.
- **Migrations don't auto-apply.** Pushing code to `main` does not run pending migrations against the live database —
  someone has to run the SQL manually in the Supabase SQL editor. Don't assume a schema change is live just because the
  code deployed.
- **PR review is required before merging to `main`** (enforced via branch protection). Pull before you start work — a
  stale branch merged without review already shipped a garbled UI bug to `main` once.
- **`app/beta/apply/` and `app/apply/` are collision-prone.** Multiple people have modified these concurrently and
  regressed each other's work (profile picture size limit reverted twice). Check open PRs touching these paths before
  starting work there.

## Design tokens

Brand colors are meant to live in `app/globals.css` as the shadcn CSS variables (`--background`, `--primary`, `--border`,
etc.) — they currently do NOT (still generic shadcn defaults) while every real page hardcodes the actual brand palette
inline (`bg-[#7c9272]`, `text-[#2c2c2c]`, ...). Real palette: cream `#faf7f0` background, sage `#7c9272` / `#5f7258`
primary, ink `#30392d` / `#2c2c2c` text, border `#ded8cc`, muted text `#7c8072` / `#625f58`. New beta-app screens should
wire these into the token variables and use semantic classes, not more inline hex — see the Track B / Days 1–3 issue for
why (no designer is hired yet; this is what makes the whole UI swappable later without a rewrite).

## Key architecture notes

- `app/apply/` — general interest waitlist form (public, no auth). `app/beta/apply/` — beta application form (public, no
  auth), requires a profile picture, client-side compresses it before upload (see `beta-application-form.tsx` —
  `createImageBitmap` + canvas, max 1600px edge, JPEG q0.85). Both write to Supabase tables (`general_interest`,
  `applicants`) via server actions in their respective `actions.ts`.
- `app/admin/` — dashboard for reviewing/approving applicants, gated on `public.users.role === 'admin'`. Approving an
  applicant currently just sends an email saying "we'll be in touch" — it does not yet create a real account. That's the
  first thing the beta-app build fixes.
- Storage buckets: `beta-profile-pictures` (private, signed URLs, admin-only read). The beta app will add
  `listing-photos` — public vs. signed-URL-private is an open decision, see the Day 0 kickoff issue.
- No middleware.ts exists in this project — auth session handling happens per-route via `lib/supabase/server.ts`.
- The homepage, general-interest form, and beta-application form intentionally have no top nav (no home link, no
  sign-in) — they're standalone flows, not pages for browsing the site.

## Before opening a PR

```bash
npx tsc --noEmit
npm run build
```

Type-checking and a clean build catch real breakage but not everything — several bugs this project has hit (profile
picture upload failures, an RLS permission gap) were only visible from actually using the feature in a browser, not from a
green build. Test the actual flow when you can.
