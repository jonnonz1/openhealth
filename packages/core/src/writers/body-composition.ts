import { nutritionWeekly, weightTrend } from '../aggregator.js';
import type { ParsedData } from '../types.js';
import { fmt, joinLines, kjToKcal } from './shared.js';

/** Generate the `body_composition.md` contents. */
export function writeBodyComposition(data: ParsedData, refDate: string): string {
  const wt = weightTrend(data, refDate);
  const nutrition = nutritionWeekly(data, refDate);
  const lines: string[] = ['# Body Composition', ''];

  if (wt.monthlyAverages.size > 0) {
    lines.push('## Weight Trend (6 Months)', '');
    lines.push('| Month | Avg (kg) |');
    lines.push('|-------|---------|');
    for (const [month, avg] of wt.monthlyAverages) {
      lines.push(`| ${month} | ${fmt(avg)} |`);
    }
    lines.push('');
  }

  if (wt.recentReadings.length > 0) {
    lines.push('## Recent Readings (3 Months)', '');
    lines.push('| Date | Weight (kg) | Source |');
    lines.push('|------|-----------|--------|');
    for (const r of wt.recentReadings) {
      lines.push(`| ${r.date} | ${fmt(r.valueKg)} | ${r.source} |`);
    }
    lines.push('');
  }

  if (nutrition.length > 0) {
    lines.push('## Weekly Nutrition Averages', '');
    lines.push('| Week | Calories | Protein (g) | Fat (g) | Carbs (g) | Days |');
    lines.push('|------|----------|-------------|---------|-----------|------|');
    for (const nw of nutrition) {
      const calKj = nw.averages['HKQuantityTypeIdentifierDietaryEnergyConsumed'] ?? 0;
      const cal = calKj ? kjToKcal(calKj) : 0;
      const protein = nw.averages['HKQuantityTypeIdentifierDietaryProtein'] ?? 0;
      const fat = nw.averages['HKQuantityTypeIdentifierDietaryFatTotal'] ?? 0;
      const carbs = nw.averages['HKQuantityTypeIdentifierDietaryCarbohydrates'] ?? 0;
      lines.push(
        `| ${nw.weekStart} | ${fmt(cal, 0)} | ${fmt(protein)} | ${fmt(fat)} | ${fmt(carbs)} | ${nw.daysTracked} |`,
      );
    }
    lines.push('');
  }

  return joinLines(lines);
}
