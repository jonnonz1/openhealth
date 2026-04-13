import { bundleMarkdown, type MarkdownOutputs } from '@openhealth/core';
import { runWorkerParse, type ParseSession } from '../worker/client.js';

/** Injection surface for tests — swap the worker runner with a stub. */
export interface DropZoneDeps {
  run?: typeof runWorkerParse;
  bundle?: typeof bundleMarkdown;
}

/** Mount the drag-and-drop zone: export.zip → parsed markdown downloads. */
export function mountDropZone(host: HTMLElement, deps: DropZoneDeps = {}): void {
  const run = deps.run ?? runWorkerParse;
  const bundle = deps.bundle ?? bundleMarkdown;

  host.innerHTML = `
    <div class="dropzone" data-testid="dropzone">
      <p><strong>Drop your <code class="mono">export.zip</code> here</strong></p>
      <p>or <label>
        <input type="file" accept=".zip,.xml" hidden data-testid="dropzone-input" />
        <a href="#" data-testid="dropzone-browse">choose a file</a>
      </label></p>
      <div class="dropzone-progress" data-testid="dropzone-progress" hidden>
        <div class="progress-bar"><span class="progress-fill" data-testid="progress-fill"></span></div>
        <p class="progress-label" data-testid="progress-label"></p>
        <button type="button" data-testid="cancel-parse" class="cancel-btn">Cancel</button>
      </div>
      <p class="dropzone-status" data-testid="dropzone-status"></p>
    </div>
    <section class="results" data-testid="results" hidden></section>
  `;

  const zone = host.querySelector<HTMLElement>('.dropzone')!;
  const input = host.querySelector<HTMLInputElement>('input[type=file]')!;
  const browse = host.querySelector<HTMLAnchorElement>('[data-testid=dropzone-browse]')!;
  const status = host.querySelector<HTMLElement>('.dropzone-status')!;
  const results = host.querySelector<HTMLElement>('[data-testid=results]')!;
  const progress = host.querySelector<HTMLElement>('[data-testid=dropzone-progress]')!;
  const progressFill = host.querySelector<HTMLElement>('[data-testid=progress-fill]')!;
  const progressLabel = host.querySelector<HTMLElement>('[data-testid=progress-label]')!;
  const cancelBtn = host.querySelector<HTMLButtonElement>('[data-testid=cancel-parse]')!;

  let current: ParseSession | null = null;

  browse.addEventListener('click', (e) => {
    e.preventDefault();
    input.click();
  });
  input.addEventListener('change', () => {
    if (input.files?.[0]) void start(input.files[0]);
  });
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('is-hover');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('is-hover'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('is-hover');
    const file = e.dataTransfer?.files[0];
    if (file) void start(file);
  });
  cancelBtn.addEventListener('click', () => {
    current?.cancel();
    current = null;
    progress.hidden = true;
    status.textContent = 'Cancelled.';
  });

  async function start(file: File): Promise<void> {
    current?.cancel();
    results.hidden = true;
    results.innerHTML = '';
    progress.hidden = false;
    progressFill.style.width = '0%';
    progressFill.classList.remove('is-indeterminate');
    progressLabel.textContent = `Parsing ${file.name} (${formatSize(file.size)})…`;
    status.textContent = '';

    // `bytesRead` is measured from the XML stream (after unzip). For raw XML
    // files the zip = xml so the ratio is a real progress %. For a zip we
    // don't know the uncompressed size up front, so we show an indeterminate
    // bar and report records + decompressed MB processed instead.
    const isXml = file.name.toLowerCase().endsWith('.xml');
    if (!isXml) progressFill.classList.add('is-indeterminate');

    const session = run(file, ({ bytesRead, recordsSeen }) => {
      if (isXml) {
        const pct = file.size > 0 ? Math.min(100, (bytesRead / file.size) * 100) : 0;
        progressFill.style.width = `${pct.toFixed(1)}%`;
        progressLabel.textContent = `${formatSize(bytesRead)} / ${formatSize(file.size)} — ${recordsSeen.toLocaleString()} records`;
      } else {
        progressLabel.textContent = `${recordsSeen.toLocaleString()} records · ${formatSize(bytesRead)} processed`;
      }
    });
    current = session;

    try {
      const { outputs, bundled } = await session.done;
      progress.hidden = true;
      status.textContent = `Parsed ${file.name}. Downloads ready.`;
      renderResults(results, outputs, bundled, bundle);
    } catch (err) {
      progress.hidden = true;
      status.textContent = `Failed: ${(err as Error).message}`;
    } finally {
      current = null;
    }
  }
}

function renderResults(
  host: HTMLElement,
  outputs: MarkdownOutputs,
  prebundled: string,
  bundle: typeof bundleMarkdown,
): void {
  host.hidden = false;
  const list = Object.keys(outputs)
    .map((name) => `<li><a href="#" data-download="${name}" class="download-link">${name}</a></li>`)
    .join('');
  host.innerHTML = `
    <h2>Downloads</h2>
    <ul class="results-list">${list}</ul>
    <div class="results-actions">
      <a href="#" data-download="openhealth.md" class="download-link download-bundle">Download bundled openhealth.md</a>
      <button type="button" data-testid="copy-bundle" class="copy-bundle">Copy bundle to clipboard</button>
    </div>
  `;

  for (const link of host.querySelectorAll<HTMLAnchorElement>('a[data-download]')) {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const key = link.dataset.download!;
      const body =
        key === 'openhealth.md' ? prebundled || bundle(outputs) : outputs[key as keyof MarkdownOutputs];
      triggerDownload(key, body);
    });
  }

  const copyBtn = host.querySelector<HTMLButtonElement>('[data-testid=copy-bundle]');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      void navigator.clipboard.writeText(prebundled || bundle(outputs)).then(
        () => (copyBtn.textContent = 'Copied!'),
        () => (copyBtn.textContent = 'Copy failed'),
      );
    });
  }
}

function triggerDownload(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
