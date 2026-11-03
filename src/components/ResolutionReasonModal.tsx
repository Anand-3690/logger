import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  MessageSquare,
  Check,
  Sparkles,
  AlertCircle,
  Clock,
  Calendar,
  Zap,
  Plane,
  Briefcase,
  Heart,
  Smile,
} from 'lucide-react';

interface ResolutionReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  resolutionId: string;
  resolutionTitle: string;
  categoryId?: string;
  logDate: string;
  onSave: (reason: string) => Promise<void>;
}

const PRESET_REASONS = [
  { label: 'Low Energy / Tired', icon: '⚡' },
  { label: 'Ran out of Time', icon: '⏳' },
  { label: 'Traveled / Out of Town', icon: '✈️' },
  { label: 'Busy with Work / Studies', icon: '💼' },
  { label: 'Unwell / Health Issue', icon: '🤒' },
  { label: 'Planned Rest Day', icon: '🧘' },
  { label: 'Forgot / Distracted', icon: '🤷' },
];

export const ResolutionReasonModal: React.FC<ResolutionReasonModalProps> = ({
  isOpen,
  onClose,
  resolutionTitle,
  logDate,
  onSave,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [customText, setCustomText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedPreset('');
      setCustomText('');
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelectPreset = (preset: string) => {
    if (selectedPreset === preset) {
      setSelectedPreset('');
    } else {
      setSelectedPreset(preset);
      if (!customText) {
        setCustomText(preset);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = customText.trim() || selectedPreset || 'No specific reason logged';
    try {
      setIsSubmitting(true);
      await onSave(finalReason);
      onClose();
    } catch (err) {
      console.error('Failed to save missed reason:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-5 pb-4 border-b border-neutral-100">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0 border border-amber-500/30">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900 leading-tight">
                  Log Missed Reflection
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Accountability review for <span className="font-semibold text-neutral-700">{logDate}</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3.5 px-3 py-2 bg-amber-50/80 rounded-2xl border border-amber-200/60 flex items-center gap-2 text-xs text-amber-900">
            <span className="font-bold shrink-0">Resolution:</span>
            <span className="font-medium truncate">{resolutionTitle}</span>
          </div>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-sm">
          {/* Quick preset chips */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-2">
              Quick Reason Presets:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_REASONS.map((preset) => {
                const isSelected = selectedPreset === preset.label;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleSelectPreset(preset.label)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                        : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border-neutral-200'
                    }`}
                  >
                    <span>{preset.icon}</span>
                    <span>{preset.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom reflection text input */}
          <div>
            <label htmlFor="reason-custom-text" className="block text-xs font-bold text-neutral-700 mb-1.5">
              Details or Reflection note:
            </label>
            <textarea
              id="reason-custom-text"
              ref={textareaRef}
              rows={3}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="e.g. Traveled for work meetings and couldn't complete. Will resume tomorrow morning!"
              className="w-full px-3.5 py-2.5 rounded-2xl border border-neutral-200 bg-neutral-50/50 text-xs text-neutral-900 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all placeholder:text-neutral-400 resize-none leading-relaxed"
            />
          </div>

          {/* Bottom actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-neutral-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              Skip
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{isSubmitting ? 'Saving...' : 'Save Reflection & Check In'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

