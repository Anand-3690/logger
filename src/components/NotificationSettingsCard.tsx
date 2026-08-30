import React, { useState, useEffect } from 'react';
import {
  Bell,
  BellRing,
  BellOff,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Smartphone,
  Sparkles,
  Zap,
  Activity,
} from 'lucide-react';
import {
  getPushNotificationStatus,
  subscribeToWebPush,
  unsubscribeFromWebPush,
  sendTestPushNotification,
  triggerCronCheck,
  fetchCronStatus,
  PushStatus,
} from '../utils/pushNotifications';

interface NotificationSettingsCardProps {
  authToken?: string | null;
  onRefreshLogs?: () => void;
}

export const NotificationSettingsCard: React.FC<NotificationSettingsCardProps> = ({
  authToken,
  onRefreshLogs,
}) => {
  const [status, setStatus] = useState<PushStatus>({
    isSupported: true,
    permission: 'default',
    isSubscribed: false,
    subscription: null,
  });
  const [cronStatus, setCronStatus] = useState<{
    isRunning: boolean;
    currentServerTime: string;
    categoriesWithReminders: { id: string; name: string; reminder_time: string }[];
    activeSubscribersCount: number;
  } | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [isCronRunning, setIsCronRunning] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const checkStatus = async () => {
    try {
      const currentStatus = await getPushNotificationStatus();
      setStatus(currentStatus);
      const cronInfo = await fetchCronStatus();
      setCronStatus(cronInfo);
    } catch (e) {
      console.warn('Failed to get push or cron status:', e);
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleTogglePush = async () => {
    try {
      setIsLoading(true);
      setFeedbackMsg(null);

      if (status.isSubscribed) {
        await unsubscribeFromWebPush(authToken);
        setFeedbackMsg({ type: 'info', text: 'Web push notifications disabled.' });
      } else {
        await subscribeToWebPush(authToken);
        setFeedbackMsg({
          type: 'success',
          text: 'Notifications enabled! Daily reminders and interactive check-ins are now active.',
        });
      }

      await checkStatus();
    } catch (err: any) {
      console.error('Push toggle error:', err);
      setFeedbackMsg({
        type: 'error',
        text: err.message || 'Failed to update notification settings. Please check browser permissions.',
      });
      await checkStatus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendTestPush = async () => {
    try {
      setIsTesting(true);
      setFeedbackMsg(null);
      const res = await sendTestPushNotification(authToken);
      setFeedbackMsg({
        type: 'success',
        text: res.message || 'Interactive push notification sent! Check your device or notification center.',
      });
      if (onRefreshLogs) setTimeout(onRefreshLogs, 1500);
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.message || 'Failed to dispatch test notification.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleRunCron = async () => {
    try {
      setIsCronRunning(true);
      setFeedbackMsg(null);
      const res = await triggerCronCheck(authToken, true);
      setFeedbackMsg({
        type: 'success',
        text: `Internal scheduler check triggered! Dispatched ${res.totalNotificationsDispatched} alerts for ${res.matchedCategoriesCount} scheduled habits.`,
      });
      if (onRefreshLogs) setTimeout(onRefreshLogs, 1500);
      await checkStatus();
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.message || 'Failed to trigger internal cron job.',
      });
    } finally {
      setIsCronRunning(false);
    }
  };

  return (
    <div
      id="card-push-notifications"
      className="glass-panel rounded-3xl p-5 space-y-4"
    >
      {/* Header & Toggle */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-colors shadow-xs ${
              status.isSubscribed
                ? 'bg-blue-600 text-white shadow-blue-500/20'
                : 'bg-white/60 text-neutral-600 border border-white/60'
            }`}
          >
            {status.isSubscribed ? (
              <BellRing className="w-5 h-5 animate-wiggle" />
            ) : (
              <BellOff className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-neutral-900 leading-tight">
                Self-Managed Web Push & Scheduled Reminders
              </h3>
              {status.isSubscribed ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-200/50 text-neutral-600">
                  Disabled
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
              Automated reminders and habit check-ins. Prompts include{' '}
              <strong className="text-neutral-700 font-semibold">"Present / Yes"</strong> and{' '}
              <strong className="text-neutral-700 font-semibold">"Absent / No"</strong> interactive buttons.
            </p>
          </div>
        </div>

        {/* Master Enable/Disable Toggle */}
        <button
          id="btn-toggle-notifications"
          type="button"
          onClick={handleTogglePush}
          disabled={isLoading}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            status.isSubscribed ? 'bg-blue-600' : 'bg-neutral-300'
          } ${isLoading ? 'opacity-50 cursor-wait' : ''}`}
          role="switch"
          aria-checked={status.isSubscribed}
          title={status.isSubscribed ? 'Disable Push Notifications' : 'Enable Push Notifications'}
        >
          <span
            aria-hidden="true"
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
              status.isSubscribed ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Internal Background Engine Status Banner */}
      {cronStatus && (
        <div className="bg-neutral-50 rounded-2xl p-3 border border-neutral-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-semibold text-neutral-800 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              Internal Cron Engine: Active
            </span>
            <span className="text-neutral-400">|</span>
            <span className="text-neutral-600">
              Server Time: <strong className="font-mono text-neutral-800">{cronStatus.currentServerTime}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 text-neutral-500 text-[11px]">
            <span>
              <strong>{cronStatus.categoriesWithReminders?.length || 0}</strong> scheduled habit(s)
            </span>
            <span>•</span>
            <span>
              <strong>{cronStatus.activeSubscribersCount || 0}</strong> registered subscriber(s)
            </span>
          </div>
        </div>
      )}

      {/* Action Controls & Interactive Test Buttons */}
      <div className="pt-2 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Send Test Push Button */}
          <button
            id="btn-send-test-push"
            type="button"
            onClick={handleSendTestPush}
            disabled={isTesting || !status.isSubscribed}
            title={!status.isSubscribed ? 'Enable notifications first' : 'Broadcast a test notification'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-40 shadow-xs"
          >
            {isTesting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5 text-blue-400" />
            )}
            <span>Send Test Notification</span>
          </button>

          {/* Trigger Cron Tick Now */}
          <button
            id="btn-trigger-cron-job"
            type="button"
            onClick={handleRunCron}
            disabled={isCronRunning}
            title="Execute immediate reminder cycle"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold rounded-xl transition-colors disabled:opacity-40"
          >
            {isCronRunning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Clock className="w-3.5 h-3.5 text-neutral-600" />
            )}
            <span>Trigger Scheduler Check Now</span>
          </button>
        </div>

        {/* Feature badge */}
        <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 font-medium">
          <Smartphone className="w-3.5 h-3.5 text-neutral-500" />
          <span>Self-Hosted & Independent</span>
        </div>
      </div>

      {/* Feedback Alert if present */}
      {feedbackMsg && (
        <div
          className={`p-3 rounded-2xl text-xs flex items-start gap-2 animate-in fade-in duration-200 ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : feedbackMsg.type === 'error'
              ? 'bg-red-50 border border-red-200 text-red-800'
              : 'bg-blue-50 border border-blue-200 text-blue-800'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          ) : feedbackMsg.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          ) : (
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          )}
          <div className="leading-relaxed flex-1">{feedbackMsg.text}</div>
        </div>
      )}
    </div>
  );
};
