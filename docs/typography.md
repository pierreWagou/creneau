# Typography scale

Living inventory of text roles and sizes across the app. Goal: one role → one size. Last audited 2026-10-04 (all 14px bumps applied, see git log).

## The scale

| Tier | Classes | Size | Used for |
|------|---------|------|----------|
| Display | `text-2xl font-bold tracking-tight` | 20px | Page `h1`, public `Card.Title` (login/setup/activate/request/about), `Guide administrateur` |
| Stat | `stat-value` → `text-2xl font-bold` | 20px | Stats numbers (`27h`, counts). No `tracking-tight` (differs from Display — see open items) |
| Section head | `text-lg font-semibold` | 18px | `my-bookings` `h3` (À venir / Passées), layout brand, avatar `lg` glyph |
| Title | `text-base font-semibold` | 16px | Drawer titles (`Réservation #12`, `Lot A00`), mosaic chip numbers, flat name rows |
| Title (shadcn) | `text-base font-medium` | 16px | `Dialog.Title`, `Drawer.Title`, `AlertDialog.Title`, `Card.Title` (default slot) |
| Body / value | `text-sm` (+ `font-semibold` for values) | 14px | All reading content: names, emails, phones, descriptions, dates, hours values, hints, explainer paragraphs, empty states |
| Body muted | `text-sm text-muted-foreground` | 14px | Secondary lines (display names, dates, hints, QR instructions) |
| Label | `text-xs font-medium … uppercase tracking-wide` | 12px | Section labels (`PLACES DE PARKING`), field sub-labels (`DESCRIPTION`, `E-mails (1)`), stat labels |
| Chrome | `text-xs` (badges `h-5`, pills `h-7`, tabs, tooltips) | 12px | Pills, tabs, `Badge`, tooltips, pagination, counts, step circles, form errors, staged captions, expiry countdown |
| Dense data | `text-[10px]` | 10px | Calendar/book time-grid only |
| Code | `font-mono` (+ `text-sm`) | 14px | Activation codes (display + readonly input) |

Enforcement points (change here, not at call sites): `app.css` (`page-title`, `stat-value`, `stat-label`), `detail/*` primitives, `statusBadgeClass`, shadcn `ui/` internals (never edited directly).

## Deliberate exceptions (do not "fix")

- Inputs render `text-base` on touch, `md:text-sm` on desktop (shadcn `Input` — prevents iOS auto-zoom).
- Avatar glyph sizes follow circle size (`lg`→18px, `md/sm`→14px), not the text tier.
- `version` stamp, `Créneaux rapides` group label, slot buttons, conflict-dialog micro-labels, mosaic `conflictTip`/`Ajouter`: chrome/density, stay 12px.
- Form errors/hints, validation tips, staged captions, expiry countdown: control-adjacent microcopy, stay 12px.
- `E-MAILS`/`DESCRIPTION`-style sub-labels share the Label tier (12px uppercase); their *values* are Body tier. That size step is the hierarchy — do not bump sub-labels to 14px.

## Open items (standardization candidates)

1. `stat-value` lacks `tracking-tight` while Display has it — align or drop from Display (trivial, pick one).
2. shadcn titles use `font-medium` where app drawer titles use `font-semibold` at the same 16px — decide one weight for titles.
3. Mosaic chip description went 12px → 14px (2026-10-04): confirm grid density visually; revert to micro-label if chips feel crowded.
4. Empty-state strings (`Aucune place…`) — verify they render at Body tier, not browser default.
