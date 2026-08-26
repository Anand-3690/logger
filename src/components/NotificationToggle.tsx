import React, { useState, useEffect } from 'react';
import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react';
import {
  getPushNotificationStatus,
  subscribeToWebPush,
  unsubscribeFromWebPush,
  PushStatus,
} from '../utils/pushNotifications';

interface NotificationToggleProps {
  authToken?: string | null;
  onToast?: (message: string, type: 'success' | 'error') => void;
}

export const NotificationToggle: React.FC<NotificationToggleProps> = ({
  authToken,
  onToast,
}) => {
  const [status, setStatus] = useState<PushStatus>({
    isSupported: true,
    permission: 'default',
    isSubscribed: false,
    subscription: null,
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const checkStatus = async () => {
    try {
      const currentStatus = await getPushNotificationStatus();
      setStatus(currentStatus);
    } catch (e) {
      console.warn('Failed to get push status:', e);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleToggle = async () => {
    try {
      setIsLoading(true);
      if (status.isSubscribed) {
        await unsubscribeFromWebPush(authToken);
        if (onToast) onToast('Notifications turned off', 'success');
      } else {
        await subscribeToWebPush(authToken);
        if (onToast) onToast('Notifications turned on! Reminders are active.', 'success');
      }
      await checkStatus();
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to update notification settings';
      console.warn('Push notification note:', errorMessage);
      if (onToast) {
        onToast(errorMessage, 'error');
      }
      await checkStatus();
    } finally {
      setIsLoading(false);
    }
  };

  if (!status.isSupported) {
    return null;
  }

  const isDenied = status.permission === 'denied';

  return (
    <button
      id="btn-header-toggle-notifications"
      type="button"
      onClick={handleToggle}
      disabled={isLoading}
      title={
        isDenied
          ? 'Notifications are blocked in browser settings (Click for help)'
          : status.isSubscribed
          ? 'Notifications are ON (Click to turn off)'
          : 'Notifications are OFF (Click to turn on)'
      }
      className={`relative p-2 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-semibold ${
        status.isSubscribed
          ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100/80 shadow-xs'
          : isDenied
          ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100/80'
          : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 border-neutral-200/80'
      }`}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
      ) : status.isSubscribed ? (
        <>
          <BellRing className="w-4 h-4 text-blue-600" />
          <span className="hidden sm:inline">Notifications On</span>
          <span className="w-2 h-2 rounded-full bg-blue-600 absolute -top-0.5 -right-0.5 ring-2 ring-white" />
        </>
      ) : isDenied ? (
        <>
          <BellOff className="w-4 h-4 text-amber-600" />
          <span className="hidden sm:inline">Notifications Blocked</span>
        </>
      ) : (
        <>
          <BellOff className="w-4 h-4 text-neutral-400" />
          <span className="hidden sm:inline">Notifications Off</span>
        </>
      )}
    </button>
  );
};
