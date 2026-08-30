import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, ZoomIn, AlertCircle } from 'lucide-react';
import { resolvePhotoUrl, getSignedPhotoUrl } from '../utils/photoUtils';
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
  const initialUrl = resolvePhotoUrl(log);
  const [photoSrc, setPhotoSrc] = useState<string | null>(initialUrl);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSignedFallbackAttempted, setIsSignedFallbackAttempted] = useState<boolean>(false);

  useEffect(() => {
    const resolved = resolvePhotoUrl(log);
    setPhotoSrc(resolved);
    setHasError(false);
    setIsLoading(true);
    setIsSignedFallbackAttempted(false);
  }, [log.photo_url, log.photo_storage_path, log.local_photo, log.photo_data]);

  if (!photoSrc) return null;

  const handleImageError = async () => {
    // 1. If remote image failed, check if we have a local photo_data (base64) fallback
    if (log.photo_data && photoSrc !== log.photo_data) {
      setPhotoSrc(log.photo_data);
      setHasError(false);
      setIsLoading(true);
      return;
    }

    // 2. Check if local_photo Blob is present
    if (log.local_photo && log.local_photo instanceof Blob) {
      try {
        const localBlobUrl = URL.createObjectURL(log.local_photo);
        if (photoSrc !== localBlobUrl) {
          setPhotoSrc(localBlobUrl);
          setHasError(false);
          setIsLoading(true);
          return;
        }
      } catch (e) {
        console.warn('Local blob URL failed:', e);
      }
    }

    // 3. If direct public loading fails and we haven't tried a signed URL yet, try generating a signed URL
    if (!isSignedFallbackAttempted && photoSrc && !photoSrc.startsWith('data:') && !photoSrc.startsWith('blob:')) {
      setIsSignedFallbackAttempted(true);
      const signedUrl = await getSignedPhotoUrl(
        log.photo_storage_path || log.photo_url || photoSrc
      );
      if (signedUrl) {
        setPhotoSrc(signedUrl);
        setHasError(false);
        setIsLoading(true);
        return;
      }
    }
    setHasError(true);
    setIsLoading(false);
  };

  const titleText = `${categoryName} photo${selectedDate ? ` • ${selectedDate}` : ''}`;

  if (hasError) {
    return (
      <div
        className={`rounded-2xl border border-amber-200/80 bg-amber-50/50 p-3 flex items-center justify-between text-xs text-amber-800 ${className}`}
      >
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Photo unavailable or bucket restricted</span>
        </div>
        {photoSrc && (
          <a
            href={photoSrc}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] font-semibold text-blue-600 hover:underline shrink-0"
          >
            Open link
          </a>
        )}
      </div>
    );
  }

  const heightClass = aspectRatio === 'square' ? 'h-16 w-16' : 'h-48 sm:h-56 w-full';

  return (
    <div className={`relative rounded-2xl overflow-hidden group/photo select-none ${className}`}>
      {isLoading && (
        <div
          className={`absolute inset-0 bg-neutral-100 animate-pulse flex items-center justify-center ${heightClass}`}
        >
          <ImageIcon className="w-5 h-5 text-neutral-300 animate-pulse" />
        </div>
      )}

      <button
        type="button"
        onClick={() => onViewPhoto(photoSrc, titleText)}
        className="w-full h-full block focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-2xl overflow-hidden text-left"
        title="Tap to enlarge photo"
      >
        <img
          src={photoSrc}
          alt={titleText}
          loading="lazy"
          onLoad={() => setIsLoading(false)}
          onError={handleImageError}
          className={`object-cover ${heightClass} transition-transform duration-300 group-hover/photo:scale-103 bg-neutral-900`}
        />

        {/* Hover overlay hint */}
        <div className="absolute inset-0 bg-neutral-950/25 opacity-0 group-hover/photo:opacity-100 backdrop-blur-2xs transition-opacity flex items-center justify-center">
          <span className="glass-panel text-neutral-900 text-xs font-semibold px-3 py-1.5 rounded-xl shadow-md flex items-center gap-1.5 border border-white/80">
            <ZoomIn className="w-3.5 h-3.5 text-blue-600" />
            Tap to view
          </span>
        </div>
      </button>
    </div>
  );
};
