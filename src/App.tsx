import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { Category, DailyLog } from './types';
import { Header } from './components/Header';
import { DaySelector } from './components/DaySelector';
import { ActivityFeed } from './components/ActivityFeed';
import { LogModal } from './components/LogModal';
import { CategoryManagerModal } from './components/CategoryManagerModal';
import { ReportsView } from './components/ReportsView';
import { PhotoLightbox } from './components/PhotoLightbox';
import { VercelSchemaModal } from './components/VercelSchemaModal';
import { AuthScreen } from './components/AuthScreen';
import { QuickLog } from './components/QuickLog';
import { registerServiceWorker } from './utils/pushNotifications';
import { getTodayLocalDate, getCurrentLocalMonth } from './utils/dateUtils';
import { Plus, Check, AlertCircle, Loader2, Search, X } from 'lucide-react';
import { processSyncQueue, pullFromCloud, setupRealtimeSync } from './syncEngine';
import { resolvePhotoUrl } from './utils/photoUtils';
import { useAuth } from './AuthContext';
import { LoginScreen } from './LoginScreen';
import { OnThisDayView } from './components/OnThisDayView';
import { TechDocsModal } from './components/TechDocsModal';
import { NotificationSettingsModal } from './components/NotificationSettingsModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { BottomNavBar } from './components/BottomNavBar';

const AUTH_TOKEN_KEY = 'accomplishments_auth_token';

function AuthenticatedApp() {
  const { session, signOut } = useAuth();
  
  // Navigation & View State
  const [currentView, setCurrentView] = useState<'dashboard' | 'reports' | 'on-this-day'>(
    window.location.pathname.includes('/on-this-day') ? 'on-this-day' : 'dashboard'
  );
  const [, setForceRender] = useState(0);

  // Authentication State
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem(AUTH_TOKEN_KEY));
  const [isAuthSetup, setIsAuthSetup] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(false);

  // Date States
  const [selectedDate, setSelectedDate] = useState<string>(getTodayLocalDate());
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getCurrentLocalMonth());

  // ==========================================
  // LOCAL-FIRST DATA LAYER (DEXIE)
  // ==========================================
  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  
  const rawCurrentDateLogs = useLiveQuery(
    () => db.dailyLogs.where('log_date').equals(selectedDate).toArray(),
    [selectedDate]
  ) || [];
  
  const rawAllLogs = useLiveQuery(() => db.dailyLogs.toArray()) || [];
  
  // 🚀 THE JOIN: Map the category data and resolve photo URLs onto the logs
  const currentDateLogs = useMemo(() => {
    return rawCurrentDateLogs.map(log => {
      const resolvedPhoto = resolvePhotoUrl(log);
      return {
        ...log,
        photo_url: resolvedPhoto || log.photo_url || null,
        photo_storage_path: log.photo_storage_path || resolvedPhoto || null,
        category: categories.find(c => c.id === log.category_id)
      };
    });
  }, [rawCurrentDateLogs, categories]);

  const allLogs = useMemo(() => {
    return rawAllLogs.map(log => {
      const resolvedPhoto = resolvePhotoUrl(log);
      return {
        ...log,
        photo_url: resolvedPhoto || log.photo_url || null,
        photo_storage_path: log.photo_storage_path || resolvedPhoto || null,
        category: categories.find(c => c.id === log.category_id)
      };
    });
  }, [rawAllLogs, categories]);

  // Modals & UI States
  const [isLogModalOpen, setIsLogModalOpen] = useState<boolean>(false);
  const [editingLog, setEditingLog] = useState<DailyLog | null>(null);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState<boolean>(false);
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState<boolean>(false);
  const [isTechDocsOpen, setIsTechDocsOpen] = useState<boolean>(false);
  const [isNotificationSettingsOpen, setIsNotificationSettingsOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [dashboardSearch, setDashboardSearch] = useState<string>('');
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; title?: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Global keyboard shortcut: Cmd+K / Ctrl+K opens Search Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelectSearchResult = (log: DailyLog) => {
    setIsSearchOpen(false);
    setSelectedDate(log.log_date);
    setCurrentView('dashboard');
    window.history.pushState(null, '', '/');
    setEditingLog(log);
    setIsLogModalOpen(true);
  };

  const filteredCurrentDateLogs = useMemo(() => {
    if (!dashboardSearch.trim()) return currentDateLogs;
    const clean = dashboardSearch.trim().toLowerCase().normalize('NFC');
    return currentDateLogs.filter((log) => {
      const notes = (log.notes || '').toLowerCase().normalize('NFC');
      const catName = (log.category?.name || '').toLowerCase().normalize('NFC');
      return notes.includes(clean) || catName.includes(clean);
    });
  }, [currentDateLogs, dashboardSearch]);

  // PWA Setup
  useEffect(() => {
    registerServiceWorker().then(reg => {
      if (reg) reg.update().catch(err => console.warn('SW update failed:', err));
    }).catch((err) => console.warn('Service worker registration failed:', err));

    const handleMessage = async (event: MessageEvent) => {
      if (event.data && event.data.type === 'NAVIGATE' && event.data.url) {
        window.history.pushState(null, '', event.data.url);
        setForceRender(prev => prev + 1);
      } else if (event.data && event.data.type === 'RECORD_LOG' && event.data.data) {
        try {
          const { log_date, category_id, notes, status } = event.data.data;
          const existing = category_id 
            ? await db.dailyLogs.where({ log_date, category_id }).first()
            : await db.dailyLogs.where({ log_date }).first();
          
          const now = new Date().toISOString();
          const id = existing ? existing.id : (crypto.randomUUID ? crypto.randomUUID() : `log_${Date.now()}`);
          const record: DailyLog = {
            id,
            log_date,
            category_id: category_id || (categories[0]?.id || 'general'),
            notes: notes || '',
            status: status || 'present',
            updated_at: now,
            created_at: existing ? existing.created_at : now,
          };
          await db.dailyLogs.put(record);
          await db.syncQueue.put({
            id,
            table: 'daily_logs',
            action: 'upsert',
            timestamp: Date.now(),
          });
          processSyncQueue();
          showToast('Activity recorded from notification! ✅', 'success');
        } catch (e) {
          console.warn('Failed to record log from notification message:', e);
        }
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', handleMessage);
  }, []);

  // ==========================================
  // SYNC ENGINE & REALTIME LISTENER
  // ==========================================
  useEffect(() => {
    const performFullSync = async () => {
      await pullFromCloud();    // 1. Pull down any new/deleted cloud data
      await processSyncQueue(); // 2. Push up any pending local changes
    };

    // Run immediately on load
    performFullSync();

    // Setup Supabase Realtime channel for instant cross-device updates
    const cleanupRealtime = setupRealtimeSync();

    // Listen for browser coming back online or regaining focus/visibility
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        performFullSync();
      }
    };

    window.addEventListener('online', performFullSync);
    window.addEventListener('focus', performFullSync);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Periodic check to flush unsynced local mutations (zero network egress when queue is empty)
    const queueInterval = setInterval(() => {
      processSyncQueue().catch(console.warn);
    }, 30000);

    return () => {
      cleanupRealtime();
      window.removeEventListener('online', performFullSync);
      window.removeEventListener('focus', performFullSync);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(queueInterval);
    };
  }, []);

  // Network Fetch Wrapper (Legacy fallback for Auth / external endpoints)
  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const headers = new Headers(options.headers || {});
      if (authToken) headers.set('Authorization', `Bearer ${authToken}`);
      const response = await fetch(url, { ...options, headers });
      if (response.status === 401) {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        setAuthToken(null);
        setIsAuthenticated(false);
        if (window.location.pathname !== '/login') {
          window.history.replaceState(null, '', '/login');
          showToast('Session expired or invalid. Please sign in.', 'error');
        }
      }
      return response;
    },
    [authToken]
  );

  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    setSelectedMonth(date.substring(0, 7));
  };

  // ==========================================
  // LOCAL-FIRST MUTATIONS
  // ==========================================

  const handleSaveLog = async (formData: FormData) => {
    try {
      const existingId = formData.get('id') as string | null;
      const category_id = formData.get('category_id') as string;
      const log_date = formData.get('log_date') as string;
      const notes = (formData.get('notes') as string) || '';
      const removePhoto = formData.get('remove_photo') === 'true';
      const keepExistingPhoto = formData.get('keep_existing_photo') === 'true';
      
      // Grab the raw/compressed File object and data URL from the form
      const photoFile = formData.get('photo') as File | null;
      const photoData = formData.get('photo_data') as string | null;
      
      const logId = existingId || crypto.randomUUID();
      const existing = existingId ? await db.dailyLogs.get(existingId) : null;
      const now = new Date().toISOString();

      let resolvedPhotoUrl = photoData || null;
      let resolvedPhotoData = photoData || null;
      let resolvedPhotoStoragePath = null;

      if (removePhoto) {
        resolvedPhotoUrl = null;
        resolvedPhotoData = null;
        resolvedPhotoStoragePath = null;
      } else if (keepExistingPhoto && existing) {
        resolvedPhotoUrl = existing.photo_url || null;
        resolvedPhotoData = existing.photo_data || null;
        resolvedPhotoStoragePath = existing.photo_storage_path || null;
      }
      
      await db.transaction('rw', db.dailyLogs, db.syncQueue, async () => {
        await db.dailyLogs.put({
          id: logId,
          log_date,
          category_id,
          notes,
          status: existing?.status || 'present',
          photo_url: resolvedPhotoUrl,
          photo_data: resolvedPhotoData,
          photo_storage_path: resolvedPhotoStoragePath,
          local_photo: photoFile || (keepExistingPhoto && existing?.local_photo ? existing.local_photo : undefined),
          created_at: existing ? existing.created_at : now,
          updated_at: now,
        });
        
        await db.syncQueue.put({ id: logId, table: 'daily_logs', action: 'upsert', timestamp: Date.now() });
      });

      setIsLogModalOpen(false);
      setEditingLog(null);
      showToast(existingId ? 'Activity log updated! ✅' : 'Activity log & photo saved locally!');
      // Kick off background sync immediately to upload photo & push to Supabase
      processSyncQueue().catch(e => console.warn('Background sync failed:', e));
    } catch (err) {
      console.error(err);
      showToast('Failed to save log', 'error');
    }
  };

  const handleAddCategory = async (newCat: {
    name: string;
    color_code: string;
    icon: string;
    reminder_time?: string | null;
    is_on_this_day?: boolean;
  }) => {
    try {
      const newId = crypto.randomUUID();
      const categoryToSave = { ...newCat, id: newId, is_active: true } as Category;
      
      await db.transaction('rw', db.categories, db.syncQueue, async () => {
        await db.categories.put(categoryToSave);
        await db.syncQueue.put({ id: newId, table: 'categories', action: 'upsert', timestamp: Date.now() });
      });
      
      showToast(`Category "${newCat.name}" created!`);
      processSyncQueue().catch(e => console.warn('Background sync failed:', e));
      return categoryToSave;
    } catch (err) {
      console.error(err);
      throw new Error('Failed to create category');
    }
  };

  const handleUpdateCategory = async (id: string, updates: Partial<Category>) => {
    try {
      let updatedCat: Category | undefined;
      
      await db.transaction('rw', db.categories, db.syncQueue, async () => {
        const existing = await db.categories.get(id);
        if (!existing) throw new Error('Category not found');
        
        updatedCat = { ...existing, ...updates };
        await db.categories.put(updatedCat);
        await db.syncQueue.put({ id, table: 'categories', action: 'upsert', timestamp: Date.now() });
      });
      
      showToast(`Category updated!`);
      processSyncQueue().catch(e => console.warn('Background sync failed:', e));
      return updatedCat as Category;
    } catch (err) {
      console.error(err);
      throw new Error('Failed to update category');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await db.transaction('rw', db.categories, db.dailyLogs, db.syncQueue, async () => {
        await db.categories.delete(id);
        await db.syncQueue.put({ id, table: 'categories', action: 'delete', timestamp: Date.now() });

        const logsToDelete = await db.dailyLogs.where('category_id').equals(id).toArray();
        const logIds = logsToDelete.map(l => l.id);
        
        if (logIds.length > 0) {
          await db.dailyLogs.bulkDelete(logIds);
          for (const logId of logIds) {
            await db.syncQueue.put({ id: logId, table: 'daily_logs', action: 'delete', timestamp: Date.now() });
          }
        }
      });
      
      showToast('Category and associated logs deleted');
      processSyncQueue().catch(e => console.warn('Background sync failed:', e));
    } catch (err) {
      console.error(err);
      showToast('Failed to delete category', 'error');
    }
  };

  const handleDeleteLog = async (id: string) => {
    try {
      await db.transaction('rw', db.dailyLogs, db.syncQueue, async () => {
        await db.dailyLogs.delete(id);
        await db.syncQueue.put({ id, table: 'daily_logs', action: 'delete', timestamp: Date.now() });
      });
      showToast('Activity log deleted');
      processSyncQueue().catch(e => console.warn('Background sync failed:', e));
    } catch (err) {
      console.error(err);
      showToast('Failed to delete activity log', 'error');
    }
  };

  // Auth Handlers (Legacy)
  const handleAuthenticated = (token: string) => {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    document.cookie = `session_token=${token}; path=/; max-age=604800; SameSite=Lax`;
    setAuthToken(token);
    setIsAuthenticated(true);
    setIsAuthSetup(true);
    window.history.replaceState(null, '', '/');
    showToast('Authenticated successfully');
  };

  const handleLogout = async () => {
    try { await authFetch('/api/auth/logout', { method: 'POST' }); } catch (e) {}
    localStorage.removeItem(AUTH_TOKEN_KEY);
    document.cookie = 'session_token=; path=/; max-age=0; SameSite=Lax';
    setAuthToken(null);
    setIsAuthenticated(false);
    window.history.replaceState(null, '', '/login');
    showToast('Dashboard locked');
  };

  const logCountsByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const log of allLogs) {
      counts[log.log_date] = (counts[log.log_date] || 0) + 1;
    }
    return counts;
  }, [allLogs]);

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
        <p className="text-xs font-semibold text-neutral-400">Verifying security credentials...</p>
      </div>
    );
  }

  if (window.location.pathname.replace(/\/$/, '') === '/quick-log') {
    const params = new URLSearchParams(window.location.search);
    const quickLogCategoryId = params.get('category_id');
    
    if (quickLogCategoryId) {
      return (
        <QuickLog
          categoryId={quickLogCategoryId}
          onClose={() => {
            setForceRender(prev => prev + 1);
          }}
        />
      );
    } else {
      window.history.replaceState(null, '', '/');
      setForceRender(prev => prev + 1);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/40 to-indigo-50/50 text-neutral-900 flex flex-col font-sans selection:bg-blue-500 selection:text-white pb-24 md:pb-12 relative overflow-x-hidden">
      <div className="fixed top-[-80px] left-[-80px] w-96 h-96 bg-blue-300/25 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed top-1/3 right-[-100px] w-[28rem] h-[28rem] bg-indigo-300/20 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-[-60px] left-1/4 w-96 h-96 bg-sky-200/25 rounded-full blur-3xl pointer-events-none -z-10" />

      <Header
        currentView={currentView}
        onViewChange={setCurrentView}
        onOpenNewLog={() => {
          setEditingLog(null);
          setIsLogModalOpen(true);
        }}
        onOpenSchema={() => setIsSchemaModalOpen(true)}
        onOpenCategories={() => setIsCategoryManagerOpen(true)}
        onOpenTechDocs={() => setIsTechDocsOpen(true)}
        onOpenNotificationSettings={() => setIsNotificationSettingsOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
        onLogout={handleLogout}
        authToken={authToken}
        onToast={showToast}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-4 sm:px-6 space-y-4">
        {currentView === 'on-this-day' ? (
          <OnThisDayView onBack={() => {
            setCurrentView('dashboard');
            window.history.pushState(null, '', '/');
          }} />
        ) : currentView === 'dashboard' ? (
          <div className="space-y-4">
            {/* Quick Filter Bar */}
            <div className="flex items-center gap-2 px-3.5 py-2 bg-white/70 backdrop-blur-md rounded-2xl border border-white/80 shadow-xs">
              <Search className="w-4 h-4 text-blue-500 shrink-0" />
              <input
                id="input-dashboard-quick-filter"
                type="text"
                value={dashboardSearch}
                onChange={(e) => setDashboardSearch(e.target.value)}
                placeholder="Filter today's logs..."
                className="w-full bg-transparent text-xs font-semibold text-neutral-800 placeholder:text-neutral-400 focus:outline-none"
              />
              {dashboardSearch && (
                <button
                  type="button"
                  id="btn-clear-dashboard-filter"
                  onClick={() => setDashboardSearch('')}
                  className="p-1 text-neutral-400 hover:text-neutral-700 rounded-full cursor-pointer"
                  title="Clear filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                id="btn-open-global-search-dashboard"
                onClick={() => setIsSearchOpen(true)}
                className="px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors border border-blue-200/60 shrink-0 flex items-center gap-1.5 cursor-pointer"
              >
                <span>Search All</span>
                <kbd className="hidden sm:inline font-mono text-[10px] text-blue-500 bg-white px-1 py-0.5 rounded border border-blue-200 shadow-2xs">
                  ⌘K
                </kbd>
              </button>
            </div>

            <DaySelector
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              logCountsByDate={logCountsByDate}
            />
            <ActivityFeed
              logs={filteredCurrentDateLogs}
              isLoading={false}
              selectedDate={selectedDate}
              onOpenNewLog={() => {
                setEditingLog(null);
                setIsLogModalOpen(true);
              }}
              onEditLog={(log) => {
                setEditingLog(log);
                setIsLogModalOpen(true);
              }}
              onDeleteLog={handleDeleteLog}
              onViewPhoto={(url, title) => setLightboxPhoto({ url, title })}
            />
          </div>
        ) : (
          <ReportsView
            logs={allLogs}
            categories={categories}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            isLoading={false}
          />
        )}
      </main>

      {/* Desktop Floating Action Button (Mobile uses sleek center button in BottomNavBar) */}
      <div className="hidden md:flex fixed bottom-6 right-6 z-30">
        <button
          id="btn-fab-add-log"
          onClick={() => {
            setEditingLog(null);
            setIsLogModalOpen(true);
          }}
          className="w-14 h-14 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-full shadow-lg shadow-blue-600/30 flex items-center justify-center transition-all group focus:outline-none focus:ring-4 focus:ring-blue-500/30 cursor-pointer"
        >
          <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-200" />
        </button>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <BottomNavBar
        currentView={currentView}
        onViewChange={(v) => {
          setCurrentView(v);
          if (v === 'on-this-day') {
            window.history.pushState(null, '', '/on-this-day');
          } else if (v === 'dashboard') {
            window.history.pushState(null, '', '/');
          }
        }}
        onOpenNewLog={() => {
          setEditingLog(null);
          setIsLogModalOpen(true);
        }}
        onOpenSearch={() => setIsSearchOpen(true)}
      />

      <LogModal
        isOpen={isLogModalOpen}
        onClose={() => {
          setIsLogModalOpen(false);
          setEditingLog(null);
        }}
        categories={categories}
        selectedDate={selectedDate}
        editingLog={editingLog}
        onSaveLog={handleSaveLog}
        onAddCategory={handleAddCategory}
        onDeleteCategory={handleDeleteCategory}
        onOpenCategoryManager={() => {
          setIsLogModalOpen(false);
          setIsCategoryManagerOpen(true);
        }}
      />

      <CategoryManagerModal
        isOpen={isCategoryManagerOpen}
        onClose={() => setIsCategoryManagerOpen(false)}
        categories={categories}
        onAddCategory={handleAddCategory}
        onUpdateCategory={handleUpdateCategory}
        onDeleteCategory={handleDeleteCategory}
      />

      <PhotoLightbox
        url={lightboxPhoto?.url || null}
        title={lightboxPhoto?.title}
        onClose={() => setLightboxPhoto(null)}
      />

      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        logs={allLogs}
        categories={categories}
        onSelectLog={handleSelectSearchResult}
        onViewPhoto={(url, title) => setLightboxPhoto({ url, title })}
      />

      <VercelSchemaModal isOpen={isSchemaModalOpen} onClose={() => setIsSchemaModalOpen(false)} />

      <TechDocsModal isOpen={isTechDocsOpen} onClose={() => setIsTechDocsOpen(false)} />

      <NotificationSettingsModal
        isOpen={isNotificationSettingsOpen}
        onClose={() => setIsNotificationSettingsOpen(false)}
        authToken={authToken}
      />

      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-xl border text-xs font-semibold backdrop-blur-md ${toastMessage.type === 'success' ? 'bg-neutral-900/90 text-white border-neutral-800' : 'bg-red-900/90 text-white border-red-800'}`}>
            {toastMessage.type === 'success' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <AlertCircle className="w-3.5 h-3.5 text-red-400" />}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const { session } = useAuth();
  if (!session) {
    return <LoginScreen />;
  }
  return <AuthenticatedApp />;
}