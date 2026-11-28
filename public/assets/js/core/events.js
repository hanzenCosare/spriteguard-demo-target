const listeners = new Map();

export function on(eventName, handler) {
  if (!listeners.has(eventName)) {
    listeners.set(eventName, new Set());
  }
  listeners.get(eventName).add(handler);
  return () => off(eventName, handler);
}

export function off(eventName, handler) {
  const bucket = listeners.get(eventName);
  if (bucket) {
    bucket.delete(handler);
  }
}

export function emit(eventName, payload) {
  const bucket = listeners.get(eventName);
  if (!bucket) return;
  bucket.forEach((handler) => {
    try {
      handler(payload);
    } catch (err) {
      console.error(`[events] handler error for "${eventName}":`, err);
    }
  });
}
