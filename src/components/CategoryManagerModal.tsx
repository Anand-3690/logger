import React, { useState } from 'react';
import { Category } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { IconPicker } from './IconPicker';
import {
  X,
  Plus,
  Trash2,
  Tag,
  Loader2,
  AlertTriangle,
  Sparkles,
  Bell,
  Clock,
  Check,
} from 'lucide-react';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onAddCategory: (category: {
    name: string;
    color_code: string;
    icon: string;
    reminder_time?: string | null;
  }) => Promise<Category>;
  onUpdateCategory?: (id: string, updates: Partial<Category>) => Promise<Category>;
  onDeleteCategory: (id: string) => Promise<void>;
}

const PRESET_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#ef4444', // red
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#f97316', // orange
  '#64748b', // slate
  '#d97706', // warm amber
];

const PRESET_TIMES = [
  { label: 'Morning (08:00)', value: '08:00' },
  { label: 'Work (09:00)', value: '09:00' },
  { label: 'Midday (13:00)', value: '13:00' },
  { label: 'Evening (18:30)', value: '18:30' },
  { label: 'Night (21:00)', value: '21:00' },
];

function formatTimeDisplay(timeStr?: string | null): string {
  if (!timeStr) return 'No scheduled reminder';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  const hour = parseInt(parts[0], 10);
  const min = parts[1];
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${min} ${ampm}`;
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  categories,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
}) => {
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [colorCode, setColorCode] = useState<string>('#8b5cf6');
  const [iconName, setIconName] = useState<string>('Sparkles');
  const [reminderTime, setReminderTime] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Quick edit reminder state for existing category
  const [editingReminderCatId, setEditingReminderCatId] = useState<string | null>(null);
  const [tempReminderTime, setTempReminderTime] = useState<string>('');
  const [isUpdatingReminder, setIsUpdatingReminder] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setIsSaving(true);
      setErrorMsg(null);
      await onAddCategory({
        name: name.trim(),
        color_code: colorCode,
        icon: iconName,
        reminder_time: reminderTime ? reminderTime.trim() : null,
      });
      setName('');
      setReminderTime('');
      setIsCreating(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create category');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveReminderTime = async (cat: Category) => {
    if (!onUpdateCategory) return;
    try {
      setIsUpdatingReminder(true);
      setErrorMsg(null);
      await onUpdateCategory(cat.id, {
        reminder_time: tempReminderTime ? tempReminderTime.trim() : null,
      });
      setEditingReminderCatId(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update reminder time');
    } finally {
      setIsUpdatingReminder(false);
    }
  };

  const confirmDelete = async () => {
    if (!categoryToDelete) return;
    try {
      setDeletingId(categoryToDelete.id);
      setErrorMsg(null);
      await onDeleteCategory(categoryToDelete.id);
      setCategoryToDelete(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete category');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-neutral-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        id="modal-category-manager"
        className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl border border-neutral-200 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-xs">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900 leading-tight">
                Categories & Push Reminders
              </h3>
              <p className="text-xs text-neutral-500 font-medium">
                Customize badges, assign scheduled reminder times, and manage icons
              </p>
            </div>
          </div>
          <button
            id="btn-close-cat-manager"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/70 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto p-5 space-y-4 no-scrollbar flex-1">
          {errorMsg && (
            <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl">
              {errorMsg}
            </div>
          )}

          {/* Delete Confirmation Alert if active */}
          {categoryToDelete && (
            <div className="p-4 bg-red-50/90 border border-red-200 rounded-2xl space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="text-xs text-red-900">
                  <span className="font-bold">Delete "{categoryToDelete.name}"?</span>
                  <p className="mt-0.5 text-red-700 leading-relaxed">
                    This category will be removed from your active list. Existing past activity logs will keep their historical notes and visual records safely.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCategoryToDelete(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-white rounded-lg border border-neutral-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={deletingId === categoryToDelete.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-60 shadow-xs"
                >
                  {deletingId === categoryToDelete.id ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Category</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Add Category Toggle Button */}
          {!isCreating ? (
            <button
              type="button"
              id="btn-toggle-add-category-panel"
              onClick={() => setIsCreating(true)}
              className="w-full py-2.5 px-4 bg-blue-50/70 hover:bg-blue-100/70 border border-dashed border-blue-300 text-blue-700 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Category with Scheduled Reminder</span>
            </button>
          ) : (
            /* Creation Form with Full Icon Picker & Time-Picker */
            <form onSubmit={handleCreate} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  New Category Details
                </span>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="text-xs font-semibold text-neutral-500 hover:text-neutral-700"
                >
                  Cancel
                </button>
              </div>

              {/* Name input */}
              <div>
                <label className="text-[11px] font-bold text-neutral-600 block mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Meditation, Workout, Book Reading, Deep Work..."
                  className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl text-xs font-medium text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Reminder Time Picker */}
              <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-blue-900 flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-blue-600" />
                    <span>Scheduled Reminder Time (Optional)</span>
                  </label>
                  {reminderTime && (
                    <button
                      type="button"
                      onClick={() => setReminderTime('')}
                      className="text-[10px] font-semibold text-blue-600 hover:underline"
                    >
                      Clear Time
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      id="input-new-cat-reminder-time"
                      type="time"
                      value={reminderTime}
                      onChange={(e) => setReminderTime(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-blue-200 rounded-lg text-xs font-semibold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <Clock className="w-3.5 h-3.5 text-blue-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  <span className="text-[11px] text-blue-700 font-medium">
                    {reminderTime ? formatTimeDisplay(reminderTime) : 'None'}
                  </span>
                </div>
                {/* Quick Time Presets */}
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {PRESET_TIMES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setReminderTime(t.value)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-medium border transition-colors ${
                        reminderTime === t.value
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-white text-neutral-600 border-neutral-200 hover:bg-blue-50'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Swatches */}
              <div>
                <label className="text-[11px] font-bold text-neutral-600 block mb-1.5">
                  Badge Color
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColorCode(c)}
                      className={`w-6 h-6 rounded-full transition-transform ${
                        colorCode === c ? 'ring-2 ring-offset-2 ring-neutral-900 scale-110' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  {/* Custom color input */}
                  <input
                    type="color"
                    value={colorCode}
                    onChange={(e) => setColorCode(e.target.value)}
                    title="Custom color picker"
                    className="w-6 h-6 p-0 border-0 rounded-full cursor-pointer bg-transparent"
                  />
                </div>
              </div>

              {/* Custom Icon Picker with Categories & Search */}
              <div>
                <label className="text-[11px] font-bold text-neutral-600 block mb-1.5">
                  Choose Icon or Custom Emoji
                </label>
                <IconPicker
                  selectedIcon={iconName}
                  onSelectIcon={setIconName}
                  accentColor={colorCode}
                />
              </div>

              {/* Submit & Cancel */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-200/60 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!name.trim() || isSaving}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 shadow-xs"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create Category</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* List of Existing Categories */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">
              Active Categories ({categories.length})
            </label>
            <div className="space-y-2.5">
              {categories.map((cat) => {
                const isEditingThisReminder = editingReminderCatId === cat.id;

                return (
                  <div
                    key={cat.id}
                    className="p-3 rounded-2xl border border-neutral-200/80 bg-white hover:bg-neutral-50/80 transition-colors shadow-2xs group space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                          style={{ backgroundColor: cat.color_code }}
                        >
                          <CategoryIcon name={cat.icon} className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <div className="text-xs sm:text-sm font-bold text-neutral-900 flex items-center gap-2">
                            <span>{cat.name}</span>
                            {cat.reminder_time && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                                <Bell className="w-2.5 h-2.5 text-blue-600" />
                                {formatTimeDisplay(cat.reminder_time)}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-neutral-400 font-mono">
                            Icon: {cat.icon}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          id={`btn-edit-reminder-${cat.id}`}
                          onClick={() => {
                            if (isEditingThisReminder) {
                              setEditingReminderCatId(null);
                            } else {
                              setEditingReminderCatId(cat.id);
                              setTempReminderTime(cat.reminder_time || '09:00');
                            }
                          }}
                          title="Set or update scheduled reminder time"
                          className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors ${
                            cat.reminder_time
                              ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                              : 'text-neutral-400 hover:text-blue-600 hover:bg-blue-50'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          id={`btn-delete-category-${cat.id}`}
                          onClick={() => setCategoryToDelete(cat)}
                          title={`Delete "${cat.name}"`}
                          className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Inline Reminder Time Editor if expanded */}
                    {isEditingThisReminder && (
                      <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-in fade-in duration-150">
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] font-bold text-neutral-700 flex items-center gap-1 shrink-0">
                            <Bell className="w-3 h-3 text-blue-600" />
                            Reminder:
                          </label>
                          <input
                            type="time"
                            value={tempReminderTime}
                            onChange={(e) => setTempReminderTime(e.target.value)}
                            className="px-2 py-1 bg-white border border-neutral-300 rounded-lg text-xs font-semibold"
                          />
                          <button
                            type="button"
                            onClick={() => setTempReminderTime('')}
                            className="text-[10px] text-neutral-500 hover:text-neutral-800"
                          >
                            Disable
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => setEditingReminderCatId(null)}
                            className="px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-200 rounded-lg"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveReminderTime(cat)}
                            disabled={isUpdatingReminder}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-2xs"
                          >
                            {isUpdatingReminder ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                            <span>Save Time</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {categories.length === 0 && (
                <div className="text-center py-6 text-xs text-neutral-400">
                  No active categories. Create one above!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-100 flex justify-end bg-neutral-50/70">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
