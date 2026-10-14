import Dexie, { Table } from 'dexie';
import { Category, DailyLog, Resolution } from './types';
import { computeLogicalDate, getDayCutoffHour, getUserTimezone } from './utils/dayBoundary';

export class TrackerDB extends Dexie {
  categories!: Table<Category, string>;
  dailyLogs!: Table<DailyLog, string>;
  resolutions!: Table<Resolution, string>;
  
  // A table to track unsynced local changes
  syncQueue!: Table<{ id: string; table: string; action: 'upsert' | 'delete'; timestamp: number }, string>;

  constructor() {
    super('TrackerLocalDB');
    
    // Define the local schema and indexes for fast querying
    this.version(1).stores({
      categories: 'id, name, is_active, updated_at',
      dailyLogs: 'id, log_date, category_id, updated_at, [log_date+category_id]',
      syncQueue: 'id, table, timestamp'
    });

    // Version 2: Added logical_date index with safe, non-destructive backfill
    this.version(2).stores({
      dailyLogs: 'id, log_date, logical_date, category_id, updated_at, [logical_date+category_id], [log_date+category_id]'
    }).upgrade(async (tx) => {
      const cutoffHour = getDayCutoffHour();
      const timeZone = getUserTimezone();
      await tx.table('dailyLogs').toCollection().modify((log: any) => {
        if (!log.logical_date) {
          log.logical_date = computeLogicalDate(
            log.created_at || log.log_date,
            cutoffHour,
            timeZone,
            log.log_date
          );
        }
      });
    });

    // Version 3: Added resolutions table for flexible interval habit & goal tracking
    this.version(3).stores({
      resolutions: 'id, category_id, is_active, interval_type, reminder_time, updated_at'
    });
  }
}

export const db = new TrackerDB();