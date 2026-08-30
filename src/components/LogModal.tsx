import React, { useState, useRef, useEffect } from 'react';
import { Category } from '../types';
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
} from 'lucide-react';

interface LogModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  selectedDate: string;
  onSaveLog: (formData: FormData) => Promise<void>;
  onAddCategory: (category: {
    name: string;
    color_code: string;
    icon: string;
    reminder_time?: string | null;
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevIsOpenRef = useRef<boolean>(false);

  // Reset and initialize only when modal transitions from closed to open
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      // Fresh modal open: reset form inputs
      setLogDate(selectedDate);
      setNotes('');
      setPhotoFile(null);
      setPhotoPreview(null);
      setPhotoDataUrl(null);
      setIsCompressingPhoto(false);
      setErrorMsg(null);
      setIsCreatingCategory(false);

      if (categories.length > 0) {
        const exists = categories.some((c) => c.id === selectedCategoryId);
        if (!exists) {
          setSelectedCategoryId(categories[0].id);
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
  }, [isOpen, selectedDate, categories, selectedCategoryId]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setIsCompressingPhoto(true);
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
        className="glass-modal rounded-3xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-white/60 flex items-center justify-between bg-white/40 backdrop-blur-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900 leading-tight">
                Log Daily Activity
              </h3>
              <p className="text-xs text-neutral-500 font-medium">
                Record your work, fitness, reading, and habits
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

            {/* Grid of Active Categories */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {categories.map((cat) => {
                const isSelected = selectedCategoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    id={`category-btn-${cat.id}`}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`flex items-center sm:flex-col justify-between sm:justify-center p-3 rounded-2xl border transition-all text-left sm:text-center relative gap-2 group ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 shadow-xs ring-2 ring-blue-600/30'
                        : 'border-neutral-200/80 bg-white hover:bg-neutral-50'
                    }`}
                  >
                    <div className="flex items-center sm:flex-col gap-2.5 sm:gap-1.5">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs"
                        style={{ backgroundColor: cat.color_code }}
                      >
                        <CategoryIcon name={cat.icon} className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-xs font-bold text-neutral-800 leading-tight">
                        {cat.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Delete category icon button */}
                      {onDeleteCategory && (
                        <span
                          role="button"
                          onClick={(e) => handleDeleteCategoryQuick(e, cat.id)}
                          title={`Delete category "${cat.name}"`}
                          className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all sm:absolute sm:top-1.5 sm:left-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </span>
                      )}

                      {isSelected && (
                        <div className="sm:absolute sm:top-2 sm:right-2 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center text-white shrink-0">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                    </div>
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

          {/* 3. Optional Notes Area */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600">
                Notes & Reflections (Optional)
              </label>
              <span className="text-[11px] text-neutral-400 font-medium">
                {notes.length} characters
              </span>
            </div>
            <textarea
              id="input-log-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What did you work on, read, or accomplish during this session?"
              className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all resize-none"
            />
          </div>

          {/* 4. Photo Upload Area */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 mb-1.5">
              Attach Photo / Snapshot (Optional)
            </label>

            {isCompressingPhoto ? (
              <div className="border border-neutral-200 rounded-2xl p-6 text-center flex flex-col items-center justify-center gap-2 bg-neutral-50">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                <span className="text-xs font-semibold text-neutral-700">
                  Optimizing photo for mobile...
                </span>
              </div>
            ) : photoPreview ? (
              <div className="relative rounded-2xl overflow-hidden border border-neutral-200 bg-neutral-900 group">
                <img
                  src={photoPreview}
                  alt="Upload preview"
                  className="w-full h-40 object-cover opacity-90 group-hover:opacity-100 transition-opacity"
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
                className="border-2 border-dashed border-neutral-200 hover:border-blue-400 hover:bg-blue-50/30 rounded-2xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5"
              >
                <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Upload className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-neutral-700">
                  Tap to upload photo or take picture
                </span>
                <span className="text-[11px] text-neutral-400">
                  PNG, JPG, HEIC, WebP (auto-optimized)
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

          {/* Modal Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-neutral-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="btn-submit-save-log"
              disabled={isSubmitting || !selectedCategoryId}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-97 disabled:opacity-60 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-sm shadow-blue-500/25"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving to Database...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Log</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

