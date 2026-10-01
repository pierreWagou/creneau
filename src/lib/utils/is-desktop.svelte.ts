/**
 * Reactive desktop flag shared by admin drawers (single source of truth —
 * a duplicated copy already caused a stuck-mobile drawer once).
 * Must be called at component top level (runes init context).
 */
export function createIsDesktop() {
	let value = $state(false);

	$effect(() => {
		const mq = window.matchMedia('(min-width: 640px)');
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
