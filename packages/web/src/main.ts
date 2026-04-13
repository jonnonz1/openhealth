import { VERSION } from '@openhealth/core';
import { mountDropZone } from './components/DropZone.js';
import { mountPrivacyNote } from './components/PrivacyNote.js';

/**
 * Bootstraps the openhealth web app. Wires components to their mount points.
 * Real parsing pipeline lands in spec 001 §12.
 */
export function bootstrap(root: Document = document): void {
  const drop = root.getElementById('dropzone-mount');
  const privacy = root.getElementById('privacy-mount');
  if (!drop || !privacy) throw new Error('mount points missing in index.html');

  mountDropZone(drop);
  mountPrivacyNote(privacy);

  console.info(`openhealth web — core v${VERSION}`);
}

if (typeof document !== 'undefined') bootstrap();
