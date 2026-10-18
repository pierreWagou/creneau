import { describe, expect, it, vi } from 'vitest';
import { SSEManager } from './sse';

function fakeController(fail = false): ReadableStreamDefaultController {
	return {
		enqueue: fail
			? vi.fn(() => {
					throw new Error('closed');
				})
			: vi.fn(),
		close: vi.fn(),
		error: vi.fn(),
		desiredSize: 1
	} as unknown as ReadableStreamDefaultController;
}

describe('SSEManager', () => {
	it('broadcasts to every connected client', () => {
		const manager = new SSEManager();
		const a = fakeController();
		const b = fakeController();
		manager.addClient('a', a);
		manager.addClient('b', b);

		manager.broadcast('booking_created', { id: 1 });

		const expected = new TextEncoder().encode('event: booking_created\ndata: {"id":1}\n\n');
		expect(a.enqueue).toHaveBeenCalledWith(expected);
		expect(b.enqueue).toHaveBeenCalledWith(expected);
	});

	it('drops disconnected clients instead of throwing', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		try {
			const manager = new SSEManager();
			const dead = fakeController(true);
			const live = fakeController();
			manager.addClient('dead', dead);
			manager.addClient('live', live);

			expect(() => manager.broadcast('booking_created', {})).not.toThrow();
			expect(live.enqueue).toHaveBeenCalledTimes(1);

			// Second broadcast skips the dropped client entirely
			(live.enqueue as ReturnType<typeof vi.fn>).mockClear();
			manager.broadcast('booking_created', {});
			expect(dead.enqueue).toHaveBeenCalledTimes(1);
			expect(live.enqueue).toHaveBeenCalledTimes(1);
		} finally {
			warn.mockRestore();
		}
	});

	it('removeClient stops delivery', () => {
		const manager = new SSEManager();
		const controller = fakeController();
		manager.addClient('a', controller);
		manager.removeClient('a');

		manager.broadcast('booking_created', {});

		expect(controller.enqueue).not.toHaveBeenCalled();
	});

	it('re-adding the same id replaces the controller', () => {
		const manager = new SSEManager();
		const old = fakeController();
		const current = fakeController();
		manager.addClient('a', old);
		manager.addClient('a', current);

		manager.broadcast('booking_created', {});

		expect(old.enqueue).not.toHaveBeenCalled();
		expect(current.enqueue).toHaveBeenCalledTimes(1);
	});
});
