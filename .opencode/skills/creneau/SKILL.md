---
name: creneau
description: 'Load this skill when working on the creneau parking booking application — booking logic, availability computation, UI components, or API routes.'
---

## Project context

Creneau is a shared parking spot booking app for apartment buildings. See the project README for overview, architecture diagram, and getting started instructions.

## Tech stack

| Layer     | Technology                                 |
| --------- | ------------------------------------------ |
| Framework | SvelteKit (Svelte 5 with runes)            |
| Language  | TypeScript                                 |
| Database  | SQLite via @libsql/client + Drizzle ORM    |
| UI        | Tailwind CSS v4 + shadcn-svelte (bits-ui)  |
| Calendar  | @event-calendar/core                       |
| Auth      | Session-based, @node-rs/argon2 PIN hashing |
| Real-time | Server-Sent Events (SSE)                   |
| Dates     | date-fns + @internationalized/date         |

## Key files

| File                                                    | Purpose                                                                                                                                      |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/types.ts`                                      | `SessionFlat`, `DAY_START`/`DAY_END` constants, `AvailableSlot`, `CalendarDayStatus`, `BookingWithFlat`, `SpotTimeline` types, `getTimelineStatus()` helper |
| `src/lib/server/availability.ts`                        | `buildSpotTimeline()` — pure computation (no DB); `getCalendarStatuses()` — calendar coloring (calls DB)                                     |
| `src/lib/server/bookings.ts`                            | CRUD: `createBooking()`, `getBookingsInRange()`, `getBookingsByFlat()`, `cancelBooking()`, `updateBooking()`                                 |
| `src/lib/server/sse.ts`                                 | SSE broadcaster singleton                                                                                                                    |
| `src/lib/server/auth.ts`                                | PIN hashing, session create/validate, `setSessionCookie()`                                                                                   |
| `src/lib/server/db/schema.ts`                           | Drizzle schema: flat, flatEmail, flatPhone, spot, booking, session, request, requestSpot, requestEmail, requestPhone |
| `src/lib/server/db/index.ts`                            | DB connection singleton (libsql + Drizzle), runs migrations on startup, cleans expired sessions                                              |
| `src/lib/utils/time.ts`                                 | `TIME_BLOCKS`, `padH()`, `getHourFromISO()`, `formatDateISO()`, `formatDuration()`                                                            |
| `src/lib/utils.ts`                                      | `cn()` utility (clsx + tailwind-merge)                                                                                                       |
| `src/lib/server/contacts.ts`                            | Email/phone validation + CRUD helpers (`validateEmails`, `validatePhones`, `getFlatEmails`, etc.)                                              |
| `src/lib/server/guards.ts`                              | `requireAuth()`, `requireAdmin()` route guards                                                                                               |
| `src/lib/utils/phone.ts`                                | `displayPhone()`, `formatPhone()` phone formatting utilities                                                                                 |
| `src/routes/(app)/book/+page.svelte`                    | Booking page (main UX)                                                                                                                       |
| `src/routes/(app)/calendar/+page.svelte`                | Calendar view (@event-calendar) with event popover                                                                                           |
| `src/routes/(app)/my-bookings/+page.svelte`             | User's booking list with SSE updates                                                                                                         |
| `src/routes/api/timeline/+server.ts`                    | `GET` → returns `SpotTimeline` (bookings + available slots) for date range + spot                                                            |
| `src/routes/api/calendar-statuses/+server.ts`           | `GET` → returns `CalendarDayStatus[]` for calendar coloring                                                                                  |
| `src/routes/api/bookings/+server.ts`                    | `POST` create booking, broadcasts SSE                                                                                                        |
| `src/routes/api/bookings/[id]/+server.ts`               | `PATCH` update booking time (drag/drop), `DELETE` cancel a booking                                                                           |
| `src/routes/api/spots/+server.ts`                       | `POST` parking spots (admin only)                                                                                                            |
| `src/routes/api/spots/[number]/+server.ts`              | `PATCH` update description / `DELETE` spot (admin only)                                                                                      |
| `src/routes/api/admin/flats/+server.ts`                 | `GET`/`POST` flats (admin only, POST accepts `spotNumbers`)                                                                                  |
| `src/routes/api/admin/flats/[number]/+server.ts`        | `PATCH`/`DELETE` specific flat (admin only)                                                                                                  |
| `src/routes/api/admin/flats/[number]/activation/+server.ts` | `POST` generate / `DELETE` revoke activation code                                                                                        |
| `src/routes/api/admin/flats/[number]/reset/+server.ts`  | `POST` reset an active flat (deactivate, clear PIN/sessions)                                                                                 |
| `src/routes/api/admin/requests/+server.ts`              | `GET` list pending requests (admin only)                                                                                                     |
| `src/routes/api/admin/requests/[id]/+server.ts`         | `POST` approve request (creates flat + spots) / `PATCH` reject                                                                              |
| `src/routes/api/requests/+server.ts`                    | `POST` submit a flat access request (public, no auth)                                                                                        |
| `src/routes/api/health/+server.ts`                      | `GET` health check (DB connectivity, no auth required)                                                                                       |
| `src/routes/api/auth/login/+server.ts`                  | `POST` login with flat number + PIN                                                                                                          |
| `src/routes/api/auth/activate/+server.ts`               | `POST` activate a flat with activation code                                                                                                  |
| `src/routes/api/auth/setup/+server.ts`                  | `POST` first-time admin setup (only works when no flats exist)                                                                               |
| `src/routes/api/auth/logout/+server.ts`                 | `POST` logout (clear session)                                                                                                                |
| `src/routes/api/events/+server.ts`                      | SSE stream endpoint                                                                                                                          |
| `src/routes/(auth)/setup/+page.svelte`                  | First-time setup wizard (creates admin account)                                                                                              |
| `src/routes/(app)/stats/+page.svelte`                   | Usage stats: personal metrics + building leaderboard + utilization                                                                           |
| `src/routes/(app)/account/+page.svelte`                 | Account settings (display name, PIN change)                                                                                                  |
| `src/routes/api/account/+server.ts`                     | `PATCH` update display name, `POST` change PIN                                                                                               |
| `src/lib/constants.ts`                                  | Shared constants (PIN lengths, display name max length, calendar lookahead, activation code TTL, max booking hours)                           |
| `src/lib/server/rate-limit.ts`                          | In-memory rate limiting for auth endpoints (login, activation)                                                                               |

## Availability computation — how it works

The core function `buildSpotTimeline(bookings, from, to)` in `src/lib/server/availability.ts` is a **pure function** (no DB access). It takes pre-fetched bookings and a date range, returns a `SpotTimeline`:

```typescript
interface SpotTimeline {
	bookings: BookingWithFlat[]; // who booked what
	available: AvailableSlot[]; // free time ranges
}
```

**Steps:**

1. **Builds a bookable timeline** — one `[DAY_START:00, DAY_END:00]` interval per day in the range
2. **Subtracts bookings** — splits intervals at booking boundaries
3. **Merges consecutive days** — consecutive free days (ending at DAY_END, starting at DAY_START next day) merge into one continuous `AvailableSlot`

An `AvailableSlot` can span multiple days. With DAY_START=0 and DAY_END=24, consecutive free days are always merged (no gap between them).

### Day status classification

`getTimelineStatus(timeline)` in `src/lib/types.ts`:

- `timeline.bookings.length === 0` → `'free'`
- `timeline.available.length === 0` → `'full'`
- else → `'partial'`

### Two concerns, one model

| Concern           | Endpoint                     | Returns                               | Used for                                              |
| ----------------- | ---------------------------- | ------------------------------------- | ----------------------------------------------------- |
| Calendar coloring | `GET /api/calendar-statuses` | `CalendarDayStatus[]`                 | Color-coding date picker cells                        |
| Booking form      | `GET /api/timeline`          | `SpotTimeline` (bookings + available) | Hour selection, capsule display, multi-day validation |

Both use `buildSpotTimeline` internally. Calendar statuses call it per-day to classify. The timeline endpoint returns the full object to the client.

Calendar statuses are loaded server-side on page load (3 months lookahead) and also re-fetched client-side via `GET /api/calendar-statuses` when the user changes the selected spot. The timeline is fetched on-demand when the user selects a date.

### Multi-day booking logic

- A multi-day booking is valid if there exists ONE `AvailableSlot` spanning from the start date to the end date
- Client checks: `slots.find(s => s.start <= endOfStartDay && s.end >= startOfEndDay)`
- Start hours = slot's start on first day to DAY_END
- End hours = DAY_START to slot's end on last day

## Client-side patterns

### Svelte 5 runes

The project uses Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`). Key patterns:

- `let foo = $state(initialValue)` — reactive state
- `let bar = $derived(expression)` — computed value
- `$effect(() => { ... })` — side effect that auto-tracks dependencies
- `let { data } = $props()` — component props (page data from server load)

### Important: `{@const}` placement

Svelte 5 restricts `{@const}` to direct children of `{#if}`, `{#each}`, `{:else}`, etc. It CANNOT be inside a plain `<div>`. If you need a computed value in the template, use a `$derived` in the script block instead.

### SSE pattern

```typescript
onMount(() => {
	eventSource = new EventSource('/api/events');
	eventSource.addEventListener('booking_created', () => {
		/* re-fetch */
	});
	eventSource.addEventListener('booking_cancelled', () => {
		/* re-fetch */
	});
	eventSource.addEventListener('booking_updated', () => {
		/* re-fetch */
	});
});
onDestroy(() => {
	eventSource?.close();
});
```

### Pre-filling from URL params

The booking page accepts URL params: `?date=`, `?endDate=`, `?startHour=`, `?endHour=`, `?spot=`. These are passed from the calendar view when a user clicks/selects a time range.

## Database schema

Ten tables (SQLite, WAL mode). All use **natural keys** (no artificial IDs for spot/flat):

| Table           | Key fields                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `flat`          | number (PK), status (inactive/active), activationCode, activationCodeExpiresAt, displayName, pinHash, isAdmin, activatedAt, createdAt |
| `flat_email`    | flatNumber (FK→flat, CASCADE), email — composite PK (flatNumber + email)                                                       |
| `flat_phone`    | flatNumber (FK→flat, CASCADE), phone — composite PK (flatNumber + phone)                                                       |
| `spot`          | number (PK), flatNumber (FK→flat, nullable, SET NULL on delete), description, createdAt                                          |
| `booking`       | id (autoincrement PK), spotNumber (FK→spot), flatNumber (FK→flat), startTime, endTime, note, createdAt                         |
| `session`       | id (UUID PK), flatNumber (FK→flat), expiresAt, createdAt                                                                        |
| `request`       | id (autoincrement PK), flatNumber, requesterName, status (pending/approved/rejected), reviewedBy, reviewedAt, createdAt         |
| `request_spot`  | requestId (FK→request, CASCADE), spotNumber — composite PK                                                                      |
| `request_email` | requestId (FK→request, CASCADE), email — composite PK                                                                           |
| `request_phone` | requestId (FK→request, CASCADE), phone — composite PK                                                                           |

Bookings store full ISO datetime strings (e.g., `"2026-05-06T14:00:00"`).

## Flat lifecycle

| State       | French      | `status`       | `activationCode`            | Description                                          |
| ----------- | ----------- | -------------- | --------------------------- | ---------------------------------------------------- |
| Request     | Demande     | `'request'`    | `null`                      | Incoming request, spots bound, waiting for admin     |
| Inactive    | Inactif     | `'inactive'`   | `null`                      | Approved/admin-created, waiting for activation code  |
| Pending     | En attente  | `'inactive'`   | Has value, TTL not elapsed  | Code generated, waiting for resident to activate     |
| Expired     | Expiré      | `'inactive'`   | Has value, TTL elapsed      | Code generated but it expired before activation      |
| Active      | Actif       | `'active'`     | `null`                      | Resident has activated and set their PIN             |

Transitions: Request → Inactive (admin approves) → Pending (admin generates code) → Active (resident activates) → Inactive (admin resets)
Also: Pending → Expired (code TTL elapses) → Inactive (admin resets)
Request → deleted (admin rejects, spots unbound)

## Constants

Defined in `src/lib/types.ts`, imported everywhere:

```typescript
export const DAY_START = 0; // midnight
export const DAY_END = 24; // end of day
```

These define the bookable window. Changing them adjusts the entire system (calendar view, availability computation, hour dropdowns, presets).

Shared validation/config constants defined in `src/lib/constants.ts`:

```typescript
export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 6;
export const DISPLAY_NAME_MAX_LENGTH = 50;
export const CALENDAR_LOOKAHEAD_MONTHS = 3;
export const ACTIVATION_CODE_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_BOOKING_HOURS = 168;
export const ACTIVATION_CODE_LENGTH = 4;
```

## CI/CD, Testing & Hooks

- **Tooling**: Biome (format + lint in one tool), Vitest (tests), Husky (git hooks)
- **CI** (`.github/workflows/ci.yml`): `biome ci` → `svelte-check` → `vitest run` → `vite build` → `playwright test` (E2E)
- **CD** (`.github/workflows/cd.yml`): Builds Docker image on CI success, pushes to `ghcr.io`
- **Pre-commit** (`.husky/pre-commit`): Runs `npx biome check --write .` → `git add -u` → `npm run check`
- **Tests**: Vitest, config in `vite.config.ts`, test files colocated (`*.test.ts`)
- **ON DELETE CASCADE**: All FKs (`booking.spotNumber`, `booking.flatNumber`, `session.flatNumber`, `request_spot.requestId`, `request_email.requestId`, `request_phone.requestId`) cascade on delete

## Common tasks

### Adding a new time preset

Edit `src/lib/utils/time.ts` — add an entry to `TIME_BLOCKS`. The UI automatically picks it up.

### Changing bookable hours

Edit `DAY_START` / `DAY_END` in `src/lib/types.ts`. Everything else adjusts automatically.

### Adding a new API endpoint

1. Create `src/routes/api/<name>/+server.ts`
2. Check `locals.flat` for auth (return 401 if not authenticated, 403 if not admin for admin-only endpoints)
3. If it modifies bookings, call `sseManager.broadcast('booking_created' | 'booking_cancelled' | 'booking_updated', data)`
4. Spot reassignment: `PATCH /api/admin/flats/:number` accepts `force: true` to confirm a spot conflict swap; returns `409` with `conflicts` array if unforced

### Running migrations

```bash
npm run db:generate    # After editing schema.ts
npm run db:migrate     # Apply to local DB
```

## Gotchas

- **Timezone safety**: Always use `'T12:00:00'` (not `'T00:00:00'`) when creating `Date` objects for day iteration. `formatDateISO()` in `$lib/utils/time.ts` applies the noon trick internally.
- **Pre-existing type errors**: The shadcn-svelte range-calendar component (`src/lib/components/ui/range-calendar/range-calendar.svelte`) may have TS errors from `bits-ui` type complexity. These are harmless and can be ignored.
- **Shared utilities**: `padH()`, `getHourFromISO()`, `formatDateISO()` live in `$lib/utils/time.ts`. Always import from there — do NOT create local duplicates.
- **API error messages**: All user-facing errors are in French. Keep this consistent.
- **Presets (Matin, Après-midi, Soirée)**: These are UX shortcuts that auto-select hour ranges. They do NOT persist any field — just set startHour/endHour.
- **Natural keys**: `spot` and `flat` tables use `number` (text) as primary key. No artificial integer IDs. Booking references them via `spotNumber`/`flatNumber` text FKs.
- **Setup wizard**: On first boot (zero flats in DB), the app shows `/setup` where the first admin account is created. No seed script needed.

## Button Rules

| Pattern | Variant | Use case |
|---------|---------|----------|
| A. Solid bg | `default` | Primary submit, main CTAs, add buttons (blue) |
| B. Soft red bg | `destructive` | Delete, cancel, revoke, reject (AlertDialog confirmations) |
| C. Border + hover | `outline` | Secondary actions, toggle, modify, copy |
| D. No bg + hover | `ghost` | Inline remove icons, nav links, view details |
| E. Custom color | `ghost/outline` + manual | Symmetric action pairs (approve/reject in list rows) |

- **List rows** → `ghost` (lightweight)
- **Dialog actions** → `outline` (prominent, consistent with other dialog buttons)
- Inline trash icons: always `variant="ghost" size="icon-sm"`
- Colored text on hover: add `hover:text-{color}` to override ghost/outline's `hover:text-foreground`
- Hover bg: use `hover:!bg-{color}/10` (important prefix overrides variant's `hover:bg-muted`)

## Catppuccin Palette

CSS variables in `src/app.css` `@layer base` mapped to Tailwind via `--color-*`:

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `primary` | Blue `#1e66f5` | `#89b4fa` | Buttons, links, focus |
| `secondary` | Surface0 `#ccd0da` | `#313244` | Secondary UI |
| `accent` | Lavender `#7287fd` | `#b4befe` | Accent, purple substitute |
| `destructive` | Red `#d20f39` | `#f38ba8` | Delete, cancel, errors |
| `success` | Green `#40a02b` | `#a6e3a1` | Approve, active |
| `warning` | Yellow `#df8e1d` | `#f9e2af` | Warnings |
| `info` | Teal `#179299` | `#94e2d5` | Informational |
| `booking-busy` | Peach `#fe640b` | `#fab387` | Bookings, pending |

Use `text-success`, `bg-success/10`, `border-success/30`, etc. Never use hardcoded Tailwind colors (`green-600`, `red-500`).
