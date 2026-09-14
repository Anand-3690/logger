import React from 'react';
import { X, Bell } from 'lucide-react';
import { NotificationSettingsCard } from './NotificationSettingsCard';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  authToken?: string | null;
  onRefreshLogs?: () => void;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  onClose,
  authToken,
  onRefreshLogs,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-md transition-opacity animate-in fade-in duration-200">
      <div
        id="modal-notification-settings"
        className="glass-modal rounded-3xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/60 flex items-center justify-between bg-white/40 backdrop-blur-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900 leading-tight">
                Push Notifications & Scheduler
              </h3>
              <p className="text-xs text-neutral-500 font-medium">
                Live delivery status, test alerts, and automated cron scheduler diagnostics
              </p>
            </div>
          </div>
          <button
            id="btn-close-notification-settings"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-white/60 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto p-5 no-scrollbar flex-1">
          <NotificationSettingsCard authToken={authToken} onRefreshLogs={onRefreshLogs} />
        </div>
      </div>
    </div>
  );
};
