import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DailyLog, Category } from '../types';
import {
  Search,
  X,
  Calendar,
  Sparkles,
  ArrowRight,
  Clock,
  ImageIcon,
  Tag,
  History,
  CornerDownLeft,
} from 'lucide-react';
import { CategoryIcon } from './CategoryIcon';
import { formatMediumDate } from '../utils/dateUtils';
import { resolvePhotoUrl } from '../utils/photoUtils';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: DailyLog[];
  categories: Category[];
  onSelectLog: (log: DailyLog) => void;
  onViewPhoto?: (url: string, title?: string) => void;
}

/**
 * Calculates relative time distance (e.g. "2 years ago today", "1 year ago", "Today")
 */
function getRelativeTimeBadge(dateStr: string): string | null {
  if (!dateStr || !dateStr.includes('-')) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const now = new Date();
  const curY = now.getFullYear();
  const curM = now.getMonth() + 1;
  const curD = now.getDate();

  if (y === curY && m === curM && d === curD) {
    return 'Today';
  }

  const deltaYears = curY - y;
  if (deltaYears > 0 && m === curM && d === curD) {
    return deltaYears === 1 ? '1 yr ago today' : `${deltaYears} yrs ago today`;
  }
  if (deltaYears > 0) {
    return deltaYears === 1 ? '1 yr ago' : `${deltaYears} yrs ago`;
  }
  return null;
}

/**
 * Extracts a relevant snippet around the matched search term and renders it with <mark> highlights.
 * Fully supports English, numbers, and Gujarati Unicode scripts.
 */
function renderHighlightedSnippet(text: string, query: string): React.ReactNode {
  if (!text) return null;
  if (!query || !query.trim()) {
    return text.length > 180 ? `${text.slice(0, 180)}...` : text;
  }

  const normalizedText = text.normalize('NFC');
  const normalizedQuery = query.trim().normalize('NFC').toLowerCase();
  const lowerText = normalizedText.toLowerCase();

  const matchIdx = lowerText.indexOf(normalizedQuery);
  if (matchIdx === -1) {
    return text.length > 180 ? `${text.slice(0, 180)}...` : text;
  }

  const start = Math.max(0, matchIdx - 45);
  const end = Math.min(normalizedText.length, matchIdx + normalizedQuery.length + 120);

  const prefix = start > 0 ? `...${normalizedText.slice(start, matchIdx)}` : normalizedText.slice(start, matchIdx);
  const matchedTerm = normalizedText.slice(matchIdx, matchIdx + normalizedQuery.length);
  const suffix = end < normalizedText.length ? `${normalizedText.slice(matchIdx + normalizedQuery.length, end)}...` : normalizedText.slice(matchIdx + normalizedQuery.length, end);

  return (
    <span>
      {prefix}
      <mark className="bg-amber-200 text-amber-950 font-bold px-1 py-0.5 rounded text-inherit shadow-2xs">
        {matchedTerm}
      </mark>
      {suffix}
    </span>
  );
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  logs,
  categories,
  onSelectLog,
  onViewPhoto,
}) => {
  const [query, setQuery] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedCategoryId('all');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Map category by ID for fast lookups
  const categoryMap = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c]));
  }, [categories]);

  // Filter logs according to query and selected category
  const searchResults = useMemo(() => {
    if (!logs || logs.length === 0) return [];

    const cleanQuery = query.trim().normalize('NFC').toLowerCase();

    return logs
      .filter((log) => {
        // Category scope filter
        if (selectedCategoryId !== 'all' && log.category_id !== selectedCategoryId) {
          return false;
        }

        if (!cleanQuery) return true;

        const cat = categoryMap.get(log.category_id);
        const catName = cat?.name?.normalize('NFC').toLowerCase() || '';
        const notes = log.notes?.normalize('NFC').toLowerCase() || '';
        const dateStr = log.log_date || '';

        return (
          notes.includes(cleanQuery) ||
          catName.includes(cleanQuery) ||
          dateStr.includes(cleanQuery)
        );
      })
      .sort((a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime());
  }, [logs, query, selectedCategoryId, categoryMap]);

  // Keep selected index within valid bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, selectedCategoryId]);

  // Scroll active item into view
  useEffect(() => {
    if (!listContainerRef.current) return;
    const activeItem = listContainerRef.current.querySelector(
      `[data-result-index="${selectedIndex}"]`
    );
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, Math.max(0, searchResults.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults.length > 0 && searchResults[selectedIndex]) {
        onSelectLog(searchResults[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-sm flex items-start justify-center p-3 sm:p-6 sm:pt-16 animate-in fade-in duration-150"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="w-full max-w-2xl bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/80 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header Row */}
        <div className="p-3.5 sm:p-4 border-b border-neutral-200/80 flex items-center gap-3 bg-white/70">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Search className="w-5 h-5" />
          </div>

          <div className="flex-1 relative">
            <input
              ref={inputRef}
              id="input-global-search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search past memories, notes, dates (YYYY-MM-DD), or categories..."
              className="w-full bg-transparent text-sm sm:text-base font-semibold text-neutral-900 placeholder:text-neutral-400 focus:outline-none pr-8"
            />
            {query && (
              <button
                type="button"
                id="btn-clear-global-search"
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-700 rounded-full"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            <kbd className="px-2 py-1 bg-neutral-100 border border-neutral-200 text-[11px] font-semibold text-neutral-500 rounded-lg shadow-2xs">
              ESC
            </kbd>
          </div>

          <button
            id="btn-close-global-search"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors sm:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Filter Pills */}
        <div className="px-3.5 sm:px-4 py-2.5 bg-neutral-50/70 border-b border-neutral-200/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedCategoryId('all')}
            className={`px-2.5 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              selectedCategoryId === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white hover:bg-neutral-100 text-neutral-600 border border-neutral-200/70'
            }`}
          >
            <span>All Categories</span>
          </button>

          {categories.map((cat) => {
            const isSelected = selectedCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'text-white shadow-xs'
                    : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200/70'
                }`}
                style={{
                  backgroundColor: isSelected ? cat.color_code || '#3b82f6' : undefined,
                }}
              >
                <CategoryIcon name={cat.icon || 'Tag'} className="w-3.5 h-3.5" />
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>

        {/* Results Count & Shortcut Hints */}
        <div className="px-4 py-2 text-[11px] font-semibold text-neutral-500 flex items-center justify-between border-b border-neutral-100 bg-neutral-50/40">
          <div className="flex items-center gap-2">
            <span>
              {searchResults.length === 1
                ? '1 entry found'
                : `${searchResults.length} entries found`}
            </span>
            {query.trim() && (
              <span className="text-neutral-400">
                matching &quot;{query}&quot;
              </span>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-2 text-neutral-400 text-[10px]">
            <span>↑↓ Navigate</span>
            <span>↵ Select Date</span>
          </div>
        </div>

        {/* Results List */}
        <div
          ref={listContainerRef}
          className="overflow-y-auto flex-1 p-2 sm:p-3 divide-y divide-neutral-100"
        >
          {searchResults.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center mx-auto">
                <Search className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-neutral-800">
                No matching logs found
              </h4>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
                Try searching for Gujarati keywords (e.g. દર્શન, પૂજા, સભા), full or partial dates (e.g. 2024-09, 2023), or clear category filters.
              </p>
            </div>
          ) : (
            searchResults.map((log, index) => {
              const cat = categoryMap.get(log.category_id);
              const isItemActive = index === selectedIndex;
              const relativeBadge = getRelativeTimeBadge(log.log_date);
              const resolvedPhoto = resolvePhotoUrl(log);

              return (
                <div
                  key={log.id}
                  data-result-index={index}
                  onClick={() => onSelectLog(log)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`p-3 rounded-xl transition-all cursor-pointer flex items-start justify-between gap-3 group ${
                    isItemActive
                      ? 'bg-blue-50/80 shadow-xs border border-blue-200/80'
                      : 'hover:bg-neutral-50/80 border border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* Category Icon Badge */}
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs mt-0.5"
                      style={{ backgroundColor: cat?.color_code || '#64748b' }}
                    >
                      <CategoryIcon name={cat?.icon || 'Tag'} className="w-4 h-4 text-white" />
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      {/* Top Meta: Category Name & Date */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-neutral-900">
                          {cat?.name || 'Uncategorized'}
                        </span>

                        <span className="text-[11px] text-neutral-500 font-medium flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-neutral-400" />
                          {formatMediumDate(log.log_date)}
                        </span>

                        {relativeBadge && (
                          <span className="px-1.5 py-0.5 rounded-md bg-purple-100/80 text-purple-700 text-[10px] font-bold">
                            {relativeBadge}
                          </span>
                        )}
                      </div>

                      {/* Excerpt with Highlight */}
                      <p className="text-xs text-neutral-700 leading-relaxed break-words font-medium">
                        {renderHighlightedSnippet(log.notes || 'No description recorded.', query)}
                      </p>
                    </div>
                  </div>

                  {/* Thumbnail / Action Indicator */}
                  <div className="flex items-center gap-2 shrink-0 self-center">
                    {resolvedPhoto && (
                      <div
                        onClick={(e) => {
                          if (onViewPhoto) {
                            e.stopPropagation();
                            onViewPhoto(resolvedPhoto, `${cat?.name} - ${log.log_date}`);
                          }
                        }}
                        className="w-10 h-10 rounded-lg overflow-hidden border border-neutral-200 hover:ring-2 hover:ring-blue-500 transition-all cursor-zoom-in shrink-0 bg-neutral-100"
                        title="Click to view full photo"
                      >
                        <img
                          src={resolvedPhoto}
                          alt="Log Attachment"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                        isItemActive
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-neutral-400 group-hover:text-neutral-700 bg-neutral-100/60'
                      }`}
                    >
                      <CornerDownLeft className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-neutral-200/80 bg-neutral-50/70 flex items-center justify-between text-xs text-neutral-500">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-semibold text-neutral-700">Instant Offline Search</span>
            <span className="hidden sm:inline text-neutral-400">
              • Sub-millisecond Dexie query with Gujarati Unicode support
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-white hover:bg-neutral-100 text-neutral-700 font-semibold rounded-lg border border-neutral-200 text-xs shadow-2xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
