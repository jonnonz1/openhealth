import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseHealthXml } from '../src/parser.js';
import { generateMarkdown } from '../src/writers/index.js';
import { bundleMarkdown } from '../src/bundle.js';

describe('bundleMarkdown', () => {
  it('preserves every section header and emits a single trailing newline', async () => {
    const xml = await readFile(resolve(import.meta.dirname, '../../../fixtures/tiny.xml'), 'utf8');
    const data = await parseHealthXml(new Response(xml).body!);
    const bundled = bundleMarkdown(generateMarkdown(data, { refDate: '2026-04-13' }));

    for (const heading of [
      '# Health Profile',
      '# Weekly Summary',
      '# Workout Log (Last 4 Weeks)',
      '# Body Composition',
      '# Sleep & Recovery',
      '# Cardio & Fitness',
      '# Fitness Coaching Prompt',
    ]) {
      expect(bundled).toContain(heading);
    }
    expect(bundled.endsWith('\n')).toBe(true);
    expect(bundled.endsWith('\n\n')).toBe(false);
  });

  it('orders sections deterministically', () => {
    const bundle = bundleMarkdown({
      'health_profile.md': '# A\n',
      'weekly_summary.md': '# B\n',
      'workouts.md': '# C\n',
      'body_composition.md': '# D\n',
      'sleep_recovery.md': '# E\n',
      'cardio_fitness.md': '# F\n',
      'prompt.md': '# G\n',
    });
    expect(bundle).toBe('# A\n\n# B\n\n# C\n\n# D\n\n# E\n\n# F\n\n# G\n');
  });
});
