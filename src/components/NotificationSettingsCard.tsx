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
  Calendar,
  History,
  Target,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  getPushNotificationStatus,
  subscribeToWebPush,
  unsubscribeFromWebPush,
  sendTestPushNotification,
  sendTestOnThisDayNotification,
  sendTestResolutionNotification,
  triggerCronCheck,
  fetchCronStatus,
  PushStatus,
  CronStatusData,
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
  const [cronStatus, setCronStatus] = useState<CronStatusData | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [isTestingOnThisDay, setIsTestingOnThisDay] = useState<boolean>(false);
  const [isTestingResolution, setIsTestingResolution] = useState<boolean>(false);
  const [isCronRunning, setIsCronRunning] = useState<boolean>(false);
  const [showTroubleshooting, setShowTroubleshooting] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const checkStatus = async () => {
    try {
      const currentStatus = await getPushNotificationStatus();
      setStatus(currentStatus);
      if (currentStatus.permission === 'denied') {
        setShowTroubleshooting(true);
      }
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

  const handleSendTestOnThisDay = async () => {
    try {
      setIsTestingOnThisDay(true);
      setFeedbackMsg(null);
      const res = await sendTestOnThisDayNotification(authToken);
      setFeedbackMsg({
        type: 'success',
        text: res.message || 'On This Day notification dispatched!',
      });
      if (onRefreshLogs) setTimeout(onRefreshLogs, 1500);
      await checkStatus();
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.message || 'Failed to dispatch On This Day notification.',
      });
    } finally {
      setIsTestingOnThisDay(false);
    }
  };

  const handleSendTestResolution = async () => {
    try {
      setIsTestingResolution(true);
      setFeedbackMsg(null);
      const res = await sendTestResolutionNotification(authToken);
      setFeedbackMsg({
        type: 'success',
        text: res.message || 'Resolution test notification dispatched! 🎯',
      });
      if (onRefreshLogs) onRefreshLogs();
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.message || 'Failed to dispatch resolution test notification.',
      });
    } finally {
      setIsTestingResolution(false);
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

      {/* Blocked Permission Warning Banner */}
      {status.permission === 'denied' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-900 flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-amber-900 leading-tight">Notifications are blocked in your browser</p>
            <p className="text-amber-800 leading-relaxed text-[11px]">
              To receive on-screen alerts, click the padlock or tune icon (<strong className="font-semibold">🔒 / 🎚️</strong>) on the left side of your browser's address bar, change <strong className="font-semibold">Notifications</strong> to <strong className="font-semibold">Allow</strong>, and reload the page.
            </p>
          </div>
        </div>
      )}

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

          {cronStatus.todayMemoriesCount !== undefined && cronStatus.todayMemoriesCount > 0 && (
            <div className="w-full mt-2 pt-2 border-t border-amber-200/50 flex items-center justify-between text-xs text-amber-900 bg-amber-50/90 px-2.5 py-1.5 rounded-xl border border-amber-200/80">
              <span className="flex items-center gap-1.5 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>
                  <strong>{cronStatus.todayMemoriesCount} memories</strong> found for today (
                  {cronStatus.onThisDayCategories?.map((c) => c.name).join(', ') || 'On This Day'})
                </span>
              </span>
              <span className="font-semibold text-amber-800 shrink-0 text-xs bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                Alert ready
              </span>
            </div>
          )}
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
            disabled={isTesting}
            title="Broadcast a test habit check-in notification"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-40 shadow-xs cursor-pointer"
          >
            {isTesting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5 text-blue-400" />
            )}
            <span>Send test notification</span>
          </button>

          {/* Test On This Day Notification Button */}
          <button
            id="btn-send-test-on-this-day"
            type="button"
            onClick={handleSendTestOnThisDay}
            disabled={isTestingOnThisDay}
            title="Test interactive 'On This Day' alert for today's historical memories"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-40 shadow-xs cursor-pointer"
          >
            {isTestingOnThisDay ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <History className="w-3.5 h-3.5 text-amber-200" />
            )}
            <span>Test alert for today</span>
          </button>

          {/* Test Resolution Notification Button */}
          <button
            id="btn-send-test-resolution"
            type="button"
            onClick={handleSendTestResolution}
            disabled={isTestingResolution}
            title="Test interactive 'Resolution' alert with check-in buttons"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-40 shadow-xs cursor-pointer"
          >
            {isTestingResolution ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Target className="w-3.5 h-3.5 text-emerald-200" />
            )}
            <span>Test Resolution Alert</span>
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

      {/* On-Screen Notification Troubleshooting Guide */}
      <div className="pt-2 border-t border-neutral-100">
        <button
          type="button"
          onClick={() => setShowTroubleshooting((prev) => !prev)}
          className="w-full flex items-center justify-between text-xs text-neutral-500 hover:text-neutral-800 transition-colors py-1 cursor-pointer font-medium"
        >
          <span className="flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
            <span>Not seeing on-screen notification popups?</span>
          </span>
          {showTroubleshooting ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showTroubleshooting && (
          <div className="mt-2.5 p-3 rounded-2xl bg-neutral-50/80 border border-neutral-200/70 text-xs text-neutral-600 space-y-2 animate-in fade-in duration-150">
            <div className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
              <div>
                <strong className="text-neutral-800">Browser Site Permission:</strong> Click the lock or tune icon (🔒 / 🎚️) beside the URL and ensure <strong className="text-neutral-800">Notifications</strong> are set to <strong className="text-emerald-700">Allow</strong>.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
              <div>
                <strong className="text-neutral-800">Operating System "Do Not Disturb" / Focus Assist:</strong>
                <ul className="list-disc list-inside mt-0.5 space-y-0.5 text-neutral-500 text-[11px]">
                  <li><strong className="text-neutral-700">Windows:</strong> Ensure <em>Focus assist / Do Not Disturb</em> in the bottom-right taskbar is turned OFF.</li>
                  <li><strong className="text-neutral-700">macOS:</strong> Turn off <em>Focus / Do Not Disturb</em> in Control Center, and check <em>System Settings &gt; Notifications &gt; Google Chrome</em> has <em>Banners/Alerts</em> enabled.</li>
                  <li><strong className="text-neutral-700">Linux (Ubuntu / GNOME):</strong> Open the top panel clock/calendar menu and ensure <em>Do Not Disturb</em> is toggled OFF.</li>
                  <li><strong className="text-neutral-700">Android:</strong> Check that browser notifications are not set to "Silent" in App Notifications.</li>
                </ul>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</span>
              <div>
                <strong className="text-neutral-800">Interactive Banners (`requireInteraction`):</strong> Notifications are set to stay on your screen until dismissed so you won't miss them.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">4</span>
              <div>
                <strong className="text-neutral-800">In-App Live Toast:</strong> When this application is open in your active browser tab, incoming notifications will also display an instant on-screen popup toast at the bottom of the screen.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
