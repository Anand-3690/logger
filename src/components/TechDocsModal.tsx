import React, { useState } from 'react';
import {
  X,
  Download,
  FileText,
  Database,
  Layers,
  Server,
  ShieldCheck,
  Bell,
  Code2,
  Check,
  Copy,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { generateTechSpecPDF } from '../utils/techSpecPdf';

interface TechDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TechDocsModal: React.FC<TechDocsModalProps> = ({ isOpen, onClose }) => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownloadPDF = () => {
    try {
      setIsGeneratingPdf(true);
      generateTechSpecPDF();
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const copyToClipboard = (text: string, sectionKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionKey);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
      <div
        id="tech-docs-modal"
        className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-scaleUp"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Technical Specification & Architecture
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  v2.4.0
                </span>
              </h2>
              <p className="text-xs text-slate-300 font-medium">
                Comprehensive developer documentation & PDF generator
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-download-tech-pdf"
              onClick={handleDownloadPDF}
              disabled={isGeneratingPdf}
              className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 active:scale-97 rounded-xl transition-all shadow-md shadow-blue-600/30 border border-blue-400/40"
            >
              {downloadSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span>PDF Downloaded!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
                </>
              )}
            </button>

            <button
              id="btn-close-tech-docs"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-800 text-sm">
          {/* Quick PDF Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-600 text-white mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Ready for Engineering Hand-off & Archival
                </h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Download the complete publication-ready multi-page PDF formatted with system diagrams, relational schemas, and API tables.
                </p>
              </div>
            </div>
            <button
              onClick={handleDownloadPDF}
              className="shrink-0 px-3 py-1.5 text-xs font-bold text-blue-700 bg-white hover:bg-blue-50 border border-blue-300 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Get PDF Now</span>
            </button>
          </div>

          {/* Section 1: Tech Stack */}
          <section className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 flex items-center gap-2 text-base">
                <Layers className="w-4 h-4 text-blue-600" />
                1. System Tech Stack
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <span className="text-[11px] font-bold tracking-wider text-blue-700 uppercase">Frontend Tier</span>
                <ul className="text-xs text-slate-700 space-y-1">
                  <li>• React 19 + TypeScript + Vite 6</li>
                  <li>• Tailwind CSS v4 Utility Styling</li>
                  <li>• Recharts & D3 Data Visualization</li>
                  <li>• motion/react UI Animations</li>
                  <li>• Service Worker & PWA Manifest</li>
                </ul>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <span className="text-[11px] font-bold tracking-wider text-indigo-700 uppercase">Backend Tier</span>
                <ul className="text-xs text-slate-700 space-y-1">
                  <li>• Node.js Express 4/5 Server</li>
                  <li>• esbuild CJS Single Bundle Output</li>
                  <li>• Multer Multipart Image Streamer</li>
                  <li>• web-push VAPID Push Engine</li>
                  <li>• Node-cron Scheduled Reminders</li>
                </ul>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <span className="text-[11px] font-bold tracking-wider text-emerald-700 uppercase">Storage & DB</span>
                <ul className="text-xs text-slate-700 space-y-1">
                  <li>• Supabase (PostgreSQL 15+)</li>
                  <li>• Direct PG Connection Pool (pg.Pool)</li>
                  <li>• Local JSON Store Snapshot Mirror</li>
                  <li>• Row Level Security (RLS)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 2: Database Schema */}
          <section className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 flex items-center gap-2 text-base">
                <Database className="w-4 h-4 text-blue-600" />
                2. Database Schema & Relational Design
              </h3>
            </div>
            <div className="bg-slate-900 rounded-xl p-4 text-slate-200 font-mono text-xs overflow-x-auto space-y-3">
              <div className="text-slate-400">
                -- PostgreSQL Schema Definitions (Supabase & Native Postgres)
              </div>
              <pre className="text-emerald-400">
{`CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color_code TEXT NOT NULL DEFAULT '#3b82f6',
  icon TEXT NOT NULL DEFAULT 'Brain',
  reminder_time TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_date DATE NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  notes TEXT,
  photo_url TEXT,
  photo_data TEXT,
  photo_storage_path TEXT,
  status TEXT DEFAULT 'present',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_date_category UNIQUE(log_date, category_id)
);

-- Schema Migrations (Safe for existing tables)
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS photo_data TEXT;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS photo_storage_path TEXT;
ALTER TABLE daily_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;`}
              </pre>
            </div>
          </section>

          {/* Section 3: Tri-Tier Persistence Architecture */}
          <section className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 flex items-center gap-2 text-base">
                <Server className="w-4 h-4 text-blue-600" />
                3. Tri-Tier Adaptive Persistence Architecture
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-900 block mb-1">1. Foreign-Key Pre-Flight Verification</span>
                <p className="text-slate-600">
                  Prior to inserting child log rows, the engine checks for the parent category in Supabase and auto-upserts it if missing, preventing FK constraint rejections.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-900 block mb-1">2. Dynamic Table Discovery</span>
                <p className="text-slate-600">
                  Probes across common schema table conventions (<code className="text-blue-600 font-mono">daily_logs</code>, <code className="text-blue-600 font-mono">logs</code>, <code className="text-blue-600 font-mono">activity_logs</code>) to support varied configurations.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-900 block mb-1">3. Payload Degradation Pipeline</span>
                <p className="text-slate-600">
                  Cascades from full column writes to core minimal fields, ensuring successful inserts even if optional schema columns differ.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-900 block mb-1">4. Atomic Local JSON Store</span>
                <p className="text-slate-600">
                  Mirrors every update to <code className="text-blue-600 font-mono">server/data/store.json</code> for instant offline operation and persistent fallback state.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4: REST API Reference */}
          <section className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 flex items-center gap-2 text-base">
                <Code2 className="w-4 h-4 text-blue-600" />
                4. REST API Endpoint Reference
              </h3>
            </div>
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Endpoint</th>
                    <th className="p-2.5">Method</th>
                    <th className="p-2.5">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  <tr>
                    <td className="p-2.5 font-mono text-blue-600">/api/status</td>
                    <td className="p-2.5 font-semibold">GET</td>
                    <td className="p-2.5">Server health, active database provider, count metrics</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-mono text-blue-600">/api/categories</td>
                    <td className="p-2.5 font-semibold">GET, POST</td>
                    <td className="p-2.5">Retrieve and create custom habit/task categories</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-mono text-blue-600">/api/logs</td>
                    <td className="p-2.5 font-semibold">GET, POST</td>
                    <td className="p-2.5">Retrieve and upsert activity logs with photo/note payloads</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-mono text-blue-600">/api/db/sync-push</td>
                    <td className="p-2.5 font-semibold">POST</td>
                    <td className="p-2.5">Reconcile all offline local store data into remote Supabase</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-mono text-blue-600">/api/push/subscribe</td>
                    <td className="p-2.5 font-semibold">POST</td>
                    <td className="p-2.5">Register browser Web Push endpoint and encryption keys</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 5: Security & PWA Push */}
          <section className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 flex items-center gap-2 text-base">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                5. Security & PWA Push Architecture
              </h3>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-700">
              <p>
                • <strong>VAPID Authentication</strong>: Web Push notifications are cryptographically signed using prime256v1 ECDSA key pairs and encrypted per RFC 8291.
              </p>
              <p>
                • <strong>Service Worker Actions</strong>: Interactive push notifications allow immediate logging (<code className="text-blue-600 font-mono">Present</code> / <code className="text-blue-600 font-mono">Absent</code>) via the dedicated <code className="text-blue-600 font-mono">/quick-log</code> workflow.
              </p>
              <p>
                • <strong>Explicit Route Guards</strong>: All <code className="text-blue-600 font-mono">/api/*</code> routes are intercepted with strict JSON error handlers to prevent SPA index.html fallback conflicts.
              </p>
            </div>
          </section>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-200 bg-slate-50">
          <span className="text-xs text-slate-500">
            Click Download PDF to export this document to your local machine.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-xl transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPdf}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
