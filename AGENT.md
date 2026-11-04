# AGENT.md - Project Context & Architecture Blueprint

## 1. Project Overview
- **Name:** Daily Activity Logger (`logger`)
- **Type:** Offline-ready, mobile-first Progressive Web App (PWA) with desktop support.
- **Core Purpose:** Daily habit, spiritual routines, and activity tracking featuring historical memory retrieval ("On This Day"), scheduled push alerts, photo attachments, category analytics, and PDF technical documentation exports.

---

## 2. Technology Stack & Key Dependencies
- **Frontend Framework:** React (v18+) with TypeScript, bundled using Vite.
- **Styling & UI:** Tailwind CSS, Lucide React icons, Glassmorphism-style UI layers (`glass-header`).
- **Backend & Database:** Supabase (PostgreSQL), `@supabase/supabase-js`.
- **Client Storage & Offline Sync:** IndexedDB / LocalStorage, custom synchronization engine (`src/syncEngine.ts`, `src/db.ts`).
- **PWA & Background Tasks:** Service Worker (`public/sw.js`), Web Push Notifications via Vercel Cron endpoints (`api/cron/on-this-day.ts`).
- **Export & Document Processing:** Custom PDF generators (`src/utils/pdfExport.ts`), Python/Node utility scripts for data ingestion and normalization.
- **Deployment Target:** Vercel (`vercel.json`), Node/Express backup server (`server.ts`).

---

## 3. Directory Map & Critical Files
- `src/App.tsx`: Central application layout, state routing, and global toast notifications.
- `src/components/Header.tsx`: Glass-styled navigation bar with view toggle (`dashboard` | `reports` | `on-this-day`), category manager trigger, quick-add modal, and PDF export modal.
- `src/components/QuickLog.tsx`: Activity submission form supporting tags, timestamps, and media uploads.
- `src/components/OnThisDayView.tsx`: Milestone and anniversary retrospective browser fetching historical date logs.
- `src/components/ReportsView.tsx`: Aggregated charts, category breakdowns, and completion heatmaps.
- `src/components/ActivityPhoto.tsx` & `src/utils/photoUtils.ts`: Image compression, storage bucket uploads, and thumbnail previews.
- `src/components/NotificationToggle.tsx`: Push subscription toggle requesting service worker permissions.
- `src/AuthContext.tsx` & `src/LoginScreen.tsx`: Session validation, authentication state, and protected route wrappers.
- `src/syncEngine.ts` & `src/db.ts`: Queue-based offline mutation manager syncing local changes to Supabase when connectivity returns.
- `api/cron/on-this-day.ts`: Scheduled edge worker checking dates and triggering push notifications.
- `insertGuruhari.cjs`, `clean_guruhari.py`, `fix_encoding.py`: Historical data ingestion and text sanitization pipelines.

---

## 4. Current State & Established Patterns
- **Active Navigation Views:**
  1. `dashboard`: Real-time daily timeline, quick logging drawer, and notification triggers.
  2. `resolutions`: Dedicated habits & goals tab (`/resolutions`) with daily, weekly, monthly, yearly, and custom day intervals, one-tap check-in logging to `daily_logs`, active/pause toggling, and scheduled push alerts.
  3. `reports`: Metrics summaries and historical progress logs.
  4. `on-this-day`: Route `/on-this-day` tracking yearly recurrences and historical logs, dispatched at 09:00 AM IST.
- **Hosting & Push Scheduling Architecture:**
  - Google AI Studio container hosting (`https://daily-logger.ai.studio`) runs the Vite server with an in-process background scheduler (`setInterval` every 30s) triggering `/api/cron/notify` for time-accurate habit check-ins and 09:00 AM IST On-This-Day alerts.
  - Vercel backup cron (`vercel.json`) configured for `30 3 * * *` (03:30 UTC = 09:00 AM IST).
  - Web Push packets configured with `{ urgency: 'high', TTL: 86400 }` to ensure lockscreen delivery even when the phone or app is sleeping/closed.
- **Offline Protocol:** Always write local mutations to IndexedDB first via `syncEngine.ts`, then opportunistically flush to Supabase.
- **State Conventions:** Prefer explicit TypeScript interfaces (`HeaderProps`, `LogEntry`, `CategoryMetadata`, `Resolution`) matching Supabase table schemas.

---

## 5. Development Guidelines for Antigravity Agent
- **Strict Typing:** Do not use `any`. Always rely on definitions from `src/types.ts`.
- **Mobile-First Glassmorphic Design:** Maintain consistent Tailwind styling using backdrop blur (`backdrop-blur-md`), subtle borders (`border-white/80`), and rounded cards (`rounded-xl`).
- **Safe State Updates:** When modifying `src/components/Header.tsx` or navigation views, preserve the `currentView` union type (`'dashboard' | 'reports' | 'on-this-day'`).
- **No Unnecessary Dependencies:** Leverage existing packages (`lucide-react`, built-in browser APIs, existing Tailwind utilities) before suggesting new library additions.

---

## 6. Recently Completed Features
- **Offline PWA Shell Caching & Code-Splitting (Priority 4):**
  - Configured `public/sw.js` with `daily-logger-shell-v1` cache to pre-cache app shell assets (`/`, `/index.html`, `/manifest.json`, icon assets).
  - Implemented Stale-While-Revalidate caching for static assets and Network-First with `/index.html` fallback for SPA navigation.
  - Decoupled `jspdf` and `html2canvas` into an on-demand lazy chunk (`vendor-pdf`) via dynamic imports across `ReportsView.tsx`, `TechDocsModal.tsx`, and `VercelSchemaModal.tsx`.
  - Configured Rollup `manualChunks` in `vite.config.ts`, reducing the primary application entry bundle size from 1,346 kB down to 166 kB (an 88% reduction).
  - Fixed React Hook ordering in `App.tsx` by separating `AuthenticatedApp`.
- **Global Search & Command Palette (Priority 3):**
  - Built `GlobalSearchModal.tsx` command palette supporting real-time offline search across all historical logs, notes, dates, and category names.
  - Implemented full Gujarati Unicode script matching (e.g. પૂજા, દર્શન, સભા) and keyword snippet highlighting with `<mark>`.
  - Added global keyboard shortcut (`⌘K` / `Ctrl+K`) and dedicated search trigger button in `Header.tsx`.
  - Added inline quick-filter on Dashboard above `DaySelector` with seamless handoff to global historical search.
  - Integrated direct date navigation: selecting a search result navigates directly to that date on the Dashboard and opens the entry in edit mode.
- **Configurable "On This Day" Scope & Notifications:**
  - Added `Category.is_on_this_day` flag so users choose which categories participate in the retrospective view and morning anniversary push notifications.
  - Scoped `src/components/OnThisDayView.tsx` so only eligible categories appear in pills and memory query results. Added inline modal to toggle categories directly from the view.
  - Updated `src/components/CategoryManagerModal.tsx` to include "Include in 'On This Day'" toggle in category creation form and active category list items.
  - Updated `api/cron/on-this-day.ts` to query matching categories and trigger push notifications only when historical memories exist for configured categories.
- **Log Entry Inline Editing (Priority 2):** Edit modals and quick-updates wired across `ActivityFeed`, `LogModal`, and `App.tsx`.
- **Engineering Docs & PDF Generation (Priority 1):** Built `TechDocsModal` and multi-page technical specification PDF generator `src/utils/techSpecPdf.ts`.
- **Scheduled Push Notifications & Diagnostics (Priority 1):** Created `NotificationSettingsModal`, `api/cron/notify.ts`, `api/cron/status.ts`, and `api/notifications/test.ts`.
- **"On This Day" Notification Engine & Pipeline Fix:**
  - Added missing `is_on_this_day` column to remote Supabase `categories` PostgreSQL table, setting 'Guruhari Darshan' to active by default.
  - Generated and provisioned standard VAPID key pairs (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VITE_VAPID_PUBLIC_KEY`) in `.env` and `.env.example`.
  - Implemented missing Web Push endpoints: `api/notifications/vapid-public-key.ts`, `api/notifications/subscribe.ts`, and `api/notifications/unsubscribe.ts`.
  - Implemented dual-resilience push subscription persistence (both via backend `/api/notifications/subscribe` and direct Supabase `push_subscriptions` upsert).
  - Configured Vite middleware in `vite.config.ts` to seamlessly route `/api/notifications/*` and `/api/cron/*` endpoints in local development.
  - Implemented automated in-app daily check (`checkAndTriggerDailyOnThisDay`) in `App.tsx` so users receive On This Day alerts locally even when using the app as an offline PWA.
  - Added dedicated "Test 'On This Day' Alert" buttons in both `NotificationSettingsCard.tsx` and `OnThisDayView.tsx` with live diagnostic memory summaries.
- **Interactive On-Screen Notifications for On-This-Day & Resolutions:**
  - Designed and deployed `<OnScreenNotificationBanner>` component (`src/components/OnScreenNotificationBanner.tsx`) rendering high-priority, glassmorphic interactive alerts directly within the open web app.
  - Built unified in-app notification dispatcher (`dispatchAppNotification` in `src/utils/pushNotifications.ts`) supporting cross-tab synchronization via `BroadcastChannel` and OS-level ServiceWorker fallback.
  - Added client-side automated scheduler (`checkAndTriggerDueResolutions`) evaluating active habits against reminder times, start dates, and recurrence frequencies (daily, weekly, monthly, yearly, custom).
  - Wired interactive one-tap check-in buttons ("Completed ✅", "Not Today ⚪", "Open Memories 📖") directly within the on-screen banner to write to IndexedDB and queue cloud sync.
  - Fixed Service Worker and `App.tsx` `RECORD_LOG` message listeners to properly update `db.resolutions.last_completed_at` upon notification check-in.
  - Added dedicated "Test Alert" button directly on the Resolutions screen header and unlocked test alert buttons in `NotificationSettingsCard.tsx`.
- **Two-Stage Daily Resolution Notification Cadence (Morning Focus & Night Review):**
  - **Morning Focus (09:00 AM default):** Inspirational morning prompt reminding the user of their commitment for the day without forcing an immediate check-in.
  - **Night Review & Accountability (11:00 PM default):** Evening check-in prompting whether today's resolution was completed or missed, with one-tap action to log reasons for missed habits. Automatically skips if already completed earlier in the day.
  - **Individual Custom Timings:** Both `morning_reminder_time` and `night_reminder_time` are customizable per resolution with quick-select presets (`07:00`-`10:00` for morning, `21:00`-`00:00` for night), persisted in Dexie and synced to Supabase via `syncEngine.ts`.
  - **Sequential Independent Prompts:** Multiple resolutions due at the same time enqueue into `notificationQueue: AppNotification[]` in `App.tsx` so users receive distinct, sequential prompts per habit without alerts colliding or overwriting each other.
  - **Missed Reason Logging (`ResolutionReasonModal.tsx`):** Built glassmorphic reflection modal with quick-select reason chips (e.g., Low Energy, Ran out of Time, Traveled, Busy, Unwell, Planned Rest, Distracted) plus optional custom notes. Records missed entry (`status: 'absent'`) in `daily_logs` and queues sync.
  - **Omni-Channel Synchronization:** Updated `public/sw.js` with `log_reason` action, broadcasting `OPEN_REASON_MODAL` to app clients. Updated serverless cron endpoints (`api/cron/notify.ts`, `api/notifications/test.ts`) to evaluate and deliver morning vs evening notification payloads with interactive OS notification action buttons.
- **iPhone / iOS Native Web App (PWA) & 24/7 Background Notification Architecture:**
  - **Apple Web Push Compliance:** iOS 16.4+ mandates that Web Push is supported exclusively when the web app is installed to the Home Screen (`display: standalone`). In standard Safari browser tabs, Apple restricts `Notification` and `PushManager`.
  - **In-App iOS Detection & Guidance:** Implemented `isIOSDevice()` and `isStandalonePWA()` in `src/utils/pushNotifications.ts`. When accessed via Safari on iOS, `NotificationSettingsCard.tsx` and `NotificationToggle.tsx` display an interactive 3-step visual guide (Tap Share `⎋` -> Select "Add to Home Screen" `➕` -> Launch from Home Screen & Allow).
  - **Standalone Native Experience:** Once launched from the Home Screen, the app runs without Safari browser frames or URL bars, unlocks Apple's APNs Web Push registration, and receives native lockscreen alerts with action buttons.
  - **24/7 Cloud Background Automation:** Added `.github/workflows/notify-cron.yml` to trigger `/api/cron/notify` and `/api/cron/on-this-day` at 09:00 AM IST and 11:00 PM IST independently of client devices or sleeping container environments.
- **Production Self-Hosted Docker & Express Engine (`server.ts`, `Dockerfile`, `docker-compose.yml`):**
  - **Unified Production Runtime:** Created standalone Express production server ([`server.ts`](file:///home/anandsagardas/projects/logger/server.ts)) serving static frontend assets (`dist/`) while executing all `/api/*` endpoints (`/api/notifications/*`, `/api/cron/*`, `/api/download-pdf`) with body parsing and SPA routing fallback.
  - **Embedded 24/7 Background Scheduler:** Built internal cron scheduler inside `server.ts` running check every 30 seconds against IST time (`UTC+5:30`), autonomously dispatching habit reminders and On-This-Day alerts without external cron dependencies.
  - **Multi-Stage Dockerfile:** Multi-stage `node:20-alpine` build compiling both the client bundle and `dist-server/server.js` with `esbuild`, producing an ultra-lightweight, high-performance production container.
  - **Docker Compose Orchestration:** Configured `docker-compose.yml` with healthchecks (`/health`), automatic restart policies (`restart: unless-stopped`), log rotation, and environment variable bindings.