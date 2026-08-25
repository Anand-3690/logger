import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { NotificationSettingsCard } from './components/NotificationSettingsCard';
import { QuickLog } from './components/QuickLog';
import { registerServiceWorker } from './utils/pushNotifications';
import { Plus, Check, AlertCircle, Loader2 } from 'lucide-react';

const AUTH_TOKEN_KEY = 'accomplishments_auth_token';

export default function App() {
  // Navigation & View State
  const [currentView, setCurrentView] = useState<'dashboard' | 'reports'>('dashboard');
  const [, setForceRender] = useState(0);

  // Authentication State
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  });
  const [isAuthSetup, setIsAuthSetup] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);

  // Default to today's date in local time or ISO format (e.g. 2026-08-24)
  const todayStr = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedMonth, setSelectedMonth] = useState<string>(todayStr.substring(0, 7));

  // Data States
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentDateLogs, setCurrentDateLogs] = useState<DailyLog[]>([]);
  const [allLogs, setAllLogs] = useState<DailyLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(true);
  const [isLoadingCategories, setIsLoadingCategories] = useState<boolean>(true);

  // Modals & UI States
  const [isLogModalOpen, setIsLogModalOpen] = useState<boolean>(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState<boolean>(false);
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState<boolean>(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; title?: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Show Toast
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Register PWA Service Worker on mount
  useEffect(() => {
    registerServiceWorker().then(reg => {
      if (reg) {
        reg.update().catch(err => console.warn('SW update failed:', err));
      }
    }).catch((err) => {
      console.warn('Service worker registration failed:', err);
    });

    // Listen for navigation messages from the Service Worker
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'NAVIGATE' && event.data.url) {
        window.history.pushState(null, '', event.data.url);
        setForceRender(prev => prev + 1);
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleMessage);
    
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
    };
  }, []);

  // Check Auth Status on initial load
  const checkAuthStatus = useCallback(async (tokenToCheck?: string | null) => {
    try {
      setIsCheckingAuth(true);
      const token = tokenToCheck !== undefined ? tokenToCheck : authToken;
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/auth/status', { headers });
      if (res.ok) {
        const data = await res.json();
        setIsAuthSetup(data.isSetup);
        setIsAuthenticated(data.isAuthenticated);

        // If not authenticated, clear invalid token and reflect /login path
        if (!data.isAuthenticated) {
          if (token) {
            localStorage.removeItem(AUTH_TOKEN_KEY);
            setAuthToken(null);
          }
          if (window.location.pathname !== '/login') {
            window.history.replaceState(null, '', '/login');
          }
        } else {
          // If authenticated and on /login, move to /
          if (window.location.pathname === '/login') {
            window.history.replaceState(null, '', '/');
          }
        }
      } else {
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error('Error checking auth status:', err);
      setIsAuthenticated(false);
    } finally {
      setIsCheckingAuth(false);
    }
  }, [authToken]);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // Authenticated fetch helper
  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const headers = new Headers(options.headers || {});
      if (authToken) {
        headers.set('Authorization', `Bearer ${authToken}`);
      }

      const response = await fetch(url, { ...options, headers });
      if (response.status === 401) {
        // Unauthorized
        localStorage.removeItem(AUTH_TOKEN_KEY);
        setAuthToken(null);
        setIsAuthenticated(false);
        window.history.replaceState(null, '', '/login');
        showToast('Session expired or invalid. Please sign in.', 'error');
      }
      return response;
    },
    [authToken]
  );

  // Fetch Categories
  const fetchCategories = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setIsLoadingCategories(true);
      const res = await authFetch('/api/categories');
      if (!res.ok) throw new Error('Failed to load categories');
      const data = await res.json();
      setCategories(data);
    } catch (err: any) {
      console.error('Error loading categories:', err);
    } finally {
      setIsLoadingCategories(false);
    }
  }, [authFetch, isAuthenticated]);

  // Fetch Logs for selected date and all logs
  const fetchLogs = useCallback(async (date: string) => {
    if (!isAuthenticated) return;
    try {
      setIsLoadingLogs(true);
      const [dateRes, allRes] = await Promise.all([
        authFetch(`/api/logs?date=${date}`),
        authFetch('/api/logs'),
      ]);

      if (dateRes.ok) {
        const dateData = await dateRes.json();
        setCurrentDateLogs(dateData);
      }

      if (allRes.ok) {
        const allData = await allRes.json();
        setAllLogs(allData);
      }
    } catch (err: any) {
      console.error('Error fetching logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  }, [authFetch, isAuthenticated]);

  // Initial Load when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchCategories();
      fetchLogs(selectedDate);
    }
  }, [isAuthenticated, fetchCategories, fetchLogs, selectedDate]);

  // When date changes, update logs
  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    setSelectedMonth(date.substring(0, 7));
  };

  // Handle Save Log
  const handleSaveLog = async (formData: FormData) => {
    const res = await authFetch('/api/logs', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to save log');
    }

    const savedLog: DailyLog = await res.json();
    await fetchLogs(selectedDate);
    showToast('Activity log saved successfully!');
  };

  // Handle Add Category
  const handleAddCategory = async (newCat: {
    name: string;
    color_code: string;
    icon: string;
    reminder_time?: string | null;
  }) => {
    const res = await authFetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCat),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to create category');
    }

    const created: Category = await res.json();
    setCategories((prev) => [...prev, created]);
    showToast(`Category "${created.name}" created!`);
    return created;
  };

  // Handle Update Category (including reminder_time)
  const handleUpdateCategory = async (id: string, updates: Partial<Category>) => {
    const res = await authFetch(`/api/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to update category');
    }

    const updated: Category = await res.json();
    setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
    showToast(`Category "${updated.name}" updated!`);
    return updated;
  };

  // Handle Delete Category
  const handleDeleteCategory = async (id: string) => {
    const res = await authFetch(`/api/categories/${id}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to delete category');
    }

    setCategories((prev) => prev.filter((c) => c.id !== id));
    setCurrentDateLogs((prev) => prev.filter((l) => l.category_id !== id));
    setAllLogs((prev) => prev.filter((l) => l.category_id !== id));
    showToast('Category deleted and associated logs cleaned up');
  };

  // Handle Delete Log
  const handleDeleteLog = async (id: string) => {
    try {
      const res = await authFetch(`/api/logs/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete log');
      }

      setCurrentDateLogs((prev) => prev.filter((l) => l.id !== id));
      setAllLogs((prev) => prev.filter((l) => l.id !== id));
      showToast('Activity log deleted');
    } catch (err: any) {
      console.error('Delete error:', err);
      showToast('Failed to delete activity log', 'error');
    }
  };

  // Auth Handlers
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
    try {
      await authFetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // ignore
    }
    localStorage.removeItem(AUTH_TOKEN_KEY);
    document.cookie = 'session_token=; path=/; max-age=0; SameSite=Lax';
    setAuthToken(null);
    setIsAuthenticated(false);
    window.history.replaceState(null, '', '/login');
    showToast('Dashboard locked');
  };

  // Calculate log counts per date for dot indicators in day selector
  const logCountsByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const log of allLogs) {
      counts[log.log_date] = (counts[log.log_date] || 0) + 1;
    }
    return counts;
  }, [allLogs]);

  // Loading security check
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
        <p className="text-xs font-semibold text-neutral-400">Verifying security credentials...</p>
      </div>
    );
  }

  // If unauthenticated or accessing /login, render the Auth checkpoint screen
  if (!isAuthenticated || window.location.pathname === '/login') {
    return <AuthScreen isSetup={isAuthSetup} onAuthenticated={handleAuthenticated} />;
  }

  // Deep Link Routing: Quick Log check-in from push notification
  if (window.location.pathname.replace(/\/$/, '') === '/quick-log') {
    const params = new URLSearchParams(window.location.search);
    const quickLogCategoryId = params.get('category_id');
    
    if (quickLogCategoryId) {
      return (
        <QuickLog
          categoryId={quickLogCategoryId}
          authFetch={authFetch}
          onClose={() => {
            fetchLogs(selectedDate); // refresh logs
            setForceRender(prev => prev + 1);
          }}
        />
      );
    } else {
      // Missing category_id, gracefully degrade to dashboard
      window.history.replaceState(null, '', '/');
      setForceRender(prev => prev + 1);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 flex flex-col font-sans selection:bg-blue-500 selection:text-white pb-12">
      {/* 1. Header Bar with Navigation, Schema Modal & Logout/Lock */}
      <Header
        currentView={currentView}
        onViewChange={setCurrentView}
        onOpenNewLog={() => setIsLogModalOpen(true)}
        onOpenSchema={() => setIsSchemaModalOpen(true)}
        onOpenCategories={() => setIsCategoryManagerOpen(true)}
        onLogout={handleLogout}
      />

      {/* 2. Main Content Viewport */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-4 sm:px-6 space-y-4">
        {currentView === 'dashboard' ? (
          <div className="space-y-4">
            {/* Scheduled Push Notifications Settings Card */}
            <NotificationSettingsCard
              authToken={authToken}
              onRefreshLogs={() => fetchLogs(selectedDate)}
            />

            {/* Horizontal Day Selector Strip */}
            <DaySelector
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              logCountsByDate={logCountsByDate}
            />

            {/* Activity Feed for the Selected Day */}
            <ActivityFeed
              logs={currentDateLogs}
              isLoading={isLoadingLogs}
              selectedDate={selectedDate}
              onOpenNewLog={() => setIsLogModalOpen(true)}
              onDeleteLog={handleDeleteLog}
              onViewPhoto={(url, title) => setLightboxPhoto({ url, title })}
            />
          </div>
        ) : (
          /* Reports View */
          <ReportsView
            logs={allLogs}
            categories={categories}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            isLoading={isLoadingLogs}
          />
        )}
      </main>

      {/* 3. Floating Action Button (FAB) in Bottom-Right */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          id="btn-fab-add-log"
          onClick={() => setIsLogModalOpen(true)}
          aria-label="Add new log"
          className="w-14 h-14 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-full shadow-lg shadow-blue-600/30 flex items-center justify-center transition-all group focus:outline-none focus:ring-4 focus:ring-blue-500/30"
        >
          <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-200" />
        </button>
      </div>

      {/* 4. Log Modal Overlay */}
      <LogModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        categories={categories}
        selectedDate={selectedDate}
        onSaveLog={handleSaveLog}
        onAddCategory={handleAddCategory}
        onDeleteCategory={handleDeleteCategory}
        onOpenCategoryManager={() => {
          setIsLogModalOpen(false);
          setIsCategoryManagerOpen(true);
        }}
      />

      {/* 5. Category Manager Modal */}
      <CategoryManagerModal
        isOpen={isCategoryManagerOpen}
        onClose={() => setIsCategoryManagerOpen(false)}
        categories={categories}
        onAddCategory={handleAddCategory}
        onUpdateCategory={handleUpdateCategory}
        onDeleteCategory={handleDeleteCategory}
      />

      {/* 6. Photo Lightbox Modal */}
      <PhotoLightbox
        url={lightboxPhoto?.url || null}
        title={lightboxPhoto?.title}
        onClose={() => setLightboxPhoto(null)}
      />

      {/* 7. Vercel Architecture & SQL Schema Inspector */}
      <VercelSchemaModal
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
      />

      {/* 8. Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-xl border text-xs font-semibold backdrop-blur-md ${
              toastMessage.type === 'success'
                ? 'bg-neutral-900/90 text-white border-neutral-800'
                : 'bg-red-900/90 text-white border-red-800'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-red-400" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}
    </div>
  );
}
