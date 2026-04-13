import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  addDays,
  formatDate,
  monthsAgo,
  splitDate,
  weekStart,
  weeklySummaries,
  recentWorkouts,
  sleepWeeks,
  recentSleepNights,
  weightTrend,
  nutritionWeekly,
  runningLog,
  hrZoneDistribution,
  recoveryTrends,
  walkingSpeedTrend,
  longTermAverages,
} from '../src/aggregator.js';
import { parseHealthXml } from '../src/parser.js';
import { emptyParsedData, Accumulator, type ParsedData } from '../src/types.js';

describe('date helpers', () => {
  it('splitDate / formatDate round-trip', () => {
    expect(splitDate('2026-04-13')).toEqual([2026, 4, 13]);
    expect(formatDate(2026, 4, 13)).toBe('2026-04-13');
    expect(formatDate(2026, 1, 1)).toBe('2026-01-01');
  });

  it('addDays crosses month and year boundaries', () => {
    expect(addDays('2026-04-13', 0)).toBe('2026-04-13');
    expect(addDays('2026-04-13', 1)).toBe('2026-04-14');
    expect(addDays('2026-04-30', 1)).toBe('2026-05-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-04-13', -7)).toBe('2026-04-06');
  });

  it('weekStart returns Monday of the containing week', () => {
    expect(weekStart('2026-04-13')).toBe('2026-04-13'); // Monday
    expect(weekStart('2026-04-14')).toBe('2026-04-13'); // Tuesday
    expect(weekStart('2026-04-12')).toBe('2026-04-06'); // Sunday → prev Mon
    expect(weekStart('2026-04-19')).toBe('2026-04-13'); // Sunday
  });

  it('monthsAgo subtracts months and clamps day to ≤28', () => {
    expect(monthsAgo('2026-04-13', 1)).toBe('2026-03-13');
    expect(monthsAgo('2026-01-13', 1)).toBe('2025-12-13');
    expect(monthsAgo('2026-04-13', 12)).toBe('2025-04-13');
    expect(monthsAgo('2026-03-31', 1)).toBe('2026-02-28'); // clamp
  });
});

function withFixture(): Promise<ParsedData> {
  return readFile(resolve(import.meta.dirname, '../../../fixtures/tiny.xml'), 'utf8')
    .then((xml) => parseHealthXml(new Response(xml).body!));
}

describe('weeklySummaries', () => {
  it('places fixture data in the week of 2026-04-06', async () => {
    const d = await withFixture();
    const weeks = weeklySummaries(d, '2026-04-13', 2);
    expect(weeks).toHaveLength(2);
    expect(weeks[0]!.weekStart).toBe('2026-04-13');
    expect(weeks[1]!.weekStart).toBe('2026-04-06');
    expect(weeks[1]!.steps.total).toBe(7000);
    expect(weeks[1]!.distanceKm.total).toBe(6.5);
    expect(weeks[1]!.workouts).toBe(1);
    expect(weeks[1]!.activeEnergyKj.total).toBe(2400);
    expect(weeks[1]!.exerciseMinutes.total).toBe(40);
    expect(weeks[1]!.daysWithData).toBeGreaterThan(0);
  });
});

describe('recentWorkouts / runningLog', () => {
  it('returns workouts in the cutoff window, newest first', async () => {
    const d = await withFixture();
    const recent = recentWorkouts(d, '2026-04-13', 4);
    expect(recent).toHaveLength(1);
    expect(recent[0]!.activityType).toBe('HKWorkoutActivityTypeRunning');
  });

  it('filters running workouts in the last MONTHS_CARDIO months', async () => {
    const d = await withFixture();
    const runs = runningLog(d, '2026-04-13');
    expect(runs).toHaveLength(1);
  });
});

describe('sleepWeeks + recentSleepNights', () => {
  it('produces one populated week + sleep night for 2026-04-11', async () => {
    const d = await withFixture();
    const sw = sleepWeeks(d, '2026-04-13', 2);
    expect(sw).toHaveLength(2);
    expect(sw[1]!.nights).toBe(1);
    expect(sw[1]!.avgAsleep).toBeGreaterThan(0);
    const nights = recentSleepNights(d, '2026-04-13', 2);
    expect(nights).toHaveLength(1);
    expect(nights[0]!.date).toBe('2026-04-11');
  });
});

describe('weightTrend', () => {
  it('groups readings by month and collects recent readings', async () => {
    const d = await withFixture();
    const t = weightTrend(d, '2026-04-13');
    expect([...t.monthlyAverages.keys()]).toEqual(['2026-03', '2026-04']);
    expect(t.monthlyAverages.get('2026-03')).toBe(75.8);
    expect(t.monthlyAverages.get('2026-04')).toBe(74.5);
    expect(t.recentReadings.length).toBeGreaterThanOrEqual(1);
  });
});

describe('nutritionWeekly', () => {
  it('computes daily averages for tracked macros', async () => {
    const d = await withFixture();
    const nw = nutritionWeekly(d, '2026-04-13', 2);
    expect(nw).toHaveLength(1);
    expect(nw[0]!.daysTracked).toBe(1);
    expect(nw[0]!.averages['HKQuantityTypeIdentifierDietaryProtein']).toBe(150);
    expect(nw[0]!.averages['HKQuantityTypeIdentifierDietaryEnergyConsumed']).toBe(8368);
  });
});

describe('hrZoneDistribution', () => {
  it('returns zeros when no HR data within cutoff', () => {
    const d = emptyParsedData();
    const dist = hrZoneDistribution(d, '2026-04-13', 4);
    expect(dist[1]).toBe(0);
    expect(dist[5]).toBe(0);
  });

  it('normalizes zone seconds to percentages', async () => {
    const d = await withFixture();
    const dist = hrZoneDistribution(d, '2026-04-13', 4);
    const sum = dist[1] + dist[2] + dist[3] + dist[4] + dist[5];
    expect(sum).toBeCloseTo(100, 5);
    expect(dist[1]).toBeGreaterThan(0);
    expect(dist[4]).toBeGreaterThan(0);
  });
});

describe('recoveryTrends', () => {
  it('emits nulls for weeks with no data and a value for the covered week', async () => {
    const d = await withFixture();
    const weeks = recoveryTrends(d, '2026-04-13', 2);
    expect(weeks).toHaveLength(2);
    const covered = weeks[1]!;
    expect(covered.averages['HKQuantityTypeIdentifierRestingHeartRate']).toBe(58);
    expect(covered.averages['HKQuantityTypeIdentifierHeartRateVariabilitySDNN']).toBe(45);
    expect(weeks[0]!.averages['HKQuantityTypeIdentifierRestingHeartRate']).toBeNull();
  });
});

describe('walkingSpeedTrend', () => {
  it('averages walking speed samples by week', async () => {
    const d = await withFixture();
    const w = walkingSpeedTrend(d, '2026-04-13', 2);
    expect(w[0]!.avgSpeed).toBeNull();
    expect(w[1]!.avgSpeed).toBe(5.2);
  });
});

describe('longTermAverages', () => {
  it('returns nulls on empty data', () => {
    const lt = longTermAverages(emptyParsedData());
    expect(lt.avgDailySteps).toBeNull();
    expect(lt.medianDailySteps).toBeNull();
    expect(lt.avgExerciseMinutes).toBeNull();
  });

  it('computes mean/median of daily totals', () => {
    const d = emptyParsedData();
    for (const [date, total] of [
      ['2026-04-01', 5000],
      ['2026-04-02', 10000],
      ['2026-04-03', 15000],
    ] as const) {
      const acc = new Accumulator();
      acc.add(total);
      d.dailyMetrics.set(date, {
        accumulators: new Map([['HKQuantityTypeIdentifierStepCount', acc]]),
        hrZoneSeconds: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      });
    }
    const lt = longTermAverages(d);
    expect(lt.avgDailySteps).toBe(10000);
    expect(lt.medianDailySteps).toBe(10000);
  });
});
