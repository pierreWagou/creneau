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
| `src/lib/types.ts`                                      | `SessionFlat`, `DAY_START`/`DAY_END` constants, `AvailableSlot`, `CalendarDayStatus`, `BookingWithFlat`, `SpotTimeline`, `SpotConflict`, `RebindConflictResult` (409-conflict contract) types, `getTimelineStatus()` helper |
| `src/lib/server/availability.ts`                        | `buildSpotTimeline()` — pure computation (no DB); `getCalendarStatuses()` — calendar coloring (calls DB)                                     |
| `src/lib/server/bookings.ts`                            | CRUD: `createBooking()`, `getBookingsInRange()`, `getBookingsByFlat()`, `getAllBookings()`, `cancelBooking()`, `updateBooking()` (owner or admin — admin moves/cancels notify the owner) |
| `src/lib/server/sse.ts`                                 | SSE broadcaster singleton                                                                                                                    |
| `src/lib/server/auth.ts`                                | PIN hashing, session create/validate, `setSessionCookie()`                                                                                   |
| `src/lib/server/db/schema.ts`                           | Drizzle schema: flat, flatEmail, flatPhone, spot, booking, session, request, requestSpot, requestEmail, requestPhone |
| `src/lib/server/db/index.ts`                            | DB connection singleton (libsql + Drizzle), runs migrations on startup, cleans expired sessions                                              |
| `src/lib/utils/time.ts`                                 | `TIME_BLOCKS`, `padH()`, `getHourFromISO()`, `formatDateISO()`, `formatDuration()`, `formatDateFr()`, `formatDateTimeFr()`, `formatCompactDateTimeFr()` |
| `src/lib/utils/api.ts`                                  | `apiFetch()` — typed JSON fetch with safe body parsing + unified error extraction (never throws)                                                   |
| `src/lib/utils/bookings.ts`                             | `splitBookingsByLiveness()` — ongoing/upcoming/past slices shared by both booking lists                                                            |
| `src/lib/utils/combobox.ts`                             | `rankComboboxMatches()` — startsWith-first contains filter for pickers                                                                             |
| `src/lib/validation.ts`                                 | `isValidEmail()`, `isValidPhone()`, `validatePin()` (client-safe; re-exported by `$lib/server/auth.ts`)                                            |
| `src/lib/utils.ts`                                      | `cn()` utility (clsx + tailwind-merge)                                                                                                       |
| `src/lib/server/contacts.ts`                            | Email/phone validation + CRUD helpers (`validateEmails`, `validatePhones`, `getFlatEmails`, etc.)                                              |
| `src/lib/server/guards.ts`                              | `requireAuth()`, `requireAdmin()` route guards                                                                                               |
| `src/lib/utils/phone.ts`                                | `displayPhone()`, `formatPhone()` phone formatting utilities                                                                                 |
| `src/routes/(app)/book/+page.svelte`                    | Booking page — thin host over the shared `booking-flow` component (calendar + hour pickers + submit)                                       |
| `src/lib/components/booking-flow.svelte`                | Shared booking flow (date range, spot tabs/lock, hour-range picker, presets, summary); used by `/book` and the edit dialog                |
| `src/lib/components/booking-ticket-card.svelte`         | Booking ticket card (spot chip, compact date, status pill, owner line) — shared by `my-bookings` and admin bookings                        |
| `src/lib/components/booking-detail-body.svelte`         | Shared booking drawer body (header, place + lot row, note editor, timeline, lifecycle)                                                     |
| `src/lib/components/booking-edit-dialog.svelte`         | Shared edit dialog (`booking-flow` with spot switching + `excludeBookingId`, footer actions)                                              |
| `src/lib/components/booking-cancel-dialog.svelte`       | Shared cancel-confirm dialog                                                                                                             |
| `src/lib/components/drawer-shell.svelte`                | Shared drawer frame (responsive direction, scroll column, footer snippet)                                                                  |
| `src/lib/components/site-toolbar.svelte`                | Shared app toolbar — classic when connected (`flat` set), minimal for guests (`flat: null`)                                                |
| `src/lib/components/guide-content.svelte`               | Admin guide body (`/admin/guide` only)                                                                                                     |
| `src/lib/components/resident-guide-content.svelte`      | Resident manual (public `/guide`, linked from every mail footer)                                                                           |
| `src/routes/(app)/admin/bookings/+page.svelte`          | Admin reservations tab (all flats, search + toggle pills, shared cards/drawer/dialogs, full modify/cancel powers)                         |
| `src/routes/(public)/guide/+page.svelte`                | Public guide (unauthenticated, minimal toolbar)                                                                                            |
| `src/routes/(app)/calendar/+page.svelte`                | Calendar view (@event-calendar) with event popover                                                                                           |
| `src/routes/(app)/my-bookings/+page.svelte`             | User's booking list (next-booking hero, ticket cards, shared drawer/dialogs) with SSE updates                                              |
| `src/routes/api/timeline/+server.ts`                    | `GET` → returns `SpotTimeline` (bookings + available slots) for date range + spot; optional `exclude=<bookingId>` frees the edited slot     |
| `src/routes/api/calendar-statuses/+server.ts`           | `GET` → returns `CalendarDayStatus[]` for calendar coloring                                                                                  |
| `src/routes/api/bookings/+server.ts`                    | `POST` create booking, broadcasts SSE                                                                                                        |
| `src/routes/api/bookings/[id]/+server.ts`               | `PATCH` update times/spot/note, `DELETE` cancel — owner or admin (admin actions notify the owner)                                          |
| `src/routes/api/bookings/[id]/ics/+server.ts`           | `GET` ICS calendar attachment — owner or admin, explicitly including past bookings                                                          |
| `src/routes/api/spots/+server.ts`                       | `POST` parking spots (admin only)                                                                                                            |
| `src/routes/api/spots/[number]/+server.ts`              | `PATCH` update description / `DELETE` spot (admin only)                                                                                      |
| `src/routes/api/admin/flats/+server.ts`                 | `GET`/`POST` flats (admin only, POST accepts `spotNumbers`)                                                                                  |
| `src/routes/api/admin/flats/[number]/+server.ts`        | `PATCH`/`DELETE` specific flat (admin only, PATCH accepts `spotNumbers`/`emails`/`phones`/`force`)                                          |
| `src/routes/api/admin/flats/[number]/activation/+server.ts` | `POST` generate / `DELETE` revoke activation code                                                                                        |
| `src/routes/api/admin/flats/[number]/activation/send/+server.ts` | `POST` resend the activation email for an existing code (`emailSent` flag)                                                    |
| `src/routes/api/admin/flats/[number]/reset/+server.ts`  | `POST` reset an active flat (deactivate, clear PIN/sessions)                                                                                 |
| `src/routes/api/admin/spots/swap/+server.ts`            | `POST` exchange one shared spot for one of a lot's spots (`{ spotNumber, flatNumber, targetSpotNumber? }`, no `force`, strand-checked)        |
| `src/routes/api/admin/spots/moves/+server.ts`            | `POST` atomically rebind a batch of spots (bourse aux places board, final-holdings strand rule, no `force`)                                   |
| `src/lib/server/rebind.ts`                               | Spot-rebind rule: `detectConflicts`/`detectStrands`, `guardRebind`, `bindSpotsToFlat`, `parseSpotListInput`, batch `validateBatchMoves` (pure) |
| `src/lib/server/handler.ts`                              | Request glue: `errorJson`, `parseNumericId`, `parseFlatNumber`, `parseOptionalNumericQuery`, `handleHandlerError`, `validateContactInputs`, `requireRateLimit` |
| `src/lib/utils/toasts.ts`                                | Client toasts: `notifyResult` (apiFetch outcomes), `notifyMailFailed` (failure-only mail receipt), `UPDATE_FAILED` fallback                    |
| `src/lib/server/ics.ts`                                  | RFC 5545 calendar attachment builder (`buildICS`, `bookingUid`) for booking mails + ICS download                                              |
| `src/lib/spot-containers.ts`                             | SpotContainer domain model (pool/limbo/lot + avatar/title/id) + `spotChipProps` chip-color resolver                                            |
| `src/lib/colors.ts`                                      | Hex twin of the app.css palette (mail HTML + JS inline styles) — keep in sync, do not consolidate                                            |
| `src/routes/(app)/admin/_components/spot-mercato-board.svelte` | Staged drag-and-drop rebalancing board (grouped multi-select, `svelte-dnd-action`, one atomic Appliquer)                              |
| `src/lib/components/spot-conflict-dialog.svelte`        | Conflict resolver dialog (per-spot keep/reassign picks, strand-blocked bounce)                                                                  |
| `src/routes/api/admin/requests/+server.ts`              | `GET` list pending requests (admin only)                                                                                                     |
| `src/routes/api/admin/requests/[id]/+server.ts`         | `POST` approve (creates flat + spots, optional `force` body) / `PUT` edit request / `PATCH` reject                                          |
| `src/routes/api/flats/[number]/+server.ts`              | `GET` public display-name lookup for the activation screen (no contacts/codes/PIN)                                                            |
| `src/routes/api/requests/+server.ts`                    | `POST` submit a flat access request (public, no auth)                                                                                        |
| `src/routes/api/health/+server.ts`                      | `GET` health check (DB connectivity, no auth required)                                                                                       |
| `src/routes/api/auth/login/+server.ts`                  | `POST` login with flat number + PIN                                                                                                          |
| `src/routes/api/auth/activate/+server.ts`               | `POST` activate a flat with activation code                                                                                                  |
| `src/routes/api/auth/setup/+server.ts`                  | `POST` first-time admin setup (only works when no flats exist)                                                                               |
| `src/routes/api/auth/logout/+server.ts`                 | `POST` logout (clear session)                                                                                                                |
| `src/routes/api/events/+server.ts`                      | SSE stream endpoint                                                                                                                          |
| `src/routes/(public)/setup/+page.svelte`                | First-time setup wizard (creates admin account)                                                                                              |
| `src/routes/(app)/stats/+page.svelte`                   | Usage stats: personal metrics + building leaderboard + utilization                                                                           |
| `src/routes/(app)/account/+page.svelte`                 | Account settings (display name, PIN change)                                                                                                  |
| `src/routes/api/account/+server.ts`                     | `PATCH` update display name, `POST` change PIN                                                                                               |
| `src/lib/constants.ts`                                  | Shared constants: PIN/display limits, FLAT/SPOT number rules + helpers, rate-limit, SMTP and UI timing knobs                                  |
| `src/lib/server/rate-limit.ts`                          | In-memory rate limiting for auth endpoints (login, activation)                                                                               |
| `src/lib/server/flat-machine.ts`                        | XState v5 flat lifecycle machine (pure, import-free) — `INVITE`/`REVOKE`/`CONSUME` (lowercase `FlatEvent` aliases in `flat-state.ts`)          |
| `src/lib/server/flat-state.ts`                          | Flat lifecycle writes + invitation TTL / `reapExpiredInvitations()`                                                                          |
| `src/lib/server/spot-machine.ts`                        | XState v5 spot lifecycle machine (pure, import-free) — `BIND`/`UNBIND`/`SHARE`/`LIMBO` events                                               |
| `src/lib/server/spot-state.ts`                          | `SpotStatus`, `canTransition()`, `SpotTransitionError`, `shareSpot()`, `shelveSpot()`                                                        |

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

Use the shared helper (`src/lib/utils/sse.ts`) — do NOT hand-roll `EventSource` listeners:

```typescript
import { createBookingSSE } from '$lib/utils/sse';

onMount(() => {
	sse = createBookingSSE({
		onCreated: () => invalidateAll(),
		onCancelled: () => invalidateAll(),
		onUpdated: () => invalidateAll()
	});
});
onDestroy(() => {
	sse?.destroy();
});
```

### Pre-filling from URL params

The booking page accepts URL params: `?date=`, `?endDate=`, `?startHour=`, `?endHour=`, `?spot=`. These are passed from the calendar view when a user clicks/selects a time range.

## Database schema

Ten tables (SQLite, WAL mode). All use **natural keys** (no artificial IDs for spot/flat):

| Table           | Key fields                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `flat`          | number (PK), status (inactive/pending/active), activationCode, activationCodeExpiresAt, displayName, pinHash, isAdmin, activatedAt, createdAt |
| `flat_email`    | flatNumber (FK→flat, CASCADE), email — composite PK (flatNumber + email)                                                       |
| `flat_phone`    | flatNumber (FK→flat, CASCADE), phone — composite PK (flatNumber + phone)                                                       |
| `spot`          | number (PK), flatNumber (FK→flat, nullable, SET NULL on delete), status (shared/assigned/unassigned), description, createdAt  |
| `booking`       | id (autoincrement PK), spotNumber (FK→spot), flatNumber (FK→flat), startTime, endTime, note, status (active/cancelled soft-delete), createdAt |
| `session`       | id (UUID PK), flatNumber (FK→flat), expiresAt, createdAt                                                                        |
| `request`       | id (autoincrement PK), flatNumber, requesterName, status (pending/approved/rejected), reviewedBy, reviewedAt, createdAt         |
| `request_spot`  | requestId (FK→request, CASCADE), spotNumber — composite PK                                                                      |
| `request_email` | requestId (FK→request, CASCADE), email — composite PK                                                                           |
| `request_phone` | requestId (FK→request, CASCADE), phone — composite PK                                                                           |

Bookings store full ISO datetime strings (e.g., `"2026-05-06T14:00:00"`).

## Flat lifecycle

Stored status is `flat.status ∈ {inactive, pending, active}` (XState v5 `flat-machine.ts`,
writes in `flat-state.ts`). Expired invitations are **not** a status — they are a derived
sub-state of `pending`, reaped lazily.

| State    | French     | `status`     | `activationCode`           | Description                                            |
| -------- | ---------- | ------------ | -------------------------- | ------------------------------------------------------ |
| Inactive | Inactif    | `inactive`   | `null`                     | Created (request approval / admin) or after revoke/reset/expiry |
| Pending  | En attente | `pending`    | Has value, TTL not elapsed | Invitation generated (`invite`), awaiting activation   |
| Active   | Actif      | `active`     | `null`                     | Resident activated (`consume`) and set their PIN       |

Transitions: `invite` (inactive→pending, refresh on pending), `revoke` (pending→inactive),
`consume` (pending→active). Lazy expiry runs `reapExpiredInvitations()` (admin load, activation
410, email-send guard) and returns dead invitations to `inactive`.

Requests are a **separate** concern: `request.status ∈ {pending, approved, rejected}`.
Approving one creates an `inactive`, codeless flat.

## Spot lifecycle

Stored status is `spot.status ∈ {shared, assigned, unassigned}` (XState v5 `spot-machine.ts`,
writes in `spot-state.ts` + `rebind.ts`). Invariant: `assigned ⟺ flatNumber` set; only `shared` is bookable.

| State       | `status`       | `flatNumber` | Description                                      |
| ----------- | -------------- | ------------ | ------------------------------------------------ |
| Unassigned  | `unassigned`   | `null`       | Limbo — newly created, awaiting routing          |
| Shared      | `shared`       | `null`       | Common pool, bookable (the only bookable status) |
| Assigned    | `assigned`     | Set          | Bound to a flat                                  |

Transitions: `bind` (any→assigned, rebind on assigned is a legal self-transition), `unbind`
(assigned→shared, guarded by `hasFlat`), `share` (unassigned→shared), `limbo` (shared→unassigned unguarded,
assigned→unassigned guarded by `hasFlat`, strand-checked).
`canTransition()` is checked before every status write; `shareSpot()`/`shelveSpot()` handle the
simple single-row moves; `bindSpotsToFlat()` in `rebind.ts` handles batch binds inside caller-owned
transactions.

## Constants

Defined in `src/lib/types.ts`, imported everywhere:

```typescript
export const DAY_START = 0; // midnight
export const DAY_END = 24; // end of day
```

These define the bookable window. Changing them adjusts the entire system (calendar view, availability computation, hour-range picker, presets).

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
- **CI** (`.github/workflows/ci.yml`): `biome ci` → `npm run check` → `npm run test` → `npm run build` → `npm run test:e2e` (playwright)
- **CD** (`.github/workflows/cd.yml`): Builds + pushes to `ghcr.io` on push-to-`main` (`:canary` preview) / published release (`:latest` production)
-- **Pre-commit** (`lefthook.yml`): In parallel — `npx biome check --write .` (with `stage_fixed`) and `npm run check`
- **Tests**: Vitest, config in `vite.config.ts`, test files colocated (`*.test.ts`)
- **ON DELETE CASCADE**: `flat_email.flatNumber`, `flat_phone.flatNumber`, `booking.spotNumber`, `booking.flatNumber`, `session.flatNumber`, `request_spot.requestId`, `request_email.requestId`, `request_phone.requestId`. Exception: `spot.flatNumber` is **SET NULL** (a deleted lot frees its spots; the endpoints land those `unassigned` explicitly so the status invariant holds).
- **Not FK-backed**: `request.flatNumber` and `request_spot.spotNumber` are plain text (a request may reference a lot/spot that doesn't exist yet — it is resolved at approval).

## Common tasks

### Adding a new time preset

Edit `src/lib/utils/time.ts` — add an entry to `TIME_BLOCKS`. The UI automatically picks it up.

### Changing bookable hours

Edit `DAY_START` / `DAY_END` in `src/lib/types.ts`. Everything else adjusts automatically.

### Adding a new API endpoint

1. Create `src/routes/api/<name>/+server.ts`
2. Guard with `requireAuth(locals)` / `requireAdmin(locals)` and return its response (401/403 split); page `load` functions redirect instead
3. If it modifies bookings, call `sseManager.broadcast('booking_created' | 'booking_cancelled' | 'booking_updated', data)`
4. Spot reassignment: `PATCH /api/admin/flats/:number` accepts `force: true` to confirm a spot conflict swap; returns `409` with `conflicts` array if unforced. `POST /api/admin/spots/moves` instead validates a whole batch against *final* holdings (no `force`; stranding is always `409`)

### Running migrations

```bash
npm run db:generate    # After editing schema.ts
npm run db:migrate     # Apply to local DB
```

## Gotchas

- **Timezone safety**: Always use `'T12:00:00'` (not `'T00:00:00'`) when creating `Date` objects for day iteration. `formatDateISO()` in `$lib/utils/time.ts` applies the noon trick internally.
- **Shared utilities**: `padH()`, `getHourFromISO()`, `formatDateISO()`, `countdownLabel()` live in `$lib/utils/time.ts`. Always import from there — do NOT create local duplicates.
- **API error messages**: All user-facing errors are in French. Keep this consistent.
- **Presets (Matin, Après-midi, Soirée)**: These are UX shortcuts that auto-select hour ranges. They do NOT persist any field — just set startHour/endHour.
- **Natural keys**: `spot` and `flat` tables use `number` (text) as primary key. No artificial integer IDs. Booking references them via `spotNumber`/`flatNumber` text FKs.
- **Setup wizard**: On first boot (zero flats in DB), the app shows `/setup` where the first admin account is created. No app secret/config required. A seed script exists separately for dev/demo data (`scripts/seed.ts`, `npm run db:seed:dev`) and is what bakes `drizzle/seed.db` at Docker build time for the preview environment.

## Button Rules

Canonical table lives in `AGENTS.md` (repo root) — keep the two identical:

| Pattern | Variant | Use case |
|---------|---------|----------|
| A. Solid bg | `default` | Primary submit, main CTAs, add buttons (blue) |
| B. Solid red bg | `default` + `bg-destructive on-solid hover:bg-destructive/80` | Delete, cancel, revoke, reject, logout |
| B2. Solid green bg | `default` + `bg-success on-solid hover:bg-success/80` | Approve |
| C. Border + hover | `outline` | Secondary actions, toggle, modify, copy |
| D. No bg + hover | `ghost` | Inline remove icons, nav links, view details |
| E. Custom color | `ghost/outline` + manual | Symmetric action pairs (approve/reject in list rows — stay tinted by design, not solid) |

- **List rows** → `ghost` (lightweight)
- **Dialog footers** → secondary `outline` + primary CTA `default` (matches A + C, e.g. `Annuler` + `Ajouter`; async confirms stay raw `Button` so the spinner/result isn't unmounted by `AlertDialog.Action` autoclose)
- Inline trash icons: always `variant="ghost" size="icon-sm"`
- Colored text on hover: add `hover:text-{color}` to override ghost/outline's `hover:text-foreground`
- Hover bg: use `hover:!bg-{color}/10` (important prefix overrides variant's `hover:bg-muted`)
- Never use the shadcn `destructive` (tinted) button variant for actions — pattern B (solid) or E (tinted pair) covers all cases

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
