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
  2. `reports`: Metrics summaries and historical progress logs.
  3. `on-this-day`: Route `/on-this-day` tracking yearly recurrences and historical logs.
- **Offline Protocol:** Always write local mutations to IndexedDB first via `syncEngine.ts`, then opportunistically flush to Supabase.
- **State Conventions:** Prefer explicit TypeScript interfaces (`HeaderProps`, `LogEntry`, `CategoryMetadata`) matching Supabase table schemas.

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