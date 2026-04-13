/**
 * openhealth signaling relay — Cloudflare Worker + Durable Object.
 *
 * Relays WebRTC signaling (SDP offers/answers + ICE candidates) between
 * two openhealth browsers. The Worker does NOT see the health file; only
 * ~1 KB of handshake metadata passes through it.
 *
 * Lifecycle:
 *   1. Desktop POSTs /session → Worker returns { sessionId } (16 bytes random).
 *   2. Desktop opens WS at /session/:id/desktop.
 *   3. Mobile scans QR → opens WS at /session/:id/mobile.
 *   4. Worker pipes every message from one peer to the other, verbatim.
 *   5. When either side disconnects, the Durable Object closes the other.
 */

export interface Env {
  SESSIONS: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/session' && request.method === 'POST') {
      const sessionId = randomSessionId();
      return json({ sessionId }, corsHeaders(request));
    }

    const match = url.pathname.match(/^\/session\/([A-Za-z0-9_-]{16,})\/(desktop|mobile)$/);
    if (match) {
      const id = env.SESSIONS.idFromName(match[1]!);
      const stub = env.SESSIONS.get(id);
      return stub.fetch(request);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    return new Response('openhealth signaling relay', {
      status: 200,
      headers: corsHeaders(request),
    });
  },
};

/** Durable Object: one instance per session. Holds at most two WebSockets. */
export class Session {
  private desktop: WebSocket | null = null;
  private mobile: WebSocket | null = null;

  constructor(_state: DurableObjectState, _env: Env) {}

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }

    const role = new URL(request.url).pathname.endsWith('/desktop') ? 'desktop' : 'mobile';
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    if (role === 'desktop') {
      if (this.desktop) {
        server.close(4000, 'desktop already connected');
        return new Response(null, { status: 101, webSocket: client });
      }
      this.desktop = server;
    } else {
      if (this.mobile) {
        server.close(4000, 'mobile already connected');
        return new Response(null, { status: 101, webSocket: client });
      }
      this.mobile = server;
      if (this.desktop) this.desktop.send(JSON.stringify({ type: 'peer-joined' }));
    }

    server.addEventListener('message', (event) => {
      const partner = role === 'desktop' ? this.mobile : this.desktop;
      if (partner) partner.send(event.data);
    });

    server.addEventListener('close', () => {
      if (role === 'desktop') this.desktop = null;
      else this.mobile = null;
      const partner = role === 'desktop' ? this.mobile : this.desktop;
      if (partner) {
        try {
          partner.send(JSON.stringify({ type: 'peer-left' }));
          partner.close(1000, 'peer disconnected');
        } catch {
          /* ignore */
        }
      }
    });

    return new Response(null, { status: 101, webSocket: client });
  }
}

function randomSessionId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('');
}

function json(body: unknown, headers: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('Origin') ?? '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
