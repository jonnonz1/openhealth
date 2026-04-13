import { recentWorkouts } from '../aggregator.js';
import { WORKOUT_SHORT_NAMES, fahrenheitToCelsius } from '../constants.js';
import type { ParsedData } from '../types.js';
import { fmt, fmtMinsAsHm, formatWorkoutStart, joinLines, kjToKcal } from './shared.js';

/** Generate the `workouts.md` contents. */
export function writeWorkouts(data: ParsedData, refDate: string): string {
  const workouts = recentWorkouts(data, refDate);
  const lines: string[] = [
    '# Workout Log (Last 4 Weeks)',
    '',
    `*${workouts.length} workouts*`,
    '',
  ];

  if (workouts.length === 0) {
    lines.push('No workouts recorded in this period.');
    return joinLines(lines);
  }

  const typeCounts = new Map<string, number>();
  const typeDuration = new Map<string, number>();
  for (const w of workouts) {
    const name = WORKOUT_SHORT_NAMES[w.activityType] ?? w.activityType;
    typeCounts.set(name, (typeCounts.get(name) ?? 0) + 1);
    typeDuration.set(name, (typeDuration.get(name) ?? 0) + w.durationMinutes);
  }

  lines.push('## Summary by Type', '');
  lines.push('| Type | Count | Total Time |');
  lines.push('|------|-------|-----------|');
  const sorted = [...typeCounts.keys()].sort(
    (a, b) => (typeCounts.get(b) ?? 0) - (typeCounts.get(a) ?? 0),
  );
  for (const name of sorted) {
    lines.push(`| ${name} | ${typeCounts.get(name)} | ${fmtMinsAsHm(typeDuration.get(name))} |`);
  }
  lines.push('');

  lines.push('## Workout Details', '');

  for (const w of workouts) {
    const name = WORKOUT_SHORT_NAMES[w.activityType] ?? w.activityType;
    const dtStr = formatWorkoutStart(w.start);
    const indoorTag = w.indoor ? ' (Indoor)' : '';
    lines.push(`### ${name}${indoorTag} — ${dtStr}`, '');

    const details: string[] = [`- **Duration:** ${fmtMinsAsHm(w.durationMinutes)}`];

    if (w.distanceKm !== null) {
      details.push(`- **Distance:** ${fmt(w.distanceKm)} km`);
      if (w.durationMinutes > 0 && w.distanceKm > 0) {
        const pace = w.durationMinutes / w.distanceKm;
        details.push(`- **Pace:** ${fmtMinsAsHm(pace)} /km`);
      }
    }
    if (w.energyKj !== null) {
      details.push(`- **Energy:** ${fmt(kjToKcal(w.energyKj), 0)} kcal`);
    }
    if (w.avgHr !== null) {
      const parts = [`avg ${fmt(w.avgHr, 0)}`];
      if (w.minHr !== null) parts.push(`min ${fmt(w.minHr, 0)}`);
      if (w.maxHr !== null) parts.push(`max ${fmt(w.maxHr, 0)}`);
      details.push(`- **HR:** ${parts.join(' / ')} bpm`);
    }
    if (w.steps !== null) details.push(`- **Steps:** ${fmt(w.steps, 0)}`);

    if (w.weatherTempF !== null) {
      const tempC = fahrenheitToCelsius(w.weatherTempF);
      let line = `- **Weather:** ${fmt(tempC)}°C`;
      if (w.weatherHumidity !== null) line += `, ${fmt(w.weatherHumidity, 0)}% humidity`;
      details.push(line);
    }

    lines.push(...details, '');
  }

  return joinLines(lines);
}
