import { describe, it, expect } from 'vitest';
import { VERSION, parseHealthXml, parseHealthZip, generateMarkdown, bundleMarkdown } from '../src/index.js';

describe('@openhealth/core smoke', () => {
  it('exports a version string', () => {
    expect(VERSION).toBe('0.0.0');
  });

  it('parseHealthXml is wired and explicitly not implemented', () => {
    expect(() => parseHealthXml()).toThrow(/not implemented/);
  });

  it('parseHealthZip is wired and explicitly not implemented', () => {
    expect(() => parseHealthZip()).toThrow(/not implemented/);
  });

  it('generateMarkdown is wired and explicitly not implemented', () => {
    expect(() => generateMarkdown()).toThrow(/not implemented/);
  });

  it('bundleMarkdown is wired and explicitly not implemented', () => {
    expect(() => bundleMarkdown()).toThrow(/not implemented/);
  });
});
