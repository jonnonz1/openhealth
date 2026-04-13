import { openSignaling } from '../transfer/signaling.js';
import { sendFile, type TransferProgress } from '../transfer/peer.js';

/** Mount the mobile-side uploader panel at `/r/:sessionId`. */
export function mountReceiver(host: HTMLElement, sessionId: string): void {
  host.innerHTML = `
    <div class="receiver" data-testid="receiver">
      <h2>openhealth — phone handoff</h2>
      <p>Select your Apple Health <code class="mono">export.zip</code>. It will transfer directly to your desktop browser over an encrypted peer-to-peer channel. Nothing is uploaded to a server.</p>
      <label class="receiver-file">
        <input type="file" accept=".zip,.xml" data-testid="receiver-input" />
        <span>Choose file</span>
      </label>
      <p class="receiver-status" data-testid="receiver-status"></p>
      <div class="progress-bar receiver-progress" hidden data-testid="receiver-progress">
        <span class="progress-fill" data-testid="receiver-progress-fill"></span>
      </div>
    </div>
  `;

  const input = host.querySelector<HTMLInputElement>('[data-testid=receiver-input]')!;
  const statusEl = host.querySelector<HTMLElement>('[data-testid=receiver-status]')!;
  const bar = host.querySelector<HTMLElement>('[data-testid=receiver-progress]')!;
  const fill = host.querySelector<HTMLElement>('[data-testid=receiver-progress-fill]')!;

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    statusEl.textContent = 'Connecting to desktop…';
    try {
      const signaling = await openSignaling(sessionId, 'mobile');
      bar.hidden = false;
      await sendFile(signaling, file, (p: TransferProgress) => {
        const pct = p.bytesTotal > 0 ? (p.bytesTransferred / p.bytesTotal) * 100 : 0;
        fill.style.width = `${pct.toFixed(1)}%`;
        statusEl.textContent = `Sending ${file.name}: ${pct.toFixed(1)}%`;
      });
      statusEl.textContent = `Sent ${file.name} — check your desktop browser.`;
      signaling.close();
    } catch (err) {
      statusEl.textContent = `Transfer failed: ${(err as Error).message}`;
    }
  });
}
