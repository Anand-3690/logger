import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
    console.warn('[PDF Export] Direct link click failed, trying window open fallback:', err);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }
}

/**
 * Clean clone helper that strips unsupported CSS (backdrop-filter, oklch colors, animations)
 * so html2canvas renders crisp and error-free.
 */
function prepareCleanExportNode(sourceElement: HTMLElement): { clone: HTMLElement; cleanup: () => void } {
  const clone = sourceElement.cloneNode(true) as HTMLElement;

  // Set explicit print-safe dimensions (A4 ratio width ~800px)
  clone.style.position = 'fixed';
  clone.style.top = '-10000px';
  clone.style.left = '-10000px';
  clone.style.width = '794px'; // 210mm @ 96 DPI
  clone.style.maxWidth = '794px';
  clone.style.zIndex = '-9999';
  clone.style.background = '#ffffff';
  clone.style.backgroundColor = '#ffffff';
  clone.style.color = '#0f172a';
  clone.style.boxShadow = 'none';
  clone.style.transform = 'none';
  clone.style.transition = 'none';
  clone.style.animation = 'none';
  clone.style.filter = 'none';
  clone.style.backdropFilter = 'none';
  (clone.style as any).webkitBackdropFilter = 'none';

  // Sanitize all descendants
  const allElements = clone.querySelectorAll('*');
  allElements.forEach((node) => {
    const el = node as HTMLElement;
    el.style.backdropFilter = 'none';
    (el.style as any).webkitBackdropFilter = 'none';
    el.style.animation = 'none';
    el.style.transition = 'none';

    // Replace translucent glass classes with clean solid borders and backgrounds
    if (el.classList.contains('glass-modal') || el.classList.contains('glass-panel') || el.classList.contains('glass-panel-subtle')) {
      el.style.backgroundColor = '#ffffff';
      el.style.borderColor = '#e2e8f0';
      el.style.boxShadow = 'none';
    }

    // Hide any interactive buttons in export
    if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') {
      el.style.display = 'none';
    }
  });

  document.body.appendChild(clone);

  const cleanup = () => {
    if (clone.parentNode) {
      clone.parentNode.removeChild(clone);
    }
  };

  return { clone, cleanup };
}

/**
 * Fallback vector PDF generator using native jsPDF drawing
 */
export function generateNativeVectorPDF(
  reportData: {
    monthName: string;
    totalLogs: number;
    activeDaysCount: number;
    daysInMonth: number;
    photoCount: number;
    topCategoryName: string;
    categories: Array<{ name: string; count: number; percentage: number }>;
    logs: Array<{ date: string; categoryName: string; notes?: string | null }>;
  },
  filename = 'activity_report.pdf'
) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 16;
  let y = margin;

  // Header Banner
  pdf.setFillColor(30, 41, 59); // slate-800
  pdf.roundedRect(margin, y, pageWidth - margin * 2, 28, 3, 3, 'F');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.setTextColor(255, 255, 255);
  pdf.text('MONTHLY ACTIVITY & HABIT REPORT', margin + 8, y + 11);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(203, 213, 225);
  pdf.text(`${reportData.monthName} Summary  |  Generated on ${new Date().toLocaleDateString()}`, margin + 8, y + 20);

  y += 36;

  // 4 Stat Metric Cards
  const cardWidth = (pageWidth - margin * 2 - 9) / 4;
  const stats = [
    { label: 'TOTAL LOGS', val: `${reportData.totalLogs}`, sub: 'activities recorded' },
    { label: 'ACTIVE DAYS', val: `${reportData.activeDaysCount}/${reportData.daysInMonth}`, sub: `${Math.round((reportData.activeDaysCount / (reportData.daysInMonth || 1)) * 100)}% consistency` },
    { label: 'TOP FOCUS', val: reportData.topCategoryName.slice(0, 14), sub: 'primary habit' },
    { label: 'PHOTOS', val: `${reportData.photoCount}`, sub: 'visual memories' },
  ];

  stats.forEach((st, i) => {
    const cx = margin + i * (cardWidth + 3);
    pdf.setFillColor(248, 250, 252);
    pdf.setDrawColor(226, 232, 240);
    pdf.roundedRect(cx, y, cardWidth, 22, 2, 2, 'FD');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(100, 116, 139);
    pdf.text(st.label, cx + 4, y + 6);

    pdf.setFontSize(12);
    pdf.setTextColor(15, 23, 42);
    pdf.text(st.val, cx + 4, y + 13);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.5);
    pdf.setTextColor(148, 163, 184);
    pdf.text(st.sub, cx + 4, y + 18);
  });

  y += 29;

  // Category Aggregate Breakdown Table
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(15, 23, 42);
  pdf.text('Category Aggregate Breakdown', margin, y);
  y += 5;

  pdf.setFillColor(241, 245, 249);
  pdf.rect(margin, y, pageWidth - margin * 2, 7, 'F');
  pdf.setFontSize(8);
  pdf.setTextColor(71, 85, 105);
  pdf.text('CATEGORY', margin + 4, y + 5);
  pdf.text('LOGS RECORDED', margin + 90, y + 5);
  pdf.text('SHARE (%)', margin + 140, y + 5);
  y += 8;

  pdf.setFont('helvetica', 'normal');
  reportData.categories.forEach((cat) => {
    pdf.setDrawColor(241, 245, 249);
    pdf.line(margin, y + 6, pageWidth - margin, y + 6);

    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(30, 41, 59);
    pdf.text(cat.name, margin + 4, y + 4);

    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(51, 65, 85);
    pdf.text(`${cat.count} logs`, margin + 90, y + 4);
    pdf.text(`${cat.percentage}%`, margin + 140, y + 4);

    y += 7;
  });

  y += 8;

  // Itemized Activity Log Entries
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(15, 23, 42);
  pdf.text(`Activity Entries (${reportData.logs.length})`, margin, y);
  y += 6;

  if (reportData.logs.length === 0) {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(9);
    pdf.setTextColor(148, 163, 184);
    pdf.text('No activity logged for this month.', margin, y + 4);
  } else {
    reportData.logs.forEach((log) => {
      // Add new page if y exceeds height
      if (y > 270) {
        pdf.addPage();
        y = margin;
      }

      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(226, 232, 240);
      pdf.roundedRect(margin, y, pageWidth - margin * 2, log.notes ? 16 : 10, 1.5, 1.5, 'FD');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(30, 41, 59);
      pdf.text(log.categoryName, margin + 4, y + 5.5);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(100, 116, 139);
      pdf.text(log.date, margin + 80, y + 5.5);

      if (log.notes) {
        pdf.setFontSize(7.5);
        pdf.setTextColor(71, 85, 105);
        const cleanNotes = log.notes.replace(/\n/g, ' ').slice(0, 110);
        pdf.text(cleanNotes, margin + 4, y + 11.5);
        y += 19;
      } else {
        y += 13;
      }
    });
  }

  const blob = pdf.output('blob');
  downloadBlob(blob, filename);
  return true;
}

/**
 * Main export function: Captures the report container with html2canvas and saves as high-res PDF.
 * If DOM capture fails, automatically falls back to clean vector PDF generation.
 */
export async function exportReportToPDF(
  elementId: string,
  filename = 'monthly_activity_report.pdf',
  fallbackData?: {
    monthName: string;
    totalLogs: number;
    activeDaysCount: number;
    daysInMonth: number;
    photoCount: number;
    topCategoryName: string;
    categories: Array<{ name: string; count: number; percentage: number }>;
    logs: Array<{ date: string; categoryName: string; notes?: string | null }>;
  }
) {
  const sourceElement = document.getElementById(elementId);

  if (!sourceElement) {
    if (fallbackData) {
      return generateNativeVectorPDF(fallbackData, filename);
    }
    throw new Error('Report container element not found.');
  }

  let cleanupFn: (() => void) | null = null;

  try {
    // 1. Prepare sanitized clone with solid colors & explicit bounds
    const { clone, cleanup } = prepareCleanExportNode(sourceElement);
    cleanupFn = cleanup;

    // Small delay to ensure styles settle
    await new Promise((resolve) => setTimeout(resolve, 60));

    // 2. Render to high-resolution canvas
    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: 794,
      windowWidth: 794,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF('p', 'mm', 'a4');

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const imgHeight = (canvasHeight * pageWidth) / canvasWidth;

    let heightLeft = imgHeight;
    let position = 0;

    // First page
    pdf.addImage(imgData, 'JPEG', 0, position, pageWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pageHeight;

    // Additional pages if needed
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, pageWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;
    }

    const pdfBlob = pdf.output('blob');
    downloadBlob(pdfBlob, filename);
    return true;
  } catch (err) {
    console.warn('[PDF Export] html2canvas export encountered issue, using vector generator fallback:', err);
    if (fallbackData) {
      return generateNativeVectorPDF(fallbackData, filename);
    }
    throw err;
  } finally {
    if (cleanupFn) {
      cleanupFn();
    }
  }
}
