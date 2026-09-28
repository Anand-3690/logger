import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { Category, DailyLog } from './types';
import { AppNav } from './components/AppNav';
import { DaySelector, DayCategoryDot } from './components/DaySelector';
import { ActivityFeed } from './components/ActivityFeed';
import { LogModal } from './components/LogModal';
import { CategoryManagerModal } from './components/CategoryManagerModal';
import { ReportsView } from './components/ReportsView';
import { PhotoLightbox } from './components/PhotoLightbox';
import { VercelSchemaModal } from './components/VercelSchemaModal';
import { AuthScreen } from './components/AuthScreen';
import { QuickLog } from './components/QuickLog';
import { resolveMigratedIcon } from './components/CategoryIcon';
import {
  registerServiceWorker,
  checkAndTriggerDailyOnThisDay,
  getPushNotificationStatus,
  subscribeToWebPush,
  unsubscribeFromWebPush,
} from './utils/pushNotifications';
import { getTodayLocalDate, getCurrentLocalMonth, parseLocalDate, formatLocalDate } from './utils/dateUtils';
import {
  getTodayLogicalDate,
  getDayCutoffHour,
  getUserTimezone,
  computeLogicalDate,
  getEffectiveLogDate,
  backfillExistingLogs,
} from './utils/dayBoundary';
import { Check, AlertCircle, Loader2 } from 'lucide-react';
import { processSyncQueue, pullFromCloud, setupRealtimeSync } from './syncEngine';
import { resolvePhotoUrl } from './utils/photoUtils';
import { useAuth } from './AuthContext';
import { LoginScreen } from './LoginScreen';
import { OnThisDayView } from './components/OnThisDayView';
import { TechDocsModal } from './components/TechDocsModal';
import { NotificationSettingsModal } from './components/NotificationSettingsModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';

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

  // Day Cutoff & Date States
  const [dayCutoffHour, setDayCutoffHour] = useState<number>(() => getDayCutoffHour());
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayLogicalDate());
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getCurrentLocalMonth());
  const [preselectedCategoryId, setPreselectedCategoryId] = useState<string | null>(null);
  const [preselectedNotes, setPreselectedNotes] = useState<string | null>(null);

  const handleAddReflection = (log: DailyLog) => {
    const todayLogical = getTodayLogicalDate(dayCutoffHour);
    setSelectedDate(todayLogical);
    setPreselectedCategoryId(log.category_id);
    const firstLine = (log.notes || '').split('\n')[0].trim().slice(0, 100);
    const quote = firstLine ? `> "${firstLine}"\n\n` : '';
    setPreselectedNotes(quote);
    setEditingLog(null);
    setIsLogModalOpen(true);
  };

  // Sync day cutoff from settings events
  useEffect(() => {
    const handleSettingsChanged = () => {
      setDayCutoffHour(getDayCutoffHour());
    };
    window.addEventListener('activity_settings_changed', handleSettingsChanged);
    return () => window.removeEventListener('activity_settings_changed', handleSettingsChanged);
  }, []);

  // Backfill existing logs once to safely populate logical_date
  useEffect(() => {
    backfillExistingLogs(db).catch((e) => console.warn('Backfill note:', e));
  }, []);

  // ==========================================
  // LOCAL-FIRST DATA LAYER (DEXIE)
  // ==========================================
  const rawCategories = useLiveQuery(() => db.categories.toArray()) || [];
  const categories = useMemo(() => {
    return [...rawCategories].sort((a, b) => {
      const orderA = a.sort_order ?? 999999;
      const orderB = b.sort_order ?? 999999;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });
  }, [rawCategories]);
  
  const rawCurrentDateLogs = useLiveQuery(
    async () => {
      const withLogical = await db.dailyLogs.where('logical_date').equals(selectedDate).toArray();
      const fallback = await db.dailyLogs.where('log_date').equals(selectedDate).toArray();
      const map = new Map<string, DailyLog>();
      for (const log of withLogical) map.set(log.id, log);
      for (const log of fallback) {
        if ((log.logical_date || log.log_date) === selectedDate && !map.has(log.id)) {
          map.set(log.id, log);
        }
      }
      return Array.from(map.values());
    },
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

  // Push Notification State for AppNav indicator & toggle
  const [notificationsOn, setNotificationsOn] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted' &&
      localStorage.getItem('accomplishments_notifications_enabled') === 'true'
    );
  });

  const checkNotificationsStatus = useCallback(async () => {
    try {
      const status = await getPushNotificationStatus();
      setNotificationsOn(status.isSubscribed);
    } catch (e) {
      console.warn('Failed to query push status:', e);
    }
  }, []);

  useEffect(() => {
    checkNotificationsStatus();
  }, [checkNotificationsStatus]);

  const handleToggleNotifications = async () => {
    try {
      const status = await getPushNotificationStatus();
      if (status.permission === 'denied') {
        setIsNotificationSettingsOpen(true);
        showToast('Notifications are blocked in browser settings', 'error');
        return;
      }
      if (notificationsOn) {
        await unsubscribeFromWebPush(authToken);
        setNotificationsOn(false);
        showToast('Notifications turned off', 'success');
      } else {
        await subscribeToWebPush(authToken);
        const updated = await getPushNotificationStatus();
        setNotificationsOn(updated.isSubscribed);
        if (updated.isSubscribed) {
          showToast('Notifications turned on! Reminders are active', 'success');
        }
      }
    } catch (err: any) {
      console.warn('Failed to toggle notifications:', err);
      setIsNotificationSettingsOpen(true);
      showToast(err?.message || 'Failed to update notification settings', 'error');
    }
  };

  // PWA Setup
  useEffect(() => {
    registerServiceWorker()
      .then((reg) => {
        if (reg) reg.update().catch((err) => console.warn('SW update failed:', err));
        // Check for On This Day memories once per day when app opens
        checkAndTriggerDailyOnThisDay().catch((err) =>
          console.warn('On This Day check note:', err)
        );
      })
      .catch((err) => console.warn('Service worker registration failed:', err));

    const handlePopState = () => {
      if (window.location.pathname.includes('/on-this-day')) {
        setCurrentView('on-this-day');
      } else if (window.location.pathname.includes('/reports')) {
        setCurrentView('reports');
      } else {
        setCurrentView('dashboard');
      }
    };
    window.addEventListener('popstate', handlePopState);

    const handleMessage = async (event: MessageEvent) => {
      if (event.data && event.data.type === 'NAVIGATE' && event.data.url) {
        window.history.pushState(null, '', event.data.url);
        if (event.data.url.includes('/on-this-day')) {
          setCurrentView('on-this-day');
        } else if (event.data.url.includes('/reports')) {
          setCurrentView('reports');
        } else {
          setCurrentView('dashboard');
        }
        setForceRender((prev) => prev + 1);
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
    return () => {
      window.removeEventListener('popstate', handlePopState);
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
    };
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
      const cutoff = getDayCutoffHour();
      const tz = getUserTimezone();
      const todayLogical = getTodayLogicalDate(cutoff, tz);

      let computedLogicalDate: string;
      if (existing) {
        if (log_date === existing.log_date && existing.logical_date) {
          computedLogicalDate = existing.logical_date;
        } else {
          computedLogicalDate = log_date;
        }
      } else {
        if (log_date === todayLogical) {
          computedLogicalDate = computeLogicalDate(now, cutoff, tz, log_date);
        } else {
          computedLogicalDate = log_date;
        }
      }

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
          logical_date: computedLogicalDate,
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

  const handleReorderCategories = async (reordered: Category[]) => {
    try {
      await db.transaction('rw', db.categories, db.syncQueue, async () => {
        for (let i = 0; i < reordered.length; i++) {
          const cat = reordered[i];
          const updated = { ...cat, sort_order: i };
          await db.categories.put(updated);
          await db.syncQueue.put({ id: cat.id, table: 'categories', action: 'upsert', timestamp: Date.now() });
        }
      });
      processSyncQueue().catch((e) => console.warn('Background sync failed:', e));
    } catch (err) {
      console.error('Failed to reorder categories:', err);
    }
  };

  // Safe one-time Lucide line icon migration for legacy emoji icons
  useEffect(() => {
    const migrateLegacyIcons = async () => {
      try {
        const allCats = await db.categories.toArray();
        let updatedCount = 0;
        await db.transaction('rw', db.categories, db.syncQueue, async () => {
          for (const cat of allCats) {
            const migrated = resolveMigratedIcon(cat.icon, cat.name);
            if (migrated !== cat.icon) {
              const updated = { ...cat, icon: migrated };
              await db.categories.put(updated);
              await db.syncQueue.put({ id: cat.id, table: 'categories', action: 'upsert', timestamp: Date.now() });
              updatedCount++;
            }
          }
        });
        if (updatedCount > 0) {
          processSyncQueue().catch((e) => console.warn('Background sync failed:', e));
        }
      } catch (err) {
        console.warn('Icon migration check:', err);
      }
    };
    migrateLegacyIcons();
  }, []);

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
      const eff = getEffectiveLogDate(log);
      if (eff) {
        counts[eff] = (counts[eff] || 0) + 1;
      }
    }
    return counts;
  }, [allLogs]);

  const dayCategoriesByDate = useMemo(() => {
    const map: Record<string, DayCategoryDot[]> = {};
    for (const log of allLogs) {
      const effDate = getEffectiveLogDate(log);
      if (!effDate) continue;
      if (!map[effDate]) map[effDate] = [];
      if (log.category && !map[effDate].some((c) => c.id === log.category!.id)) {
        map[effDate].push({
          id: log.category.id,
          name: log.category.name,
          color_code: log.category.color_code || '#3b82f6',
        });
      }
    }
    return map;
  }, [allLogs]);

  const topCategoriesLast60Days = useMemo(() => {
    const today = getTodayLogicalDate(dayCutoffHour);
    const d = parseLocalDate(today);
    d.setDate(d.getDate() - 60);
    const sixtyDaysAgo = formatLocalDate(d);

    const catCounts: Record<string, number> = {};
    for (const log of allLogs) {
      const effDate = getEffectiveLogDate(log);
      if (effDate >= sixtyDaysAgo && effDate <= today && log.category_id) {
        catCounts[log.category_id] = (catCounts[log.category_id] || 0) + 1;
      }
    }

    const activeCategories = categories.filter((c) => c.is_active !== false);
    return activeCategories
      .sort((a, b) => (catCounts[b.id] || 0) - (catCounts[a.id] || 0))
      .slice(0, 4);
  }, [allLogs, categories, dayCutoffHour]);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/40 to-indigo-50/50 text-neutral-900 flex flex-col font-sans selection:bg-blue-500 selection:text-white pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-12 relative overflow-x-hidden">
      <div className="fixed top-[-80px] left-[-80px] w-96 h-96 bg-blue-300/25 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed top-1/3 right-[-100px] w-[28rem] h-[28rem] bg-indigo-300/20 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-[-60px] left-1/4 w-96 h-96 bg-sky-200/25 rounded-full blur-3xl pointer-events-none -z-10" />

      <AppNav
        route={currentView}
        onNavigate={(route) => {
          setCurrentView(route);
          if (route === 'on-this-day') {
            window.history.pushState(null, '', '/on-this-day');
          } else if (route === 'reports') {
            window.history.pushState(null, '', '/reports');
          } else {
            window.history.pushState(null, '', '/');
          }
        }}
        onNewLog={() => {
          setEditingLog(null);
          setPreselectedCategoryId(null);
          setPreselectedNotes(null);
          setIsLogModalOpen(true);
        }}
        onSearch={() => setIsSearchOpen(true)}
        onOpenCategories={() => setIsCategoryManagerOpen(true)}
        onToggleNotifications={handleToggleNotifications}
        onOpenNotificationSettings={() => setIsNotificationSettingsOpen(true)}
        onExportSpec={() => setIsTechDocsOpen(true)}
        onOpenData={() => setIsSchemaModalOpen(true)}
        onLock={handleLogout}
        notificationsOn={notificationsOn}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-4 sm:px-6 space-y-4">
        {currentView === 'on-this-day' ? (
          <OnThisDayView
            onBack={() => {
              setCurrentView('dashboard');
              window.history.pushState(null, '', '/');
            }}
            onAddReflection={handleAddReflection}
          />
        ) : currentView === 'dashboard' ? (
          <div className="space-y-4">
            <DaySelector
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              logCountsByDate={logCountsByDate}
              dayCategoriesByDate={dayCategoriesByDate}
              todayDate={getTodayLogicalDate(dayCutoffHour)}
              dayCutoffHour={dayCutoffHour}
            />
            <ActivityFeed
              logs={currentDateLogs}
              isLoading={false}
              selectedDate={selectedDate}
              topCategories={topCategoriesLast60Days}
              dayCutoffHour={dayCutoffHour}
              onOpenNewLog={(catId) => {
                setEditingLog(null);
                setPreselectedCategoryId(catId || null);
                setPreselectedNotes(null);
                setIsLogModalOpen(true);
              }}
              onEditLog={(log) => {
                setEditingLog(log);
                setPreselectedCategoryId(log.category_id);
                setPreselectedNotes(null);
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

      <LogModal
        isOpen={isLogModalOpen}
        onClose={() => {
          setIsLogModalOpen(false);
          setEditingLog(null);
          setPreselectedCategoryId(null);
          setPreselectedNotes(null);
        }}
        categories={
          editingLog
            ? categories.filter((c) => c.is_active !== false || c.id === editingLog.category_id)
            : categories.filter((c) => c.is_active !== false)
        }
        selectedDate={selectedDate}
        editingLog={editingLog}
        defaultCategoryId={preselectedCategoryId}
        defaultNotes={preselectedNotes}
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
        logs={allLogs}
        onAddCategory={handleAddCategory}
        onUpdateCategory={handleUpdateCategory}
        onDeleteCategory={handleDeleteCategory}
        onReorderCategories={handleReorderCategories}
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
        todayDate={getTodayLogicalDate(dayCutoffHour)}
      />

      <VercelSchemaModal isOpen={isSchemaModalOpen} onClose={() => setIsSchemaModalOpen(false)} />

      <TechDocsModal isOpen={isTechDocsOpen} onClose={() => setIsTechDocsOpen(false)} />

      <NotificationSettingsModal
        isOpen={isNotificationSettingsOpen}
        onClose={() => {
          setIsNotificationSettingsOpen(false);
          checkNotificationsStatus();
        }}
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