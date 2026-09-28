import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, PenLine } from 'lucide-react';
import { DailyLog } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { ActivityPhoto } from './ActivityPhoto';
import { getEffectiveLogDate } from '../utils/dayBoundary';

interface MemoryCardProps {
  log: DailyLog;
  onAddReflection: (log: DailyLog) => void;
  onViewPhoto?: (url: string, title?: string) => void;
  isFirstOfYear?: boolean;
}

const getYearsAgo = (year: number) => {
  const currentYear = new Date().getFullYear();
  const delta = currentYear - year;
  return delta === 1 ? '1 year ago' : `${delta} years ago`;
};

export const MemoryCard: React.FC<MemoryCardProps> = ({
  log,
  onAddReflection,
  onViewPhoto,
  isFirstOfYear = false,
}) => {
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  const effDate = getEffectiveLogDate(log);
  const year = parseInt(effDate.split('-')[0], 10);
  const category = log.category;
  const catName = category?.name || 'Activity';
  const catColor = category?.color_code || '#8b5cf6';
  const catIcon = category?.icon || 'Sparkles';

  // Measure text container to check if it overflows 5 lines
  const checkOverflow = () => {
    const el = bodyRef.current;
    if (el) {
      setOverflows(el.scrollHeight > el.clientHeight + 1);
    }
  };

  useLayoutEffect(() => {
    checkOverflow();
  }, [log.notes]);

  // Re-check overflow on window resize for responsiveness
  useEffect(() => {
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, []);

  return (
    <article
      id={isFirstOfYear ? `memory-${year}` : undefined}
      className="scroll-mt-28 rounded-2xl border border-white/80 bg-white/75 p-4 sm:p-5 shadow-xs backdrop-blur-xl transition-all hover:bg-white/90 hover:shadow-md relative overflow-hidden"
      style={{ borderLeft: `4px solid ${catColor}` }}
    >
      <header className="mb-2.5 flex items-baseline gap-2.5 flex-wrap">
        <span className="text-2xl font-bold tabular-nums text-slate-900 tracking-tight">
          {year}
        </span>
        <span className="text-xs sm:text-sm font-semibold text-slate-600 bg-slate-100/80 px-2 py-0.5 rounded-lg border border-slate-200/60">
          {getYearsAgo(year)}
        </span>
        <span className="text-xs font-mono text-slate-400">
          {effDate}
        </span>

        <span
          className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold text-white shadow-2xs"
          style={{ backgroundColor: catColor }}
        >
          <CategoryIcon name={catIcon} className="w-3.5 h-3.5" />
          <span>{catName}</span>
        </span>
      </header>

      {/* Collapsible Text with 5-line clamp & fade */}
      {log.notes && (
        <motion.div
          layout="size"
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative"
        >
          <p
            ref={bodyRef}
            className={`whitespace-pre-line text-sm sm:text-[15px] leading-[1.8] text-slate-800 ${
              expanded ? '' : 'line-clamp-5'
            }`}
          >
            {log.notes}
          </p>

          <AnimatePresence>
            {overflows && !expanded && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white/95 to-transparent"
              />
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Photo Attachment */}
      <ActivityPhoto
        log={log}
        categoryName={catName}
        selectedDate={effDate}
        onViewPhoto={onViewPhoto || (() => {})}
        className="mt-3"
      />

      {/* Card Footer with Read more & Add reflection */}
      <footer className="mt-3 pt-2.5 border-t border-slate-200/50 flex items-center justify-between gap-2 flex-wrap">
        <div>
          {overflows && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-xs sm:text-sm font-semibold text-blue-700 hover:bg-blue-50/80 active:scale-97 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              <span>{expanded ? 'Show less' : 'Read more'}</span>
              <ChevronDown
                size={16}
                aria-hidden
                className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </div>

        <button
          type="button"
          id={`btn-add-reflection-${log.id}`}
          onClick={() => onAddReflection(log)}
          className="ml-auto flex min-h-[44px] items-center gap-1.5 rounded-xl bg-white/90 hover:bg-white text-slate-800 border border-slate-200/80 px-3 py-2 text-xs sm:text-sm font-semibold shadow-2xs hover:shadow-xs hover:border-blue-400 active:scale-97 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <PenLine size={15} aria-hidden className="text-blue-600" />
          <span>Add reflection</span>
        </button>
      </footer>
    </article>
  );
};

/** Sticky chips to jump between years without scrolling past long entries. */
export function YearChips({ years }: { years: number[] }) {
  if (years.length < 2) return null;

  const handleJump = (e: React.MouseEvent, y: number) => {
    e.preventDefault();
    const el = document.getElementById(`memory-${y}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <nav
      aria-label="Jump to year"
      className="sticky top-16 z-20 -mx-4 mb-3 flex items-center gap-2 overflow-x-auto no-scrollbar bg-white/70 backdrop-blur-md px-4 py-2 border-b border-slate-200/50 shadow-2xs"
    >
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 shrink-0 mr-1">
        Years
      </span>
      {years.map((y) => (
        <a
          key={y}
          href={`#memory-${y}`}
          onClick={(e) => handleJump(e, y)}
          className="rounded-full border border-slate-200/90 bg-white/90 px-3 py-1 text-xs font-semibold tabular-nums text-slate-700 hover:border-blue-400 hover:text-blue-700 hover:bg-blue-50/50 focus-visible:outline-2 focus-visible:outline-blue-600 shrink-0 transition-colors shadow-2xs cursor-pointer"
        >
          {y}
        </a>
      ))}
    </nav>
  );
}
