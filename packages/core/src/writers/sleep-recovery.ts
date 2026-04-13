import { recentSleepNights, recoveryTrends, sleepWeeks } from '../aggregator.js';
import type { ParsedData } from '../types.js';
import { fmt, fmtMinsAsHm, joinLines, spo2 } from './shared.js';

/** Generate the `sleep_recovery.md` contents. */
export function writeSleepRecovery(data: ParsedData, refDate: string): string {
  const nights = recentSleepNights(data, refDate);
  const sw = sleepWeeks(data, refDate);
  const recovery = recoveryTrends(data, refDate);
  const lines: string[] = ['# Sleep & Recovery', ''];

  if (nights.length > 0) {
    lines.push('## Recent Nights', '');
    lines.push('| Date | Total Sleep | Core | Deep | REM | Awake | In Bed |');
    lines.push('|------|-----------|------|------|-----|-------|--------|');
    for (const n of nights) {
      lines.push(
        `| ${n.date} | ${fmtMinsAsHm(n.asleepMinutes)} | ${fmtMinsAsHm(n.coreMinutes)} | ${fmtMinsAsHm(n.deepMinutes)} | ${fmtMinsAsHm(n.remMinutes)} | ${fmtMinsAsHm(n.awakeMinutes)} | ${fmtMinsAsHm(n.inBedMinutes)} |`,
      );
    }
    lines.push('');
  }

  const hasSleepWeeks = sw.filter((w) => w.nights > 0);
  if (hasSleepWeeks.length > 0) {
    lines.push('## Weekly Sleep Averages (8 Weeks)', '');
    lines.push('| Week | Nights | Avg Sleep | Avg Core | Avg Deep | Avg REM | Avg Awake |');
    lines.push('|------|--------|----------|----------|----------|---------|-----------|');
    for (const w of hasSleepWeeks) {
      lines.push(
        `| ${w.weekStart} | ${w.nights} | ${fmtMinsAsHm(w.avgAsleep)} | ${fmtMinsAsHm(w.avgCore)} | ${fmtMinsAsHm(w.avgDeep)} | ${fmtMinsAsHm(w.avgRem)} | ${fmtMinsAsHm(w.avgAwake)} |`,
      );
    }
    lines.push('');
  }

  if (recovery.length > 0) {
    lines.push('## Recovery Trends', '');
    lines.push('| Week | Resting HR | HRV (ms) | Resp Rate | SpO2 |');
    lines.push('|------|-----------|----------|-----------|------|');
    for (const w of recovery) {
      const rhr = fmt(w.averages['HKQuantityTypeIdentifierRestingHeartRate']);
      const hrv = fmt(w.averages['HKQuantityTypeIdentifierHeartRateVariabilitySDNN']);
      const resp = fmt(w.averages['HKQuantityTypeIdentifierRespiratoryRate']);
      const sp = spo2(w.averages['HKQuantityTypeIdentifierOxygenSaturation']);
      lines.push(`| ${w.weekStart} | ${rhr} | ${hrv} | ${resp} | ${sp} |`);
    }
    lines.push('');
  }

  return joinLines(lines);
}
