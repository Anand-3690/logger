import { db, CategoryRecord } from './db.js';
import { broadcastPushNotification, createCategoryReminderPayload } from './push.js';

export interface CronExecutionLog {
  timestamp: string;
  timeChecked: string;
  matchedCategories: string[];
  subscribersCount: number;
  notificationsSent: number;
  failures: number;
  triggerType: 'automatic' | 'manual';
}

class InternalCronScheduler {
  private timer: NodeJS.Timeout | null = null;
  private intervalMs: number = 20000; // Check every 20 seconds to accurately hit minute transitions
  private isRunning: boolean = false;
  private lastDispatchedMinute: string = '';
  private executionHistory: CronExecutionLog[] = [];
  private maxHistorySize: number = 30;

  /**
   * Start the background self-hosted cron worker
   */
  public start(): void {
    if (this.isRunning) {
      console.log('[Internal Cron] Scheduler is already active.');
      return;
    }

    this.isRunning = true;
    console.log(`[Internal Cron] 🚀 Self-hosted Cron Scheduler started (evaluating schedules every ${this.intervalMs / 1000}s)`);

    // Run initial tick check
    this.tick().catch((err) => console.warn('[Internal Cron] Error during initial tick:', err));

    // Start interval
    this.timer = setInterval(() => {
      this.tick().catch((err) => console.error('[Internal Cron] Tick error:', err));
    }, this.intervalMs);
  }

  /**
   * Stop the background scheduler
   */
  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log('[Internal Cron] 🛑 Self-hosted Cron Scheduler stopped.');
  }

  /**
   * Periodic evaluation tick
   */
  public async tick(forceAll: boolean = false, isManual: boolean = false): Promise<CronExecutionLog> {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentMinuteStr = `${hours}:${minutes}`;

    // Prevent duplicate dispatch within the same minute unless forced
    if (!forceAll && !isManual && this.lastDispatchedMinute === currentMinuteStr) {
      return {
        timestamp: now.toISOString(),
        timeChecked: currentMinuteStr,
        matchedCategories: [],
        subscribersCount: db.getAllPushSubscriptions().length,
        notificationsSent: 0,
        failures: 0,
        triggerType: 'automatic',
      };
    }

    if (!isManual) {
      this.lastDispatchedMinute = currentMinuteStr;
    }

    // Query categories matching this reminder time
    let matchingCategories: CategoryRecord[] = [];
    if (forceAll) {
      matchingCategories = db.getActiveCategories().filter((c) => Boolean(c.reminder_time));
    } else {
      matchingCategories = db.getCategoriesForReminder(currentMinuteStr);
    }

    const subscriptions = db.getAllPushSubscriptions();
    let totalSent = 0;
    let totalFailed = 0;

    if (matchingCategories.length > 0 && subscriptions.length > 0) {
      console.log(
        `[Internal Cron] ⏰ Time match (${currentMinuteStr}): Found ${matchingCategories.length} categories for ${subscriptions.length} active push subscriber(s). Broadcasting...`
      );

      for (const category of matchingCategories) {
        const payload = createCategoryReminderPayload(category);
        const result = await broadcastPushNotification(payload);
        totalSent += result.sent;
        totalFailed += result.failed;
      }
    }

    const logEntry: CronExecutionLog = {
      timestamp: now.toISOString(),
      timeChecked: currentMinuteStr,
      matchedCategories: matchingCategories.map((c) => `${c.name} (${c.reminder_time})`),
      subscribersCount: subscriptions.length,
      notificationsSent: totalSent,
      failures: totalFailed,
      triggerType: isManual ? 'manual' : 'automatic',
    };

    // Keep history
    this.executionHistory.unshift(logEntry);
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory.pop();
    }

    if (matchingCategories.length > 0) {
      console.log(
        `[Internal Cron] Broadcast finished. Sent: ${totalSent}, Failed: ${totalFailed} for categories: [${logEntry.matchedCategories.join(', ')}]`
      );
    }

    return logEntry;
  }

  /**
   * Get scheduler diagnostic status
   */
  public getStatus() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentServerTime = `${hours}:${minutes}`;

    const activeCategoriesWithReminders = db
      .getActiveCategories()
      .filter((c) => Boolean(c.reminder_time))
      .map((c) => ({
        id: c.id,
        name: c.name,
        reminder_time: c.reminder_time,
      }));

    return {
      isRunning: this.isRunning,
      intervalSeconds: this.intervalMs / 1000,
      currentServerTime,
      currentServerIso: now.toISOString(),
      activeSubscribersCount: db.getAllPushSubscriptions().length,
      categoriesWithReminders: activeCategoriesWithReminders,
      lastDispatchedMinute: this.lastDispatchedMinute || null,
      recentLogs: this.executionHistory.slice(0, 10),
    };
  }
}

export const internalCronScheduler = new InternalCronScheduler();
