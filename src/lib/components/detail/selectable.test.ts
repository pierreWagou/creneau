import { describe, expect, it } from 'vitest';
import { selectableCardClass } from './selectable';

describe('selectableCardClass', () => {
	it('marks the selected frame unmistakably', () => {
		const cls = selectableCardClass(true, false);
		expect(cls).toContain('border-primary');
		expect(cls).toContain('bg-primary/5');
		expect(cls).not.toContain('cursor-not-allowed');
	});

	it('marks disabled frames as inert', () => {
		const cls = selectableCardClass(false, true);
		expect(cls).toContain('cursor-not-allowed');
		expect(cls).toContain('opacity-70');
		expect(cls).not.toContain('border-primary');
	});

	it('renders the neutral frame by default', () => {
		const cls = selectableCardClass(false, false);
		expect(cls).toContain('border-border');
		expect(cls).toContain('hover:bg-muted/50');
	});

	it('stacks content vertically on demand', () => {
		expect(selectableCardClass(false, false, true)).toContain('flex-col');
		expect(selectableCardClass(false, false)).toContain('items-center');
	});
});
