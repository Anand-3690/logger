import React from 'react';
import { Calendar, BarChart3, Database, Sparkles, Plus, Tag, Lock, FileText } from 'lucide-react';
import { NotificationToggle } from './NotificationToggle';

interface HeaderProps {
  currentView: 'dashboard' | 'reports';
  onViewChange: (view: 'dashboard' | 'reports') => void;
  onOpenNewLog: () => void;
  onOpenSchema: () => void;
  onOpenCategories?: () => void;
  onOpenTechDocs?: () => void;
  onLogout?: () => void;
  authToken?: string | null;
  onToast?: (message: string, type: 'success' | 'error') => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onViewChange,
  onOpenNewLog,
  onOpenSchema,
  onOpenCategories,
  onOpenTechDocs,
  onLogout,
  authToken,
  onToast,
}) => {
  return (
    <header className="sticky top-0 z-30 glass-header px-4 py-3 sm:px-6 transition-all shadow-xs">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
        {/* Brand / Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600/90 to-indigo-600/90 flex items-center justify-center text-white shadow-md shadow-blue-500/20 ring-2 ring-white/60">
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
          <div className="flex items-center p-1 bg-white/60 backdrop-blur-md rounded-xl border border-white/80 shadow-xs text-xs font-semibold">
            <button
              id="view-tab-dashboard"
              onClick={() => onViewChange('dashboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                currentView === 'dashboard'
                  ? 'bg-white/90 text-blue-700 shadow-xs font-bold border border-white/90'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/40'
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
                  ? 'bg-white/90 text-blue-700 shadow-xs font-bold border border-white/90'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-white/40'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Reports</span>
            </button>
          </div>

          {/* Compact Notification Toggle */}
          <NotificationToggle authToken={authToken} onToast={onToast} />

          {/* Manage Categories Button */}
          {onOpenCategories && (
            <button
              id="btn-open-category-manager"
              onClick={onOpenCategories}
              title="Manage Categories & Custom Icons"
              className="p-2 text-neutral-700 hover:text-neutral-900 bg-white/60 hover:bg-white/90 backdrop-blur-md rounded-xl border border-white/80 shadow-xs transition-colors flex items-center gap-1.5 text-xs font-semibold"
            >
              <Tag className="w-4 h-4 text-purple-600" />
              <span className="hidden sm:inline">Categories</span>
            </button>
          )}

          {/* Quick Add Log Button in Header on Desktop */}
          <button
            id="btn-header-add-log"
            onClick={onOpenNewLog}
            className="hidden md:flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600/90 hover:bg-blue-600 backdrop-blur-xs active:scale-97 rounded-xl transition-all shadow-sm shadow-blue-600/30 border border-blue-400/40"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Log</span>
          </button>

          {/* Technical Architecture & Specification PDF Modal */}
          {onOpenTechDocs && (
            <button
              id="btn-open-tech-docs"
              onClick={onOpenTechDocs}
              title="View Technical Specification & Export PDF"
              className="p-2 text-neutral-700 hover:text-blue-700 bg-white/60 hover:bg-white/90 backdrop-blur-md rounded-xl border border-white/80 shadow-xs transition-colors flex items-center gap-1.5 text-xs font-semibold"
            >
              <FileText className="w-4 h-4 text-blue-600" />
              <span className="hidden lg:inline text-neutral-700">Tech Spec PDF</span>
            </button>
          )}

          {/* Database Schema & Vercel Code Modal */}
          <button
            id="btn-open-schema-modal"
            onClick={onOpenSchema}
            title="View PostgreSQL Schema & Next.js Setup"
            className="p-2 text-neutral-700 hover:text-neutral-900 bg-white/60 hover:bg-white/90 backdrop-blur-md rounded-xl border border-white/80 shadow-xs transition-colors"
          >
            <Database className="w-4 h-4" />
          </button>

          {/* Lock / Logout Session */}
          {onLogout && (
            <button
              id="btn-lock-session"
              onClick={onLogout}
              title="Lock Dashboard & Sign Out"
              className="p-2 text-neutral-500 hover:text-red-600 bg-white/60 hover:bg-red-50/80 backdrop-blur-md rounded-xl border border-white/80 shadow-xs transition-colors"
            >
              <Lock className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

