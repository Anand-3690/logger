import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { ArrowLeft, Clock } from 'lucide-react';
import { ActivityPhoto } from './ActivityPhoto';
import { PhotoLightbox } from './PhotoLightbox';

interface OnThisDayViewProps {
  onBack: () => void;
}

export const OnThisDayView: React.FC<OnThisDayViewProps> = ({ onBack }) => {
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; title?: string } | null>(null);

  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();
  const currentYear = today.getFullYear();

  const historicalLogs = useLiveQuery(async () => {
    // 1. Resolve Category ID
    const category = await db.categories.where('name').equals('Guruhari Darshan').first();
    if (!category) return [];

    // 2. Fetch all logs for this category
    const allLogs = await db.dailyLogs.where('category_id').equals(category.id).toArray();

    // 3. Filter for matching Month & Day, excluding current year
    return allLogs
      .filter(log => {
        const logDate = new Date(log.log_date);
        return (
          logDate.getMonth() + 1 === currentMonth && 
          logDate.getDate() === currentDay &&
          logDate.getFullYear() !== currentYear // Don't show today's entry
        );
      })
      .map(log => ({ ...log, category }))
      .sort((a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime());
  }, []);

  if (historicalLogs === undefined) {
    return <div className="p-8 text-center text-neutral-500 font-medium animate-pulse">Retrieving past memories...</div>;
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header Navigation */}
      <div className="flex items-center gap-3 pb-2 border-b border-neutral-200/60">
        <button 
          onClick={onBack} 
          className="p-2 bg-white/60 hover:bg-white rounded-xl shadow-xs border border-white/80 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-neutral-700" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-neutral-900 leading-tight">On This Day</h2>
          <p className="text-xs text-neutral-500 font-medium">Historical Guruhari Darshan Memories</p>
        </div>
      </div>

      {/* Historical Feed */}
      {historicalLogs.length === 0 ? (
        <div className="glass-panel rounded-3xl p-12 text-center flex flex-col items-center">
          <Clock className="w-8 h-8 text-blue-400 mb-3 opacity-80" />
          <p className="text-sm font-semibold text-neutral-700">No past entries found for today.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {historicalLogs.map((log) => {
            const year = log.log_date.split('-')[0];
            return (
              <div key={log.id} className="glass-panel rounded-2xl p-5 border-l-4 border-l-blue-500 relative overflow-hidden group">
                <div className="absolute top-0 right-0 bg-gradient-to-bl from-blue-100 to-blue-50/50 text-blue-800/20 font-black text-5xl px-4 py-2 rounded-bl-3xl pointer-events-none group-hover:scale-110 transition-transform duration-500">
                  {year}
                </div>
                <div className="relative z-10">
                  <p className="text-sm text-neutral-800 leading-relaxed whitespace-pre-line mb-3 pr-8">
                    {log.notes}
                  </p>
                  <ActivityPhoto
                     log={log as any}
                     categoryName="Guruhari Darshan"
                     selectedDate={log.log_date}
                     onViewPhoto={(url, title) => setLightboxPhoto({ url, title })}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PhotoLightbox
        url={lightboxPhoto?.url || null}
        title={lightboxPhoto?.title}
        onClose={() => setLightboxPhoto(null)}
      />
    </div>
  );
};