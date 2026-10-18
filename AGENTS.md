# Creneau — AI Agent Guidelines

## Project

Shared parking spot booking app for apartment buildings.
SvelteKit (Svelte 5 runes) + SQLite (Drizzle ORM) + Tailwind CSS v4 + shadcn-svelte.

## Rules

### Language & UX

- All user-facing error messages in French
- Placeholders use the convention: `B12` for flats, `36` for spots

### Data Model

- Natural keys: `flat.number` and `spot.number` are text primary keys (no artificial integer IDs)
- Spot lifecycle `shared | assigned | unassigned` — XState v5 `spot-machine.ts`, writes in `spot-state.ts` + `rebind.ts`. Invariant: `assigned ⟺ flatNumber` set; only `shared` is bookable. Creation lands `unassigned`; implicit detach paths (lot delete, force-unbind, swap leg) land `unassigned` via `limbo` (never the bookable pool — re-share/reassign is an explicit admin act); `DELETE /api/spots/:number` instead hard-deletes the row (its bookings cascade); all binds set `assigned` via `rebind.ts`. Transitions: `bind` (any→assigned), `unbind` (assigned→shared, explicit pool-targeting only), `share` (unassigned→shared), `limbo` (shared→unassigned unguarded, assigned→unassigned guarded by `hasFlat`; clears the flat binding, strand-checked)
- Booking still has an integer `id` (needed for DELETE/PATCH URLs)
- Booking lifecycle `active | cancelled`: cancelling is a soft-delete (`UPDATE status`, never `DELETE`) — cancelled rows stay for display (red `Annulée` pill, hidden by default behind a toggle for non-admins) and are ignored by availability, conflicts, calendar, and stats. Re-cancel → `409`, update of cancelled → `400` (like past). Past bookings stay immutable for everyone
- `booking` and `session` FKs cascade on delete
- `spot.flatNumber` FK uses `SET NULL` on flat delete (endpoint explicitly lands freed spots `unassigned` first — FK alone would strand statuses)
- `flat_email` and `flat_phone` are junction tables with composite PKs (`flatNumber` + `email`/`phone`)
- Contacts cascade on flat delete via FK
- Requests use a separate `request` table with `request_spot`, `request_email`, `request_phone` junction tables
- `request.reviewedBy` is a plain text column (no FK — self-reference causes circular type issues)
- `request.flatNumber` is also FK-less by design (a request may name a lot that doesn't exist yet — resolved at approval)

### API Conventions

- Auth: return `401` for unauthenticated, `403` for unauthorized (split guard pattern).
  Page `load` functions redirect instead (e.g. non-admins to `/calendar`) — the split applies to APIs.
- All POST/PATCH/DELETE handlers that call `request.json()` must catch `SyntaxError` and return `400`
  — do it via `catch (e) { return handleHandlerError('POST /api/x', e); }` (`$lib/server/handler`), which
  also logs unexpected failures and answers `500`. Sanctioned exception: `POST /api/admin/requests/:id`
  accepts an optional body and swallows a parse error to default `force = false`.
- Error response format: `json({ error: "..." }, { status: N })`
- Rate limiting on login + activation (5 attempts / 15 min lockout per flat) — `requireRateLimit(key)` for
  the `429` gate; `recordFailedAttempt` / `resetAttempts` stay at the failure/success points that earn them
- Contact bodies are validated with `validateContactInputs(emails, phones)`; partial updates that persist
  each list separately keep using `validateEmails` / `validatePhones` per key
- Client toasts for `apiFetch` outcomes go through `notifyResult(result, success, fallback)` (`$lib/utils/toasts`, default fallback `UPDATE_FAILED`); mail delivery failures surface via `notifyMailFailed(mailFailed)` (failure-only warning, never an error)
- Spot reassignment: `PATCH /api/admin/flats/:number` accepts `force: true` to confirm a spot conflict swap; returns `409` with `conflicts` array if unforced. The same `force`/`409 conflicts` contract (and the
  never-strand-a-lot-at-0-spots rule) applies to `POST /api/spots`, `POST /api/admin/flats`,
  `POST /api/admin/requests/:id` — all go through `guardRebind` in `$lib/server/rebind`.
  `POST /api/admin/spots/moves` (bourse aux places board) is the exception: it validates a whole batch
  against *final* holdings inside one transaction, so an A↔B swap is legal even though each
  leg alone looks like a conflict; stranding is always a hard `409` (no `force`). Pure
  validation lives in `validateBatchMoves` (unit-tested, no DB).
  `POST /api/admin/spots/swap` exchanges one shared spot for one of a lot's spots
  (`{ spotNumber, flatNumber, targetSpotNumber? }` — no `force`, no `conflicts` array);
  the released leg lands `unassigned` in the same transaction and is strand-checked
  (`assertNoStrand`), so swapping away a lot's last spot is a hard `409`.
  On `POST /api/admin/requests/:id`: `PUT` edits the request, `PATCH` rejects it (unconventional split, frozen).
- `GET /api/timeline` accepts optional `exclude=<bookingId>` (edit mode: the booking being moved must not block its own slot; ownership-checked, ignored for other flats' bookings)
- `PATCH`/`DELETE /api/bookings/:id`: owner or admin (every move/cancel notifies the owner by mail — including self-moves/cancels as a receipt; note-only edits stay silent; past bookings stay immutable for everyone)
- URL naming (new routes): plural kebab-case resources, admin-only operations under `admin/`. Existing
  route paths are frozen — they're referenced by the frontend, e2e and `openapi.yaml`, so renaming
  is a breaking change that needs its own migration plan. Frozen exceptions: admin-guarded
  `POST/PATCH/DELETE /api/spots*` (predate the convention), the public `GET /api/flats/:number`
  display-name lookup (intentionally unguarded), singular `account`/`health`/`timeline`/`events`
  (predate the plural rule), and the `spot` query param on `GET /api/timeline` +
  `GET /api/calendar-statuses` (bodies everywhere else say `spotNumber`).
- Route params: `id` = surrogate integer PK (`bookings/:id`, `requests/:id`, parsed with `parseNumericId()` from `$lib/server/handler` — never raw `Number()`; optional numeric queries via `parseOptionalNumericQuery()`);
  `number` = natural key — flats trimmed/uppercased (`parseFlatNumber()`), spots trimmed/zero-padded (`formatSpotNumber()`); spot lists via `parseSpotListInput(raw, emptyMessage)` (`$lib/server/rebind`). Shared code calls the
  flat/lot a `flat` (`flatNumber`, `/api/admin/flats`); user-facing French strings call it a `lot`
  (`/admin/lots`, `Lot B12`).

### Button Rules

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

### Catppuccin Palette

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

### Spot chip colors

`SpotChip` takes `status` + caller-resolved `tint` (via `getFlatColor`, avatar precedent): `shared` → blue, `unassigned` → grey, `assigned` → lot tint (`color-mix` recipe). DnD tones (`preview`/`shadow`/`ghost`/`highlight`/`struck`) are structural decoration only and keep their exact look; status color composes underneath.

### Validation

- PIN validation: use `validatePin()` from `$lib/validation.ts` (client-safe shared module, re-exported by `$lib/server/auth.ts` — not inline checks)
- Bookings: server validates past dates, hour bounds (DAY_START/DAY_END), max duration (7 days), spot existence, and conflicts
- Past bookings are immutable (cannot be modified, moved, or cancelled)

### Styling

- Use semantic CSS classes from `src/app.css` `@layer components` (e.g., `page-title`, `nav-link-desktop`, `stat-value`, `flat-badge-active`, `inline-link`)
- Do NOT modify shadcn component internals — override via `class` prop at usage site
- Third-party CSS overrides go in colocated `.css` files (e.g., `calendar.css`, `booking-flow.css`), not in Svelte `<style>` blocks
- Route/component-scoped rhythm also lives in colocated `.css` (e.g., `error.css`, `spot-chip-picker.css`, `spot-mercato-board.css`) — plain values, never a second Tailwind source of truth
- Detail surfaces compose `src/lib/components/detail/*` (`DetailSection`, `DetailCard`, `StatusBadge`, `AvatarCircle`) and `EditableField` — no raw section-label/card/pill/avatar markup in routes. Dialogs compose `DialogShell` (owns Root + Content + sizes) + `DialogHeader` ([icon] title + subtitle + X when `onClose` exists; `titleExtra` snippet for chips) — no raw `Root`/`Header`/`Title` in callers (documented exception: trigger-owned `about-dialog`). Footers stay hand-written under `DIALOG_FOOTER_CLASS`: `Cancel + Action` for sync confirms, raw `Button`s for async (spinner/result must survive `AlertDialog.Action` autoclose). Lifecycle pills go through `statusBadgeClass` (flat/spot states in detail surfaces; the lots list rows use inline pending-state maps). Booking-liveness and filter pills are a separate family by design: per-state solid/tint pairs (bookings green/blue/grey + red `Annulée` for cancelled, short-circuiting liveness), hand-written, never `statusBadgeClass`

### Code Organization

- Shared constants in `src/lib/constants.ts` (both sides; hex palette twin of `app.css` in `src/lib/colors.ts`)
- Shared types in `src/lib/types.ts`
- Server utilities in `src/lib/server/` (auth, bookings, availability, sse, rate-limit, db, contacts, guards, handler, rebind, flat-machine, flat-state, spot-machine, spot-state, mail/blocks, mail/shell, mail/assets)
- Time utilities in `src/lib/utils/time.ts`

### Git & CI

- Pre-commit (lefthook, `lefthook.yml`): in parallel — `npx biome check --write .` (auto-stages fixes) + `npm run check`
- Pre-push (lefthook): in parallel — `gitleaks git .` (full history scan) + `npm run test`
- CI: `npm run check:biome` (`biome ci`) → `npm run check` → `npm run test` → `npm run build` → `npm run test:e2e` (playwright)
- Preview CD (`cd.yml`): push to `main` → builds `:canary` → pushes to GHCR → deploys preview via Dokploy webhook
- Release CD (`cd.yml`): GitHub Release published → builds `:X.Y.Z` + `:X.Y` + `:latest` → pushes to GHCR → deploys production via Dokploy webhook
- Release flow: `npm run release:patch|minor|major` (`npm version` + push tags) → `gh release create <tag> --generate-notes` (separate manual step)
- E2e policy: one happy-path UI journey per feature; behavior/edge/contract logic lives in vitest
  or the API-level e2e files (`api`, `mercato`, `requests-conflicts`, `drag`, `ics-sse` — Playwright as
  an HTTP client). No CSS/page-size/animation-attribute assertions in e2e — those break on any UI refactor.
- SSE events: `booking_created`, `booking_cancelled`, `booking_updated` (+ `connected` on stream open)

## Deployment

Creneau is deployed via **Dokploy** on wagoulab (`apps.wagou.fr`). Two environments:

| Environment | URL | Image tag | `SEED_ON_INIT` | Data |
|---|---|---|---|---|
| Production | `creneau.wagou.fr` | `:latest` | not set | bind mount `/var/lib/creneau:/app/data` |
| Preview | `creneau-preview.wagou.fr` | `:canary` | `true` | named volume (ephemeral-ish) |

Auto-deploy is triggered via Dokploy webhook URLs stored as GitHub Actions secrets:
- `DOKPLOY_WEBHOOK_URL` — called for both preview (push to main) and production (GitHub Release) deploys

### Image build

- Built in GitHub Actions (`cd.yml`) — **never built on the server**
- `scripts/seed.ts` runs at Docker build time to generate `drizzle/seed.db` with fresh relative-date bookings
- `drizzle/seed.db` is baked into the image but **not committed to git** (in `.gitignore`)

### Seed strategy

`scripts/entrypoint.sh` at container startup (progress `echo`s omitted):
```sh
if [ "${SEED_ON_INIT}" = "true" ] && [ ! -f /app/data/creneau.db ]; then
  cp /app/seed.db /app/data/creneau.db
fi
exec node build
```

- **Preview**: `SEED_ON_INIT=true` set in Dokploy service env vars → seeds on first boot with fake flats + bookings (PIN `1234` for all)
- **Production**: no `SEED_ON_INIT` → starts with empty DB → redirects to `/setup` for first-time admin creation
- **Preview mail catch-all**: `SMTP_REDIRECT_ALL_TO` set in preview env (compose + Dokploy service) → every recipient swapped for it (`X-Original-To` + `[Preview]` subject). **Production must never set it** — unset means real delivery.

### Resetting the production DB

```bash
ssh wagoulab
rm /var/lib/creneau/creneau.db
# Then redeploy in Dokploy UI
```

## Architecture

```
src/
├── lib/
│   ├── components/ui/       # shadcn-svelte components (don't modify internals)
│   ├── components/qr-code.svelte  # QR code generator with logo
│   ├── components/          # Shared app components: site-toolbar, drawer-shell, drawer-action-footer,
│   │   │                    # dialog-shell, dialog-header, dialog-header-icon, page-column, pagination-nav, search-field,
│   │   │                    # filter-bar, spot-chip, spot-chip-picker, booking-flow, hour-range-picker, booking-ticket-card,
│   │   │                    # booking-detail-body, booking-edit-dialog, booking-cancel-dialog, guide-content, resident-guide-content,
│   │   │                    # flat-detail-view, spot-conflict-dialog, booking-slot-timeline, booking-status-pill,
│   │   │                    # icon-button, async-button, validated-submit, form-field, empty-state, stat,
│   │   │                    # count-badge, identity-row, list-row, radio-card-row, entity-header-card
│   ├── server/              # Server-only modules
│   │   ├── db/schema.ts     # Drizzle schema (source of truth)
│   │   ├── db/index.ts      # DB connection singleton, migrations, session cleanup
│   │   ├── db/migrate.ts    # Migration runner (journal-checked)
│   │   ├── auth.ts          # PIN hashing, sessions, validatePin()
│   │   ├── bookings.ts      # CRUD + validation
│   │   ├── availability.ts  # Timeline computation (pure function)
│   │   ├── contacts.ts      # Email/phone validation + CRUD helpers
│   │   ├── guards.ts        # requireAuth / requireAdmin (401 / 403 split)
│   │   ├── handler.ts       # errorJson, parseNumericId, parseFlatNumber, handleHandlerError, validateContactInputs, requireRateLimit
│   │   ├── rebind.ts        # Spot-rebind rule: detectConflicts/Strands, guardRebind, bindSpotsToFlat, parseSpotListInput
│   │   ├── flat-machine.ts  # XState v5 flat lifecycle (pure, import-free)
│   │   ├── flat-state.ts    # Lifecycle writes + invitation TTL / reap
│   │   ├── spot-machine.ts  # XState v5 spot lifecycle (pure, import-free)
│   │   ├── spot-state.ts    # Spot lifecycle writes (shareSpot, shelveSpot) + canTransition
│   │   ├── mail/            # Resident mail: sender.ts (pooled SMTP transporter + deliver),
│   │   │                    # builders (activation, requests, bookings, lots), shell + blocks, index barrel
│   │   ├── ics.ts           # RFC 5545 event builder for booking calendar attachments
│   │   ├── sse.ts           # SSE broadcaster
│   │   └── rate-limit.ts    # In-memory rate limiter
│   ├── spot-containers.ts   # SpotContainer domain model (pool/limbo/lot + avatar/title/id)
│   ├── constants.ts         # PIN_MIN_LENGTH/PIN_MAX_LENGTH, FLAT/SPOT number rules, RATE_LIMIT_*, SMTP_*, UI_* timings
│   ├── colors.ts            # Hex twin of app.css palette (mail HTML + JS inline styles)
│   ├── validation.ts        # isValidEmail / isValidPhone
│   ├── types.ts             # SessionFlat, BookingWithFlat, SpotTimeline, SpotConflict, RebindConflictResult, DAY_START/DAY_END
│   ├── utils.ts             # cn (clsx + tailwind-merge)
│   ├── utils/time.ts        # padH, getHourFromISO, formatDateISO, formatDuration, countdownLabel, TIME_BLOCKS
│   │                         # + formatDateFr/formatDateTimeFr/formatCompactDateTimeFr (use these, not local)
│   ├── utils/               # phone, spots, sse (createBookingSSE), api (apiFetch), bookings (split),
│   │                         # combobox (ranked filter), booking-deep-link, is-desktop
├── routes/
│   ├── (public)/             # Login, activate, setup, request, about, guide (unauthenticated)
│   ├── (app)/               # Authenticated pages (calendar, book, my-bookings, stats, account, admin)
│   │                         # admin tabs: lots, spots (+ _components/spot-mercato-board), bookings, guide
│   └── api/                 # REST endpoints + SSE
├── app.css                  # Theme + @layer components (semantic classes) + @layer base (global form styles)
└── app.html                 # Shell with favicon
```

## Key Decisions

- Setup wizard: first visitor creates admin (no secrets in config, accepts race condition for homeserver)
- Flat state machine (XState v5 `flat-machine.ts`, writes in `flat-state.ts`): stored `inactive → pending → active`; transitions are `invite` (generate/refresh), `revoke` (→ inactive), `consume` (activation → active). Expiry is a lazy system transition (`reapExpiredInvitations()` on admin load, activate-410, send-guard): dead codes return flats to `inactive`; no `expired` state anywhere. Requests live separately (`pending/approved/rejected`); approval creates an `inactive`, codeless flat
- Spot state machine (XState v5 `spot-machine.ts`, writes in `spot-state.ts` + `rebind.ts`): stored `shared | assigned | unassigned`; transitions are `bind` (any→assigned, rebind is a legal self-transition), `unbind` (assigned→shared, guarded by `hasFlat`, explicit pool-targeting only — implicit detaches use `limbo`), `share` (unassigned→shared), `limbo` (shared→unassigned unguarded, assigned→unassigned guarded by `hasFlat`, strand-checked; the landing for lot delete, force-unbind and swap legs — `DELETE /api/spots/:number` hard-deletes instead). Invariant: `assigned ⟺ flatNumber` set; only `shared` is bookable. `canTransition` is checked before every status write
- Contacts: normalized into `flat_email` and `flat_phone` junction tables (not JSON arrays)
- Requests: stored in a separate `request` table with `request_spot`, `request_email`, `request_phone` junction tables
- Calendar: @event-calendar/core with drag/drop (own bookings only, future only)
- Stats: visible to all users (transparent building data)
- QR codes: generated client-side with `qrcode` package, "C" logo overlay
- Bookings UX: ticket cards (`booking-ticket-card`) + shared detail body/dialogs (`booking-detail-body`, `booking-edit-dialog`, `booking-cancel-dialog`) reused by `my-bookings` and the admin `Réservations` tab; edit popup embeds the full `/book` flow (`booking-flow`) with spot switching (`spot-chip-picker` radiogroup shared by create + edit; `PATCH` accepts `spotNumber`, target must be shared, conflicts checked on the target excluding self, moved mail shows old → new chips); `GET /api/timeline?exclude=` frees the edited slot
- Admin `Réservations` tab: all flats' bookings, owner or admin can modify/cancel (every move/cancel mails the owner); non-admins redirect to `/calendar`
- Guide: resident manual (`resident-guide-content`) served publicly (`/guide`, minimal toolbar, linked from every mail footer) vs admin manual (`guide-content`) for connected admins (`/admin/guide`, classic toolbar)
- Error page (`src/routes/+error.svelte` + colocated `error.css`): stop-sign 404/500 with session-aware toolbar (reads `page.data.flat` from the root `+layout.server.ts`, which returns `{ flat: locals.flat ?? null }` like the `(public)` layout; `(app)` redirects to `/login` instead)
