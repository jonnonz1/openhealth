# @openhealth/signaling

A thin Cloudflare Worker + Durable Object that relays WebRTC signalling
between two openhealth browsers. Files never pass through this server —
only ~1 KB of handshake metadata.

## Deploy

```bash
pnpm install
cd packages/signaling
npx wrangler login          # one-time, opens browser
npx wrangler deploy         # publishes to openhealth-signaling.<account>.workers.dev
```

Bind the resulting URL in the web app via the `VITE_SIGNALING_URL` env
variable (e.g. `wss://openhealth-signaling.example.workers.dev`).

## Routes

| Path                          | Purpose                                 |
|-------------------------------|-----------------------------------------|
| `POST /session`               | Create a new session; returns `{sessionId}` |
| `WS /session/:id/desktop`     | Desktop joins the session (offerer)     |
| `WS /session/:id/mobile`      | Mobile joins the session (answerer)     |

## Privacy properties

- No file content ever touches the server. Only WebRTC signalling JSON.
- Sessions are ephemeral — held only in Durable Object memory, destroyed
  when both WebSockets close.
- CORS is open-by-origin (reflects `Origin`). Tighten for production if
  you want to restrict to `https://openhealth.app`.
