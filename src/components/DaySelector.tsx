import React, { useMemo, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

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

  // Parse current selected date
  const selectedDateObj = useMemo(() => {
    return new Date(selectedDate + 'T00:00:00');
  }, [selectedDate]);

  // Generate a window of 14 days around the selected date (7 days before, 7 days after)
  const days = useMemo(() => {
    const list: {
      dateStr: string;
      dayOfWeek: string;
      dayNum: number;
      monthShort: string;
      isToday: boolean;
      isSelected: boolean;
    }[] = [];

    // Reference today
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Find the Monday of the current selected week or generate a 14-day sliding range
    const baseDate = new Date(selectedDateObj);
    // Let's generate a 14-day window starting from 6 days ago up to 7 days ahead
    for (let i = -7; i <= 7; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
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
  }, [selectedDate, selectedDateObj]);

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
    const prev = new Date(selectedDateObj);
    prev.setDate(prev.getDate() - 1);
    onSelectDate(prev.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const next = new Date(selectedDateObj);
    next.setDate(next.getDate() + 1);
    onSelectDate(next.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    const today = new Date().toISOString().split('T')[0];
    onSelectDate(today);
  };

  const formattedSelectedHeader = useMemo(() => {
    return selectedDateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [selectedDateObj]);

  return (
    <div className="bg-white rounded-2xl p-3 sm:p-4 border border-neutral-200/80 shadow-xs mb-4">
      {/* Header bar of Day Selector with Month & Jump Navigation */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm sm:text-base font-bold text-neutral-900">
            {formattedSelectedHeader}
          </h2>
        </div>

        <div className="flex items-center gap-1">
          <button
            id="btn-day-today"
            onClick={handleToday}
            className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
          >
            Today
          </button>
          <button
            id="btn-day-prev"
            onClick={handlePrevDay}
            title="Previous Day"
            className="p-1 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            id="btn-day-next"
            onClick={handleNextDay}
            title="Next Day"
            className="p-1 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
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
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-600 ring-offset-2'
                  : 'bg-neutral-50 text-neutral-700 hover:bg-neutral-100/80 border border-neutral-200/60'
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
                <span className="absolute -top-1 px-1.5 py-0.2 bg-neutral-800 text-[8px] font-bold text-white rounded-full">
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
