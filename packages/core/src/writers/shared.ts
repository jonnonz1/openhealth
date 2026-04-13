import { KJ_TO_KCAL } from '../constants.js';

/** Format a number with thousands separators and fixed decimal places. "—" when null. */
export function fmt(val: number | null | undefined, decimals = 1): string {
  if (val === null || val === undefined) return '—';
  return val.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Format minutes as "Xh Ym" / "Ym" / "—". */
export function fmtMinsAsHm(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || minutes === 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Convert kJ to kcal, preserving null. */
export function kjToKcal(kj: number | null | undefined): number | null {
  if (kj === null || kj === undefined) return null;
  return kj * KJ_TO_KCAL;
}

/** Format a percentage to one decimal place. */
export function pct(val: number | null | undefined): string {
  if (val === null || val === undefined) return '—';
  return `${val.toFixed(1)}%`;
}

/** Format an SpO2 reading — accepts either 0–1 decimal or 0–100 scale. */
export function spo2(val: number | null | undefined): string {
  if (val === null || val === undefined) return '—';
  if (val <= 1) return `${(val * 100).toFixed(1)}%`;
  return `${val.toFixed(1)}%`;
}

/** Python `strftime('%Y-%m-%d %H:%M')` equivalent on a UTC-backed Date. */
export function formatWorkoutStart(d: Date): string {
  const y = d.getUTCFullYear().toString().padStart(4, '0');
  const mo = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const da = d.getUTCDate().toString().padStart(2, '0');
  const h = d.getUTCHours().toString().padStart(2, '0');
  const mi = d.getUTCMinutes().toString().padStart(2, '0');
  return `${y}-${mo}-${da} ${h}:${mi}`;
}

/** Join lines with "\n" and add a single trailing newline (matches Python `_write`). */
export function joinLines(lines: string[]): string {
  return lines.join('\n');
}
