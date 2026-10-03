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
- Spot lifecycle `shared | assigned | unassigned` (invariant: `assigned ⟺ flatNumber` set; only `shared` is bookable). Creation lands `unassigned`; unbind paths land `shared`; all binds set `assigned` via `rebind.ts`
- Booking still has an integer `id` (needed for DELETE/PATCH URLs)
- `booking` and `session` FKs cascade on delete
- `spot.flatNumber` FK uses `SET NULL` on flat delete (endpoint explicitly lands freed spots `shared` first — FK alone would strand statuses)
- `flat_email` and `flat_phone` are junction tables with composite PKs (`flatNumber` + `email`/`phone`)
- Contacts cascade on flat delete via FK
- Requests use a separate `request` table with `request_spot`, `request_email`, `request_phone` junction tables
- `request.reviewedBy` is a plain text column (no FK — self-reference causes circular type issues)

### API Conventions

- Auth: return `401` for unauthenticated, `403` for unauthorized (split guard pattern)
- All POST/PATCH/DELETE handlers that call `request.json()` must catch `SyntaxError` and return `400`
  — do it via `catch (e) { return handleHandlerError('POST /api/x', e); }` (`$lib/server/handler`), which
  also logs unexpected failures and answers `500`. Sanctioned exception: `POST /api/admin/requests/:id`
  accepts an optional body and swallows a parse error to default `force = false`.
- Error response format: `json({ error: "..." }, { status: N })`
- Rate limiting on login + activation (5 attempts / 15 min lockout per flat) — `requireRateLimit(key)` for
  the `429` gate; `recordFailedAttempt` / `resetAttempts` stay at the failure/success points that earn them
- Contact bodies are validated with `validateContactInputs(emails, phones)`; partial updates that persist
  each list separately keep using `validateEmails` / `validatePhones` per key
- Spot reassignment: `PATCH /api/admin/flats/:number` accepts `force: true` to confirm a spot conflict swap; returns `409` with `conflicts` array if unforced. The same `force`/`409 conflicts` contract (and the
  never-strand-a-lot-at-0-spots rule) applies to `POST /api/spots`, `POST /api/admin/flats`,
  `POST /api/admin/requests/:id` — all go through `guardRebind` in `$lib/server/rebind`
- URL naming (new routes): plural kebab-case resources, admin-only operations under `admin/`. Existing
  route paths are frozen — they're referenced by the frontend, e2e, Bruno and `openapi.yaml`, so renaming
  is a breaking change that needs its own migration plan.

### Button Rules

| Pattern | Variant | Use case |
|---------|---------|----------|
| A. Solid bg | `default` | Primary submit, main CTAs, add buttons (blue) |
| B. Solid red bg | `default` + `bg-destructive text-white dark:text-[#1e1e2e] hover:bg-destructive/80` | Delete, cancel, revoke, reject, logout |
| B2. Solid green bg | `default` + `bg-success text-white dark:text-[#1e1e2e] hover:bg-success/80` | Approve |
| C. Border + hover | `outline` | Secondary actions, toggle, modify, copy |
| D. No bg + hover | `ghost` | Inline remove icons, nav links, view details |
| E. Custom color | `ghost/outline` + manual | Symmetric action pairs (approve/reject in list rows — stay tinted by design, not solid) |

- **List rows** → `ghost` (lightweight)
- **Dialog actions** → `outline` (prominent, consistent with other dialog buttons)
- Inline trash icons: always `variant="ghost" size="icon-sm"`
- Colored text on hover: add `hover:text-{color}` to override ghost/outline's `hover:text-foreground`
- Hover bg: use `hover:!bg-{color}/10` (important prefix overrides variant's `hover:bg-muted`)

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

### Validation

- PIN validation: use `validatePin()` from `$lib/server/auth.ts` (not inline checks)
- Bookings: server validates past dates, hour bounds (DAY_START/DAY_END), max duration (7 days), spot existence, and conflicts
- Past bookings are immutable (cannot be modified, moved, or cancelled)

### Styling

- Use semantic CSS classes from `src/app.css` `@layer components` (e.g., `page-title`, `nav-link-desktop`, `stat-value`, `flat-badge-active`, `inline-link`)
- Do NOT modify shadcn component internals — override via `class` prop at usage site
- Third-party CSS overrides go in colocated `.css` files (e.g., `calendar.css`), not in Svelte `<style>` blocks

### Code Organization

- Shared constants in `src/lib/constants.ts` (both sides; hex palette twin of `app.css` in `src/lib/colors.ts`)
- Shared types in `src/lib/types.ts`
- Server utilities in `src/lib/server/` (auth, bookings, availability, sse, rate-limit, db, contacts, guards, handler, rebind, flat-machine, flat-state, mail, mail-templates)
- Time utilities in `src/lib/utils/time.ts`

### Git & CI

- Pre-commit: `npx biome check --write .` → `git add -u` → `npm run check`
- CI: biome ci → svelte-check → vitest → build → playwright (E2E)
- Preview CD (`cd.yml`): push to `main` → builds `:canary` → pushes to GHCR → deploys preview via Dokploy webhook
- Release CD (`cd.yml`): GitHub Release published → builds `:X.Y.Z` + `:X.Y` + `:latest` → pushes to GHCR → deploys production via Dokploy webhook
- Release flow: `npm run release:patch|minor|major` → `gh release create <tag> --generate-notes`
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

`scripts/entrypoint.sh` at container startup:
```sh
if [ "${SEED_ON_INIT}" = "true" ] && [ ! -f /app/data/creneau.db ]; then
  cp /app/seed.db /app/data/creneau.db
fi
exec node build
```

- **Preview**: `SEED_ON_INIT=true` set in Dokploy service env vars → seeds on first boot with fake flats + bookings (PIN `1234` for all)
- **Production**: no `SEED_ON_INIT` → starts with empty DB → redirects to `/setup` for first-time admin creation

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
│   ├── server/              # Server-only modules
│   │   ├── db/schema.ts     # Drizzle schema (source of truth)
│   │   ├── db/index.ts      # DB connection singleton, migrations, session cleanup
│   │   ├── auth.ts          # PIN hashing, sessions, validatePin()
│   │   ├── bookings.ts      # CRUD + validation
│   │   ├── availability.ts  # Timeline computation (pure function)
│   │   ├── contacts.ts      # Email/phone validation + CRUD helpers
│   │   ├── guards.ts        # requireAuth / requireAdmin (401 / 403 split)
│   │   ├── handler.ts       # handleHandlerError, validateContactInputs, requireRateLimit
│   │   ├── rebind.ts        # Spot-rebind rule: detectConflicts/Strands, guardRebind, bindSpotsToFlat
│   │   ├── flat-machine.ts  # XState v5 flat lifecycle (pure, import-free)
│   │   ├── flat-state.ts    # Lifecycle writes + invitation TTL / reap
│   │   ├── mail.ts          # Pooled SMTP transporter + sendActivationEmail
│   │   ├── mail-templates.ts# buildActivationEmail (hex palette for mail HTML)
│   │   ├── sse.ts           # SSE broadcaster
│   │   └── rate-limit.ts    # In-memory rate limiter
│   ├── constants.ts         # PIN_*, FLAT/SPOT number rules, RATE_LIMIT_*, SMTP_*, UI_* timings
│   ├── colors.ts            # Hex twin of app.css palette (mail HTML + JS inline styles)
│   ├── validation.ts        # isValidEmail / isValidPhone
│   ├── types.ts             # SessionFlat, BookingWithFlat, SpotTimeline, DAY_START/DAY_END
│   ├── utils.ts             # cn (clsx + tailwind-merge)
│   └── utils/time.ts        # padH, getHourFromISO, formatDateISO, formatDuration, TIME_BLOCKS
├── routes/
│   ├── (public)/             # Login, activate, setup, request, about (unauthenticated)
│   ├── (app)/               # Authenticated pages (calendar, book, my-bookings, stats, account, admin)
│   └── api/                 # REST endpoints + SSE
├── app.css                  # Theme + @layer components (semantic classes) + @layer base (global form styles)
└── app.html                 # Shell with favicon
```

## Key Decisions

- Setup wizard: first visitor creates admin (no secrets in config, accepts race condition for homeserver)
- Flat state machine (XState v5 `flat-machine.ts`, writes in `flat-state.ts`): stored `inactive → pending → active`; transitions are `invite` (generate/refresh), `revoke` (→ inactive), `consume` (activation → active). Expiry is a lazy system transition (`reapExpiredInvitations()` on admin load, activate-410, send-guard): dead codes return flats to `inactive`; no `expired` state anywhere. Requests live separately (`pending/approved/rejected`); approval creates an `inactive`, codeless flat
- Contacts: normalized into `flat_email` and `flat_phone` junction tables (not JSON arrays)
- Requests: stored in a separate `request` table with `request_spot`, `request_email`, `request_phone` junction tables
- Calendar: @event-calendar/core with drag/drop (own bookings only, future only)
- Stats: visible to all users (transparent building data)
- QR codes: generated client-side with `qrcode` package, "C" logo overlay
