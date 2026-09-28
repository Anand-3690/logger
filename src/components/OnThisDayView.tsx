import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Category, DailyLog, isCategoryOnThisDay } from '../types';
import {
  ArrowLeft,
  Clock,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Sparkles,
  RotateCcw,
  SlidersHorizontal,
  X,
  Check,
  History,
  Bell,
} from 'lucide-react';
import { CategoryIcon } from './CategoryIcon';
import { ActivityPhoto } from './ActivityPhoto';
import { PhotoLightbox } from './PhotoLightbox';
import { resolvePhotoUrl } from '../utils/photoUtils';
import { processSyncQueue } from '../syncEngine';
import {
  getTodayLocalDate,
  formatLongDate,
  formatShortDate,
  addDaysToDate,
} from '../utils/dateUtils';
import { getTodayLogicalDate, getEffectiveLogDate } from '../utils/dayBoundary';
import {
  sendTestOnThisDayNotification,
  getPushNotificationStatus,
  subscribeToWebPush,
} from '../utils/pushNotifications';
import { MemoryCard, YearChips } from './MemoryCard';

interface OnThisDayViewProps {
  onBack: () => void;
  onAddReflection?: (log: DailyLog) => void;
}

export const OnThisDayView: React.FC<OnThisDayViewProps> = ({ onBack, onAddReflection }) => {
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; title?: string } | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [targetDate, setTargetDate] = useState<string>(() => getTodayLogicalDate());
  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const todayStr = useMemo(() => getTodayLogicalDate(), []);
  const isToday = targetDate === todayStr;

  const [targetYear, targetMonth, targetDay] = useMemo(() => {
    return targetDate.split('-').map(Number);
  }, [targetDate]);

  // 1. Fetch all categories from local Dexie database
  const categories = useLiveQuery(() => db.categories.toArray()) || [];

  // 2. Filter ONLY categories that are explicitly enabled for "On This Day" (defaulting to Guruhari Darshan)
  const eligibleCategories = useMemo(() => {
    return categories.filter(isCategoryOnThisDay);
  }, [categories]);

  const eligibleCategoryIds = useMemo(() => {
    return new Set(eligibleCategories.map((c) => c.id));
  }, [eligibleCategories]);

  // If selected category is no longer eligible, fallback to 'all'
  useEffect(() => {
    if (selectedCategoryId !== 'all' && !eligibleCategoryIds.has(selectedCategoryId)) {
      setSelectedCategoryId('all');
    }
  }, [eligibleCategoryIds, selectedCategoryId]);

  // 3. Query matching historical logs strictly within eligible categories
  const historicalLogs = useLiveQuery(async () => {
    if (eligibleCategories.length === 0) return [];

    let logs: DailyLog[];

    if (selectedCategoryId === 'all') {
      const eligibleIds = Array.from(eligibleCategoryIds);
      logs = await db.dailyLogs.where('category_id').anyOf(eligibleIds).toArray();
    } else {
      if (!eligibleCategoryIds.has(selectedCategoryId)) return [];
      logs = await db.dailyLogs.where('category_id').equals(selectedCategoryId).toArray();
    }

    // Filter for matching Month & Day, excluding current year
    return logs
      .filter((log) => {
        const effDate = getEffectiveLogDate(log);
        if (!effDate) return false;
        const [logY, logM, logD] = effDate.split('-').map(Number);
        return logM === targetMonth && logD === targetDay && logY !== targetYear;
      })
      .map((log) => {
        const resolvedPhoto = resolvePhotoUrl(log);
        return {
          ...log,
          photo_url: resolvedPhoto || log.photo_url || null,
          category: categories.find((c) => c.id === log.category_id),
        };
      })
      .sort((a, b) => new Date(getEffectiveLogDate(b)).getTime() - new Date(getEffectiveLogDate(a)).getTime());
  }, [targetMonth, targetDay, targetYear, selectedCategoryId, eligibleCategories, eligibleCategoryIds, categories]);

  const uniqueYears = useMemo(() => {
    if (!historicalLogs || historicalLogs.length === 0) return [];
    const set = new Set<number>();
    for (const log of historicalLogs) {
      const eff = getEffectiveLogDate(log);
      const y = parseInt(eff.split('-')[0], 10);
      if (!isNaN(y)) set.add(y);
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [historicalLogs]);

  const handlePrevDay = () => {
    setTargetDate((prev) => addDaysToDate(prev, -1));
  };

  const handleNextDay = () => {
    setTargetDate((prev) => addDaysToDate(prev, 1));
  };

  const handleResetToday = () => {
    setTargetDate(getTodayLogicalDate());
  };

  const handleToggleCategory = async (cat: Category) => {
    try {
      const isCurrentlyActive = isCategoryOnThisDay(cat);
      const updatedValue = !isCurrentlyActive;

      await db.categories.update(cat.id, { is_on_this_day: updatedValue });
      await db.syncQueue.put({
        id: cat.id,
        table: 'categories',
        action: 'upsert',
        timestamp: Date.now(),
      });
      processSyncQueue().catch((e) => console.warn('Background sync failed:', e));
    } catch (err) {
      console.error('Failed to toggle category on-this-day status:', err);
    }
  };

  // 4. Query matching historical logs on this calendar day across other (unselected) categories
  const otherCategoryLogs = useLiveQuery(async () => {
    const nonEligible = categories.filter((c) => !isCategoryOnThisDay(c));
    if (nonEligible.length === 0) return [];

    const nonEligibleIds = nonEligible.map((c) => c.id);
    const logs = await db.dailyLogs.where('category_id').anyOf(nonEligibleIds).toArray();

    return logs.filter((log) => {
      const effDate = getEffectiveLogDate(log);
      if (!effDate) return false;
      const [logY, logM, logD] = effDate.split('-').map(Number);
      return logM === targetMonth && logD === targetDay && logY !== targetYear;
    });
  }, [targetMonth, targetDay, targetYear, categories]);

  const otherCategoryNames = useMemo(() => {
    if (!otherCategoryLogs || otherCategoryLogs.length === 0) return [];
    const catMap = new Map(categories.map((c) => [c.id, c.name]));
    const names = new Set(otherCategoryLogs.map((l) => catMap.get(l.category_id)).filter(Boolean));
    return Array.from(names) as string[];
  }, [otherCategoryLogs, categories]);

  const [pushPermission, setPushPermission] = useState<string>('default');
  const [testNotificationFeedback, setTestNotificationFeedback] = useState<string | null>(null);
  const [isSendingTestNotification, setIsSendingTestNotification] = useState<boolean>(false);

  useEffect(() => {
    getPushNotificationStatus()
      .then((s) => setPushPermission(s.permission))
      .catch(() => {});
  }, []);

  const handleSelectAllCategories = async () => {
    try {
      await db.transaction('rw', db.categories, db.syncQueue, async () => {
        for (const cat of categories) {
          await db.categories.update(cat.id, { is_on_this_day: true });
          await db.syncQueue.put({
            id: cat.id,
            table: 'categories',
            action: 'upsert',
            timestamp: Date.now(),
          });
        }
      });
      processSyncQueue().catch((e) => console.warn('Background sync failed:', e));
    } catch (err) {
      console.error('Failed to select all categories:', err);
    }
  };

  const handleResetToDefaultCategories = async () => {
    try {
      await db.transaction('rw', db.categories, db.syncQueue, async () => {
        for (const cat of categories) {
          const isGuruhari = cat.name === 'Guruhari Darshan';
          await db.categories.update(cat.id, { is_on_this_day: isGuruhari });
          await db.syncQueue.put({
            id: cat.id,
            table: 'categories',
            action: 'upsert',
            timestamp: Date.now(),
          });
        }
      });
      processSyncQueue().catch((e) => console.warn('Background sync failed:', e));
    } catch (err) {
      console.error('Failed to reset categories:', err);
    }
  };

  const handleIncludeOtherCategories = async () => {
    if (!otherCategoryLogs || otherCategoryLogs.length === 0) return;
    const catIdsToEnable = Array.from(new Set(otherCategoryLogs.map((l) => l.category_id)));
    try {
      await db.transaction('rw', db.categories, db.syncQueue, async () => {
        for (const id of catIdsToEnable) {
          await db.categories.update(id, { is_on_this_day: true });
          await db.syncQueue.put({
            id,
            table: 'categories',
            action: 'upsert',
            timestamp: Date.now(),
          });
        }
      });
      processSyncQueue().catch((e) => console.warn('Background sync failed:', e));
    } catch (err) {
      console.error('Failed to include other categories:', err);
    }
  };

  const handleTriggerTestNotification = async () => {
    try {
      setIsSendingTestNotification(true);
      setTestNotificationFeedback(null);
      if (pushPermission !== 'granted') {
        await subscribeToWebPush();
        setPushPermission('granted');
      }
      const res = await sendTestOnThisDayNotification();
      setTestNotificationFeedback(res.message || 'Notification triggered! Check your device.');
    } catch (err: any) {
      setTestNotificationFeedback(err?.message || 'Failed to trigger notification. Check permissions.');
    } finally {
      setIsSendingTestNotification(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header Navigation & Title */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-neutral-200/60">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 bg-white/60 hover:bg-white rounded-xl shadow-xs border border-white/80 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Back to Dashboard"
            aria-label="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5 text-neutral-700" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-neutral-900 leading-tight">On this day</h2>
              <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-300">
                Memories
              </span>
            </div>
            <p className="text-xs text-slate-600 font-medium">
              Historical retrospective across your selected memory categories
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isToday && (
            <button
              onClick={handleResetToday}
              className="flex min-h-[44px] items-center gap-1.5 px-3 py-2 bg-white/80 hover:bg-white text-blue-700 text-xs font-semibold rounded-xl border border-white/80 shadow-2xs transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Today</span>
            </button>
          )}

          {/* Manage Categories Button - sits in the page header row */}
          <button
            id="btn-manage-on-this-day-categories"
            onClick={() => setIsConfigModalOpen(true)}
            title="Choose which categories are included in On this day"
            className="flex min-h-[44px] items-center gap-1.5 px-3 py-2 bg-purple-50 hover:bg-purple-100/90 text-purple-700 text-xs font-semibold rounded-xl border border-purple-200/80 shadow-2xs transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Choose categories</span>
          </button>
        </div>
      </div>

      {/* Interactive Date Navigation Bar */}
      <div className="glass-panel rounded-2xl p-3 flex items-center justify-between gap-3 shadow-xs">
        <button
          onClick={handlePrevDay}
          className="p-2 text-neutral-600 hover:text-neutral-900 hover:bg-white/80 rounded-xl transition-colors border border-transparent hover:border-neutral-200/60"
          title="Previous Day"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="text-center relative">
          <div
            onClick={() => dateInputRef.current?.showPicker?.()}
            className="cursor-pointer group flex items-center justify-center gap-2"
          >
            <CalendarIcon className="w-4 h-4 text-purple-600 group-hover:scale-110 transition-transform" />
            <span className="text-sm sm:text-base font-bold text-neutral-900 leading-tight">
              {formatLongDate(targetDate)}
            </span>
            {isToday && (
              <span className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300">
                Today
              </span>
            )}
          </div>
          <span className="text-xs text-slate-600 font-medium block">
            Tap date to jump to another calendar day
          </span>

          <input
            ref={dateInputRef}
            type="date"
            value={targetDate}
            onChange={(e) => {
              if (e.target.value) setTargetDate(e.target.value);
            }}
            className="absolute inset-0 opacity-0 pointer-events-none"
          />
        </div>

        <button
          onClick={handleNextDay}
          className="p-2 text-neutral-600 hover:text-neutral-900 hover:bg-white/80 rounded-xl transition-colors border border-transparent hover:border-neutral-200/60"
          title="Next Day"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Category Filter Pills (Only Eligible Categories Shown) */}
      {eligibleCategories.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => setSelectedCategoryId('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              selectedCategoryId === 'all'
                ? 'bg-purple-600 text-white shadow-xs shadow-purple-500/20'
                : 'bg-white/60 hover:bg-white text-neutral-600 border border-white/80'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>All Selected ({eligibleCategories.length})</span>
          </button>

          {eligibleCategories.map((cat) => {
            const isSelected = selectedCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-neutral-900 text-white shadow-xs'
                    : 'bg-white/60 hover:bg-white text-neutral-700 border border-white/80'
                }`}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: cat.color_code || '#3b82f6' }}
                />
                <CategoryIcon name={cat.icon || 'Tag'} className="w-3.5 h-3.5" />
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Historical Feed */}
      {eligibleCategories.length === 0 ? (
        <div className="glass-panel rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shadow-xs border border-purple-200 mb-1">
            <History className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-neutral-800">
            No categories enabled for On this day
          </h3>
          <p className="text-xs sm:text-sm text-neutral-500 max-w-sm">
            Choose which categories (such as spiritual routines or diary entries) should be included in retrospective memories and morning notifications.
          </p>
          <button
            type="button"
            onClick={() => setIsConfigModalOpen(true)}
            className="flex min-h-[44px] items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Choose categories</span>
          </button>
        </div>
      ) : historicalLogs === undefined ? (
        <div className="p-12 text-center text-neutral-500 font-medium animate-pulse flex flex-col items-center justify-center">
          <Clock className="w-8 h-8 text-purple-400 mb-3 animate-spin opacity-70" />
          <p className="text-sm font-semibold">Retrieving past memories...</p>
        </div>
      ) : historicalLogs.length === 0 ? (
        <div className="glass-panel rounded-3xl p-8 sm:p-10 text-center flex flex-col items-center justify-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-white/80 backdrop-blur-md flex items-center justify-center text-purple-500 shadow-xs border border-white/80">
            <Clock className="w-7 h-7" />
          </div>
          <div className="max-w-md">
            <h3 className="text-base font-bold text-neutral-800">
              No memories found for {formatShortDate(targetDate)}
            </h3>
            <p className="text-xs sm:text-sm text-neutral-500 mt-1">
              There are no historical logs for this calendar day among your {eligibleCategories.length} selected &quot;On This Day&quot; categories.
            </p>
          </div>

          {otherCategoryLogs && otherCategoryLogs.length > 0 ? (
            <div className="w-full max-w-md p-4 rounded-2xl bg-purple-50/80 border border-purple-200/80 text-left space-y-3 mt-2">
              <div className="flex items-center gap-2 text-purple-900 font-semibold text-xs sm:text-sm">
                <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                <span>
                  Found {otherCategoryLogs.length} {otherCategoryLogs.length === 1 ? 'memory' : 'memories'} on this calendar day in other categories:
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {otherCategoryNames.map((name) => (
                  <span
                    key={name}
                    className="px-2.5 py-1 rounded-lg bg-white text-purple-800 text-xs font-semibold shadow-2xs border border-purple-200/60"
                  >
                    {name}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleIncludeOtherCategories}
                  className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Include in On this day</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfigModalOpen(true)}
                  className="px-3.5 py-2 bg-white hover:bg-purple-100/50 text-purple-700 text-xs font-semibold rounded-xl border border-purple-200 transition-all cursor-pointer"
                >
                  Choose categories
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(true)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Choose categories</span>
              </button>
              {eligibleCategories.length < categories.length && (
                <button
                  type="button"
                  onClick={handleSelectAllCategories}
                  className="px-4 py-2 bg-white hover:bg-neutral-50 text-neutral-700 text-xs font-semibold rounded-xl border border-neutral-200/80 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>Include all ({categories.length}) categories</span>
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1 flex-wrap gap-2">
            <span className="text-xs font-semibold text-slate-700">
              {historicalLogs.length === 1 ? '1 memory found' : `${historicalLogs.length} memories found`}
            </span>
          </div>

          {/* Sticky Year Chips Navigation */}
          <YearChips years={uniqueYears} />

          <div className="space-y-4">
            {historicalLogs.map((log, index) => {
              const effDate = getEffectiveLogDate(log);
              const year = parseInt(effDate.split('-')[0], 10);
              const isFirstOfYear =
                index === 0 ||
                parseInt(getEffectiveLogDate(historicalLogs[index - 1]).split('-')[0], 10) !== year;

              return (
                <MemoryCard
                  key={log.id}
                  log={log}
                  onAddReflection={(selectedLog) => {
                    if (onAddReflection) {
                      onAddReflection(selectedLog);
                    }
                  }}
                  onViewPhoto={(url, title) => setLightboxPhoto({ url, title })}
                  isFirstOfYear={isFirstOfYear}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Choose On This Day Categories Modal */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="glass-modal rounded-3xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 border-b border-white/60 flex items-center justify-between bg-white/40 backdrop-blur-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-xs">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 leading-tight">
                    On This Day Categories
                  </h3>
                  <p className="text-xs text-slate-600 font-medium">
                    Only checked categories will appear in memories & alerts
                  </p>
                </div>
              </div>
              <button
                id="btn-close-on-this-day-categories"
                onClick={() => setIsConfigModalOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-white/60 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions Bar */}
            <div className="px-5 py-2.5 bg-neutral-50/80 border-b border-neutral-200/60 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllCategories}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-purple-50 text-purple-700 text-xs font-semibold border border-purple-200 shadow-2xs transition-colors cursor-pointer"
                >
                  Select All ({categories.length})
                </button>
                <button
                  type="button"
                  onClick={handleResetToDefaultCategories}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-neutral-100 text-neutral-700 text-xs font-semibold border border-neutral-200 shadow-2xs transition-colors cursor-pointer"
                >
                  Guruhari Darshan Only
                </button>
              </div>
              <span className="text-xs text-neutral-600 font-medium">
                {eligibleCategories.length} of {categories.length} active
              </span>
            </div>

            <div className="overflow-y-auto p-5 space-y-2.5 flex-1 no-scrollbar">
              {categories.map((cat) => {
                const isSelected = isCategoryOnThisDay(cat);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    id={`btn-toggle-otd-${cat.id}`}
                    onClick={() => handleToggleCategory(cat)}
                    className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-purple-50/80 border-purple-200/80 shadow-xs'
                        : 'bg-white hover:bg-neutral-50 border-neutral-200/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                        style={{ backgroundColor: cat.color_code || '#8b5cf6' }}
                      >
                        <CategoryIcon name={cat.icon || 'Tag'} className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-neutral-900">
                          {cat.name}
                        </div>
                        <div className="text-xs text-slate-600">
                          {isSelected ? 'Included in On This Day' : 'Excluded from On This Day'}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-purple-600 text-white'
                          : 'border-2 border-neutral-300 bg-white'
                      }`}
                    >
                      {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="p-4 border-t border-neutral-100 flex items-center justify-between gap-3 bg-white/40 flex-wrap">
              <button
                type="button"
                onClick={handleTriggerTestNotification}
                disabled={isSendingTestNotification}
                className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold rounded-xl border border-purple-200/60 transition-colors cursor-pointer"
                title="Send test memory alert to this device"
              >
                <Bell className="w-3.5 h-3.5 text-purple-600" />
                <span>{isSendingTestNotification ? 'Sending...' : 'Test Memory Alert'}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(false)}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer ml-auto"
              >
                Done
              </button>
            </div>
            {testNotificationFeedback && (
              <div className="px-5 py-2 text-xs font-medium text-purple-800 bg-purple-50/90 border-t border-purple-200/50">
                {testNotificationFeedback}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      <PhotoLightbox
        url={lightboxPhoto?.url || null}
        title={lightboxPhoto?.title}
        onClose={() => setLightboxPhoto(null)}
      />
    </div>
  );
};