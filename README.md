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

- **Full-day clock** — book any hour from 00:00 to 24:00, single or multi-day
- **Real-time updates** — SSE broadcasts keep all connected users in sync
- **Visual availability** — calendar coloring (free/partial/full) and time capsule with booked ranges
- **Quick presets** — one-tap booking for morning, afternoon, evening, or full day
- **Multi-day continuity** — overnight gaps are bridged automatically; one booking can span days
- **Admin panel** — manage flats, activation codes, parking slots
- **Mobile-first** — responsive layout with bottom navigation

## Architecture

```
 ┌──────────────────────────────────────────────────┐
 │                   SvelteKit App                  │
 ├────────────────────────┬─────────────────────────┤
 │      Pages (SSR)       │      API Routes         │  routes
 │  /book /calendar /admin│  /api/timeline          │
 │  /my-bookings /account │  /api/calendar-statuses │
 │                        │  /api/bookings          │
 │                        │  /api/events (SSE)      │
 ├────────────────────────┼─────────────────────────┤
 │     UI Components      │    Server Logic         │  lib
 │  shadcn-svelte (bits)  │  availability.ts        │
 │  range-calendar        │  bookings.ts            │
 │  sonner toasts         │  auth.ts / sse.ts       │
 ├────────────────────────┴─────────────────────────┤
 │              Drizzle ORM + SQLite                │  data
 └──────────────────────────────────────────────────┘
```

## Structure

```
src/
├── lib/
│   ├── types.ts              # DAY_START/DAY_END constants, shared types
│   ├── utils/time.ts         # Time block presets (matin, après-midi, soirée)
│   ├── server/
│   │   ├── availability.ts   # buildSpotTimeline(), getCalendarStatuses()
│   │   ├── bookings.ts       # CRUD + conflict detection
│   │   ├── auth.ts           # PIN hashing, session management
│   │   ├── sse.ts            # Server-Sent Events broadcaster
│   │   ├── rate-limit.ts     # In-memory rate limiter
│   │   └── db/schema.ts      # Drizzle schema (flat, spot, booking, session)
│   └── components/ui/        # shadcn-svelte components
├── routes/
│   ├── (app)/book/           # Booking page (date + time selection)
│   ├── (app)/calendar/       # Interactive week/day calendar view
│   ├── (app)/my-bookings/    # User's booking list
│   ├── (app)/stats/          # Usage stats & leaderboard
│   ├── (app)/account/        # Account settings (display name, PIN change)
│   ├── (app)/admin/          # Admin: manage flats + spots
│   ├── (auth)/login/         # PIN login
│   ├── (auth)/activate/      # First-time activation
│   ├── (auth)/setup/         # First-time admin setup wizard
│   └── api/                  # REST endpoints + SSE
drizzle/                      # SQL migrations
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

Data is persisted in a named volume (`creneau-data`).

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
| Lint | `npm run lint` |
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

**Real-time sync** — any booking creation or cancellation broadcasts via SSE to all connected clients, which re-fetch availability and calendar statuses.

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
