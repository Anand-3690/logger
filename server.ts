import express, { Request, Response } from 'express';
import path from 'path';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { db, POSTGRES_SCHEMA_SQL, POSTGRES_SEED_SQL } from './server/db.js';
import { uploadPhotoFile, uploadBase64Photo } from './server/storage.js';
import {
  getVapidPublicKey,
  broadcastPushNotification,
  createCategoryReminderPayload,
  PushPayload,
} from './server/push.js';
import { internalCronScheduler } from './server/scheduler.js';
import { authMiddleware } from './middleware.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middlewares for JSON and form decoding
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // Strict Middleware Security Checkpoint
  app.use(authMiddleware);

  // Static uploads serving
  const uploadsDir = path.join(process.cwd(), 'uploads');
  app.use('/uploads', express.static(uploadsDir));

  // ==========================================
  // AUTHENTICATION API ROUTES
  // ==========================================

  // Check auth status
  app.get('/api/auth/status', (req: Request, res: Response) => {
    const isSetup = db.isAuthSetup();
    const authHeader = req.headers.authorization;
    let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;

    if (!token && req.headers.cookie) {
      const match = req.headers.cookie.match(/session_token=([^;]+)/);
      if (match) {
        token = decodeURIComponent(match[1]).trim();
      }
    }

    const isAuthenticated = isSetup ? db.validateSession(token) : false;

    res.json({
      isSetup,
      isAuthenticated,
    });
  });

  // Login
  app.post('/api/auth/login', (req: Request, res: Response) => {
    try {
      const { password } = req.body;
      if (!password) {
        return res.status(400).json({ error: 'Password is required' });
      }

      const isValid = db.verifyPassword(password);
      if (!isValid) {
        return res.status(401).json({ error: 'Incorrect password' });
      }

      const token = db.createSession();
      res.setHeader('Set-Cookie', `session_token=${token}; Path=/; Max-Age=604800; SameSite=Lax`);
      res.json({ message: 'Authentication successful', token });
    } catch (err: any) {
      res.status(500).json({ error: 'Login failed' });
    }
  });

  // Setup / Reset Master Password
  app.post('/api/auth/setup', (req: Request, res: Response) => {
    try {
      const { password } = req.body;
      if (!password || password.length < 4) {
        return res.status(400).json({ error: 'Password must be at least 4 characters long.' });
      }

      db.setMasterPassword(password);
      const token = db.createSession();
      res.setHeader('Set-Cookie', `session_token=${token}; Path=/; Max-Age=604800; SameSite=Lax`);
      res.json({ message: 'Password set successfully', token });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to set password' });
    }
  });

  // Change Password
  app.post('/api/auth/change-password', (req: Request, res: Response) => {
    try {
      const { current_password, new_password } = req.body;
      if (!current_password || !new_password) {
        return res.status(400).json({ error: 'Current password and new password are required' });
      }
      if (!db.verifyPassword(current_password)) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
      if (new_password.length < 4) {
        return res.status(400).json({ error: 'New password must be at least 4 characters long' });
      }
      db.setMasterPassword(new_password);
      const token = db.createSession();
      res.setHeader('Set-Cookie', `session_token=${token}; Path=/; Max-Age=604800; SameSite=Lax`);
      res.json({ message: 'Password updated successfully', token });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to change password' });
    }
  });

  // Logout
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
    if (!token && req.headers.cookie) {
      const match = req.headers.cookie.match(/session_token=([^;]+)/);
      if (match) {
        token = decodeURIComponent(match[1]).trim();
      }
    }
    db.revokeSession(token);
    res.setHeader('Set-Cookie', 'session_token=; Path=/; Max-Age=0; SameSite=Lax');
    res.json({ message: 'Logged out successfully' });
  });

  // ==========================================
  // API ROUTE HANDLERS
  // ==========================================

  // Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // 1. GET /api/categories - Fetch all active categories
  app.get('/api/categories', (req: Request, res: Response) => {
    try {
      const categories = db.getActiveCategories();
      res.json(categories);
    } catch (err: any) {
      console.error('Error fetching categories:', err);
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  });

  // POST /api/categories - Add a new category with optional reminder_time
  app.post('/api/categories', (req: Request, res: Response) => {
    try {
      const { name, color_code, icon, reminder_time } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Category name is required' });
      }
      const newCategory = db.createCategory({
        name: name.trim(),
        color_code: color_code || '#3b82f6',
        icon: icon || 'Sparkles',
        reminder_time: reminder_time || null,
      });
      res.status(201).json(newCategory);
    } catch (err: any) {
      console.error('Error creating category:', err);
      res.status(500).json({ error: 'Failed to create category' });
    }
  });

  // PUT /api/categories/:id - Update category with optional reminder_time
  app.put('/api/categories/:id', (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const { name, color_code, icon, reminder_time, is_active } = req.body;
      const updated = db.updateCategory(id, { name, color_code, icon, reminder_time, is_active });
      if (!updated) {
        return res.status(404).json({ error: 'Category not found' });
      }
      res.json(updated);
    } catch (err: any) {
      console.error('Error updating category:', err);
      res.status(500).json({ error: 'Failed to update category' });
    }
  });

  // DELETE /api/categories/:id - Delete / deactivate category
  app.delete('/api/categories/:id', (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const success = db.deleteCategory(id);
      if (success) {
        res.json({ message: 'Category deleted successfully' });
      } else {
        res.status(404).json({ error: 'Category not found' });
      }
    } catch (err: any) {
      console.error('Error deleting category:', err);
      res.status(500).json({ error: 'Failed to delete category' });
    }
  });

  // 2. GET /api/logs?date=YYYY-MM-DD - Fetch logs for a specific day
  app.get('/api/logs', (req: Request, res: Response) => {
    try {
      const date = req.query.date as string;
      if (!date) {
        // Return all logs if no date specified
        const allLogs = db.getAllLogs();
        return res.json(allLogs);
      }
      const logs = db.getLogsByDate(date);
      res.json(logs);
    } catch (err: any) {
      console.error('Error fetching logs:', err);
      res.status(500).json({ error: 'Failed to fetch logs' });
    }
  });

  // GET /api/logs/month?month=YYYY-MM - Fetch logs for a month
  app.get('/api/logs/month', (req: Request, res: Response) => {
    try {
      const month = (req.query.month as string) || new Date().toISOString().substring(0, 7);
      const logs = db.getLogsByMonth(month);
      res.json(logs);
    } catch (err: any) {
      console.error('Error fetching monthly logs:', err);
      res.status(500).json({ error: 'Failed to fetch monthly logs' });
    }
  });

  // 3. POST /api/logs - Handle log submission with multipart or JSON payload
  app.post('/api/logs', upload.single('photo'), async (req: Request, res: Response) => {
    try {
      let { log_date, category_id, notes, photo_url_input } = req.body;

      if (!log_date) {
        log_date = new Date().toISOString().split('T')[0];
      }

      if (!category_id) {
        // If not supplied, fallback to first active category
        const activeCats = db.getActiveCategories();
        if (activeCats.length > 0) {
          category_id = activeCats[0].id;
        } else {
          return res.status(400).json({ error: 'category_id is required' });
        }
      }

      let photo_url: string | null = photo_url_input || null;

      // If file uploaded via Multer multipart
      if (req.file) {
        photo_url = await uploadPhotoFile(req.file);
      } else if (req.body.photo_base64) {
        photo_url = await uploadBase64Photo(req.body.photo_base64);
      }

      const newLog = db.createLog({
        log_date,
        category_id,
        notes: notes || null,
        photo_url,
      });

      res.status(201).json(newLog);
    } catch (err: any) {
      console.error('Error creating log:', err);
      res.status(500).json({ error: err.message || 'Failed to save log' });
    }
  });

  // DELETE /api/logs/:id - Delete a log
  app.delete('/api/logs/:id', (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const success = db.deleteLog(id);
      if (success) {
        res.json({ message: 'Log deleted successfully' });
      } else {
        res.status(404).json({ error: 'Log not found' });
      }
    } catch (err: any) {
      console.error('Error deleting log:', err);
      res.status(500).json({ error: 'Failed to delete log' });
    }
  });

  // ==========================================
  // WEB PUSH NOTIFICATIONS & CRON API ROUTES
  // ==========================================

  // GET /api/notifications/vapid-public-key
  app.get('/api/notifications/vapid-public-key', (req: Request, res: Response) => {
    const publicKey = getVapidPublicKey();
    res.json({ publicKey });
  });

  // POST /api/notifications/subscribe - Store user's browser push subscription
  app.post('/api/notifications/subscribe', (req: Request, res: Response) => {
    try {
      const subData = req.body.subscription || req.body;
      if (!subData || !subData.endpoint) {
        return res.status(400).json({ error: 'Valid push subscription object is required' });
      }

      const saved = db.savePushSubscription(subData);
      res.status(201).json({
        success: true,
        message: 'Push subscription registered successfully',
        subscriptionId: saved.id,
      });
    } catch (err: any) {
      console.error('Error registering push subscription:', err);
      res.status(500).json({ error: err.message || 'Failed to register subscription' });
    }
  });

  // POST /api/notifications/unsubscribe - Remove subscription
  app.post('/api/notifications/unsubscribe', (req: Request, res: Response) => {
    try {
      const { endpoint } = req.body;
      if (!endpoint) {
        return res.status(400).json({ error: 'Endpoint is required' });
      }
      const removed = db.removePushSubscription(endpoint);
      res.json({ success: removed });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to unsubscribe' });
    }
  });

  // POST /api/notifications/test - Trigger an immediate test push notification
  app.post('/api/notifications/test', async (req: Request, res: Response) => {
    try {
      const activeCats = db.getActiveCategories();
      const testCategory = activeCats[0] || {
        id: 'test-cat',
        name: 'Daily Accomplishment Check-in',
        color_code: '#3b82f6',
        icon: 'Sparkles',
        is_active: true,
      };

      const payload = createCategoryReminderPayload(testCategory);
      payload.title = `[Test Notification] ${testCategory.name}`;
      payload.body = `Interactive notification test with action buttons: Present / Yes and Absent / No.`;

      const result = await broadcastPushNotification(payload);
      res.json({
        success: true,
        message: `Notification broadcast to ${result.sent} active subscribers (${result.total} registered)`,
        result,
      });
    } catch (err: any) {
      console.error('Error sending test push notification:', err);
      res.status(500).json({ error: err.message || 'Failed to send test push' });
    }
  });

  // POST /api/notifications/action - Handle background action callbacks (e.g. Absent / No)
  app.post('/api/notifications/action', (req: Request, res: Response) => {
    try {
      const { action, category_id, category_name, log_date } = req.body;
      console.log(`[Notification Action] User selected "${action}" for category "${category_name || category_id}" on ${log_date}`);
      res.json({ success: true, action, recorded_at: new Date().toISOString() });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to process notification action' });
    }
  });

  // GET /api/cron/status - Live health and execution metrics of self-hosted internal cron scheduler
  app.get('/api/cron/status', (req: Request, res: Response) => {
    try {
      const status = internalCronScheduler.getStatus();
      res.json({
        success: true,
        mode: 'self_hosted_background_scheduler',
        message: 'Internal background cron is actively running on this Node.js server',
        ...status,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to retrieve scheduler status' });
    }
  });

  // GET & POST /api/cron/notify - Triggered manually or externally
  const handleCronNotify = async (req: Request, res: Response) => {
    try {
      const forceAll = req.query.all === 'true' || req.query.force === 'true';
      const result = await internalCronScheduler.tick(forceAll, true);

      res.json({
        success: true,
        timestamp: result.timestamp,
        checkedTime: result.timeChecked,
        forceAll,
        matchedCategoriesCount: result.matchedCategories.length,
        matchedCategories: result.matchedCategories,
        totalSubscriptions: result.subscribersCount,
        totalNotificationsDispatched: result.notificationsSent,
        failures: result.failures,
        triggerType: result.triggerType,
      });
    } catch (err: any) {
      console.error('Error executing cron notify:', err);
      res.status(500).json({ error: err.message || 'Cron notification execution failed' });
    }
  };

  app.get('/api/cron/notify', handleCronNotify);
  app.post('/api/cron/notify', handleCronNotify);

  // GET /api/schema - Return Postgres SQL schema & Next.js templates
  app.get('/api/schema', (req: Request, res: Response) => {
    res.json({
      postgres_schema: POSTGRES_SCHEMA_SQL,
      postgres_seed: POSTGRES_SEED_SQL,
    });
  });

  // ==========================================
  // VITE DEV / PRODUCTION STATIC SERVING
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
    // Automatically start internal background cron scheduler!
    internalCronScheduler.start();
  });
}

startServer().catch((err) => {
  console.error('Server fatal start error:', err);
});
