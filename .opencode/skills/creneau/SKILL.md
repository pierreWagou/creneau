---
name: creneau
description: "Load this skill when working on the creneau parking booking application — booking logic, availability computation, UI components, or API routes."
---

## Project context

Creneau is a shared parking spot booking app for apartment buildings. See the project README for overview, architecture diagram, and getting started instructions.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | SvelteKit (Svelte 5 with runes) |
| Language | TypeScript |
| Database | SQLite via better-sqlite3 + Drizzle ORM |
| UI | Tailwind CSS v4 + shadcn-svelte (bits-ui) |
| Calendar | @event-calendar/core |
| Auth | Session-based, argon2 PIN hashing |
| Real-time | Server-Sent Events (SSE) |
| Dates | date-fns + @internationalized/date |

## Key files

| File | Purpose |
|------|---------|
| `src/lib/types.ts` | `DAY_START`/`DAY_END` constants, `AvailableSlot`, `CalendarDayStatus`, `BookingWithFlat` types |
| `src/lib/server/availability.ts` | `getAvailableSlots()` — core algorithm, `getCalendarStatuses()` — calendar coloring |
| `src/lib/server/bookings.ts` | CRUD, `hasConflict()` overlap detection, `cancelBooking()` |
| `src/lib/server/sse.ts` | SSE broadcaster singleton |
| `src/lib/server/auth.ts` | PIN hashing, session create/validate, shared constants (`SESSION_COOKIE_NAME`, `SESSION_MAX_AGE`, `PIN_MIN_LENGTH`, `PIN_MAX_LENGTH`) |
| `src/lib/server/db/schema.ts` | Drizzle schema: flat, spot, booking, session |
| `src/lib/utils/time.ts` | `TIME_BLOCKS`, `padH()`, `getHourFromISO()`, `formatDateISO()` |
| `src/lib/utils.ts` | `cn()` utility (clsx + tailwind-merge) |
| `src/routes/(app)/book/+page.svelte` | Booking page (main UX) |
| `src/routes/(app)/calendar/+page.svelte` | Calendar view (@event-calendar) |
| `src/routes/(app)/my-bookings/+page.svelte` | User's booking list with SSE updates |
| `src/routes/api/availability/+server.ts` | `GET` → returns `AvailableSlot[]` for date range + slot |
| `src/routes/api/calendar-statuses/+server.ts` | `GET` → returns `CalendarDayStatus[]` for calendar coloring |
| `src/routes/api/bookings/+server.ts` | `GET`/`POST` bookings, broadcasts SSE |
| `src/routes/api/bookings/[id]/+server.ts` | `DELETE` cancel a booking |
| `src/routes/api/spots/+server.ts` | `GET`/`POST` parking spots (admin for POST) |
| `src/routes/api/admin/flats/+server.ts` | `GET`/`POST` flats (admin only) |
| `src/routes/api/admin/flats/[id]/+server.ts` | `PATCH`/`DELETE` specific flat (admin only) |
| `src/routes/api/auth/login/+server.ts` | `POST` login with flat number + PIN |
| `src/routes/api/auth/activate/+server.ts` | `POST` activate a flat with activation code |
| `src/routes/api/auth/logout/+server.ts` | `POST` logout (clear session) |
| `src/routes/api/events/+server.ts` | SSE stream endpoint |

## Availability computation — how it works

The core function `getAvailableSlots(from, to, slotId)` in `src/lib/server/availability.ts`:

1. **Builds a bookable timeline** — one `[DAY_START:00, DAY_END:00]` interval per day in the range
2. **Subtracts existing bookings** — splits intervals at booking boundaries
3. **Merges consecutive days** — consecutive free days (ending at DAY_END, starting at DAY_START next day) merge into one continuous `AvailableSlot`
4. **Returns `AvailableSlot[]`** — ISO datetime pairs representing contiguous free time

An `AvailableSlot` can span multiple days. With DAY_START=0 and DAY_END=24, consecutive free days are always merged (no gap between them).

### Two independent concerns

| Concern | Endpoint | Data | Used for |
|---------|----------|------|----------|
| Calendar coloring | `GET /api/calendar-statuses` | `CalendarDayStatus[]` (date + free/partial/full) | Color-coding calendar cells |
| Booking form | `GET /api/availability` | `AvailableSlot[]` (ISO datetime ranges) | Hour selection, multi-day validation |

Calendar statuses are loaded on page load (3 months). Available slots are fetched on-demand when the user selects a date.

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
  eventSource.addEventListener('booking_created', () => { /* re-fetch */ });
  eventSource.addEventListener('booking_cancelled', () => { /* re-fetch */ });
});
onDestroy(() => { eventSource?.close(); });
```

### Pre-filling from URL params

The booking page accepts URL params: `?date=`, `?endDate=`, `?startHour=`, `?endHour=`, `?spotId=`. These are passed from the calendar view when a user clicks/selects a time range.

## Database schema

Four tables (SQLite, WAL mode):

| Table | Key fields |
|-------|-----------|
| `flat` | id, number (unique), activationCode, displayName, pinHash, isAdmin, isActive |
| `spot` | id, name, description |
| `booking` | id, spotId (FK), flatId (FK), startTime, endTime, note |
| `session` | id (UUID), flatId (FK), expiresAt |

Bookings store full ISO datetime strings (e.g., `"2026-05-06T14:00:00"`).

## Constants

Defined in `src/lib/types.ts`, imported everywhere:

```typescript
export const DAY_START = 0;   // midnight
export const DAY_END = 24;    // end of day
```

These define the bookable window. Changing them adjusts the entire system (calendar view, availability computation, hour dropdowns, presets).

## Common tasks

### Adding a new time preset

Edit `src/lib/utils/time.ts` — add an entry to `TIME_BLOCKS`. The UI automatically picks it up.

### Changing bookable hours

Edit `DAY_START` / `DAY_END` in `src/lib/types.ts`. Everything else adjusts automatically.

### Adding a new API endpoint

1. Create `src/routes/api/<name>/+server.ts`
2. Check `locals.user` for auth
3. If it modifies bookings, call `sseManager.broadcast('booking_created' | 'booking_cancelled', data)`

### Running migrations

```bash
npm run db:generate    # After editing schema.ts
npm run db:migrate     # Apply to local DB
```

## Gotchas

- **Timezone safety**: Always use `'T12:00:00'` (not `'T00:00:00'`) when creating `Date` objects for day iteration, then using `toISOString().split('T')[0]`. Midnight in local time can shift the date backwards in UTC.
- **Pre-existing type errors**: The shadcn-svelte calendar component (`src/lib/components/ui/calendar/calendar.svelte`) has 2 TS errors from `bits-ui` type complexity. These are harmless and can be ignored.
- **Shared utilities**: `padH()`, `getHourFromISO()`, `formatDateISO()` live in `$lib/utils/time.ts`. Always import from there — do NOT create local duplicates.
- **API error messages**: All user-facing errors are in French. Keep this consistent.
- **Presets (Matin, Après-midi, Soirée)**: These are UX shortcuts that auto-select hour ranges. They do NOT persist any field — just set startHour/endHour.
