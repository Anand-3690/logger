export interface Category {
  id: string;
  name: string;
  color_code: string;
  icon: string;
  reminder_time?: string | null; // e.g. "09:00", "20:30" (HH:MM 24h format)
  is_active: boolean;
  is_on_this_day?: boolean; // When true, included in "On This Day" retrospective view and notifications
  sort_order?: number;
}

export const isCategoryOnThisDay = (cat: { is_on_this_day?: boolean; name: string }): boolean => {
  if (cat.is_on_this_day !== undefined) {
    return Boolean(cat.is_on_this_day);
  }
  return cat.name === 'Guruhari Darshan';
};

export interface PushSubscriptionRecord {
  id: string;
  subscription_json: string;
  created_at: string;
}

export interface AppNotificationAction {
  action: string;
  title: string;
  variant?: 'primary' | 'secondary' | 'danger';
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  icon?: string;
  type?: 'on-this-day' | 'resolution' | 'habit' | 'general';
  data?: {
    url?: string;
    log_date?: string;
    category_id?: string;
    category_name?: string;
    resolution_id?: string;
    resolution_title?: string;
    [key: string]: any;
  };
  actions?: AppNotificationAction[];
  timestamp?: number;
}

export const APP_NOTIFICATION_EVENT = 'daily_logger_app_notification';

export type ResolutionInterval = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface Resolution {
  id: string;
  category_id?: string;
  title: string;
  description?: string;
  interval_type: ResolutionInterval;
  reminder_time: string; // "HH:MM" in 24h format, e.g. "07:30"
  days_of_week?: number[]; // 0 = Sun, 1 = Mon, ..., 6 = Sat (for weekly)
  day_of_month?: number; // 1..31 (for monthly)
  month_of_year?: number; // 1..12 (for yearly)
  custom_interval_days?: number; // e.g. every 3 days
  start_date: string; // YYYY-MM-DD
  is_active: boolean;
  last_completed_at?: string | null; // YYYY-MM-DD
  created_at: string;
  updated_at?: string;
}

export function isResolutionDueOnDate(res: Resolution, dateStr: string): boolean {
  if (!res.is_active) return false;
  if (!dateStr || (res.start_date && dateStr < res.start_date)) return false;

  const parts = dateStr.split('T')[0].split('-').map(Number);
  if (parts.length < 3) return false;
  const [year, month, day] = parts;

  switch (res.interval_type) {
    case 'daily':
      return true;

    case 'weekly': {
      // Create local date to determine day of week (0 = Sun, 6 = Sat)
      const d = new Date(year, month - 1, day);
      const dayOfWeek = d.getDay();
      return Array.isArray(res.days_of_week) && res.days_of_week.includes(dayOfWeek);
    }

    case 'monthly': {
      const targetDay = res.day_of_month ?? 1;
      return day === targetDay;
    }

    case 'yearly': {
      const targetMonth = res.month_of_year ?? 1;
      const targetDay = res.day_of_month ?? 1;
      return month === targetMonth && day === targetDay;
    }

    case 'custom': {
      const interval = res.custom_interval_days && res.custom_interval_days > 0 ? res.custom_interval_days : 1;
      const startParts = (res.start_date || dateStr).split('T')[0].split('-').map(Number);
      const startMs = new Date(startParts[0], startParts[1] - 1, startParts[2]).getTime();
      const currentMs = new Date(year, month - 1, day).getTime();
      const diffDays = Math.round((currentMs - startMs) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays % interval === 0;
    }

    default:
      return true;
  }
}

export interface DailyLog {
  id: string;
  log_date: string; // YYYY-MM-DD
  logical_date?: string; // YYYY-MM-DD (accounting for cutoff hour)
  category_id: string;
  notes?: string | null;
  photo_url?: string | null;
  photo_storage_path?: string | null;
  photo_data?: string | null; // Base64 data URL for offline instant backup
  status?: 'present' | 'absent';
  created_at: string; // ISO timestamp
  updated_at?: string; // Added for sync engine conflict resolution
  local_photo?: File | Blob; // Added for offline-first blob storage
  category?: Category;
}

export interface CategorySummary {
  category: Category;
  count: number;
  percentage: number;
  dates: string[];
}

export interface MonthlyStats {
  month: string; // YYYY-MM
  totalLogs: number;
  activeDaysCount: number;
  daysInMonth: number;
  topCategory: Category | null;
  photoCount: number;
  categoryBreakdown: CategorySummary[];
  dailyCounts: Record<string, number>;
  logs: DailyLog[];
}
