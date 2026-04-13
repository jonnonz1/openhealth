import {
  MONTHS_CARDIO,
  MONTHS_WEIGHT_READINGS,
  MONTHS_WEIGHT_TREND,
  WEEKS_SLEEP,
  WEEKS_WEEKLY_SUMMARY,
  WEEKS_WORKOUTS,
} from './constants.js';
import {
  Accumulator,
  type ParsedData,
  type SleepNight,
  type WeekSummary,
  type WorkoutRecord,
} from './types.js';

/**
 * Parse a "YYYY-MM-DD" string into its (year, month, day) components.
 * Pure — no timezone interpretation, unlike `new Date(str)`.
 */
export function splitDate(iso: string): [number, number, number] {
  return [
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)),
    Number(iso.slice(8, 10)),
  ];
}

/** Format (year, month, day) into "YYYY-MM-DD". */
export function formatDate(y: number, m: number, d: number): string {
  return `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
}

/** Add `days` to a "YYYY-MM-DD" date. Negative values move backwards. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = splitDate(iso);
  const jd = Date.UTC(y, m - 1, d + days);
  const dt = new Date(jd);
  return formatDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** Return Monday of the ISO week containing `iso`. */
export function weekStart(iso: string): string {
  const [y, m, d] = splitDate(iso);
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun..6=Sat
  const pythonWeekday = (jsDay + 6) % 7; // 0=Mon..6=Sun
  return addDays(iso, -pythonWeekday);
}

/** Return a date approximately `months` months before `iso`. Day clamps to ≤28. */
export function monthsAgo(iso: string, months: number): string {
  const [y, m, d] = splitDate(iso);
  let year = y;
  let month = m - months;
  while (month <= 0) {
    month += 12;
    year -= 1;
  }
  return formatDate(year, month, Math.min(d, 28));
}

/** Compare two ISO date strings chronologically. */
export function cmpDate(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function avg(xs: number[]): number {
  if (xs.length === 0) return 0;
  let sum = 0;
  for (const x of xs) sum += x;
  return sum / xs.length;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/** Today's date as "YYYY-MM-DD" (UTC). */
export function today(): string {
  const now = new Date();
  return formatDate(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
}

/**
 * Build weekly summaries for the last `numWeeks` weeks ending at `refDate`.
 * Newest week first.
 */
export function weeklySummaries(
  data: ParsedData,
  refDate?: string,
  numWeeks = WEEKS_WEEKLY_SUMMARY,
): WeekSummary[] {
  const ref = refDate ?? today();
  const currentWeek = weekStart(ref);
  const weeks: WeekSummary[] = [];

  for (let i = 0; i < numWeeks; i++) {
    const ws = addDays(currentWeek, -7 * i);
    const we = addDays(ws, 6);
    const summary: WeekSummary = {
      weekStart: ws,
      weekEnd: we,
      daysWithData: 0,
      steps: new Accumulator(),
      distanceKm: new Accumulator(),
      activeEnergyKj: new Accumulator(),
      exerciseMinutes: new Accumulator(),
      restingHr: new Accumulator(),
      hrv: new Accumulator(),
      sleepMinutes: new Accumulator(),
      workouts: 0,
    };

    for (let offset = 0; offset < 7; offset++) {
      const d = addDays(ws, offset);
      let hasData = false;

      const act = data.activityDays.get(d);
      if (act && (act.activeEnergyKj > 0 || act.exerciseMinutes > 0)) {
        summary.activeEnergyKj.add(act.activeEnergyKj);
        summary.exerciseMinutes.add(act.exerciseMinutes);
        hasData = true;
      }

      const dm = data.dailyMetrics.get(d);
      if (dm) {
        const steps = dm.accumulators.get('HKQuantityTypeIdentifierStepCount');
        if (steps && steps.count > 0) {
          summary.steps.add(steps.total);
          hasData = true;
        }
        const dist = dm.accumulators.get('HKQuantityTypeIdentifierDistanceWalkingRunning');
        if (dist && dist.count > 0) {
          summary.distanceKm.add(dist.total);
          hasData = true;
        }
        const rhr = dm.accumulators.get('HKQuantityTypeIdentifierRestingHeartRate');
        if (rhr && rhr.count > 0 && rhr.avg !== null) summary.restingHr.add(rhr.avg);
        const hrv = dm.accumulators.get('HKQuantityTypeIdentifierHeartRateVariabilitySDNN');
        if (hrv && hrv.count > 0 && hrv.avg !== null) summary.hrv.add(hrv.avg);
      }

      const sn = data.sleepNights.get(d);
      if (sn && sn.asleepMinutes > 0) summary.sleepMinutes.add(sn.asleepMinutes);

      if (hasData) summary.daysWithData += 1;
    }

    for (const w of data.workouts) {
      const wd = formatDate(w.start.getUTCFullYear(), w.start.getUTCMonth() + 1, w.start.getUTCDate());
      if (wd >= ws && wd <= we) summary.workouts += 1;
    }

    weeks.push(summary);
  }

  return weeks;
}

/** Return workouts from the last `numWeeks`, newest first. */
export function recentWorkouts(
  data: ParsedData,
  refDate?: string,
  numWeeks = WEEKS_WORKOUTS,
): WorkoutRecord[] {
  const ref = refDate ?? today();
  const cutoff = addDays(ref, -7 * numWeeks);
  const out: WorkoutRecord[] = [];
  for (let i = data.workouts.length - 1; i >= 0; i--) {
    const w = data.workouts[i]!;
    const wd = formatDate(w.start.getUTCFullYear(), w.start.getUTCMonth() + 1, w.start.getUTCDate());
    if (wd >= cutoff) out.push(w);
  }
  return out;
}

/** Weekly sleep rollup (mean stage minutes), newest first. */
export interface SleepWeek {
  weekStart: string;
  weekEnd: string;
  nights: number;
  avgAsleep?: number;
  avgInBed?: number;
  avgCore?: number;
  avgDeep?: number;
  avgRem?: number;
  avgAwake?: number;
}

export function sleepWeeks(
  data: ParsedData,
  refDate?: string,
  numWeeks = WEEKS_SLEEP,
): SleepWeek[] {
  const ref = refDate ?? today();
  const currentWeek = weekStart(ref);
  const weeks: SleepWeek[] = [];

  for (let i = 0; i < numWeeks; i++) {
    const ws = addDays(currentWeek, -7 * i);
    const we = addDays(ws, 6);
    const nights: SleepNight[] = [];
    for (let offset = 0; offset < 7; offset++) {
      const d = addDays(ws, offset);
      const sn = data.sleepNights.get(d);
      if (sn && (sn.asleepMinutes > 0 || sn.inBedMinutes > 0)) nights.push(sn);
    }

    if (nights.length > 0) {
      const hasField = (field: keyof SleepNight) =>
        nights.some((n) => (n[field] as number) > 0);
      weeks.push({
        weekStart: ws,
        weekEnd: we,
        nights: nights.length,
        avgAsleep: avg(nights.map((n) => n.asleepMinutes)),
        avgInBed: hasField('inBedMinutes') ? avg(nights.map((n) => n.inBedMinutes)) : 0,
        avgCore: hasField('coreMinutes') ? avg(nights.map((n) => n.coreMinutes)) : 0,
        avgDeep: hasField('deepMinutes') ? avg(nights.map((n) => n.deepMinutes)) : 0,
        avgRem: hasField('remMinutes') ? avg(nights.map((n) => n.remMinutes)) : 0,
        avgAwake: hasField('awakeMinutes') ? avg(nights.map((n) => n.awakeMinutes)) : 0,
      });
    } else {
      weeks.push({ weekStart: ws, weekEnd: we, nights: 0 });
    }
  }

  return weeks;
}

/** Return sleep nights from the last `numWeeks` weeks, newest first. */
export function recentSleepNights(
  data: ParsedData,
  refDate?: string,
  numWeeks = 2,
): SleepNight[] {
  const ref = refDate ?? today();
  const cutoff = addDays(ref, -7 * numWeeks);
  const dates = [...data.sleepNights.keys()].sort(cmpDate).reverse();
  const out: SleepNight[] = [];
  for (const d of dates) {
    if (d >= cutoff) out.push(data.sleepNights.get(d)!);
  }
  return out;
}

/** Result of `weightTrend`: 6-month monthly averages + 3-month recent readings. */
export interface WeightTrend {
  monthlyAverages: Map<string, number>;
  recentReadings: { date: string; valueKg: number; source: string }[];
}

/** Build monthly weight averages (6 months) + recent readings (3 months). */
export function weightTrend(data: ParsedData, refDate?: string): WeightTrend {
  const ref = refDate ?? today();
  const trendCutoff = monthsAgo(ref, MONTHS_WEIGHT_TREND);
  const readingsCutoff = monthsAgo(ref, MONTHS_WEIGHT_READINGS);

  const monthly = new Map<string, number[]>();
  for (const r of data.weightReadings) {
    if (r.date >= trendCutoff) {
      const key = r.date.slice(0, 7);
      let list = monthly.get(key);
      if (!list) {
        list = [];
        monthly.set(key, list);
      }
      list.push(r.valueKg);
    }
  }

  const sortedKeys = [...monthly.keys()].sort();
  const monthlyAverages = new Map<string, number>();
  for (const key of sortedKeys) monthlyAverages.set(key, avg(monthly.get(key)!));

  const recentReadings = data.weightReadings.filter((r) => r.date >= readingsCutoff);
  return { monthlyAverages, recentReadings };
}

/** Per-week nutrition averages for the tracked macros. */
export interface NutritionWeek {
  weekStart: string;
  weekEnd: string;
  daysTracked: number;
  averages: Record<string, number>;
}

const NUTRITION_TYPES = [
  'HKQuantityTypeIdentifierDietaryEnergyConsumed',
  'HKQuantityTypeIdentifierDietaryProtein',
  'HKQuantityTypeIdentifierDietaryFatTotal',
  'HKQuantityTypeIdentifierDietaryCarbohydrates',
] as const;

export function nutritionWeekly(
  data: ParsedData,
  refDate?: string,
  numWeeks = 4,
): NutritionWeek[] {
  const ref = refDate ?? today();
  const currentWeek = weekStart(ref);
  const out: NutritionWeek[] = [];

  for (let i = 0; i < numWeeks; i++) {
    const ws = addDays(currentWeek, -7 * i);
    const we = addDays(ws, 6);

    const dailyTotals = new Map<string, number[]>();
    let daysTracked = 0;

    for (let offset = 0; offset < 7; offset++) {
      const d = addDays(ws, offset);
      const dm = data.dailyMetrics.get(d);
      if (!dm) continue;
      let hasNutrition = false;
      for (const nt of NUTRITION_TYPES) {
        const acc = dm.accumulators.get(nt);
        if (acc && acc.count > 0) {
          let list = dailyTotals.get(nt);
          if (!list) {
            list = [];
            dailyTotals.set(nt, list);
          }
          list.push(acc.total);
          hasNutrition = true;
        }
      }
      if (hasNutrition) daysTracked += 1;
    }

    if (daysTracked > 0) {
      const averages: Record<string, number> = {};
      for (const nt of NUTRITION_TYPES) averages[nt] = avg(dailyTotals.get(nt) ?? []);
      out.push({ weekStart: ws, weekEnd: we, daysTracked, averages });
    }
  }

  return out;
}

/** Return running workouts from the last `MONTHS_CARDIO` months, newest first. */
export function runningLog(data: ParsedData, refDate?: string): WorkoutRecord[] {
  const ref = refDate ?? today();
  const cutoff = monthsAgo(ref, MONTHS_CARDIO);
  const out: WorkoutRecord[] = [];
  for (let i = data.workouts.length - 1; i >= 0; i--) {
    const w = data.workouts[i]!;
    const wd = formatDate(w.start.getUTCFullYear(), w.start.getUTCMonth() + 1, w.start.getUTCDate());
    if (wd >= cutoff && w.activityType.includes('Running')) out.push(w);
  }
  return out;
}

/** HR zone distribution over the last `numWeeks` weeks (percentages). */
export function hrZoneDistribution(
  data: ParsedData,
  refDate?: string,
  numWeeks = 4,
): Record<1 | 2 | 3 | 4 | 5, number> {
  const ref = refDate ?? today();
  const cutoff = addDays(ref, -7 * numWeeks);
  const totals: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const [d, dm] of data.dailyMetrics) {
    if (d < cutoff) continue;
    for (const zone of [1, 2, 3, 4, 5] as const) totals[zone] += dm.hrZoneSeconds[zone];
  }
  const grand = totals[1] + totals[2] + totals[3] + totals[4] + totals[5];
  if (grand === 0) return totals;
  return {
    1: (totals[1] / grand) * 100,
    2: (totals[2] / grand) * 100,
    3: (totals[3] / grand) * 100,
    4: (totals[4] / grand) * 100,
    5: (totals[5] / grand) * 100,
  };
}

/** Weekly averages of recovery metrics (HRV, RHR, respiratory rate, SpO2). */
export interface RecoveryWeek {
  weekStart: string;
  weekEnd: string;
  averages: Record<string, number | null>;
}

const RECOVERY_METRICS = [
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKQuantityTypeIdentifierRespiratoryRate',
  'HKQuantityTypeIdentifierOxygenSaturation',
] as const;

export function recoveryTrends(
  data: ParsedData,
  refDate?: string,
  numWeeks = WEEKS_SLEEP,
): RecoveryWeek[] {
  const ref = refDate ?? today();
  const currentWeek = weekStart(ref);
  const out: RecoveryWeek[] = [];

  for (let i = 0; i < numWeeks; i++) {
    const ws = addDays(currentWeek, -7 * i);
    const we = addDays(ws, 6);
    const vals = new Map<string, number[]>();

    for (let offset = 0; offset < 7; offset++) {
      const d = addDays(ws, offset);
      const dm = data.dailyMetrics.get(d);
      if (!dm) continue;
      for (const m of RECOVERY_METRICS) {
        const acc = dm.accumulators.get(m);
        if (acc && acc.avg !== null) {
          let list = vals.get(m);
          if (!list) {
            list = [];
            vals.set(m, list);
          }
          list.push(acc.avg);
        }
      }
    }

    const averages: Record<string, number | null> = {};
    for (const m of RECOVERY_METRICS) {
      const list = vals.get(m);
      averages[m] = list && list.length > 0 ? avg(list) : null;
    }
    out.push({ weekStart: ws, weekEnd: we, averages });
  }

  return out;
}

/** Weekly walking-speed averages. */
export interface WalkingSpeedWeek {
  weekStart: string;
  weekEnd: string;
  avgSpeed: number | null;
}

export function walkingSpeedTrend(
  data: ParsedData,
  refDate?: string,
  numWeeks = 12,
): WalkingSpeedWeek[] {
  const ref = refDate ?? today();
  const currentWeek = weekStart(ref);
  const out: WalkingSpeedWeek[] = [];

  for (let i = 0; i < numWeeks; i++) {
    const ws = addDays(currentWeek, -7 * i);
    const we = addDays(ws, 6);
    const vals: number[] = [];
    for (let offset = 0; offset < 7; offset++) {
      const d = addDays(ws, offset);
      const dm = data.dailyMetrics.get(d);
      if (!dm) continue;
      const acc = dm.accumulators.get('HKQuantityTypeIdentifierWalkingSpeed');
      if (acc && acc.avg !== null) vals.push(acc.avg);
    }
    out.push({ weekStart: ws, weekEnd: we, avgSpeed: vals.length > 0 ? avg(vals) : null });
  }

  return out;
}

/** Long-term averages across all available daily data. */
export interface LongTermAverages {
  avgDailySteps: number | null;
  medianDailySteps: number | null;
  avgExerciseMinutes: number | null;
  avgRestingHr: number | null;
  avgHrv: number | null;
}

export function longTermAverages(data: ParsedData): LongTermAverages {
  const allSteps: number[] = [];
  const allExercise: number[] = [];
  const allRhr: number[] = [];
  const allHrv: number[] = [];

  for (const dm of data.dailyMetrics.values()) {
    const steps = dm.accumulators.get('HKQuantityTypeIdentifierStepCount');
    if (steps && steps.count > 0) allSteps.push(steps.total);
    const rhr = dm.accumulators.get('HKQuantityTypeIdentifierRestingHeartRate');
    if (rhr && rhr.avg !== null) allRhr.push(rhr.avg);
    const hrv = dm.accumulators.get('HKQuantityTypeIdentifierHeartRateVariabilitySDNN');
    if (hrv && hrv.avg !== null) allHrv.push(hrv.avg);
  }

  for (const act of data.activityDays.values()) {
    if (act.exerciseMinutes > 0) allExercise.push(act.exerciseMinutes);
  }

  return {
    avgDailySteps: allSteps.length ? avg(allSteps) : null,
    medianDailySteps: allSteps.length ? median(allSteps) : null,
    avgExerciseMinutes: allExercise.length ? avg(allExercise) : null,
    avgRestingHr: allRhr.length ? avg(allRhr) : null,
    avgHrv: allHrv.length ? avg(allHrv) : null,
  };
}
