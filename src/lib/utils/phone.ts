/** Normalize a French phone number to international format (e.g. +33612345678) */
export function formatPhone(raw: string): string {
	const stripped = raw.replace(/[^\d+]/g, '');
	let digits = stripped;
	if (digits.startsWith('00')) {
		digits = '+' + digits.slice(2);
	} else if (digits.startsWith('0')) {
		digits = '+33' + digits.slice(1);
	}
	return digits;
}

/** Format E.164 phone for human-readable display: +33612345678 → +33 6 12 34 56 78 */
export function displayPhone(e164: string): string {
	if (!e164.startsWith('+') || e164.length < 3) return e164;
	const countryCode = e164.slice(0, 3);
	const rest = e164.slice(3);
	if (countryCode === '+33' && rest.length === 9) {
		return `${countryCode} ${rest[0]} ${rest.slice(1, 3)} ${rest.slice(3, 5)} ${rest.slice(5, 7)} ${rest.slice(7, 9)}`;
	}
	const groups = rest.match(/.{1,2}/g);
	return groups ? `${countryCode} ${groups.join(' ')}` : e164;
}
