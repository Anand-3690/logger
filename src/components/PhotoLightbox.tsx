import React from 'react';
import { X, Download, ExternalLink } from 'lucide-react';

interface PhotoLightboxProps {
  url: string | null;
  title?: string;
  onClose: () => void;
}

export const PhotoLightbox: React.FC<PhotoLightboxProps> = ({ url, title, onClose }) => {
  if (!url) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative max-w-3xl w-full max-h-[90vh] flex flex-col items-center">
        {/* Top Control Bar */}
        <div className="w-full flex items-center justify-between text-white mb-3 px-1">
          <span className="text-xs sm:text-sm font-semibold truncate max-w-xs sm:max-w-md">
            {title || 'Activity Photo'}
          </span>
          <div className="flex items-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              title="Open full size in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              title="Close image preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Image Display */}
        <div className="relative rounded-2xl overflow-hidden bg-neutral-900 border border-white/10 max-h-[75vh] flex items-center justify-center">
          <img
            src={url}
            alt={title || 'Activity photo'}
            className="max-h-[75vh] max-w-full object-contain rounded-xl"
          />
        </div>
      </div>
    </div>
  );
};
