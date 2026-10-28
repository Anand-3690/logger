import React, { useEffect, useState, useRef } from 'react';
import {
  History,
  Target,
  BellRing,
  CheckCircle2,
  X,
  ChevronRight,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { AppNotification, AppNotificationAction } from '../types';

interface OnScreenNotificationBannerProps {
  notification: AppNotification | null;
  onDismiss: () => void;
  onAction: (action: string, notification: AppNotification) => void;
}

export const OnScreenNotificationBanner: React.FC<OnScreenNotificationBannerProps> = ({
  notification,
  onDismiss,
  onAction,
}) => {
  const [progress, setProgress] = useState<number>(100);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const DURATION_MS = 14000;

  useEffect(() => {
    if (!notification) {
      setProgress(100);
      return;
    }

    startTimeRef.current = Date.now();
    setProgress(100);

    const interval = setInterval(() => {
      if (isPaused) return;
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, 100 - (elapsed / DURATION_MS) * 100);
      setProgress(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        onDismiss();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [notification?.id, isPaused, onDismiss]);

  if (!notification) return null;

  const notifType = notification.type || 'general';

  // Type-specific badge and styling
  const isOtd = notifType === 'on-this-day';
  const isRes = notifType === 'resolution';

  const badgeConfig = isOtd
    ? {
        label: 'On This Day',
        icon: <History className="w-3.5 h-3.5 text-amber-400" />,
        badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        ringColor: 'ring-amber-500/30',
        glowColor: 'shadow-amber-500/15',
        accentBorder: 'border-amber-500/40',
      }
    : isRes
    ? {
        label: 'Resolution Reminder',
        icon: <Target className="w-3.5 h-3.5 text-emerald-400" />,
        badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        ringColor: 'ring-emerald-500/30',
        glowColor: 'shadow-emerald-500/15',
        accentBorder: 'border-emerald-500/40',
      }
    : {
        label: 'Daily Check-in',
        icon: <BellRing className="w-3.5 h-3.5 text-blue-400" />,
        badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
        ringColor: 'ring-blue-500/30',
        glowColor: 'shadow-blue-500/15',
        accentBorder: 'border-blue-500/40',
      };

  return (
    <div
      role="alert"
      aria-live="assertive"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => {
        setIsPaused(false);
        startTimeRef.current = Date.now() - ((100 - progress) / 100) * DURATION_MS;
      }}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] max-w-lg w-[calc(100%-1.5rem)] animate-in slide-in-from-top-4 fade-in duration-300"
    >
      <div
        className={`relative overflow-hidden rounded-3xl bg-neutral-900/95 text-white backdrop-blur-xl border ${badgeConfig.accentBorder} shadow-2xl ${badgeConfig.glowColor} ring-1 ${badgeConfig.ringColor} p-4 transition-all`}
      >
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase border ${badgeConfig.badgeBg}`}
            >
              {badgeConfig.icon}
              {badgeConfig.label}
            </span>
            <span className="text-[11px] text-neutral-400 font-medium">Just now</span>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss notification"
            className="p-1 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
              isOtd
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                : isRes
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                : 'bg-blue-500/15 border-blue-500/30 text-blue-400'
            }`}
          >
            {isOtd ? (
              <Sparkles className="w-5 h-5 text-amber-400" />
            ) : isRes ? (
              <Target className="w-5 h-5 text-emerald-400" />
            ) : (
              <BellRing className="w-5 h-5 text-blue-400" />
            )}
          </div>

          <div className="flex-1 min-w-0 pr-1">
            <h4 className="text-sm font-bold text-white tracking-tight leading-snug">
              {notification.title}
            </h4>
            <p className="text-xs text-neutral-300 mt-1 leading-relaxed line-clamp-3">
              {notification.body}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        {notification.actions && notification.actions.length > 0 && (
          <div className="mt-3.5 pt-3 border-t border-white/10 flex flex-wrap items-center gap-2">
            {notification.actions.map((act) => {
              const isPrimary =
                act.variant === 'primary' ||
                act.action === 'present' ||
                act.action === 'view';

              let btnClass = '';
              if (act.action === 'present') {
                btnClass =
                  'bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-emerald-900/40';
              } else if (act.action === 'view' && isOtd) {
                btnClass =
                  'bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-amber-900/40';
              } else if (act.action === 'view') {
                btnClass =
                  'bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-emerald-900/40';
              } else if (isPrimary) {
                btnClass =
                  'bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-blue-900/40';
              } else {
                btnClass =
                  'bg-white/10 hover:bg-white/20 text-neutral-200 font-medium border border-white/10';
              }

              return (
                <button
                  key={act.action}
                  type="button"
                  onClick={() => onAction(act.action, notification)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs shadow-xs active:scale-95 transition-all cursor-pointer ${btnClass}`}
                >
                  {act.action === 'present' && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {act.action === 'view' && <ChevronRight className="w-3.5 h-3.5" />}
                  <span>{act.title}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Bottom Countdown Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5 overflow-hidden">
          <div
            className={`h-full transition-all duration-100 ease-linear ${
              isOtd
                ? 'bg-amber-400'
                : isRes
                ? 'bg-emerald-400'
                : 'bg-blue-400'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};

