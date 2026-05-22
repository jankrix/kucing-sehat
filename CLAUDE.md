# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

KucingKu Sehat — subscription-based cat health EMR (Electronic Medical Record) platform for Indonesian cat owners. Users create cat profiles, upload lab results for AI extraction, track health trends, and chat with Dr. Meow (a context-aware AI vet). Target market: Indonesian cat owners (IDR 35–49k/month).

## Commands

```bash
npm run dev      # tsx watch src/index.ts — hot reload, runs on :3000
npm start        # tsx src/index.ts — production-style start
```

No build step, no test suite, no lint script. TypeScript errors are non-fatal at runtime (`tsx` executes TS directly). Run `npx tsc --noEmit` to type-check — some pre-existing errors exist in the project (Express 5 `req.params` types, barrel export issues); do not treat these as regressions.

## Environment

All required vars validated on startup in `src/config.ts` — server exits immediately if any are missing:

```
OPENAI_API_KEY         GPT-4o + GPT-4o mini
SUPABASE_URL           Project URL
SUPABASE_ANON_KEY      Sent to frontend via GET /api/config
SUPABASE_SERVICE_KEY   Backend only — bypasses RLS
ADMIN_SECRET           Protects /admin and /api/admin/*
STORE_LAB_IMAGES       "true" to persist lab images in Supabase Storage (default false)
```

**Critical:** `import "dotenv/config"` must be the first line of `src/index.ts`. TypeScript `import` statements are hoisted, so placing `dotenv.config()` in the file body causes `src/config.ts` to read `process.env` before the `.env` file loads.

## Architecture

### Backend — Express 5 + TypeScript

Single process serves both the API and the static frontend.

**Route mounting order matters:**
1. `/admin` static file — must be before `express.static` (otherwise `express.static` 301-redirects the directory)
2. `/api/*` routes — all protected by either `verifyAuth` (Supabase JWT) or `adminAuth` (ADMIN_SECRET bearer token)
3. `express.static("public/")` — serves frontend assets
4. `*splat` SPA fallback — Express 5 requires named wildcards; bare `*` throws a PathError

**Auth pattern:** `verifyAuth` middleware in `src/middleware/auth.ts` calls `supabaseAdmin.auth.getUser(token)` and attaches `req.userId`. All route handlers use `AuthRequest` (extends `Request`) to access `req.userId`.

**Admin auth** (`src/middleware/adminAuth.ts`): checks `Authorization: Bearer <ADMIN_SECRET>` header — separate from user JWT auth.

**`supabaseAdmin`** (service role key) is used for all backend DB operations — bypasses RLS. Never use the anon key on the backend.

### Database — Supabase (Postgres)

Migrations in `supabase/migrations/` — run manually in Supabase SQL Editor in order:
- `001_initial_schema.sql` — core tables + RLS + `cat-files` storage bucket
- `002_admin_schema.sql` — `vouchers` + `app_config` (pricing)
- `003_vet_visits.sql` — `vet_visits` table + `vet_visit_id` FK on `lab_results`

**Key relationships:**
- `cats` → `lab_results` → `lab_values` (cascade delete)
- `lab_results.vet_visit_id` → `vet_visits` (nullable — links a lab upload to a vet visit)
- `chat_sessions.cat_id` → `cats`
- `app_config` key `"pricing"` stores JSON: `{ basic_idr, premium_idr, testing_mode, min_price_idr }`

### AI Services (`src/services/`)

| File | Model | Purpose |
|------|-------|---------|
| `openai.ts` | gpt-4o-mini | Dr. Meow chat. Supports optional tool calling — returns `tool_calls` array when GPT invokes a tool; caller must call `continueWithToolResults()` for the second-pass response |
| `labExtractor.ts` | gpt-4o | Vision extraction of lab result images → structured JSON of parameter values. `computeFlag()` determines normal/low/high/critical thresholds |
| `chatContext.ts` | — | Builds a structured context string from a cat's confirmed lab history, injected into Dr. Meow's system prompt |
| `trendAnalyzer.ts` | gpt-4o | `groupByParameter()` pivots lab results into per-parameter time series; `analyzeTrends()` generates natural-language health summary |

**Chat tool calling flow** (`src/routes/chat.ts`):
1. Call `chat()` with `LOG_EXPENSE_TOOL` definition
2. If GPT returns `tool_calls`, save purchase/vet-visit to DB
3. Call `continueWithToolResults()` with results → get final reply
4. Persist both turns to `chat_sessions` table

### Frontend — Vanilla JS SPA

No framework, no build step. ES modules loaded directly by the browser. Supabase client loaded from `https://esm.sh/@supabase/supabase-js@2` at runtime.

**Router** (`public/js/router.js`): hash-based (`#/path`). Routes registered in `public/js/app.js`. Pattern params (`:catId`) extracted via regex. Route handlers can return a cleanup function called on navigation away.

**State** (`public/js/state.js`): simple reactive store. `state.onChange(fn)` subscribes; any `state.set*()` call notifies all subscribers. **Important:** avoid calling `state.set*()` inside `state.onChange` callbacks — it creates infinite notification loops. The subscription prompt bug was caused exactly by this pattern.

**Dashboard layout** (`public/js/pages/cat-dashboard.js`): wrapper that loads the cat, renders the sidebar + mobile nav, then delegates the main content area to a sub-page render function. All cat-specific pages (`chat`, `lab-upload`, `lab-detail`, `trends`, `purchases`) use `renderDashboard(container, catId, renderFn)`.

**Cat picker** (`public/js/pages/cat-picker.js`): reusable — takes a `destination(catId)` function and either auto-navigates (1 cat) or shows selection cards (multiple cats).

**Mobile nav** (`public/js/components/mobile-nav.js`): appended to `document.body`, returns a cleanup function. Rendered by `cat-dashboard.js` on every dashboard page.

**Subscription prompt** (`public/js/components/subscription-prompt.js`):
- Called once per login via `_subPromptRan` flag in `app.js`
- `_overlayActive` flag prevents duplicate overlays
- Hides `#app-body` via `visibility: hidden` until user clicks "Lanjut (Pilot Mode)"
- Bypass stored in `sessionStorage` under key `pilot_bypassed`

### Admin Panel (`public/admin/index.html`)

Self-contained single HTML file (inline CSS + JS, no external dependencies). Served at `/admin` by an explicit Express route that must precede `express.static`. Login validates `ADMIN_SECRET` against `/api/admin/stats` before showing the dashboard.

**Tabs:** Dashboard · Users · Lab Reports · Subscriptions · Vouchers · Pricing · Danger Zone

**Reset endpoint** (`POST /api/admin/reset`): requires `confirm_secret` in request body (second factor on top of bearer token). Deletes all user data tables and Storage files. Optional `include_users: true` to also delete auth accounts. Preserves `vouchers` and `app_config`.

## Key Gotchas

- **Express 5 wildcards**: use `*splat` not `*` — path-to-regexp v8 requires named params
- **`express.static` + `/admin`**: static middleware 301-redirects directory paths; the explicit `app.get("/admin", ...)` must come before `app.use(express.static(...))`
- **Lab images**: not stored by default (`STORE_LAB_IMAGES=false`). Cat profile photos are always stored. The admin Danger Zone has a "Purge All Lab Images" button for cleanup
- **Chat history**: passed as `history` array in request body from frontend (not server-side sessions). Server persists to `chat_sessions` table using `session_id` from the request. The frontend loads the latest session on mount via `GET /api/chat/sessions/:catId/latest`
- **Pricing / testing mode**: when `testing_mode: true` in `app_config`, `POST /api/subscribe` grants subscriptions for free instantly. Set via admin Pricing tab
- **Supabase email confirmation**: disabled for pilot testing (Authentication → Providers → Email → uncheck "Confirm email")
