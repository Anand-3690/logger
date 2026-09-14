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

interface OnThisDayViewProps {
  onBack: () => void;
}

export const OnThisDayView: React.FC<OnThisDayViewProps> = ({ onBack }) => {
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; title?: string } | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [targetDate, setTargetDate] = useState<string>(() => getTodayLocalDate());
  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const todayStr = useMemo(() => getTodayLocalDate(), []);
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
        if (!log.log_date) return false;
        const [logY, logM, logD] = log.log_date.split('-').map(Number);
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
      .sort((a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime());
  }, [targetMonth, targetDay, targetYear, selectedCategoryId, eligibleCategories, eligibleCategoryIds, categories]);

  const handlePrevDay = () => {
    setTargetDate((prev) => addDaysToDate(prev, -1));
  };

  const handleNextDay = () => {
    setTargetDate((prev) => addDaysToDate(prev, 1));
  };

  const handleResetToday = () => {
    setTargetDate(getTodayLocalDate());
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

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header Navigation & Title */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-neutral-200/60">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 bg-white/60 hover:bg-white rounded-xl shadow-xs border border-white/80 transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5 text-neutral-700" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-neutral-900 leading-tight">On This Day</h2>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200/80">
                Memories
              </span>
            </div>
            <p className="text-xs text-neutral-500 font-medium">
              Historical retrospective across your selected memory categories
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isToday && (
            <button
              onClick={handleResetToday}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/80 hover:bg-white text-blue-700 text-xs font-semibold rounded-xl border border-white/80 shadow-xs transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Today</span>
            </button>
          )}

          {/* Manage Categories Button */}
          <button
            id="btn-manage-on-this-day-categories"
            onClick={() => setIsConfigModalOpen(true)}
            title="Choose which categories are included in On This Day"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100/90 text-purple-700 text-xs font-bold rounded-xl border border-purple-200/80 shadow-xs transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Choose Categories</span>
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
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                Today
              </span>
            )}
          </div>
          <span className="text-[11px] text-neutral-400 font-medium block">
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
            No categories enabled for &quot;On This Day&quot;
          </h3>
          <p className="text-xs sm:text-sm text-neutral-500 max-w-sm">
            Choose which categories (such as spiritual routines or diary entries) should be included in retrospective memories and morning notifications.
          </p>
          <button
            onClick={() => setIsConfigModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Select Categories Now</span>
          </button>
        </div>
      ) : historicalLogs === undefined ? (
        <div className="p-12 text-center text-neutral-500 font-medium animate-pulse flex flex-col items-center justify-center">
          <Clock className="w-8 h-8 text-purple-400 mb-3 animate-spin opacity-70" />
          <p className="text-sm font-semibold">Retrieving past memories...</p>
        </div>
      ) : historicalLogs.length === 0 ? (
        <div className="glass-panel rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-white/80 backdrop-blur-md flex items-center justify-center text-purple-500 shadow-xs border border-white/80">
            <Clock className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-neutral-800">
              No memories found for {formatShortDate(targetDate)}
            </h3>
            <p className="text-xs sm:text-sm text-neutral-500 max-w-sm mt-1">
              There are no historical logs for this calendar day among your {eligibleCategories.length} selected &quot;On This Day&quot; categories.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Memories Found ({historicalLogs.length})
            </span>
          </div>

          {historicalLogs.map((log) => {
            const year = log.log_date.split('-')[0];
            const yearsAgo = targetYear - parseInt(year, 10);
            const categoryName = log.category?.name || 'Activity';
            const categoryColor = log.category?.color_code || '#8b5cf6';

            return (
              <div
                key={log.id}
                className="glass-panel rounded-2xl p-5 border-l-4 relative overflow-hidden group hover:shadow-md transition-all"
                style={{ borderLeftColor: categoryColor }}
              >
                {/* Large Background Year Watermark */}
                <div className="absolute top-0 right-0 bg-gradient-to-bl from-purple-100/60 to-transparent text-purple-900/15 font-black text-5xl sm:text-6xl px-4 py-2 rounded-bl-3xl pointer-events-none group-hover:scale-105 transition-transform duration-500">
                  {year}
                </div>

                <div className="relative z-10 space-y-3">
                  {/* Top Metadata Header */}
                  <div className="flex items-center gap-2 flex-wrap pr-16">
                    {/* Category Pill */}
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold text-white shadow-xs"
                      style={{ backgroundColor: categoryColor }}
                    >
                      <CategoryIcon name={log.category?.icon || 'Tag'} className="w-3.5 h-3.5" />
                      <span>{categoryName}</span>
                    </span>

                    {/* Anniversary Delta Badge */}
                    <span className="text-[11px] font-bold text-neutral-600 bg-white/70 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/80 shadow-xs">
                      {yearsAgo === 1 ? '1 year ago' : `${yearsAgo} years ago`}
                    </span>

                    {/* Date String */}
                    <span className="text-xs text-neutral-400 font-medium">
                      {log.log_date}
                    </span>
                  </div>

                  {/* Log Notes with full Gujarati / multiline support */}
                  {log.notes && (
                    <p className="text-sm text-neutral-800 leading-relaxed whitespace-pre-line pr-6">
                      {log.notes}
                    </p>
                  )}

                  {/* Photo Attachment Preview */}
                  <ActivityPhoto
                    log={log as any}
                    categoryName={categoryName}
                    selectedDate={log.log_date}
                    onViewPhoto={(url, title) => setLightboxPhoto({ url, title })}
                  />
                </div>
              </div>
            );
          })}
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
                  <p className="text-xs text-neutral-500 font-medium">
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
                        <div className="text-[11px] text-neutral-400">
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

            <div className="p-4 border-t border-neutral-100 flex justify-end bg-white/40">
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(false)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
              >
                Done
              </button>
            </div>
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