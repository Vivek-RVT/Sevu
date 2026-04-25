# Sevu — Project Information

> **Sevu** is a mobile-first SaaS PWA (Progressive Web App) for Indian local-business owners
> (electricians, salons, plumbers, mechanics, RO-service guys, etc.) to:
> manage customers, log services & payments, send WhatsApp reminders, collect reviews,
> and run a public business profile with posts of their work.

---

## 1. Tech Stack

| Layer            | Tech |
|------------------|------|
| Repo style       | pnpm monorepo workspaces |
| Language         | TypeScript 5.9 |
| Runtime          | Node.js 24 |
| Backend          | Express 5 (built with esbuild → CJS bundle) |
| Database         | PostgreSQL + Drizzle ORM |
| Validation       | Zod (`zod/v4`) + `drizzle-zod` |
| API codegen      | Orval (from OpenAPI spec → React Query hooks + Zod) |
| Frontend         | React + Vite + Tailwind CSS + Shadcn UI |
| Frontend extras  | Framer Motion, TanStack React Query, date-fns, Wouter (routing), i18next |
| File storage     | Replit Object Storage (via `@workspace/object-storage-web`) |
| Auth             | Cookie-based JWT (access) + rotating refresh-token sessions |
| PWA              | Vite PWA plugin (service worker + manifest) |

---

## 2. Repo Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/              # Express API (port 8080 in dev)
│   │   └── src/
│   │       ├── routes/          # Express routers (auth, businesses, customers, …)
│   │       ├── middleware/      # auth, validate, rate-limit
│   │       ├── lib/             # cache, plans, mailer, etc.
│   │       └── validators/      # Zod schemas for request validation
│   └── sevu/                    # React + Vite PWA frontend (port 5000 in dev)
│       └── src/
│           ├── pages/           # Route pages (dashboard, customers, …, upgrade)
│           ├── components/      # Shared components + layout
│           ├── contexts/        # AuthContext
│           ├── lib/             # store, plans, utils
│           └── hooks/
├── lib/
│   ├── api-spec/                # OpenAPI spec + Orval config
│   ├── api-client-react/        # Auto-generated React Query hooks
│   ├── api-zod/                 # Auto-generated Zod schemas
│   ├── db/                      # Drizzle schema + DB connection
│   └── object-storage-web/      # Object-storage helper for the web app
├── scripts/                     # Utility scripts (DB push helpers, etc.)
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

---

## 3. Running the Project

Two workflows run in parallel during development:

| Workflow            | Command                                                                  | Port |
|---------------------|--------------------------------------------------------------------------|------|
| `API Server`        | `PORT=8080 pnpm --filter @workspace/api-server run dev`                  | 8080 |
| `Start application` | `PORT=5000 BASE_PATH=/ pnpm --filter @workspace/sevu run dev`            | 5000 |

Frontend proxies `/api/*` to the API server.

### Useful Commands

| Goal                       | Command |
|----------------------------|---------|
| Push DB schema             | `pnpm --filter @workspace/db push` |
| Re-generate API client     | `pnpm --filter @workspace/api-spec run codegen` |
| Type-check the frontend    | `pnpm --filter @workspace/sevu exec tsc --noEmit` |
| Build the API              | `pnpm --filter @workspace/api-server run build` |

---

## 4. Database Schema (12 tables)

| Table             | Purpose |
|-------------------|---------|
| `businesses`      | The business profile (name, category, phone, address, **plan**, default messages) |
| `users`           | Login accounts; each user belongs to one business |
| `sessions`        | Active login sessions (max 3 per user) |
| `refresh_tokens`  | Rotating refresh tokens (SHA-256 hashed) |
| `customers`       | Customer list per business |
| `service_logs`    | Each service done for a customer + amount + paid/due |
| `reminder_logs`   | History of WhatsApp reminders sent |
| `review_logs`     | History of review requests sent |
| `business_images` | All uploaded images (profile photo, banner, logo, work, post) typed via `type` column |
| `profiles`        | Public business profile pages (slug, bio, services, work gallery, view counts) |
| `profile_reviews` | Customer-submitted reviews on the public profile |
| `profile_posts`   | Carousel posts (1 or 2 images + caption) |

`businesses.plan` defaults to `"starter"` and drives the post limits below.

### Image Types stored in `business_images.type`

- `profile`  — round profile photo
- `banner`   — wide cover banner on the public page
- `logo`     — business logo
- `work`     — gallery photos of finished work
- `post`     — photos used inside carousel posts
- `general`  — fallback / misc

---

## 5. Plans & Pricing

Stored in `businesses.plan` — defaults to `starter`. Limits enforced server-side.

| Plan       | Launch (50% off) | Regular | Posts | WhatsApp        | Highlights |
|------------|------------------|---------|-------|-----------------|------------|
| **Starter**| ₹49 /mo          | ₹99     | 10    | —               | Customer mgmt, service logs, payment due, in-app reminders, basic public profile |
| **Growth** | ₹99 /mo          | ₹199    | 15    | 30 reminders/mo | + SEO profile, review collection, full analytics, digital visiting card, due-payment alerts |
| **Pro**    | ₹149 /mo         | ₹299    | 20    | 100 reminders/mo| + Verified Pro badge, priority listing, "Near Me" boost, service-log PDF export, follow-up messages |

- Plan config (frontend UI):  `artifacts/sevu/src/lib/plans.ts`
- Plan config (server limits): `artifacts/api-server/src/lib/plans.ts`
- Pricing page:                `/app/upgrade`
- Server enforces post limit in `POST /api/profiles/:slug/posts` → returns
  `{ error: "POST_LIMIT_REACHED", message, plan, maxPosts, currentCount }` (HTTP 403)

---

## 6. App Routes (Frontend)

### Public
| Path                  | Page |
|-----------------------|------|
| `/`                   | Marketing homepage / redirects to dashboard if logged in |
| `/profile`            | Public business directory |
| `/profile/:slug`      | Public business profile (reviews, work, posts) |
| `/profile/login`      | Reviewer login (for leaving reviews) |

### Authenticated app (`/app/*`)
| Path                       | Page |
|----------------------------|------|
| `/app/login` `/signup` `/onboard` | Onboarding / Login |
| `/app/dashboard`           | Today's reminders + KPIs |
| `/app/customers`           | Customer list |
| `/app/customers/new`       | Add customer |
| `/app/customers/:id`       | Customer detail (services, payments, reminders) |
| `/app/services`            | All service logs |
| `/app/analytics`           | Profile editor + Posts manager + analytics |
| `/app/settings`            | Business settings |
| `/app/upgrade`             | Pricing / plan upgrade page |

---

## 7. API Endpoints (highlights)

Mounted under `/api/*` (see `artifacts/api-server/src/routes/index.ts`).

### Auth (`/api/auth`)
- `POST /signup-otp`, `POST /signup-verify`
- `POST /login-otp`,  `POST /login-verify`
- `POST /forgot-otp`, `POST /forgot-verify`
- `POST /refresh`,    `POST /logout`
- `GET  /me`,         `GET  /sessions`

### Businesses (`/api/businesses`) — auth required
- `GET /login?phone=...`  (lookup)
- `GET /:id`, `POST /`, `PUT /:id`

### Customers (`/api/customers`) — auth required
- `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`
- `POST /:id/reminder-sent`

### Service Logs (`/api/service-logs`) — auth required
- `GET /`, `POST /`, `PUT /:id`, `DELETE /:id`

### Dashboard (`/api/dashboard`) — auth required
- `GET /`  (today's reminders + KPIs)

### Reminders (`/api/reminders`) — auth required
- `POST /reminder`, `POST /review`

### Profiles (`/api/profiles`)
- `GET  /`, `POST /` (list + create)
- `GET  /:slug` (public profile)
- `PUT  /:slug` (update — auth + ownership)
- `POST /:slug/track` (view/call/whatsapp tracking)
- `GET  /:slug/analytics` (auth + ownership)
- `POST /:slug/reviews` (reviewer-auth)
- `GET  /:slug/posts` (public)
- `POST /:slug/posts` (auth + ownership + plan-limit)
- `DELETE /:slug/posts/:id` (auth + ownership)

### Storage (`/api/storage`)
- `POST /upload-url` — get a presigned upload URL
- `POST /images` — record an uploaded image
- `GET /images`, `DELETE /images/:id`
- `GET /public-objects/*`, `GET /profile-objects/*`, `GET /objects/*` (auth)

---

## 8. Auth System (summary)

- **Access token**: JWT, 15-min lifetime, in `sevu_access` httpOnly cookie (cookie-only, no Bearer fallback)
- **Refresh token**: random 48-byte hex, **SHA-256 hashed before DB**, 7-day lifetime, in `sevu_refresh` httpOnly cookie
- **Sessions**: max 3 active per user; oldest auto-evicted on overflow
- **Rotation**: every `/auth/refresh` atomically deletes old session + issues new pair
- **Session binding**: User-Agent mismatch on refresh ⇒ session revoked + 401
- **OTP**: 6 digits, 5-min expiry, max 5 attempts (`crypto.randomInt`)
- **Rate limits**: login 5/min, OTP 5/10min, profile-track 30/min, global 100/min
- **IP ban**: 20 failed attempts in 15 min → 1-hour ban

---

## 9. Feature List

### Core App
- 4-step onboarding (name, category, …)
- Dashboard with today's reminders + KPI tiles
- Add / edit / delete customers with service types & dates
- Service logging with payment status + due tracking
- "Mark as Done" auto-calculates next service date
- WhatsApp reminders & review requests via `wa.me` links (no API)
- Settings: edit business info, custom reminder/review templates, review link
- Multi-language (i18next) + dark mode

### Profile (public page)
- Public profile at `/profile/:slug` with bio, services, work gallery, reviews
- Profile + banner + logo image upload
- View / call / WhatsApp click tracking
- Reviewer login for collecting reviews
- **Posts** — carousel posts of work (1–2 images + caption)
  - Owner manages from Analytics → Profile tab (with usage indicator + Upgrade CTA)
  - Customers see them as a swipeable carousel with dot indicators + lightbox

### Plans & Monetization
- 3-tier pricing (Starter / Growth / Pro) at `/app/upgrade`
- Server-enforced post limits per plan (10 / 15 / 20)
- "Limit reached" UI + Upgrade button shown when at cap

### Infra & UX
- PWA (installable, offline-aware via service worker)
- Offline sync bridge for queued mutations
- Network-status indicator + PWA update prompt
- Toaster notifications (Shadcn Sonner)

---

## 10. Important Files Map

| Concern                            | File |
|------------------------------------|------|
| Business schema (incl. `plan`)     | `lib/db/src/schema/businesses.ts` |
| Profile posts schema               | `lib/db/src/schema/profiles.ts` (`profilePostsTable`) |
| Image storage records              | `lib/db/src/schema/business-images.ts` |
| Server post-limit enforcement      | `artifacts/api-server/src/routes/profiles.ts` |
| Server plan limits                 | `artifacts/api-server/src/lib/plans.ts` |
| Frontend plans config              | `artifacts/sevu/src/lib/plans.ts` |
| Owner Posts UI + usage indicator   | `artifacts/sevu/src/pages/analytics.tsx` (Profile tab) |
| Public Posts carousel              | `artifacts/sevu/src/pages/profile-detail.tsx` |
| Pricing / Upgrade page             | `artifacts/sevu/src/pages/upgrade.tsx` |
| App routes                         | `artifacts/sevu/src/App.tsx` |
| Mobile bottom nav + sidebar        | `artifacts/sevu/src/components/layout/MobileLayout.tsx` |
| Storage routes                     | `artifacts/api-server/src/routes/storage.ts` |

---

## 11. Environment Variables

| Var            | Purpose |
|----------------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET`   | JWT signing secret (must be set before deploy) |
| `PORT`         | Port for each artifact's dev server |
| `BASE_PATH`    | Frontend base path (default `/`) |

Object Storage credentials are wired automatically via the Replit Object Storage integration.

---

## 12. Deployment

- Both artifacts deploy together as a single Replit deployment.
- API serves `/api/*`; frontend serves everything else (with SPA fallback to `index.html`).
- Set `JWT_SECRET` in production secrets before publishing.
- Run `pnpm --filter @workspace/db push` on first deploy to apply the schema.
