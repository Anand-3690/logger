import { supabase } from '../supabaseClient';
import { DailyLog } from '../types';

// In-memory cache for ObjectURLs created from local File/Blob objects
const objectUrlCache = new WeakMap<Blob, string>();

/**
 * Resolves a displayable image URL from any DailyLog record,
 * handling local File/Blob objects, full Supabase public URLs,
 * and relative Supabase Storage paths.
 */
export function resolvePhotoUrl(log: any): string | null {
  if (!log) return null;

  // 1. If photo_data (base64) exists, use it immediately
  if (log.photo_data && typeof log.photo_data === 'string' && log.photo_data.startsWith('data:')) {
    return log.photo_data;
  }

  // 2. Check direct photo_url if it's a valid HTTP link
  if (log.photo_url && typeof log.photo_url === 'string' && log.photo_url.startsWith('http')) {
    return log.photo_url;
  }

  // 3. Check photo_storage_path if it's already a full HTTP URL (like your working entry idx:10)
  if (log.photo_storage_path && typeof log.photo_storage_path === 'string' && log.photo_storage_path.startsWith('http')) {
    return log.photo_storage_path;
  }

  // 4. Otherwise, construct the public Supabase URL from a relative storage path
  const path = log.photo_storage_path || log.photo_url;
  if (path && typeof path === 'string') {
    const cleanPath = path.replace(/^log_photos\//, '').replace(/^\/+/, '');
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://bpvfvitncpyioaomaqsw.supabase.co';
    return `${supabaseUrl}/storage/v1/object/public/log_photos/${cleanPath}`;
  }

  return null;
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
