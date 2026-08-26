import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Category } from '../types';
import { getTodayLocalDate } from '../utils/dateUtils';

interface QuickLogProps {
  categoryId: string;
  onClose: () => void;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export const QuickLog: React.FC<QuickLogProps> = ({ categoryId, onClose, authFetch }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [category, setCategory] = useState<Category | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategory = async () => {
      try {
        const res = await authFetch('/api/categories');
        if (res.ok) {
          const categories: Category[] = await res.json();
          const found = categories.find((c) => c.id === categoryId);
          if (found) {
            setCategory(found);
          } else {
            setError('Category not found.');
          }
        } else {
          setError('Failed to fetch categories.');
        }
      } catch (err) {
        setError('Connection error occurred.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchCategory();
  }, [categoryId, authFetch]);

  const handleAction = async (action: 'present' | 'absent') => {
    setIsSubmitting(true);
    const today = getTodayLocalDate();

    try {
      const res = await authFetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          log_date: today,
          category_id: categoryId,
          notes: action === 'present' ? 'Recorded manually via Quick Log' : 'Marked as absent via Quick Log',
          status: action,
        }),
      });

      if (!res.ok) {
        const contentType = res.headers.get('content-type') || '';
        let errMessage = 'Failed to save log';
        if (contentType.includes('application/json')) {
          const data = await res.json().catch(() => ({}));
          errMessage = data.error || errMessage;
        }
        throw new Error(errMessage);
      }
      
      // Navigate back to the dashboard using standard window history replaceState or just changing location
      window.history.replaceState(null, '', '/');
      onClose(); // Triggers the re-render in App.tsx
    } catch (err: any) {
      console.error('Failed to log action:', err);
      setError(err.message || 'Failed to save log.');
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error || !category) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="text-red-400 mb-4 text-lg">{error || 'An error occurred'}</div>
        <button
          onClick={() => {
            window.history.replaceState(null, '', '/');
            onClose();
          }}
          className="px-6 py-3 bg-neutral-800 text-white rounded-xl hover:bg-neutral-700 transition-colors"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950 text-neutral-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Frosted glow background shapes */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full glass-dark rounded-3xl p-6 sm:p-8 space-y-8 text-center relative z-10">
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
