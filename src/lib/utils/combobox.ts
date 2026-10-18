/**
 * Ranked contains-filter for comboboxes: matches first, `startsWith` hits on top.
 * Shared by the login flat picker, the spot-swap picker, and the mercato board.
 * Empty query returns no matches (callers that want “all when empty” keep their ternary).
 */
export function rankComboboxMatches<T>(
	items: T[],
	query: string,
	matchText: (item: T) => string,
	rankText: (item: T) => string = matchText
): T[] {
	const q = query.trim().toLowerCase();
	if (!q) return [];
	const matches = items.filter((item) => matchText(item).toLowerCase().includes(q));
	const startsWith = matches.filter((item) => rankText(item).toLowerCase().startsWith(q));
	const contains = matches.filter((item) => !rankText(item).toLowerCase().startsWith(q));
	return [...startsWith, ...contains];
}
