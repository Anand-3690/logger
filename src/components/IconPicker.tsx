import React, { useState, useMemo } from 'react';
import {
  CategoryIcon,
  ICON_MAP,
  ICON_CATEGORIES,
  POPULAR_EMOJIS,
} from './CategoryIcon';
import { Search, Sparkles, Smile, X } from 'lucide-react';

interface IconPickerProps {
  selectedIcon: string;
  onSelectIcon: (iconName: string) => void;
  accentColor?: string;
}

export const IconPicker: React.FC<IconPickerProps> = ({
  selectedIcon,
  onSelectIcon,
  accentColor = '#3b82f6',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('All');
  const [customInput, setCustomInput] = useState('');

  const allIconsList = useMemo(() => Object.keys(ICON_MAP), []);

  const filteredIcons = useMemo(() => {
    let list = allIconsList;
    if (activeTab !== 'All' && activeTab !== 'Emojis') {
      const group = ICON_CATEGORIES.find((g) => g.name === activeTab);
      list = group ? group.icons : allIconsList;
    }

    if (!searchQuery.trim()) {
      return list;
    }

    const q = searchQuery.toLowerCase().trim();
    return list.filter((name) => name.toLowerCase().includes(q));
  }, [allIconsList, activeTab, searchQuery]);

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (customInput.trim()) {
      onSelectIcon(customInput.trim());
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-neutral-200/90 shadow-sm p-3.5 space-y-3">
      {/* Top Preview & Search */}
      <div className="flex items-center gap-2.5">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm transition-all"
          style={{ backgroundColor: accentColor }}
        >
          <CategoryIcon name={selectedIcon} className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 relative">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search icons (e.g., Code, Run, Book)..."
            className="w-full pl-8 pr-7 py-1.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-medium text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-neutral-400 hover:text-neutral-600"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 text-[11px] font-semibold text-neutral-500 border-b border-neutral-100">
        <button
          type="button"
          onClick={() => setActiveTab('All')}
          className={`px-2.5 py-1 rounded-md transition-all whitespace-nowrap ${
            activeTab === 'All'
              ? 'bg-neutral-900 text-white shadow-xs'
              : 'hover:bg-neutral-100 text-neutral-600'
          }`}
        >
          All ({allIconsList.length})
        </button>
        {ICON_CATEGORIES.map((cat) => (
          <button
            key={cat.name}
            type="button"
            onClick={() => setActiveTab(cat.name)}
            className={`px-2 py-1 rounded-md transition-all whitespace-nowrap ${
              activeTab === cat.name
                ? 'bg-neutral-900 text-white shadow-xs'
                : 'hover:bg-neutral-100 text-neutral-600'
            }`}
          >
            {cat.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setActiveTab('Emojis')}
          className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 whitespace-nowrap ${
            activeTab === 'Emojis'
              ? 'bg-neutral-900 text-white shadow-xs'
              : 'hover:bg-neutral-100 text-neutral-600'
          }`}
        >
          <Smile className="w-3 h-3" />
          Emojis
        </button>
      </div>

      {/* Icons Grid */}
      {activeTab === 'Emojis' ? (
        <div className="grid grid-cols-8 gap-1.5 max-h-36 overflow-y-auto p-1 no-scrollbar">
          {POPULAR_EMOJIS.map((emoji) => {
            const isSelected = selectedIcon === emoji;
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => onSelectIcon(emoji)}
                className={`p-2 rounded-xl text-lg flex items-center justify-center transition-all ${
                  isSelected
                    ? 'bg-blue-100 ring-2 ring-blue-600 scale-110 shadow-xs'
                    : 'bg-neutral-50 hover:bg-neutral-100 border border-neutral-200/60'
                }`}
              >
                {emoji}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5 max-h-36 overflow-y-auto p-1 no-scrollbar">
          {filteredIcons.map((iconName) => {
            const isSelected = selectedIcon === iconName;
            return (
              <button
                key={iconName}
                type="button"
                onClick={() => onSelectIcon(iconName)}
                title={iconName}
                className={`p-2 rounded-xl flex items-center justify-center transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-600/30 scale-105'
                    : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border border-neutral-200/70 hover:border-neutral-300'
                }`}
              >
                <CategoryIcon name={iconName} className="w-4 h-4" />
              </button>
            );
          })}
          {filteredIcons.length === 0 && (
            <div className="col-span-full py-4 text-center text-xs text-neutral-400">
              No matching icons found. Try custom emoji or icon below.
            </div>
          )}
        </div>
      )}

      {/* Custom Emoji / Text Input */}
      <form onSubmit={handleApplyCustom} className="pt-2 border-t border-neutral-100 flex items-center gap-1.5">
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          placeholder="Paste any emoji (e.g. 🧘, 🎸, 🚀)"
          maxLength={10}
          className="flex-1 px-2.5 py-1 text-xs bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={!customInput.trim()}
          className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-900 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          Use
        </button>
      </form>
    </div>
  );
};
