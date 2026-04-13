// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSession, openSignaling, type SignalMessage } from '../src/transfer/signaling.js';

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  url: string;
  sent: string[] = [];
  private listeners = new Map<string, Array<(e: Event | MessageEvent) => void>>();

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
    queueMicrotask(() => this.fire('open', new Event('open')));
  }

  addEventListener(name: string, cb: (e: Event | MessageEvent) => void): void {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name)!.push(cb);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.fire('close', new Event('close'));
  }

  emitMessage(msg: SignalMessage): void {
    this.fire('message', new MessageEvent('message', { data: JSON.stringify(msg) }));
  }

  private fire(name: string, event: Event | MessageEvent): void {
    for (const cb of this.listeners.get(name) ?? []) cb(event);
  }
}

describe('createSession', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ sessionId: 'abc123xyz456abc123' }), { status: 200 }),
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it('POSTs /session and returns the id', async () => {
    const id = await createSession('wss://relay.test');
    expect(id).toBe('abc123xyz456abc123');
    expect(fetch).toHaveBeenCalledWith('https://relay.test/session', { method: 'POST' });
  });

  it('throws on non-OK response', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('err', { status: 500 }),
    );
    await expect(createSession('wss://relay.test')).rejects.toThrow(/500/);
  });
});

describe('openSignaling', () => {
  const original = globalThis.WebSocket;
  beforeEach(() => {
    FakeWebSocket.instances = [];
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = FakeWebSocket;
  });
  afterEach(() => {
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = original;
  });

  it('sends and receives signalling messages', async () => {
    const chanPromise = openSignaling('id1234567890abcd', 'desktop', 'wss://relay.test');
    const chan = await chanPromise;
    const ws = FakeWebSocket.instances[0]!;
    expect(ws.url).toBe('wss://relay.test/session/id1234567890abcd/desktop');

    const received: SignalMessage[] = [];
    chan.onMessage((m) => received.push(m));
    ws.emitMessage({ type: 'peer-joined' });
    expect(received).toEqual([{ type: 'peer-joined' }]);

    chan.send({ type: 'ice', candidate: { candidate: 'a', sdpMid: '0' } });
    expect(JSON.parse(ws.sent[0]!).type).toBe('ice');
  });

  it('notifies on close', async () => {
    const chan = await openSignaling('id1234567890abcd', 'mobile', 'wss://relay.test');
    const closed = vi.fn();
    chan.onClose(closed);
    FakeWebSocket.instances[0]!.close();
    expect(closed).toHaveBeenCalled();
  });
});
