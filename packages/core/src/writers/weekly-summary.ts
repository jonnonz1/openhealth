import { weeklySummaries } from '../aggregator.js';
import type { ParsedData } from '../types.js';
import { fmt, fmtMinsAsHm, joinLines, kjToKcal } from './shared.js';

/** Generate the `weekly_summary.md` contents. */
export function writeWeeklySummary(data: ParsedData, refDate: string): string {
  const weeks = weeklySummaries(data, refDate);
  const lines: string[] = ['# Weekly Summary', '', `*Report date: ${refDate}*`, ''];

  weeks.forEach((w, i) => {
    const label = i === 0 ? 'Current Week' : `Week of ${w.weekStart}`;
    const partial = i === 0 && w.daysWithData < 7 ? ' (partial)' : '';
    lines.push(
      `## ${label}${partial}`,
      '',
      `**${w.weekStart} → ${w.weekEnd}** (${w.daysWithData} days with data)`,
      '',
    );

    const divisor = Math.max(w.daysWithData, 1);
    lines.push('| Metric | Daily Avg | Total |', '|--------|----------|-------|');

    if (w.steps.count) {
      lines.push(`| Steps | ${fmt(w.steps.total / divisor, 0)} | ${fmt(w.steps.total, 0)} |`);
    }
    if (w.distanceKm.count) {
      lines.push(
        `| Distance | ${fmt(w.distanceKm.total / divisor)} km | ${fmt(w.distanceKm.total)} km |`,
      );
    }
    if (w.activeEnergyKj.count) {
      const dailyKcal = kjToKcal(w.activeEnergyKj.total / divisor);
      const totalKcal = kjToKcal(w.activeEnergyKj.total);
      lines.push(
        `| Active Energy | ${fmt(dailyKcal, 0)} kcal | ${fmt(totalKcal, 0)} kcal |`,
      );
    }
    if (w.exerciseMinutes.count) {
      lines.push(
        `| Exercise | ${fmt(w.exerciseMinutes.total / divisor, 0)} min | ${fmt(w.exerciseMinutes.total, 0)} min |`,
      );
    }
    if (w.restingHr.count) {
      lines.push(`| Resting HR | ${fmt(w.restingHr.avg)} bpm | — |`);
    }
    if (w.hrv.count) {
      lines.push(`| HRV | ${fmt(w.hrv.avg)} ms | — |`);
    }
    if (w.sleepMinutes.count) {
      lines.push(`| Sleep | ${fmtMinsAsHm(w.sleepMinutes.avg)} | — |`);
    }
    lines.push(`| Workouts | ${w.workouts} | — |`, '');
  });

  if (weeks.length >= 2 && weeks[1]!.steps.count > 0) {
    lines.push('## Week-over-Week Change', '');
    const curr = weeks[0]!;
    const prev = weeks[1]!;
    const cd = Math.max(curr.daysWithData, 1);
    const pd = Math.max(prev.daysWithData, 1);

    const comparisons: string[] = [];
    if (curr.steps.count && prev.steps.count) {
      const cAvg = curr.steps.total / cd;
      const pAvg = prev.steps.total / pd;
      const pct = pAvg ? ((cAvg - pAvg) / pAvg) * 100 : 0;
      comparisons.push(
        `- **Steps:** ${fmt(cAvg, 0)} vs ${fmt(pAvg, 0)} (${fmtSigned(pct)}%)`,
      );
    }
    if (curr.activeEnergyKj.count && prev.activeEnergyKj.count) {
      const cAvg = kjToKcal(curr.activeEnergyKj.total / cd)!;
      const pAvg = kjToKcal(prev.activeEnergyKj.total / pd)!;
      const pct = pAvg ? ((cAvg - pAvg) / pAvg) * 100 : 0;
      comparisons.push(
        `- **Active Energy:** ${fmt(cAvg, 0)} vs ${fmt(pAvg, 0)} kcal (${fmtSigned(pct)}%)`,
      );
    }
    if (curr.exerciseMinutes.count && prev.exerciseMinutes.count) {
      const cAvg = curr.exerciseMinutes.total / cd;
      const pAvg = prev.exerciseMinutes.total / pd;
      const pct = pAvg ? ((cAvg - pAvg) / pAvg) * 100 : 0;
      comparisons.push(
        `- **Exercise:** ${fmt(cAvg, 0)} vs ${fmt(pAvg, 0)} min (${fmtSigned(pct)}%)`,
      );
    }

    lines.push(...comparisons, '');
  }

  return joinLines(lines);
}

/** Format a signed percentage with Python's `{:+.1f}` semantics. */
function fmtSigned(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}`;
}
