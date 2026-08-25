import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Category } from '../types';

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
    const today = new Date().toISOString().split('T')[0];

    try {
      await authFetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          log_date: today,
          category_id: categoryId,
          notes: action === 'present' ? 'Recorded manually via Quick Log' : 'Marked as absent via Quick Log',
          status: action,
        }),
      });
      
      // Navigate back to the dashboard using standard window history replaceState or just changing location
      window.history.replaceState(null, '', '/');
      onClose(); // Triggers the re-render in App.tsx
    } catch (err) {
      console.error('Failed to log action:', err);
      setError('Failed to save log.');
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
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Daily Check-in</h1>
          <p className="text-neutral-400 text-lg">
            Did you accomplish <span className="text-white font-semibold" style={{ color: category.color_code }}>{category.name}</span> today?
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 mt-8">
          <button
            onClick={() => handleAction('present')}
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-3 py-6 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xl transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckCircle2 className="w-8 h-8" />}
            Yes / Present
          </button>

          <button
            onClick={() => handleAction('absent')}
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-3 py-6 px-4 rounded-2xl bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 text-neutral-300 font-bold text-xl transition-all disabled:opacity-50 mt-4"
          >
            {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <XCircle className="w-8 h-8" />}
            No / Absent
          </button>
        </div>
      </div>
    </div>
  );
};
