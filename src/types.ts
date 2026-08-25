export interface Category {
  id: string;
  name: string;
  color_code: string;
  icon: string;
  reminder_time?: string | null; // e.g. "09:00", "20:30" (HH:MM 24h format)
  is_active: boolean;
}

export interface PushSubscriptionRecord {
  id: string;
  subscription_json: string;
  created_at: string;
}

export interface DailyLog {
  id: string;
  log_date: string; // YYYY-MM-DD
  category_id: string;
  notes?: string | null;
  photo_url?: string | null;
  created_at: string; // ISO timestamp
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
