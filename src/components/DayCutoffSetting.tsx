import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import {
  DAY_CUTOFF_OPTIONS,
  getDayCutoffHour,
  setDayCutoffHour,
} from '../utils/dayBoundary';

interface DayCutoffSettingProps {
  onChange?: (hour: number) => void;
  compact?: boolean;
  dark?: boolean;
}

export const DayCutoffSetting: React.FC<DayCutoffSettingProps> = ({
  onChange,
  compact = false,
  dark = false,
}) => {
  const [cutoff, setCutoff] = useState<number>(() => getDayCutoffHour());

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail?.dayCutoffHour !== undefined) {
        setCutoff(e.detail.dayCutoffHour);
      }
    };
    window.addEventListener('activity_settings_changed', handler);
    return () => window.removeEventListener('activity_settings_changed', handler);
  }, []);

  const handleChange = (newHour: number) => {
    setCutoff(newHour);
    setDayCutoffHour(newHour);
    if (onChange) onChange(newHour);
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <label
          htmlFor="select-compact-day-cutoff"
          className={`text-xs font-semibold flex items-center gap-1.5 ${
            dark ? 'text-neutral-200' : 'text-slate-700'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-blue-500" />
          <span>Day ends at</span>
        </label>
        <select
          id="select-compact-day-cutoff"
          value={cutoff}
          onChange={(e) => handleChange(parseInt(e.target.value, 10))}
          className={`rounded-lg px-2 py-1 text-xs font-semibold shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer ${
            dark
              ? 'border-neutral-700 bg-neutral-800 text-white'
              : 'border-slate-200 bg-white text-slate-800'
          }`}
        >
          {DAY_CUTOFF_OPTIONS.map((opt) => (
            <option key={opt.hour} value={opt.hour}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border p-3.5 sm:p-4 space-y-2.5 ${
        dark
          ? 'border-neutral-800 bg-neutral-900/90 text-white'
          : 'border-slate-200/80 bg-slate-50/80 text-slate-900'
      }`}
    >
      <div className="flex items-center justify-between">
        <label
          htmlFor="select-day-cutoff"
          className={`text-xs sm:text-sm font-semibold flex items-center gap-2 ${
            dark ? 'text-white' : 'text-slate-900'
          }`}
        >
          <Clock className="w-4 h-4 text-blue-500" />
          <span>Day ends at</span>
        </label>
        <span className={`text-xs font-medium ${dark ? 'text-neutral-400' : 'text-slate-500'}`}>
          Default: 4:00 AM
        </span>
      </div>

      <select
        id="select-day-cutoff"
        value={cutoff}
        onChange={(e) => handleChange(parseInt(e.target.value, 10))}
        className={`w-full rounded-xl border px-3 py-2 text-xs sm:text-sm font-semibold shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer ${
          dark
            ? 'border-neutral-700 bg-neutral-800 text-white'
            : 'border-slate-200 bg-white text-slate-800'
        }`}
      >
        {DAY_CUTOFF_OPTIONS.map((opt) => (
          <option key={opt.hour} value={opt.hour} className={dark ? 'bg-neutral-800 text-white' : ''}>
            {opt.label}
          </option>
        ))}
      </select>

      <p className={`text-xs leading-relaxed font-medium ${dark ? 'text-neutral-400' : 'text-slate-600'}`}>
        Entries logged late at night before this cutoff are counted toward the previous calendar day.
        Original timestamps remain completely untouched.
      </p>
    </div>
  );
};
