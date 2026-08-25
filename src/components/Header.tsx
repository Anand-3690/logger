import React from 'react';
import { Calendar, BarChart3, Database, Sparkles, Plus, Tag, Lock } from 'lucide-react';

interface HeaderProps {
  currentView: 'dashboard' | 'reports';
  onViewChange: (view: 'dashboard' | 'reports') => void;
  onOpenNewLog: () => void;
  onOpenSchema: () => void;
  onOpenCategories?: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onViewChange,
  onOpenNewLog,
  onOpenSchema,
  onOpenCategories,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-neutral-200/80 px-4 py-3 sm:px-6 transition-all shadow-xs">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
        {/* Brand / Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-sm ring-2 ring-blue-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-neutral-900 leading-tight">
              Activity Dashboard
            </h1>
            <p className="text-xs text-neutral-500 font-medium hidden sm:block">
              Daily habit and activity tracker
            </p>
          </div>
        </div>

        {/* Action Controls & Navigation Switcher */}
        <div className="flex items-center gap-2">
          {/* View Toggle Tabs */}
          <div className="flex items-center p-1 bg-neutral-100/90 rounded-xl border border-neutral-200/70 text-xs font-semibold">
            <button
              id="view-tab-dashboard"
              onClick={() => onViewChange('dashboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                currentView === 'dashboard'
                  ? 'bg-white text-neutral-900 shadow-xs font-semibold'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>
            <button
              id="view-tab-reports"
              onClick={() => onViewChange('reports')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                currentView === 'reports'
                  ? 'bg-white text-neutral-900 shadow-xs font-semibold'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Reports</span>
            </button>
          </div>

          {/* Manage Categories Button */}
          {onOpenCategories && (
            <button
              id="btn-open-category-manager"
              onClick={onOpenCategories}
              title="Manage Categories & Custom Icons"
              className="p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl border border-neutral-200/80 transition-colors flex items-center gap-1.5 text-xs font-semibold"
            >
              <Tag className="w-4 h-4 text-purple-600" />
              <span className="hidden sm:inline">Categories</span>
            </button>
          )}

          {/* Quick Add Log Button in Header on Desktop */}
          <button
            id="btn-header-add-log"
            onClick={onOpenNewLog}
            className="hidden md:flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-97 rounded-xl transition-all shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Log</span>
          </button>

          {/* Database Schema & Vercel Code Modal */}
          <button
            id="btn-open-schema-modal"
            onClick={onOpenSchema}
            title="View PostgreSQL Schema & Next.js Setup"
            className="p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl border border-neutral-200/80 transition-colors"
          >
            <Database className="w-4 h-4" />
          </button>

          {/* Lock / Logout Session */}
          {onLogout && (
            <button
              id="btn-lock-session"
              onClick={onLogout}
              title="Lock Dashboard & Sign Out"
              className="p-2 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-xl border border-neutral-200/80 transition-colors"
            >
              <Lock className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

