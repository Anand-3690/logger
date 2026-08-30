import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  CalendarDays,
  Calendar as CalendarIcon,
  X,
  History,
} from 'lucide-react';
import {
  formatLocalDate,
  getTodayLocalDate,
  parseLocalDate,
  formatLongDate,
  formatMediumDate,
  addDaysToDate,
  addMonthsToDate,
  addYearsToDate,
} from '../utils/dateUtils';

interface DaySelectorProps {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  logCountsByDate?: Record<string, number>;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const DaySelector: React.FC<DaySelectorProps> = ({
  selectedDate,
  onSelectDate,
  logCountsByDate = {},
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const calendarModalRef = useRef<HTMLDivElement>(null);
  const nativeDateInputRef = useRef<HTMLInputElement>(null);

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Month & Year viewing state inside the calendar popover
  const [viewYear, setViewYear] = useState<number>(() => {
    const d = parseLocalDate(selectedDate);
    return d.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState<number>(() => {
    const d = parseLocalDate(selectedDate);
    return d.getMonth(); // 0-11
  });

  // Synchronize viewing month/year when selectedDate changes externally
  useEffect(() => {
    const d = parseLocalDate(selectedDate);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }, [selectedDate]);

  const todayStr = useMemo(() => getTodayLocalDate(), []);
  const isSelectedToday = selectedDate === todayStr;

  // Generate a window of 15 days around the selected date (7 days before, 7 days after)
  const days = useMemo(() => {
    const list: {
      dateStr: string;
      dayOfWeek: string;
      dayNum: number;
      isToday: boolean;
      isSelected: boolean;
    }[] = [];

    for (let i = -7; i <= 7; i++) {
      const d = parseLocalDate(selectedDate);
      d.setDate(d.getDate() + i);
      const dateStr = formatLocalDate(d);
      const dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = d.getDate();

      list.push({
        dateStr,
        dayOfWeek,
        dayNum,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
      });
    }

    return list;
  }, [selectedDate, todayStr]);

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

  // Handle clicking outside the calendar dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isCalendarOpen &&
        calendarModalRef.current &&
        !calendarModalRef.current.contains(event.target as Node)
      ) {
        setIsCalendarOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isCalendarOpen) {
        setIsCalendarOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCalendarOpen]);

  // Navigation handlers
  const handlePrevDay = () => {
    onSelectDate(addDaysToDate(selectedDate, -1));
  };

  const handleNextDay = () => {
    onSelectDate(addDaysToDate(selectedDate, 1));
  };

  const handlePrevMonth = () => {
    onSelectDate(addMonthsToDate(selectedDate, -1));
  };

  const handleNextMonth = () => {
    onSelectDate(addMonthsToDate(selectedDate, 1));
  };

  const handleToday = () => {
    onSelectDate(todayStr);
  };

  const handleNativeDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      onSelectDate(e.target.value);
      setIsCalendarOpen(false);
    }
  };

  // Calendar Grid generation for viewYear and viewMonth
  const calendarGrid = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sunday
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells: {
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      logCount: number;
    }[] = [];

    // Previous month padding cells
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevD = new Date(viewYear, viewMonth - 1, dayNum);
      const dateStr = formatLocalDate(prevD);
      cells.push({
        dateStr,
        dayNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
        logCount: logCountsByDate[dateStr] || 0,
      });
    }

    // Current month cells
    for (let day = 1; day <= daysInMonth; day++) {
      const curD = new Date(viewYear, viewMonth, day);
      const dateStr = formatLocalDate(curD);
      cells.push({
        dateStr,
        dayNum: day,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
        logCount: logCountsByDate[dateStr] || 0,
      });
    }

    // Next month padding cells to complete 35 or 42 grid cells
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let day = 1; day <= remaining; day++) {
      const nextD = new Date(viewYear, viewMonth + 1, day);
      const dateStr = formatLocalDate(nextD);
      cells.push({
        dateStr,
        dayNum: day,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
        logCount: logCountsByDate[dateStr] || 0,
      });
    }

    return cells;
  }, [viewYear, viewMonth, selectedDate, todayStr, logCountsByDate]);

  // Year options range (from 10 years ago to +3 years into the future)
  const currentActualYear = new Date().getFullYear();
  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = currentActualYear - 10; y <= currentActualYear + 3; y++) {
      years.push(y);
    }
    return years;
  }, [currentActualYear]);

  // Quick preset jump actions
  const quickJumpPresets = [
    { label: 'Today', days: 0 },
    { label: 'Yesterday', days: -1 },
    { label: '7d Ago', days: -7 },
    { label: '30d Ago', days: -30 },
    { label: '1y Ago', years: -1 },
  ];

  return (
    <div className="glass-panel rounded-2xl p-3 sm:p-4 mb-4 relative z-20">
      {/* ------------------------------------------------------------- */}
      {/* SINGLE-LINE RESPONSIVE HEADER BAR                             */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-center justify-between gap-2 mb-3">
        {/* Clickable Date Display with interactive Badge */}
        <button
          id="btn-toggle-calendar-picker"
          onClick={() => setIsCalendarOpen((prev) => !prev)}
          title="Click to jump to any past date, month or year"
          className="flex items-center gap-2 px-2.5 py-1.5 -ml-1 rounded-xl hover:bg-white/80 transition-all group text-left min-w-0 border border-transparent hover:border-neutral-200/60"
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 flex items-center justify-center text-blue-600 border border-blue-500/20 shrink-0 transition-colors">
            <CalendarDays className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>

          <div className="min-w-0 truncate">
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm md:text-base font-bold text-neutral-900 truncate group-hover:text-blue-700 transition-colors">
                <span className="hidden sm:inline">{formatLongDate(selectedDate)}</span>
                <span className="sm:hidden">{formatMediumDate(selectedDate)}</span>
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-neutral-400 group-hover:text-blue-600 shrink-0 transition-transform duration-200 ${
                  isCalendarOpen ? 'rotate-180' : ''
                }`}
              />
            </div>
          </div>
        </button>

        {/* Action Controls & Fast Steppers */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Today Button */}
          <button
            id="btn-day-today"
            onClick={handleToday}
            className={`px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-semibold rounded-lg transition-all ${
              isSelectedToday
                ? 'bg-blue-50 text-blue-700 border border-blue-200/80'
                : 'text-neutral-600 hover:text-blue-700 hover:bg-white/80 bg-white/50 border border-neutral-200/70'
            }`}
          >
            Today
          </button>

          {/* Month Steppers (Desktop only) */}
          <button
            id="btn-prev-month"
            onClick={handlePrevMonth}
            title="Previous Month"
            className="hidden md:flex p-1.5 text-neutral-400 hover:text-neutral-800 hover:bg-white/70 rounded-lg transition-colors"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>

          {/* Day Stepper Segment */}
          <div className="flex items-center bg-white/60 border border-neutral-200/80 rounded-lg p-0.5 shadow-2xs">
            <button
              id="btn-day-prev"
              onClick={handlePrevDay}
              title="Previous Day"
              className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-white rounded-md transition-all active:scale-95"
            >
              <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            <button
              id="btn-day-next"
              onClick={handleNextDay}
              title="Next Day"
              className="p-1 text-neutral-600 hover:text-neutral-900 hover:bg-white rounded-md transition-all active:scale-95"
            >
              <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>

          <button
            id="btn-next-month"
            onClick={handleNextMonth}
            title="Next Month"
            className="hidden md:flex p-1.5 text-neutral-400 hover:text-neutral-800 hover:bg-white/70 rounded-lg transition-colors"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>

          {/* Quick Native Date Picker button */}
          <div className="relative">
            <input
              ref={nativeDateInputRef}
              type="date"
              value={selectedDate}
              onChange={handleNativeDateChange}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
              title="Open device calendar"
            />
            <button
              id="btn-native-datepicker-trigger"
              type="button"
              className="p-1.5 text-neutral-600 hover:text-blue-700 hover:bg-white/80 rounded-lg transition-colors border border-neutral-200/80 bg-white/50"
              title="Select via native calendar"
            >
              <CalendarIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* HORIZONTAL DAY STRIP                                          */}
      {/* ------------------------------------------------------------- */}
      <div
        ref={scrollContainerRef}
        className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-1 scroll-smooth"
      >
        {days.map((item) => {
          const logCount = logCountsByDate[item.dateStr] || 0;
          return (
            <button
              key={item.dateStr}
              id={`day-card-${item.dateStr}`}
              data-selected={item.isSelected}
              onClick={() => onSelectDate(item.dateStr)}
              className={`flex flex-col items-center justify-center min-w-[54px] sm:min-w-[62px] h-[68px] sm:h-[72px] rounded-xl px-1.5 py-1 transition-all relative shrink-0 active:scale-95 ${
                item.isSelected
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-500/50 ring-offset-2 ring-offset-white border border-blue-400/40'
                  : 'bg-white/60 text-neutral-700 hover:bg-white/90 border border-neutral-200/60 hover:shadow-xs'
              }`}
            >
              <span
                className={`text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider ${
                  item.isSelected ? 'text-blue-100' : 'text-neutral-500'
                }`}
              >
                {item.dayOfWeek}
              </span>
              <span
                className={`text-base sm:text-lg font-bold my-0.5 leading-none ${
                  item.isSelected ? 'text-white' : 'text-neutral-900'
                }`}
              >
                {item.dayNum}
              </span>

              {/* Activity indicator dot */}
              <div className="h-1.5 flex items-center justify-center">
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

              {/* Today marker indicator */}
              {item.isToday && !item.isSelected && (
                <span className="absolute -top-1 px-1 py-0.2 bg-neutral-900 text-[7px] sm:text-[8px] font-bold text-white rounded-full">
                  TODAY
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* RICH CALENDAR / MONTH / YEAR JUMP POPOVER                     */}
      {/* ------------------------------------------------------------- */}
      {isCalendarOpen && (
        <div
          ref={calendarModalRef}
          className="absolute top-full left-0 right-0 sm:right-auto mt-2 z-50 sm:w-[360px] bg-white/95 backdrop-blur-xl border border-neutral-200/90 rounded-2xl shadow-xl shadow-neutral-900/15 p-3.5 sm:p-4 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Popover Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-neutral-100 mb-3">
            <div className="flex items-center gap-1.5">
              <CalendarIcon className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
                Select Date, Month & Year
              </span>
            </div>
            <button
              id="btn-close-calendar-popover"
              onClick={() => setIsCalendarOpen(false)}
              className="p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Month & Year Selectors */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">
                Month
              </label>
              <select
                id="select-calendar-month"
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className="w-full text-xs font-semibold text-neutral-800 bg-neutral-50 border border-neutral-200 rounded-xl px-2 py-1.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">
                Year
              </label>
              <select
                id="select-calendar-year"
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                className="w-full text-xs font-semibold text-neutral-800 bg-neutral-50 border border-neutral-200 rounded-xl px-2 py-1.5 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Month Steppers */}
          <div className="flex items-center justify-between mb-2 px-1">
            <button
              id="btn-calendar-prev-month"
              onClick={() => {
                if (viewMonth === 0) {
                  setViewMonth(11);
                  setViewYear((y) => y - 1);
                } else {
                  setViewMonth((m) => m - 1);
                }
              }}
              className="p-1 hover:bg-neutral-100 rounded-lg text-neutral-600 transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-neutral-900">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              id="btn-calendar-next-month"
              onClick={() => {
                if (viewMonth === 11) {
                  setViewMonth(0);
                  setViewYear((y) => y + 1);
                } else {
                  setViewMonth((m) => m + 1);
                }
              }}
              className="p-1 hover:bg-neutral-100 rounded-lg text-neutral-600 transition-colors"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* 7-Day Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((w) => (
              <span key={w} className="text-[10px] font-bold text-neutral-400 uppercase py-0.5">
                {w}
              </span>
            ))}
          </div>

          {/* Calendar Days Grid */}
          <div className="grid grid-cols-7 gap-1 mb-3">
            {calendarGrid.map((cell) => (
              <button
                key={cell.dateStr}
                id={`cal-grid-${cell.dateStr}`}
                onClick={() => {
                  onSelectDate(cell.dateStr);
                  setIsCalendarOpen(false);
                }}
                className={`h-7 sm:h-8 rounded-lg text-xs font-semibold flex flex-col items-center justify-center relative transition-all ${
                  cell.isSelected
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : cell.isCurrentMonth
                    ? cell.isToday
                      ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
                      : 'text-neutral-800 hover:bg-neutral-100'
                    : 'text-neutral-300 hover:bg-neutral-50'
                }`}
              >
                <span>{cell.dayNum}</span>
                {cell.logCount > 0 && (
                  <span
                    className={`w-1 h-1 rounded-full absolute bottom-0.5 ${
                      cell.isSelected ? 'bg-white' : 'bg-blue-600'
                    }`}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Quick Presets Jump Footer */}
          <div className="border-t border-neutral-100 pt-2">
            <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <History className="w-3 h-3 text-neutral-400" />
              Quick Jumps
            </div>
            <div className="flex flex-wrap gap-1">
              {quickJumpPresets.map((preset) => (
                <button
                  key={preset.label}
                  id={`btn-preset-${preset.label.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={() => {
                    if (preset.years) {
                      onSelectDate(addYearsToDate(todayStr, preset.years));
                    } else {
                      onSelectDate(addDaysToDate(todayStr, preset.days || 0));
                    }
                    setIsCalendarOpen(false);
                  }}
                  className="px-2 py-1 bg-neutral-100 hover:bg-blue-50 hover:text-blue-700 text-neutral-600 text-[10px] sm:text-[11px] font-medium rounded-lg transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
