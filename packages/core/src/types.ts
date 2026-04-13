/**
 * Accumulator: running min/max/sum/count without retaining samples.
 * Ported from types.py — used by daily-metric rollups to stay O(1) in memory.
 */
export class Accumulator {
  count = 0;
  total = 0;
  private minVal = Number.POSITIVE_INFINITY;
  private maxVal = Number.NEGATIVE_INFINITY;

  /** Fold a value into the running stats. */
  add(value: number): void {
    this.count += 1;
    this.total += value;
    if (value < this.minVal) this.minVal = value;
    if (value > this.maxVal) this.maxVal = value;
  }

  /** Arithmetic mean, or null when no samples have been added. */
  get avg(): number | null {
    return this.count ? this.total / this.count : null;
  }

  /** Smallest sample seen, or null when empty. */
  get min(): number | null {
    return this.count ? this.minVal : null;
  }

  /** Largest sample seen, or null when empty. */
  get max(): number | null {
    return this.count ? this.maxVal : null;
  }
}

/** Static profile data drawn from the <Me> element and export metadata. */
export interface HealthProfile {
  dateOfBirth: string;
  biologicalSex: string;
  bloodType: string;
  exportDate: string;
  sources: string[];
}

/** Per-day rollup of per-record-type accumulators plus HR zone seconds. */
export interface DailyMetrics {
  accumulators: Map<string, Accumulator>;
  hrZoneSeconds: Record<1 | 2 | 3 | 4 | 5, number>;
}

/** Daily totals sourced from an ActivitySummary element. */
export interface ActivityDay {
  date: string;
  activeEnergyKj: number;
  activeEnergyGoalKj: number;
  exerciseMinutes: number;
  exerciseGoalMinutes: number;
  standHours: number;
  standGoal: number;
  moveMinutes: number;
  moveGoal: number;
}

/**
 * One night of aggregated sleep. The `date` is the night-start day — any
 * record whose start falls before 06:00 belongs to the previous night.
 */
export interface SleepNight {
  date: string;
  inBedMinutes: number;
  asleepMinutes: number;
  coreMinutes: number;
  deepMinutes: number;
  remMinutes: number;
  awakeMinutes: number;
  source: string;
}

/** A single workout session drawn from a <Workout> element. */
export interface WorkoutRecord {
  activityType: string;
  start: Date;
  end: Date;
  durationMinutes: number;
  distanceKm: number | null;
  energyKj: number | null;
  avgHr: number | null;
  maxHr: number | null;
  minHr: number | null;
  source: string;
  indoor: boolean;
  weatherTempF: number | null;
  weatherHumidity: number | null;
  steps: number | null;
}

/** A single body-mass reading. */
export interface WeightReading {
  date: string;
  valueKg: number;
  source: string;
}

/** Aggregated Monday→Sunday weekly summary. */
export interface WeekSummary {
  weekStart: string;
  weekEnd: string;
  daysWithData: number;
  steps: Accumulator;
  distanceKm: Accumulator;
  activeEnergyKj: Accumulator;
  exerciseMinutes: Accumulator;
  restingHr: Accumulator;
  hrv: Accumulator;
  sleepMinutes: Accumulator;
  workouts: number;
}

/** Top-level container for all parsed health data. */
export interface ParsedData {
  profile: HealthProfile;
  dailyMetrics: Map<string, DailyMetrics>;
  activityDays: Map<string, ActivityDay>;
  sleepNights: Map<string, SleepNight>;
  workouts: WorkoutRecord[];
  weightReadings: WeightReading[];
  sources: Set<string>;
}

/** Create an empty ParsedData container with all collections initialised. */
export function emptyParsedData(): ParsedData {
  return {
    profile: {
      dateOfBirth: '',
      biologicalSex: '',
      bloodType: '',
      exportDate: '',
      sources: [],
    },
    dailyMetrics: new Map(),
    activityDays: new Map(),
    sleepNights: new Map(),
    workouts: [],
    weightReadings: [],
    sources: new Set(),
  };
}
