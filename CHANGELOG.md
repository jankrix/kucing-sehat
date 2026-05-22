# Changelog

All notable changes to KucingKu Sehat are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.5.0] — 2026-05-22

### Added
- **Danger Zone tab in admin** — dedicated tab with a "Reset Platform for Clean Slate Testing" button
- **`POST /api/admin/reset`** — deletes all cats, lab results, lab values, vet visits, purchase logs, chat sessions, subscriptions, and all Supabase Storage files; optional `include_users` flag to also wipe auth accounts; admin config (vouchers, pricing) is preserved
- **Reset confirmation modal** — requires re-entering the `ADMIN_SECRET` before executing; shows a per-table result summary on completion; wrong secret shows inline error without closing the modal

### Security
- Reset endpoint validates `confirm_secret` in request body against `ADMIN_SECRET` env var as a second factor on top of the admin auth middleware

---

## [0.4.0] — 2026-05-22

### Added
- **Edit cat profile** — pencil button in sidebar header opens pre-filled modal; saves via `PUT /api/cats/:catId`
- **Cat picker for chat** — `/chat` route shows cat selection cards; auto-skips picker if user has only one cat; "💬 Chat Dr. Meow" shortcut button in header
- **Chat session persistence** — messages saved to `chat_sessions` table per cat; history restored on page load; "New chat" button starts a fresh session without deleting old ones; subtle `✓ Dicatat` note appears in chat when Dr. Meow logs an expense
- **Purchase date filters** — Hari ini / Minggu ini / Bulan ini / custom date range picker; filtered total shown in summary bar; category filter retained alongside date filter
- **Vet visits** (`003_vet_visits.sql`) — separate `vet_visits` table; linked to `lab_results` via nullable `vet_visit_id` FK
- **Lab upload vet visit link** — dropdown on upload form shows vet visits from last 30 days; user can link a lab result to the visit that produced it
- **Chat tool calling (`log_expense`)** — Dr. Meow automatically saves purchases and vet visits mentioned in conversation (e.g. "tadi beli Royal Canin 2kg 150rb") to the DB and confirms in reply
- **Vet visits in purchase log** — vet visits merged into the expense timeline with 🏥 category; correct delete endpoint called per item type
- **Mobile bottom navigation** — fixed bottom bar on screens ≤640px with Chat / Lab / Tren / Log tabs; active route highlighted
- **Onboarding screen** — new users with no cats see a 3-step welcome card (Add cat → Upload lab → Chat) instead of a blank empty state
- **Subscription overlay** — full-screen blocking pilot screen on first login for users without active subscription; shows pricing cards (Basic 35k / Premium 49k), voucher validation, and "Lanjut (Pilot Mode)" bypass; app body hidden until dismissed; stored in `sessionStorage`
- **`GET /api/cats/:catId/vet-visits`** and **`/recent`** endpoints
- **`DELETE /api/cats/:catId/vet-visits/:id`** endpoint
- **`GET/POST /api/chat/sessions/:catId`** endpoints for session management

### Fixed
- **dotenv timing bug** — replaced `dotenv.config()` in file body with `import 'dotenv/config'` as first import; config.ts was reading `process.env` before `.env` was loaded
- **Express 5 wildcard route** — changed `app.get("*", ...)` to `app.get("*splat", ...)` to comply with Express 5 / path-to-regexp breaking change
- **Cat birthdate validation** — input `max` attribute set to today; backend Zod schema rejects future dates with Indonesian error message

### Changed
- `openai.ts` service updated to support tool calling — accepts optional `tools` parameter, returns `tool_calls` when GPT invokes a tool, exposes `continueWithToolResults` for the second-pass response
- Purchase log page now fetches and merges both `purchase_log` and `vet_visits` into a unified timeline

---

## [0.3.0] — 2026-05-21

### Added
- **Admin dashboard** at `/admin` — login-protected with `ADMIN_SECRET`
  - **Dashboard tab** — stats: total users, active subscriptions, cats, lab results by status
  - **Users tab** — list all users; send password reset email; set password directly; grant subscription; ban/unban
  - **Lab Reports tab** — all labs across all users; filter by status; delete individual records + stored images; bulk "Purge All Lab Images" button
  - **Subscriptions tab** — full log; cancel; grant subscription with custom plan and duration
  - **Vouchers tab** — create codes with discount %, max uses, expiry; toggle active; delete
  - **Pricing tab** — testing mode toggle (price = 0), basic/premium price, minimum price floor with scenario notes
- **`POST /api/subscribe`** — validates pricing config and voucher, grants subscription instantly when testing mode or 100% voucher with zero minimum
- **`POST /api/subscribe/validate-voucher`** — validates a voucher code without subscribing
- **`GET/PUT /api/admin/pricing`** — pricing config stored in `app_config` table
- **`GET/POST/PATCH/DELETE /api/admin/vouchers`** — full voucher CRUD
- **`GET /api/admin/stats`** — aggregated platform stats
- **`GET /api/admin/users`** — enriched user list (subscription, cat count, lab count)
- **`POST /api/admin/labs/purge-images`** — bulk delete stored lab images from Supabase Storage
- **Purchase log** — `GET/POST/DELETE /api/cats/:catId/purchases`
- **Purchase log frontend** — items grouped by month; category filter chips; total spend in header; add modal with all fields; delete with confirmation; vet_visit category
- **`STORE_LAB_IMAGES` env flag** — lab images no longer stored by default (set `true` to retain originals); prevents Supabase Storage from accumulating costly unused files
- **`002_admin_schema.sql`** — `vouchers` and `app_config` tables
- **`ADMIN_SECRET` env var** — documented in `.env.example`

### Changed
- `src/index.ts` — admin and subscribe routes registered; `/admin` served before SPA wildcard fallback

---

## [0.2.0] — 2026-05-21

### Added
- **Trend analysis** — `GET /api/cats/:catId/trends` groups all confirmed lab values by parameter into time-series data
- **AI trend analysis** — `POST /api/cats/:catId/trends/analyze` sends trend data to GPT-4o; returns natural-language health summary in Indonesian
- **Trends page** — SVG sparkline per parameter with reference range band, color-coded dots by flag (normal/low/high/critical), delta vs previous reading; single-reading parameters shown in table; "Analisis AI" button streams GPT-4o summary into the page
- **Context-aware Dr. Meow** — chat route now fetches cat's confirmed lab history and injects it as structured context into the system prompt when `cat_id` is provided; Dr. Meow references actual lab values, flags recurring abnormalities
- **`src/services/chatContext.ts`** — builds cat profile + lab history context string
- **`src/services/trendAnalyzer.ts`** — `groupByParameter()` pivots lab results into per-parameter time series; `analyzeTrends()` calls GPT-4o

### Changed
- `src/routes/chat.ts` — wires lab context injection; replaced placeholder TODOs

---

## [0.1.0] — 2026-05-21

### Added
- **Lab upload** — `POST /api/cats/:catId/labs/upload` accepts base64 image; uploads to Supabase Storage (when `STORE_LAB_IMAGES=true`); calls GPT-4o Vision to extract all parameter values; saves to `lab_results` + `lab_values` tables
- **Lab list** — `GET /api/cats/:catId/labs` returns results with nested values
- **Lab detail / confirm** — `GET /api/labs/:labId`; `PUT /api/labs/:labId/confirm` replaces AI-extracted values with user-confirmed ones
- **Lab upload frontend** — drag-and-drop image dropzone; date + lab name fields; AI processing state; frontend validation (file type, 8MB limit, minimum 400×300px dimension check with warning)
- **Lab detail frontend** — editable table with per-row inputs; flag color-coding (normal/low/high/critical); confirm button; read-only confirmed view with edit toggle
- **Sidebar timeline** — lab results grouped by month in sidebar; clickable links to lab detail; status color (confirmed = green, extracted = yellow)
- **`src/services/labExtractor.ts`** — GPT-4o Vision prompt, JSON parsing, `computeFlag()` for normal/low/high/critical thresholds
- **`src/db/queries/labs.ts`** — `create`, `updateStatus`, `insertValues`, `replaceValues`, `listByCat`, `getById`
- **Cat dashboard** — loads real lab results for sidebar (replaces hardcoded empty array)
- **`btn-secondary`, `.page-content`, `.image-dropzone`** CSS classes
- **`001_initial_schema.sql`** — `cats`, `lab_results`, `lab_values`, `purchase_log`, `chat_sessions`, `subscriptions` tables; RLS policies; `cat-files` storage bucket

---

## [0.0.1] — 2026-03-29 (Initial build)

### Added
- **Auth** — email/password login and signup via Supabase Auth; JWT verification middleware
- **Cat profiles** — `GET/POST/PUT/DELETE /api/cats`; photo upload to Supabase Storage
- **Dr. Meow basic chat** — `POST /api/chat` with GPT-4o mini; supports text and image messages
- **Subscription status** — `GET /api/me` returns user + active subscription
- **Vanilla JS SPA** — hash-based router; no framework; no build step; ES modules via esm.sh CDN
- **Pages** — login, cats list, cat dashboard layout, chat
- **Components** — header, sidebar, modal, toast, cat-card
- **`.env.example`** with required environment variables documented
