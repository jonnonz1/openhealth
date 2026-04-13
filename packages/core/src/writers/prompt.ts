import type { ParsedData } from '../types.js';
import { joinLines } from './shared.js';

/** Generate the `prompt.md` contents — a ready-to-paste ChatGPT prompt. */
export function writePrompt(data: ParsedData): string {
  const lines: string[] = [
    '# Fitness Coaching Prompt',
    '',
    'Copy the text below (and the other markdown files) into ChatGPT:',
    '',
    '---',
    '',
    "You are my personal fitness and health coach. I'm sharing my Apple Health data exported from my Apple Watch and iPhone. Please analyze the following data files and provide actionable insights.",
    '',
    `**About me:** Born ${data.profile.dateOfBirth}, ${data.profile.biologicalSex}`,
    '',
    '**Data files included:**',
    '1. `health_profile.md` — baseline stats, long-term averages, data sources',
    '2. `weekly_summary.md` — current + 4-week rolling activity comparison',
    '3. `workouts.md` — detailed workout log for last 4 weeks',
    '4. `body_composition.md` — weight trend, recent readings, nutrition',
    '5. `sleep_recovery.md` — nightly sleep, weekly averages, HRV/resting HR trends',
    '6. `cardio_fitness.md` — running log, HR zones, walking speed',
    '',
    '**Please provide:**',
    '',
    "1. **Executive Summary** — What's going well? What needs attention?",
    "2. **Training Load Analysis** — Am I overtraining or undertraining? How's my recovery?",
    '3. **Sleep Quality Assessment** — How is my sleep architecture? Suggestions for improvement?',
    '4. **Cardio Fitness Trends** — Am I improving or declining? Pace/HR trends?',
    '5. **Body Composition Insights** — Weight trajectory, nutrition adequacy',
    '6. **Specific Recommendations** — 3-5 concrete, actionable changes I should make this week',
    '7. **Questions for Me** — What additional info would help you coach me better?',
    '',
    'Be specific, reference actual numbers from my data, and compare week-over-week where possible.',
    '',
  ];
  return joinLines(lines);
}
