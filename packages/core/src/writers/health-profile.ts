import { longTermAverages, weightTrend } from '../aggregator.js';
import type { ParsedData } from '../types.js';
import { fmt, joinLines } from './shared.js';

/** Generate the `health_profile.md` contents. */
export function writeHealthProfile(data: ParsedData, refDate: string): string {
  const p = data.profile;
  const avgs = longTermAverages(data);

  const lines: string[] = [
    '# Health Profile',
    '',
    `**Export Date:** ${p.exportDate}`,
    `**Date of Birth:** ${p.dateOfBirth}`,
    `**Sex:** ${p.biologicalSex}`,
    '',
    '## Data Sources',
    '',
  ];

  for (const s of p.sources) lines.push(`- ${s}`);

  lines.push(
    '',
    '## Long-Term Averages',
    '',
    `- **Avg Daily Steps:** ${fmt(avgs.avgDailySteps, 0)}`,
    `- **Median Daily Steps:** ${fmt(avgs.medianDailySteps, 0)}`,
    `- **Avg Exercise Minutes/Day:** ${fmt(avgs.avgExerciseMinutes)}`,
    `- **Avg Resting HR:** ${fmt(avgs.avgRestingHr)} bpm`,
    `- **Avg HRV:** ${fmt(avgs.avgHrv)} ms`,
  );

  const wt = weightTrend(data, refDate);
  if (wt.monthlyAverages.size > 0) {
    lines.push('', '## Weight History (Monthly Averages)', '');
    lines.push('| Month | Avg Weight (kg) |');
    lines.push('|-------|----------------|');
    for (const [month, avg] of wt.monthlyAverages) {
      lines.push(`| ${month} | ${fmt(avg)} |`);
    }
  }

  lines.push('');
  return joinLines(lines);
}
