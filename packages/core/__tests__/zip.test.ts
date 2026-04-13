import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import { parseHealthZip, extractExportXml } from '../src/zip.js';

function bytesStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(ctrl) {
      ctrl.enqueue(bytes);
      ctrl.close();
    },
  });
}

async function streamToString(s: ReadableStream<Uint8Array>): Promise<string> {
  const reader = s.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  reader.releaseLock();
  return new TextDecoder().decode(new Uint8Array(Buffer.concat(chunks.map((c) => Buffer.from(c)))));
}

describe('extractExportXml', () => {
  it('streams the export.xml payload from a zip', async () => {
    const xml = '<?xml version="1.0"?><HealthData/>';
    const zipped = zipSync({ 'apple_health_export/export.xml': strToU8(xml) });
    const out = await streamToString(extractExportXml(bytesStream(zipped)));
    expect(out).toBe(xml);
  });

  it('errors when the zip does not contain export.xml', async () => {
    const zipped = zipSync({ 'other.txt': strToU8('nope') });
    await expect(streamToString(extractExportXml(bytesStream(zipped)))).rejects.toThrow(
      /export\.xml not found/,
    );
  });
});

describe('parseHealthZip', () => {
  it('parses fixtures/tiny.xml wrapped in a zip', async () => {
    const xml = await readFile(resolve(import.meta.dirname, '../../../fixtures/tiny.xml'), 'utf8');
    const zipped = zipSync({ 'apple_health_export/export.xml': strToU8(xml) });
    const data = await parseHealthZip(bytesStream(zipped));
    expect(data.workouts).toHaveLength(1);
    expect(data.weightReadings).toHaveLength(2);
  });
});
