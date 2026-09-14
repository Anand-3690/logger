import type { jsPDF } from 'jspdf';

export interface PdfExportResult {
  doc: jsPDF;
  blob: Blob;
  blobUrl: string;
  base64: string;
  dataUri: string;
  filename: string;
  sizeBytes: number;
  download: () => void;
  openInNewTab: () => void;
  triggerServerDownload: () => void;
}

/**
 * Triggers a native attachment download via the server endpoint.
 * This submits a hidden POST form with Content-Disposition: attachment,
 * which the browser's native network stack processes without being subject
 * to client-side user activation expiration or iframe sandbox restrictions.
 */
export function triggerServerPdfDownload(base64: string, filename: string): void {
  try {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/api/download-pdf';
    form.style.display = 'none';

    const filenameInput = document.createElement('input');
    filenameInput.type = 'hidden';
    filenameInput.name = 'filename';
    filenameInput.value = filename;
    form.appendChild(filenameInput);

    const base64Input = document.createElement('input');
    base64Input.type = 'hidden';
    base64Input.name = 'base64';
    base64Input.value = base64;
    form.appendChild(base64Input);

    document.body.appendChild(form);
    form.submit();

    setTimeout(() => {
      if (form.parentNode) form.parentNode.removeChild(form);
    }, 2000);
  } catch (err) {
    console.warn('[PDF Download] Server download form submit failed:', err);
  }
}

/**
 * Programmatically clicks a hidden anchor tag with download attribute.
 * Forces application/octet-stream so the browser directly saves to disk.
 */
export function triggerBrowserBlobDownload(blob: Blob, filename: string): boolean {
  try {
    const streamBlob = new Blob([blob], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(streamBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    link.style.position = 'fixed';
    link.style.left = '-9999px';
    link.style.top = '-9999px';
    link.style.opacity = '0';

    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      if (link.parentNode) link.parentNode.removeChild(link);
      URL.revokeObjectURL(url);
    }, 120000);

    return true;
  } catch (err) {
    console.warn('[PDF Download] Browser blob download failed:', err);
    return false;
  }
}

/**
 * Safely opens a PDF in a new tab or window.
 */
export function openPdfInNewTab(url: string): Window | null {
  try {
    const win = window.open(url, '_blank');
    if (win) {
      win.focus();
    }
    return win;
  } catch (err) {
    console.warn('[PDF Download] Window open blocked:', err);
    return null;
  }
}

/**
 * Universal Multi-Tier PDF Download & Export Pipeline.
 *
 * Tier 1: Server attachment form POST (direct disk save, immune to activation expiration)
 * Tier 2: Synthetic anchor with application/octet-stream download attribute
 * Tier 3: jsPDF native doc.save
 */
export function processPdfExport(doc: jsPDF, filename: string): PdfExportResult {
  const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  const blob = doc.output('blob');
  const blobUrl = URL.createObjectURL(blob);
  const dataUri = doc.output('datauristring');
  const base64 = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;

  const download = () => {
    // 1. Primary: Server attachment form POST (downloads directly to Downloads folder)
    try {
      triggerServerPdfDownload(base64, cleanFilename);
    } catch (e) {
      console.warn('[PDF Download] Server download failed:', e);
    }

    // 2. Secondary client-side fallback
    try {
      triggerBrowserBlobDownload(blob, cleanFilename);
    } catch (e) {
      console.warn('[PDF Download] Browser blob download failed:', e);
    }
  };

  const openInNewTab = () => {
    openPdfInNewTab(blobUrl);
  };

  const triggerServerDownload = () => {
    triggerServerPdfDownload(base64, cleanFilename);
  };

  // Automatically attempt primary download immediately
  download();

  return {
    doc,
    blob,
    blobUrl,
    base64,
    dataUri,
    filename: cleanFilename,
    sizeBytes: blob.size,
    download,
    openInNewTab,
    triggerServerDownload,
  };
}
