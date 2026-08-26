import React, { useMemo, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import {
  formatLocalDate,
  getTodayLocalDate,
  parseLocalDate,
  formatLongDate,
  addDaysToDate,
} from '../utils/dateUtils';

interface DaySelectorProps {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  logCountsByDate?: Record<string, number>;
}

export const DaySelector: React.FC<DaySelectorProps> = ({
  selectedDate,
  onSelectDate,
  logCountsByDate = {},
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Generate a window of 15 days around the selected date (7 days before, 7 days after)
  const days = useMemo(() => {
    const list: {
      dateStr: string;
      dayOfWeek: string;
      dayNum: number;
      monthShort: string;
      isToday: boolean;
      isSelected: boolean;
    }[] = [];

    // Reference today in local time
    const todayStr = getTodayLocalDate();

    // Generate days centered on selectedDate using local date math
    for (let i = -7; i <= 7; i++) {
      const d = parseLocalDate(selectedDate);
      d.setDate(d.getDate() + i);
      const dateStr = formatLocalDate(d);
      const dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = d.getDate();
      const monthShort = d.toLocaleDateString('en-US', { month: 'short' });

      list.push({
        dateStr,
        dayOfWeek,
        dayNum,
        monthShort,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
      });
    }

    return list;
  }, [selectedDate]);

  // Center selected item in scroll container on change
  useEffect(() => {
    const selectedEl = scrollContainerRef.current?.querySelector('[data-selected="true"]');
    if (selectedEl && scrollContainerRef.current) {
      selectedEl.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [selectedDate]);

  const handlePrevDay = () => {
    onSelectDate(addDaysToDate(selectedDate, -1));
  };

  const handleNextDay = () => {
    onSelectDate(addDaysToDate(selectedDate, 1));
  };

  const handleToday = () => {
    onSelectDate(getTodayLocalDate());
  };

  const formattedSelectedHeader = useMemo(() => {
    return formatLongDate(selectedDate);
  }, [selectedDate]);

  return (
    <div className="glass-panel rounded-2xl p-3 sm:p-4 mb-4">
      {/* Header bar of Day Selector with Month & Jump Navigation */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 border border-blue-500/20">
            <CalendarDays className="w-4 h-4" />
          </div>
          <h2 className="text-sm sm:text-base font-bold text-neutral-900 tracking-tight">
            {formattedSelectedHeader}
          </h2>
        </div>

        <div className="flex items-center gap-1">
          <button
            id="btn-day-today"
            onClick={handleToday}
            className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg transition-colors"
          >
            Today
          </button>
          <button
            id="btn-day-prev"
            onClick={handlePrevDay}
            title="Previous Day"
            className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-white/60 rounded-lg transition-colors border border-transparent hover:border-white/80"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            id="btn-day-next"
            onClick={handleNextDay}
            title="Next Day"
            className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-white/60 rounded-lg transition-colors border border-transparent hover:border-white/80"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Horizontal Scrollable Day Strip */}
      <div
        ref={scrollContainerRef}
        className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 scroll-smooth"
      >
        {days.map((item) => {
          const logCount = logCountsByDate[item.dateStr] || 0;
          return (
            <button
              key={item.dateStr}
              id={`day-card-${item.dateStr}`}
              data-selected={item.isSelected}
              onClick={() => onSelectDate(item.dateStr)}
              className={`flex flex-col items-center justify-center min-w-[58px] sm:min-w-[64px] h-[74px] rounded-xl px-2 py-1.5 transition-all relative shrink-0 ${
                item.isSelected
                  ? 'bg-blue-600/95 backdrop-blur-md text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-500/60 ring-offset-2 ring-offset-white/80 border border-blue-400/40'
                  : 'bg-white/50 backdrop-blur-md text-neutral-700 hover:bg-white/80 border border-white/80 hover:shadow-xs'
              }`}
            >
              <span
                className={`text-[10px] sm:text-xs font-medium uppercase tracking-wider ${
                  item.isSelected ? 'text-blue-100' : 'text-neutral-500'
                }`}
              >
                {item.dayOfWeek}
              </span>
              <span
                className={`text-lg sm:text-xl font-bold my-0.5 leading-none ${
                  item.isSelected ? 'text-white' : 'text-neutral-900'
                }`}
              >
                {item.dayNum}
              </span>

              {/* Activity count or dot badge */}
              <div className="h-2 flex items-center justify-center">
                {logCount > 0 ? (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      item.isSelected ? 'bg-white' : 'bg-blue-600'
                    }`}
                  />
                ) : (
                  <span className="w-1.5 h-1.5" />
                )}
              </div>

              {/* Today marker pill */}
              {item.isToday && !item.isSelected && (
                <span className="absolute -top-1 px-1.5 py-0.2 bg-neutral-900/80 backdrop-blur-xs text-[8px] font-bold text-white rounded-full border border-white/20">
                  TODAY
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
