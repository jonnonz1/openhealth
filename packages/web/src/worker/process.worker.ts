/// <reference lib="webworker" />
import {
  parseHealthXml,
  parseHealthZip,
  generateMarkdown,
  bundleMarkdown,
  type MarkdownOutputs,
} from '@openhealth/core';

/** Messages from the main thread to the worker. */
export type WorkerRequest =
  | { type: 'parse'; file: File }
  | { type: 'cancel' };

/** Messages from the worker back to the main thread. */
export type WorkerResponse =
  | { type: 'progress'; bytesRead: number; recordsSeen: number }
  | { type: 'done'; outputs: MarkdownOutputs; bundled: string }
  | { type: 'error'; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

let abortController: AbortController | null = null;

ctx.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  if (msg.type === 'cancel') {
    abortController?.abort();
    return;
  }

  if (msg.type !== 'parse') return;

  abortController?.abort();
  abortController = new AbortController();

  try {
    const parser = msg.file.name.toLowerCase().endsWith('.xml')
      ? parseHealthXml
      : parseHealthZip;
    const data = await parser(msg.file.stream() as unknown as ReadableStream<Uint8Array>, {
      signal: abortController.signal,
      onProgress: ({ bytesRead, recordsSeen }) => {
        ctx.postMessage({ type: 'progress', bytesRead, recordsSeen } satisfies WorkerResponse);
      },
    });
    const outputs = generateMarkdown(data);
    const bundled = bundleMarkdown(outputs);
    ctx.postMessage({ type: 'done', outputs, bundled } satisfies WorkerResponse);
  } catch (err) {
    if ((err as Error).name === 'AbortError') return;
    ctx.postMessage({
      type: 'error',
      message: (err as Error).message,
    } satisfies WorkerResponse);
  } finally {
    abortController = null;
  }
});
