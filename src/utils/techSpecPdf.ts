import jsPDF from 'jspdf';

/**
 * Downloads a Blob safely across desktop, mobile, and iframe sandboxes
 */
function downloadBlob(blob: Blob, filename: string) {
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 1000);
  } catch (err) {
    console.warn('[PDF Download] Fallback window.open:', err);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }
}

/**
 * Generates a multi-page Technical Architecture & System Specification PDF
 */
export function generateTechSpecPDF(): boolean {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;
  let pageNumber = 1;

  const addNewPageIfNeeded = (requiredHeight: number) => {
    if (y + requiredHeight > pageHeight - margin) {
      // Draw footer on current page
      drawFooter();
      doc.addPage();
      pageNumber++;
      y = margin;
      drawHeader();
    }
  };

  const drawHeader = () => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Activity Tracker System Architecture & Technical Specification', margin, y);
    doc.text(`CONFIDENTIAL - ENGINEERING SPEC`, pageWidth - margin, y, { align: 'right' });
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y + 2, pageWidth - margin, y + 2);
    y += 8;
  };

  const drawFooter = () => {
    const footerY = pageHeight - 10;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, footerY - 2, pageWidth - margin, footerY - 2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`, margin, footerY + 2);
    doc.text(`Page ${pageNumber}`, pageWidth - margin, footerY + 2, { align: 'right' });
  };

  // ==========================================
  // PAGE 1: TITLE & EXECUTIVE SUMMARY
  // ==========================================

  // Title Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(margin, y, contentWidth, 36, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('SYSTEM ARCHITECTURE & TECH SPEC', margin + 8, y + 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225);
  doc.text('Full-Stack Habit Tracker, PWA, Tri-Tier Database & Web Push Engine', margin + 8, y + 23);

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Document Version: 2.4.0  |  Runtime: React 19 + Node.js Express + Supabase / PostgreSQL`, margin + 8, y + 30);

  y += 44;

  // Executive Overview Block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Executive Technical Summary', margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  const summaryText =
    'This application is a production-grade, offline-first habit and daily activity tracking system engineered with React 19, TypeScript, Express, and PostgreSQL/Supabase. It features tri-tier adaptive data synchronization, zero-click quick logging via Web Push Notifications, responsive analytics visualizations, and secure session guards.';
  const splitSummary = doc.splitTextToSize(summaryText, contentWidth);
  doc.text(splitSummary, margin, y);
  y += splitSummary.length * 4.5 + 4;

  // Key System Capabilities Grid
  const keySpecs = [
    { label: 'Architecture', val: 'Client-SPA + Express Server + Supabase Cloud DB' },
    { label: 'Persistence Strategy', val: 'Tri-Tier (Supabase PG + Native PG + JSON Store)' },
    { label: 'Offline / PWA', val: 'Service Worker, Cache API, Offline-Ready Manifest' },
    { label: 'Push Notifications', val: 'Web Push API + VAPID (Payload Encrypted RFC 8291)' },
  ];

  const colWidth = (contentWidth - 6) / 2;
  keySpecs.forEach((spec, idx) => {
    const row = Math.floor(idx / 2);
    const col = idx % 2;
    const boxX = margin + col * (colWidth + 6);
    const boxY = y + row * 16;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(boxX, boxY, colWidth, 13, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(spec.label.toUpperCase(), boxX + 4, boxY + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(spec.val, boxX + 4, boxY + 9.5);
  });

  y += 38;

  // ==========================================
  // SECTION 2: TECH STACK BREAKDOWN
  // ==========================================
  addNewPageIfNeeded(70);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('2. Comprehensive Technology Stack', margin, y);
  y += 6;

  const stackCategories = [
    {
      title: 'Frontend Tier',
      items: [
        'React 19 with TypeScript & Vite 6 bundling',
        'Tailwind CSS v4 with utility class system & CSS variables',
        'Lucide React (500+ iconography set)',
        'motion/react for fluid UI springs and route transitions',
        'Recharts & D3 for interactive habit trendlines and heatmaps',
        'PWA Service Worker for offline interception and Web Push handling',
      ],
    },
    {
      title: 'Backend & Server Runtime',
      items: [
        'Node.js runtime executing TypeScript via tsx and compiled with esbuild (CJS)',
        'Express 4/5 REST API with JSON body parsing and error boundaries',
        'Multer for multipart photo upload processing and Base64 fallbacks',
        'web-push library with VAPID key pairs for browser push notifications',
        'Node-cron scheduler for automated category reminder checks',
      ],
    },
    {
      title: 'Database & Storage Tier',
      items: [
        'Supabase (PostgreSQL 15+) via @supabase/supabase-js with Row Level Security',
        'Direct PostgreSQL connection pooling (pg.Pool) for self-hosted / Neon PG',
        'Local JSON Store (server/data/store.json) for 100% offline uptime & zero data loss',
      ],
    },
  ];

  stackCategories.forEach((cat) => {
    addNewPageIfNeeded(26);
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin, y, contentWidth, 6.5, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(cat.title, margin + 4, y + 4.5);
    y += 9;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    cat.items.forEach((item) => {
      addNewPageIfNeeded(6);
      doc.text(`• ${item}`, margin + 4, y);
      y += 4.5;
    });
    y += 3;
  });

  // ==========================================
  // SECTION 3: DATABASE ARCHITECTURE & SCHEMA
  // ==========================================
  addNewPageIfNeeded(80);
  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('3. Relational Database Schema & Entities', margin, y);
  y += 6;

  // Table 1: categories
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Table: categories', margin, y);
  y += 4;

  const renderTableHeaders = (col1: string, col2: string, col3: string) => {
    doc.setFillColor(226, 232, 240);
    doc.rect(margin, y, contentWidth, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(col1, margin + 3, y + 4.2);
    doc.text(col2, margin + 45, y + 4.2);
    doc.text(col3, margin + 95, y + 4.2);
    y += 7;
  };

  renderTableHeaders('COLUMN NAME', 'DATA TYPE', 'CONSTRAINTS & DESCRIPTION');

  const catCols = [
    { name: 'id', type: 'UUID', desc: 'PRIMARY KEY DEFAULT gen_random_uuid()' },
    { name: 'name', type: 'TEXT', desc: 'NOT NULL - Name of habit / task category' },
    { name: 'color_code', type: 'TEXT', desc: 'NOT NULL DEFAULT #3b82f6 (Hex color)' },
    { name: 'icon', type: 'TEXT', desc: 'NOT NULL DEFAULT Brain (Lucide icon key)' },
    { name: 'reminder_time', type: 'TEXT', desc: 'NULLABLE - Scheduled daily reminder (HH:MM)' },
    { name: 'is_active', type: 'BOOLEAN', desc: 'NOT NULL DEFAULT true (Soft archive flag)' },
    { name: 'created_at', type: 'TIMESTAMPTZ', desc: 'DEFAULT CURRENT_TIMESTAMP' },
  ];

  catCols.forEach((col) => {
    addNewPageIfNeeded(6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text(col.name, margin + 3, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(col.type, margin + 45, y);
    doc.text(col.desc, margin + 95, y);
    y += 5;
  });

  y += 4;

  // Table 2: daily_logs
  addNewPageIfNeeded(55);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Table: daily_logs', margin, y);
  y += 4;

  renderTableHeaders('COLUMN NAME', 'DATA TYPE', 'CONSTRAINTS & DESCRIPTION');

  const logCols = [
    { name: 'id', type: 'UUID', desc: 'PRIMARY KEY DEFAULT gen_random_uuid()' },
    { name: 'log_date', type: 'DATE', desc: 'NOT NULL (YYYY-MM-DD)' },
    { name: 'category_id', type: 'UUID', desc: 'NOT NULL REFERENCES categories(id) ON DELETE CASCADE' },
    { name: 'notes', type: 'TEXT', desc: 'NULLABLE - Activity description / reflection' },
    { name: 'photo_url', type: 'TEXT', desc: 'NULLABLE - Image URL or local buffer stream path' },
    { name: 'status', type: 'TEXT', desc: 'DEFAULT "present" ("present" | "absent")' },
    { name: 'created_at', type: 'TIMESTAMPTZ', desc: 'DEFAULT CURRENT_TIMESTAMP' },
  ];

  logCols.forEach((col) => {
    addNewPageIfNeeded(6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text(col.name, margin + 3, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(col.type, margin + 45, y);
    doc.text(col.desc, margin + 95, y);
    y += 5;
  });

  y += 4;

  // ==========================================
  // SECTION 4: TRI-TIER ADAPTIVE DATA ENGINE
  // ==========================================
  addNewPageIfNeeded(75);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('4. Tri-Tier Adaptive Persistence Pipeline', margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  const flowText =
    'The server implements a fault-tolerant DatabaseManager (server/db.ts) that prioritizes Supabase Cloud, falls back to direct PostgreSQL connections, and automatically mirrors all state into local disk JSON storage:';
  doc.text(doc.splitTextToSize(flowText, contentWidth), margin, y);
  y += 10;

  const flowSteps = [
    {
      num: '1',
      title: 'Foreign-Key Pre-Flight & Category Healing',
      desc: 'Before writing any daily log, the system validates that the target category exists in Supabase. If missing, it auto-upserts the category to prevent foreign key violations.',
    },
    {
      num: '2',
      title: 'Multi-Table Name Auto-Detection',
      desc: 'Probes across common schema table conventions (daily_logs, logs, activity_logs) dynamically to adapt to existing user Supabase setups without migration downtime.',
    },
    {
      num: '3',
      title: 'Payload Downgrade & Conflict Resolution',
      desc: 'Checks for existing records on (log_date, category_id). If found, performs an update; otherwise cascades from full columns down to minimal columns and UUID generation.',
    },
    {
      num: '4',
      title: 'Atomic Local Snapshot Mirroring',
      desc: 'Every successful mutation updates the in-memory cache and writes atomically to server/data/store.json, ensuring offline persistence across server restarts.',
    },
  ];

  flowSteps.forEach((step) => {
    addNewPageIfNeeded(16);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, y, contentWidth, 13, 2, 2, 'FD');

    doc.setFillColor(37, 99, 235);
    doc.circle(margin + 5, y + 6.5, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text(step.num, margin + 4, y + 8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(step.title, margin + 11, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(doc.splitTextToSize(step.desc, contentWidth - 16), margin + 11, y + 9.5);
    y += 15;
  });

  // ==========================================
  // SECTION 5: REST API SPECIFICATION
  // ==========================================
  addNewPageIfNeeded(80);
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('5. RESTful API Interface Specification', margin, y);
  y += 6;

  renderTableHeaders('METHOD & ROUTE', 'PAYLOAD / PARAMS', 'RESPONSE STATUS & PURPOSE');

  const apiEndpoints = [
    { ep: 'GET /api/status', payload: 'None', desc: '200 OK - Health, active DB provider, counts' },
    { ep: 'POST /api/auth/login', payload: '{ passcode: string }', desc: '200 OK - Authenticates session & sets cookie' },
    { ep: 'GET /api/categories', payload: 'None', desc: '200 OK - Array of all active & archived categories' },
    { ep: 'POST /api/categories', payload: '{ name, color_code, icon, reminder_time }', desc: '201 Created - Inserts new category' },
    { ep: 'PUT /api/categories/:id', payload: '{ name, color_code, icon, is_active }', desc: '200 OK - Updates category metadata' },
    { ep: 'DELETE /api/categories/:id', payload: 'None', desc: '200 OK - Deletes/archives category' },
    { ep: 'GET /api/logs', payload: '?date=YYYY-MM-DD or ?month=YYYY-MM', desc: '200 OK - Returns logs for date/range' },
    { ep: 'POST /api/logs', payload: 'FormData (photo) or JSON { log_date, category_id, ... }', desc: '200 OK - Upserts daily log entry' },
    { ep: 'PUT /api/logs/:id', payload: 'FormData or JSON log updates', desc: '200 OK - Updates existing log entry' },
    { ep: 'DELETE /api/logs/:id', payload: 'None', desc: '200 OK - Removes log entry' },
    { ep: 'POST /api/db/sync-push', payload: 'None', desc: '200 OK - Pushes all local storage to Supabase' },
    { ep: 'POST /api/push/subscribe', payload: '{ subscription, userAgent }', desc: '200 OK - Registers Web Push endpoint' },
    { ep: 'POST /api/push/test', payload: 'None', desc: '200 OK - Sends immediate test push' },
  ];

  apiEndpoints.forEach((api) => {
    addNewPageIfNeeded(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(37, 99, 235);
    doc.text(api.ep, margin + 3, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(doc.splitTextToSize(api.payload, 45), margin + 45, y);
    doc.text(doc.splitTextToSize(api.desc, 70), margin + 95, y);
    y += 6;
  });

  // ==========================================
  // SECTION 6: PWA, SECURITY & NOTIFICATION SPECS
  // ==========================================
  addNewPageIfNeeded(60);
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('6. Security, PWA & Web Push Protocols', margin, y);
  y += 6;

  const securitySpecs = [
    {
      title: 'VAPID Web Push Protocol (RFC 8291 / RFC 8292)',
      desc: 'Server uses elliptic-curve VAPID key pairs (ECDSA using prime256v1 curve) to sign JWT authentication tokens. Payloads sent to Push Services (FCM/Mozilla/Apple) are encrypted end-to-end via AES-GCM.',
    },
    {
      title: 'Service Worker Lifecycle & Notification Actions',
      desc: 'The Service Worker (public/sw.js) registers push and notificationclick event listeners. Interactive notification buttons (Log Present / Absent) route directly to /quick-log for zero-friction capture.',
    },
    {
      title: 'Session Protection & Credential Isolation',
      desc: 'Passcode authentication uses strict password verification against hashed environment secrets. Unmatched /api/* routes are intercepted with explicit 404 JSON handlers to avoid SPA HTML fallbacks.',
    },
  ];

  securitySpecs.forEach((item) => {
    addNewPageIfNeeded(18);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`• ${item.title}`, margin + 3, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const split = doc.splitTextToSize(item.desc, contentWidth - 6);
    doc.text(split, margin + 6, y);
    y += split.length * 3.8 + 3;
  });

  // Final footer on last page
  drawFooter();

  // Trigger Download
  const pdfBlob = doc.output('blob');
  downloadBlob(pdfBlob, 'Activity_Tracker_System_Architecture_Spec.pdf');
  return true;
}
