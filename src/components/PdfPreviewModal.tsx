import React, { useRef } from 'react';
import {
  X,
  Download,
  ExternalLink,
  Printer,
  FileCheck2,
  HardDriveDownload,
  Sparkles,
} from 'lucide-react';
import { PdfExportResult } from '../utils/downloadPdf';

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfResult: PdfExportResult | null;
}

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
  isOpen,
  onClose,
  pdfResult,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  if (!isOpen || !pdfResult) return null;

  const { blobUrl, filename, sizeBytes, openInNewTab, triggerServerDownload } = pdfResult;
  const formattedSize =
    sizeBytes < 1024 * 1024
      ? `${(sizeBytes / 1024).toFixed(1)} KB`
      : `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;

  const handlePrint = () => {
    try {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
        return;
      }
    } catch (e) {
      console.warn('Could not print directly from iframe:', e);
    }
    openInNewTab();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-fadeIn">
      <div
        id="pdf-preview-modal"
        className="relative w-full max-w-5xl h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-scaleUp"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-200 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Document Ready
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  {formattedSize}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-mono truncate max-w-xs sm:max-w-md">
                {filename}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-close-pdf-preview"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Action Prompt */}
        <div className="px-6 py-2.5 bg-gradient-to-r from-blue-50 via-indigo-50 to-sky-50 border-b border-blue-100 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-700">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              If automatic download was blocked by your browser, tap{' '}
              <strong className="text-blue-900">Download PDF</strong> below.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              id="btn-modal-direct-download"
              href={blobUrl}
              download={filename}
              className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-97 rounded-lg shadow-sm transition-all flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </a>
            <button
              id="btn-modal-server-download"
              onClick={triggerServerDownload}
              title="Download via Server (Bypasses browser download blockers)"
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5"
            >
              <HardDriveDownload className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Server Direct</span>
            </button>
          </div>
        </div>

        {/* PDF Viewer Iframe */}
        <div className="flex-1 bg-slate-100 p-2 sm:p-4 overflow-hidden relative">
          <iframe
            ref={iframeRef}
            src={`${blobUrl}#toolbar=1&navpanes=0`}
            title={filename}
            className="w-full h-full rounded-xl border border-slate-300/80 bg-white shadow-inner"
          />
        </div>

        {/* Footer Toolbar */}
        <div className="px-6 py-3 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Universal PDF Engine v2.4</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-preview-print"
              onClick={handlePrint}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            <button
              id="btn-preview-open-tab"
              onClick={openInNewTab}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in New Tab</span>
            </button>

            <a
              id="btn-preview-download-footer"
              href={blobUrl}
              download={filename}
              className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-97 rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save File</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
