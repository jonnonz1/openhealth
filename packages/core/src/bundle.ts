import type { MarkdownOutputs } from './writers/index.js';

/** Order of sections in the bundled output. */
const ORDER: ReadonlyArray<keyof MarkdownOutputs> = [
  'health_profile.md',
  'weekly_summary.md',
  'workouts.md',
  'body_composition.md',
  'sleep_recovery.md',
  'cardio_fitness.md',
  'prompt.md',
];

/**
 * Concatenate the seven markdown outputs into one bundled file.
 * Each section keeps its original `# Title` H1, separated by a blank line.
 */
export function bundleMarkdown(outputs: MarkdownOutputs): string {
  return ORDER.map((key) => outputs[key].replace(/\n+$/, '')).join('\n\n') + '\n';
}
