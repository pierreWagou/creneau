/**
 * Selectable-card frame shared by exclusive-choice UIs (conflict resolver
 * pick cards, destination dialog options). Selected state is unmistakable
 * (primary border + tint); keep the class strings in one place so every
 * pick-card in the app reads as the same control.
 */
export function selectableCardClass(selected: boolean, disabled: boolean, vertical = false): string {
	const base = 'flex cursor-pointer rounded-lg border p-2.5 text-left transition-colors';
	const layout = vertical ? 'min-w-0 flex-1 flex-col items-stretch gap-2' : 'items-center gap-2';
	if (disabled) return `${base} ${layout} cursor-not-allowed border-border opacity-70`;
	if (selected) return `${base} ${layout} border-primary bg-primary/5 hover:border-primary`;
	return `${base} ${layout} border-border hover:border-foreground/30 hover:bg-muted/50`;
}
