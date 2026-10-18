/**
 * Client-safe motion preference: true when the OS asks for reduced motion.
 * Single home for the `prefers-reduced-motion` query (flight strip, mercato).
 */
export function prefersReducedMotion(): boolean {
	return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
