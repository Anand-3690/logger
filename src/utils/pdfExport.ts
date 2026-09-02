import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// 1. downloadBlob Helper
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

// 2. prepareCleanExportNode (Safe Sanitizer & Smart Pagination)
function prepareCleanExportNode(sourceElement: HTMLElement): { clone: HTMLElement; cleanup: () => void } {
  const clone = sourceElement.cloneNode(true) as HTMLElement;
  
  const PAGE_WIDTH_PX = 1024; // Force desktop viewport
  
  // Calculate printable area ratio based on A4 with 12mm physical margins
  const PRINTABLE_RATIO = (297 - 24) / (210 - 24); 
  const PAGE_HEIGHT_PX = PAGE_WIDTH_PX * PRINTABLE_RATIO;
  
  clone.style.setProperty('position', 'absolute', 'important');
  clone.style.setProperty('top', '-10000px', 'important');
  clone.style.setProperty('left', '-10000px', 'important');
  clone.style.setProperty('width', `${PAGE_WIDTH_PX}px`, 'important');
  clone.style.setProperty('background-color', '#ffffff', 'important');

  // Natively convert ALL modern colors to safe rgb()
  const colorCache = new Map<string, string>();
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = 1; tempCanvas.height = 1;
  const ctx = tempCanvas.getContext('2d', { willReadFrequently: true });

  function getSafeColor(cssColor: string): string {
    if (!cssColor || (!cssColor.includes('oklch') && !cssColor.includes('oklab') && !cssColor.includes('color('))) return cssColor;
    if (colorCache.has(cssColor)) return colorCache.get(cssColor)!;
    if (!ctx) return 'transparent';
    
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = cssColor;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    
    const safeColor = a === 0 ? 'transparent' : `rgba(${r}, ${g}, ${b}, ${a / 255})`;
    colorCache.set(cssColor, safeColor);
    return safeColor;
  }

  const allElements = clone.querySelectorAll('*');
  const sourceElements = sourceElement.querySelectorAll('*');

  const propsToInline = [
    'color', 'backgroundColor', 'borderTopColor', 'borderRightColor', 
    'borderBottomColor', 'borderLeftColor', 'fill', 'stroke'
  ];

  allElements.forEach((node, index) => {
    const el = node as HTMLElement | SVGElement;
    const sourceEl = sourceElements[index];
    
    if (sourceEl) {
      const compStyle = window.getComputedStyle(sourceEl);
      propsToInline.forEach(prop => {
        const val = (compStyle as any)[prop];
        // CRITICAL FIX: Only apply manual color overwrites IF it has modern colors to prevent layout destruction
        if (val && (val.includes('oklch') || val.includes('oklab') || val.includes('color('))) {
          const kebabProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
          el.style.setProperty(kebabProp, getSafeColor(val), 'important');
        }
      });
    }

    // Force universal unicode fonts for perfectly rendered Gujarati
    el.style.setProperty('font-family', "'Plus Jakarta Sans', 'Noto Sans Gujarati', 'Shruti', 'Nirmala UI', 'Gujarati Sangam MN', Arial, sans-serif", 'important');
    
    el.style.setProperty('background-image', 'none', 'important');
    el.style.setProperty('box-shadow', 'none', 'important');
    
    // CRITICAL FIX: Apply text wrapping ONLY to text tags, ignoring Grid/Flex layout <div>s
    if (['P', 'SPAN', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(el.tagName)) {
      el.style.setProperty('white-space', 'pre-wrap', 'important');
      el.style.setProperty('word-break', 'break-word', 'important');
    }

    if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' || el.textContent?.trim() === 'Zoom') {
      el.style.setProperty('display', 'none', 'important');
      if (el.textContent?.trim() === 'Zoom' && el.parentElement) {
        el.parentElement.style.setProperty('display', 'none', 'important');
      }
    }
  });

  // MUST append to body first so we can measure actual rendered heights
  document.body.appendChild(clone);

  // ==========================================
  // --- INTELLIGENT PAGINATION ENGINE ---
  // ==========================================
  const allDivs = Array.from(clone.querySelectorAll('div, section, article, li'));
  const potentialCards = allDivs.filter(el => {
    const htmlEl = el as HTMLElement;
    const style = window.getComputedStyle(htmlEl);
    const hasBorder = style.borderWidth !== '0px' && style.borderStyle !== 'none';
    const hasBg = style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent';
    const isPanel = htmlEl.classList.contains('glass-panel') || htmlEl.classList.contains('glass-panel-subtle') || htmlEl.classList.contains('rounded-xl');
    
    const isSignificantHeight = htmlEl.offsetHeight > 40 && htmlEl.offsetHeight < PAGE_HEIGHT_PX * 0.8;
    const isFullWidth = htmlEl.offsetWidth > (PAGE_WIDTH_PX * 0.5); 
    
    return (hasBorder || hasBg || isPanel) && isSignificantHeight && isFullWidth;
  });

  const outermostCards = potentialCards.filter(card => {
    let parent = card.parentElement;
    while (parent && parent !== clone) {
      if (potentialCards.includes(parent)) return false; 
      parent = parent.parentElement;
    }
    return true;
  });

  for (let i = 0; i < outermostCards.length; i++) {
    const el = outermostCards[i] as HTMLElement;
    
    const cloneRect = clone.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const topRelativeToClone = elRect.top - cloneRect.top;
    const height = elRect.height;
    
    const currentPage = Math.floor(topRelativeToClone / PAGE_HEIGHT_PX);
    const pageBottom = (currentPage + 1) * PAGE_HEIGHT_PX;
    
    if (topRelativeToClone + height > pageBottom - 20) {
      const pushAmount = pageBottom - topRelativeToClone;
      const currentMargin = parseFloat(window.getComputedStyle(el).marginTop || '0');
      // Push cleanly to the top of the next page
      el.style.setProperty('margin-top', `${currentMargin + pushAmount + 20}px`, 'important');
    }
  }

  return { clone, cleanup: () => { if (clone.parentNode) clone.parentNode.removeChild(clone); } };
}

// 3. generateNativeVectorPDF (Fallback)
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

  pdf.setFillColor(30, 41, 59);
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
        const cleanNotes = log.notes.replace(/\n/g, ' ');
        pdf.text(cleanNotes, margin + 4, y + 11.5, { maxWidth: pageWidth - margin * 2 - 8 });
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

// 4. exportReportToPDF (The Main Visual Engine)
export async function exportReportToPDF(
  elementId: string,
  filename = 'monthly_activity_report.pdf',
  fallbackData?: any
) {
  const sourceElement = document.getElementById(elementId);
  if (!sourceElement) {
    if (fallbackData) return generateNativeVectorPDF(fallbackData, filename);
    throw new Error('Report container element not found.');
  }

  let cleanupFn: (() => void) | null = null;
  try {
    await document.fonts.ready;

    const { clone, cleanup } = prepareCleanExportNode(sourceElement);
    cleanupFn = cleanup;

    await new Promise((resolve) => setTimeout(resolve, 200)); 

    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false,
      backgroundColor: '#ffffff',
      width: 1024, 
      windowWidth: 1024, 
      onclone: (clonedDoc) => {
        // DEFENSE 1: Safe regex that ONLY targets modern color strings. Does not corrupt CSS.
        clonedDoc.querySelectorAll('style').forEach(s => {
          try {
            s.innerHTML = s.innerHTML.replace(/(oklch|oklab|color)\([^)]+\)/gi, 'rgba(0,0,0,0)');
          } catch(e) {}
        });

        // DEFENSE 2: Safely hide pseudo-elements without breaking the grid
        const styleGuard = clonedDoc.createElement('style');
        styleGuard.innerHTML = `
          * {
            box-shadow: none !important;
            background-image: none !important;
          }
          *::before, *::after {
            display: none !important;
          }
        `;
        clonedDoc.head.appendChild(styleGuard);
      }
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    // Exact A4 dimensions in jsPDF (mm)
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    // Apply 12mm absolute margin inside the PDF itself for perfectly clean edges
    const margin = 12; 
    const renderWidth = pdfWidth - (margin * 2);
    const renderHeight = pdfHeight - (margin * 2);
    
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const imgHeight = (canvasHeight * renderWidth) / canvasWidth;
    
    let heightLeft = imgHeight;
    let position = 0; // Relative image shift tracking

    // Page 1
    pdf.addImage(imgData, 'JPEG', margin, margin, renderWidth, imgHeight, undefined, 'FAST');
    heightLeft -= renderHeight;

    // Remaining pages
    while (heightLeft > 0) {
      position -= renderHeight; // Shift the canvas up by one exact page
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', margin, margin + position, renderWidth, imgHeight, undefined, 'FAST');
      heightLeft -= renderHeight;
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
    if (cleanupFn) cleanupFn();
  }
}