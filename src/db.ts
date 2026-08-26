import Dexie, { Table } from 'dexie';
import { Category, DailyLog } from './types';

export class TrackerDB extends Dexie {
  categories!: Table<Category, string>;
  dailyLogs!: Table<DailyLog, string>;
  
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
  }
}

export const db = new TrackerDB();