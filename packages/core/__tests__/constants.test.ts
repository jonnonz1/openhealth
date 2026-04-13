import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MAX_HR,
  HR_ZONES,
  SLEEP_SOURCE_PRIORITY,
  RECORD_TYPES_CUMULATIVE,
  ALL_RECORD_TYPES,
  fahrenheitToCelsius,
  KJ_TO_KCAL,
} from '../src/constants.js';

describe('HR_ZONES', () => {
  it('defines five zones', () => {
    expect(Object.keys(HR_ZONES)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('matches Python zone boundaries exactly', () => {
    expect(HR_ZONES[1]).toEqual([0, 0.6]);
    expect(HR_ZONES[2]).toEqual([0.6, 0.7]);
    expect(HR_ZONES[3]).toEqual([0.7, 0.8]);
    expect(HR_ZONES[4]).toEqual([0.8, 0.9]);
    expect(HR_ZONES[5]).toEqual([0.9, 1.0]);
  });

  it('zones are contiguous with no gaps', () => {
    for (const zone of [1, 2, 3, 4] as const) {
      expect(HR_ZONES[zone][1]).toBe(HR_ZONES[(zone + 1) as 2 | 3 | 4 | 5][0]);
    }
  });

  it('DEFAULT_MAX_HR is 180 bpm (age 40)', () => {
    expect(DEFAULT_MAX_HR).toBe(180);
  });
});

describe('SLEEP_SOURCE_PRIORITY', () => {
  it('ranks Apple Watch above AutoSleep', () => {
    expect(SLEEP_SOURCE_PRIORITY['apple watch']).toBeLessThan(
      SLEEP_SOURCE_PRIORITY['autosleep']!,
    );
  });

  it('uses lowercase keys', () => {
    for (const key of Object.keys(SLEEP_SOURCE_PRIORITY)) {
      expect(key).toBe(key.toLowerCase());
    }
  });
});

describe('RECORD_TYPES_CUMULATIVE', () => {
  it('contains the three dedup-by-source record types', () => {
    expect(RECORD_TYPES_CUMULATIVE.has('HKQuantityTypeIdentifierStepCount')).toBe(true);
    expect(RECORD_TYPES_CUMULATIVE.has('HKQuantityTypeIdentifierDistanceWalkingRunning')).toBe(true);
    expect(RECORD_TYPES_CUMULATIVE.has('HKQuantityTypeIdentifierFlightsClimbed')).toBe(true);
  });

  it('is a subset of ALL_RECORD_TYPES', () => {
    for (const t of RECORD_TYPES_CUMULATIVE) {
      expect(ALL_RECORD_TYPES.has(t)).toBe(true);
    }
  });
});

describe('unit conversions', () => {
  it('fahrenheitToCelsius: 32°F → 0°C', () => {
    expect(fahrenheitToCelsius(32)).toBe(0);
  });

  it('fahrenheitToCelsius: 212°F → 100°C', () => {
    expect(fahrenheitToCelsius(212)).toBe(100);
  });

  it('KJ_TO_KCAL: 4.184 kJ → 1 kcal', () => {
    expect(4.184 * KJ_TO_KCAL).toBeCloseTo(1, 10);
  });
});
