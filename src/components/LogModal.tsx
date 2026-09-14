import React, { useState, useRef, useEffect } from 'react';
import { Category, DailyLog } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { IconPicker } from './IconPicker';
import { compressImage } from '../utils/imageCompressor';
import {
  X,
  Upload,
  Camera,
  Image as ImageIcon,
  Check,
  Calendar,
  Sparkles,
  Loader2,
  PlusCircle,
  Trash2,
  Settings2,
  Pencil,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface LogModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  selectedDate: string;
  editingLog?: DailyLog | null;
  onSaveLog: (formData: FormData) => Promise<void>;
  onAddCategory: (category: {
    name: string;
    color_code: string;
    icon: string;
    reminder_time?: string | null;
    is_on_this_day?: boolean;
  }) => Promise<Category>;
  onDeleteCategory?: (id: string) => Promise<void>;
  onOpenCategoryManager?: () => void;
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
];

export const LogModal: React.FC<LogModalProps> = ({
  isOpen,
  onClose,
  categories,
  selectedDate,
  editingLog,
  onSaveLog,
  onAddCategory,
  onDeleteCategory,
  onOpenCategoryManager,
}) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [logDate, setLogDate] = useState<string>(selectedDate);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New category creation state
  const [isCreatingCategory, setIsCreatingCategory] = useState<boolean>(false);
  const [newCatName, setNewCatName] = useState<string>('');
  const [newCatColor, setNewCatColor] = useState<string>('#8b5cf6');
  const [newCatIcon, setNewCatIcon] = useState<string>('Sparkles');
  const [isSavingCategory, setIsSavingCategory] = useState<boolean>(false);

  // Quick delete state in modal
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);

  // Photo compression & data state
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState<boolean>(false);
  const [isPhotoRemoved, setIsPhotoRemoved] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isNotesExpanded, setIsNotesExpanded] = useState<boolean>(false);
  const prevIsOpenRef = useRef<boolean>(false);

  // Auto-grow textarea with content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const minH = isNotesExpanded ? 280 : 140;
      textareaRef.current.style.height = `${Math.max(textareaRef.current.scrollHeight, minH)}px`;
    }
  }, [notes, isNotesExpanded]);

  // Reset and initialize only when modal transitions from closed to open
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      if (editingLog) {
        setLogDate(editingLog.log_date);
        setSelectedCategoryId(editingLog.category_id);
        setNotes(editingLog.notes || '');
        setPhotoFile(null);
        setPhotoPreview(editingLog.photo_url || editingLog.photo_data || null);
        setPhotoDataUrl(editingLog.photo_data || null);
        setIsPhotoRemoved(false);
        setIsCompressingPhoto(false);
        setErrorMsg(null);
        setIsCreatingCategory(false);
      } else {
        // Fresh modal open: reset form inputs
        setLogDate(selectedDate);
        setNotes('');
        setPhotoFile(null);
        setPhotoPreview(null);
        setPhotoDataUrl(null);
        setIsPhotoRemoved(false);
        setIsCompressingPhoto(false);
        setErrorMsg(null);
        setIsCreatingCategory(false);

        if (categories.length > 0) {
          const exists = categories.some((c) => c.id === selectedCategoryId);
          if (!exists) {
            setSelectedCategoryId(categories[0].id);
          }
        }
      }
    } else if (isOpen) {
      // Modal is already open; if categories changed and current selectedCategoryId is invalid, fallback
      if (categories.length > 0) {
        const exists = categories.some((c) => c.id === selectedCategoryId);
        if (!exists && !selectedCategoryId) {
          setSelectedCategoryId(categories[0].id);
        }
      }
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, selectedDate, categories, selectedCategoryId, editingLog]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setIsCompressingPhoto(true);
        setIsPhotoRemoved(false);
        setErrorMsg(null);
        // Compress image to standard JPEG (max 1600px, quality 0.82)
        const compressed = await compressImage(file, 1600, 0.82);
        // Wrap as File/Blob with proper name and MIME type
        const compressedFile = new File([compressed.blob], 'activity_photo.jpg', {
          type: 'image/jpeg',
        });
        setPhotoFile(compressedFile);
        setPhotoDataUrl(compressed.dataUrl);
        setPhotoPreview(compressed.dataUrl);
      } catch (err: any) {
        console.warn('Image compression fallback:', err);
        setPhotoFile(file);
        const previewUrl = URL.createObjectURL(file);
        setPhotoPreview(previewUrl);
      } finally {
        setIsCompressingPhoto(false);
      }
    }
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoDataUrl(null);
    setIsPhotoRemoved(true);
    if (photoPreview && photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      setIsSavingCategory(true);
      setErrorMsg(null);
      const created = await onAddCategory({
        name: newCatName.trim(),
        color_code: newCatColor,
        icon: newCatIcon,
      });
      setSelectedCategoryId(created.id);
      setIsCreatingCategory(false);
      setNewCatName('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create category');
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategoryQuick = async (e: React.MouseEvent, catId: string) => {
    e.stopPropagation();
    if (!onDeleteCategory) return;
    try {
      setDeletingCatId(catId);
      setErrorMsg(null);
      await onDeleteCategory(catId);
      if (selectedCategoryId === catId) {
        const remaining = categories.filter((c) => c.id !== catId);
        if (remaining.length > 0) {
          setSelectedCategoryId(remaining[0].id);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete category');
    } finally {
      setDeletingCatId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategoryId) {
      setErrorMsg('Please select a category.');
      return;
    }
    if (!logDate) {
      setErrorMsg('Please select a date.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const formData = new FormData();
      if (editingLog) {
        formData.append('id', editingLog.id);
      }
      formData.append('category_id', selectedCategoryId);
      formData.append('log_date', logDate);
      if (notes.trim()) {
        formData.append('notes', notes.trim());
      }
      if (photoFile) {
        formData.append('photo', photoFile);
      }
      if (photoDataUrl) {
        formData.append('photo_data', photoDataUrl);
      }
      if (isPhotoRemoved) {
        formData.append('remove_photo', 'true');
      } else if (editingLog && !photoFile && (editingLog.photo_url || editingLog.photo_data)) {
        formData.append('keep_existing_photo', 'true');
      }

      await onSaveLog(formData);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save daily log.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-md transition-opacity animate-in fade-in duration-200">
      <div
        id="modal-log-activity"
        className={`glass-modal rounded-3xl w-full transition-all duration-200 overflow-hidden flex flex-col max-h-[92vh] ${
          isNotesExpanded ? 'max-w-2xl' : 'max-w-xl'
        }`}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-white/60 flex items-center justify-between bg-white/40 backdrop-blur-sm">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-xs ${
              editingLog
                ? 'bg-gradient-to-br from-amber-600 to-orange-600'
                : 'bg-gradient-to-br from-blue-600 to-indigo-600'
            }`}>
              {editingLog ? <Pencil className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900 leading-tight">
                {editingLog ? 'Edit Activity Log' : 'Log Daily Activity'}
              </h3>
              <p className="text-xs text-neutral-500 font-medium">
                {editingLog ? 'Update details, timestamp, or photos for this record' : 'Record your work, fitness, reading, and habits'}
              </p>
            </div>
          </div>
          <button
            id="btn-close-log-modal"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-white/60 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4 no-scrollbar flex-1">
          {errorMsg && (
            <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl">
              {errorMsg}
            </div>
          )}

          {/* 1. Date Selector Field */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              Activity Date
            </label>
            <input
              id="input-log-date"
              type="date"
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-medium text-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              required
            />
          </div>

          {/* 2. Category Selection Grid */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600">
                Select Category *
              </label>
              <div className="flex items-center gap-2">
                {onOpenCategoryManager && (
                  <button
                    type="button"
                    onClick={onOpenCategoryManager}
                    className="text-xs font-semibold text-neutral-500 hover:text-neutral-800 flex items-center gap-1"
                  >
                    <Settings2 className="w-3 h-3" />
                    Manage
                  </button>
                )}
                <button
                  type="button"
                  id="btn-toggle-new-category"
                  onClick={() => setIsCreatingCategory(!isCreatingCategory)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  {isCreatingCategory ? 'Close' : '+ New Category'}
                </button>
              </div>
            </div>

            {/* Custom Category Creation Panel with IconPicker */}
            {isCreatingCategory && (
              <div className="mb-3 p-4 bg-blue-50/60 rounded-2xl border border-blue-200/80 space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900">
                    Create Custom Category & Icon
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsCreatingCategory(false)}
                    className="text-neutral-400 hover:text-neutral-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-neutral-600 block mb-1">
                    Category Name
                  </label>
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="e.g. Meditation, Language, Guitar, Writing..."
                    className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-neutral-600 block mb-1">
                    Color
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewCatColor(c)}
                        className={`w-6 h-6 rounded-full transition-transform ${
                          newCatColor === c ? 'ring-2 ring-offset-1 ring-blue-600 scale-110' : ''
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <input
                      type="color"
                      value={newCatColor}
                      onChange={(e) => setNewCatColor(e.target.value)}
                      className="w-6 h-6 p-0 border-0 rounded-full cursor-pointer bg-transparent"
                    />
                  </div>
                </div>

                {/* Rich IconPicker */}
                <div>
                  <label className="text-[11px] font-semibold text-neutral-600 block mb-1">
                    Select Icon or Emoji
                  </label>
                  <IconPicker
                    selectedIcon={newCatIcon}
                    onSelectIcon={setNewCatIcon}
                    accentColor={newCatColor}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCreatingCategory(false)}
                    className="px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 rounded-xl font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateCategory}
                    disabled={!newCatName.trim() || isSavingCategory}
                    className="px-4 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 shadow-xs"
                  >
                    {isSavingCategory ? 'Adding...' : 'Add Category'}
                  </button>
                </div>
              </div>
            )}

            {/* Compact, Scrollable Grid of Active Categories */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-40 sm:max-h-48 overflow-y-auto p-1.5 rounded-2xl border border-neutral-200/70 bg-neutral-50/50">
              {categories.map((cat) => {
                const isSelected = selectedCategoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    id={`category-btn-${cat.id}`}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all text-center relative gap-1.5 group ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/90 shadow-2xs ring-2 ring-blue-600/30'
                        : 'border-neutral-200/80 bg-white hover:bg-neutral-50 hover:border-neutral-300'
                    }`}
                  >
                    <div
                      className="w-7 h-7 sm:w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 shadow-2xs"
                      style={{ backgroundColor: cat.color_code }}
                    >
                      <CategoryIcon name={cat.icon} className="w-3.5 h-3.5 sm:w-4 h-4 text-white" />
                    </div>
                    <span className="text-[11px] font-bold text-neutral-800 leading-tight truncate w-full text-center px-0.5">
                      {cat.name}
                    </span>

                    {/* Delete category icon button */}
                    {onDeleteCategory && (
                      <span
                        role="button"
                        onClick={(e) => handleDeleteCategoryQuick(e, cat.id)}
                        title={`Delete category "${cat.name}"`}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all absolute top-1 left-1"
                      >
                        <Trash2 className="w-3 h-3" />
                      </span>
                    )}

                    {isSelected && (
                      <div className="absolute top-1 right-1 w-3.5 h-3.5 bg-blue-600 rounded-full flex items-center justify-center text-white shrink-0">
                        <Check className="w-2 h-2 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {categories.length === 0 && (
              <div className="p-4 text-center text-xs text-neutral-500 bg-neutral-50 rounded-2xl border border-neutral-200">
                No categories found. Click "+ New Category" above to create your first category!
              </div>
            )}
          </div>

          {/* 3. Generous, Expandable Notes & Reflections Area */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700 flex items-center gap-1.5">
                <span>Notes & Reflections</span>
                <span className="text-[10px] font-normal text-neutral-400 lowercase">(optional)</span>
              </label>
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-[10px] sm:text-[11px] text-neutral-400 font-medium">
                  {notes.length} chars {notes.trim() ? `• ${notes.trim().split(/\s+/).length}w` : ''}
                </span>
                <button
                  type="button"
                  id="btn-toggle-expand-notes"
                  onClick={() => setIsNotesExpanded(!isNotesExpanded)}
                  title={isNotesExpanded ? 'Collapse notes area' : 'Expand notes area for focused writing'}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50/80 hover:bg-blue-100/80 px-2 py-0.5 rounded-lg border border-blue-200/60 transition-colors cursor-pointer"
                >
                  {isNotesExpanded ? (
                    <>
                      <Minimize2 className="w-3 h-3" />
                      <span>Compact</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3 h-3" />
                      <span>Expand</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            <textarea
              ref={textareaRef}
              id="input-log-notes"
              rows={isNotesExpanded ? 12 : 6}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What did you work on, read, or accomplish? Write your notes, reflections, insights, or details in Gujarati or English..."
              className={`w-full px-4 py-3 bg-white border border-neutral-200 rounded-2xl text-sm sm:text-base text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-y leading-relaxed font-sans shadow-2xs ${
                isNotesExpanded ? 'min-h-[280px] sm:min-h-[360px]' : 'min-h-[140px] sm:min-h-[170px]'
              }`}
            />
          </div>

          {/* 4. Compact Photo Upload Area */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 mb-1.5">
              Attach Photo / Snapshot (Optional)
            </label>

            {isCompressingPhoto ? (
              <div className="border border-neutral-200 rounded-2xl p-4 text-center flex flex-col items-center justify-center gap-1.5 bg-neutral-50">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                <span className="text-xs font-semibold text-neutral-700">
                  Optimizing photo for mobile...
                </span>
              </div>
            ) : photoPreview ? (
              <div className="relative rounded-2xl overflow-hidden border border-neutral-200 bg-neutral-900 group">
                <img
                  src={photoPreview}
                  alt="Upload preview"
                  className="w-full h-36 object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                />
                <button
                  type="button"
                  id="btn-remove-photo"
                  onClick={handleRemovePhoto}
                  className="absolute top-2.5 right-2.5 p-1.5 bg-black/70 hover:bg-red-600 text-white rounded-full transition-colors backdrop-blur-xs"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 text-white text-[10px] font-medium rounded-md backdrop-blur-xs flex items-center gap-1">
                  <ImageIcon className="w-3 h-3" />
                  {photoFile?.name || 'Photo Attached'}
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border border-dashed border-neutral-300 hover:border-blue-500 hover:bg-blue-50/20 rounded-xl px-3.5 py-2.5 cursor-pointer transition-all flex items-center justify-between gap-3 bg-neutral-50/70 group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100 flex items-center justify-center shrink-0 transition-colors">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-semibold text-neutral-700 group-hover:text-blue-700 transition-colors">
                      Tap to attach photo or snapshot
                    </div>
                    <div className="text-[10px] text-neutral-400">
                      JPG, PNG, HEIC, WebP (auto-optimized)
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-blue-600 bg-white border border-neutral-200 px-2.5 py-1 rounded-lg shadow-2xs group-hover:bg-blue-50 transition-colors shrink-0">
                  Browse
                </span>
                <input
                  ref={fileInputRef}
                  id="input-photo-file"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            )}
          </div>

          {/* Sticky Modal Actions Footer */}
          <div className="sticky bottom-0 -mx-5 -mb-5 px-5 py-3 bg-white/95 backdrop-blur-md border-t border-neutral-100/90 flex items-center justify-end gap-3 z-10 shadow-xs">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="btn-submit-save-log"
              disabled={isSubmitting || !selectedCategoryId}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-97 disabled:opacity-60 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-sm shadow-blue-500/25 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{editingLog ? 'Updating Log...' : 'Saving to Database...'}</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{editingLog ? 'Update Log' : 'Save Log'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

