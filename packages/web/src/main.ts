import { VERSION } from '@openhealth/core';
import { mountDropZone } from './components/DropZone.js';
import { mountPrivacyNote } from './components/PrivacyNote.js';
import { isHandoffAvailable, mountQrHandoff } from './components/QrHandoff.js';
import { mountReceiver } from './components/Receiver.js';
import { mountScrollReveal } from './components/ScrollReveal.js';
import { mountPhoneWalkthrough } from './components/PhoneWalkthrough.js';

/** Match `/r/:sessionId` — the mobile receiver route. */
const RECEIVER_PATH = /^\/r\/([A-Za-z0-9_-]{16,})\/?$/;

/**
 * Bootstraps the openhealth web app. Routes either to the receiver (`/r/…`)
 * or the desktop dropzone based on the URL path.
 */
export function bootstrap(root: Document = document): void {
  const path = typeof location !== 'undefined' ? location.pathname : '/';
  const match = RECEIVER_PATH.exec(path);

  if (match) {
    mountReceiverRoute(root, match[1]!);
  } else {
    mountDesktopRoute(root);
  }

  console.info(`openhealth web — core v${VERSION}`);
}

function mountDesktopRoute(root: Document): void {
  const drop = root.getElementById('dropzone-mount');
  const privacy = root.getElementById('privacy-mount');
  if (!drop || !privacy) throw new Error('mount points missing in index.html');

  mountDropZone(drop);
  mountPrivacyNote(privacy);

  const qrHost = root.getElementById('qr-mount');
  if (qrHost && isHandoffAvailable()) {
    mountQrHandoff(qrHost, (file) => {
      const input = drop.querySelector<HTMLInputElement>('input[type=file]');
      if (input) {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event('change'));
      }
    });
  } else if (qrHost) {
    qrHost.hidden = true;
  }

  const walkthrough = root.getElementById('walkthrough-mount');
  if (walkthrough) mountPhoneWalkthrough(walkthrough);

  mountScrollReveal(root);
}

function mountReceiverRoute(root: Document, sessionId: string): void {
  root.body.innerHTML = '<main class="page receiver-page"><section id="receiver-mount"></section></main>';
  const host = root.getElementById('receiver-mount')!;
  mountReceiver(host, sessionId);
}

if (typeof document !== 'undefined' && document.getElementById('dropzone-mount')) {
  bootstrap();
}
