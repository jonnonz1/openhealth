import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseHealthXml } from '../src/parser.js';
import { generateMarkdown } from '../src/writers/index.js';

const REF_DATE = '2026-04-13';
const FIXTURES = resolve(import.meta.dirname, '../../../fixtures');

async function loadParsed() {
  const xml = await readFile(resolve(FIXTURES, 'tiny.xml'), 'utf8');
  return parseHealthXml(new Response(xml).body!);
}

async function expected(file: string): Promise<string> {
  return readFile(resolve(FIXTURES, 'expected', file), 'utf8');
}

describe('generateMarkdown: snapshots against fixtures/expected', () => {
  for (const file of [
    'health_profile.md',
    'weekly_summary.md',
    'workouts.md',
    'body_composition.md',
    'sleep_recovery.md',
    'cardio_fitness.md',
    'prompt.md',
  ] as const) {
    it(`matches ${file} byte-for-byte`, async () => {
      const data = await loadParsed();
      const outputs = generateMarkdown(data, { refDate: REF_DATE });
      const want = await expected(file);
      expect(outputs[file]).toBe(want);
    });
  }
});
