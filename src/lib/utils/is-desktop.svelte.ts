import { DESKTOP_DRAWER_BREAKPOINT_PX } from '$lib/constants';

/**
 * Desktop media query (null on the server). Split out for unit tests —
 * the reactive wrapper below needs a component context.
 */
export function desktopQuery(breakpointPx: number): MediaQueryList | null {
	if (typeof window === 'undefined') return null;
	return window.matchMedia(`(min-width: ${breakpointPx}px)`);
}

/**
 * Reactive desktop flag shared by admin drawers (single source of truth —
 * a duplicated copy already caused a stuck-mobile drawer once).
 * Drawer direction flips at the `sm` breakpoint (matches `sm:max-w-xl`
 * drawer CSS) — deliberately different from the calendar's `md` split.
 * Must be called at component top level (runes init context).
 */
export function createIsDesktop(breakpointPx: number = DESKTOP_DRAWER_BREAKPOINT_PX) {
	let value = $state(false);

	$effect(() => {
		const mq = desktopQuery(breakpointPx);
		if (!mq) return;
		value = mq.matches;
		const onChange = (e: MediaQueryListEvent) => (value = e.matches);
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	});

	return {
		get value() {
			return value;
		}
	};
}
