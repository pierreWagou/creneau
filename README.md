<div align="center">

![header](https://capsule-render.vercel.app/api?type=waving&height=220&color=0:89b4fa,50:89dceb,100:a6e3a1&text=cr%C3%A9neau&fontSize=60&fontColor=11111b&desc=shared%20parking%2C%20zero%20drift&descSize=18&descAlignY=62&descAlign=50&fontAlignY=38&animation=fadeIn&fontAlign=50)

![SvelteKit](https://img.shields.io/badge/SvelteKit-FF3E00?logo=svelte&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)

</div>

---

A shared parking spot booking system for apartment buildings. Residents pick a time slot, see real-time availability, and book in seconds.

## Overview

- **Full-day clock** — book any hour from `DAY_START` to `DAY_END`, single or multi-day (up to 7 days)
- **Real-time updates** — SSE broadcasts keep all connected users in sync
- **Visual availability** — calendar coloring (free/partial/full) and time capsule with booked ranges
- **Quick presets** — one-tap booking for morning, afternoon, evening, or full day
- **Multi-day continuity** — overnight gaps are bridged automatically; one booking can span days
- **Flat request flow** — new residents request access via `/request`, admin approves from the admin panel
- **Admin panel** — manage flats, spots, activation codes, and review access requests
- **Usage stats** — building-wide utilization metrics and per-flat leaderboard
- **Mobile-first** — responsive layout with bottom navigation

## Architecture

```
 ┌──────────────────────────────────────────────────────┐
 │                    SvelteKit App                      │
 ├────────────────────────────┬─────────────────────────┤
 │       Pages (SSR)          │       API Routes         │  routes
 │  /book /calendar /admin    │  /api/bookings           │
 │  /my-bookings /account     │  /api/bookings/[id]      │
 │  /stats                    │  /api/timeline            │
 │  /request (public)         │  /api/calendar-statuses   │
 │                            │  /api/events (SSE)        │
 │                            │  /api/account             │
 │                            │  /api/spots, /api/spots/* │
 │                            │  /api/requests (public)   │
 │                            │  /api/admin/flats/*       │
 │                            │  /api/admin/requests/*    │
 ├────────────────────────────┼─────────────────────────┤
 │      UI Components         │     Server Logic         │  lib
 │  shadcn-svelte (bits)      │  availability.ts         │
 │  event-calendar            │  bookings.ts             │
 │  sonner toasts             │  auth.ts / sse.ts        │
 │                            │  guards.ts / rate-limit  │
 ├────────────────────────────┴─────────────────────────┤
 │               Drizzle ORM + SQLite                   │  data
 └──────────────────────────────────────────────────────┘
```

## Structure

```
src/
├── lib/
│   ├── types.ts              # DAY_START/DAY_END constants, shared types
│   ├── constants.ts          # PIN lengths, booking limits, session duration
│   ├── utils/time.ts         # padH, getHourFromISO, formatDateISO, formatDuration
│   ├── utils/sse.ts          # createBookingSSE composable
│   ├── utils.ts              # cn() utility (clsx + tailwind-merge)
│   ├── server/
│   │   ├── availability.ts   # buildSpotTimeline(), getCalendarStatuses()
│   │   ├── bookings.ts       # CRUD + conflict detection
│   │   ├── auth.ts           # PIN hashing, session management
│   │   ├── guards.ts         # requireAuth(), requireAdmin() helpers
│   │   ├── sse.ts            # Server-Sent Events broadcaster
│   │   ├── rate-limit.ts     # In-memory rate limiter
│   │   └── db/
│   │       ├── schema.ts     # Drizzle schema (flat, spot, booking, session, request)
│   │       └── index.ts      # DB connection, migrations, session cleanup
│   └── components/
│       ├── ui/               # shadcn-svelte components
│       ├── qr-code.svelte   # QR code generator with logo
│       └── logo.svelte      # App logo
├── routes/
│   ├── (public)/
│   │   ├── login/            # PIN login
│   │   ├── activate/         # First-time activation via invitation link
│   │   ├── setup/            # First-time admin setup wizard
│   │   ├── request/          # Public flat access request form
│   │   └── about/            # Public about/landing page
│   ├── (app)/
│   │   ├── book/             # Booking page (date + time selection)
│   │   ├── calendar/         # Interactive week/day calendar view
│   │   ├── my-bookings/      # User's booking list
│   │   ├── stats/            # Usage stats & leaderboard
│   │   ├── account/          # Account settings (display name, PIN change)
│   │   └── admin/            # Admin: manage flats, spots, requests
│   │       └── guide/        # Admin guide
│   └── api/                  # REST endpoints + SSE
├── scripts/
│   ├── seed.ts               # Database seeding (generates drizzle/seed.db)
│   └── entrypoint.sh         # Docker entrypoint (copies seed DB on first boot)
├── drizzle/                  # SQL migrations
└── e2e/                      # Playwright end-to-end tests
```

## Getting Started

### Prerequisites

- [mise](https://mise.jdx.dev) — manages Node.js version and dev tasks
- [mprocs](https://github.com/pvolok/mprocs) — multi-process TUI (installed automatically by mise)

### Local development

```bash
# Install Node.js, dependencies, and Playwright browsers
mise run setup

# (Optional) Seed the database with demo data
mise run seed

# Start full dev environment (app + docs + test watcher)
mise run mprocs
```

On first run with an empty database, the app shows a setup wizard at `/setup` to create the admin account.

### Docker

```bash
docker compose up -d    # Pulls image from GHCR and runs on port 3000 (seeds DB on first boot)
```

**Production** persists data via bind mount (`/var/lib/creneau:/app/data`). **Preview** uses a named volume (ephemeral).

## Development

| Action | Command |
|---|---|
| Full dev environment | `mise run mprocs` |
| Dev server only | `mise run dev` |
| Docs server only | `mise run docs` |
| Seed database | `mise run seed` |
| Release patch | `mise run release:patch` |
| Release minor | `mise run release:minor` |
| Type check | `npm run check` |
| Lint & format | `npx biome check --write .` |
| Unit tests | `npm run test` |
| E2E tests | `mise run test:e2e` |
| E2E tests (UI) | `mise run test:e2e:ui` |
| Build | `npm run build` |
| Generate migration | `npm run db:generate` |
| Apply migrations | `npm run db:migrate` |

### Key concepts

**Availability computation** — the server computes `AvailableSlot[]` (ISO datetime ranges) by building a bookable timeline for the requested date range, subtracting existing bookings, and merging consecutive free days across overnight gaps.

**Calendar coloring** — builds a `SpotTimeline` per day and classifies each as `free` (no bookings), `partial` (some available slots remain), or `full` (no available slots) for the calendar grid.

**Multi-day bookings** — a booking spans multiple days as one continuous slot. The overnight gap (end-of-day → start-of-next-day) is bridged implicitly. The system finds a single `AvailableSlot` that covers the entire range.

**Real-time sync** — any booking creation, update, or cancellation broadcasts via SSE to all connected clients, which re-fetch availability and calendar statuses.

**Flat request workflow** — unauthenticated users submit a request at `/request` with their flat number and spot numbers. Admins review and approve from the admin panel, which creates the flat, binds spots, and generates an activation code. The resident then activates via the invitation link.

## Quick Reference

| Action | Command |
|---|---|
| Setup | `mise run setup` |
| Dev | `mise run mprocs` |
| Seed | `mise run seed` |
| Build | `npm run build` |
| Docker | `docker compose up -d` |

## License

Private — all rights reserved.
