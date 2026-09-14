import React from 'react';
import { Calendar, BarChart3, History, Search, Plus } from 'lucide-react';

interface BottomNavBarProps {
  currentView: 'dashboard' | 'reports' | 'on-this-day';
  onViewChange: (view: 'dashboard' | 'reports' | 'on-this-day') => void;
  onOpenNewLog: () => void;
  onOpenSearch: () => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  currentView,
  onViewChange,
  onOpenNewLog,
  onOpenSearch,
}) => {
  return (
    <nav
      id="mobile-bottom-nav"
      aria-label="Mobile Navigation"
      className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white/95 backdrop-blur-xl border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      <div className="grid grid-cols-5 items-end justify-items-center max-w-md mx-auto">
        {/* 1. Dashboard Tab */}
        <button
          type="button"
          id="btn-bottom-nav-dashboard"
          onClick={() => onViewChange('dashboard')}
          className={`flex flex-col items-center justify-center w-full py-1.5 transition-colors cursor-pointer ${
            currentView === 'dashboard'
              ? 'text-blue-600 font-bold'
              : 'text-neutral-500 hover:text-neutral-800'
          }`}
        >
          <div className="relative">
            <Calendar className="w-5 h-5 transition-transform" />
            {currentView === 'dashboard' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-600 rounded-full" />
            )}
          </div>
          <span className="text-[10px] mt-1 font-medium tracking-tight">Today</span>
        </button>

        {/* 2. On This Day Tab */}
        <button
          type="button"
          id="btn-bottom-nav-on-this-day"
          onClick={() => {
            onViewChange('on-this-day');
            window.history.pushState(null, '', '/on-this-day');
          }}
          className={`flex flex-col items-center justify-center w-full py-1.5 transition-colors cursor-pointer ${
            currentView === 'on-this-day'
              ? 'text-blue-600 font-bold'
              : 'text-neutral-500 hover:text-neutral-800'
          }`}
        >
          <div className="relative">
            <History className="w-5 h-5 transition-transform" />
            {currentView === 'on-this-day' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-600 rounded-full" />
            )}
          </div>
          <span className="text-[10px] mt-1 font-medium tracking-tight">Memories</span>
        </button>

        {/* 3. Center Elevated New Log Action */}
        <div className="flex flex-col items-center justify-center w-full">
          <button
            type="button"
            id="btn-bottom-nav-add-log"
            onClick={onOpenNewLog}
            aria-label="Add new activity log"
            className="w-12 h-12 -mt-4 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-600/35 border-[3px] border-white flex items-center justify-center active:scale-92 transition-all cursor-pointer ring-2 ring-blue-500/15"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
          <span className="text-[10px] mt-0.5 font-bold text-blue-700">Log</span>
        </div>

        {/* 4. Reports Tab */}
        <button
          type="button"
          id="btn-bottom-nav-reports"
          onClick={() => onViewChange('reports')}
          className={`flex flex-col items-center justify-center w-full py-1.5 transition-colors cursor-pointer ${
            currentView === 'reports'
              ? 'text-blue-600 font-bold'
              : 'text-neutral-500 hover:text-neutral-800'
          }`}
        >
          <div className="relative">
            <BarChart3 className="w-5 h-5 transition-transform" />
            {currentView === 'reports' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-600 rounded-full" />
            )}
          </div>
          <span className="text-[10px] mt-1 font-medium tracking-tight">Reports</span>
        </button>

        {/* 5. Search Tab */}
        <button
          type="button"
          id="btn-bottom-nav-search"
          onClick={onOpenSearch}
          className="flex flex-col items-center justify-center w-full py-1.5 text-neutral-500 hover:text-neutral-800 transition-colors cursor-pointer"
        >
          <div className="relative">
            <Search className="w-5 h-5 transition-transform" />
          </div>
          <span className="text-[10px] mt-1 font-medium tracking-tight">Search</span>
        </button>
      </div>
    </nav>
  );
};
