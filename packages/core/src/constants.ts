/**
 * Record-type identifiers, unit conversions, and fixed configuration.
 * Values are copied verbatim from the Python reference (constants.py) —
 * any divergence breaks the snapshot byte-for-byte parity guarantee.
 */

/** Age-40 default: 220 − 40 = 180 bpm. Overridable via CLI flag. */
export const DEFAULT_MAX_HR = 180;

/** Lower/upper bounds of each HR zone as a fraction of max HR. */
export const HR_ZONES: Record<1 | 2 | 3 | 4 | 5, readonly [number, number]> = {
  1: [0, 0.6],
  2: [0.6, 0.7],
  3: [0.7, 0.8],
  4: [0.8, 0.9],
  5: [0.9, 1.0],
};

/**
 * Record types that are cumulative per day. Multiple sources (Watch + iPhone)
 * report overlapping samples; we pick the source with the highest daily total.
 */
export const RECORD_TYPES_CUMULATIVE: ReadonlySet<string> = new Set([
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
  'HKQuantityTypeIdentifierFlightsClimbed',
]);

export const RECORD_TYPES_DAILY: ReadonlySet<string> = new Set([
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
  'HKQuantityTypeIdentifierFlightsClimbed',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierBasalEnergyBurned',
  'HKQuantityTypeIdentifierAppleExerciseTime',
]);

export const RECORD_TYPES_HR: ReadonlySet<string> = new Set([
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierWalkingHeartRateAverage',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKQuantityTypeIdentifierHeartRateRecoveryOneMinute',
]);

export const RECORD_TYPES_BODY: ReadonlySet<string> = new Set([
  'HKQuantityTypeIdentifierBodyMass',
  'HKQuantityTypeIdentifierBodyMassIndex',
  'HKQuantityTypeIdentifierBodyFatPercentage',
  'HKQuantityTypeIdentifierLeanBodyMass',
  'HKQuantityTypeIdentifierHeight',
]);

export const RECORD_TYPES_NUTRITION: ReadonlySet<string> = new Set([
  'HKQuantityTypeIdentifierDietaryEnergyConsumed',
  'HKQuantityTypeIdentifierDietaryProtein',
  'HKQuantityTypeIdentifierDietaryFatTotal',
  'HKQuantityTypeIdentifierDietaryCarbohydrates',
  'HKQuantityTypeIdentifierDietaryFiber',
  'HKQuantityTypeIdentifierDietarySugar',
  'HKQuantityTypeIdentifierDietaryCaffeine',
  'HKQuantityTypeIdentifierDietaryWater',
]);

export const RECORD_TYPES_RESPIRATORY: ReadonlySet<string> = new Set([
  'HKQuantityTypeIdentifierRespiratoryRate',
  'HKQuantityTypeIdentifierOxygenSaturation',
]);

export const RECORD_TYPES_WALKING: ReadonlySet<string> = new Set([
  'HKQuantityTypeIdentifierWalkingSpeed',
  'HKQuantityTypeIdentifierWalkingStepLength',
  'HKQuantityTypeIdentifierWalkingDoubleSupportPercentage',
  'HKQuantityTypeIdentifierWalkingAsymmetryPercentage',
  'HKQuantityTypeIdentifierStairAscentSpeed',
  'HKQuantityTypeIdentifierStairDescentSpeed',
]);

export const RECORD_TYPES_RUNNING: ReadonlySet<string> = new Set([
  'HKQuantityTypeIdentifierRunningSpeed',
  'HKQuantityTypeIdentifierRunningPower',
  'HKQuantityTypeIdentifierRunningStrideLength',
  'HKQuantityTypeIdentifierRunningGroundContactTime',
  'HKQuantityTypeIdentifierRunningVerticalOscillation',
]);

export const RECORD_TYPES_SLEEP: ReadonlySet<string> = new Set([
  'HKCategoryTypeIdentifierSleepAnalysis',
]);

export const RECORD_TYPES_OTHER: ReadonlySet<string> = new Set([
  'HKQuantityTypeIdentifierAppleSleepingWristTemperature',
  'HKQuantityTypeIdentifierAppleSleepingBreathingDisturbances',
  'HKQuantityTypeIdentifierTimeInDaylight',
  'HKQuantityTypeIdentifierEnvironmentalAudioExposure',
]);

/** Union of every record type the parser retains. */
export const ALL_RECORD_TYPES: ReadonlySet<string> = new Set([
  ...RECORD_TYPES_DAILY,
  ...RECORD_TYPES_HR,
  ...RECORD_TYPES_BODY,
  ...RECORD_TYPES_NUTRITION,
  ...RECORD_TYPES_RESPIRATORY,
  ...RECORD_TYPES_WALKING,
  ...RECORD_TYPES_RUNNING,
  ...RECORD_TYPES_SLEEP,
  ...RECORD_TYPES_OTHER,
]);

/** Display short-names for record types (column headers, markdown). */
export const RECORD_SHORT_NAMES: Readonly<Record<string, string>> = {
  HKQuantityTypeIdentifierStepCount: 'Steps',
  HKQuantityTypeIdentifierDistanceWalkingRunning: 'Distance (km)',
  HKQuantityTypeIdentifierFlightsClimbed: 'Flights Climbed',
  HKQuantityTypeIdentifierActiveEnergyBurned: 'Active Energy (kJ)',
  HKQuantityTypeIdentifierBasalEnergyBurned: 'Basal Energy (kJ)',
  HKQuantityTypeIdentifierAppleExerciseTime: 'Exercise (min)',
  HKQuantityTypeIdentifierHeartRate: 'Heart Rate',
  HKQuantityTypeIdentifierRestingHeartRate: 'Resting HR',
  HKQuantityTypeIdentifierWalkingHeartRateAverage: 'Walking HR Avg',
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN: 'HRV (ms)',
  HKQuantityTypeIdentifierHeartRateRecoveryOneMinute: 'HR Recovery',
  HKQuantityTypeIdentifierBodyMass: 'Weight (kg)',
  HKQuantityTypeIdentifierBodyMassIndex: 'BMI',
  HKQuantityTypeIdentifierBodyFatPercentage: 'Body Fat %',
  HKQuantityTypeIdentifierLeanBodyMass: 'Lean Mass (kg)',
  HKQuantityTypeIdentifierHeight: 'Height (cm)',
  HKQuantityTypeIdentifierDietaryEnergyConsumed: 'Calories In (kJ)',
  HKQuantityTypeIdentifierDietaryProtein: 'Protein (g)',
  HKQuantityTypeIdentifierDietaryFatTotal: 'Fat (g)',
  HKQuantityTypeIdentifierDietaryCarbohydrates: 'Carbs (g)',
  HKQuantityTypeIdentifierDietaryFiber: 'Fiber (g)',
  HKQuantityTypeIdentifierDietarySugar: 'Sugar (g)',
  HKQuantityTypeIdentifierDietaryCaffeine: 'Caffeine (mg)',
  HKQuantityTypeIdentifierDietaryWater: 'Water (mL)',
  HKQuantityTypeIdentifierRespiratoryRate: 'Resp Rate',
  HKQuantityTypeIdentifierOxygenSaturation: 'SpO2',
  HKQuantityTypeIdentifierWalkingSpeed: 'Walking Speed (km/h)',
  HKQuantityTypeIdentifierWalkingStepLength: 'Step Length (cm)',
  HKQuantityTypeIdentifierWalkingDoubleSupportPercentage: 'Double Support %',
  HKQuantityTypeIdentifierWalkingAsymmetryPercentage: 'Walk Asymmetry %',
  HKQuantityTypeIdentifierAppleSleepingWristTemperature: 'Wrist Temp (°C)',
  HKQuantityTypeIdentifierAppleSleepingBreathingDisturbances: 'Breathing Disturbances',
  HKQuantityTypeIdentifierTimeInDaylight: 'Daylight (min)',
};

export const WORKOUT_SHORT_NAMES: Readonly<Record<string, string>> = {
  HKWorkoutActivityTypeWalking: 'Walking',
  HKWorkoutActivityTypeRunning: 'Running',
  HKWorkoutActivityTypeFunctionalStrengthTraining: 'Functional Strength',
  HKWorkoutActivityTypeTraditionalStrengthTraining: 'Strength Training',
  HKWorkoutActivityTypeCoreTraining: 'Core Training',
  HKWorkoutActivityTypeElliptical: 'Elliptical',
  HKWorkoutActivityTypeHiking: 'Hiking',
  HKWorkoutActivityTypeCycling: 'Cycling',
  HKWorkoutActivityTypeSwimming: 'Swimming',
  HKWorkoutActivityTypeYoga: 'Yoga',
  HKWorkoutActivityTypeHighIntensityIntervalTraining: 'HIIT',
};

export const SLEEP_VALUE_NAMES: Readonly<Record<string, string>> = {
  HKCategoryValueSleepAnalysisInBed: 'In Bed',
  HKCategoryValueSleepAnalysisAsleepUnspecified: 'Asleep',
  HKCategoryValueSleepAnalysisAsleepCore: 'Core',
  HKCategoryValueSleepAnalysisAsleepDeep: 'Deep',
  HKCategoryValueSleepAnalysisAsleepREM: 'REM',
  HKCategoryValueSleepAnalysisAwake: 'Awake',
};

/**
 * Sleep-source priority. Lower wins. Sources absent from the map are treated
 * as lowest priority. Matching is done on a lowercased source name.
 */
export const SLEEP_SOURCE_PRIORITY: Readonly<Record<string, number>> = {
  'apple watch': 1,
  autosleep: 2,
};

/** 1 kcal = 4.184 kJ. */
export const KJ_TO_KCAL = 1 / 4.184;

/** Convert Fahrenheit to Celsius. */
export function fahrenheitToCelsius(f: number): number {
  return ((f - 32) * 5) / 9;
}

/** Output-window constants, matching Python. */
export const WEEKS_WEEKLY_SUMMARY = 5;
export const WEEKS_WORKOUTS = 4;
export const WEEKS_SLEEP = 8;
export const MONTHS_WEIGHT_TREND = 6;
export const MONTHS_WEIGHT_READINGS = 3;
export const MONTHS_CARDIO = 3;
export const MONTHS_NUTRITION = 3;

/** `strptime` format for Apple Health `<Record startDate="...">` values. */
export const APPLE_HEALTH_DATE_FORMAT = '%Y-%m-%d %H:%M:%S %z';
