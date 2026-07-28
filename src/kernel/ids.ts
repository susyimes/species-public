export type IdFactory = (prefix: string) => string;

export function createSequentialIdFactory(seed = 0): IdFactory {
  const counters = new Map<string, number>();

  return (prefix: string): string => {
    const next = (counters.get(prefix) ?? seed) + 1;
    counters.set(prefix, next);
    return `${prefix}_${String(next).padStart(6, "0")}`;
  };
}

export function createRef(kind: string, id: string): string {
  return `${kind}:${id}`;
}

export function eventRef(eventId: string): string {
  return createRef("event", eventId);
}

export function messageRef(messageId: string): string {
  return createRef("message", messageId);
}
