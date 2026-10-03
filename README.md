# imaginati · DSA Cohort

*where ideas take flight*

A private, invite-only practice site for imaginati's beginner DSA cohort. Students sign in with Google, open each problem on LeetCode, and upload one screenshot per problem to mark it done. Admins manage who's enrolled, build each day's session, and see everyone's progress.

**Day 1 is ready:** Session 1, *Complexity Analysis + Math & Logic Building*, has its 6 classwork and 10 homework problems and is published.

| Classwork | Homework |
|---|---|
| 9 Palindrome Number | 412 Fizz Buzz |
| 268 Missing Number | 1342 Number of Steps to Reduce a Number to Zero |
| 292 Nim Game | 1295 Find Numbers with Even Number of Digits |
| 319 Bulb Switcher (Medium) | 2520 Count the Digits That Divide a Number |
| 258 Add Digits | 507 Perfect Number |
| 1979 Find Greatest Common Divisor of Array | 263 Ugly Number |
| | 326 Power of Three |
| | 172 Factorial Trailing Zeroes (Medium) |
| | 204 Count Primes (Medium) |
| | 877 Stone Game (Medium) |

## Preview it locally

```bash
pnpm install
pnpm build && pnpm start      # http://localhost:3000
```

Until the database is connected, the site runs in **preview mode**. A "Preview" strip at the top lets you view the site as a **Student**, the **Instructor** or someone **Not enrolled**. Anything you do is kept only in that browser, and **Reset** goes back to a clean Day 1. The strip disappears once Supabase is connected.

## Go live for Day 1

1. **Supabase project.** Create one at [supabase.com](https://supabase.com), choosing the region closest to your students (Mumbai for India). Open **SQL Editor** and run these, in order:
   - [`supabase/migrations/20261002000000_init.sql`](supabase/migrations/20261002000000_init.sql) — tables, access rules and screenshot storage.
   - [`supabase/migrations/20261003000000_leaderboard.sql`](supabase/migrations/20261003000000_leaderboard.sql) — attendance and the leaderboard.
   - [`supabase/seed.sql`](supabase/seed.sql) — Day 1, published and dated today. Running it a second time does nothing.
   - Make yourself the first admin:
     ```sql
     insert into public.allowed_emails (email, role) values ('your.email@gmail.com', 'admin');
     ```
2. **Google sign-in**
   - In Google Cloud Console, go to **APIs & Services → Credentials** and create an **OAuth client ID** (type: Web application). Set the authorized redirect URI to `https://<project-ref>.supabase.co/auth/v1/callback`.
   - On the OAuth consent screen, set the app name to *imaginati*, then **Publish app** (In production). Basic email/profile sign-in needs no Google review.
   - In Supabase, go to **Authentication → Sign In / Providers**. Turn on **Google** and paste the client ID and secret. Then turn **off** the Email provider so Google is the only way in.
3. **Redirect URLs.** In Supabase, go to **Authentication → URL Configuration**:
   - Site URL: your site's address (e.g. `https://<your-app>.vercel.app`)
   - Redirect URLs: `https://<your-app>.vercel.app/auth/callback` and `http://localhost:3000/auth/callback`
4. **Keys.** Copy `.env.example` to `.env.local`. Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, both from Supabase's **Project Settings → API Keys**.
5. **Deploy.** Import the repo in Vercel, add the same two env vars, and deploy.
6. **Add your students.** Sign in, then go to **Admin → People → Add people** and paste their Gmail addresses (one per line, or a CSV). They can sign in straight away.

> Without a custom domain, Google's account picker says "continue to *xyz*.supabase.co". That's expected, so let students know.

**After class:** mark who came in **Admin → Attendance**. Then open **Admin → Sessions → S1** and paste the recording and notes links, so students see **Recording** and **Notes** buttons on the session page.
**Next day:** create **S2** from **Admin → Sessions → New session**. Paste each problem's LeetCode link and the number, title and difficulty fill in. **Publish** when ready.

## Leaderboard

**Leaderboard** in the top bar ranks students three ways. Pick one with the tabs:

| Tab | Ranked by |
|---|---|
| **Overall** (default) | 70% problems + 30% attendance |
| **Problems** | problems solved across published sessions |
| **Attendance** | classes attended |

- **Problems** is the share of problems in published sessions that a student has solved.
- **Attendance** is the share of classes held that they attended. A class counts as held once you've marked attendance for it.
- **Before any attendance is marked,** the overall score is just the problems score.
- **Ties** share a rank.
- **Who sees what:** students see the top 10 plus their own place, without other students' LeetCode usernames. Admins see everyone.
- **Changing the weights:** they're `WEIGHTS` in [`lib/leaderboard.ts`](lib/leaderboard.ts) and the matching numbers in the leaderboard migration.
- **Attendance** is marked per class in **Admin → Attendance**. Mark the few who were absent, then click **Mark the rest present**. Students can be marked before they first sign in.
- **In preview mode,** the board shows 20 labelled **sample** students, as it might look a few weeks in. The real board only ever shows real students.

## How it works

- **Next.js 16** (App Router), **Tailwind CSS v4**, and **TanStack Query** for data.
- **Branding.** The colours are measured from the imaginati logo, and the logo is redrawn as a vector in [`components/brand.tsx`](components/brand.tsx). There's a deep-navy dark theme (the default) and a light theme, switched with the sun/moon button; all the colours live in [`app/globals.css`](app/globals.css). The name and tagline can be changed with env vars (see `.env.example`).
- Every page talks to a `DataClient` interface ([`lib/data/client.ts`](lib/data/client.ts)), which has two implementations:
  - [`SupabaseDataClient`](lib/data/supabase-client.ts): Postgres, Row Level Security and Storage, called from the browser.
  - [`DemoDataClient`](lib/data/demo-client.ts): preview mode, which simulates the backend in the browser.
- **The database enforces access, not the UI.** Students only see published sessions and their own submissions. Uploads must go into the student's own folder. Admins see everything. Removing an email from the allowlist cuts access on the next request.
- **Screenshots** are shrunk in the browser to about 50–150 KB, as WebP (or JPEG on Safari). They're uploaded straight to a private bucket at `{user}/{question}/{timestamp}.ext`, and the old file is deleted when a screenshot is replaced. Admins view them through short-lived signed links.
- **Gmail matching.** `foo.bar@gmail.com` and `foobar@gmail.com` count as the same person, so enrolling someone works even if they type the dots differently.
- **LeetCode auto-fill.** [`/api/leetcode`](app/api/leetcode/route.ts) asks LeetCode's public GraphQL endpoint for a problem's number, title and difficulty. Only admins can call it.

## Checks

```bash
pnpm typecheck   # TypeScript
pnpm lint        # ESLint
pnpm build       # production build
pnpm test:db     # runs the real migrations + Day 1 seed in PGlite and checks 58 rules
```

## Not done yet

- **Real mode hasn't been run against a live Supabase project yet.** The SQL is tested in PGlite, but the Google sign-in round trip needs your accounts.
- **Storage limit.** Supabase's free plan has 1 GB of storage. At about 100 KB per screenshot, that's roughly 10 sessions where every student finishes every problem.
- **v2 backlog** (streaks, deadlines, auto-verifying solves on LeetCode) hasn't been started.
