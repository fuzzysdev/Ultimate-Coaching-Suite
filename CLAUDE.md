# Ultimate Coaching Suite — CLAUDE.md

A React + Supabase PWA for ultimate frisbee coaching. Manages rosters, tryouts, game sheets, and attendance tracking. Deployed to Vercel.

## Tech Stack

- **React 19** (hooks, StrictMode, no class components)
- **Vite 7** — build tool, dev server, PWA via `vite-plugin-pwa`
- **Supabase** — Postgres DB + auth (email/password) + RLS for all data access
- **React Router 7** — URL routing (only `/`, `/superadmin`, `/reset-password`)
- **No state management library** — local `useState`/`useRef`, prop drilling
- **No CSS modules or Tailwind** — all inline styles via style objects at the bottom of each file

## Project Structure

```
src/
  App.jsx              # Auth guard, top-level routing
  pages/
    MainShell.jsx      # Authenticated shell: org/roster selectors, nav, app switcher
    LoginPage.jsx      # Sign in / sign up / forgot password
    ResetPasswordPage.jsx
    RostersPage.jsx    # Roster list for selected org
    RosterPage.jsx     # Player list for a roster
    TryoutsPage.jsx    # Tryout sessions list
    TryoutSessionPage.jsx  # Tryout ranking drag-and-drop
    GameSheetPage.jsx  # Live game tracking grid
    Attendance.jsx     # Attendance tracker
    SuperAdminPage.jsx # Super-admin org management (/superadmin route)
    PlaceholderPage.jsx
  Components/
    PlayerModal.jsx    # Add/edit player
    RosterModal.jsx    # Add/edit roster
    InviteModal.jsx    # Generate/redeem org invite codes
    CreateOrgModal.jsx # Create new organization
    ConfirmDialog.jsx  # Generic destructive-action confirm
    GameSetupDialog.jsx
    GameEndDialog.jsx
  lib/
    supabase.js        # Supabase client (reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
    offlineStore.js    # localStorage cache + write queue (prefix: ucs_)
  hooks/
    useOnlineStatus.js # Returns isOnline; flushes write queue on reconnect
```

## Key Conventions

### Styling
- All styles are **inline React style objects**, defined in a `const styles = { ... }` block at the bottom of each file and referenced as `const s = styles`.
- **Dark theme palette:** background `#0f1117`, cards `#181c26`, borders `#2a2f42`, text `#e8eaf0`, muted `#7a8099`, accent green `#00e5a0`, error red `#ff4d6d`.
- **Font:** `'Barlow Condensed', sans-serif` — uppercase, heavy weight (`700`–`900`), letter-spacing.
- Do not introduce CSS files, CSS modules, or utility class libraries.

### Components
- Functional components only, PascalCase filenames.
- Props flow down from `MainShell` → page → modal. No Context or global store.
- Modal components receive an `onClose` callback and render a fixed overlay.
- Error states use a local `error` string; show with an inline error div styled `s.error`.
- Loading states use a boolean `loading`/`saving` flag.

### Supabase / Data
- Import the client from `../lib/supabase` (or `../../lib/supabase`). Never instantiate a new client.
- All DB operations are direct `supabase.from(...)` calls inside components — no separate API layer.
- RLS is the real security boundary. Every table has RLS enabled; the anon key is safe to commit.
- **Never** use the service role key in client code.
- Supabase errors: log to `console.error`, show a **generic** message to the user (not the raw `error.message` or error codes on public-facing screens).

### Offline / Caching
- `offlineStore.setCache(key, data)` / `getCache(key)` — fast localStorage cache for list data.
- `offlineStore.enqueue(key, op)` / `dequeue(key)` — write queue for offline mutations.
- Pattern: show cached data immediately on mount, then fetch from DB in the background. Skip DB fetch if cache is fresh (< 30 s) to avoid overwriting pending local writes.
- `useOnlineStatus()` returns `isOnline` and auto-flushes the queue on reconnect.

### Auth
- `App.jsx` handles the session lifecycle via `supabase.auth.onAuthStateChange`.
- `session` (Supabase session object) is passed as a prop to every page that needs the current user.
- Super-admin access is gated by a row in the `super_admins` DB table — checked client-side, enforced by RLS at the DB level.

## Database Tables (all have RLS)

| Table | Key columns |
|-------|------------|
| `organizations` | id, name |
| `user_organizations` | user_id, organization_id, role (`admin`\|`member`) |
| `org_invites` | code (16-char), organization_id, expires_at, used_by |
| `rosters` | id, name, organization_id |
| `players` | id, name, gender (`Male`\|`Female`), grade, position (`h`\|`c`\|`b`\|`e`), roster_id |
| `tryouts` | id, organization_id, name |
| `tryout_players` | tryout_id, player fields + ranking data |
| `attendance_data` | roster_id, practices (text[]), records (jsonb) |
| `games` | id, organization_id, roster_id, opponent, scores, status |
| `game_points` | game_id, point_number, gender, scored_by, player_ids |
| `spirit_ratings` | game_id, 5 integer scores |
| `super_admins` | user_id |

Helper functions (SECURITY DEFINER): `is_org_member(org_id)`, `is_super_admin()`, `get_org_members(p_org_id)`.

## Build & Deployment

```bash
npm run dev      # Vite dev server (localhost:5173)
npm run build    # Production build → dist/
npm run preview  # Preview production build locally
```

- Deployed to **Vercel** — `vercel.json` has SPA rewrite (`/*` → `/index.html`) and production security headers (CSP, X-Frame-Options, etc.).
- The dev server (`vite.config.js`) also sets security headers locally.
- Environment: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` (gitignored). These are safe to use in browser code.

### REQUIRED: Bump manifest version before every git push

iOS Safari caches the PWA aggressively. The only reliable way to force an update is to change the manifest `version` field in `vite.config.js`. **Always increment this before pushing**, using semver patch/minor as appropriate:

```js
// vite.config.js
manifest: {
  version: '1.4.0',  // ← bump this before git push
  ...
}
```

Failure to bump the version means iOS users will continue running the old version until they manually clear their browser cache.

## SQL Migrations

All Supabase SQL files (`supabase-*.sql`) are **gitignored** — they live locally only. Run them manually in the Supabase SQL Editor (Dashboard → SQL Editor). They are all idempotent (safe to re-run).

## Input Validation Limits

All free-text inputs have HTML `maxLength` enforced:
- Org name, roster name, player name, opponent name: **100 chars**
- Practice/session label: **50 chars**
- Invite code input: **16 chars** (codes are 16-char uppercase alphanumeric)

## Pre-Approved Commands

The following Bash commands are pre-approved and should never prompt for confirmation:

```
git status
git diff *
git log *
git add *
git commit *
git push *
git pull *
git branch *
git checkout *
git stash *
npx vite *
npm run *
```

## Security Notes

- Invite codes: 16 bytes of `crypto.getRandomValues`, mapped to a 32-char alphabet = 80 bits entropy.
- Never display raw Supabase error codes or UUIDs in user-facing UI.
- `navigator.clipboard.writeText()` calls must always have `.catch(() => {})`.
- Do not add `dangerouslySetInnerHTML`, `eval`, or `document.write`.
