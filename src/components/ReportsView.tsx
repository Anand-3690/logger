import React, { useState, useMemo } from 'react';
import { DailyLog, Category } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { ActivityPhoto } from './ActivityPhoto';
import { PhotoLightbox } from './PhotoLightbox';
import { resolvePhotoUrl } from '../utils/photoUtils';
import { getEffectiveLogDate } from '../utils/dayBoundary';
import {
  Download,
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Activity,
  Award,
  Image as ImageIcon,
  Loader2,
  FileText,
  CheckCircle2,
  Eye,
  Flame,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { PdfExportResult } from '../utils/downloadPdf';
import { PdfPreviewModal } from './PdfPreviewModal';

interface ReportsViewProps {
  logs: DailyLog[];
  categories: Category[];
  selectedMonth: string; // YYYY-MM
  onMonthChange: (month: string) => void;
  isLoading: boolean;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  logs,
  categories,
  selectedMonth,
  onMonthChange,
  isLoading,
}) => {
  const [isExportingPDF, setIsExportingPDF] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<boolean>(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; title?: string } | null>(null);

  // Month navigation helpers
  const monthDate = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    return new Date(year, month - 1, 1);
  }, [selectedMonth]);

  const monthName = useMemo(() => {
    return monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [monthDate]);

  const handlePrevMonth = () => {
    const prev = new Date(monthDate);
    prev.setMonth(prev.getMonth() - 1);
    const y = prev.getFullYear();
    const m = String(prev.getMonth() + 1).padStart(2, '0');
    onMonthChange(`${y}-${m}`);
  };

  const handleNextMonth = () => {
    const next = new Date(monthDate);
    next.setMonth(next.getMonth() + 1);
    const y = next.getFullYear();
    const m = String(next.getMonth() + 1).padStart(2, '0');
    onMonthChange(`${y}-${m}`);
  };

  const handleCurrentMonth = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    onMonthChange(`${y}-${m}`);
  };

  // Compute stats for current selected month
  const stats = useMemo(() => {
    // Only count "present" logs (or undefined/legacy logs) for positive stats
    const filteredLogs = logs.filter(
      (log) => getEffectiveLogDate(log).startsWith(selectedMonth) && log.status !== 'absent'
    );
    const totalLogs = filteredLogs.length;

    // Unique active days
    const activeDaysSet = new Set(filteredLogs.map((l) => getEffectiveLogDate(l)));
    const activeDaysCount = activeDaysSet.size;

    // Photos count
    const photoCount = filteredLogs.filter((l) => Boolean(resolvePhotoUrl(l))).length;

    // Days in selected month
    const [y, m] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();

    // Category breakdown
    const categoryCountMap: Record<string, { category: Category; count: number; dates: string[] }> = {};

    categories.forEach((cat) => {
      categoryCountMap[cat.id] = { category: cat, count: 0, dates: [] };
    });

    filteredLogs.forEach((log) => {
      const effDate = getEffectiveLogDate(log);
      const catId = log.category_id;
      if (categoryCountMap[catId]) {
        categoryCountMap[catId].count += 1;
        categoryCountMap[catId].dates.push(effDate);
      } else if (log.category) {
        categoryCountMap[catId] = {
          category: log.category,
          count: 1,
          dates: [effDate],
        };
      }
    });

    const categoryBreakdown = Object.values(categoryCountMap)
      .map((item) => ({
        category: item.category,
        count: item.count,
        percentage: totalLogs > 0 ? Math.round((item.count / totalLogs) * 100) : 0,
        dates: item.dates,
      }))
      .sort((a, b) => b.count - a.count);

    const topCategory = categoryBreakdown.length > 0 && categoryBreakdown[0].count > 0 ? categoryBreakdown[0].category : null;

    // Daily distribution map
    const dailyCounts: Record<number, number> = {};
    for (let day = 1; day <= daysInMonth; day++) {
      dailyCounts[day] = 0;
    }
    filteredLogs.forEach((log) => {
      const effDate = getEffectiveLogDate(log);
      const dayNum = parseInt(effDate.split('-')[2], 10);
      if (dailyCounts[dayNum] !== undefined) {
        dailyCounts[dayNum] += 1;
      }
    });

    // Calculate longest consecutive streak of active days in this month
    let currentStreak = 0;
    let longestStreak = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      if (dailyCounts[day] > 0) {
        currentStreak++;
        if (currentStreak > longestStreak) {
          longestStreak = currentStreak;
        }
      } else {
        currentStreak = 0;
      }
    }

    const consistencyRate = Math.round((activeDaysCount / (daysInMonth || 1)) * 100);

    // Calculate "vs last month" consistency difference
    let consistencyDelta: number | null = null;
    const prevDate = new Date(y, m - 2, 1);
    const prevY = prevDate.getFullYear();
    const prevM = String(prevDate.getMonth() + 1).padStart(2, '0');
    const prevMonthKey = `${prevY}-${prevM}`;

    const prevMonthLogs = logs.filter(
      (l) => getEffectiveLogDate(l).startsWith(prevMonthKey) && l.status !== 'absent'
    );

    if (prevMonthLogs.length > 0) {
      const prevActiveDays = new Set(prevMonthLogs.map((l) => getEffectiveLogDate(l))).size;
      const prevDaysInMonth = new Date(prevY, prevDate.getMonth() + 1, 0).getDate();
      const prevConsistency = Math.round((prevActiveDays / (prevDaysInMonth || 1)) * 100);
      consistencyDelta = consistencyRate - prevConsistency;
    }

    const maxCategoryCount = Math.max(...categoryBreakdown.map((item) => item.count), 1);

    return {
      totalLogs,
      activeDaysCount,
      daysInMonth,
      consistencyRate,
      consistencyDelta,
      longestStreak,
      photoCount,
      topCategory,
      categoryBreakdown,
      maxCategoryCount,
      dailyCounts,
      filteredLogs,
    };
  }, [logs, categories, selectedMonth]);

  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | null>(null);
  const [showAllCategories, setShowAllCategories] = useState<boolean>(false);

  const displayedLogs = useMemo(() => {
    return stats.filteredLogs.filter((log) => {
      if (selectedCategoryFilter && log.category_id !== selectedCategoryFilter) {
        return false;
      }
      if (selectedDayFilter !== null) {
        const effDate = getEffectiveLogDate(log);
        const dayNum = parseInt(effDate.split('-')[2], 10);
        if (dayNum !== selectedDayFilter) {
          return false;
        }
      }
      return true;
    });
  }, [stats.filteredLogs, selectedCategoryFilter, selectedDayFilter]);

  const [exportError, setExportError] = useState<string | null>(null);
  const [pdfResult, setPdfResult] = useState<PdfExportResult | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);

  const handleDownloadPDF = async () => {
    try {
      setIsExportingPDF(true);
      setExportError(null);
      const filename = `activity_report_${selectedMonth}.pdf`;

      const fallbackData = {
        monthName,
        totalLogs: stats.totalLogs,
        activeDaysCount: stats.activeDaysCount,
        daysInMonth: stats.daysInMonth,
        photoCount: stats.photoCount,
        longestStreak: stats.longestStreak,
        consistencyDelta: stats.consistencyDelta,
        topCategoryName: stats.topCategory?.name || 'None',
        categories: stats.categoryBreakdown.map((item) => ({
          name: item.category.name,
          count: item.count,
          percentage: item.percentage,
        })),
        logs: stats.filteredLogs.map((log) => ({
          date: getEffectiveLogDate(log),
          categoryName: log.category?.name || 'Activity',
          notes: log.notes,
        })),
      };

      const { exportReportToPDF } = await import('../utils/pdfExport');
      const result = await exportReportToPDF('printable-monthly-report', filename, fallbackData);
      setPdfResult(result);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 5000);
    } catch (err: any) {
      console.error('PDF export failed:', err);
      setExportError(err?.message || 'Could not generate PDF.');
      setTimeout(() => setExportError(null), 5000);
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <div className="space-y-5 pb-24">
      {/* Month Navigation & PDF Export Controls */}
      <div className="glass-panel rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        {/* Month Selector & Jump */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="btn-report-prev-month"
            onClick={handlePrevMonth}
            title="Previous Month"
            className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-white/60 rounded-lg transition-colors border border-transparent hover:border-white/80"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Month & Year Select Dropdowns */}
          <div className="flex items-center gap-1.5 bg-white/70 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/80 shadow-2xs">
            <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
            <select
              id="select-report-month"
              value={monthDate.getMonth()}
              onChange={(e) => {
                const newM = String(Number(e.target.value) + 1).padStart(2, '0');
                const curY = selectedMonth.split('-')[0];
                onMonthChange(`${curY}-${newM}`);
              }}
              className="text-xs sm:text-sm font-bold text-neutral-900 bg-transparent border-none outline-none cursor-pointer pr-1"
            >
              {[
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
              ].map((mName, idx) => (
                <option key={mName} value={idx}>
                  {mName}
                </option>
              ))}
            </select>

            <select
              id="select-report-year"
              value={selectedMonth.split('-')[0]}
              onChange={(e) => {
                const newY = e.target.value;
                const curM = selectedMonth.split('-')[1];
                onMonthChange(`${newY}-${curM}`);
              }}
              className="text-xs sm:text-sm font-bold text-neutral-900 bg-transparent border-none outline-none cursor-pointer"
            >
              {Array.from({ length: 12 }, (_, i) => new Date().getFullYear() - 8 + i).map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          <button
            id="btn-report-next-month"
            onClick={handleNextMonth}
            title="Next Month"
            className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-white/60 rounded-lg transition-colors border border-transparent hover:border-white/80"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            id="btn-report-current-month"
            onClick={handleCurrentMonth}
            className="text-xs font-semibold text-blue-700 hover:bg-blue-500/20 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-lg transition-colors"
          >
            Current Month
          </button>
        </div>

        {/* Download & Preview Monthly PDF Buttons */}
        <div className="flex items-center gap-2">
          {pdfResult && (
            <button
              id="btn-preview-monthly-pdf"
              onClick={() => setIsPreviewOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs sm:text-sm font-semibold rounded-xl border border-blue-200 transition-colors shadow-2xs"
            >
              <Eye className="w-4 h-4" />
              <span>Preview PDF</span>
            </button>
          )}

          <button
            id="btn-download-monthly-pdf"
            onClick={handleDownloadPDF}
            disabled={isExportingPDF || isLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-neutral-900/90 hover:bg-neutral-900 backdrop-blur-md active:scale-97 disabled:opacity-60 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-sm shadow-neutral-900/20 border border-neutral-700/50"
          >
            {isExportingPDF ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating PDF...</span>
              </>
            ) : exportSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>PDF Saved to PC!</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download Monthly PDF</span>
              </>
            )}
          </button>
        </div>
      </div>

      {exportError && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-700 font-medium flex items-center gap-2">
          <span className="font-bold">Notice:</span> {exportError}
        </div>
      )}

      {/* ============================================================ */}
      {/* PRINTABLE REPORT CONTAINER (Captured by html2canvas / jsPDF) */}
      {/* ============================================================ */}
      <div
        id="printable-monthly-report"
        className="glass-modal rounded-3xl p-5 sm:p-8 space-y-6"
      >
        {/* Document Header for Export */}
        <div className="border-b border-neutral-200/80 pb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2">
              <FileText className="w-3.5 h-3.5" />
              Monthly Activity Report
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
              {monthName} Summary
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500 font-medium mt-0.5">
              Daily habit adherence, category aggregates, and log history.
            </p>
          </div>

          <div className="text-right text-xs text-neutral-400 font-mono">
            Generated on {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
          </div>
        </div>

        {/* 4-5 Summary Stat Cards */}
        <div
          className={`grid gap-3 sm:gap-4 ${
            stats.photoCount > 0
              ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
              : 'grid-cols-2 sm:grid-cols-4'
          }`}
        >
          {/* 1. Total Logs */}
          <div className="glass-panel-subtle rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-500 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Logs</span>
              <Activity className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-neutral-900">
              {stats.totalLogs}
            </div>
            <span className="text-[11px] text-neutral-500 font-medium">
              activities recorded
            </span>
          </div>

          {/* 2. Active Days + vs last month */}
          <div className="glass-panel-subtle rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-500 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Active Days</span>
              <Calendar className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-neutral-900">
              {stats.activeDaysCount} <span className="text-sm font-normal text-neutral-400">/ {stats.daysInMonth}</span>
            </div>
            <div className="text-[11px] text-neutral-500 font-medium flex items-center flex-wrap gap-1">
              <span>{stats.consistencyRate}% consistency</span>
              {stats.consistencyDelta !== null && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    stats.consistencyDelta > 0
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : stats.consistencyDelta < 0
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-neutral-100 text-neutral-600'
                  }`}
                  title={`${stats.consistencyRate}% vs previous month`}
                >
                  {stats.consistencyDelta > 0
                    ? `↑ +${stats.consistencyDelta} pts`
                    : stats.consistencyDelta < 0
                    ? `↓ ${stats.consistencyDelta} pts`
                    : 'even'}
                </span>
              )}
            </div>
          </div>

          {/* 3. Top Focus */}
          <div className="glass-panel-subtle rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-500 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Top Focus</span>
              <Award className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-base sm:text-lg font-bold text-neutral-900 truncate">
              {stats.topCategory ? stats.topCategory.name : 'None'}
            </div>
            <span className="text-[11px] text-neutral-500 font-medium">
              most frequent activity
            </span>
          </div>

          {/* 4. Longest Streak */}
          <div className="glass-panel-subtle rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-500 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Longest Streak</span>
              <Flame className="w-4 h-4 text-orange-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-neutral-900">
              {stats.longestStreak} <span className="text-sm font-normal text-neutral-400">{stats.longestStreak === 1 ? 'day' : 'days'}</span>
            </div>
            <span className="text-[11px] text-neutral-500 font-medium">
              consecutive active days
            </span>
          </div>

          {/* 5. Photos Logged (Only if photoCount > 0) */}
          {stats.photoCount > 0 && (
            <div className="glass-panel-subtle rounded-2xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-neutral-500 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider">Photos Logged</span>
                <ImageIcon className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-neutral-900">
                {stats.photoCount}
              </div>
              <span className="text-[11px] text-neutral-500 font-medium">
                visual memories
              </span>
            </div>
          )}
        </div>

        {/* Category Breakdown & Visual Bar Chart */}
        <div className="glass-panel-subtle rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              Category Aggregate Breakdown
            </h3>
            <div className="flex items-center gap-2">
              {selectedCategoryFilter && (
                <button
                  type="button"
                  onClick={() => setSelectedCategoryFilter(null)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  Clear filter
                </button>
              )}
              <span className="text-xs font-medium text-neutral-500">
                {stats.totalLogs} total entries
              </span>
            </div>
          </div>

          {/* Bar Chart Representation with Relative Widths & Tappable Filter */}
          <div className="space-y-2 pt-1">
            {(showAllCategories
              ? stats.categoryBreakdown
              : stats.categoryBreakdown.filter((c) => c.count > 0)
            ).map((item) => {
              const cat = item.category;
              const isSelected = selectedCategoryFilter === cat.id;
              // Scale relative to top category (100% width = top category)
              const relativeWidth =
                stats.maxCategoryCount > 0
                  ? (item.count / stats.maxCategoryCount) * 100
                  : 0;

              return (
                <div
                  key={cat.id}
                  onClick={() =>
                    setSelectedCategoryFilter((prev) => (prev === cat.id ? null : cat.id))
                  }
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedCategoryFilter((prev) => (prev === cat.id ? null : cat.id));
                    }
                  }}
                  title={
                    isSelected
                      ? 'Click to show all categories'
                      : `Click to filter logs by ${cat.name}`
                  }
                  className={`p-2.5 rounded-xl transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-blue-50/90 border-blue-300 ring-2 ring-blue-500/20 shadow-2xs'
                      : 'border-transparent hover:bg-neutral-100/70 hover:border-neutral-200/80'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-5 h-5 rounded-md flex items-center justify-center text-white shrink-0 shadow-2xs"
                          style={{ backgroundColor: cat.color_code }}
                        >
                          <CategoryIcon name={cat.icon} className="w-3 h-3 text-white" />
                        </div>
                        <span className="font-bold text-neutral-800">{cat.name}</span>
                        {isSelected && (
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-100/80 px-1.5 py-0.2 rounded-md">
                            Active filter
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="font-semibold text-neutral-900">
                          {item.count} {item.count === 1 ? 'log' : 'logs'}
                        </span>
                        <span className="text-xs text-neutral-400">({item.percentage}%)</span>
                      </div>
                    </div>

                    {/* Visual progress bar scaled relative to top category */}
                    <div className="w-full h-3 bg-neutral-200/80 rounded-full overflow-hidden flex">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${item.count > 0 ? Math.max(relativeWidth, 5) : 0}%`,
                          backgroundColor: cat.color_code,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Zero-count categories toggle */}
            {stats.categoryBreakdown.some((c) => c.count === 0) && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowAllCategories(!showAllCategories)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-800 transition-colors cursor-pointer"
                >
                  {showAllCategories ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5" />
                      <span>Hide {stats.categoryBreakdown.filter((c) => c.count === 0).length} inactive categories</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" />
                      <span>Show {stats.categoryBreakdown.filter((c) => c.count === 0).length} inactive categories</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Month Heatmap Calendar replacing Daily Rhythm */}
        <div className="bg-neutral-50/70 rounded-2xl p-4 sm:p-5 border border-neutral-200/80 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                Monthly Activity Heatmap ({monthName})
              </h3>
              <p className="text-[11px] text-neutral-500 font-medium mt-0.5">
                {stats.activeDaysCount} of {stats.daysInMonth} days logged ({stats.consistencyRate}% active)
              </p>
            </div>
            {selectedDayFilter !== null && (
              <button
                type="button"
                onClick={() => setSelectedDayFilter(null)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3 h-3" />
                Clear day filter
              </button>
            )}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2 pt-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, idx) => (
              <div key={idx} className="text-center text-[10px] font-bold text-neutral-400 uppercase py-0.5">
                {d}
              </div>
            ))}

            {/* Empty slots for first day offset */}
            {Array.from({ length: monthDate.getDay() }).map((_, i) => (
              <div key={`empty-${i}`} className="h-10 rounded-xl opacity-30 bg-neutral-200/40" />
            ))}

            {/* Days of month with activity level shading */}
            {Array.from({ length: stats.daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const count = stats.dailyCounts[dayNum] || 0;
              const isSelectedDay = selectedDayFilter === dayNum;

              let heatClass = 'bg-white border-neutral-200/70 text-neutral-500 hover:border-neutral-300';
              if (count === 1) {
                heatClass = 'bg-emerald-100 border-emerald-300 text-emerald-900 font-bold hover:bg-emerald-200';
              } else if (count >= 2 && count <= 3) {
                heatClass = 'bg-emerald-300 border-emerald-400 text-emerald-950 font-bold hover:bg-emerald-400';
              } else if (count >= 4) {
                heatClass = 'bg-emerald-600 border-emerald-700 text-white font-black shadow-xs hover:bg-emerald-700';
              }

              const formattedDayTitle = `${monthName.split(' ')[0]} ${dayNum}: ${count} ${
                count === 1 ? 'activity' : 'activities'
              }`;

              return (
                <button
                  key={dayNum}
                  type="button"
                  onClick={() => setSelectedDayFilter((prev) => (prev === dayNum ? null : dayNum))}
                  title={formattedDayTitle}
                  className={`h-10 rounded-xl border flex flex-col items-center justify-center text-xs transition-all relative cursor-pointer ${heatClass} ${
                    isSelectedDay ? 'ring-2 ring-blue-600 ring-offset-1 scale-105 z-10 shadow-sm' : ''
                  }`}
                >
                  <span className="leading-tight">{dayNum}</span>
                  {count > 0 && (
                    <span className="text-[9px] leading-none opacity-90 mt-0.5">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Heatmap Legend */}
          <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-2 border-t border-neutral-200/60">
            <span className="font-medium">Activity levels:</span>
            <div className="flex items-center gap-1.5 font-medium">
              <span>Less</span>
              <span className="w-3.5 h-3.5 rounded-sm bg-white border border-neutral-200 inline-block" title="0 logs" />
              <span className="w-3.5 h-3.5 rounded-sm bg-emerald-100 border border-emerald-300 inline-block" title="1 log" />
              <span className="w-3.5 h-3.5 rounded-sm bg-emerald-300 border border-emerald-400 inline-block" title="2-3 logs" />
              <span className="w-3.5 h-3.5 rounded-sm bg-emerald-600 border border-emerald-700 inline-block" title="4+ logs" />
              <span>More</span>
            </div>
          </div>
        </div>

        {/* Itemized Activity Log List for this Month */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-600">
              Itemized Activity Entries ({displayedLogs.length} of {stats.filteredLogs.length})
            </h3>
            {(selectedCategoryFilter || selectedDayFilter !== null) && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-blue-700 font-medium flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                  <Filter className="w-3 h-3" />
                  Filtered by{' '}
                  {selectedCategoryFilter &&
                    categories.find((c) => c.id === selectedCategoryFilter)?.name}
                  {selectedCategoryFilter && selectedDayFilter !== null && ' • '}
                  {selectedDayFilter !== null && `Day ${selectedDayFilter}`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategoryFilter(null);
                    setSelectedDayFilter(null);
                  }}
                  className="text-xs font-semibold text-neutral-500 hover:text-neutral-800 cursor-pointer"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          {displayedLogs.length === 0 ? (
            <div className="text-center py-8 text-neutral-400 text-sm italic bg-neutral-50/50 rounded-2xl border border-neutral-200">
              {stats.filteredLogs.length === 0
                ? `No entries logged in ${monthName}.`
                : 'No entries match the selected filters.'}
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-2xl overflow-hidden bg-white">
              {displayedLogs.map((log) => (
                <div key={log.id} className="p-3.5 sm:p-4 flex items-start justify-between gap-3 text-xs sm:text-sm">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 mt-0.5"
                      style={{ backgroundColor: log.category?.color_code || '#3b82f6' }}
                    >
                      <CategoryIcon name={log.category?.icon || 'Sparkles'} className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-neutral-900">{log.category?.name}</span>
                        <span className="text-neutral-400 text-xs font-mono">{getEffectiveLogDate(log)}</span>
                      </div>
                      {log.notes && (
                        <p className="text-neutral-600 text-xs mt-1 whitespace-pre-line break-words leading-relaxed">
                          {log.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <ActivityPhoto
                    log={log}
                    categoryName={log.category?.name || 'Activity'}
                    selectedDate={getEffectiveLogDate(log)}
                    aspectRatio="square"
                    onViewPhoto={(url, title) => setLightboxPhoto({ url, title })}
                    className="shrink-0"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Full Photo Lightbox */}
      <PhotoLightbox
        url={lightboxPhoto?.url || null}
        title={lightboxPhoto?.title}
        onClose={() => setLightboxPhoto(null)}
      />

      <PdfPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        pdfResult={pdfResult}
      />
    </div>
  );
};
