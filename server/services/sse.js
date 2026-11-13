const clients = new Set();

export function addSseClient(res) {
  clients.add(res);
  res.on('close', () => {
    clients.delete(res);
  });
}

export function broadcastEvent(eventName, payload = {}) {
  const data = JSON.stringify({
    ...payload,
    timestamp: new Date().toISOString(),
  });
  for (const res of clients) {
    try {
      res.write(`event: ${eventName}\n`);
      res.write(`data: ${data}\n\n`);
    } catch {
      clients.delete(res);
    }
  }
}

export const broadcastSse = broadcastEvent;

