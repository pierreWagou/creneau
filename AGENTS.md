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
- All FKs cascade on delete

### API Conventions

- Auth: return `401` for unauthenticated, `403` for unauthorized (split guard pattern)
- All POST/PATCH/DELETE handlers that call `request.json()` must catch `SyntaxError` and return `400`
- Error response format: `json({ error: "..." }, { status: N })`
- Rate limiting on login + activation (5 attempts / 15 min lockout per flat)

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
- Server utilities in `src/lib/server/` (auth, bookings, availability, sse, rate-limit, db)
- Time utilities in `src/lib/utils/time.ts`

### Git & CI

- Pre-commit: `npx biome check --write .` → `git add -u` → `npm run check`
- CI: biome ci → svelte-check → vitest → build → playwright (E2E)
- CD: semantic-release on `main` → bumps version → builds Docker image → pushes `ghcr.io/pierrewagou/creneau:latest` and `ghcr.io/pierrewagou/creneau:<version>` to GHCR
- SSE events: `booking_created`, `booking_cancelled`, `booking_updated`

## Deployment

Creneau is deployed via **Dokploy** on wagoulab (`apps.wagou.fr`). Two environments:

| Environment | URL | Image | `SEED_ON_INIT` | Data |
|---|---|---|---|---|
| Production | `creneau.wagou.fr` | `ghcr.io/pierrewagou/creneau:latest` | not set | bind mount `/var/lib/creneau:/app/data` |
| Preview | `creneau-preview.wagou.fr` | `ghcr.io/pierrewagou/creneau:latest` | `true` | named volume (ephemeral-ish) |

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
│   │   ├── sse.ts           # SSE broadcaster
│   │   └── rate-limit.ts    # In-memory rate limiter
│   ├── constants.ts         # PIN_MIN_LENGTH, PIN_MAX_LENGTH, DISPLAY_NAME_MAX_LENGTH, CALENDAR_LOOKAHEAD_MONTHS, ACTIVATION_CODE_TTL_MS, MAX_BOOKING_HOURS, ACTIVATION_CODE_LENGTH, MAX_FLAT_BULK_SIZE
│   ├── types.ts             # SessionFlat, BookingWithFlat, SpotTimeline, DAY_START/DAY_END
│   └── utils/time.ts        # padH, getHourFromISO, formatDateISO, TIME_BLOCKS
├── routes/
│   ├── (auth)/              # Login, activate, setup (unauthenticated)
│   ├── (app)/               # Authenticated pages (calendar, book, my-bookings, stats, account, admin)
│   └── api/                 # REST endpoints + SSE
├── app.css                  # Theme + @layer components (semantic classes) + @layer base (global form styles)
└── app.html                 # Shell with favicon
```

## Key Decisions

- Setup wizard: first visitor creates admin (no secrets in config, accepts race condition for homeserver)
- Flat lifecycle: Inactif → En attente (24h activation code) → Actif / Expiré (code TTL elapsed → back to Inactif via admin reset)
- Calendar: @event-calendar/core with drag/drop (own bookings only, future only)
- Stats: visible to all users (transparent building data)
- QR codes: generated client-side with `qrcode` package, "C" logo overlay
