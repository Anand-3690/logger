import { db } from './db';
import { supabase } from './supabaseClient';

let isSyncing = false;

export const processSyncQueue = async () => {
  // Prevent concurrent syncs
  if (isSyncing || !navigator.onLine) return;
  isSyncing = true;

  try {
    // Grab everything in the queue, sorted by oldest first
    const queue = await db.syncQueue.orderBy('timestamp').toArray();
    
    if (queue.length === 0) {
      isSyncing = false;
      return;
    }

    console.log(`Starting sync for ${queue.length} queued items...`);

    for (const item of queue) {
      try {
        if (item.action === 'upsert') {
          if (item.table === 'categories') {
            const record = await db.categories.get(item.id);
            if (record) {
              const { error } = await supabase.from('categories').upsert(record);
              if (error) throw error;
            }
          }  else if (item.table === 'daily_logs') {
                const record = await db.dailyLogs.get(item.id);
                if (record) {
                    let finalPhotoUrl = record.photo_storage_path;

                    // 1. Check if there is a raw local photo that needs to be uploaded
                    if ((record as any).local_photo) {
                        const file = (record as any).local_photo as File;
                        
                        // Create a unique file path: category_id/log_id-timestamp.jpg
                        const fileExt = file.name.split('.').pop();
                        const filePath = `${record.category_id}/${record.id}-${Date.now()}.${fileExt}`;

                        // Upload to Supabase Storage
                        const { error: uploadError } = await supabase.storage
                        .from('log_photos')
                        .upload(filePath, file);

                        if (uploadError) throw uploadError;

                        // Get the public URL for the newly uploaded file
                        const { data: publicUrlData } = supabase.storage
                        .from('log_photos')
                        .getPublicUrl(filePath);

                        finalPhotoUrl = publicUrlData.publicUrl;

                        // Strip the heavy File object from the local DB and replace it with the URL
                        await db.dailyLogs.update(record.id, { 
                        photo_storage_path: finalPhotoUrl, 
                        local_photo: undefined 
                        });
                    }

                    // 2. Prepare the payload for PostgreSQL (stripping out any local-only Dexie fields)
                    const payload = {
                        id: record.id,
                        log_date: record.log_date,
                        category_id: record.category_id,
                        notes: record.notes,
                        status: record.status,
                        photo_storage_path: finalPhotoUrl, // Send the cloud URL to the database
                        created_at: record.created_at,
                        updated_at: record.updated_at || new Date().toISOString()
                    };

                    
                    // 3. Upsert the data to PostgreSQL with explicit conflict resolution
                    const { error } = await supabase.from('daily_logs').upsert(payload, { 
                    onConflict: 'log_date,category_id' 
                    });
                    if (error) throw error;

                    // 4. Clean up the heavy local file from IndexedDB once safely synced
                    await db.syncQueue.delete(item.id);
                    if ((record as any).local_photo) {
                        await db.dailyLogs.update(record.id, { local_photo: undefined });
                    }
                }
            }
        } 
        else if (item.action === 'delete') {
          const { error } = await supabase
            .from(item.table)
            .delete()
            .eq('id', item.id);
            
          if (error) throw error;
        }

        // If the Supabase operation succeeded, remove the item from the local queue
        await db.syncQueue.delete(item.id);
      } catch (itemError) {
        console.error(`Failed to sync item ${item.id} in ${item.table}:`, itemError);
        // We break the loop on the first failure to maintain chronological order
        break; 
      }
    }
  } catch (err) {
    console.error('Fatal error in sync engine:', err);
  } finally {
    isSyncing = false;
  }
};

export const pullFromCloud = async () => {
  if (!navigator.onLine) return;

  try {
    console.log('Fetching existing data from Supabase...');

    // 1. Fetch data from the cloud
    const { data: remoteCategories, error: catError } = await supabase.from('categories').select('*');
    if (catError) throw catError;

    const { data: remoteLogs, error: logError } = await supabase.from('daily_logs').select('*');
    if (logError) throw logError;

    // 2. Hydrate the local Dexie database
    await db.transaction('rw', db.categories, db.dailyLogs, async () => {
      if (remoteCategories && remoteCategories.length > 0) {
        await db.categories.bulkPut(remoteCategories);
      }
      if (remoteLogs && remoteLogs.length > 0) {
        await db.dailyLogs.bulkPut(remoteLogs);
      }
    });

    console.log('Successfully hydrated local database with cloud data!');
  } catch (err) {
    console.error('Failed to pull data from cloud:', err);
  }
};