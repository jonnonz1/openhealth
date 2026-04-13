#!/usr/bin/env bun
import { parseArgs } from 'node:util';
import { writeFile, mkdir, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { resolve, join, basename } from 'node:path';
import { spawn } from 'node:child_process';
import {
  VERSION,
  parseHealthXml,
  parseHealthZip,
  generateMarkdown,
  bundleMarkdown,
  type MarkdownOutputs,
} from '@openhealth/core';

/** Writable sink — `process.stdout`/`stderr` plus in-memory sinks for tests. */
export interface WritableSink {
  write(s: string): void;
}

/** Dependency-injection surface used only in tests. */
export interface MainOptions {
  stdout?: WritableSink;
  stderr?: WritableSink;
  now?: Date;
  copyToClipboard?: (text: string) => Promise<void>;
}

interface CliArgs {
  input: string;
  outDir: string;
  bundle: boolean;
  clipboard: boolean;
  maxHr: number | undefined;
  help: boolean;
  version: boolean;
}

const USAGE = `openhealth — turn an Apple Health export into LLM-readable markdown

Usage:
  openhealth <path-to-export.zip|export.xml> [options]

Options:
  -o, --output <dir>   Output directory (default: ./openhealth-out)
      --bundle         Write a single bundled "openhealth.md" instead of 7 files
      --clipboard      Copy the bundled markdown to the system clipboard
      --max-hr <bpm>   Max HR for zone calculations (default: 180)
  -v, --version        Print version and exit
  -h, --help           Show this help
`;

/** Parse process argv tail into structured CLI arguments. */
export function parseCliArgs(argv: readonly string[]): CliArgs {
  const { values, positionals } = parseArgs({
    args: argv as string[],
    allowPositionals: true,
    options: {
      output: { type: 'string', short: 'o' },
      bundle: { type: 'boolean' },
      clipboard: { type: 'boolean' },
      'max-hr': { type: 'string' },
      version: { type: 'boolean', short: 'v' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  const maxHr = values['max-hr'] ? Number(values['max-hr']) : undefined;
  return {
    input: positionals[0] ?? '',
    outDir: values.output ?? './openhealth-out',
    bundle: Boolean(values.bundle),
    clipboard: Boolean(values.clipboard),
    maxHr: maxHr !== undefined && Number.isFinite(maxHr) ? maxHr : undefined,
    help: Boolean(values.help),
    version: Boolean(values.version),
  };
}

/** CLI entry point. Async so it can stream-parse and await file writes. */
export async function main(
  argv: readonly string[],
  opts: MainOptions = {},
): Promise<number> {
  const stdout = opts.stdout ?? process.stdout;
  const stderr = opts.stderr ?? process.stderr;
  const copyClip = opts.copyToClipboard ?? copyToClipboardSystem;

  let args: CliArgs;
  try {
    args = parseCliArgs(argv);
  } catch (err) {
    stderr.write(`openhealth: ${(err as Error).message}\n`);
    return 2;
  }

  if (args.version) {
    stdout.write(`openhealth ${VERSION}\n`);
    return 0;
  }
  if (args.help || !args.input) {
    (args.help ? stdout : stderr).write(USAGE);
    return args.help ? 0 : 2;
  }

  let outputs: MarkdownOutputs;
  try {
    const data = await parseInput(args.input, args.maxHr);
    outputs = generateMarkdown(data, opts.now ? { refDate: opts.now } : {});
  } catch (err) {
    stderr.write(`openhealth: ${(err as Error).message}\n`);
    return 1;
  }

  const outDir = resolve(args.outDir);
  await mkdir(outDir, { recursive: true });

  if (args.bundle || args.clipboard) {
    const bundled = bundleMarkdown(outputs);
    if (args.bundle) {
      await writeFile(join(outDir, 'openhealth.md'), bundled, 'utf8');
      stdout.write(`wrote ${join(outDir, 'openhealth.md')}\n`);
    }
    if (args.clipboard) {
      try {
        await copyClip(bundled);
        stdout.write('copied bundle to clipboard\n');
      } catch (err) {
        stderr.write(`openhealth: clipboard copy failed — ${(err as Error).message}\n`);
        return 1;
      }
    }
    if (!args.bundle) return 0;
    return 0;
  }

  for (const [name, contents] of Object.entries(outputs)) {
    await writeFile(join(outDir, name), contents, 'utf8');
  }
  stdout.write(`wrote 7 files to ${outDir}\n`);
  return 0;
}

/** Detect input shape (zip/xml/directory) and hand the bytes to core. */
async function parseInput(path: string, maxHr: number | undefined) {
  const abs = resolve(path);
  const info = await stat(abs);
  const opts = maxHr !== undefined ? { maxHr } : {};

  if (info.isDirectory()) {
    const xmlPath = join(abs, 'export.xml');
    return parseHealthXml(nodeReadStream(xmlPath), opts);
  }

  const lower = basename(abs).toLowerCase();
  if (lower.endsWith('.zip')) return parseHealthZip(nodeReadStream(abs), opts);
  if (lower.endsWith('.xml')) return parseHealthXml(nodeReadStream(abs), opts);
  throw new Error(`unsupported input: ${path}`);
}

/** Node `fs.createReadStream` → Web `ReadableStream<Uint8Array>`. */
function nodeReadStream(path: string): ReadableStream<Uint8Array> {
  return Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>;
}

/** Default clipboard handler: spawn the native copy tool per platform. */
async function copyToClipboardSystem(text: string): Promise<void> {
  const cmd = process.platform === 'darwin'
    ? 'pbcopy'
    : process.platform === 'win32'
      ? 'clip'
      : 'xclip';
  const args = process.platform === 'linux' ? ['-selection', 'clipboard'] : [];
  await new Promise<void>((resolveFn, rejectFn) => {
    const child = spawn(cmd, args, { stdio: ['pipe', 'ignore', 'pipe'] });
    child.on('error', rejectFn);
    child.on('exit', (code) => {
      if (code === 0) resolveFn();
      else rejectFn(new Error(`${cmd} exited ${code}`));
    });
    child.stdin.end(text);
  });
}

const isEntry = import.meta.url === `file://${process.argv[1]}`;
if (isEntry) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`openhealth: ${(err as Error).stack ?? err}\n`);
      process.exit(1);
    },
  );
}
