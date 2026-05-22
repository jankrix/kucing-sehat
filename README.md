# KucingKu Sehat 🐱

Subscription-based cat health EMR (Electronic Medical Record) platform for Indonesian cat owners. Upload lab results, track health trends, and chat with Dr. Meow — an AI vet assistant that references your cat's actual lab history.

## Features

- **Cat Profiles** — multi-cat support with photos, breed, age, weight
- **Lab Upload** — photograph blood test results; GPT-4o Vision extracts all values automatically
- **Lab Timeline** — confirm/edit extracted values, browse history per cat
- **Trend Charts** — SVG sparklines per parameter across multiple lab results
- **Context-Aware Chat** — Dr. Meow reads your cat's confirmed lab history before answering
- **Purchase Log** — track food, vitamins, medicine purchases per cat
- **Admin Dashboard** — manage users, lab reports, subscriptions, vouchers, and pricing at `/admin`

---

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)
- An [OpenAI](https://platform.openai.com) API key with GPT-4o access

---

## Setup

### 1. Clone & install

```bash
git clone <repo-url>
cd kucing-sehat
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in all values:

```env
OPENAI_API_KEY=sk-...           # OpenAI API key (needs GPT-4o access)

SUPABASE_URL=https://xyz.supabase.co
SUPABASE_ANON_KEY=eyJ...        # From Supabase: Settings > API > anon/public
SUPABASE_SERVICE_KEY=eyJ...     # From Supabase: Settings > API > service_role (keep secret)

ADMIN_SECRET=change-me          # Any strong random string — protects /admin
                                # Generate one: openssl rand -hex 32

STORE_LAB_IMAGES=false          # Set true only if you want to keep original lab photos
                                # Default false saves significant Supabase Storage costs
```

### 3. Set up Supabase database

In your Supabase project, open **SQL Editor** and run the migrations **in order**:

1. `supabase/migrations/001_initial_schema.sql` — core tables (cats, labs, chat, subscriptions)
2. `supabase/migrations/002_admin_schema.sql` — admin tables (vouchers, pricing config)

Both files are idempotent — safe to re-run if something goes wrong.

### 4. Run the app

```bash
npm run dev
```

App runs at **http://localhost:3000**
Admin panel at **http://localhost:3000/admin**

---

## Admin Dashboard

Go to `/admin` and enter your `ADMIN_SECRET`.

| Tab | What you can do |
|-----|----------------|
| Dashboard | Overview stats (users, subs, labs) |
| Users | Reset/set passwords, ban/unban, grant subscriptions |
| Lab Reports | View all uploads, delete invalid ones, purge stored images |
| Subscriptions | View all, cancel, grant manually |
| Vouchers | Create discount codes (1–100%), set usage limits and expiry |
| Pricing | Toggle testing mode, set plan prices, set minimum price floor |

### Pricing & testing mode

| Scenario | How to set it up |
|----------|-----------------|
| Free for testing | Pricing → enable **Testing Mode** |
| Paid (IDR 35k min) | Testing mode off, min price = 35000 |
| 100% discount vouchers | Create a voucher with 100% discount; min price must be 0 for it to be truly free |

---

## API Overview

All endpoints under `/api/*` require `Authorization: Bearer <supabase-jwt>` except `/api/config`.
Admin endpoints under `/api/admin/*` require `Authorization: Bearer <ADMIN_SECRET>`.

```
GET    /api/config                        Public Supabase config for frontend
GET    /api/me                            Current user + subscription

GET    /api/cats                          List user's cats
POST   /api/cats                          Create cat
GET    /api/cats/:id                      Get cat
PUT    /api/cats/:id                      Update cat
DELETE /api/cats/:id                      Soft delete cat
POST   /api/cats/:id/photo                Upload cat photo

POST   /api/cats/:catId/labs/upload       Upload lab image → AI extraction
GET    /api/cats/:catId/labs              List lab results with values
GET    /api/labs/:labId                   Get single lab result
PUT    /api/labs/:labId/confirm           Confirm/edit extracted values

GET    /api/cats/:catId/trends            Trend data grouped by parameter
POST   /api/cats/:catId/trends/analyze    AI trend analysis (GPT-4o)

GET    /api/cats/:catId/purchases         List purchases
POST   /api/cats/:catId/purchases         Add purchase
DELETE /api/cats/:catId/purchases/:id     Delete purchase

POST   /api/chat                          Chat with Dr. Meow
  Body: { message, image?, cat_id?, session_id? }

POST   /api/subscribe                     Subscribe (handles testing mode + vouchers)
  Body: { plan, voucher_code? }
POST   /api/subscribe/validate-voucher    Check if a voucher code is valid
  Body: { code }
```

---

## Image Storage

Lab images are **not stored by default** (`STORE_LAB_IMAGES=false`). The image is sent to GPT-4o for extraction then discarded. This avoids Supabase Storage costs as lab uploads accumulate.

Set `STORE_LAB_IMAGES=true` if you want to keep original documents (e.g. for audit/review). The Admin → Lab Reports tab has a **Purge All Lab Images** button to bulk-delete any previously stored files while keeping the extracted values in the database.

Cat profile photos are always stored.

---

## Cost Estimates (per user/month)

| Component | Usage | Estimated cost |
|-----------|-------|---------------|
| GPT-4o (lab extraction) | ~2–5 uploads/month | ~IDR 200–500 |
| GPT-4o (trend analysis) | ~2–4 requests/month | ~IDR 100–200 |
| GPT-4o mini (chat) | ~50 messages/month | ~IDR 50–100 |
| Supabase | DB + Auth | Free tier covers ~500 users |
| **Total** | | **~IDR 350–800/user/month** |

Target retail price: **IDR 35,000–49,000/month** → ~80% gross margin.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js + TypeScript |
| Framework | Express.js |
| AI | OpenAI GPT-4o + GPT-4o mini |
| Database | Supabase (Postgres + Auth + Storage) |
| Frontend | Vanilla JS SPA (no framework, no build step) |
| Deployment | Railway / Vercel (planned) |

---

## Deployment (Railway)

1. Push to GitHub
2. Create a new Railway project → Deploy from GitHub
3. Add all environment variables from `.env`
4. Railway auto-detects Node.js and runs `npm start`

The app serves the static frontend and API from a single Express process — no separate CDN needed for MVP.

---

## Folder Structure

```
src/
  index.ts              Express app entry + route registration
  config.ts             Env validation, Supabase + OpenAI clients
  prompt.ts             Dr. Meow base system prompt
  middleware/
    auth.ts             Supabase JWT verification
    adminAuth.ts        Admin secret verification
  routes/
    cats.ts             Cat CRUD + photo upload
    labs.ts             Lab upload, list, confirm
    trends.ts           Trend data + AI analysis
    purchases.ts        Purchase log CRUD
    chat.ts             Dr. Meow chat with lab context injection
    subscribe.ts        Subscription with voucher + pricing logic
    admin.ts            All admin API routes
    user.ts             Current user + subscription
  services/
    openai.ts           Dr. Meow chat service
    labExtractor.ts     GPT-4o Vision lab extraction + flag computation
    trendAnalyzer.ts    Parameter grouping + GPT-4o trend analysis
    chatContext.ts      Builds lab history context for Dr. Meow
  db/queries/
    cats.ts             Cat DB queries
    labs.ts             Lab result + value queries
    purchases.ts        Purchase log queries
  types/
    db.ts               Database row types
    api.ts              Zod schemas + input types

public/
  index.html            Main SPA shell
  admin/
    index.html          Admin dashboard (self-contained)
  css/                  variables, base, components, pages
  js/
    app.js              Route registration
    router.js           Hash-based SPA router
    api.js              Fetch wrapper with auth
    state.js            Reactive state store
    supabase.js         Supabase client + auth
    pages/              login, cats, chat, lab-upload, lab-detail, trends, purchases
    components/         header, sidebar, modal, toast, cat-card

supabase/migrations/
  001_initial_schema.sql   Core tables + RLS + storage bucket
  002_admin_schema.sql     Vouchers + app_config
```
