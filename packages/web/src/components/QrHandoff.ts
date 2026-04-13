import QRCode from 'qrcode';
import { createSession, openSignaling, SIGNALING_URL } from '../transfer/signaling.js';
import { receiveFile, type TransferProgress } from '../transfer/peer.js';
import { runWorkerParse } from '../worker/client.js';

/** Mount the "Phone handoff" panel on the desktop. Invisible until clicked. */
export function mountQrHandoff(host: HTMLElement, onFileReceived: (f: File) => void): void {
  host.innerHTML = `
    <div class="qr-handoff" data-testid="qr-handoff">
      <button type="button" class="qr-toggle" data-testid="qr-start">
        📱 Upload from phone
      </button>
      <div class="qr-panel" data-testid="qr-panel" hidden>
        <p class="qr-hint">Scan this code with your phone, then choose the <code class="mono">export.zip</code> from Apple Health.</p>
        <div class="qr-canvas" data-testid="qr-canvas"></div>
        <p class="qr-status" data-testid="qr-status">Waiting for phone to connect…</p>
        <button type="button" class="qr-cancel" data-testid="qr-cancel">Cancel</button>
      </div>
    </div>
  `;

  const startBtn = host.querySelector<HTMLButtonElement>('[data-testid=qr-start]')!;
  const panel = host.querySelector<HTMLElement>('[data-testid=qr-panel]')!;
  const canvas = host.querySelector<HTMLElement>('[data-testid=qr-canvas]')!;
  const statusEl = host.querySelector<HTMLElement>('[data-testid=qr-status]')!;
  const cancelBtn = host.querySelector<HTMLButtonElement>('[data-testid=qr-cancel]')!;

  let cleanup: (() => void) | null = null;

  startBtn.addEventListener('click', async () => {
    startBtn.hidden = true;
    panel.hidden = false;
    statusEl.textContent = 'Opening session…';
    try {
      cleanup = await start();
    } catch (err) {
      statusEl.textContent = `Error: ${(err as Error).message}`;
    }
  });

  cancelBtn.addEventListener('click', () => {
    cleanup?.();
    cleanup = null;
    panel.hidden = true;
    startBtn.hidden = false;
  });

  async function start(): Promise<() => void> {
    const sessionId = await createSession();
    const receiverUrl = `${location.origin}/r/${sessionId}`;
    const qrSvg = await QRCode.toString(receiverUrl, { type: 'svg', width: 256, margin: 1 });
    canvas.innerHTML = qrSvg;
    statusEl.textContent = 'Waiting for phone to connect…';

    const signaling = await openSignaling(sessionId, 'desktop');
    let cancelled = false;

    receiveFile(signaling, (p: TransferProgress) => {
      statusEl.textContent = `Receiving: ${formatMb(p.bytesTransferred)} / ${formatMb(p.bytesTotal)}`;
    }).then(
      (file) => {
        if (cancelled) return;
        statusEl.textContent = `Received ${file.name}. Parsing locally…`;
        panel.hidden = true;
        startBtn.hidden = false;
        onFileReceived(file);
      },
      (err) => {
        if (!cancelled) statusEl.textContent = `Transfer failed: ${(err as Error).message}`;
      },
    );

    return () => {
      cancelled = true;
      signaling.close();
    };
  }

  function formatMb(bytes: number): string {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
}

/** Whether QR handoff is usable at all — requires WebRTC + signaling URL. */
export function isHandoffAvailable(): boolean {
  return (
    typeof RTCPeerConnection !== 'undefined' &&
    typeof WebSocket !== 'undefined' &&
    !!SIGNALING_URL &&
    !SIGNALING_URL.includes('example.workers.dev')
  );
}

/** For the embedded auto-bootstrap, confirm we're not in a Worker context. */
export { runWorkerParse };
