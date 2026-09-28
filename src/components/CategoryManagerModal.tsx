import React, { useState, useMemo } from 'react';
import { Category, DailyLog, isCategoryOnThisDay } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { IconPicker } from './IconPicker';
import { Reorder } from 'motion/react';
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
  History,
  GripVertical,
  Archive,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  logs?: DailyLog[];
  onAddCategory: (category: {
    name: string;
    color_code: string;
    icon: string;
    reminder_time?: string | null;
    is_on_this_day?: boolean;
    sort_order?: number;
  }) => Promise<Category>;
  onUpdateCategory?: (id: string, updates: Partial<Category>) => Promise<Category>;
  onDeleteCategory: (id: string) => Promise<void>;
  onReorderCategories?: (reorderedCategories: Category[]) => Promise<void>;
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
  if (!timeStr) return 'No reminder';
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
  logs,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onReorderCategories,
}) => {
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [colorCode, setColorCode] = useState<string>('#8b5cf6');
  const [iconName, setIconName] = useState<string>('Sparkles');
  const [reminderTime, setReminderTime] = useState<string>('');
  const [isOnThisDay, setIsOnThisDay] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Archive & Delete states
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Quick edit reminder state for existing category
  const [editingReminderCatId, setEditingReminderCatId] = useState<string | null>(null);
  const [tempReminderTime, setTempReminderTime] = useState<string>('');
  const [isUpdatingReminder, setIsUpdatingReminder] = useState<boolean>(false);

  const activeCategories = useMemo(() => {
    return categories
      .filter((c) => c.is_active !== false)
      .sort((a, b) => {
        const orderA = a.sort_order ?? 999999;
        const orderB = b.sort_order ?? 999999;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });
  }, [categories]);

  const archivedCategories = useMemo(() => {
    return categories.filter((c) => c.is_active === false);
  }, [categories]);

  const affectedLogsCount = useMemo(() => {
    if (!categoryToDelete || !logs) return 0;
    return logs.filter((l) => l.category_id === categoryToDelete.id).length;
  }, [categoryToDelete, logs]);

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
        is_on_this_day: isOnThisDay,
        sort_order: activeCategories.length,
      });
      setName('');
      setReminderTime('');
      setIsOnThisDay(false);
      setIsCreating(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create category');
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async (cat: Category) => {
    if (!onUpdateCategory) return;
    try {
      setErrorMsg(null);
      await onUpdateCategory(cat.id, { is_active: false });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to archive category');
    }
  };

  const handleRestore = async (cat: Category) => {
    if (!onUpdateCategory) return;
    try {
      setErrorMsg(null);
      await onUpdateCategory(cat.id, { is_active: true });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to restore category');
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

  const confirmPermanentDelete = async () => {
    if (!categoryToDelete) return;
    try {
      setDeletingId(categoryToDelete.id);
      setErrorMsg(null);
      await onDeleteCategory(categoryToDelete.id);
      setCategoryToDelete(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to permanently delete category');
    } finally {
      setDeletingId(null);
    }
  };

  const handleReorder = (newOrder: Category[]) => {
    onReorderCategories?.(newOrder);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-md transition-opacity animate-in fade-in duration-200">
      <div
        id="modal-category-manager"
        className="glass-modal rounded-3xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/60 flex items-center justify-between bg-white/40 backdrop-blur-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-xs">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900 leading-tight">
                Categories & Reminders
              </h3>
              <p className="text-xs text-neutral-500 font-medium">
                Organize badges, drag to reorder, set reminder schedules, and archive
              </p>
            </div>
          </div>
          <button
            id="btn-close-cat-manager"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-white/60 rounded-full transition-colors cursor-pointer"
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

          {/* Permanent Delete Confirmation Dialog */}
          {categoryToDelete && (
            <div className="p-4 bg-red-50/95 border border-red-200 rounded-2xl space-y-3 animate-in fade-in duration-150">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="text-xs text-red-900 space-y-1">
                  <span className="text-sm font-bold block">
                    Permanently delete &quot;{categoryToDelete.name}&quot;?
                  </span>
                  <p className="text-red-700 leading-relaxed">
                    This action <strong className="text-red-950">cannot be undone</strong>. It will
                    permanently delete this category and{' '}
                    <strong className="text-red-950">
                      {affectedLogsCount} associated {affectedLogsCount === 1 ? 'log' : 'logs'}
                    </strong>{' '}
                    from your database.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCategoryToDelete(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-white rounded-xl border border-neutral-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmPermanentDelete}
                  disabled={deletingId === categoryToDelete.id}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl disabled:opacity-60 shadow-xs cursor-pointer"
                >
                  {deletingId === categoryToDelete.id ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Permanently Delete</span>
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
              className="w-full py-2.5 px-4 bg-blue-50/70 hover:bg-blue-100/70 border border-dashed border-blue-300 text-blue-700 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Category</span>
            </button>
          ) : (
            /* Creation Form with Full Icon Picker & Time-Picker */
            <form
              onSubmit={handleCreate}
              className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-3.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-700 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  New Category Details
                </span>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="text-xs font-semibold text-neutral-500 hover:text-neutral-700 cursor-pointer"
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
                  placeholder="e.g. Seva, Thaal, Guruhari Darshan, Sabha..."
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
                      className="text-[10px] font-semibold text-blue-600 hover:underline cursor-pointer"
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
                    {reminderTime ? formatTimeDisplay(reminderTime) : 'No reminder'}
                  </span>
                </div>
                {/* Quick Time Presets */}
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {PRESET_TIMES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setReminderTime(t.value)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-medium border transition-colors cursor-pointer ${
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
                      className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                        colorCode === c
                          ? 'ring-2 ring-offset-2 ring-neutral-900 scale-110'
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
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
                  Choose Icon
                </label>
                <IconPicker
                  selectedIcon={iconName}
                  onSelectIcon={setIconName}
                  accentColor={colorCode}
                />
              </div>

              {/* On This Day Option */}
              <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-neutral-200/80">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-purple-600" />
                  <div>
                    <span className="text-xs font-bold text-neutral-800 block leading-tight">
                      Include in &quot;On This Day&quot;
                    </span>
                    <span className="text-[10px] text-neutral-400">
                      Show past memories and dispatch anniversary notifications
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOnThisDay((prev) => !prev)}
                  className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                    isOnThisDay ? 'bg-purple-600' : 'bg-neutral-200'
                  }`}
                >
                  <span
                    className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-transform ${
                      isOnThisDay ? 'left-5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Submit & Cancel */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-200/60 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!name.trim() || isSaving}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 shadow-xs cursor-pointer"
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

          {/* List of Existing Active Categories with Drag-to-Reorder */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
                Active Categories ({activeCategories.length})
              </label>
              <span className="text-[11px] text-neutral-400 font-medium">
                Drag handle to reorder
              </span>
            </div>

            {activeCategories.length === 0 ? (
              <div className="text-center py-6 text-xs text-neutral-400 bg-neutral-50 rounded-2xl border border-neutral-200">
                No active categories. Create one above!
              </div>
            ) : (
              <Reorder.Group
                axis="y"
                values={activeCategories}
                onReorder={handleReorder}
                className="space-y-2.5"
              >
                {activeCategories.map((cat) => {
                  const isEditingThisReminder = editingReminderCatId === cat.id;

                  return (
                    <Reorder.Item
                      key={cat.id}
                      value={cat}
                      className="p-3 rounded-2xl border border-neutral-200/80 bg-white hover:bg-neutral-50/80 transition-colors shadow-2xs group space-y-2 select-none"
                    >
                      <div className="flex items-center justify-between gap-2">
                        {/* Drag Handle + Icon + Title + Reminder Chip */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div
                            className="text-neutral-400 group-hover:text-neutral-600 cursor-grab active:cursor-grabbing p-1 -ml-1 touch-none"
                            title="Drag to reorder"
                          >
                            <GripVertical className="w-4 h-4" />
                          </div>

                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
                            style={{ backgroundColor: cat.color_code }}
                          >
                            <CategoryIcon
                              name={cat.icon}
                              categoryName={cat.name}
                              className="w-4 h-4 text-white"
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs sm:text-sm font-bold text-neutral-900 truncate">
                                {cat.name}
                              </span>

                              {/* Tappable Reminder Time Chip */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (isEditingThisReminder) {
                                    setEditingReminderCatId(null);
                                  } else {
                                    setEditingReminderCatId(cat.id);
                                    setTempReminderTime(cat.reminder_time || '09:00');
                                  }
                                }}
                                title="Click to edit reminder time"
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${
                                  cat.reminder_time
                                    ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200/70'
                                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-500 border-neutral-200'
                                }`}
                              >
                                {cat.reminder_time ? (
                                  <>
                                    <Bell className="w-2.5 h-2.5 text-blue-600" />
                                    <span>{formatTimeDisplay(cat.reminder_time)}</span>
                                  </>
                                ) : (
                                  <>
                                    <Clock className="w-2.5 h-2.5 text-neutral-400" />
                                    <span>No reminder</span>
                                  </>
                                )}
                              </button>

                              {(cat.is_on_this_day || cat.name === 'Guruhari Darshan') && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200/60">
                                  <History className="w-2.5 h-2.5 text-purple-600" />
                                  On This Day
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action buttons: On This Day, Set Reminder, Archive */}
                        <div className="flex items-center gap-1 shrink-0">
                          {onUpdateCategory && (
                            <button
                              type="button"
                              id={`btn-toggle-on-this-day-${cat.id}`}
                              onClick={() =>
                                onUpdateCategory(cat.id, {
                                  is_on_this_day: !isCategoryOnThisDay(cat),
                                })
                              }
                              title={
                                isCategoryOnThisDay(cat)
                                  ? 'Included in On This Day (Click to remove)'
                                  : 'Not in On This Day (Click to include)'
                              }
                              className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                                isCategoryOnThisDay(cat)
                                  ? 'text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200/60'
                                  : 'text-neutral-400 hover:text-purple-600 hover:bg-purple-50'
                              }`}
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                          )}

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
                            className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                              cat.reminder_time
                                ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                                : 'text-neutral-400 hover:text-blue-600 hover:bg-blue-50'
                            }`}
                          >
                            <Clock className="w-3.5 h-3.5" />
                          </button>

                          {/* Archive Category (Soft Delete) */}
                          <button
                            type="button"
                            id={`btn-archive-category-${cat.id}`}
                            onClick={() => handleArchive(cat)}
                            title={`Archive "${cat.name}"`}
                            className="p-2 text-neutral-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors cursor-pointer"
                          >
                            <Archive className="w-3.5 h-3.5" />
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
                              className="text-[10px] text-neutral-500 hover:text-neutral-800 cursor-pointer"
                            >
                              Disable
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5 self-end sm:self-auto">
                            <button
                              type="button"
                              onClick={() => setEditingReminderCatId(null)}
                              className="px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-200 rounded-lg cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveReminderTime(cat)}
                              disabled={isUpdatingReminder}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-2xs cursor-pointer"
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
                    </Reorder.Item>
                  );
                })}
              </Reorder.Group>
            )}
          </div>

          {/* Collapsible Archived Categories Section */}
          <div className="pt-3 border-t border-neutral-200/80">
            <button
              type="button"
              id="btn-toggle-archived-categories"
              onClick={() => setShowArchived(!showArchived)}
              className="flex items-center justify-between w-full py-2.5 px-3 text-xs font-bold text-neutral-600 hover:text-neutral-900 bg-neutral-100/70 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Archive className="w-3.5 h-3.5 text-neutral-500" />
                <span>Archived Categories ({archivedCategories.length})</span>
              </div>
              {showArchived ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            {showArchived && (
              <div className="space-y-2 mt-2.5">
                {archivedCategories.length === 0 ? (
                  <div className="text-center py-4 text-xs text-neutral-400 italic bg-neutral-50/50 rounded-xl border border-neutral-200/60">
                    No archived categories.
                  </div>
                ) : (
                  archivedCategories.map((cat) => (
                    <div
                      key={cat.id}
                      className="p-3 rounded-2xl border border-neutral-200 bg-neutral-50/60 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 opacity-60">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0"
                          style={{ backgroundColor: cat.color_code }}
                        >
                          <CategoryIcon
                            name={cat.icon}
                            categoryName={cat.name}
                            className="w-3.5 h-3.5 text-white"
                          />
                        </div>
                        <div>
                          <span className="font-bold text-neutral-800 line-through block">
                            {cat.name}
                          </span>
                          <span className="text-[10px] text-neutral-400">Archived</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleRestore(cat)}
                          className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restore</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setCategoryToDelete(cat)}
                          className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title={`Permanently delete "${cat.name}"`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-100 flex justify-end bg-neutral-50/70">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
