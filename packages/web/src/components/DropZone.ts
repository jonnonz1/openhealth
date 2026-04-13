/**
 * Mounts a drag-and-drop zone for the Apple Health export zip.
 * Today this is a stub — accepting a file shows a "not implemented" message.
 * Real pipeline lands in spec 001 §12.
 */
export function mountDropZone(host: HTMLElement): void {
  host.innerHTML = `
    <div class="dropzone" data-testid="dropzone">
      <p><strong>Drop your <code class="mono">export.zip</code> here</strong></p>
      <p>or <label>
        <input type="file" accept=".zip" hidden data-testid="dropzone-input" />
        <a href="#" data-testid="dropzone-browse">choose a file</a>
      </label></p>
      <p class="dropzone-status" data-testid="dropzone-status"></p>
    </div>
  `;

  const zone = host.querySelector<HTMLElement>('.dropzone')!;
  const input = host.querySelector<HTMLInputElement>('input[type=file]')!;
  const browse = host.querySelector<HTMLAnchorElement>('[data-testid=dropzone-browse]')!;
  const status = host.querySelector<HTMLElement>('.dropzone-status')!;

  browse.addEventListener('click', (e) => {
    e.preventDefault();
    input.click();
  });

  input.addEventListener('change', () => {
    if (input.files?.[0]) handleFile(input.files[0], status);
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
    if (file) handleFile(file, status);
  });
}

function handleFile(file: File, status: HTMLElement): void {
  const sizeMb = (file.size / 1_000_000).toFixed(1);
  status.textContent = `Received ${file.name} (${sizeMb} MB). Parser not implemented yet — see specs/001-initial-plan.md §12.`;
}
