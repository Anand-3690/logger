import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Target,
  CheckCircle2,
  Clock,
  Calendar,
  Sparkles,
  Plus,
  Trash2,
  Edit3,
  Pause,
  Play,
  Check,
  Flame,
  AlertCircle,
  X,
} from 'lucide-react';
import { db } from '../db';
import { Resolution, ResolutionInterval, isResolutionDueOnDate, DailyLog } from '../types';
import { getTodayLocalDate } from '../utils/dateUtils';
import { processSyncQueue } from '../syncEngine';

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const PRESET_TIMES = ['06:00', '07:00', '08:00', '09:00', '18:00', '20:00', '21:00'];

const SUGGESTIONS = [
  'Morning Meditation & Dhyan (15m)',
  'Read Satsang Book / Vachanamrut',
  '11 Malas Japa & Prarthana',
  'Daily 30 min Exercise & Walk',
  'Ekadashi Fasting',
  'Weekly Sabha Attendance',
  'Night Introspection & Journaling',
];

interface ResolutionsViewProps {
  onToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const ResolutionsView: React.FC<ResolutionsViewProps> = ({ onToast }) => {
  const todayStr = useMemo(() => getTodayLocalDate(), []);

  // Fetch resolutions from local Dexie database
  const resolutions = useLiveQuery(() => db.resolutions.toArray()) || [];
  const categories = useLiveQuery(() => db.categories.toArray()) || [];

  // Find or determine the Resolution category ID
  const resolutionCategory = useMemo(() => {
    return categories.find((c) => c.name.toLowerCase() === 'resolution') || null;
  }, [categories]);

  // View state
  const [activeTab, setActiveTab] = useState<'all' | 'due' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResolution, setEditingResolution] = useState<Resolution | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [intervalType, setIntervalType] = useState<ResolutionInterval>('daily');
  const [reminderTime, setReminderTime] = useState('08:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri default
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [monthOfYear, setMonthOfYear] = useState<number>(1);
  const [customDays, setCustomDays] = useState<number>(3);
  const [startDate, setStartDate] = useState(todayStr);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Open modal for Create
  const handleOpenCreate = () => {
    setEditingResolution(null);
    setTitle('');
    setDescription('');
    setIntervalType('daily');
    setReminderTime('08:00');
    setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
    setDayOfMonth(1);
    setMonthOfYear(1);
    setCustomDays(3);
    setStartDate(todayStr);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (res: Resolution) => {
    setEditingResolution(res);
    setTitle(res.title);
    setDescription(res.description || '');
    setIntervalType(res.interval_type);
    setReminderTime(res.reminder_time || '08:00');
    setSelectedDays(res.days_of_week && res.days_of_week.length > 0 ? res.days_of_week : [0, 1, 2, 3, 4, 5, 6]);
    setDayOfMonth(res.day_of_month || 1);
    setMonthOfYear(res.month_of_year || 1);
    setCustomDays(res.custom_interval_days || 3);
    setStartDate(res.start_date || todayStr);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Save Resolution
  const handleSaveResolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Please enter a resolution title');
      return;
    }

    if (intervalType === 'weekly' && selectedDays.length === 0) {
      setFormError('Please select at least one day of the week for weekly resolutions');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);

      const now = new Date().toISOString();
      const resId = editingResolution ? editingResolution.id : crypto.randomUUID();

      const newRecord: Resolution = {
        id: resId,
        category_id: resolutionCategory?.id,
        title: title.trim(),
        description: description.trim() || undefined,
        interval_type: intervalType,
        reminder_time: reminderTime || '08:00',
        days_of_week: intervalType === 'weekly' ? selectedDays : undefined,
        day_of_month: intervalType === 'monthly' || intervalType === 'yearly' ? dayOfMonth : undefined,
        month_of_year: intervalType === 'yearly' ? monthOfYear : undefined,
        custom_interval_days: intervalType === 'custom' ? Math.max(1, customDays) : undefined,
        start_date: startDate || todayStr,
        is_active: editingResolution ? editingResolution.is_active : true,
        last_completed_at: editingResolution ? editingResolution.last_completed_at : null,
        created_at: editingResolution ? editingResolution.created_at : now,
        updated_at: now,
      };

      await db.transaction('rw', db.resolutions, db.syncQueue, async () => {
        await db.resolutions.put(newRecord);
        await db.syncQueue.put({
          id: resId,
          table: 'resolutions',
          action: 'upsert',
          timestamp: Date.now(),
        });
      });

      processSyncQueue().catch((err) => console.warn('Sync queue note:', err));

      if (onToast) {
        onToast(
          editingResolution ? 'Resolution updated successfully! ✨' : 'New resolution added! 🎯',
          'success'
        );
      }

      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Error saving resolution:', err);
      setFormError(err.message || 'Failed to save resolution');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Resolution Active/Paused Status
  const handleToggleActive = async (res: Resolution) => {
    try {
      const now = new Date().toISOString();
      const updated = { ...res, is_active: !res.is_active, updated_at: now };
      await db.transaction('rw', db.resolutions, db.syncQueue, async () => {
        await db.resolutions.put(updated);
        await db.syncQueue.put({
          id: res.id,
          table: 'resolutions',
          action: 'upsert',
          timestamp: Date.now(),
        });
      });
      processSyncQueue().catch((e) => console.warn(e));
      if (onToast) {
        onToast(updated.is_active ? `"${res.title}" resumed.` : `"${res.title}" paused.`, 'info');
      }
    } catch (err) {
      console.error('Failed to toggle active status:', err);
    }
  };

  // Delete Resolution
  const handleDelete = async (res: Resolution) => {
    if (!window.confirm(`Are you sure you want to delete resolution "${res.title}"?`)) {
      return;
    }

    try {
      await db.transaction('rw', db.resolutions, db.syncQueue, async () => {
        await db.resolutions.delete(res.id);
        await db.syncQueue.put({
          id: res.id,
          table: 'resolutions',
          action: 'delete',
          timestamp: Date.now(),
        });
      });
      processSyncQueue().catch((e) => console.warn(e));
      if (onToast) {
        onToast(`Resolution "${res.title}" deleted.`, 'info');
      }
    } catch (err) {
      console.error('Failed to delete resolution:', err);
    }
  };

  // Mark Resolution Completed for Today
  const handleMarkComplete = async (res: Resolution) => {
    try {
      const now = new Date().toISOString();
      const isCompleted = res.last_completed_at === todayStr;
      const newCompletionDate = isCompleted ? null : todayStr;

      // 1. Update resolution completion state
      await db.transaction('rw', db.resolutions, db.dailyLogs, db.syncQueue, async () => {
        await db.resolutions.update(res.id, {
          last_completed_at: newCompletionDate,
          updated_at: now,
        });

        await db.syncQueue.put({
          id: res.id,
          table: 'resolutions',
          action: 'upsert',
          timestamp: Date.now(),
        });

        // 2. Synchronize with daily_logs under Resolution category if category exists
        const catId = resolutionCategory?.id;
        if (catId) {
          if (!isCompleted) {
            // Find if there's already a log for today under Resolution category
            const existingLog = await db.dailyLogs
              .where({ log_date: todayStr, category_id: catId })
              .first();

            const noteLine = `Completed resolution: "${res.title}"`;
            if (existingLog) {
              const updatedNotes = existingLog.notes?.includes(res.title)
                ? existingLog.notes
                : existingLog.notes
                ? `${existingLog.notes}\n• ${noteLine}`
                : `• ${noteLine}`;

              await db.dailyLogs.update(existingLog.id, {
                notes: updatedNotes,
                status: 'present',
                updated_at: now,
              });

              await db.syncQueue.put({
                id: existingLog.id,
                table: 'daily_logs',
                action: 'upsert',
                timestamp: Date.now(),
              });
            } else {
              const logId = crypto.randomUUID();
              const newLog: DailyLog = {
                id: logId,
                log_date: todayStr,
                category_id: catId,
                notes: `• ${noteLine}`,
                status: 'present',
                created_at: now,
                updated_at: now,
              };
              await db.dailyLogs.put(newLog);
              await db.syncQueue.put({
                id: logId,
                table: 'daily_logs',
                action: 'upsert',
                timestamp: Date.now(),
              });
            }
          }
        }
      });

      processSyncQueue().catch((e) => console.warn(e));

      if (onToast) {
        onToast(
          isCompleted ? `Unmarked "${res.title}"` : `Completed "${res.title}" for today! 🎉`,
          isCompleted ? 'info' : 'success'
        );
      }
    } catch (err) {
      console.error('Failed to mark complete:', err);
    }
  };

  // Helper to format 24h time to 12h AM/PM
  const formatTimeDisplay = (time24: string) => {
    if (!time24) return '';
    const [h, m] = time24.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hours12 = h % 12 || 12;
    return `${hours12}:${String(m).padStart(2, '0')} ${period}`;
  };

  // Helper for human-readable schedule description
  const getScheduleText = (res: Resolution) => {
    const formattedTime = formatTimeDisplay(res.reminder_time);

    switch (res.interval_type) {
      case 'daily':
        return `Every day at ${formattedTime}`;

      case 'weekly': {
        const days = res.days_of_week && res.days_of_week.length > 0
          ? res.days_of_week.map((d) => DAYS_SHORT[d]).join(', ')
          : 'Weekly';
        return `Weekly on ${days} at ${formattedTime}`;
      }

      case 'monthly': {
        const day = res.day_of_month || 1;
        const suffix = day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th';
        return `Monthly on the ${day}${suffix} at ${formattedTime}`;
      }

      case 'yearly': {
        const month = MONTHS_NAMES[(res.month_of_year || 1) - 1];
        const day = res.day_of_month || 1;
        return `Yearly on ${month} ${day} at ${formattedTime}`;
      }

      case 'custom': {
        const count = res.custom_interval_days || 1;
        return `Every ${count} days at ${formattedTime}`;
      }

      default:
        return `Scheduled at ${formattedTime}`;
    }
  };

  // Filtered lists
  const dueTodayResolutions = useMemo(() => {
    return resolutions.filter((r) => r.is_active && isResolutionDueOnDate(r, todayStr));
  }, [resolutions, todayStr]);

  const completedTodayCount = useMemo(() => {
    return dueTodayResolutions.filter((r) => r.last_completed_at === todayStr).length;
  }, [dueTodayResolutions, todayStr]);

  const filteredResolutions = useMemo(() => {
    return resolutions.filter((r) => {
      if (activeTab === 'all') return true;
      if (activeTab === 'due') return r.is_active && isResolutionDueOnDate(r, todayStr);
      return r.interval_type === activeTab;
    });
  }, [resolutions, activeTab, todayStr]);

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-6 pb-28 md:pb-12 space-y-6">
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 text-white p-6 sm:p-8 shadow-xl">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-48 h-48 bg-emerald-400/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/25 border border-emerald-400/30 text-emerald-200 text-xs font-semibold backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Habits & Commitments</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              <Target className="w-7 h-7 text-emerald-300" />
              <span>Resolutions</span>
            </h1>
            <p className="text-emerald-100/90 text-sm sm:text-base max-w-xl">
              Track your resolutions, daily habits, and recurring milestones with automated push reminders on custom intervals.
            </p>
          </div>

          <button
            type="button"
            id="btn-add-resolution"
            onClick={handleOpenCreate}
            className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-emerald-800 hover:bg-emerald-50 font-bold shadow-md hover:shadow-lg active:scale-95 transition-all cursor-pointer text-sm"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Resolution</span>
          </button>
        </div>

        {/* 2. Today's Progress Bar */}
        {dueTodayResolutions.length > 0 && (
          <div className="mt-6 pt-5 border-t border-emerald-500/30 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
            <div className="sm:col-span-2">
              <div className="flex justify-between text-xs font-medium text-emerald-200 mb-1.5">
                <span>Today's Completion</span>
                <span className="font-bold text-white">
                  {completedTodayCount} of {dueTodayResolutions.length} Done ({Math.round((completedTodayCount / dueTodayResolutions.length) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-emerald-950/50 rounded-full h-2.5 overflow-hidden border border-emerald-500/30">
                <div
                  className="bg-gradient-to-r from-emerald-300 to-teal-200 h-2.5 rounded-full transition-all duration-500 shadow-sm"
                  style={{
                    width: `${Math.round((completedTodayCount / dueTodayResolutions.length) * 100)}%`,
                  }}
                />
              </div>
            </div>

            <div className="flex items-center sm:justify-end gap-2 text-xs text-emerald-200">
              <Flame className="w-4 h-4 text-amber-300 fill-amber-300" />
              <span>Keep your momentum strong today!</span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Filter Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs font-semibold">
        {[
          { id: 'all', label: 'All', count: resolutions.length },
          { id: 'due', label: 'Due Today', count: dueTodayResolutions.length },
          { id: 'daily', label: 'Daily' },
          { id: 'weekly', label: 'Weekly' },
          { id: 'monthly', label: 'Monthly' },
          { id: 'yearly', label: 'Yearly' },
          { id: 'custom', label: 'Custom' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-emerald-600 text-white font-bold shadow-sm'
                : 'bg-white/70 hover:bg-white text-neutral-600 hover:text-neutral-900 border border-slate-200/60'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.id ? 'bg-emerald-700/80 text-white' : 'bg-neutral-100 text-neutral-600'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 4. Resolutions List */}
      {filteredResolutions.length === 0 ? (
        <div className="rounded-3xl bg-white/70 border border-dashed border-slate-300 p-8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Target className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-neutral-800">
              {activeTab === 'all'
                ? 'No resolutions added yet'
                : `No ${activeTab === 'due' ? "resolutions due today" : `${activeTab} resolutions`}`}
            </h3>
            <p className="text-xs sm:text-sm text-neutral-500 max-w-sm mx-auto">
              Set clear commitments with custom intervals (daily, weekly, monthly, yearly) and stay on track with automated reminders.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Your First Resolution</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredResolutions.map((res) => {
            const isDueToday = res.is_active && isResolutionDueOnDate(res, todayStr);
            const isCompletedToday = res.last_completed_at === todayStr;

            return (
              <div
                key={res.id}
                className={`relative rounded-2xl p-5 transition-all duration-200 border flex flex-col justify-between ${
                  !res.is_active
                    ? 'bg-neutral-50/80 border-neutral-200 opacity-60'
                    : isCompletedToday
                    ? 'bg-emerald-50/70 border-emerald-200/80 shadow-xs ring-1 ring-emerald-500/20'
                    : isDueToday
                    ? 'bg-white border-slate-200/90 shadow-sm hover:shadow-md'
                    : 'bg-white/80 border-slate-200/70'
                }`}
              >
                <div>
                  {/* Top Bar: Interval Badge & Status */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100/70 text-emerald-800 text-[11px] font-bold">
                      <Clock className="w-3 h-3 text-emerald-600" />
                      <span className="capitalize">{res.interval_type}</span>
                      <span>•</span>
                      <span>{formatTimeDisplay(res.reminder_time)}</span>
                    </div>

                    <div className="flex items-center gap-1 text-neutral-400">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(res)}
                        title={res.is_active ? 'Pause resolution' : 'Resume resolution'}
                        className="p-1.5 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                      >
                        {res.is_active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 text-emerald-600" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(res)}
                        title="Edit resolution"
                        className="p-1.5 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(res)}
                        title="Delete resolution"
                        className="p-1.5 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div className="space-y-1 mb-4">
                    <h3 className={`text-base font-bold ${isCompletedToday ? 'text-emerald-950' : 'text-neutral-900'}`}>
                      {res.title}
                    </h3>
                    {res.description && (
                      <p className="text-xs text-neutral-600 line-clamp-2 leading-relaxed">
                        {res.description}
                      </p>
                    )}
                    <div className="text-[11px] text-neutral-500 flex items-center gap-1.5 pt-0.5">
                      <Calendar className="w-3 h-3 text-neutral-400" />
                      <span>{getScheduleText(res)}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Area: Check-in button */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                  {isDueToday ? (
                    isCompletedToday ? (
                      <div className="flex items-center justify-between w-full">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-lg">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Done for today!</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleMarkComplete(res)}
                          className="text-[11px] text-neutral-400 hover:text-neutral-700 underline cursor-pointer"
                        >
                          Undo
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleMarkComplete(res)}
                        className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs hover:shadow-md active:scale-98 transition-all cursor-pointer"
                      >
                        <Check className="w-4 h-4 stroke-[2.5]" />
                        <span>Mark Complete Today</span>
                      </button>
                    )
                  ) : (
                    <div className="text-[11px] text-neutral-400 font-medium">
                      {!res.is_active ? 'Paused' : 'Not due today'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Add / Edit Resolution Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200/80 p-6 space-y-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-neutral-900">
                    {editingResolution ? 'Edit Resolution' : 'Add New Resolution'}
                  </h2>
                  <p className="text-xs text-neutral-500">Configure cadence and reminder timings</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveResolution} className="space-y-5 text-sm">
              {/* Title & Quick Suggestions */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-neutral-700">
                  Resolution Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Morning Meditation, Read Vachanamrut..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-neutral-900 text-sm outline-none transition-all"
                />

                {!editingResolution && (
                  <div className="pt-1.5 flex flex-wrap gap-1.5">
                    <span className="text-[10px] text-neutral-400 font-medium py-0.5">Quick picks:</span>
                    {SUGGESTIONS.slice(0, 3).map((sugg) => (
                      <button
                        key={sugg}
                        type="button"
                        onClick={() => setTitle(sugg)}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-neutral-600 transition-colors cursor-pointer"
                      >
                        + {sugg.split(' ')[0]} {sugg.split(' ')[1]}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Description / Intent */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-neutral-700">
                  Description / Notes <span className="text-neutral-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Why is this resolution important? Any guidelines or reflections..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-neutral-900 text-sm outline-none transition-all"
                />
              </div>

              {/* Interval Frequency Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-neutral-700">Recurrence Interval</label>
                <div className="grid grid-cols-5 gap-1 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
                  {(['daily', 'weekly', 'monthly', 'yearly', 'custom'] as ResolutionInterval[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setIntervalType(type)}
                      className={`py-1.5 px-2 rounded-lg capitalize transition-all cursor-pointer text-center text-xs ${
                        intervalType === type
                          ? 'bg-white text-emerald-700 font-bold shadow-xs'
                          : 'text-neutral-600 hover:text-neutral-900'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Settings based on Interval */}
              {intervalType === 'weekly' && (
                <div className="space-y-1.5 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70">
                  <label className="block text-xs font-bold text-neutral-700">Select Days of Week</label>
                  <div className="grid grid-cols-7 gap-1">
                    {DAYS_SHORT.map((day, idx) => {
                      const isSelected = selectedDays.includes(idx);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedDays(selectedDays.filter((d) => d !== idx));
                            } else {
                              setSelectedDays([...selectedDays, idx].sort());
                            }
                          }}
                          className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-white text-neutral-600 border border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {intervalType === 'monthly' && (
                <div className="space-y-1.5 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70">
                  <label className="block text-xs font-bold text-neutral-700">Day of the Month</label>
                  <div className="flex items-center gap-3">
                    <select
                      value={dayOfMonth}
                      onChange={(e) => setDayOfMonth(Number(e.target.value))}
                      className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white font-medium text-sm outline-none"
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>
                          {d}
                          {d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'} of the month
                        </option>
                      ))}
                    </select>
                    <span className="text-xs text-neutral-500">Repeats every month</span>
                  </div>
                </div>
              )}

              {intervalType === 'yearly' && (
                <div className="space-y-1.5 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70">
                  <label className="block text-xs font-bold text-neutral-700">Month & Day of Year</label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={monthOfYear}
                      onChange={(e) => setMonthOfYear(Number(e.target.value))}
                      className="px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-sm outline-none"
                    >
                      {MONTHS_NAMES.map((m, idx) => (
                        <option key={m} value={idx + 1}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <select
                      value={dayOfMonth}
                      onChange={(e) => setDayOfMonth(Number(e.target.value))}
                      className="px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-sm outline-none"
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>
                          Day {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {intervalType === 'custom' && (
                <div className="space-y-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">Repeat Every (Days)</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={customDays}
                        onChange={(e) => setCustomDays(Number(e.target.value))}
                        className="w-24 px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-sm text-center outline-none"
                      />
                      <span className="text-xs text-neutral-600">days</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">Starting From Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Reminder Timing & Presets */}
              <div className="space-y-2 p-3.5 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Reminder Timing</span>
                  </label>
                  <span className="text-xs font-extrabold text-emerald-700">
                    {formatTimeDisplay(reminderTime)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    required
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-sm outline-none"
                  />
                  <div className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none">
                    {PRESET_TIMES.map((time) => (
                      <button
                        key={time}
                        type="button"
                        onClick={() => setReminderTime(time)}
                        className={`text-[11px] px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                          reminderTime === time
                            ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                            : 'bg-white text-neutral-600 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {formatTimeDisplay(time)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-neutral-600 hover:bg-neutral-100 font-medium text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md hover:shadow-lg active:scale-95 transition-all cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : editingResolution ? 'Update Resolution' : 'Save Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
