# GharKharch

Private household expense intelligence. **Household Money, Clearly.**

This is Phase 1 of the build: the production foundation (Next.js + Supabase + auth +
database schema + responsive app shell). Expense entry, analytics, and intelligence
features land in the phases that follow.

## Stack

Next.js (App Router, TypeScript, Tailwind CSS v4) · Supabase (Postgres, Auth, RLS) ·
React Hook Form + Zod · Recharts (from Phase 4) · date-fns

## 1. Install dependencies

```bash
npm install
```

## 2. Create a Supabase project

1. Create a free project at [supabase.com](https://supabase.com).
2. In **Project Settings → API**, copy the **Project URL** and the **anon public key**.
3. Paste them into `.env.local` (already created from `.env.example`):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Never put the **service role key** in a `NEXT_PUBLIC_*` variable — it stays server-side
only, and Phase 1 doesn't need it at all.

## 3. Run the database migrations

In the Supabase dashboard, open **SQL Editor** and run the files in `supabase/migrations/`
**in order**:

1. `001_initial_schema.sql` — tables, the household-creation/join functions, triggers
2. `002_rls.sql` — Row Level Security policies (every household-scoped table)
3. `003_indexes.sql` — performance indexes
4. `004_seed_categories.sql` — the default Food & Grocery / Shopping / Fashion / … category tree

(If you'd rather use the Supabase CLI: `supabase link` then `supabase db push`.)

## 4. Run the app

```bash
npm run dev
```

Open http://localhost:3000. Sign up, then either create a household or join one with
an invite code (found under **More → your household** once the first person has created one).

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run typecheck` — TypeScript, no emit
- `npm run lint` — ESLint

## Project layout

```
src/app/(auth)/      login, signup, onboarding
src/app/(app)/        dashboard, expenses, analytics, reports, more — behind auth
src/components/ui/    hand-built shadcn-style primitives (button, card, drawer, …)
src/components/shared/ AppShell, nav, Logo, EmptyState, AddExpenseDrawer
src/lib/supabase/     browser/server/middleware Supabase clients
src/types/database.ts hand-authored types matching the SQL migrations
supabase/migrations/  schema, RLS, indexes, seed data
```

## Status: Phase 1 (Foundation) complete

Auth, household creation/joining, RLS-protected schema, responsive app shell
(mobile bottom nav + floating Add button, tablet/desktop sidebar), design tokens,
and empty states are in place. See the implementation summary in this session for
what's next (Phase 2: the real expense entry flow).
