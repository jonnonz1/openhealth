/**
 * Thin wrapper around the WebSocket used to exchange SDP + ICE candidates
 * with the other peer via the openhealth signaling relay.
 */

/** Shape of every signalling envelope exchanged between peers. */
export type SignalMessage =
  | { type: 'offer'; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; sdp: RTCSessionDescriptionInit }
  | { type: 'ice'; candidate: RTCIceCandidateInit }
  | { type: 'peer-joined' }
  | { type: 'peer-left' };

/** Signalling URL defaults, override with `VITE_SIGNALING_URL`. */
export const SIGNALING_URL =
  (import.meta as { env?: Record<string, string> }).env?.['VITE_SIGNALING_URL'] ??
  'wss://openhealth-signaling.example.workers.dev';

/** Ask the relay to mint a fresh session id. */
export async function createSession(baseUrl = SIGNALING_URL): Promise<string> {
  const httpUrl = baseUrl.replace(/^ws/, 'http').replace(/\/$/, '');
  const res = await fetch(`${httpUrl}/session`, { method: 'POST' });
  if (!res.ok) throw new Error(`session create failed: ${res.status}`);
  const body = (await res.json()) as { sessionId: string };
  return body.sessionId;
}

/** Minimal signalling channel. Fires `message` for every frame from the peer. */
export interface SignalingChannel {
  send(msg: SignalMessage): void;
  onMessage(cb: (msg: SignalMessage) => void): () => void;
  onClose(cb: () => void): void;
  close(): void;
}

/** Open a WebSocket to the relay as the given role. */
export function openSignaling(
  sessionId: string,
  role: 'desktop' | 'mobile',
  baseUrl = SIGNALING_URL,
): Promise<SignalingChannel> {
  return new Promise((resolvePromise, rejectPromise) => {
    const url = `${baseUrl}/session/${encodeURIComponent(sessionId)}/${role}`;
    const ws = new WebSocket(url);
    const listeners: Array<(m: SignalMessage) => void> = [];
    let closeCb: (() => void) | null = null;

    ws.addEventListener('open', () => {
      resolvePromise({
        send(msg) {
          ws.send(JSON.stringify(msg));
        },
        onMessage(cb) {
          listeners.push(cb);
          return () => {
            const i = listeners.indexOf(cb);
            if (i >= 0) listeners.splice(i, 1);
          };
        },
        onClose(cb) {
          closeCb = cb;
        },
        close() {
          ws.close();
        },
      });
    });
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data as string) as SignalMessage;
      for (const l of listeners) l(msg);
    });
    ws.addEventListener('error', () => rejectPromise(new Error('signaling ws error')));
    ws.addEventListener('close', () => closeCb?.());
  });
}
