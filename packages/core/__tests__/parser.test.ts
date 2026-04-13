import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  parseHealthXml,
  normalizeSource,
  sourcePriority,
  hrZone,
  parseAppleDate,
  sleepNightDate,
} from '../src/parser.js';

/** Wrap an XML document in the minimum envelope the parser expects. */
function wrap(inner: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><HealthData locale="en_US">${inner}</HealthData>`;
}

function stringStream(s: string): ReadableStream<Uint8Array> {
  return new Response(s).body!;
}

function parse(xml: string, opts?: Parameters<typeof parseHealthXml>[1]) {
  return parseHealthXml(stringStream(xml), opts);
}

describe('helpers', () => {
  it('normalizeSource: replaces non-breaking spaces', () => {
    expect(normalizeSource('Apple\u00a0Watch')).toBe('Apple Watch');
    expect(normalizeSource('  Apple\u00a0Watch\u00a0  ')).toBe('Apple Watch');
  });

  it('sourcePriority: Apple Watch beats AutoSleep beats unknown', () => {
    expect(sourcePriority('Apple\u00a0Watch')).toBe(1);
    expect(sourcePriority('AutoSleep')).toBe(2);
    expect(sourcePriority('Withings')).toBe(99);
  });

  it('hrZone: boundaries match Python', () => {
    expect(hrZone(100, 180)).toBe(1);   // 0.555 < 0.6
    expect(hrZone(108, 180)).toBe(2);   // 0.600 >= 0.6, < 0.7
    expect(hrZone(126, 180)).toBe(3);   // 0.700, < 0.8
    expect(hrZone(144, 180)).toBe(4);   // 0.800, < 0.9
    expect(hrZone(150, 180)).toBe(4);   // 0.833, < 0.9
    expect(hrZone(162, 180)).toBe(5);   // 0.900, catch-all
    expect(hrZone(180, 180)).toBe(5);
    expect(hrZone(60, 180)).toBe(1);
  });

  it('parseAppleDate: wall-clock + tz-aware', () => {
    const p = parseAppleDate('2026-04-11 22:00:00 +0000')!;
    expect(p.date).toBe('2026-04-11');
    expect(p.hour).toBe(22);
    expect(p.jsDate.toISOString()).toBe('2026-04-11T22:00:00.000Z');
    expect(parseAppleDate('invalid')).toBeNull();
  });

  it('sleepNightDate: records before 6am attach to previous night', () => {
    expect(sleepNightDate(2026, 4, 12, 5)).toBe('2026-04-11');
    expect(sleepNightDate(2026, 4, 12, 6)).toBe('2026-04-12');
    expect(sleepNightDate(2026, 4, 1, 3)).toBe('2026-03-31');
  });
});

describe('parseHealthXml: profile', () => {
  it('captures ExportDate and Me characteristics', async () => {
    const d = await parse(
      wrap(
        `<ExportDate value="2026-04-12 10:00:00 +0000"/>
        <Me HKCharacteristicTypeIdentifierDateOfBirth="1990-01-15"
            HKCharacteristicTypeIdentifierBiologicalSex="HKBiologicalSexMale"
            HKCharacteristicTypeIdentifierBloodType="HKBloodTypeAPositive"/>`,
      ),
    );
    expect(d.profile.exportDate).toBe('2026-04-12 10:00:00 +0000');
    expect(d.profile.dateOfBirth).toBe('1990-01-15');
    expect(d.profile.biologicalSex).toBe('Male');
    expect(d.profile.bloodType).toBe('APositive');
  });
});

describe('parseHealthXml: workouts', () => {
  it('parses a Workout with WorkoutStatistics and MetadataEntry children', async () => {
    const xml = wrap(`
      <Workout workoutActivityType="HKWorkoutActivityTypeRunning"
               duration="30" durationUnit="min"
               totalDistance="5.0" totalDistanceUnit="km"
               totalEnergyBurned="1500" totalEnergyBurnedUnit="kJ"
               sourceName="Apple&#160;Watch"
               startDate="2026-04-11 08:00:00 +0000" endDate="2026-04-11 08:30:00 +0000">
        <WorkoutStatistics type="HKQuantityTypeIdentifierHeartRate"
                           startDate="2026-04-11 08:00:00 +0000" endDate="2026-04-11 08:30:00 +0000"
                           average="145" minimum="110" maximum="170" unit="count/min"/>
        <WorkoutStatistics type="HKQuantityTypeIdentifierStepCount"
                           startDate="2026-04-11 08:00:00 +0000" endDate="2026-04-11 08:30:00 +0000"
                           sum="4800" unit="count"/>
        <MetadataEntry key="HKWeatherTemperature" value="72 F"/>
        <MetadataEntry key="HKWeatherHumidity" value="5500 %"/>
        <MetadataEntry key="HKIndoorWorkout" value="0"/>
      </Workout>`);

    const d = await parse(xml);
    expect(d.workouts).toHaveLength(1);
    const w = d.workouts[0]!;
    expect(w.activityType).toBe('HKWorkoutActivityTypeRunning');
    expect(w.durationMinutes).toBe(30);
    expect(w.distanceKm).toBe(5);
    expect(w.energyKj).toBe(1500);
    expect(w.avgHr).toBe(145);
    expect(w.maxHr).toBe(170);
    expect(w.minHr).toBe(110);
    expect(w.steps).toBe(4800);
    expect(w.source).toBe('Apple\u00a0Watch');
    expect(w.indoor).toBe(false);
    expect(w.weatherTempF).toBe(72);
    expect(w.weatherHumidity).toBe(55);
  });

  it('converts miles to km and kcal to kJ on workout totals', async () => {
    const xml = wrap(`
      <Workout workoutActivityType="HKWorkoutActivityTypeRunning"
               duration="30" totalDistance="3.0" totalDistanceUnit="mi"
               totalEnergyBurned="300" totalEnergyBurnedUnit="kcal"
               startDate="2026-04-11 08:00:00 +0000" endDate="2026-04-11 08:30:00 +0000"/>`);
    const d = await parse(xml);
    const w = d.workouts[0]!;
    expect(w.distanceKm).toBeCloseTo(4.82802, 4);
    expect(w.energyKj).toBeCloseTo(1255.2, 4);
  });
});

describe('parseHealthXml: record edge cases', () => {
  const dayAttrs =
    'startDate="2026-04-10 12:00:00 +0000" endDate="2026-04-10 12:30:00 +0000" unit="count"';

  it('normalizes NBSP source names on Workout sources set', async () => {
    const xml = wrap(`
      <Workout workoutActivityType="HKWorkoutActivityTypeWalking"
               duration="10"
               sourceName="Apple&#160;Watch"
               startDate="2026-04-11 08:00:00 +0000" endDate="2026-04-11 08:10:00 +0000"/>`);
    const d = await parse(xml);
    expect(d.sources.has('Apple\u00a0Watch')).toBe(true);
  });

  it('stores humidity "5500 %" as 55', async () => {
    const xml = wrap(`
      <Workout workoutActivityType="HKWorkoutActivityTypeRunning"
               duration="30"
               startDate="2026-04-11 08:00:00 +0000" endDate="2026-04-11 08:30:00 +0000">
        <MetadataEntry key="HKWeatherHumidity" value="5500 %"/>
      </Workout>`);
    const d = await parse(xml);
    expect(d.workouts[0]!.weatherHumidity).toBe(55);
  });

  it('stores SpO2 value verbatim (0.96 stays 0.96 — writers scale for display)', async () => {
    const xml = wrap(`
      <Record type="HKQuantityTypeIdentifierOxygenSaturation" sourceName="Apple Watch"
              ${dayAttrs} value="0.96"/>`);
    const d = await parse(xml);
    const acc = d.dailyMetrics.get('2026-04-10')!.accumulators.get(
      'HKQuantityTypeIdentifierOxygenSaturation',
    )!;
    expect(acc.total).toBe(0.96);
    expect(acc.avg).toBe(0.96);
  });

  it('cumulative metric dedup: picks the source with the highest daily total', async () => {
    const xml = wrap(`
      <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Apple&#160;Watch"
              ${dayAttrs} value="7000"/>
      <Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone"
              ${dayAttrs} value="4000"/>`);
    const d = await parse(xml);
    const acc = d.dailyMetrics.get('2026-04-10')!.accumulators.get(
      'HKQuantityTypeIdentifierStepCount',
    )!;
    expect(acc.total).toBe(7000);
    expect(acc.count).toBe(1);
  });

  it('weight dedup: same date + rounded value from different sources collapses to one', async () => {
    const xml = wrap(`
      <Record type="HKQuantityTypeIdentifierBodyMass" sourceName="Withings"
              startDate="2026-04-10 07:00:00 +0000" endDate="2026-04-10 07:00:01 +0000"
              unit="kg" value="74.5"/>
      <Record type="HKQuantityTypeIdentifierBodyMass" sourceName="MyFitnessPal"
              startDate="2026-04-10 08:00:00 +0000" endDate="2026-04-10 08:00:01 +0000"
              unit="kg" value="74.5"/>`);
    const d = await parse(xml);
    expect(d.weightReadings).toHaveLength(1);
    expect(d.weightReadings[0]!.valueKg).toBe(74.5);
  });

  it('HR zone seconds are bucketed per day', async () => {
    const xml = wrap(`
      <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Apple Watch"
              startDate="2026-04-10 12:00:00 +0000" endDate="2026-04-10 12:00:01 +0000"
              unit="count/min" value="100"/>
      <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Apple Watch"
              startDate="2026-04-10 12:00:02 +0000" endDate="2026-04-10 12:00:03 +0000"
              unit="count/min" value="150"/>`);
    const d = await parse(xml);
    const day = d.dailyMetrics.get('2026-04-10')!;
    expect(day.hrZoneSeconds[1]).toBe(1);  // 100 bpm → zone 1
    expect(day.hrZoneSeconds[4]).toBe(1);  // 150 bpm → zone 4
  });
});

describe('parseHealthXml: sleep', () => {
  const sleep = (start: string, end: string, value: string, source: string) =>
    `<Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="${source}"
             startDate="${start}" endDate="${end}" value="${value}"/>`;

  it('assigns records before 6am to the previous night and sums stages', async () => {
    const xml = wrap(`
      ${sleep('2026-04-11 22:00:00 +0000', '2026-04-12 05:30:00 +0000',
              'HKCategoryValueSleepAnalysisInBed', 'Apple\u00a0Watch')}
      ${sleep('2026-04-11 22:30:00 +0000', '2026-04-12 00:30:00 +0000',
              'HKCategoryValueSleepAnalysisAsleepCore', 'Apple\u00a0Watch')}
      ${sleep('2026-04-12 00:30:00 +0000', '2026-04-12 02:00:00 +0000',
              'HKCategoryValueSleepAnalysisAsleepDeep', 'Apple\u00a0Watch')}
      ${sleep('2026-04-12 02:00:00 +0000', '2026-04-12 04:00:00 +0000',
              'HKCategoryValueSleepAnalysisAsleepREM', 'Apple\u00a0Watch')}
      ${sleep('2026-04-12 04:00:00 +0000', '2026-04-12 05:30:00 +0000',
              'HKCategoryValueSleepAnalysisAwake', 'Apple\u00a0Watch')}`);
    const d = await parse(xml);
    const night = d.sleepNights.get('2026-04-11')!;
    expect(night).toBeTruthy();
    expect(night.inBedMinutes).toBe(450);
    expect(night.coreMinutes).toBe(120);
    expect(night.deepMinutes).toBe(90);
    expect(night.remMinutes).toBe(120);
    expect(night.awakeMinutes).toBe(90);
    expect(night.asleepMinutes).toBe(330);
  });

  it('source-priority dedup: Apple Watch records win over AutoSleep', async () => {
    const xml = wrap(`
      ${sleep('2026-04-11 22:30:00 +0000', '2026-04-12 00:30:00 +0000',
              'HKCategoryValueSleepAnalysisAsleepCore', 'Apple\u00a0Watch')}
      ${sleep('2026-04-11 23:00:00 +0000', '2026-04-12 05:00:00 +0000',
              'HKCategoryValueSleepAnalysisAsleepUnspecified', 'AutoSleep')}`);
    const d = await parse(xml);
    const night = d.sleepNights.get('2026-04-11')!;
    expect(night.source).toBe('Apple\u00a0Watch');
    expect(night.coreMinutes).toBe(120);
    expect(night.asleepMinutes).toBe(120);
  });
});

describe('parseHealthXml: fixture integration', () => {
  it('parses fixtures/tiny.xml end-to-end', async () => {
    const path = resolve(import.meta.dirname, '../../../fixtures/tiny.xml');
    const xml = await readFile(path, 'utf8');
    const d = await parse(xml);

    expect(d.profile.dateOfBirth).toBe('2000-01-01');
    expect(d.profile.exportDate).toBe('2026-04-12 10:00:00 +0000');
    expect(d.workouts).toHaveLength(1);

    const day = d.dailyMetrics.get('2026-04-10')!;
    expect(day.accumulators.get('HKQuantityTypeIdentifierStepCount')!.total).toBe(7000);

    expect(d.weightReadings).toHaveLength(2);
    const night = d.sleepNights.get('2026-04-11')!;
    expect(night.source).toBe('Apple\u00a0Watch');
    expect(night.asleepMinutes).toBeGreaterThan(0);
  });

  it('runs 50 parses of tiny.xml without error (streaming stability)', async () => {
    const path = resolve(import.meta.dirname, '../../../fixtures/tiny.xml');
    const xml = await readFile(path, 'utf8');
    for (let i = 0; i < 50; i++) {
      await parse(xml);
    }
  });

  it('respects AbortSignal', async () => {
    const path = resolve(import.meta.dirname, '../../../fixtures/tiny.xml');
    const xml = await readFile(path, 'utf8');
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(parse(xml, { signal: ctrl.signal })).rejects.toThrow(/abort/i);
  });

  it('calls onProgress with monotonically increasing counters', async () => {
    const path = resolve(import.meta.dirname, '../../../fixtures/tiny.xml');
    const xml = await readFile(path, 'utf8');
    const progress: { bytesRead: number; recordsSeen: number }[] = [];
    await parse(xml, { onProgress: (p) => progress.push({ ...p }) });
    expect(progress.length).toBeGreaterThan(0);
    for (let i = 1; i < progress.length; i++) {
      expect(progress[i]!.bytesRead).toBeGreaterThanOrEqual(progress[i - 1]!.bytesRead);
    }
  });
});
