import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, ZoomIn } from 'lucide-react';
import { resolvePhotoUrl } from '../utils/photoUtils';
import { DailyLog } from '../types';

interface ActivityPhotoProps {
  log: DailyLog;
  categoryName?: string;
  selectedDate?: string;
  onViewPhoto: (url: string, title?: string) => void;
  className?: string;
  aspectRatio?: 'landscape' | 'square';
}

export const ActivityPhoto: React.FC<ActivityPhotoProps> = ({
  log,
  categoryName = 'Activity',
  selectedDate = '',
  onViewPhoto,
  className = '',
  aspectRatio = 'landscape',
}) => {
  // Always prioritize base64 photo_data for instant rendering without network errors
  const initialUrl = log.photo_data || resolvePhotoUrl(log);
  
  const [photoSrc, setPhotoSrc] = useState<string | null>(initialUrl);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const resolved = log.photo_data || resolvePhotoUrl(log);
    setPhotoSrc(resolved);
    setHasError(false);
    setIsLoading(true);
  }, [log.photo_url, log.photo_storage_path, log.local_photo, log.photo_data]);

  const handleImageError = () => {
    // Fallback to storage path/URL if base64 fails
    const fallback = resolvePhotoUrl(log);
    if (fallback && photoSrc !== fallback) {
      setPhotoSrc(fallback);
      setHasError(false);
      setIsLoading(true);
      return;
    }
    setHasError(true);
    setIsLoading(false);
  };

  if (hasError || !photoSrc) {
    return null;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent parent container event propagation
    onViewPhoto(photoSrc, `${categoryName} (${selectedDate})`);
  };

  return (
    <div 
      onClick={handleClick}
      className={`relative rounded-xl overflow-hidden bg-neutral-900 border border-neutral-200/85 group cursor-pointer shadow-xs ${className}`}
      title="Click to view full screen"
    >
      {isLoading && (
        <div className="absolute inset-0 bg-neutral-100 animate-pulse flex items-center justify-center z-10">
          <ImageIcon className="w-5 h-5 text-neutral-400" />
        </div>
      )}
      <img
        src={photoSrc}
        alt={categoryName}
        crossOrigin="anonymous"
        onLoad={() => setIsLoading(false)}
        onError={handleImageError}
        className={`w-full object-cover group-hover:scale-105 transition-transform duration-300 ${
          aspectRatio === 'square' ? 'h-24 sm:h-28' : 'h-40 sm:h-48'
        }`}
      />
      <div className="absolute bottom-2 right-2 p-1.5 bg-black/70 hover:bg-black text-white rounded-lg backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 z-20">
        <ZoomIn className="w-3.5 h-3.5" />
        <span className="text-[10px] font-semibold pr-0.5">Zoom</span>
      </div>
    </div>
  );
};