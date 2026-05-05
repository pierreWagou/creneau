type SSEClient = {
	id: string;
	controller: ReadableStreamDefaultController;
};

class SSEManager {
	private clients: Map<string, SSEClient> = new Map();

	addClient(id: string, controller: ReadableStreamDefaultController): void {
		this.clients.set(id, { id, controller });
	}

	removeClient(id: string): void {
		this.clients.delete(id);
	}

	broadcast(event: string, data: unknown): void {
		const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
		const encoder = new TextEncoder();
		const encoded = encoder.encode(message);

		for (const [id, client] of this.clients) {
			try {
				client.controller.enqueue(encoded);
			} catch {
				// Client disconnected, remove it
				this.clients.delete(id);
			}
		}
	}

	get clientCount(): number {
		return this.clients.size;
	}
}

// Singleton instance
export const sseManager = new SSEManager();
