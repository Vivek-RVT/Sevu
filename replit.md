# Workspace

## Overview

pnpm workspace monorepo using TypeScript. This is **Sevu** — a mobile-first SaaS web app for local businesses to manage customers, send WhatsApp reminders, and collect reviews.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS + Shadcn UI
- **Frontend extras**: Framer Motion, React Query, date-fns

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── sevu/               # Sevu React frontend (mobile-first PWA)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Sevu App Features

- **Onboarding**: 4-step onboarding for new businesses (name, category)
- **Dashboard**: Today's reminders, stats (total customers, reminders sent, reviews sent)
- **Customer Management**: Add/edit/delete customers with service types and dates
- **WhatsApp Reminders**: Click-to-send via `wa.me` links (no API)
- **Mark as Done**: Updates service dates, auto-calculates next service date
- **Review Requests**: Send review requests via WhatsApp after marking done
- **Settings**: Edit business info, custom reminder/review messages, review link

## Auth System

- **Access token**: JWT, 15-min lifetime, stored in `sevu_access` httpOnly cookie (cookie-only, no Bearer fallback)
- **Refresh token**: random 48-byte hex, SHA-256 hashed before DB storage, 7-day lifetime, stored in `sevu_refresh` httpOnly cookie
- **Sessions table**: `sessions` (UUID pk, userId, refreshTokenHash, deviceInfo, ipAddress, createdAt, expiresAt)
- **Max 3 active sessions per user**: oldest session auto-evicted on overflow
- **Token rotation**: every `/auth/refresh` call atomically deletes old session (DELETE…RETURNING) + issues new pair
- **Session binding**: UA mismatch on refresh → session revoked, 401 returned
- **OTP**: 6 digits, 5-min expiry, max 5 attempts, generated via `crypto.randomInt`
- **Rate limits**: login 5/min, OTP 5/10min, profile-track 30/min, global 100/min
- **IP ban**: 20 failed attempts in 15 min → 1-hour ban
- **Zod `.strict()`** on all schemas — unknown fields rejected
- **Input sanitization**: XSS, null bytes, script tags, prototype-pollution keys (`__proto__`, `constructor`, `prototype`) removed; recursion depth capped at 20
- **JWT secret**: fails fast at startup in production if `JWT_SECRET` is missing, too short, or equals the known insecure default
- **Business ownership**: `link-business` verifies business exists, is unclaimed, and requester doesn't already own a different business (prevents IDOR hijack)
- **One-business-per-user guard**: `POST /businesses` rejects requests from users who already own a business
- **Storage path traversal**: wildcard storage paths are normalised and reject `..` traversal sequences (including URL-encoded variants)
- **CORS**: origin-less requests blocked in production; `Authorization` header removed from allowed headers (no Bearer tokens)

## Database Schema

- `users` — Auth accounts (phone, passwordHash, businessId, phoneVerified)
- `sessions` — Auth sessions (UUID, userId, refreshTokenHash, deviceInfo, ipAddress, expiresAt)
- `refresh_tokens` — Hashed refresh tokens (userId, tokenHash, expiresAt)
- `businesses` — Business profiles (name, category, phone, reviewLink, messages)
- `business_images` — Uploaded image records (businessId, objectPath, type, isPublic) — new table for tracking profile/shop/work photos
- `customers` — Customer records with service dates, spend totals, balances
- `profiles` — Public directory profiles (profileImage, shopImage, workImages, analytics counters)
- `profile_reviews` — Customer reviews (rating, comment, reviewer info)
- `service_logs` — Transaction/income records (amount, paidAmount, paymentStatus, serviceDate, nextVisit)
- `reminder_logs` — Log of reminder sends
- `review_logs` — Log of review request sends

## API Routes

- `GET/POST /api/businesses` — Business CRUD
- `GET/PUT /api/businesses/:id` — Business CRUD
- `GET/POST /api/customers` — Customer CRUD
- `GET/PUT/DELETE /api/customers/:id` — Customer CRUD
- `POST /api/customers/:id/mark-done` — Mark service done
- `GET /api/dashboard` — Dashboard stats + today's reminders
- `GET/POST/PUT/DELETE /api/service-logs` — Income/service log CRUD
- `POST /api/reminders/log` — Log reminder sent
- `POST /api/reviews/log` — Log review sent
- `GET/POST /api/profiles` — Public profile directory
- `GET/PUT /api/profiles/:slug` — Profile CRUD
- `POST /api/profiles/:slug/track` — Track analytics events (view/call/whatsapp)
- `GET /api/profiles/:slug/analytics` — Profile analytics (auth required)
- `POST /api/profiles/:slug/reviews` — Submit a review
- `POST /api/storage/uploads/request-url` — Get presigned upload URL (auth required)
- `GET/POST/DELETE /api/storage/images` — Business image record CRUD (auth required)
- `GET /api/storage/profile-objects/*` — Serve public profile images (no auth — checks business_images table)
- `GET /api/storage/objects/*` — Serve private uploaded objects (auth + ownership required)
- `GET /api/storage/public-objects/*` — Serve public bucket assets (no auth)

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client + Zod schemas
- `pnpm --filter @workspace/db run push` — push schema changes to DB
