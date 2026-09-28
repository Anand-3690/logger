import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BarChart3,
  Bell,
  BellOff,
  Database,
  FileText,
  History,
  LayoutDashboard,
  Lock,
  MoreHorizontal,
  Plus,
  Search,
  Tag,
  type LucideIcon,
} from 'lucide-react';

export type Route = 'dashboard' | 'reports' | 'on-this-day';

type Props = {
  route: Route;
  onNavigate: (route: Route) => void;
  onNewLog: () => void;
  onSearch: () => void;
  onOpenCategories: () => void;
  onToggleNotifications: () => void;
  onOpenNotificationSettings?: () => void;
  onExportSpec: () => void;
  onOpenData: () => void;
  onLock: () => void;
  notificationsOn: boolean;
};

const PRIMARY: { id: Route; label: string; Icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'reports', label: 'Reports', Icon: BarChart3 },
  { id: 'on-this-day', label: 'On this day', Icon: History },
];

export function AppNav(p: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the overflow menu on outside click or Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const run = (fn: () => void) => () => {
    setMenuOpen(false);
    fn();
  };

  return (
    <>
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-2 px-4 sm:px-6">
          <div className="mr-auto min-w-0">
            <h1 className="truncate text-base font-bold leading-tight text-slate-900">
              Activity Dashboard
            </h1>
            <p className="hidden truncate text-xs font-medium text-slate-600 sm:block">
              Daily habit and activity tracker
            </p>
          </div>

          {/* Desktop Primary Nav */}
          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {PRIMARY.map(({ id, label, Icon }) => {
              const active = p.route === id;
              return (
                <button
                  key={id}
                  id={`nav-link-${id}`}
                  onClick={() => p.onNavigate(id)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 cursor-pointer ${
                    active
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon size={16} aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </nav>

          {/* Search Button */}
          <button
            id="btn-nav-search"
            onClick={p.onSearch}
            aria-label="Search all logs (Ctrl+K)"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 cursor-pointer"
          >
            <Search size={18} aria-hidden="true" />
          </button>

          {/* Desktop New Log Button */}
          <button
            id="btn-nav-new-log"
            onClick={p.onNewLog}
            className="hidden h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 active:scale-97 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 cursor-pointer md:flex"
          >
            <Plus size={16} aria-hidden="true" />
            New log
          </button>

          {/* Overflow Menu */}
          <div ref={menuRef} className="relative">
            <button
              id="btn-nav-more-menu"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="More"
              className="relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 cursor-pointer"
            >
              <MoreHorizontal size={18} aria-hidden="true" />
              {p.notificationsOn && (
                <span
                  title="Notifications are active"
                  className="absolute right-2 top-2 h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white"
                />
              )}
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  id="menu-more-options"
                  role="menu"
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.14 }}
                  className="absolute right-0 top-12 z-50 w-64 origin-top-right rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 shadow-xl backdrop-blur-xl"
                >
                  <MenuItem
                    Icon={Tag}
                    label="Categories and reminders"
                    onClick={run(p.onOpenCategories)}
                  />
                  <MenuItem
                    Icon={p.notificationsOn ? Bell : BellOff}
                    label="Notifications"
                    trailing={p.notificationsOn ? 'On' : 'Off'}
                    onClick={run(p.onToggleNotifications)}
                    onTrailingClick={
                      p.onOpenNotificationSettings
                        ? (e) => {
                            e.stopPropagation();
                            run(p.onOpenNotificationSettings!)();
                          }
                        : undefined
                    }
                  />
                  <MenuItem
                    Icon={FileText}
                    label="Export tech spec (PDF)"
                    onClick={run(p.onExportSpec)}
                  />
                  <MenuItem
                    Icon={Database}
                    label="Backup and data"
                    onClick={run(p.onOpenData)}
                  />
                  <div className="my-1 h-px bg-slate-100" />
                  <MenuItem Icon={Lock} label="Lock app" onClick={run(p.onLock)} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Tab Bar */}
      <nav
        id="mobile-bottom-nav"
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/90 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.04)]"
      >
        <div className="mx-auto grid max-w-md grid-cols-4 items-center">
          <Tab
            id="tab-mobile-dashboard"
            label="Dashboard"
            Icon={LayoutDashboard}
            active={p.route === 'dashboard'}
            onClick={() => p.onNavigate('dashboard')}
          />
          <Tab
            id="tab-mobile-reports"
            label="Reports"
            Icon={BarChart3}
            active={p.route === 'reports'}
            onClick={() => p.onNavigate('reports')}
          />
          <Tab
            id="tab-mobile-on-this-day"
            label="On this day"
            Icon={History}
            active={p.route === 'on-this-day'}
            onClick={() => p.onNavigate('on-this-day')}
          />
          <button
            id="btn-mobile-new-log"
            onClick={p.onNewLog}
            className="flex min-h-[48px] flex-col items-center justify-center gap-1 py-1.5 text-xs font-semibold text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600 cursor-pointer"
          >
            <span className="flex h-7 w-11 items-center justify-center rounded-full bg-blue-600 text-white shadow-xs active:scale-95 transition-transform">
              <Plus size={18} aria-hidden="true" />
            </span>
            New log
          </button>
        </div>
      </nav>
    </>
  );
}

function Tab({
  id,
  label,
  Icon,
  active,
  onClick,
}: {
  id: string;
  label: string;
  Icon: LucideIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      id={id}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex min-h-[48px] flex-col items-center justify-center gap-1 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 cursor-pointer ${
        active ? 'text-blue-700' : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      <Icon size={20} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

function MenuItem({
  Icon,
  label,
  trailing,
  onClick,
  onTrailingClick,
}: {
  Icon: LucideIcon;
  label: string;
  trailing?: string;
  onClick: () => void;
  onTrailingClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-800 hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600 cursor-pointer transition-colors"
    >
      <Icon size={16} className="text-slate-600" aria-hidden="true" />
      <span className="flex-1">{label}</span>
      {trailing && (
        <span
          onClick={onTrailingClick}
          title={onTrailingClick ? 'Configure notification settings' : undefined}
          className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${
            trailing === 'On'
              ? 'bg-blue-50 text-blue-700'
              : 'bg-slate-100 text-slate-600'
          } ${onTrailingClick ? 'hover:ring-1 hover:ring-blue-400' : ''}`}
        >
          {trailing}
        </span>
      )}
    </button>
  );
}

export default AppNav;

