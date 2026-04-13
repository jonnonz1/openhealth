// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mountDropZone } from '../src/components/DropZone.js';
import type { MarkdownOutputs } from '@openhealth/core';
import type { ParseProgress, ParseSession } from '../src/worker/client.js';

function stubOutputs(): MarkdownOutputs {
  return {
    'health_profile.md': '# Health Profile\n',
    'weekly_summary.md': '# Weekly Summary\n',
    'workouts.md': '# Workout Log\n',
    'body_composition.md': '# Body Composition\n',
    'sleep_recovery.md': '# Sleep & Recovery\n',
    'cardio_fitness.md': '# Cardio & Fitness\n',
    'prompt.md': '# Fitness Coaching Prompt\n',
  };
}

function stubRun(
  result: { outputs: MarkdownOutputs; bundled: string } | Error,
  progressEvents: ParseProgress[] = [],
) {
  let onProg: ((p: ParseProgress) => void) | undefined;
  const session: ParseSession = {
    cancel: vi.fn(),
    done: new Promise((resolvePromise, rejectPromise) => {
      queueMicrotask(() => {
        progressEvents.forEach((p) => onProg?.(p));
        if (result instanceof Error) rejectPromise(result);
        else resolvePromise(result);
      });
    }),
  };
  const run = vi.fn((_file: File, cb?: (p: ParseProgress) => void) => {
    onProg = cb;
    return session;
  });
  return { run, session };
}

function triggerFile(host: HTMLElement, file: File) {
  const input = host.querySelector<HTMLInputElement>('input[type=file]')!;
  Object.defineProperty(input, 'files', { value: [file], writable: false });
  input.dispatchEvent(new Event('change'));
}

describe('DropZone + Worker client', () => {
  beforeEach(() => {
    document.body.innerHTML = '<section id="host"></section>';
  });

  it('mounts the dropzone and progress bar', () => {
    const host = document.getElementById('host')!;
    mountDropZone(host, { run: stubRun({ outputs: stubOutputs(), bundled: 'B' }).run });
    expect(host.querySelector('[data-testid=dropzone]')).toBeTruthy();
    expect(host.querySelector('[data-testid=dropzone-progress]')!.hasAttribute('hidden')).toBe(true);
  });

  it('shows progress while parsing and renders downloads when done', async () => {
    const host = document.getElementById('host')!;
    const { run } = stubRun({ outputs: stubOutputs(), bundled: 'BUNDLED' }, [
      { bytesRead: 1024, recordsSeen: 100 },
      { bytesRead: 2048, recordsSeen: 500 },
    ]);
    mountDropZone(host, { run });
    triggerFile(host, new File(['x'.repeat(2048)], 'export.zip'));

    await vi.waitFor(() => {
      const results = host.querySelector<HTMLElement>('[data-testid=results]')!;
      expect(results.hidden).toBe(false);
    });

    expect(host.querySelectorAll('a[data-download]')).toHaveLength(8);
    expect(host.querySelector('[data-testid=dropzone-status]')?.textContent).toContain(
      'Downloads ready',
    );
  });

  it('surfaces parse errors on the status line', async () => {
    const host = document.getElementById('host')!;
    const { run } = stubRun(new Error('bad zip'));
    mountDropZone(host, { run });
    triggerFile(host, new File(['x'], 'export.zip'));

    await vi.waitFor(() => {
      expect(host.querySelector('[data-testid=dropzone-status]')?.textContent).toContain(
        'Failed: bad zip',
      );
    });
  });

  it('cancels the active session when the cancel button is clicked', async () => {
    const host = document.getElementById('host')!;
    const { run, session } = stubRun({ outputs: stubOutputs(), bundled: 'b' });
    mountDropZone(host, { run });
    triggerFile(host, new File(['x'], 'export.zip'));
    const cancel = host.querySelector<HTMLButtonElement>('[data-testid=cancel-parse]')!;
    cancel.click();
    expect(session.cancel).toHaveBeenCalled();
    expect(host.querySelector('[data-testid=dropzone-status]')?.textContent).toBe('Cancelled.');
  });
});
