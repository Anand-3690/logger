import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import API handlers
import vapidKeyHandler from './api/notifications/vapid-public-key';
import subscribeHandler from './api/notifications/subscribe';
import unsubscribeHandler from './api/notifications/unsubscribe';
import testNotificationHandler from './api/notifications/test';
import notifyCronHandler from './api/cron/notify';
import onThisDayCronHandler from './api/cron/on-this-day';
import statusCronHandler from './api/cron/status';
import downloadPdfHandler from './api/download-pdf';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for parsing JSON and urlencoded request bodies
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Healthcheck endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// Mount API routes
app.all('/api/notifications/vapid-public-key', (req: Request, res: Response) => vapidKeyHandler(req, res));
app.all('/api/notifications/subscribe', (req: Request, res: Response) => subscribeHandler(req, res));
app.all('/api/notifications/unsubscribe', (req: Request, res: Response) => unsubscribeHandler(req, res));
app.all('/api/notifications/test', (req: Request, res: Response) => testNotificationHandler(req, res));
app.all('/api/cron/notify', (req: Request, res: Response) => notifyCronHandler(req, res));
app.all('/api/cron/on-this-day', (req: Request, res: Response) => onThisDayCronHandler(req, res));
app.all('/api/cron/status', (req: Request, res: Response) => statusCronHandler(req, res));
app.all('/api/download-pdf', (req: Request, res: Response) => downloadPdfHandler(req, res));

// Serve static frontend assets from dist
const distPath = path.join(__dirname, 'dist');
app.use(
  express.static(distPath, {
    maxAge: '1d',
    setHeaders: (res, filePath) => {
      // Service worker and manifest should not be cached aggressively
      if (filePath.endsWith('sw.js') || filePath.endsWith('manifest.json')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  })
);

// SPA fallback for client-side navigation
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// 24/7 In-Process Scheduler for Habits, Resolutions & On-This-Day Reminders
let lastTickMinute = '';
const runBackgroundSchedulerTick = async () => {
  try {
    const now = new Date();
    // Calculate IST time (UTC+5:30)
    const istDate = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    const hours = String(istDate.getUTCHours()).padStart(2, '0');
    const minutes = String(istDate.getUTCMinutes()).padStart(2, '0');
    const currentMinuteStr = `${hours}:${minutes}`;

    if (currentMinuteStr === lastTickMinute) return;
    lastTickMinute = currentMinuteStr;

    const mockReq = { method: 'POST', query: {}, body: {} };
    const mockRes = {
      setHeader: () => mockRes,
      status: () => mockRes,
      json: (data: any) => {
        if (data?.sent && data.sent > 0) {
          console.log(`[Scheduler] [${currentMinuteStr} IST] Dispatched ${data.sent} notification(s) successfully.`);
        }
        return mockRes;
      },
      end: () => mockRes,
    };

    await notifyCronHandler(mockReq, mockRes);
  } catch (err: any) {
    console.error('[Scheduler Error]:', err?.message || err);
  }
};

// Start in-process scheduler: runs check every 30 seconds
const schedulerInterval = setInterval(runBackgroundSchedulerTick, 30000);

// Start server
const server = app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  Daily Activity Logger Server running on port ${PORT}`);
  console.log(`  Internal 24/7 Notification Scheduler: ACTIVE`);
  console.log(`=======================================================`);
  // Run an immediate check on startup
  runBackgroundSchedulerTick();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, closing server and scheduler...');
  clearInterval(schedulerInterval);
  server.close(() => {
    process.exit(0);
  });
});
