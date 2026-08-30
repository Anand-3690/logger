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
