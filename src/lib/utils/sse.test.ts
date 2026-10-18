import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBookingSSE } from './sse';

type Listener = (e: { data: string }) => void;

interface FakeSource {
	emit: (type: string, data: string) => void;
	close: ReturnType<typeof vi.fn>;
}

function stubEventSource(): { emit: FakeSource['emit']; close: ReturnType<typeof vi.fn> } {
	const listeners = new Map<string, Listener[]>();
	const close = vi.fn();
	const emit = (type: string, data: string) => {
		for (const cb of listeners.get(type) ?? []) cb({ data });
	};
	class FakeEventSource {
		constructor(public url: string) {}
		addEventListener(type: string, cb: Listener): void {
			listeners.set(type, [...(listeners.get(type) ?? []), cb]);
		}
		close = close;
	}
	vi.stubGlobal('EventSource', FakeEventSource);
	return { emit, close };
}

beforeEach(() => {
	vi.unstubAllGlobals();
});

describe('createBookingSSE', () => {
	it('parses and dispatches each event to its handler', () => {
		const { emit } = stubEventSource();
		const onCreated = vi.fn();
		const onCancelled = vi.fn();
		const onUpdated = vi.fn();
		createBookingSSE({ onCreated, onCancelled, onUpdated });

		emit('booking_created', '{"id":7}');
		emit('booking_cancelled', '{"id":7}');
		emit('booking_updated', '{"id":8}');

		expect(onCreated).toHaveBeenCalledWith({ id: 7 });
		expect(onCancelled).toHaveBeenCalledWith({ id: 7 });
		expect(onUpdated).toHaveBeenCalledWith({ id: 8 });
	});

	it('skips malformed payloads without throwing', () => {
		const { emit } = stubEventSource();
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		try {
			const onCreated = vi.fn();
			createBookingSSE({ onCreated });
			expect(() => emit('booking_created', 'not-json{{{')).not.toThrow();
			expect(onCreated).not.toHaveBeenCalled();
			expect(warn).toHaveBeenCalled();
		} finally {
			warn.mockRestore();
		}
	});

	it('ignores events with no registered handler', () => {
		const { emit } = stubEventSource();
		createBookingSSE({});
		expect(() => emit('booking_created', '{"id":7}')).not.toThrow();
	});

	it('destroy closes the stream', () => {
		const { close } = stubEventSource();
		const { destroy } = createBookingSSE({});
		destroy();
		expect(close).toHaveBeenCalledOnce();
	});
});
