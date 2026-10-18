import { describe, expect, it } from 'vitest';
import { statusBadgeClass } from './status';

describe('statusBadgeClass', () => {
	it('maps every lifecycle status to its flat-badge class', () => {
		expect(statusBadgeClass('active')).toBe('flat-badge-active');
		expect(statusBadgeClass('pending')).toBe('flat-badge-pending');
		expect(statusBadgeClass('inactive')).toBe('flat-badge-inactive');
		expect(statusBadgeClass('request')).toBe('flat-badge-request');
	});

	it('keeps bound spots neutral and limbo peach', () => {
		expect(statusBadgeClass('assigned')).toBe('flat-badge-inactive');
		expect(statusBadgeClass('shared')).toBe('flat-badge-request');
		expect(statusBadgeClass('unassigned')).toBe('flat-badge-pending');
	});
});
