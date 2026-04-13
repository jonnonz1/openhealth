import type { MarkdownOutputs } from '@openhealth/core';
import type { WorkerRequest, WorkerResponse } from './process.worker.js';

/** Result of a successful parse — what the worker returns. */
export interface ParseResult {
  outputs: MarkdownOutputs;
  bundled: string;
}

/** Fired periodically while parsing. */
export interface ParseProgress {
  bytesRead: number;
  recordsSeen: number;
}

/** Handle to a worker-backed parse session — cancellable, single-use. */
export interface ParseSession {
  /** Abort the in-flight parse. */
  cancel(): void;
  /** Resolves with the markdown outputs, or rejects on failure / cancellation. */
  done: Promise<ParseResult>;
}

/**
 * Kick off a parse in a dedicated Worker. The file is structure-cloned into
 * the worker, which pipes it through `@openhealth/core` and returns the
 * 7 markdown files + bundled string back on the main thread.
 */
export function runWorkerParse(
  file: File,
  onProgress?: (p: ParseProgress) => void,
): ParseSession {
  const worker = new Worker(new URL('./process.worker.ts', import.meta.url), {
    type: 'module',
    name: 'openhealth-parse',
  });

  const done = new Promise<ParseResult>((resolvePromise, rejectPromise) => {
    worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      if (msg.type === 'progress') {
        onProgress?.({ bytesRead: msg.bytesRead, recordsSeen: msg.recordsSeen });
      } else if (msg.type === 'done') {
        resolvePromise({ outputs: msg.outputs, bundled: msg.bundled });
        worker.terminate();
      } else if (msg.type === 'error') {
        rejectPromise(new Error(msg.message));
        worker.terminate();
      }
    });
    worker.addEventListener('error', (event) => {
      rejectPromise(new Error(event.message || 'worker error'));
      worker.terminate();
    });
  });

  worker.postMessage({ type: 'parse', file } satisfies WorkerRequest);

  return {
    cancel() {
      worker.postMessage({ type: 'cancel' } satisfies WorkerRequest);
      worker.terminate();
    },
    done,
  };
}
