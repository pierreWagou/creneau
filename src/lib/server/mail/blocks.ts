import { latte } from '$lib/colors';
import { dateKey, formatBookingEndFr, formatCompactDateTimeFr, noonDate } from '$lib/utils/time';
import { escapeHtml, shellClose, shellFooter, shellHead, shellHeader, shellOpen } from './shell';

export function formatSlot(startTime: string, endTime: string): string {
	return `${formatCompactDateTimeFr(startTime)} → ${formatBookingEndFr(endTime)}`;
}

/** Shared shell for short informational mails (same palette as activation). */
export function infoShell(heading: string, intro: string, body: string, guideUrl: string | null = null): string {
	return (
		shellHead(`${escapeHtml(heading)} — Créneau`) +
		shellOpen() +
		shellHeader() +
		`          <tr>
            <td style="padding:32px;">
              <h2 class="body-text" style="margin:0 0 16px;color:${latte.heading};font-size:20px;font-weight:600;">${escapeHtml(heading)}</h2>
              <p class="body-text" style="margin:0 0 16px;color:${latte.text};font-size:15px;line-height:1.6;">${intro}</p>
              ${body}
            </td>
          </tr>` +
		shellFooter(guideUrl) +
		shellClose()
	);
}

/** Eyebrow caption over a bold value (rejection Motif — long free text reads better stacked). */
export function captionedValue(label: string, value: string): string {
	return `${slotCaption(label)}<p class="body-text" style="margin:0 0 8px;color:${latte.heading};font-size:15px;font-weight:700;">${escapeHtml(value)}</p>`;
}

/**
 * Tinted info container — the same treatment as the activation code block
 * (`latte.base`, 8px radius, 20px padding). Reuses the `code-bg` class so the
 * existing dark rule flips it for free, identically.
 */
export function tintBlock(innerHtml: string): string {
	return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
                <tr>
                  <td class="code-bg" style="background-color:${latte.base};border-radius:8px;padding:20px;">${innerHtml}</td>
                </tr>
              </table>`;
}

/**
 * Car icon for mail: the exact Lucide `car-front` vector the app renders
 * (`@lucide/svelte`, ISC — https://lucide.dev/icons/car-front), inlined as
 * static SVG (external stylesheets, icon fonts and components don't survive
 * mail; Gmail/Outlook strip the element but keep the adjacent number text,
 * degrading to a number-only pill — never broken). `stroke="currentColor"`
 * inherits the pill text color, so light/dark theming follows for free.
 */
function carIconMail(): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8" /><path d="M7 14h.01" /><path d="M17 14h.01" /><rect width="18" height="8" x="3" y="10" rx="2" /><path d="M5 18v2" /><path d="M19 18v2" /></svg>`;
}

/**
 * Clock icon for mail: Lucide `clock` vector (`@lucide/svelte`, ISC —
 * https://lucide.dev/icons/clock), same inline-SVG technique and graceful
 * degradation as the car icon.
 */
function clockIconMail(): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>`;
}

/**
 * Spot chip for mail: mimics the app `SpotChip` (md, shared blue) as closely
 * as mail-safe CSS allows — rounded bordered pill, semibold number, car icon.
 */
const SPOT_CHIP_TINT_BG = latte.chipTintBlue;

function spotChipMail(spotNumber: string, disabled = false): string {
	const border = disabled ? latte.overlay0 : latte.blue;
	const text = disabled ? latte.overlay0 : latte.blue;
	const bg = disabled ? 'transparent' : SPOT_CHIP_TINT_BG;
	const cls = disabled ? 'chip chip-disabled' : 'chip';
	return `<span class="${cls}" style="display:inline-block;border:1px solid ${border};border-radius:10px;background-color:${bg};padding:6px 12px;font-size:14px;font-weight:700;color:${text};">${carIconMail()}&nbsp;${escapeHtml(spotNumber)}</span>`;
}

function slotCaption(label: string): string {
	return `<p class="muted" style="margin:0 0 6px;color:${latte.subtext0};font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">${escapeHtml(label)}</p>`;
}

/** Noon-anchored date for locale formatting (DST-immune, date part only). */
function slotDay(iso: string): Date {
	return noonDate(dateKey(iso));
}

function monthBadgeLabel(iso: string): string {
	return slotDay(iso).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '').toUpperCase();
}

/** Calendar badge: blue month tab over a big day number (table layout for Outlook).
 * Disabled renders the void treatment (grey + struck hours) for cancelled
 * bookings and superseded old slots. */
function dateBadge(iso: string, disabled = false): string {
	const monthBg = disabled ? latte.surface1 : latte.blue;
	const monthText = disabled ? latte.subtext0 : latte.white;
	const dayBorder = disabled ? latte.surface1 : latte.blue;
	const dayText = disabled ? latte.overlay0 : latte.heading;
	const monthCls = disabled ? 'badge-month badge-month-disabled' : 'badge-month';
	const dayCls = disabled ? 'badge-day badge-day-disabled' : 'badge-day';
	return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0;">
                <tr>
                  <td class="${monthCls}" align="center" style="background-color:${monthBg};color:${monthText};font-size:10px;font-weight:700;letter-spacing:1px;border-radius:6px 6px 0 0;padding:3px 10px;">${monthBadgeLabel(iso)}</td>
                </tr>
                <tr>
                  <td class="${dayCls}" align="center" style="border:1px solid ${dayBorder};border-top:none;border-radius:0 0 6px 6px;padding:3px 10px;font-size:20px;font-weight:700;color:${dayText};">${slotDay(iso).getDate()}</td>
                </tr>
              </table>`;
}

/**
 * Badge-grouped hours: single-day renders badge + clock + `start → end` and
 * nothing else; spanning days render each badge grouped with its own day's
 * hour (`badge clock start → badge clock end`). Same-day detection is
 * date-part based — correct automatically thanks to the midnight fold
 * (`T24` ends stay same-day).
 */
function slotBadgeLine(startISO: string, endISO: string, disabled = false): string {
	const startHM = startISO.slice(11, 16);
	const endHM = endISO.slice(11, 16);
	const hoursColor = disabled ? latte.overlay0 : latte.heading;
	const hoursStrike = disabled ? 'text-decoration:line-through;' : '';
	const hoursCls = disabled ? 'body-text hours-void' : 'body-text';
	const hours = (hm: string) =>
		`<span class="${hoursCls}" style="font-size:18px;font-weight:700;${hoursStrike}color:${hoursColor};">${clockIconMail()}${hm}</span>`;
	const hoursRange = (a: string, b: string) =>
		`<span class="${hoursCls}" style="font-size:18px;font-weight:700;${hoursStrike}color:${hoursColor};">${clockIconMail()}${a} → ${b}</span>`;
	// One badge + hours group (shared by single-day rows and each multi-day leg).
	const groupRow = (iso: string, hm: string) =>
		`<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0;">
                <tr>
                  <td valign="top" style="padding-right:12px;">${dateBadge(iso, disabled)}</td>
                  <td valign="middle" class="body-text" style="color:${latte.text};font-size:18px;font-weight:700;">${hours(hm)}</td>
                </tr>
              </table>`;
	if (dateKey(startISO) === dateKey(endISO)) {
		return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
                <tr>
                  <td valign="top" style="padding-right:12px;">${dateBadge(startISO, disabled)}</td>
                  <td valign="middle" class="body-text" style="color:${latte.text};font-size:18px;font-weight:700;">${hoursRange(startHM, endHM)}</td>
                </tr>
              </table>`;
	}
	return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
                <tr>
                  <td valign="top">${groupRow(startISO, startHM)}</td>
                </tr>
                <tr>
                  <td align="center" class="body-text" style="padding:2px 0;color:${latte.subtext0};font-size:16px;font-weight:700;">↓</td>
                </tr>
                <tr>
                  <td valign="top">${groupRow(endISO, endHM)}</td>
                </tr>
              </table>`;
}

/** Elegant booking summary: labeled chip + badge line (confirmation/cancelled).
 * Disabled renders the void treatment for cancelled bookings. */
export function bookingSlotBlock(spotNumber: string, startTime: string, endTime: string, disabled = false): string {
	return `${slotCaption('Place réservée')}<p style="margin:0 0 10px;">${spotChipMail(spotNumber, disabled)}</p>${slotCaption('Créneau')}${slotBadgeLine(startTime, endTime, disabled)}`;
}

/** Elegant move summary: live chip, void old slot, live new slot. The spot
 * itself didn't die — only the superseded slot renders void. A cross-spot
 * move renders the superseded spot chip (void) arrowing into the new one. */
export function bookingMoveBlock(
	spotNumber: string,
	oldStartTime: string,
	oldEndTime: string,
	newStartTime: string,
	newEndTime: string,
	oldSpotNumber: string | null = null
): string {
	const spotChanged = oldSpotNumber !== null && oldSpotNumber !== spotNumber;
	const chipRow = spotChanged
		? `${spotChipMail(oldSpotNumber, true)}<span class="body-text" style="color:${latte.subtext0};font-size:14px;font-weight:700;">&nbsp;→&nbsp;</span>${spotChipMail(spotNumber)}`
		: spotChipMail(spotNumber);
	return (
		`${slotCaption('Place réservée')}<p style="margin:0 0 10px;">${chipRow}</p>` +
		`${slotCaption('Ancien créneau')}${slotBadgeLine(oldStartTime, oldEndTime, true)}` +
		`<div style="height:10px;line-height:10px;">&nbsp;</div>` +
		`${slotCaption('Nouveau créneau')}${slotBadgeLine(newStartTime, newEndTime)}`
	);
}

/** Centered solid CTA button — activation and confirmation share it. */
export function ctaButton(url: string, label: string): string {
	return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
                <tr>
                  <td align="center">
                    <a class="btn" href="${escapeHtml(url)}" style="display:inline-block;background-color:${latte.blue};color:${latte.white};text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">${escapeHtml(label)}</a>
                  </td>
                </tr>
              </table>`;
}
