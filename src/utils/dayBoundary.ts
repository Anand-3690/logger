/**
 * Day boundary calculation, timezone handling, and logical date management.
 * Default cutoff is 4:00 AM in Asia/Kolkata timezone.
 */

import { addDaysToDate, formatLocalDate } from './dateUtils';
import type { TrackerDB } from '../db';
import type { DailyLog } from '../types';

export const DEFAULT_DAY_CUTOFF_HOUR = 4; // 4:00 AM
export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

export const DAY_CUTOFF_OPTIONS = [
  { hour: 0, label: '12:00 AM (Midnight)' },
  { hour: 1, label: '1:00 AM' },
  { hour: 2, label: '2:00 AM' },
  { hour: 3, label: '3:00 AM' },
  { hour: 4, label: '4:00 AM (Default)' },
  { hour: 5, label: '5:00 AM' },
  { hour: 6, label: '6:00 AM' },
];

const SETTINGS_CUTOFF_KEY = 'activity_day_cutoff_hour';
const SETTINGS_TIMEZONE_KEY = 'activity_user_timezone';

/**
 * Retrieve saved "Day ends at" setting (0 to 6), defaulting to 4 (4:00 AM).
 */
export function getDayCutoffHour(): number {
  if (typeof window === 'undefined') return DEFAULT_DAY_CUTOFF_HOUR;
  try {
    const saved = localStorage.getItem(SETTINGS_CUTOFF_KEY);
    if (saved !== null) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 6) {
        return parsed;
      }
    }
  } catch {
    // Ignore localStorage access restrictions
  }
  return DEFAULT_DAY_CUTOFF_HOUR;
}

/**
 * Save "Day ends at" setting to localStorage.
 */
export function setDayCutoffHour(hour: number): void {
  if (typeof window === 'undefined') return;
  try {
    const clamped = Math.max(0, Math.min(6, Math.floor(hour)));
    localStorage.setItem(SETTINGS_CUTOFF_KEY, String(clamped));
    window.dispatchEvent(new CustomEvent('activity_settings_changed', { detail: { dayCutoffHour: clamped } }));
  } catch (e) {
    console.warn('Failed to save day cutoff setting:', e);
  }
}

/**
 * Retrieve user's configured timezone or detected timezone, defaulting to Asia/Kolkata.
 */
export function getUserTimezone(): string {
  if (typeof window === 'undefined') return DEFAULT_TIMEZONE;
  try {
    const saved = localStorage.getItem(SETTINGS_TIMEZONE_KEY);
    if (saved) return saved;

    // Detect browser timezone if valid
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected) return detected;
  } catch {
    // fallback
  }
  return DEFAULT_TIMEZONE;
}

/**
 * Save user timezone preference.
 */
export function setUserTimezone(tz: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_TIMEZONE_KEY, tz);
    window.dispatchEvent(new CustomEvent('activity_settings_changed', { detail: { timezone: tz } }));
  } catch (e) {
    console.warn('Failed to save timezone preference:', e);
  }
}

/**
 * Extract zoned calendar date and time parts using standard Intl.DateTimeFormat.
 * Accurately accounts for DST and non-DST offsets.
 */
export function getZonedTimeParts(date: Date, timeZone: string = getUserTimezone()) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const partMap: Record<string, string> = {};
    for (const part of parts) {
      partMap[part.type] = part.value;
    }
    const rawHour = partMap.hour || '0';
    return {
      year: parseInt(partMap.year, 10),
      month: parseInt(partMap.month, 10),
      day: parseInt(partMap.day, 10),
      hour: parseInt(rawHour === '24' ? '0' : rawHour, 10),
      minute: parseInt(partMap.minute || '0', 10),
      second: parseInt(partMap.second || '0', 10),
    };
  } catch {
    // Fallback to local Date methods if Intl timezone resolution fails
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
    };
  }
}

/**
 * Compute the logical date "YYYY-MM-DD" for a given timestamp or Date.
 * If local time is before cutoffHour, the log belongs to the previous calendar day.
 */
export function computeLogicalDate(
  createdAtOrDate: string | Date | undefined,
  cutoffHour: number = getDayCutoffHour(),
  timeZone: string = getUserTimezone(),
  fallbackLogDate?: string
): string {
  if (!createdAtOrDate) {
    return fallbackLogDate || formatLocalDate(new Date());
  }

  let d: Date;
  if (typeof createdAtOrDate === 'string') {
    // If it's only a pure date "YYYY-MM-DD", return as-is or fallback
    if (/^\d{4}-\d{2}-\d{2}$/.test(createdAtOrDate)) {
      return createdAtOrDate;
    }
    d = new Date(createdAtOrDate);
  } else {
    d = createdAtOrDate;
  }

  if (isNaN(d.getTime())) {
    return fallbackLogDate || formatLocalDate(new Date());
  }

  const parts = getZonedTimeParts(d, timeZone);
  const calendarDate = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;

  // If cutoff is e.g. 4:00 AM, and hour is 0, 1, 2, or 3, it counts for previous day
  if (cutoffHour > 0 && parts.hour < cutoffHour) {
    return addDaysToDate(calendarDate, -1);
  }

  return calendarDate;
}

/**
 * Get today's logical date "YYYY-MM-DD" based on current moment and cutoff setting.
 * E.g., at 1:30 AM with cutoff at 4:00 AM, returns yesterday's calendar date as today's logical date.
 */
export function getTodayLogicalDate(
  cutoffHour: number = getDayCutoffHour(),
  timeZone: string = getUserTimezone()
): string {
  return computeLogicalDate(new Date(), cutoffHour, timeZone);
}

/**
 * Check if an entry was written after midnight and before the day cutoff.
 */
export function isLateNightEntry(
  createdAtOrDate: string | Date | undefined,
  cutoffHour: number = getDayCutoffHour(),
  timeZone: string = getUserTimezone()
): boolean {
  if (!createdAtOrDate || cutoffHour <= 0) return false;

  const d = typeof createdAtOrDate === 'string' ? new Date(createdAtOrDate) : createdAtOrDate;
  if (isNaN(d.getTime())) return false;

  const parts = getZonedTimeParts(d, timeZone);
  return parts.hour < cutoffHour;
}

/**
 * Returns a small label "Late night, counted for <weekday>" if the log was created after midnight
 * and before the cutoff hour.
 */
export function getLateNightChipLabel(
  createdAt: string | undefined,
  logicalDate: string,
  cutoffHour: number = getDayCutoffHour(),
  timeZone: string = getUserTimezone()
): string | null {
  if (!createdAt || !isLateNightEntry(createdAt, cutoffHour, timeZone)) {
    return null;
  }

  try {
    const [y, m, d] = logicalDate.split('-').map(Number);
    const dateObj = new Date(y, (m || 1) - 1, d || 1);
    const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    return `Late night, counted for ${weekday}`;
  } catch {
    return 'Late night';
  }
}

/**
 * Get effective logical date for any log record, falling back to log_date if logical_date is missing.
 */
export function getEffectiveLogDate(log: { logical_date?: string | null; log_date: string }): string {
  return log.logical_date || log.log_date;
}

/**
 * Safe, backward-compatible Dexie migration to backfill logical_date for all existing records.
 * Original timestamps and log_date fields are strictly preserved.
 */
export async function backfillExistingLogs(db: TrackerDB): Promise<number> {
  const cutoffHour = getDayCutoffHour();
  const timeZone = getUserTimezone();
  let updatedCount = 0;

  try {
    const logs = await db.dailyLogs.toArray();
    const updates: Partial<DailyLog>[] = [];

    for (const log of logs) {
      if (!log.logical_date) {
        const computed = computeLogicalDate(log.created_at || log.log_date, cutoffHour, timeZone, log.log_date);
        updates.push({ id: log.id, logical_date: computed });
      }
    }

    if (updates.length > 0) {
      await db.transaction('rw', db.dailyLogs, async () => {
        for (const update of updates) {
          if (update.id && update.logical_date) {
            await db.dailyLogs.update(update.id, { logical_date: update.logical_date });
            updatedCount++;
          }
        }
      });
      console.log(`[DayBoundary] Successfully backfilled logical_date on ${updatedCount} logs.`);
    }
  } catch (err) {
    console.warn('[DayBoundary] Error while backfilling logical_date:', err);
  }

  return updatedCount;
}
