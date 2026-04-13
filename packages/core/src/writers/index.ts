import { today } from '../aggregator.js';
import type { ParsedData } from '../types.js';
import { writeBodyComposition } from './body-composition.js';
import { writeCardioFitness } from './cardio-fitness.js';
import { writeHealthProfile } from './health-profile.js';
import { writePrompt } from './prompt.js';
import { writeSleepRecovery } from './sleep-recovery.js';
import { writeWeeklySummary } from './weekly-summary.js';
import { writeWorkouts } from './workouts.js';

/** Options accepted by `generateMarkdown`. */
export interface WriteOptions {
  /** ISO date used as "now" for reports; defaults to today UTC. Accepts `Date` too. */
  refDate?: string | Date;
}

/** The seven LLM-readable markdown files produced from parsed data. */
export interface MarkdownOutputs {
  'health_profile.md': string;
  'weekly_summary.md': string;
  'workouts.md': string;
  'body_composition.md': string;
  'sleep_recovery.md': string;
  'cardio_fitness.md': string;
  'prompt.md': string;
}

/** Pure function: ParsedData → 7 markdown strings. No I/O. */
export function generateMarkdown(data: ParsedData, opts: WriteOptions = {}): MarkdownOutputs {
  const refDate = normaliseRefDate(opts.refDate);
  return {
    'health_profile.md': writeHealthProfile(data, refDate),
    'weekly_summary.md': writeWeeklySummary(data, refDate),
    'workouts.md': writeWorkouts(data, refDate),
    'body_composition.md': writeBodyComposition(data, refDate),
    'sleep_recovery.md': writeSleepRecovery(data, refDate),
    'cardio_fitness.md': writeCardioFitness(data, refDate),
    'prompt.md': writePrompt(data),
  };
}

function normaliseRefDate(ref: string | Date | undefined): string {
  if (!ref) return today();
  if (typeof ref === 'string') return ref;
  const y = ref.getUTCFullYear().toString().padStart(4, '0');
  const m = (ref.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = ref.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export {
  writeHealthProfile,
  writeWeeklySummary,
  writeWorkouts,
  writeBodyComposition,
  writeSleepRecovery,
  writeCardioFitness,
  writePrompt,
};
