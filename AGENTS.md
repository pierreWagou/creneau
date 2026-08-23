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
- Booking still has an integer `id` (needed for DELETE/PATCH URLs)
- `booking` and `session` FKs cascade on delete
- `spot.flatNumber` FK uses `SET NULL` on flat delete (spot becomes shared)
- `flat_email` and `flat_phone` are junction tables with composite PKs (`flatNumber` + `email`/`phone`)
- Contacts cascade on flat delete via FK
- Requests use a separate `request` table with `request_spot`, `request_email`, `request_phone` junction tables
- `request.reviewedBy` is a plain text column (no FK — self-reference causes circular type issues)

### API Conventions

- Auth: return `401` for unauthenticated, `403` for unauthorized (split guard pattern)
- All POST/PATCH/DELETE handlers that call `request.json()` must catch `SyntaxError` and return `400`
- Error response format: `json({ error: "..." }, { status: N })`
- Rate limiting on login + activation (5 attempts / 15 min lockout per flat)
- Spot reassignment: `PATCH /api/admin/flats/:number` accepts `force: true` to confirm a spot conflict swap; returns `409` with `conflicts` array if unforced

### Button Rules

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

- Shared constants in `src/lib/constants.ts`
- Shared types in `src/lib/types.ts`
- Server utilities in `src/lib/server/` (auth, bookings, availability, sse, rate-limit, db, contacts)
- Time utilities in `src/lib/utils/time.ts`

### Git & CI

- Pre-commit: `npx biome check --write .` → `git add -u` → `npm run check`
- CI: biome ci → svelte-check → vitest → build → playwright (E2E)
- Preview CD (`cd.yml`): push to `main` → builds `:canary` → pushes to GHCR → deploys preview via Dokploy webhook
- Release CD (`cd.yml`): GitHub Release published → builds `:X.Y.Z` + `:X.Y` + `:latest` → pushes to GHCR → deploys production via Dokploy webhook
- Release flow: `npm run release:patch|minor|major` → `gh release create <tag> --generate-notes`
- SSE events: `booking_created`, `booking_cancelled`, `booking_updated`

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
│   │   ├── sse.ts           # SSE broadcaster
│   │   └── rate-limit.ts    # In-memory rate limiter
│   ├── constants.ts         # PIN_MIN_LENGTH, PIN_MAX_LENGTH, DISPLAY_NAME_MAX_LENGTH, CALENDAR_LOOKAHEAD_MONTHS, ACTIVATION_CODE_TTL_MS, MAX_BOOKING_HOURS, ACTIVATION_CODE_LENGTH, MAX_CONTACTS_PER_TYPE, MS_PER_HOUR, SESSION_DURATION_DAYS
│   ├── types.ts             # SessionFlat, BookingWithFlat, SpotTimeline, DAY_START/DAY_END
│   └── utils/time.ts        # padH, getHourFromISO, formatDateISO, formatDuration, TIME_BLOCKS
├── routes/
│   ├── (public)/             # Login, activate, setup, request (unauthenticated)
│   ├── (app)/               # Authenticated pages (calendar, book, my-bookings, stats, account, admin)
│   └── api/                 # REST endpoints + SSE
├── app.css                  # Theme + @layer components (semantic classes) + @layer base (global form styles)
└── app.html                 # Shell with favicon
```

## Key Decisions

- Setup wizard: first visitor creates admin (no secrets in config, accepts race condition for homeserver)
- Flat lifecycle: Demande → Inactif → En attente (24h activation code) → Actif / Expiré (code TTL elapsed → back to Inactif via admin reset)
- Contacts: normalized into `flat_email` and `flat_phone` junction tables (not JSON arrays)
- Requests: stored in a separate `request` table with `request_spot`, `request_email`, `request_phone` junction tables
- Calendar: @event-calendar/core with drag/drop (own bookings only, future only)
- Stats: visible to all users (transparent building data)
- QR codes: generated client-side with `qrcode` package, "C" logo overlay
