/**
 * Inline privacy reassurance sitting directly under the drop zone.
 * Complements the larger callout further down the page.
 */
export function mountPrivacyNote(host: HTMLElement): void {
  host.innerHTML = `
    <p class="privacy" data-testid="privacy-note">
      <strong>Private by design.</strong> Your export is parsed in this browser tab. Nothing is uploaded, ever.
      <a href="#privacy">More detail</a>.
    </p>
  `;
}
