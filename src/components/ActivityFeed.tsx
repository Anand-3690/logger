import React, { useState } from 'react';
import { DailyLog } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { Trash2, Image as ImageIcon, Plus, Clock, Check, X, Loader2 } from 'lucide-react';

interface ActivityFeedProps {
  logs: DailyLog[];
  isLoading: boolean;
  selectedDate: string;
  onOpenNewLog: () => void;
  onDeleteLog: (id: string) => Promise<void> | void;
  onViewPhoto: (url: string, title?: string) => void;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  logs,
  isLoading,
  selectedDate,
  onOpenNewLog,
  onDeleteLog,
  onViewPhoto,
}) => {
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const getCategoryColor = (colorCode?: string) => {
    if (!colorCode) return '#3b82f6';
    return colorCode;
  };

  const executeDelete = async (id: string) => {
    try {
      setDeletingId(id);
      await onDeleteLog(id);
    } finally {
      setDeletingId(null);
      setConfirmingDeleteId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white rounded-2xl p-4 border border-neutral-200/60 shadow-xs animate-pulse flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-neutral-200 rounded-lg" />
                <div className="w-24 h-4 bg-neutral-200 rounded" />
              </div>
              <div className="w-12 h-3 bg-neutral-200 rounded" />
            </div>
            <div className="w-full h-12 bg-neutral-100 rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 sm:p-12 text-center border border-neutral-200/80 shadow-xs flex flex-col items-center justify-center">
        <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-400 mb-3">
          <Clock className="w-7 h-7" />
        </div>
        <h3 className="text-base font-bold text-neutral-800 mb-1">
          No activities logged for this day
        </h3>
        <p className="text-xs sm:text-sm text-neutral-500 max-w-sm mb-5">
          Keep track of your deep work sessions, workouts, reading, or other daily goals.
        </p>
        <button
          id="btn-empty-log-activity"
          onClick={onOpenNewLog}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-97 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-sm shadow-blue-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>Log an Activity</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-24">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
          Logged Activities ({logs.length})
        </span>
      </div>

      {logs.map((log) => {
        const category = log.category;
        const color = getCategoryColor(category?.color_code);
        const iconName = category?.icon || 'Sparkles';
        const categoryName = category?.name || 'Uncategorized';
        const isAbsent = log.status === 'absent';

        return (
          <div
            key={log.id}
            id={`log-item-${log.id}`}
            className={`group rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all relative overflow-hidden ${
              isAbsent
                ? 'bg-red-50/40 border-2 border-red-200/80'
                : 'bg-white border border-neutral-200/80'
            }`}
          >
            {/* Left Category Accent Line */}
            <div
              className={`absolute left-0 top-0 bottom-0 ${isAbsent ? 'w-2 opacity-40 grayscale' : 'w-1.5'}`}
              style={{ backgroundColor: isAbsent ? '#ef4444' : color }}
            />

            <div className="flex items-start justify-between gap-3 mb-2.5">
              {/* Category Pill with Icon & Name */}
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs ${
                    isAbsent ? 'bg-red-400' : ''
                  }`}
                  style={{ backgroundColor: isAbsent ? undefined : color }}
                >
                  <CategoryIcon name={isAbsent ? 'XCircle' : iconName} className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-neutral-900 leading-tight">
                      {categoryName}
                    </h4>
                    {isAbsent && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-red-100 text-red-700 border border-red-200">
                        Absent
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-neutral-400 font-medium">
                    {formatTime(log.created_at)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 transition-opacity">
                {confirmingDeleteId === log.id ? (
                  <div className="flex items-center gap-1 bg-red-50 p-1 rounded-xl border border-red-200 animate-in fade-in">
                    <span className="text-[11px] font-bold text-red-700 px-1.5">
                      Delete?
                    </span>
                    <button
                      type="button"
                      id={`btn-confirm-delete-${log.id}`}
                      onClick={() => executeDelete(log.id)}
                      disabled={deletingId === log.id}
                      title="Confirm delete"
                      className="p-1 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center justify-center disabled:opacity-60"
                    >
                      {deletingId === log.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      )}
                    </button>
                    <button
                      type="button"
                      id={`btn-cancel-delete-${log.id}`}
                      onClick={() => setConfirmingDeleteId(null)}
                      disabled={deletingId === log.id}
                      title="Cancel"
                      className="p-1 bg-white hover:bg-neutral-100 text-neutral-600 rounded-lg transition-colors border border-neutral-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    id={`btn-delete-log-${log.id}`}
                    onClick={() => setConfirmingDeleteId(log.id)}
                    title="Delete log"
                    className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Log Notes */}
            {log.notes && (
              <p className="text-xs sm:text-sm text-neutral-700 leading-relaxed whitespace-pre-line mb-3 pl-0.5">
                {log.notes}
              </p>
            )}

            {/* Photo Attachment */}
            {log.photo_url && (
              <div className="mt-2.5">
                <button
                  onClick={() => onViewPhoto(log.photo_url!, `${categoryName} - ${selectedDate}`)}
                  className="relative rounded-xl overflow-hidden border border-neutral-200/80 max-h-56 w-full group/photo text-left block focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <img
                    src={log.photo_url}
                    alt={`${categoryName} photo`}
                    className="w-full h-44 object-cover group-hover/photo:scale-102 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="bg-white/90 text-neutral-900 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-md flex items-center gap-1.5 backdrop-blur-xs">
                      <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                      Tap to enlarge
                    </span>
                  </div>
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
