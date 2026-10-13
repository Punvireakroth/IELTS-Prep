# IELTS prep

One page for the work before IELTS Academic. The plan, the materials, and your progress sit together.

It is written for a candidate around band 5.5–6 who wants an overall 6.5, with no skill below 6.0, on the computer test in Cambodia.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173. Until Supabase is connected, ticks, notes, scores, and the error log stay in this browser.

To sync them to your project:

1. Copy `.env.example` to `.env`.
2. Paste the project URL and the publishable key (`sb_publishable_...`). Leave the secret key in the dashboard.
3. In the Supabase SQL editor, run `supabase/migrations/20261011050940_study_progress.sql`, then `supabase/schema.sql`.
4. Restart `npm run dev`, then create an account from the account control in the settings panel.

Email confirmation is on by default. For a personal project, turn off Confirm email under Authentication settings, or set the site URL to `http://localhost:5173` so the confirmation link can return to the page.

## How the page works

[plan.md](plan.md) is the whole plan. A heading like `### Setup · 1.5 hours` is a required day. The blocks inside that day stay as checkboxes. Materials and links live inside the days that use them. Sections without an hours heading stay on the page as reference.

Set a start date and how many hours you can study each week. The page gives each required day a due date, in order. It also shows how far behind or ahead you are, and a projected finish date. For the first week the projection uses the hours per week you set. After that it uses the hours you actually complete. Until you set the hours, the page uses 12 a week.

A target date is optional. If the projection misses it, the page tells you how many hours a week would hit it.

Change the start date or the hours per week to move the deadlines. **Reset deadlines from today** leaves finished days checked and schedules the remaining required days from today.

Check a day when that day's work exists. Check each block as you finish it. The note on an open day is for a score, a mistake, or a sentence you want to reuse.

The score tracker and the error log sit under those headings. Week 6 is built from the error log.
