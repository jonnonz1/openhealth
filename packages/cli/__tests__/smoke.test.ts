import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { main, parseCliArgs, type WritableSink } from '../src/index.js';

const FIXTURE = resolve(import.meta.dirname, '../../../fixtures/tiny.xml');
const REF_DATE = new Date('2026-04-13T00:00:00Z');

/** In-memory writable sink that captures everything written. */
function captureSink(): WritableSink & { output: string } {
  const sink = {
    output: '',
    write(s: string) {
      sink.output += s;
    },
  };
  return sink;
}

describe('parseCliArgs', () => {
  it('extracts positional input path', () => {
    const a = parseCliArgs(['/tmp/export.zip']);
    expect(a.input).toBe('/tmp/export.zip');
    expect(a.outDir).toBe('./openhealth-out');
  });

  it('parses -o and flag options', () => {
    const a = parseCliArgs(['in.xml', '-o', '/tmp/out', '--bundle', '--max-hr', '200']);
    expect(a.outDir).toBe('/tmp/out');
    expect(a.bundle).toBe(true);
    expect(a.maxHr).toBe(200);
  });

  it('accepts --version and --help', () => {
    expect(parseCliArgs(['--version']).version).toBe(true);
    expect(parseCliArgs(['-h']).help).toBe(true);
  });
});

describe('main', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'openhealth-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('--version writes version string and exits 0', async () => {
    const stdout = captureSink();
    const code = await main(['--version'], { stdout });
    expect(code).toBe(0);
    expect(stdout.output).toMatch(/^openhealth \d+\.\d+\.\d+/);
  });

  it('--help exits 0 with usage on stdout', async () => {
    const stdout = captureSink();
    const code = await main(['--help'], { stdout });
    expect(code).toBe(0);
    expect(stdout.output).toContain('Usage:');
  });

  it('no input prints usage on stderr and exits 2', async () => {
    const stdout = captureSink();
    const stderr = captureSink();
    const code = await main([], { stdout, stderr });
    expect(code).toBe(2);
    expect(stderr.output).toContain('Usage:');
  });

  it('default mode writes 7 markdown files matching fixtures/expected', async () => {
    const stdout = captureSink();
    const code = await main([FIXTURE, '-o', dir], { stdout, now: REF_DATE });
    expect(code).toBe(0);
    expect(stdout.output).toContain('wrote 7 files');
    for (const name of [
      'health_profile.md',
      'weekly_summary.md',
      'workouts.md',
      'body_composition.md',
      'sleep_recovery.md',
      'cardio_fitness.md',
      'prompt.md',
    ]) {
      const actual = await readFile(join(dir, name), 'utf8');
      const expected = await readFile(
        resolve(import.meta.dirname, '../../../fixtures/expected', name),
        'utf8',
      );
      expect(actual).toBe(expected);
    }
  });

  it('--bundle writes a single openhealth.md', async () => {
    const stdout = captureSink();
    const code = await main([FIXTURE, '-o', dir, '--bundle'], { stdout, now: REF_DATE });
    expect(code).toBe(0);
    const bundled = await readFile(join(dir, 'openhealth.md'), 'utf8');
    expect(bundled).toContain('# Health Profile');
    expect(bundled).toContain('# Fitness Coaching Prompt');
  });

  it('--clipboard invokes the injected clipboard handler', async () => {
    const stdout = captureSink();
    let captured = '';
    const code = await main([FIXTURE, '-o', dir, '--clipboard'], {
      stdout,
      now: REF_DATE,
      copyToClipboard: async (text) => {
        captured = text;
      },
    });
    expect(code).toBe(0);
    expect(captured).toContain('# Health Profile');
    expect(stdout.output).toContain('copied bundle to clipboard');
  });

  it('reports an error when the input does not exist', async () => {
    const stderr = captureSink();
    const code = await main(['/nonexistent/path.xml'], { stderr, now: REF_DATE });
    expect(code).toBe(1);
    expect(stderr.output).toContain('openhealth:');
  });
});
