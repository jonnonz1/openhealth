import { Unzip, UnzipInflate } from 'fflate';
import { parseHealthXml, type ParseOptions } from './parser.js';
import type { ParsedData } from './types.js';

/**
 * Parse an Apple Health `export.zip` stream, locating `export.xml` and
 * piping it through `parseHealthXml`. Streaming end-to-end — the full zip
 * is never held in memory.
 */
export async function parseHealthZip(
  zipStream: ReadableStream<Uint8Array>,
  opts: ParseOptions = {},
): Promise<ParsedData> {
  const xmlStream = extractExportXml(zipStream);
  return parseHealthXml(xmlStream, opts);
}

/**
 * Return a stream of the raw bytes of the first `export.xml` found inside
 * the zip, ignoring every other file. Rejects if no match is found.
 */
export function extractExportXml(
  zipStream: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  let found = false;
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let zipError: unknown = null;
  let finishedReading = false;

  const unzip = new Unzip();
  unzip.register(UnzipInflate);
  unzip.onfile = (file) => {
    if (found) return;
    if (!file.name.endsWith('export.xml')) return;
    found = true;
    file.ondata = (err, chunk, final) => {
      if (err) {
        zipError = err;
        controller.error(err);
        return;
      }
      if (chunk.byteLength) controller.enqueue(chunk);
      if (final) controller.close();
    };
    file.start();
  };

  const outStream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl;
      (async () => {
        const reader = zipStream.getReader();
        try {
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            unzip.push(value, false);
          }
          finishedReading = true;
          unzip.push(new Uint8Array(0), true);
          if (!found && !zipError) {
            controller.error(new Error('export.xml not found in zip'));
          }
        } catch (err) {
          if (!zipError) controller.error(err);
        } finally {
          reader.releaseLock();
          void finishedReading;
        }
      })();
    },
  });

  return outStream;
}
