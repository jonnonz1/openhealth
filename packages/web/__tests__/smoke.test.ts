// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { bootstrap } from '../src/main.js';

describe('@openhealth/web smoke', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <section id="dropzone-mount"></section>
      <section id="privacy-mount"></section>
    `;
  });

  it('bootstrap mounts the drop zone and privacy note', () => {
    bootstrap(document);
    expect(document.querySelector('[data-testid=dropzone]')).not.toBeNull();
    expect(document.querySelector('[data-testid=privacy-note]')).not.toBeNull();
  });

  it('bootstrap throws if mount points are missing', () => {
    document.body.innerHTML = '';
    expect(() => bootstrap(document)).toThrow(/mount points missing/);
  });
});
