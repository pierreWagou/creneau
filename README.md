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
 │                   SvelteKit App                   │
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
 │              Drizzle ORM + SQLite                 │  data
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
│   │   └── db/schema.ts      # Drizzle schema (flat, spot, booking, session)
│   └── components/ui/        # shadcn-svelte components
├── routes/
│   ├── (app)/book/           # Booking page (date + time selection)
│   ├── (app)/calendar/       # Interactive week/day calendar view
│   ├── (app)/my-bookings/    # User's booking list
│   ├── (app)/account/        # Account settings (display name, PIN change)
│   ├── (app)/admin/          # Admin: manage flats + spots
│   ├── (auth)/login/         # PIN login
│   ├── (auth)/activate/      # First-time activation
│   └── api/                  # REST endpoints + SSE
├── drizzle/                  # SQL migrations
└── scripts/setup.ts          # DB migration + seed
```

## Getting Started

### Prerequisites

- Node.js 22+
- npm

### Local development

```bash
npm install
npm run db:setup        # Creates SQLite DB, runs migrations, seeds admin flat
npm run dev             # Starts dev server at http://localhost:5173
```

On first run, `db:setup` prints an activation code. Go to `/activate` and use flat number `1A` with that code to create the admin account.

### Docker

```bash
docker compose up -d    # Builds and runs on port 3000
```

Data is persisted in a named volume (`creneau-data`).

## Development

| Action             | Command               |
| ------------------ | --------------------- |
| Dev server         | `npm run dev`         |
| Type check         | `npm run check`       |
| Build              | `npm run build`       |
| Preview prod       | `npm run preview`     |
| Generate migration | `npm run db:generate` |
| Run migrations     | `npm run db:migrate`  |
| Setup DB + seed    | `npm run db:setup`    |

### Key concepts

**Availability computation** — the server computes `AvailableSlot[]` (ISO datetime ranges) by building a bookable timeline for the requested date range, subtracting existing bookings, and merging consecutive free days across overnight gaps.

**Calendar coloring** — builds a `SpotTimeline` per day and classifies each as `free` (no bookings), `partial` (some available slots remain), or `full` (no available slots) for the calendar grid.

**Multi-day bookings** — a booking spans multiple days as one continuous slot. The overnight gap (end-of-day → start-of-next-day) is bridged implicitly. The system finds a single `AvailableSlot` that covers the entire range.

**Real-time sync** — any booking creation or cancellation broadcasts via SSE to all connected clients, which re-fetch availability and calendar statuses.

## Quick Reference

| Action     | Command                |
| ---------- | ---------------------- |
| Install    | `npm install`          |
| Setup DB   | `npm run db:setup`     |
| Dev        | `npm run dev`          |
| Build      | `npm run build`        |
| Type check | `npm run check`        |
| Docker     | `docker compose up -d` |

## License

Private — all rights reserved.
