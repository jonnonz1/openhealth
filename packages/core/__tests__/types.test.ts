import { describe, it, expect } from 'vitest';
import { Accumulator, emptyParsedData } from '../src/types.js';

describe('Accumulator', () => {
  it('returns null stats when empty', () => {
    const a = new Accumulator();
    expect(a.count).toBe(0);
    expect(a.avg).toBeNull();
    expect(a.min).toBeNull();
    expect(a.max).toBeNull();
  });

  it('folds values into running stats', () => {
    const a = new Accumulator();
    a.add(10);
    a.add(20);
    a.add(30);
    expect(a.count).toBe(3);
    expect(a.total).toBe(60);
    expect(a.avg).toBe(20);
    expect(a.min).toBe(10);
    expect(a.max).toBe(30);
  });

  it('handles negative values', () => {
    const a = new Accumulator();
    a.add(-5);
    a.add(5);
    expect(a.min).toBe(-5);
    expect(a.max).toBe(5);
    expect(a.avg).toBe(0);
  });
});

describe('emptyParsedData', () => {
  it('initialises all collections empty', () => {
    const d = emptyParsedData();
    expect(d.profile.dateOfBirth).toBe('');
    expect(d.profile.sources).toEqual([]);
    expect(d.dailyMetrics.size).toBe(0);
    expect(d.activityDays.size).toBe(0);
    expect(d.sleepNights.size).toBe(0);
    expect(d.workouts).toEqual([]);
    expect(d.weightReadings).toEqual([]);
    expect(d.sources.size).toBe(0);
  });

  it('returns a fresh instance each call', () => {
    const a = emptyParsedData();
    const b = emptyParsedData();
    a.workouts.push({
      activityType: 'x',
      start: new Date(),
      end: new Date(),
      durationMinutes: 0,
      distanceKm: null,
      energyKj: null,
      avgHr: null,
      maxHr: null,
      minHr: null,
      source: '',
      indoor: false,
      weatherTempF: null,
      weatherHumidity: null,
      steps: null,
    });
    expect(b.workouts).toHaveLength(0);
  });
});
