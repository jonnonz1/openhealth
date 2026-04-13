import { SaxesParser, type SaxesAttributeNS } from 'saxes';
import {
  ALL_RECORD_TYPES,
  DEFAULT_MAX_HR,
  HR_ZONES,
  RECORD_TYPES_BODY,
  RECORD_TYPES_CUMULATIVE,
  RECORD_TYPES_SLEEP,
  SLEEP_SOURCE_PRIORITY,
} from './constants.js';
import {
  Accumulator,
  emptyParsedData,
  type ActivityDay,
  type DailyMetrics,
  type ParsedData,
  type SleepNight,
  type WorkoutRecord,
} from './types.js';

/** Progress callback payload emitted while parsing. */
export interface ParseProgress {
  bytesRead: number;
  recordsSeen: number;
}

/** Options accepted by the public parse entry points. */
export interface ParseOptions {
  /** Max HR used for HR zone bucketing. Defaults to DEFAULT_MAX_HR (180). */
  maxHr?: number;
  /** Invoked periodically with cumulative counters. */
  onProgress?: (p: ParseProgress) => void;
  /** Abort signal; parsing rejects with an AbortError when triggered. */
  signal?: AbortSignal;
}

type Attrs = Record<string, string> | Map<string, SaxesAttributeNS>;

/** Replace Apple's non-breaking spaces and trim surrounding whitespace. */
export function normalizeSource(s: string): string {
  return s.replace(/\u00a0/g, ' ').trim();
}

/** Return sleep-source priority (lower = higher priority). 99 = unknown. */
export function sourcePriority(sourceName: string): number {
  const lower = normalizeSource(sourceName).toLowerCase();
  for (const [key, priority] of Object.entries(SLEEP_SOURCE_PRIORITY)) {
    if (lower.includes(key)) return priority;
  }
  return 99;
}

/** Return HR zone (1–5) for a given BPM against the configured max HR. */
export function hrZone(bpm: number, maxHr: number): 1 | 2 | 3 | 4 | 5 {
  const ratio = bpm / maxHr;
  for (const zone of [1, 2, 3, 4] as const) {
    if (ratio < HR_ZONES[zone][1]) return zone;
  }
  return 5;
}

/**
 * Assign a sleep record to a night. Records before 06:00 belong to the
 * preceding calendar day. Works on wall-clock fields of the source string
 * to match Python's tz-aware-but-local-interpretation behavior.
 */
export function sleepNightDate(y: number, m: number, d: number, h: number): string {
  if (h < 6) {
    const prev = new Date(Date.UTC(y, m - 1, d));
    prev.setUTCDate(prev.getUTCDate() - 1);
    return toIsoDate(prev);
  }
  return formatDate(y, m, d);
}

function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return formatDate(y, m, day);
}

function formatDate(y: number, m: number, d: number): string {
  return `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/;

interface ParsedWallClock {
  date: string;
  hour: number;
  jsDate: Date;
}

/**
 * Parse Apple's `YYYY-MM-DD HH:MM:SS ±HHMM` stamp. Returns the wall-clock
 * date string (YYYY-MM-DD), wall-clock hour, and a real Date object for
 * duration arithmetic (timezone-aware).
 */
export function parseAppleDate(s: string): ParsedWallClock | null {
  const m = DATE_RE.exec(s);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${m[7]}${m[8]}:${m[9]}`;
  const jsDate = new Date(iso);
  if (Number.isNaN(jsDate.getTime())) return null;
  return {
    date: `${m[1]}-${m[2]}-${m[3]}`,
    hour: Number(m[4]),
    jsDate,
  };
}

function getAttr(attrs: Attrs, key: string): string {
  if (attrs instanceof Map) {
    const v = attrs.get(key);
    if (!v) return '';
    if (typeof v === 'string') return v;
    return v.value ?? '';
  }
  return attrs[key] ?? '';
}

function parseOptionalFloat(s: string | undefined): number | null {
  if (s === undefined || s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function getOrCreateDay(data: ParsedData, date: string): DailyMetrics {
  let day = data.dailyMetrics.get(date);
  if (!day) {
    day = { accumulators: new Map(), hrZoneSeconds: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
    data.dailyMetrics.set(date, day);
  }
  return day;
}

function getOrCreateAcc(day: DailyMetrics, recordType: string): Accumulator {
  let acc = day.accumulators.get(recordType);
  if (!acc) {
    acc = new Accumulator();
    day.accumulators.set(recordType, acc);
  }
  return acc;
}

/**
 * Parse an Apple Health `export.xml` byte stream. Streaming-safe: runs in
 * ~50MB for a 6M-record export by discarding element state after each
 * top-level close.
 */
export async function parseHealthXml(
  xmlStream: ReadableStream<Uint8Array>,
  opts: ParseOptions = {},
): Promise<ParsedData> {
  const maxHr = opts.maxHr ?? DEFAULT_MAX_HR;
  const data = emptyParsedData();
  const state = new ParserState(data, maxHr);
  const sax = new SaxesParser();

  sax.on('opentag', (tag) => state.onOpen(tag.name, tag.attributes as Attrs));
  sax.on('closetag', (tag) => state.onClose(tag.name));
  sax.on('error', (e) => {
    throw e;
  });

  const reader = xmlStream.getReader();
  const decoder = new TextDecoder('utf-8');
  let bytesRead = 0;

  try {
    for (;;) {
      if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const { value, done } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      sax.write(decoder.decode(value, { stream: true }));
      if (opts.onProgress) {
        opts.onProgress({ bytesRead, recordsSeen: state.recordsSeen });
      }
    }
    sax.write(decoder.decode());
    sax.close();
  } finally {
    reader.releaseLock();
  }

  state.finalize();
  return data;
}

/** Internal: stateful SAX handler. Mirrors Python's iterparse control flow. */
class ParserState {
  recordsSeen = 0;
  private readonly data: ParsedData;
  private readonly maxHr: number;
  private readonly sleepRecords = new Map<string, Array<[string, number, string]>>();
  private readonly cumulativeBySource = new Map<
    string,
    Map<string, Map<string, Accumulator>>
  >();
  private currentWorkout: WorkoutStaging | null = null;

  constructor(data: ParsedData, maxHr: number) {
    this.data = data;
    this.maxHr = maxHr;
  }

  onOpen(name: string, attrs: Attrs): void {
    switch (name) {
      case 'ExportDate':
        this.data.profile.exportDate = getAttr(attrs, 'value');
        return;
      case 'Me':
        this.handleMe(attrs);
        return;
      case 'Record':
        this.recordsSeen += 1;
        this.handleRecord(attrs);
        return;
      case 'ActivitySummary':
        this.handleActivitySummary(attrs);
        return;
      case 'Workout':
        this.currentWorkout = startWorkout(attrs);
        return;
      case 'WorkoutStatistics':
        if (this.currentWorkout) applyWorkoutStat(this.currentWorkout, attrs);
        return;
      case 'MetadataEntry':
        if (this.currentWorkout) {
          this.currentWorkout.meta.set(getAttr(attrs, 'key'), getAttr(attrs, 'value'));
        }
        return;
      default:
        return;
    }
  }

  onClose(name: string): void {
    if (name === 'Workout' && this.currentWorkout) {
      const w = finalizeWorkout(this.currentWorkout);
      if (w) {
        this.data.workouts.push(w);
        if (w.source) this.data.sources.add(w.source);
      }
      this.currentWorkout = null;
    }
  }

  /** Run after the SAX stream ends: merge cumulative sources, build sleep nights. */
  finalize(): void {
    this.mergeCumulative();
    this.buildSleepNights();
    dedupWeights(this.data);
    this.data.weightReadings.sort((a, b) => a.date.localeCompare(b.date));
    this.data.workouts.sort((a, b) => a.start.getTime() - b.start.getTime());
    this.data.profile.sources = [...this.data.sources].sort();
  }

  private handleMe(attrs: Attrs): void {
    this.data.profile.dateOfBirth = getAttr(attrs, 'HKCharacteristicTypeIdentifierDateOfBirth');
    this.data.profile.biologicalSex = getAttr(
      attrs,
      'HKCharacteristicTypeIdentifierBiologicalSex',
    ).replace('HKBiologicalSex', '');
    this.data.profile.bloodType = getAttr(attrs, 'HKCharacteristicTypeIdentifierBloodType').replace(
      'HKBloodType',
      '',
    );
  }

  private handleRecord(attrs: Attrs): void {
    const recType = getAttr(attrs, 'type');
    if (!ALL_RECORD_TYPES.has(recType)) return;

    const source = getAttr(attrs, 'sourceName');
    if (source) this.data.sources.add(source);

    const startStr = getAttr(attrs, 'startDate');
    if (!startStr) return;
    const start = parseAppleDate(startStr);
    if (!start) return;

    if (RECORD_TYPES_SLEEP.has(recType)) {
      this.handleSleepRecord(attrs, start);
      return;
    }

    const valueStr = getAttr(attrs, 'value');
    if (!valueStr) return;
    const value = Number(valueStr);
    if (!Number.isFinite(value)) return;

    if (RECORD_TYPES_BODY.has(recType) && recType === 'HKQuantityTypeIdentifierBodyMass') {
      this.data.weightReadings.push({ date: start.date, valueKg: value, source });
    }

    if (RECORD_TYPES_CUMULATIVE.has(recType)) {
      let byType = this.cumulativeBySource.get(start.date);
      if (!byType) {
        byType = new Map();
        this.cumulativeBySource.set(start.date, byType);
      }
      let bySource = byType.get(recType);
      if (!bySource) {
        bySource = new Map();
        byType.set(recType, bySource);
      }
      let acc = bySource.get(source);
      if (!acc) {
        acc = new Accumulator();
        bySource.set(source, acc);
      }
      acc.add(value);
      return;
    }

    const day = getOrCreateDay(this.data, start.date);
    const acc = getOrCreateAcc(day, recType);
    acc.add(value);

    if (recType === 'HKQuantityTypeIdentifierHeartRate') {
      const zone = hrZone(value, this.maxHr);
      day.hrZoneSeconds[zone] += 1;
    }
  }

  private handleSleepRecord(attrs: Attrs, start: ParsedWallClock): void {
    const valueStr = getAttr(attrs, 'value');
    const endStr = getAttr(attrs, 'endDate');
    if (!endStr) return;
    const end = parseAppleDate(endStr);
    if (!end) return;
    const duration = (end.jsDate.getTime() - start.jsDate.getTime()) / 60000;
    const source = getAttr(attrs, 'sourceName');
    const [y, m, d] = start.date.split('-').map(Number) as [number, number, number];
    const night = sleepNightDate(y, m, d, start.hour);
    let list = this.sleepRecords.get(night);
    if (!list) {
      list = [];
      this.sleepRecords.set(night, list);
    }
    list.push([valueStr, duration, source]);
  }

  private handleActivitySummary(attrs: Attrs): void {
    const dateStr = getAttr(attrs, 'dateComponents');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;
    const year = Number(dateStr.slice(0, 4));
    if (year < 2000) return;
    const day: ActivityDay = {
      date: dateStr,
      activeEnergyKj: Number(getAttr(attrs, 'activeEnergyBurned') || 0),
      activeEnergyGoalKj: Number(getAttr(attrs, 'activeEnergyBurnedGoal') || 0),
      exerciseMinutes: Number(getAttr(attrs, 'appleExerciseTime') || 0),
      exerciseGoalMinutes: Number(getAttr(attrs, 'appleExerciseTimeGoal') || 0),
      standHours: Number(getAttr(attrs, 'appleStandHours') || 0),
      standGoal: Number(getAttr(attrs, 'appleStandHoursGoal') || 0),
      moveMinutes: Number(getAttr(attrs, 'appleMoveTime') || 0),
      moveGoal: Number(getAttr(attrs, 'appleMoveTimeGoal') || 0),
    };
    this.data.activityDays.set(dateStr, day);
  }

  private mergeCumulative(): void {
    for (const [date, byType] of this.cumulativeBySource) {
      const day = getOrCreateDay(this.data, date);
      for (const [recType, bySource] of byType) {
        let bestSource: string | null = null;
        let bestTotal = Number.NEGATIVE_INFINITY;
        let bestAcc: Accumulator | null = null;
        for (const [source, acc] of bySource) {
          if (acc.total > bestTotal) {
            bestTotal = acc.total;
            bestSource = source;
            bestAcc = acc;
          }
        }
        if (!bestAcc) continue;
        const merged = getOrCreateAcc(day, recType);
        merged.count = bestAcc.count;
        merged.total = bestAcc.total;
        (merged as unknown as { minVal: number }).minVal = bestAcc.min ?? Number.POSITIVE_INFINITY;
        (merged as unknown as { maxVal: number }).maxVal = bestAcc.max ?? Number.NEGATIVE_INFINITY;
        void bestSource;
      }
    }
  }

  private buildSleepNights(): void {
    for (const [nightDate, records] of this.sleepRecords) {
      const sourcesPresent = new Set(records.map((r) => r[2]));
      const priorities = [...sourcesPresent].map(sourcePriority);
      const bestPriority = Math.min(...priorities);
      const bestSources = new Set(
        [...sourcesPresent].filter((s) => sourcePriority(s) === bestPriority),
      );

      const night: SleepNight = {
        date: nightDate,
        inBedMinutes: 0,
        asleepMinutes: 0,
        coreMinutes: 0,
        deepMinutes: 0,
        remMinutes: 0,
        awakeMinutes: 0,
        source: '',
      };

      for (const [value, duration, source] of records) {
        if (!bestSources.has(source)) continue;
        night.source = source;
        if (value.includes('InBed')) night.inBedMinutes += duration;
        else if (value.includes('AsleepCore')) {
          night.coreMinutes += duration;
          night.asleepMinutes += duration;
        } else if (value.includes('AsleepDeep')) {
          night.deepMinutes += duration;
          night.asleepMinutes += duration;
        } else if (value.includes('AsleepREM')) {
          night.remMinutes += duration;
          night.asleepMinutes += duration;
        } else if (value.includes('AsleepUnspecified')) {
          night.asleepMinutes += duration;
        } else if (value.includes('Awake')) {
          night.awakeMinutes += duration;
        }
      }

      if (night.inBedMinutes > 0 || night.asleepMinutes > 0) {
        this.data.sleepNights.set(nightDate, night);
      }
    }
  }
}

interface WorkoutStaging {
  activityType: string;
  source: string;
  startStr: string;
  endStr: string;
  duration: number;
  distance: number | null;
  energy: number | null;
  avgHr: number | null;
  maxHr: number | null;
  minHr: number | null;
  steps: number | null;
  meta: Map<string, string>;
}

function startWorkout(attrs: Attrs): WorkoutStaging {
  const w: WorkoutStaging = {
    activityType: getAttr(attrs, 'workoutActivityType'),
    source: getAttr(attrs, 'sourceName'),
    startStr: getAttr(attrs, 'startDate'),
    endStr: getAttr(attrs, 'endDate'),
    duration: Number(getAttr(attrs, 'duration') || 0),
    distance: null,
    energy: null,
    avgHr: null,
    maxHr: null,
    minHr: null,
    steps: null,
    meta: new Map(),
  };

  const totalDist = getAttr(attrs, 'totalDistance');
  if (totalDist) {
    const n = Number(totalDist);
    if (Number.isFinite(n)) {
      const unit = getAttr(attrs, 'totalDistanceUnit') || 'km';
      w.distance = unit === 'mi' ? n * 1.60934 : n;
    }
  }

  const totalEnergy = getAttr(attrs, 'totalEnergyBurned');
  if (totalEnergy) {
    const n = Number(totalEnergy);
    if (Number.isFinite(n)) {
      const unit = getAttr(attrs, 'totalEnergyBurnedUnit') || 'kJ';
      w.energy = unit === 'kcal' ? n * 4.184 : n;
    }
  }

  return w;
}

function applyWorkoutStat(w: WorkoutStaging, attrs: Attrs): void {
  const t = getAttr(attrs, 'type');
  switch (t) {
    case 'HKQuantityTypeIdentifierHeartRate':
      w.avgHr = parseOptionalFloat(getAttr(attrs, 'average'));
      w.maxHr = parseOptionalFloat(getAttr(attrs, 'maximum'));
      w.minHr = parseOptionalFloat(getAttr(attrs, 'minimum'));
      return;
    case 'HKQuantityTypeIdentifierDistanceWalkingRunning':
      if (w.distance === null) w.distance = parseOptionalFloat(getAttr(attrs, 'sum'));
      return;
    case 'HKQuantityTypeIdentifierActiveEnergyBurned':
      if (w.energy === null) w.energy = parseOptionalFloat(getAttr(attrs, 'sum'));
      return;
    case 'HKQuantityTypeIdentifierStepCount':
      w.steps = parseOptionalFloat(getAttr(attrs, 'sum'));
      return;
    default:
      return;
  }
}

function finalizeWorkout(w: WorkoutStaging): WorkoutRecord | null {
  if (!w.startStr || !w.endStr) return null;
  const start = parseAppleDate(w.startStr);
  const end = parseAppleDate(w.endStr);
  if (!start || !end) return null;

  const indoor = w.meta.get('HKIndoorWorkout') === '1';

  let weatherTempF: number | null = null;
  const tempStr = w.meta.get('HKWeatherTemperature');
  if (tempStr) {
    const n = Number(tempStr.split(/\s+/)[0]);
    if (Number.isFinite(n)) weatherTempF = n;
  }

  let weatherHumidity: number | null = null;
  const humStr = w.meta.get('HKWeatherHumidity');
  if (humStr) {
    const n = Number(humStr.split(/\s+/)[0]);
    if (Number.isFinite(n)) weatherHumidity = n / 100;
  }

  return {
    activityType: w.activityType,
    start: start.jsDate,
    end: end.jsDate,
    durationMinutes: w.duration,
    distanceKm: w.distance,
    energyKj: w.energy,
    avgHr: w.avgHr,
    maxHr: w.maxHr,
    minHr: w.minHr,
    source: w.source,
    indoor,
    weatherTempF,
    weatherHumidity,
    steps: w.steps,
  };
}

function dedupWeights(data: ParsedData): void {
  const seen = new Set<string>();
  const out: typeof data.weightReadings = [];
  for (const r of data.weightReadings) {
    const key = `${r.date}:${r.valueKg.toFixed(2)}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(r);
    }
  }
  data.weightReadings = out;
}
