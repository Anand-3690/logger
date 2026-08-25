import React, { useState, useMemo } from 'react';
import { DailyLog, Category } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { exportReportToPDF } from '../utils/pdfExport';
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
} from 'lucide-react';

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
      (log) => log.log_date.startsWith(selectedMonth) && log.status !== 'absent'
    );
    const totalLogs = filteredLogs.length;

    // Unique active days
    const activeDaysSet = new Set(filteredLogs.map((l) => l.log_date));
    const activeDaysCount = activeDaysSet.size;

    // Photos count
    const photoCount = filteredLogs.filter((l) => Boolean(l.photo_url)).length;

    // Days in selected month
    const [y, m] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();

    // Category breakdown
    const categoryCountMap: Record<string, { category: Category; count: number; dates: string[] }> = {};

    categories.forEach((cat) => {
      categoryCountMap[cat.id] = { category: cat, count: 0, dates: [] };
    });

    filteredLogs.forEach((log) => {
      const catId = log.category_id;
      if (categoryCountMap[catId]) {
        categoryCountMap[catId].count += 1;
        categoryCountMap[catId].dates.push(log.log_date);
      } else if (log.category) {
        categoryCountMap[catId] = {
          category: log.category,
          count: 1,
          dates: [log.log_date],
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
      const dayNum = parseInt(log.log_date.split('-')[2], 10);
      if (dailyCounts[dayNum] !== undefined) {
        dailyCounts[dayNum] += 1;
      }
    });

    return {
      totalLogs,
      activeDaysCount,
      daysInMonth,
      photoCount,
      topCategory,
      categoryBreakdown,
      dailyCounts,
      filteredLogs,
    };
  }, [logs, categories, selectedMonth]);

  const handleDownloadPDF = async () => {
    try {
      setIsExportingPDF(true);
      const filename = `activity_report_${selectedMonth}.pdf`;
      await exportReportToPDF('printable-monthly-report', filename);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('Could not export PDF. Please try again.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <div className="space-y-5 pb-24">
      {/* Month Navigation & PDF Export Controls */}
      <div className="bg-white rounded-2xl p-4 border border-neutral-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Month Selector */}
        <div className="flex items-center gap-2">
          <button
            id="btn-report-prev-month"
            onClick={handlePrevMonth}
            className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 px-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span className="text-sm sm:text-base font-bold text-neutral-900">
              {monthName}
            </span>
          </div>
          <button
            id="btn-report-next-month"
            onClick={handleNextMonth}
            className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            id="btn-report-current-month"
            onClick={handleCurrentMonth}
            className="text-xs font-semibold text-blue-600 hover:bg-blue-50 px-2.5 py-1 rounded-lg transition-colors ml-1"
          >
            Current Month
          </button>
        </div>

        {/* Download Monthly PDF Button */}
        <button
          id="btn-download-monthly-pdf"
          onClick={handleDownloadPDF}
          disabled={isExportingPDF || isLoading}
          className="flex items-center gap-2 px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 active:scale-97 disabled:opacity-60 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-sm shadow-neutral-900/20"
        >
          {isExportingPDF ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Generating PDF...</span>
            </>
          ) : exportSuccess ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>PDF Downloaded!</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>Download Monthly PDF</span>
            </>
          )}
        </button>
      </div>

      {/* ============================================================ */}
      {/* PRINTABLE REPORT CONTAINER (Captured by html2canvas / jsPDF) */}
      {/* ============================================================ */}
      <div
        id="printable-monthly-report"
        className="bg-white rounded-3xl p-5 sm:p-8 border border-neutral-200/90 shadow-sm space-y-6"
      >
        {/* Document Header for Export */}
        <div className="border-b border-neutral-200 pb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2">
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

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200/70 flex flex-col justify-between">
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

          <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200/70 flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-500 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Active Days</span>
              <Calendar className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-neutral-900">
              {stats.activeDaysCount} <span className="text-sm font-normal text-neutral-400">/ {stats.daysInMonth}</span>
            </div>
            <span className="text-[11px] text-neutral-500 font-medium">
              {Math.round((stats.activeDaysCount / (stats.daysInMonth || 1)) * 100)}% consistency rate
            </span>
          </div>

          <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200/70 flex flex-col justify-between">
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

          <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200/70 flex flex-col justify-between">
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
        </div>

        {/* Category Breakdown & Visual Bar Chart */}
        <div className="bg-neutral-50/70 rounded-2xl p-4 sm:p-6 border border-neutral-200/80 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              Category Aggregate Breakdown
            </h3>
            <span className="text-xs font-medium text-neutral-500">
              {stats.totalLogs} total entries
            </span>
          </div>

          {/* Bar Chart Representation */}
          <div className="space-y-3 pt-1">
            {stats.categoryBreakdown.map((item) => {
              const cat = item.category;
              return (
                <div key={cat.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded-md flex items-center justify-center text-white shrink-0"
                        style={{ backgroundColor: cat.color_code }}
                      >
                        <CategoryIcon name={cat.icon} className="w-3 h-3 text-white" />
                      </div>
                      <span className="font-bold text-neutral-800">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="font-semibold text-neutral-900">{item.count} logs</span>
                      <span className="text-xs text-neutral-400">({item.percentage}%)</span>
                    </div>
                  </div>

                  {/* Visual progress bar */}
                  <div className="w-full h-3 bg-neutral-200/80 rounded-full overflow-hidden flex">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(item.percentage, item.count > 0 ? 4 : 0)}%`,
                        backgroundColor: cat.color_code,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Daily Distribution Rhythm Grid across the Month */}
        <div className="bg-neutral-50/70 rounded-2xl p-4 sm:p-5 border border-neutral-200/80">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-600 mb-3">
            Daily Rhythm & Consistency ({monthName})
          </h3>
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
              <div key={idx} className="text-center text-[10px] font-bold text-neutral-400 uppercase py-0.5">
                {d}
              </div>
            ))}

            {/* Empty slots for first day offset */}
            {Array.from({ length: monthDate.getDay() }).map((_, i) => (
              <div key={`empty-${i}`} className="h-9 rounded-lg opacity-20 bg-neutral-100" />
            ))}

            {/* Days of month */}
            {Array.from({ length: stats.daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const count = stats.dailyCounts[dayNum] || 0;
              let bgStyle = 'bg-white border-neutral-200 text-neutral-700';
              if (count === 1) bgStyle = 'bg-blue-100 border-blue-200 text-blue-900 font-bold';
              if (count === 2) bgStyle = 'bg-blue-300 border-blue-400 text-blue-950 font-bold';
              if (count >= 3) bgStyle = 'bg-blue-600 border-blue-700 text-white font-bold';

              return (
                <div
                  key={dayNum}
                  title={`Day ${dayNum}: ${count} activities`}
                  className={`h-9 rounded-lg border flex flex-col items-center justify-center text-xs transition-colors relative ${bgStyle}`}
                >
                  <span>{dayNum}</span>
                  {count > 0 && (
                    <span className="text-[9px] leading-none opacity-85">
                      {count}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Itemized Activity Log List for this Month */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-600">
              Itemized Activity Entries ({stats.filteredLogs.length})
            </h3>
          </div>

          {stats.filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-neutral-400 text-sm italic">
              No entries logged in {monthName}.
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-2xl overflow-hidden bg-white">
              {stats.filteredLogs.map((log) => (
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
                        <span className="text-neutral-400 text-xs font-mono">{log.log_date}</span>
                      </div>
                      {log.notes && (
                        <p className="text-neutral-600 text-xs mt-1 whitespace-pre-line leading-relaxed">
                          {log.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {log.photo_url && (
                    <img
                      src={log.photo_url}
                      alt="Photo preview"
                      className="w-12 h-12 object-cover rounded-lg border border-neutral-200 shrink-0"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
