import { supabase } from '../supabaseClient';
import { DailyLog } from '../types';

// In-memory cache for ObjectURLs created from local File/Blob objects
const objectUrlCache = new WeakMap<Blob, string>();

/**
 * Resolves a displayable image URL from any DailyLog record,
 * handling local File/Blob objects, full Supabase public URLs,
 * and relative Supabase Storage paths.
 */
export function resolvePhotoUrl(
  logOrPhoto?:
    | DailyLog
    | {
        photo_url?: string | null;
        photo_storage_path?: string | null;
        photo_data?: string | null;
        local_photo?: File | Blob | null;
      }
    | string
    | null
): string | null {
  if (!logOrPhoto) return null;

  // If passed a plain string URL or path
  if (typeof logOrPhoto === 'string') {
    const trimmed = logOrPhoto.trim();
    if (!trimmed) return null;
    if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('blob:')
    ) {
      return trimmed;
    }
    const cleanPath = trimmed.replace(/^log_photos\//, '').replace(/^\/+/, '');
    const { data } = supabase.storage.from('log_photos').getPublicUrl(cleanPath);
    return data.publicUrl || null;
  }

  // If log has an un-synced or local File/Blob in IndexedDB
  if (logOrPhoto.local_photo && logOrPhoto.local_photo instanceof Blob) {
    if (objectUrlCache.has(logOrPhoto.local_photo)) {
      return objectUrlCache.get(logOrPhoto.local_photo)!;
    }
    try {
      const url = URL.createObjectURL(logOrPhoto.local_photo);
      objectUrlCache.set(logOrPhoto.local_photo, url);
      return url;
    } catch (e) {
      console.warn('Failed to create ObjectURL for local photo:', e);
    }
  }

  // If base64 data URL is stored
  if (logOrPhoto.photo_data && typeof logOrPhoto.photo_data === 'string' && logOrPhoto.photo_data.startsWith('data:')) {
    return logOrPhoto.photo_data;
  }

  // Check photo_url first, then photo_storage_path
  const target = logOrPhoto.photo_url || logOrPhoto.photo_storage_path;
  if (!target || typeof target !== 'string') {
    // Last chance fallback to photo_data
    if (logOrPhoto.photo_data) return logOrPhoto.photo_data;
    return null;
  }

  const trimmed = target.trim();
  if (!trimmed) {
    return logOrPhoto.photo_data || null;
  }

  // Already a full public/data/blob URL
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  // Relative storage path inside the Supabase bucket
  const cleanPath = trimmed.replace(/^log_photos\//, '').replace(/^\/+/, '');
  const { data } = supabase.storage.from('log_photos').getPublicUrl(cleanPath);
  return data.publicUrl || null;
}

/**
 * Attempts to retrieve a signed URL for a photo if public URL access is restricted.
 */
export async function getSignedPhotoUrl(pathOrUrl: string): Promise<string | null> {
  if (!pathOrUrl) return null;
  try {
    let storagePath = pathOrUrl;
    if (pathOrUrl.includes('/storage/v1/object/public/log_photos/')) {
      storagePath = pathOrUrl.split('/storage/v1/object/public/log_photos/')[1] || pathOrUrl;
    } else if (pathOrUrl.startsWith('log_photos/')) {
      storagePath = pathOrUrl.replace(/^log_photos\//, '');
    }

    // Generate signed URL valid for 2 hours (7200 seconds)
    const { data, error } = await supabase.storage
      .from('log_photos')
      .createSignedUrl(storagePath, 7200);

    if (error || !data?.signedUrl) {
      return null;
    }
    return data.signedUrl;
  } catch (err) {
    console.warn('Could not generate signed URL for photo:', err);
    return null;
  }
}
