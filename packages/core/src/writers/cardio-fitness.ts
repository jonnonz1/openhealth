import { hrZoneDistribution, runningLog, walkingSpeedTrend } from '../aggregator.js';
import type { ParsedData } from '../types.js';
import { fmt, fmtMinsAsHm, joinLines, kjToKcal, pct } from './shared.js';

const ZONE_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'Zone 1 (Recovery)',
  2: 'Zone 2 (Easy)',
  3: 'Zone 3 (Aerobic)',
  4: 'Zone 4 (Threshold)',
  5: 'Zone 5 (Max)',
};

/** Generate the `cardio_fitness.md` contents. */
export function writeCardioFitness(data: ParsedData, refDate: string): string {
  const runs = runningLog(data, refDate);
  const zones = hrZoneDistribution(data, refDate);
  const walkSpeed = walkingSpeedTrend(data, refDate);
  const lines: string[] = ['# Cardio & Fitness', ''];

  if (runs.length > 0) {
    lines.push('## Running Log (3 Months)', '');
    lines.push('| Date | Duration | Distance | Pace | Avg HR | Max HR | Energy |');
    lines.push('|------|----------|----------|------|--------|--------|--------|');
    for (const r of runs) {
      let pace = '';
      if (r.distanceKm && r.distanceKm > 0 && r.durationMinutes > 0) {
        pace = `${fmtMinsAsHm(r.durationMinutes / r.distanceKm)}/km`;
      }
      const date = `${r.start.getUTCFullYear()}-${(r.start.getUTCMonth() + 1).toString().padStart(2, '0')}-${r.start.getUTCDate().toString().padStart(2, '0')}`;
      lines.push(
        `| ${date} | ${fmtMinsAsHm(r.durationMinutes)} | ${fmt(r.distanceKm)} km | ${pace} | ${fmt(r.avgHr, 0)} | ${fmt(r.maxHr, 0)} | ${fmt(kjToKcal(r.energyKj), 0)} kcal |`,
      );
    }
    lines.push('');
  }

  const totalZone = zones[1] + zones[2] + zones[3] + zones[4] + zones[5];
  if (totalZone > 0) {
    lines.push('## HR Zone Distribution (4 Weeks)', '');
    lines.push('| Zone | Range | Time % |');
    lines.push('|------|-------|--------|');
    for (const z of [1, 2, 3, 4, 5] as const) {
      const bars = '█'.repeat(Math.floor(zones[z] / 5));
      lines.push(`| ${ZONE_LABELS[z]} | ${pct(zones[z])} | ${bars} |`);
    }
    lines.push('');
  }

  const hasWalk = walkSpeed.filter((w) => w.avgSpeed !== null);
  if (hasWalk.length > 0) {
    lines.push('## Walking Speed Trend', '');
    lines.push('| Week | Avg Speed (km/h) |');
    lines.push('|------|-----------------|');
    for (const w of hasWalk) {
      lines.push(`| ${w.weekStart} | ${fmt(w.avgSpeed)} |`);
    }
    lines.push('');
  }

  return joinLines(lines);
}
