import React, { useState } from 'react';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { getTodayLocalDate } from '../utils/dateUtils';
import { DailyLog } from '../types';

interface QuickLogProps {
  categoryId: string;
  onClose: () => void;
}

export const QuickLog: React.FC<QuickLogProps> = ({ categoryId, onClose }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // We explicitly return `null` if not found so we can distinguish between 
  // 'undefined' (Dexie is loading) and 'null' (Category does not exist)
  const category = useLiveQuery(async () => {
    const cat = await db.categories.get(categoryId);
    return cat || null;
  }, [categoryId]);

  const handleAction = async (action: 'present' | 'absent') => {
    setIsSubmitting(true);
    const today = getTodayLocalDate();
    const logId = crypto.randomUUID();

    try {
      // Instant local transaction
      await db.transaction('rw', db.dailyLogs, db.syncQueue, async () => {
        await db.dailyLogs.put({
          id: logId,
          log_date: today,
          category_id: categoryId,
          notes: action === 'present' ? 'Quick Log' : 'Absent via Quick Log',
          status: action,
          created_at: new Date().toISOString(),
        } as DailyLog);
        
        await db.syncQueue.put({ id: logId, table: 'daily_logs', action: 'upsert', timestamp: Date.now() });
      });

      // Seamlessly transition back to the dashboard
      window.history.replaceState(null, '', '/');
      onClose();
    } catch (err) {
      console.error('Failed to log action:', err);
      setIsSubmitting(false);
    }
  };

  // 1. Loading State (Usually resolves in < 10ms)
  if (category === undefined) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  // 2. Error State (E.g., User clicked an old notification for a deleted category)
  if (category === null) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="text-red-400 mb-4 text-lg font-semibold">Category not found or deleted.</div>
        <button
          onClick={() => {
            window.history.replaceState(null, '', '/');
            onClose();
          }}
          className="px-6 py-3 bg-neutral-800 text-white rounded-xl hover:bg-neutral-700 transition-colors font-medium shadow-sm"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  // 3. Ready State
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-neutral-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Frosted glow background shapes */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full glass-dark rounded-3xl p-6 sm:p-8 space-y-8 text-center relative z-10 shadow-2xl">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-2">Daily Check-in</h1>
          <p className="text-neutral-300 text-base sm:text-lg">
            Did you accomplish <span className="font-bold underline decoration-2 underline-offset-4" style={{ color: category.color_code }}>{category.name}</span> today?
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 mt-6">
          <button
            onClick={() => handleAction('present')}
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-3 py-5 px-4 rounded-2xl bg-emerald-600/90 hover:bg-emerald-600 active:scale-98 backdrop-blur-md text-white font-bold text-lg transition-all shadow-lg shadow-emerald-950/40 border border-emerald-400/40 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckCircle2 className="w-7 h-7" />}
            Yes / Present
          </button>

          <button
            onClick={() => handleAction('absent')}
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-3 py-5 px-4 rounded-2xl bg-white/10 hover:bg-white/15 active:scale-98 backdrop-blur-md text-neutral-200 font-bold text-lg transition-all border border-white/20 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <XCircle className="w-7 h-7" />}
            No / Absent
          </button>
        </div>
      </div>
    </div>
  );
};