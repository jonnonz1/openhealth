/**
 * Full-width privacy banner pinned to the top of the page.
 * Reassures visitors before they even scroll.
 */
export function mountPrivacyNote(host: HTMLElement): void {
  host.innerHTML = `
    <aside class="privacy-banner" data-testid="privacy-note" role="note">
      <div class="privacy-banner-inner">
        <span class="privacy-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </span>
        <p>
          <strong>Private by design.</strong> Your export is parsed entirely in this browser tab — nothing is uploaded, ever.
          <a href="#privacy">More detail</a>.
        </p>
      </div>
    </aside>
  `;
}
