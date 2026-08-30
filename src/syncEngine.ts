import { db } from './db';
import { supabase } from './supabaseClient';

let isSyncing = false;
let isPulling = false;

// Helper to convert base64 data URL to a JPEG Blob
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return await res.blob();
}

/**
 * Robust, schema-adaptive upsert helper.
 * Automatically detects if any column (e.g. photo_url, photo_data, photo_storage_path, updated_at)
 * is missing from the user's remote PostgreSQL schema, strips it, and retries until success.
 */
async function adaptiveUpsert(
  table: string,
  initialPayload: Record<string, any>,
  options?: { onConflict?: string }
): Promise<{ error: any }> {
  const payload = { ...initialPayload };
  let attempts = 0;
  const maxAttempts = Object.keys(payload).length + 1;

  while (attempts < maxAttempts) {
    attempts++;
    const { error } = await supabase.from(table).upsert(payload, options);
    if (!error) {
      return { error: null };
    }

    // Check if error is due to missing column (PGRST204 or message matching missing column pattern)
    const msg = error.message || '';
    const match = msg.match(/Could not find the '([^']+)' column/i);
    let removedAny = false;

    if (match && match[1] && payload[match[1]] !== undefined) {
      const missingCol = match[1];
      console.warn(`[SyncEngine] Column '${missingCol}' not found in Supabase table '${table}', pruning from payload and retrying...`);
      delete payload[missingCol];
      removedAny = true;
    }

    // Check common optional columns if mentioned in error
    const candidateColumns = ['photo_url', 'photo_data', 'photo_storage_path', 'updated_at', 'reminder_time', 'notes', 'status', 'icon', 'color_code', 'is_active'];
    for (const col of candidateColumns) {
      if (msg.toLowerCase().includes(col) && payload[col] !== undefined) {
        delete payload[col];
        removedAny = true;
      }
    }

    if (removedAny) {
      continue;
    }

    // Non-column error (e.g. network/auth/FK issue)
    return { error };
  }

  return { error: new Error(`Failed to upsert to ${table} after adapting columns.`) };
}

/**
 * Push pending local mutations (upserts / deletes) to Supabase.
 */
export const processSyncQueue = async () => {
  if (isSyncing || !navigator.onLine) return;
  isSyncing = true;

  try {
    const queue = await db.syncQueue.orderBy('timestamp').toArray();

    if (queue.length === 0) {
      isSyncing = false;
      return;
    }

    console.log(`[SyncEngine] Processing ${queue.length} queued items...`);

    for (const item of queue) {
      try {
        if (item.action === 'upsert') {
          if (item.table === 'categories') {
            const record = await db.categories.get(item.id);
            if (record) {
              const { error } = await adaptiveUpsert('categories', {
                id: record.id,
                name: record.name,
                color_code: record.color_code,
                icon: record.icon,
                reminder_time: record.reminder_time || null,
                is_active: record.is_active ?? true,
              });
              if (error) throw error;
            }
          } else if (item.table === 'daily_logs') {
            const record = await db.dailyLogs.get(item.id);
            if (record) {
              // Ensure parent category exists in Supabase before creating daily_log (FK constraint pre-flight)
              if (record.category_id) {
                const parentCat = await db.categories.get(record.category_id);
                if (parentCat) {
                  await adaptiveUpsert('categories', {
                    id: parentCat.id,
                    name: parentCat.name,
                    color_code: parentCat.color_code,
                    icon: parentCat.icon,
                    reminder_time: parentCat.reminder_time || null,
                    is_active: parentCat.is_active ?? true,
                  });
                }
              }

              let cloudPhotoUrl = record.photo_url && record.photo_url.startsWith('http') ? record.photo_url : null;
              let photoStoragePath = record.photo_storage_path || null;
              let uploadSucceeded = false;

              // 1. Process and upload photo to Supabase Storage if local photo/data exists
              const rawPhoto = (record as any).local_photo;
              const rawDataUrl = (record as any).photo_data;

              if (rawPhoto || rawDataUrl) {
                try {
                  let uploadBlob: Blob | null = null;
                  if (rawPhoto && rawPhoto instanceof Blob) {
                    uploadBlob = rawPhoto;
                  } else if (rawDataUrl && typeof rawDataUrl === 'string' && rawDataUrl.startsWith('data:')) {
                    uploadBlob = await dataUrlToBlob(rawDataUrl);
                  }

                  if (uploadBlob) {
                    const filePath = `${record.category_id}/${record.id}.jpg`;

                    const { error: uploadError } = await supabase.storage
                      .from('log_photos')
                      .upload(filePath, uploadBlob, {
                        contentType: 'image/jpeg',
                        cacheControl: '3600',
                        upsert: true,
                      });

                    if (uploadError) {
                      console.warn('[Sync] Supabase Storage upload error:', uploadError.message || uploadError);
                    } else {
                      uploadSucceeded = true;
                      photoStoragePath = filePath;

                      const { data: publicUrlData } = supabase.storage
                        .from('log_photos')
                        .getPublicUrl(filePath);

                      if (publicUrlData?.publicUrl) {
                        cloudPhotoUrl = publicUrlData.publicUrl;
                      }

                      // Update local record with permanent cloud URL
                      await db.dailyLogs.update(record.id, {
                        photo_url: cloudPhotoUrl || record.photo_url,
                        photo_storage_path: photoStoragePath,
                        local_photo: undefined,
                      });
                    }
                  }
                } catch (photoErr) {
                  console.warn('[Sync] Photo processing error:', photoErr);
                }
              }

              // 2. Prepare payload for PostgreSQL
              const payload: Record<string, any> = {
                id: record.id,
                log_date: record.log_date,
                category_id: record.category_id,
                notes: record.notes || '',
                status: record.status || 'present',
                photo_url: cloudPhotoUrl || (record.photo_url && record.photo_url.startsWith('http') ? record.photo_url : null),
                photo_storage_path: uploadSucceeded ? photoStoragePath : null,
                photo_data: (record as any).photo_data || null,
                created_at: record.created_at,
                updated_at: record.updated_at || new Date().toISOString(),
              };

              // 3. Upsert to PostgreSQL with column-fallback handling
              const { error: upsertErr } = await adaptiveUpsert(
                'daily_logs',
                payload,
                { onConflict: 'id' }
              );

              if (upsertErr) throw upsertErr;
            }
          }
        } else if (item.action === 'delete') {
          // Process explicit deletion from Supabase
          if (item.table === 'daily_logs') {
            const { error } = await supabase
              .from('daily_logs')
              .delete()
              .eq('id', item.id);

            if (error) {
              console.warn('[SyncEngine] Supabase delete error for daily_logs:', error);
              throw error;
            }
          } else if (item.table === 'categories') {
            const { error } = await supabase
              .from('categories')
              .delete()
              .eq('id', item.id);

            if (error) {
              console.warn('[SyncEngine] Supabase delete error for categories:', error);
              throw error;
            }
          }
        }

        // If the Supabase operation succeeded, remove the item from the local queue
        await db.syncQueue.delete(item.id);
      } catch (itemError) {
        console.error(`[SyncEngine] Failed to sync item ${item.id} in ${item.table}:`, itemError);
        // Break on failure to preserve chronological order for subsequent syncs
        break;
      }
    }
  } catch (err) {
    console.error('[SyncEngine] Fatal error in sync engine:', err);
  } finally {
    isSyncing = false;
  }
};

/**
 * Pull all data from Supabase and perform bidirectional reconciliation:
 * - Inserts/updates records created or modified on other devices
 * - Reconciles deletions by removing local records that no longer exist in cloud
 */
export const pullFromCloud = async () => {
  if (isPulling || !navigator.onLine) return;
  isPulling = true;

  try {
    // 1. Fetch data from the cloud
    const { data: remoteCategories, error: catError } = await supabase
      .from('categories')
      .select('*');
    if (catError) throw catError;

    const { data: remoteLogs, error: logError } = await supabase
      .from('daily_logs')
      .select('*');
    if (logError) throw logError;

    // 2. Fetch local data and pending sync queue
    const existingLocalLogs = await db.dailyLogs.toArray();
    const existingLocalCategories = await db.categories.toArray();
    const pendingQueue = await db.syncQueue.toArray();

    // Sets of pending mutations on this local device
    const pendingUpsertLogIds = new Set(
      pendingQueue.filter((q) => q.table === 'daily_logs' && q.action === 'upsert').map((q) => q.id)
    );
    const pendingDeleteLogIds = new Set(
      pendingQueue.filter((q) => q.table === 'daily_logs' && q.action === 'delete').map((q) => q.id)
    );

    const pendingUpsertCatIds = new Set(
      pendingQueue.filter((q) => q.table === 'categories' && q.action === 'upsert').map((q) => q.id)
    );
    const pendingDeleteCatIds = new Set(
      pendingQueue.filter((q) => q.table === 'categories' && q.action === 'delete').map((q) => q.id)
    );

    const remoteLogIds = new Set((remoteLogs || []).map((r) => r.id));
    const remoteCatIds = new Set((remoteCategories || []).map((c) => c.id));

    // 3. Identify records deleted on other devices (missing remotely AND not queued locally for upload)
    const logsToDeleteLocally = existingLocalLogs
      .filter((l) => (!remoteLogIds.has(l.id) && !pendingUpsertLogIds.has(l.id)) || pendingDeleteLogIds.has(l.id))
      .map((l) => l.id);

    const catsToDeleteLocally = existingLocalCategories
      .filter((c) => (!remoteCatIds.has(c.id) && !pendingUpsertCatIds.has(c.id)) || pendingDeleteCatIds.has(c.id))
      .map((c) => c.id);

    // 4. Filter remote records (exclude anything currently pending deletion on this device)
    const filteredRemoteLogs = (remoteLogs || []).filter((r) => !pendingDeleteLogIds.has(r.id));
    const filteredRemoteCats = (remoteCategories || []).filter((c) => !pendingDeleteCatIds.has(c.id));

    const localLogMap = new Map(existingLocalLogs.map((l) => [l.id, l]));

    // 5. Normalize remote logs while preserving local photo blobs / photo_data if not yet in cloud
    const normalizedLogs = filteredRemoteLogs.map((remoteLog: any) => {
      const local = localLogMap.get(remoteLog.id);

      let resolvedUrl = remoteLog.photo_url || remoteLog.photo_storage_path || null;
      if (
        resolvedUrl &&
        !resolvedUrl.startsWith('http://') &&
        !resolvedUrl.startsWith('https://') &&
        !resolvedUrl.startsWith('data:') &&
        !resolvedUrl.startsWith('blob:')
      ) {
        const cleanPath = resolvedUrl.replace(/^log_photos\//, '').replace(/^\/+/, '');
        resolvedUrl =
          supabase.storage.from('log_photos').getPublicUrl(cleanPath)?.data?.publicUrl ||
          resolvedUrl;
      }

      const photoData = (remoteLog as any).photo_data || (local as any)?.photo_data || null;
      const localPhoto = (local as any)?.local_photo;
      const finalPhotoUrl = resolvedUrl || (local as any)?.photo_url || photoData || null;

      return {
        ...remoteLog,
        photo_url: finalPhotoUrl,
        photo_storage_path: remoteLog.photo_storage_path || local?.photo_storage_path || null,
        photo_data: photoData,
        local_photo: localPhoto,
      };
    });

    // 6. Execute atomic Dexie reconciliation transaction
    await db.transaction('rw', db.categories, db.dailyLogs, async () => {
      // Reconcile Deletions
      if (catsToDeleteLocally.length > 0) {
        await db.categories.bulkDelete(catsToDeleteLocally);
      }
      if (logsToDeleteLocally.length > 0) {
        await db.dailyLogs.bulkDelete(logsToDeleteLocally);
      }

      // Reconcile Inserts / Updates
      if (filteredRemoteCats.length > 0) {
        await db.categories.bulkPut(filteredRemoteCats);
      }
      if (normalizedLogs.length > 0) {
        await db.dailyLogs.bulkPut(normalizedLogs);
      }
    });

    console.log(
      `[SyncEngine] Cloud sync complete. Logs synced: ${normalizedLogs.length}, Logs deleted: ${logsToDeleteLocally.length}`
    );
  } catch (err) {
    console.error('[SyncEngine] Failed to pull data from cloud:', err);
  } finally {
    isPulling = false;
  }
};

/**
 * Setup Supabase Realtime channel listener for instant multi-device synchronization
 */
let realtimeChannel: any = null;

export const setupRealtimeSync = () => {
  if (realtimeChannel) {
    try {
      supabase.removeChannel(realtimeChannel);
    } catch (e) {
      // ignore
    }
  }

  realtimeChannel = supabase
    .channel('cross-device-sync-channel')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'daily_logs' },
      async (payload) => {
        console.log('[Realtime] daily_logs change detected:', payload.eventType);
        if (payload.eventType === 'DELETE' && payload.old?.id) {
          await db.dailyLogs.delete(payload.old.id);
        } else {
          pullFromCloud().catch(console.warn);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'categories' },
      async (payload) => {
        console.log('[Realtime] categories change detected:', payload.eventType);
        if (payload.eventType === 'DELETE' && payload.old?.id) {
          await db.categories.delete(payload.old.id);
        } else {
          pullFromCloud().catch(console.warn);
        }
      }
    )
    .subscribe((status) => {
      console.log('[Realtime] Supabase subscription status:', status);
    });

  return () => {
    if (realtimeChannel) {
      try {
        supabase.removeChannel(realtimeChannel);
      } catch (e) {}
      realtimeChannel = null;
    }
  };
};
