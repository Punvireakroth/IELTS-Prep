# IELTS Prep (Supabase)

Notion-like study plan with email auth and synced progress.

## Setup

1. Copy env file and paste your project URL + **publishable** key (same as the old “anon” key):

```bash
cp .env.example .env
```

Use `VITE_SUPABASE_PUBLISHABLE_KEY` (falls back to `VITE_SUPABASE_ANON_KEY` if present).

2. In the [Supabase SQL Editor](https://supabase.com/dashboard), run [`supabase/schema.sql`](supabase/schema.sql).

3. Authentication → Providers → Email: enable Email. For solo use, turn **Confirm email** **off** (Authentication → Providers → Email, or Authentication → Sign In / Providers). If it stays on, signup creates the account but you must click the email link before you can sign in — easy to mistake for a failed signup.

4. Install and run:

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173), sign up, then use the nav:

| View | What |
|------|------|
| Plan | Day-by-day checkboxes |
| Scores | Weekly score tracker |
| Error log | Mistake log |
| Overview | Editable exam meta + templates / targets |
| Resources | Resource hub |
| Guide | How to use, done means, booking, rules |

Progress is stored in Supabase (`profiles`, `task_checks`, `error_logs`, `score_entries`). If you still have ticks from the old localStorage page, they import once on first login when the cloud tables are empty.
