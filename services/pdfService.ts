
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { WorkOrder, ShiftReport, CrossCheckResult, PredictiveInsight, ToDoItem } from '../types';
import { excelDateToJSDate } from '../utils';

// Helper to load font supporting Turkish characters
const addTurkishFont = async (doc: jsPDF) => {
    const fontBaseUrl = "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/";
    
    const loadFont = async (filename: string, fontName: string, style: string) => {
        try {
            const response = await fetch(fontBaseUrl + filename);
            if (!response.ok) throw new Error(`Font yüklenemedi: ${filename}`);
            
            const blob = await response.blob();
            return new Promise<void>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64data = (reader.result as string).split(',')[1];
                    if (base64data) {
                        doc.addFileToVFS(filename, base64data);
                        doc.addFont(filename, fontName, style);
                        resolve();
                    } else {
                        reject(new Error("Base64 dönüşüm hatası"));
                    }
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.warn(`Font yükleme hatası (${filename}):`, error);
        }
    };

    await Promise.all([
        loadFont('Roboto-Regular.ttf', 'Roboto', 'normal'),
        loadFont('Roboto-Medium.ttf', 'Roboto', 'bold') 
    ]);

    doc.setFont('Roboto', 'normal');
};

// --- 1. DASHBOARD & CHARTS ---
export const generateDashboardPDF = async (
  kpiRef: HTMLElement,
  chartsRef: HTMLElement,
  data: WorkOrder[]
) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  await addTurkishFont(doc);

  const pageWidth = 210;
  const margin = 10;
  let currentY = 15;

  doc.setFont('Roboto', 'bold');
  doc.setFontSize(16);
  doc.text("KURUMSAL BAKIM RAPORU (GENEL)", margin, currentY);
  currentY += 10;

  try {
    // 1. KPIs
    const kpiCanvas = await html2canvas(kpiRef, { scale: 2 });
    const kpiRatio = kpiCanvas.height / kpiCanvas.width;
    const kpiWidth = pageWidth - (margin * 2);
    doc.addImage(kpiCanvas.toDataURL('image/png'), 'PNG', margin, currentY, kpiWidth, kpiWidth * kpiRatio);
    currentY += (kpiWidth * kpiRatio) + 10;

    // 2. Charts
    const scrollableDivs = chartsRef.getElementsByClassName('pdf-scroll-container');
    const originalStyles: { maxHeight: string; overflow: string }[] = [];

    for (let i = 0; i < scrollableDivs.length; i++) {
        const div = scrollableDivs[i] as HTMLElement;
        originalStyles.push({ maxHeight: div.style.maxHeight, overflow: div.style.overflow });
        div.style.maxHeight = 'none';
        div.style.overflow = 'visible';
    }

    const chartCanvas = await html2canvas(chartsRef, { scale: 2 });
    
    for (let i = 0; i < scrollableDivs.length; i++) {
        const div = scrollableDivs[i] as HTMLElement;
        div.style.maxHeight = originalStyles[i].maxHeight;
        div.style.overflow = originalStyles[i].overflow;
    }

    const chartRatio = chartCanvas.height / chartCanvas.width;
    const chartWidth = pageWidth - (margin * 2);

    if (currentY + (chartWidth * chartRatio) > 280) {
        doc.addPage();
        currentY = 15;
    }
    doc.addImage(chartCanvas.toDataURL('image/png'), 'PNG', margin, currentY, chartWidth, chartWidth * chartRatio);
    currentY += (chartWidth * chartRatio) + 10;

    doc.save(`Genel_Rapor_${Date.now()}.pdf`);
  } catch (err) {
    console.error("PDF Export Error", err);
    throw err;
  }
};

// --- 2. ASSETS ---
export const generateAssetsReportPDF = async (assets: any[]) => {
    const doc = new jsPDF('l', 'mm', 'a4');
    await addTurkishFont(doc);

    const pageWidth = 297;
    const margin = 15;
    let currentY = 20;

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('Roboto', 'bold');
    doc.text("VARLIK ENVANTER & DURUM RAPORU", margin, 20);
    
    doc.setFontSize(10);
    doc.setFont('Roboto', 'normal');
    doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, margin, 30);

    currentY = 55;

    const rows = assets.map(asset => [
        asset.name,
        asset.status === 'Operational' ? 'SAĞLIKLI' : asset.status === 'Warning' ? 'DİKKAT' : asset.status === 'Critical' ? 'KRİTİK' : 'VERİ YOK',
        `${asset.healthScore}/100`,
        asset.openWOs,
        asset.downtimeEvents,
        asset.lastMaintenanceDate ? asset.lastMaintenanceDate.toLocaleDateString('tr-TR') : '-'
    ]);

    autoTable(doc, {
        startY: currentY,
        head: [['VARLIK ADI', 'DURUM', 'SAĞLIK', 'AÇIK İŞ', 'TOPLAM ARIZA', 'SON İŞLEM']],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], font: 'Roboto', fontStyle: 'bold' },
        styles: { fontSize: 9, font: 'Roboto', cellPadding: 4 },
        margin: { left: margin, right: margin }
    });

    doc.save(`Varlik_Raporu_${new Date().toISOString().split('T')[0]}.pdf`);
};

// --- 3. SINGLE WORK ORDER ---
export const generateSinglePDF = async (item: WorkOrder) => {
    const doc = new jsPDF();
    await addTurkishFont(doc);
    const pageWidth = 210;
    const margin = 15;

    doc.setFontSize(16); 
    doc.setFont('Roboto', 'bold');
    doc.text(`İŞ EMRİ: ${item['Work order code']}`, margin, 20);
    
    doc.setFontSize(10);
    doc.setFont('Roboto', 'normal');
    let currentY = 30;
    
    const lines = [
        `Tanım: ${item['Work order name']}`,
        `Varlık: ${item['Asset Name'] || '-'}`,
        `Durum: ${item['Status code']}`,
    ];

    lines.forEach(line => {
        doc.text(line, margin, currentY);
        currentY += 8;
    });
    
    doc.save(`Form_${item['Work order code']}.pdf`);
};

// --- 4. DOWNTIME REPORT ---
export const generateDowntimeReportPDF = async (
    activeDowntimes: WorkOrder[], 
    resolvedDowntimes: WorkOrder[], 
    totalCount: number, 
    monthLabel: string,
    chartElement?: HTMLElement | null
) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    await addTurkishFont(doc);

    const pageWidth = 210;
    const margin = 15;
    let currentY = 20;

    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('Roboto', 'bold');
    doc.text("ARIZA & DURUŞ RAPORU", margin, 20);
    doc.setFontSize(10);
    doc.setFont('Roboto', 'normal');
    doc.text(`Dönem: ${monthLabel}`, margin, 28);

    currentY = 55;

    if (chartElement) {
        try {
            const canvas = await html2canvas(chartElement, { scale: 2 });
            const chartRatio = canvas.height / canvas.width;
            const chartWidth = pageWidth - (margin * 2);
            doc.addImage(canvas.toDataURL('image/png'), 'PNG', margin, currentY, chartWidth, chartWidth * chartRatio);
            currentY += (chartWidth * chartRatio) + 15;
        } catch (e) { console.error("Chart capture failed", e); }
    }

    const prepareTableData = (items: WorkOrder[]) => {
        const rows: any[] = [];
        items.forEach(item => {
            const comment = item['Comments: Name without formatting'];
            const dateStr = item['Work order start date/time'] ? excelDateToJSDate(item['Work order start date/time']).toLocaleDateString('tr-TR') : '-';
            
            // Row 1: Main Data (Bold Code and Name)
            rows.push([
                { content: item['Work order code'], styles: { fontStyle: 'bold', textColor: [0,0,0] } },
                { content: item['Work order name'] || 'Tanımsız İş', styles: { fontStyle: 'bold', textColor: [0,0,0] } },
                item['Status code'] || '',
                dateStr
            ]);

            // Row 2: Comments (if any) - Styled lighter and italic
            if (comment && comment.trim().length > 0) {
                rows.push([
                    { content: '', styles: { cellPadding: 0, minCellHeight: 0 } }, // Spacer
                    { 
                        content: `[ NOT ]: ${comment}`, 
                        styles: { fontStyle: 'italic', textColor: [80, 80, 80], fontSize: 8 },
                        colSpan: 1
                    },
                    { content: '', colSpan: 2, styles: { cellPadding: 0, minCellHeight: 0 } } // Spacer
                ]);
            }
        });
        return rows;
    };

    if (activeDowntimes.length > 0) {
        doc.setFontSize(12); doc.setTextColor(225, 29, 72); doc.setFont('Roboto', 'bold');
        doc.text("DEVAM EDEN ARIZALAR", margin, currentY);
        currentY += 5;
        
        autoTable(doc, {
            startY: currentY,
            head: [['KOD', 'İŞ TANIMI VE DETAYLAR', 'DURUM', 'BAŞLANGIÇ']],
            body: prepareTableData(activeDowntimes),
            theme: 'grid',
            headStyles: { fillColor: [225, 29, 72], font: 'Roboto', fontStyle: 'bold' },
            styles: { fontSize: 8, font: 'Roboto', overflow: 'linebreak', cellWidth: 'wrap', valign: 'top' },
            columnStyles: { 
                0: { cellWidth: 25 },
                1: { cellWidth: 'auto' }, 
                2: { cellWidth: 25 },
                3: { cellWidth: 25 }
            },
            margin: { left: margin, right: margin }
        });
        // @ts-ignore
        currentY = doc.lastAutoTable.finalY + 15;
    }

    if (resolvedDowntimes.length > 0) {
        doc.setFontSize(12); doc.setTextColor(16, 185, 129); doc.setFont('Roboto', 'bold');
        doc.text("ÇÖZÜLEN ARIZALAR", margin, currentY);
        currentY += 5;
        
        autoTable(doc, {
            startY: currentY,
            head: [['KOD', 'İŞ TANIMI VE DETAYLAR', 'DURUM', 'BAŞLANGIÇ']],
            body: prepareTableData(resolvedDowntimes),
            theme: 'grid',
            headStyles: { fillColor: [16, 185, 129], font: 'Roboto', fontStyle: 'bold' },
            styles: { fontSize: 8, font: 'Roboto', overflow: 'linebreak', cellWidth: 'wrap', valign: 'top' },
            columnStyles: { 
                0: { cellWidth: 25 },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 25 },
                3: { cellWidth: 25 }
            },
            margin: { left: margin, right: margin }
        });
    }

    doc.save(`Ariza_Raporu_${monthLabel}.pdf`);
};

// --- 5. PREDICTIVE REPORT ---
export const generatePredictiveReportPDF = async (insights: PredictiveInsight[]) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    await addTurkishFont(doc);
    const pageWidth = 210;
    const margin = 15;

    doc.setFillColor(124, 58, 237); // Violet
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('Roboto', 'bold');
    doc.text("PROAKTİF BAKIM RAPORU", margin, 20);
    doc.setFontSize(10);
    doc.setFont('Roboto', 'normal');
    doc.text(`Oluşturulma: ${new Date().toLocaleDateString('tr-TR')}`, margin, 28);

    let currentY = 55;

    const rows = insights.map(i => [
        i.assetName,
        i.riskLevel === 'High' ? 'YÜKSEK' : i.riskLevel === 'Medium' ? 'ORTA' : 'DÜŞÜK',
        `${i.probability}%`,
        i.reason,
        i.suggestedAction,
        i.suggestedDate
    ]);

    autoTable(doc, {
        startY: currentY,
        head: [['VARLIK', 'RİSK', 'İHTİMAL', 'NEDEN', 'AKSİYON', 'TARİH']],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: [124, 58, 237], font: 'Roboto', fontStyle: 'bold' },
        styles: { fontSize: 8, font: 'Roboto', overflow: 'linebreak', cellWidth: 'wrap' },
        columnStyles: { 
            0: { cellWidth: 25, fontStyle: 'bold' },
            3: { cellWidth: 50 },
            4: { cellWidth: 50 }
        },
        margin: { left: margin, right: margin }
    });

    doc.save(`Proaktif_Analiz_${Date.now()}.pdf`);
};

// --- 6. TODO LIST REPORT ---
export const generateToDoPDF = async (todos: ToDoItem[]) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    await addTurkishFont(doc);
    const pageWidth = 210;
    const margin = 15;

    doc.setFillColor(79, 70, 229); // Indigo
    doc.rect(0, 0, pageWidth, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('Roboto', 'bold');
    doc.text("GÖREV LİSTESİ", margin, 18);

    const rows = todos.map(t => [
        t.title,
        t.status,
        t.priority,
        t.assignedTo ? t.assignedTo.split('@')[0] : '-',
        t.dueDate ? new Date(t.dueDate).toLocaleDateString('tr-TR') : '-'
    ]);

    autoTable(doc, {
        startY: 40,
        head: [['GÖREV', 'DURUM', 'ÖNCELİK', 'SORUMLU', 'TERMİN']],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229], font: 'Roboto' },
        styles: { fontSize: 9, font: 'Roboto' },
        margin: { left: margin, right: margin }
    });

    doc.save(`Gorev_Listesi_${Date.now()}.pdf`);
};

// --- 7. CALENDAR REPORT (Image Capture) ---
export const generateCalendarPDF = async (element: HTMLElement, monthName: string) => {
    const doc = new jsPDF('l', 'mm', 'a4');
    await addTurkishFont(doc);
    const pageWidth = 297;
    const margin = 10;

    doc.setFontSize(16);
    doc.setFont('Roboto', 'bold');
    doc.text(`İŞ TAKVİMİ - ${monthName}`, margin, 15);

    try {
        const canvas = await html2canvas(element, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const imgProps = doc.getImageProperties(imgData);
        const pdfWidth = pageWidth - (margin * 2);
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        doc.addImage(imgData, 'PNG', margin, 25, pdfWidth, pdfHeight);
        doc.save(`Takvim_${monthName}.pdf`);
    } catch (e) {
        console.error(e);
        throw new Error("Takvim PDF'i oluşturulamadı");
    }
};

// --- INTERNAL DRAW HELPER (Modern Design) ---
const drawShiftReportPage = (doc: jsPDF, report: ShiftReport, crossCheck?: CrossCheckResult | null) => {
    const pageWidth = 210;
    const margin = 15;
    
    // --- HEADER ---
    doc.setFillColor(15, 23, 42); // Brand 950
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    // Title & Date
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('Roboto', 'bold');
    doc.text("VARDİYA RAPORU", margin, 22);
    
    // Sub-info in Header
    doc.setFontSize(10);
    doc.setFont('Roboto', 'normal');
    doc.setTextColor(203, 213, 225); // Slate 300
    doc.text("KURUMSAL BAKIM GÜNLÜĞÜ", margin, 28);

    // Right Side Header Info
    const dateObj = excelDateToJSDate(report.dateStr);
    const dateDisplay = !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : report.dateStr;
    
    doc.setFontSize(14);
    doc.setFont('Roboto', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(dateDisplay, pageWidth - margin, 22, { align: 'right' });
    
    doc.setFontSize(11);
    doc.setFont('Roboto', 'normal');
    doc.setTextColor(255, 255, 255);
    doc.text(report.shiftName.toUpperCase(), pageWidth - margin, 28, { align: 'right' });

    let currentY = 60;

    // --- KPI BOXES (Metrics) ---
    const drawBox = (x: number, label: string, val: number, color: [number, number, number]) => {
        doc.setFillColor(color[0], color[1], color[2]);
        doc.roundedRect(x, 50, 55, 20, 3, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont('Roboto', 'bold');
        doc.text(label, x + 5, 58);
        doc.setFontSize(14);
        doc.text(val.toString() + " Adet", x + 5, 65);
    };

    drawBox(margin, "TAMAMLANAN", report.completedJobs.length, [22, 163, 74]); // Green
    drawBox(margin + 60, "ARIZA / SORUN", report.issues.length, [220, 38, 38]); // Red
    drawBox(margin + 120, "DEVREDEN", report.pending.length, [217, 119, 6]); // Amber

    currentY = 80;

    // --- INFO GRID ---
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, currentY, pageWidth - (margin*2), 25, 3, 3, 'FD');
    
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.setFont('Roboto', 'normal');
    doc.text("PERSONEL", margin + 5, currentY + 8);
    doc.text("RAPORLAYAN", margin + 70, currentY + 8);
    doc.text("OLUŞTURMA SAATİ", margin + 130, currentY + 8);

    doc.setTextColor(15, 23, 42);
    doc.setFont('Roboto', 'bold');
    const personnelText = report.personnel.join(', ');
    const splitPersonnel = doc.splitTextToSize(personnelText, 55);
    doc.text(splitPersonnel, margin + 5, currentY + 15);
    doc.text(report.createdBy.split('@')[0], margin + 70, currentY + 15);
    doc.text(new Date(report.createdAt).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'}), margin + 130, currentY + 15);

    currentY += 35;

    // --- AI SUMMARY ---
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.setFont('Roboto', 'bold');
    doc.text("YÖNETİCİ ÖZETİ", margin, currentY);
    currentY += 5;

    doc.setFillColor(241, 245, 249); // Slate 100
    doc.setDrawColor(203, 213, 225);
    
    doc.setFont('Roboto', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    
    const summaryLines = doc.splitTextToSize(report.aiSummary, pageWidth - (margin * 2) - 10);
    const summaryHeight = (summaryLines.length * 5) + 10;
    
    doc.roundedRect(margin, currentY, pageWidth - (margin*2), summaryHeight, 2, 2, 'FD');
    doc.text(summaryLines, margin + 5, currentY + 7);
    
    currentY += summaryHeight + 15;

    // --- DETAILED LISTS ---
    const lists = [
        { 
            title: 'TAMAMLANAN İŞLER', 
            data: report.completedJobs, 
            headColor: [22, 163, 74] as [number, number, number] 
        },
        { 
            title: 'ARIZALAR VE PROBLEMLER', 
            data: report.issues, 
            headColor: [220, 38, 38] as [number, number, number] 
        },
        { 
            title: 'SONRAKİ VARDİYAYA DEVREDENLER', 
            data: report.pending, 
            headColor: [217, 119, 6] as [number, number, number] 
        }
    ];

    lists.forEach(list => {
        // If content will overflow, add page
        if (currentY > 250) {
            doc.addPage();
            currentY = 20;
        }

        if (list.data.length > 0) {
            autoTable(doc, {
                startY: currentY,
                head: [[list.title]],
                body: list.data.map(i => [`• ${i}`]),
                theme: 'grid',
                headStyles: { 
                    fillColor: list.headColor, 
                    textColor: 255, 
                    font: 'Roboto', 
                    fontStyle: 'bold',
                    halign: 'left',
                    cellPadding: 3
                },
                styles: { 
                    font: 'Roboto', 
                    fontSize: 9, 
                    cellPadding: 3,
                    textColor: [51, 65, 85]
                },
                margin: { left: margin, right: margin },
                didDrawPage: (data) => {
                    currentY = data.cursor ? data.cursor.y : currentY;
                }
            });
            // @ts-ignore
            currentY = doc.lastAutoTable.finalY + 10;
        }
    });

    // --- CROSS CHECK (If exists) ---
    if (crossCheck) {
        if (currentY + 40 > 280) { doc.addPage(); currentY = 20; }
        
        doc.setFillColor(241, 245, 249);
        doc.rect(margin, currentY, pageWidth - (margin*2), 30, 'F');
        doc.setFont('Roboto', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text("SİSTEM ÇAPRAZ KONTROLÜ", margin + 5, currentY + 8);
        doc.setFont('Roboto', 'normal');
        doc.setFontSize(10);
        doc.text(`Doğruluk Skoru: %${crossCheck.score}`, margin + 5, currentY + 15);
        doc.setFontSize(9);
        doc.text("Sistemdeki iş emirleri ile karşılaştırma sonucu oluşturulmuştur.", margin + 5, currentY + 22);
    }

    // --- FOOTER ---
    const pageCount = doc.internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`WO Manager Enterprise - Sayfa ${i} / ${pageCount}`, margin, 290);
    }
};

// --- 8. SHIFT REPORT LIST (UPDATED TO DETAILED BOOKLET) ---
export const generateShiftListPDF = async (reports: ShiftReport[]) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    await addTurkishFont(doc);

    // --- COVER PAGE ---
    doc.setFillColor(15, 23, 42); // Brand 950
    doc.rect(0, 0, 210, 297, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(32);
    doc.setFont('Roboto', 'bold');
    doc.text("VARDİYA RAPOR ARŞİVİ", 20, 100);
    
    doc.setFontSize(16);
    doc.setFont('Roboto', 'normal');
    doc.text("DETAYLI LİSTE DÖKÜMÜ", 20, 110);
    
    doc.setFontSize(12);
    doc.text(`Raporlanan Kayıt Sayısı: ${reports.length}`, 20, 125);
    doc.text(`Oluşturulma Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, 20, 132);

    // Sort reports: Newest First
    const sortedReports = [...reports].sort((a, b) => b.createdAt - a.createdAt);

    // --- DETAILED PAGES FOR EACH REPORT ---
    for (const report of sortedReports) {
        doc.addPage();
        drawShiftReportPage(doc, report, null);
    }

    doc.save(`Vardiya_Arsivi_Detayli_${Date.now()}.pdf`);
};

// --- 9. SINGLE SHIFT DETAIL ---
export const generateShiftReportPDF = async (report: ShiftReport, crossCheck?: CrossCheckResult | null) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    await addTurkishFont(doc);
    drawShiftReportPage(doc, report, crossCheck);
    doc.save(`Vardiya_Raporu_${report.dateStr}.pdf`);
};

// --- 10. BULK SHIFT REPORT (SAME LOGIC) ---
export const generateBulkShiftReportsPDF = async (reports: ShiftReport[]) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    await addTurkishFont(doc);

    // Cover Page
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 297, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(32);
    doc.setFont('Roboto', 'bold');
    doc.text("VARDİYA RAPORLARI", 20, 100);
    doc.setFontSize(16);
    doc.setFont('Roboto', 'normal');
    doc.text("TOPLU DÖKÜM DOSYASI", 20, 110);
    doc.text(`Toplam Rapor: ${reports.length}`, 20, 125);
    doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 20, 135);

    // Detailed Pages for each report
    for (let i = 0; i < reports.length; i++) {
        doc.addPage();
        drawShiftReportPage(doc, reports[i], null);
    }

    doc.save(`Toplu_Vardiya_Raporlari_${Date.now()}.pdf`);
};
