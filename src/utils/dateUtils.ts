/**
 * Safe local calendar date utility functions.
 * Avoids UTC timezone conversion mismatches between Date.toISOString() and local Date.getDate().
 */

/**
 * Format a Date object as "YYYY-MM-DD" using local calendar values.
 */
export function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns today's date in local calendar time as "YYYY-MM-DD".
 */
export function getTodayLocalDate(): string {
  return formatLocalDate(new Date());
}

/**
 * Parses "YYYY-MM-DD" into a local midnight Date object (safe from UTC shifts).
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr || !dateStr.includes('-')) {
    return new Date();
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 0, 0, 0, 0);
}

/**
 * Formats "YYYY-MM-DD" into a long human-readable date, e.g. "Wednesday, August 26, 2026".
 */
export function formatLongDate(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Formats "YYYY-MM-DD" into short month & day, e.g. "Aug 26".
 */
export function formatShortDate(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Add or subtract days from a "YYYY-MM-DD" date string in local calendar time.
 */
export function addDaysToDate(dateStr: string, amount: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + amount);
  return formatLocalDate(d);
}

/**
 * Returns current month string "YYYY-MM" in local time.
 */
export function getCurrentLocalMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
