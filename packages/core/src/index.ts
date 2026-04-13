export const VERSION = '0.0.0';

/**
 * Parse an Apple Health XML export stream into structured data.
 * Not implemented yet — see specs/001-initial-plan.md §5.
 */
export function parseHealthXml(): never {
  throw new Error('parseHealthXml: not implemented');
}

/**
 * Parse an Apple Health zip export stream into structured data.
 * Not implemented yet — see specs/001-initial-plan.md §9.
 */
export function parseHealthZip(): never {
  throw new Error('parseHealthZip: not implemented');
}

/**
 * Render parsed data into the seven markdown files.
 * Not implemented yet — see specs/001-initial-plan.md §7.
 */
export function generateMarkdown(): never {
  throw new Error('generateMarkdown: not implemented');
}

/**
 * Concatenate the seven markdown outputs into one bundled file.
 * Not implemented yet — see specs/001-initial-plan.md §8.
 */
export function bundleMarkdown(): never {
  throw new Error('bundleMarkdown: not implemented');
}
