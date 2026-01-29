
import React, { useState, useMemo, useEffect } from 'react';
import { ShiftReport, WorkOrder, CrossCheckResult } from '../types';
import { GoogleGenAI } from "@google/genai";
import { MessageSquarePlus, CalendarDays, Users, CheckCircle2, AlertTriangle, Clock, Trash2, BrainCircuit, Loader2, ClipboardList, Send, FileText, ChevronRight, Sparkles, CalendarRange, X, CheckSquare, Square, Table, ListChecks, Filter, Zap, Target, TrendingUp, BarChart3, ArrowRight, ArrowLeft, RefreshCw, FileWarning, SearchCheck, Scale, AlertCircle, Search, History, Calendar as CalendarIcon, Printer, Share2 } from 'lucide-react';
import { excelDateToJSDate } from '../utils';
import { generateShiftReportPDF, generateBulkShiftReportsPDF, generateShiftListPDF } from '../services/pdfService';

interface ShiftReportsPageProps {
  reports: ShiftReport[];
  workOrders: WorkOrder[];
  currentUserEmail: string;
  onAdd: (report: Omit<ShiftReport, 'id' | 'createdAt'>) => Promise<void>;
  onDelete: (id: string) => void;
}

interface AiSummaryData {
    title: string;
    dateRangeLabel: string;
    executiveSummary: string;
    keyMetrics: Array<{ label: string; value: string; color: 'blue' | 'green' | 'rose' | 'amber' }>;
    shiftsTimeline: Array<{ 
        date: string; 
        shiftName: string; 
        score: number; 
        mainEvent: string; 
        status: 'Perfect' | 'Good' | 'Issues' | 'Critical' 
    }>;
    topFailures: string[];
    strategicRecommendations: string[];
    weeklyFocus: string;
}

export const ShiftReportsPage: React.FC<ShiftReportsPageProps> = ({ reports, workOrders, currentUserEmail, onAdd, onDelete }) => {
  const [inputMode, setInputMode] = useState(false);
  const [rawText, setRawText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ShiftReport | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Cross Check State
  const [matchingWorkOrders, setMatchingWorkOrders] = useState<WorkOrder[]>([]);
  const [crossCheckResult, setCrossCheckResult] = useState<CrossCheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPrintingList, setIsPrintingList] = useState(false);

  // Delete Confirmation State
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean; type: 'single' | 'day'; id?: string; date?: string; } | null>(null);

  // Summary Modal State
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [selectedReportIds, setSelectedReportIds] = useState<Set<string>>(new Set());
  const [summaryData, setSummaryData] = useState<AiSummaryData | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isBulkPrinting, setIsBulkPrinting] = useState(false);

  // Specific Day Printing State
  const [printingDay, setPrintingDay] = useState<string | null>(null);

  // Scroll Lock Effect for Modals
  useEffect(() => {
    if (showSummaryModal || deleteConfirmation?.isOpen) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [showSummaryModal, deleteConfirmation]);

  useEffect(() => {
      if (!selectedReport) { setMatchingWorkOrders([]); setCrossCheckResult(null); return; }
      const reportDate = excelDateToJSDate(selectedReport.dateStr);
      if (isNaN(reportDate.getTime())) return;
      reportDate.setHours(0,0,0,0); const lookbackDate = new Date(reportDate); lookbackDate.setDate(reportDate.getDate() - 7);
      const matches = workOrders.filter(wo => {
          if (!wo['Work order start date/time']) return false;
          const woDate = excelDateToJSDate(wo['Work order start date/time']);
          if (isNaN(woDate.getTime())) return false;
          woDate.setHours(0,0,0,0); return woDate >= lookbackDate && woDate <= reportDate;
      });
      matches.sort((a, b) => { const dateA = excelDateToJSDate(a['Work order start date/time']).getTime(); const dateB = excelDateToJSDate(b['Work order start date/time']).getTime(); return dateB - dateA; });
      setMatchingWorkOrders(matches); setCrossCheckResult(null);
  }, [selectedReport, workOrders]);

  const handlePrint = async () => { if (!selectedReport) return; setIsPrinting(true); try { await generateShiftReportPDF(selectedReport, crossCheckResult); } catch (e) { alert('PDF oluşturulurken bir hata meydana geldi.'); console.error(e); } finally { setIsPrinting(false); } };
  const handleBulkExport = async () => { if (selectedReportIds.size === 0) return; setIsBulkPrinting(true); try { const selectedReports = reports.filter(r => selectedReportIds.has(r.id)); selectedReports.sort((a,b) => b.createdAt - a.createdAt); await generateBulkShiftReportsPDF(selectedReports); } catch(e) { alert("Toplu PDF oluşturulamadı."); console.error(e); } finally { setIsBulkPrinting(false); } };
  const handlePrintList = async () => { if(reports.length === 0) return; setIsPrintingList(true); try { await generateShiftListPDF(reports); } catch(e) { alert("Liste PDF oluşturulamadı"); } finally { setIsPrintingList(false); } };

  const handlePrintDay = async (e: React.MouseEvent, dayReports: ShiftReport[], dateKey: string) => {
      e.stopPropagation();
      setPrintingDay(dateKey);
      try {
          const sortedDayReports = [...dayReports].sort((a, b) => a.createdAt - b.createdAt);
          await generateShiftListPDF(sortedDayReports);
      } catch (e) {
          alert("Günlük rapor oluşturulamadı.");
          console.error(e);
      } finally {
          setPrintingDay(null);
      }
  };

  const handleCrossCheckAnalysis = async () => {
      if (!selectedReport) return;
      setIsChecking(true);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const systemData = matchingWorkOrders.map(w => ({ id: w['Work order code'], description: w['Work order name'], status: w['Status code'], asset: w['Asset Name'] || 'Bilinmiyor', date: w['Work order start date/time'] ? excelDateToJSDate(w['Work order start date/time']).toLocaleDateString('tr-TR') : '-' }));
          const reportData = { date: selectedReport.dateStr, shift: selectedReport.shiftName, reported_completed_tasks: selectedReport.completedJobs, reported_issues: selectedReport.issues, summary: selectedReport.aiSummary };
          const systemInstruction = `Sen kıdemli bir bakım denetçisisin. Görevin "Sistem Veritabanı" ile "Vardiya Raporu"nu karşılaştırıp tutarlılık analizi yapmak. ANALİZ KURALLARI: 1. **Semantic Matching:** Raporda "Pompa yapıldı" yazabilir, sistemde "Hidrolik Pompa Bakımı" yazabilir. Bunları eşleşmiş kabul et. 2. **Missing In Report:** Sistemde durumu "Closed" olan ama Raporda bahsedilmeyen işler. 3. **Missing In DB:** Raporda "Yaptık" denilen ama Sistem Listesinde olmayan işler. 4. **Perfect Matches:** Her iki tarafta doğrulanan işler. 5. **Score:** Doğruluk skoru 0-100. ÇIKTI FORMATI (JSON): { "score": 85, "summary": "Kısa analiz özeti", "missingInDb": [], "missingInReport": [], "perfectMatches": [] }`;
          const contents = `VERİLER: SISTEM_DB: ${JSON.stringify(systemData)} RAPOR: ${JSON.stringify(reportData)}`;
          const response = await ai.models.generateContent({ model: "gemini-3-pro-preview", contents: contents, config: { responseMimeType: "application/json", systemInstruction: systemInstruction } });
          const cleanedText = response.text?.replace(/```json/g, '').replace(/```/g, '').trim() || '{}';
          const result = JSON.parse(cleanedText);
          setCrossCheckResult(result);
      } catch (error) { console.error(error); alert("Çapraz analiz sırasında bir hata oluştu."); } finally { setIsChecking(false); }
  };

  const groupedReports = useMemo(() => {
      const term = searchTerm.toLowerCase();
      const filtered = reports.filter(r => r.shiftName.toLowerCase().includes(term) || r.aiSummary.toLowerCase().includes(term) || r.personnel.some(p => p.toLowerCase().includes(term)) || r.dateStr.includes(term));
      const groups: Record<string, ShiftReport[]> = {};
      filtered.forEach(r => { let dateKey = r.dateStr; if (!groups[dateKey]) groups[dateKey] = []; groups[dateKey].push(r); });
      const parseDateKey = (str: string): number => { const cleanStr = str.trim(); const dateMatch = cleanStr.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/); if (dateMatch) { const day = parseInt(dateMatch[1]); const month = parseInt(dateMatch[2]) - 1; const year = parseInt(dateMatch[3]); const d = new Date(year, month, day); if (!isNaN(d.getTime())) return d.getTime(); } let d = excelDateToJSDate(str); if (!isNaN(d.getTime())) return d.getTime(); return 0; };
      return Object.entries(groups).sort((a, b) => { let timeA = parseDateKey(a[0]); let timeB = parseDateKey(b[0]); if (timeA === 0 && a[1].length > 0) timeA = Math.max(...a[1].map(r => r.createdAt)); if (timeB === 0 && b[1].length > 0) timeB = Math.max(...b[1].map(r => r.createdAt)); return timeB - timeA; }).map(([date, items]) => ([date, items.sort((a,b) => b.createdAt - a.createdAt)] as [string, ShiftReport[]]));
  }, [reports, searchTerm]);

  const confirmDeleteDay = (e: React.MouseEvent, date: string) => { e.stopPropagation(); setDeleteConfirmation({ isOpen: true, type: 'day', date }); };
  const confirmDeleteSingle = (e: React.MouseEvent, id: string) => { e.stopPropagation(); setDeleteConfirmation({ isOpen: true, type: 'single', id }); };
  const selectReportsByRange = (range: 'today' | 'week' | 'all') => { const now = new Date(); now.setHours(0,0,0,0); const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7); const toSelect = reports.filter(r => { const tryDate = excelDateToJSDate(r.dateStr); if (isNaN(tryDate.getTime())) return false; if (range === 'today') { return tryDate.toDateString() === now.toDateString(); } if (range === 'week') return tryDate >= weekAgo; return true; }).map(r => r.id); setSelectedReportIds(new Set(toSelect)); };
  const clearSelection = () => { setSelectedReportIds(new Set()); };
  const toggleReportSelection = (id: string) => { setSelectedReportIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };
  const executeDelete = () => { if (!deleteConfirmation) return; if (deleteConfirmation.type === 'single' && deleteConfirmation.id) { onDelete(deleteConfirmation.id); if (selectedReport?.id === deleteConfirmation.id) setSelectedReport(null); } else if (deleteConfirmation.type === 'day' && deleteConfirmation.date) { reports.filter(r => r.dateStr === deleteConfirmation.date).forEach(r => onDelete(r.id)); if (selectedReport?.dateStr === deleteConfirmation.date) setSelectedReport(null); } setDeleteConfirmation(null); };
  const handleProcessText = async () => { if (!rawText.trim()) return; setIsProcessing(true); try { const ai = new GoogleGenAI({ apiKey: process.env.API_KEY }); const prompt = `Aşağıdaki metni analiz et ve JSON formatında çıktı ver. ÖNEMLİ: "dateStr" alanı KESİNLİKLE "YYYY-MM-DD" formatında olmalı. JSON Alanları: - dateStr (String, YYYY-MM-DD) - shiftName (String) - personnel (Array of Strings) - completedJobs (Array of Strings) - issues (Array of Strings) - pending (Array of Strings) - aiSummary (String) Metin: "${rawText}"`; const response = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: prompt, config: { responseMimeType: "application/json" } }); const cleanedText = response.text?.replace(/```json/g, '').replace(/```/g, '').trim() || '{}'; const result = JSON.parse(cleanedText); const newReport: Omit<ShiftReport, 'id' | 'createdAt'> = { rawText, dateStr: result.dateStr || new Date().toISOString().split('T')[0], shiftName: result.shiftName || 'Belirsiz Vardiya', personnel: result.personnel || [], completedJobs: result.completedJobs || [], issues: result.issues || [], pending: result.pending || [], aiSummary: result.aiSummary || 'Özet yok.', createdBy: currentUserEmail }; await onAdd(newReport); setRawText(''); setInputMode(false); } catch (error) { console.error(error); alert("Metin işlenirken bir hata oluştu."); } finally { setIsProcessing(false); } };
  const handleGenerateSummary = async () => { if (selectedReportIds.size === 0) return; setIsSummarizing(true); setSummaryData(null); try { const ai = new GoogleGenAI({ apiKey: process.env.API_KEY }); const dataForAi = reports.filter(r => selectedReportIds.has(r.id)).map(r => ({ date: r.dateStr, shift: r.shiftName, completed: r.completedJobs, issues: r.issues, pending: r.pending, summary: r.aiSummary })); const prompt = `Sen kıdemli bir fabrika müdürüsün. Aşağıdaki vardiya raporlarını analiz et ve üst yönetime sunulacak bir bülten hazırla. Yanıtın SADECE aşağıda belirtilen şemaya uygun PURE JSON olmalıdır. Markdown blokları kullanma. { "title": "Bülten Başlığı", "dateRangeLabel": "Örn: 12-18 Ocak 2025 Analizi", "executiveSummary": "Yönetici özeti", "keyMetrics": [{"label": "Toplam İş", "value": "24", "color": "blue"}], "shiftsTimeline": [{"date": "14.01", "shiftName": "Gece", "score": 85, "mainEvent": "Olay özeti", "status": "Good"}], "topFailures": ["Arıza 1"], "strategicRecommendations": ["Öneri 1"], "weeklyFocus": "Odak" } VERİLER: ${JSON.stringify(dataForAi)}`; const response = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: prompt, config: { responseMimeType: "application/json" } }); const cleanedResponse = response.text?.replace(/```json/g, '').replace(/```/g, '').trim() || '{}'; const parsedData = JSON.parse(cleanedResponse); if (parsedData && parsedData.title) { setSummaryData(parsedData); } else { throw new Error("Geçersiz veri yapısı"); } } catch (e) { console.error("AI Bülten Hatası:", e); alert("Bülten oluşturulurken bir hata oluştu."); } finally { setIsSummarizing(false); } };

  const showList = !selectedReport && !inputMode;
  const showDetail = selectedReport || inputMode;

  return (
    <div className="p-4 md:p-8 flex flex-col h-[calc(100vh-80px)] space-y-6 animate-in w-full max-w-[1920px] mx-auto overflow-hidden">
      
      {/* Top Bar */}
      <div className={`${showDetail ? 'hidden lg:flex' : 'flex'} flex-col md:flex-row justify-between gap-6 md:items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm shrink-0`}>
        <div className="flex items-center gap-5">
            <div className="p-3 bg-brand-950 rounded-2xl text-white shadow-xl shadow-brand-100">
                <History className="w-6 h-6" />
            </div>
            <div>
                <h2 className="text-xl font-black text-slate-900 leading-tight uppercase tracking-tight">Rapor Arşivi</h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Dijital Vardiya Günlüğü</p>
            </div>
        </div>
        <div className="flex flex-wrap gap-3">
            <button onClick={handlePrintList} disabled={isPrintingList} className="px-4 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all flex items-center gap-2 text-[10px] uppercase tracking-widest disabled:opacity-50 shadow-sm"><Printer className="w-4 h-4" /> Tüm Arşivi Raporla</button>
            <button onClick={() => { setShowSummaryModal(true); setSummaryData(null); }} className="px-6 py-3 bg-gradient-to-br from-indigo-600 to-brand-600 text-white font-black rounded-xl hover:shadow-2xl hover:shadow-brand-200 transition-all flex items-center gap-2 text-[10px] uppercase tracking-widest active:scale-95"><Sparkles className="w-4 h-4" /> AI Bülten / Toplu İşlem</button>
            <button onClick={() => setInputMode(true)} className="px-6 py-3 bg-brand-950 text-white font-black rounded-xl hover:bg-slate-800 transition-all flex items-center gap-2 text-[10px] uppercase tracking-widest active:scale-95 shadow-xl shadow-brand-100"><MessageSquarePlus className="w-4 h-4" /> Yeni Rapor</button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 h-full min-h-0 overflow-hidden">
          
          {/* LEFT SIDE: LIST */}
          <div className={`w-full lg:w-1/3 xl:w-1/4 bg-white rounded-3xl border border-slate-200 flex-col overflow-hidden shadow-sm flex ${showList ? 'flex' : 'hidden lg:flex'}`}>
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 space-y-4">
                  <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">KRONOLOJİK ARŞİV</span>
                      <div className="bg-brand-100 text-brand-700 px-2 py-0.5 rounded-lg text-[9px] font-black flex items-center gap-1"><History className="w-3 h-3" /> {reports.length}</div>
                  </div>
                  <div className="relative group">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-brand-600 transition-colors" />
                      <input type="text" placeholder="Rapor veya personel ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all placeholder:text-slate-300 shadow-inner" />
                  </div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scroll p-6 space-y-10 bg-white">
                  {groupedReports.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-center opacity-30 grayscale">
                          <CalendarRange className="w-16 h-16 mb-4 text-slate-300" />
                          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Rapor Bulunamadı</p>
                      </div>
                  ) : (
                      groupedReports.map(([date, items]) => { 
                          const dateObj = excelDateToJSDate(date); 
                          const isInvalidDate = isNaN(dateObj.getTime()); 
                          const today = new Date(); 
                          const isToday = !isInvalidDate && dateObj.toDateString() === today.toDateString(); 
                          let formattedDate = date; 
                          if (!isInvalidDate) { 
                              const isCurrentYear = dateObj.getFullYear() === today.getFullYear(); 
                              formattedDate = dateObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'short', year: isCurrentYear ? undefined : 'numeric' }).toUpperCase(); 
                          } 
                          return (
                              <div key={date} className="relative pl-6">
                                  <div className="absolute left-[7px] top-4 bottom-[-40px] w-0.5 bg-slate-100 last:hidden"></div>
                                  <div className={`absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-sm z-10 ${isToday ? 'bg-brand-600' : 'bg-slate-300'}`}></div>
                                  <div className="flex items-center justify-between mb-4 sticky top-0 bg-white/95 backdrop-blur-sm z-20 py-1">
                                      <div className="flex items-center gap-2">
                                          <span className={`text-[11px] font-black uppercase tracking-wider ${isToday ? 'text-brand-600' : 'text-slate-500'}`}>{isToday ? 'BUGÜN' : formattedDate}</span>
                                          {items.length > 1 && (<span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-bold">{items.length}</span>)}
                                      </div>
                                      <div className="flex items-center gap-1">
                                          <button 
                                              onClick={(e) => handlePrintDay(e, items, date)} 
                                              disabled={printingDay === date}
                                              className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                                              title="Bu günü raporla"
                                          >
                                              {printingDay === date ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                                          </button>
                                          <button onClick={(e) => confirmDeleteDay(e, date)} className="p-1.5 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                      </div>
                                  </div>
                                  <div className="space-y-4">
                                      {items.map(r => (
                                          <div key={r.id} onClick={() => setSelectedReport(r)} className={`p-4 rounded-2xl border transition-all cursor-pointer relative group animate-in slide-in-from-left-2 ${selectedReport?.id === r.id ? 'bg-brand-50/50 border-brand-500 shadow-xl shadow-brand-100/50 scale-[1.03] z-10' : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 shadow-sm'}`}>
                                              <div className="flex justify-between items-start mb-2">
                                                  <div className="flex flex-col">
                                                      <span className={`text-[9px] font-black uppercase tracking-[0.1em] ${selectedReport?.id === r.id ? 'text-brand-700' : 'text-slate-400'}`}>{r.shiftName}</span>
                                                      <div className="flex items-center gap-1.5 mt-1 text-slate-400"><Clock className="w-3 h-3" /><span className="text-[10px] font-bold">{new Date(r.createdAt).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}</span></div>
                                                  </div>
                                                  <Users className={`w-4 h-4 ${selectedReport?.id === r.id ? 'text-brand-400' : 'text-slate-200'}`} />
                                              </div>
                                              <p className={`text-[11px] font-medium leading-relaxed line-clamp-2 ${selectedReport?.id === r.id ? 'text-brand-900' : 'text-slate-500'}`}>{r.aiSummary}</p>
                                              <button onClick={(e) => confirmDeleteSingle(e, r.id)} className="absolute -top-1.5 -right-1.5 p-2 bg-white text-slate-300 hover:text-rose-500 hover:shadow-lg rounded-xl border border-slate-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all z-20"><Trash2 className="w-3 h-3" /></button>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          ); 
                      })
                  )}
              </div>
          </div>

          {/* RIGHT SIDE: CONTENT / INPUT */}
          <div className={`flex-1 bg-white rounded-[3rem] border border-slate-200 overflow-hidden flex flex-col relative shadow-2xl ${showDetail ? 'flex' : 'hidden lg:flex'}`}>
              {inputMode ? (
                  <div className="flex-1 p-6 md:p-16 flex flex-col items-center justify-center animate-in zoom-in-95">
                      <button onClick={() => setInputMode(false)} className="lg:hidden absolute top-6 left-6 p-3 bg-slate-50 rounded-full"><ArrowLeft className="w-6 h-6" /></button>
                      <div className="w-full max-w-2xl space-y-8">
                          <div className="text-center space-y-3">
                              <div className="w-20 h-20 bg-brand-50 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-brand-100 shadow-inner">
                                  <BrainCircuit className="w-10 h-10 text-brand-600" />
                              </div>
                              <h2 className="text-3xl font-black text-slate-900 tracking-tight">AI Rapor Girişi</h2>
                              <p className="text-sm text-slate-500 font-medium leading-relaxed">WhatsApp notlarınızı veya serbest metni buraya yapıştırın. Yapay zeka verileri otomatik ayrıştıracak.</p>
                          </div>
                          <div className="relative">
                              <textarea value={rawText} onChange={(e) => setRawText(e.target.value)} placeholder="Örn: Gece vardiyası notları. 3 numaralı pompa tamir edildi. Konveyör bandında yırtık var, parça bekleniyor..." className="w-full h-64 p-8 rounded-[2.5rem] border-2 border-slate-100 bg-slate-50 focus:bg-white focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 outline-none resize-none text-base font-medium leading-relaxed transition-all shadow-inner" />
                          </div>
                          <div className="flex gap-4">
                              <button onClick={() => setInputMode(false)} className="flex-1 py-4 bg-white border-2 border-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-50 uppercase tracking-widest text-xs">Vazgeç</button>
                              <button onClick={handleProcessText} disabled={isProcessing || !rawText.trim()} className="flex-[2] py-4 bg-brand-950 text-white font-black rounded-2xl hover:bg-brand-900 shadow-2xl shadow-brand-200 transition-all flex items-center justify-center gap-3 disabled:opacity-50 uppercase tracking-widest text-xs">
                                  {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-5 h-5" /> Raporu Düzenle ve Kaydet</>}
                              </button>
                          </div>
                      </div>
                  </div>
              ) : selectedReport ? (
                  <div className="flex-1 flex flex-col h-full overflow-y-auto custom-scroll relative bg-white">
                      <div className="lg:hidden absolute top-6 left-6 z-20">
                          <button onClick={() => setSelectedReport(null)} className="p-3 bg-white/90 backdrop-blur rounded-full shadow-lg border border-slate-200"><ArrowLeft className="w-6 h-6" /></button>
                      </div>
                      
                      {/* Report Header */}
                      <div className="p-8 md:p-12 border-b border-slate-100 bg-slate-50/50">
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-8 mb-10">
                              <div className="space-y-4">
                                  <div className="flex items-center gap-3">
                                      <span className="px-4 py-1.5 bg-brand-950 text-white rounded-xl text-xs font-black uppercase tracking-[0.2em] shadow-lg shadow-brand-100">{selectedReport.shiftName}</span>
                                      <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest border-l border-slate-200 pl-3">
                                          <CalendarDays className="w-4 h-4" /> {excelDateToJSDate(selectedReport.dateStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                                      </div>
                                  </div>
                                  <h1 className="text-2xl md:text-3xl font-black text-slate-900 leading-[1.2] tracking-tight italic">
                                      "{selectedReport.aiSummary}"
                                  </h1>
                              </div>
                              <div className="shrink-0 pt-2 flex flex-col items-end gap-3">
                                  <div>
                                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] block mb-3 text-right">RAPORU GİREN</span>
                                      <div className="flex items-center gap-3 px-5 py-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-700 font-black border border-brand-100">{selectedReport.createdBy.substring(0,2).toUpperCase()}</div>
                                          <span className="text-sm font-black text-slate-800">{selectedReport.createdBy.split('@')[0]}</span>
                                      </div>
                                  </div>
                                  <div className="flex gap-2">
                                      <button onClick={handlePrint} disabled={isPrinting} className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-colors flex items-center gap-2 border border-indigo-100">{isPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />} PDF İndir</button>
                                      <button onClick={(e) => confirmDeleteSingle(e, selectedReport.id)} className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-colors flex items-center gap-2 border border-rose-100"><Trash2 className="w-4 h-4" /> Sil</button>
                                  </div>
                              </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                              {selectedReport.personnel.map((p, i) => (<div key={i} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-100 rounded-xl text-xs font-bold text-slate-600 shadow-sm"><Users className="w-3.5 h-3.5 text-brand-600" /> {p}</div>))}
                          </div>
                      </div>

                      {/* Report Content */}
                      <div className="p-8 md:p-12 space-y-12">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {[{ title: 'TAMAMLANANLAR', data: selectedReport.completedJobs, icon: CheckCircle2, color: 'emerald' }, { title: 'ARIZALAR / DURUŞLAR', data: selectedReport.issues, icon: AlertTriangle, color: 'rose' }, { title: 'SONRAKİ VARDİYA', data: selectedReport.pending, icon: Clock, color: 'amber' }].map((col, i) => (
                                <div key={i} className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col h-full ring-1 ring-slate-50">
                                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-50">
                                        <div className={`p-2 bg-${col.color}-50 rounded-xl text-${col.color}-600 border border-${col.color}-100`}>
                                            <col.icon className="w-5 h-5" />
                                        </div>
                                        <h3 className="font-black text-xs text-slate-800 uppercase tracking-widest">{col.title}</h3>
                                    </div>
                                    <div className="space-y-4 flex-1">
                                        {col.data.length > 0 ? col.data.map((item, idx) => (
                                            <div key={idx} className="flex gap-4 text-sm font-bold text-slate-600 leading-relaxed">
                                                <div className={`mt-1.5 w-1.5 h-1.5 rounded-full bg-${col.color}-400 shrink-0`}></div>
                                                <span>{item}</span>
                                            </div>
                                        )) : <p className="text-xs text-slate-300 font-bold italic">Veri bulunmuyor</p>}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Cross Check Section */}
                        <div className="bg-white border border-slate-200 rounded-[3rem] p-8 md:p-12 relative overflow-hidden shadow-lg">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-8 relative z-10">
                                <div>
                                    <div className="flex items-center gap-4 mb-3">
                                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shadow-sm border border-indigo-100">
                                            <SearchCheck className="w-6 h-6" />
                                        </div>
                                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Sistem Çapraz Kontrolü</h3>
                                    </div>
                                    <p className="text-slate-500 font-medium max-w-xl text-sm leading-relaxed">
                                        Raporlanan işleri sistemdeki aktif iş emirleri ile karşılaştırarak veri tutarlılığını analiz eder.
                                    </p>
                                </div>
                                <button 
                                    onClick={handleCrossCheckAnalysis} 
                                    disabled={isChecking} 
                                    className="px-8 py-4 bg-slate-900 text-white font-black rounded-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3 text-xs uppercase tracking-widest shadow-xl disabled:opacity-50"
                                >
                                    {isChecking ? <Loader2 className="w-5 h-5 animate-spin" /> : <BrainCircuit className="w-5 h-5" />}
                                    {isChecking ? 'İnceleniyor...' : 'Analizi Başlat'}
                                </button>
                            </div>

                            {crossCheckResult && (
                                <div className="mt-8 pt-8 border-t border-slate-100 animate-in fade-in">
                                    <div className="flex items-center gap-6 mb-8">
                                        <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-1000 ${crossCheckResult.score > 80 ? 'bg-emerald-500' : crossCheckResult.score > 50 ? 'bg-amber-500' : 'bg-rose-500'}`} 
                                                style={{ width: `${crossCheckResult.score}%` }}
                                            ></div>
                                        </div>
                                        <div className="text-4xl font-black tracking-tighter text-slate-900">
                                            %{crossCheckResult.score} 
                                            <span className="text-[10px] uppercase text-slate-400 font-bold ml-1 align-top">Doğruluk</span>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="p-6 bg-rose-50 rounded-[2rem] border border-rose-100 space-y-3">
                                            <div className="flex items-center gap-2 text-rose-700 font-black text-[10px] uppercase tracking-widest mb-1">
                                                <FileWarning className="w-4 h-4" /> Sistemde Yok (Kayıp)
                                            </div>
                                            {crossCheckResult.missingInDb.length > 0 ? (
                                                <ul className="space-y-2">{crossCheckResult.missingInDb.map((m, idx) => <li key={idx} className="text-[11px] font-bold text-rose-800 leading-snug">• {m}</li>)}</ul>
                                            ) : <span className="text-[10px] text-rose-400 italic">Sorun tespit edilmedi.</span>}
                                        </div>

                                        <div className="p-6 bg-amber-50 rounded-[2rem] border border-amber-100 space-y-3">
                                            <div className="flex items-center gap-2 text-amber-700 font-black text-[10px] uppercase tracking-widest mb-1">
                                                <AlertCircle className="w-4 h-4" /> Raporda Eksik
                                            </div>
                                            {crossCheckResult.missingInReport.length > 0 ? (
                                                <ul className="space-y-2">{crossCheckResult.missingInReport.map((m, idx) => <li key={idx} className="text-[11px] font-bold text-amber-800 leading-snug">• {m}</li>)}</ul>
                                            ) : <span className="text-[10px] text-amber-400 italic">Sorun tespit edilmedi.</span>}
                                        </div>

                                        <div className="p-6 bg-emerald-50 rounded-[2rem] border border-emerald-100 space-y-3">
                                            <div className="flex items-center gap-2 text-emerald-700 font-black text-[10px] uppercase tracking-widest mb-1">
                                                <CheckCircle2 className="w-4 h-4" /> Doğrulananlar
                                            </div>
                                            {crossCheckResult.perfectMatches.length > 0 ? (
                                                <ul className="space-y-2">{crossCheckResult.perfectMatches.map((m, idx) => <li key={idx} className="text-[11px] font-bold text-emerald-800 leading-snug">• {m}</li>)}</ul>
                                            ) : <span className="text-[10px] text-emerald-600 italic">Eşleşme bulunamadı.</span>}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                      </div>
                  </div>
              ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                      <div className="w-40 h-40 bg-slate-50 rounded-full flex items-center justify-center mb-8 shadow-inner border border-slate-100">
                          <ClipboardList className="w-16 h-16 text-slate-200" />
                      </div>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2 uppercase">Arşiv Seçimi Bekleniyor</h3>
                      <p className="text-sm font-medium text-slate-400 max-w-xs mx-auto">Detayları görmek için sol taraftaki zaman çizelgesinden bir rapor seçin.</p>
                  </div>
              )}
          </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && deleteConfirmation.isOpen && (
          <div 
            className="fixed inset-0 z-[600] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setDeleteConfirmation(null)}
          >
              <div 
                className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20 p-10 text-center"
                onClick={e => e.stopPropagation()}
              >
                  <div className="w-20 h-20 bg-rose-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-rose-100">
                      <Trash2 className="w-10 h-10 text-rose-500" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tighter uppercase">Silme Onayı</h3>
                  <p className="text-sm text-slate-500 leading-relaxed mb-10 font-bold opacity-60">
                      {deleteConfirmation.type === 'day' ? 'Bu güne ait tüm raporlar silinecektir.' : 'Seçili rapor kalıcı olarak silinecektir.'} Bu işlem geri alınamaz.
                  </p>
                  <div className="flex gap-4">
                      <button onClick={() => setDeleteConfirmation(null)} className="flex-1 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 font-black text-xs uppercase tracking-widest hover:bg-white transition-all">İptal</button>
                      <button onClick={executeDelete} className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-700 shadow-xl shadow-rose-200 transition-all">EVET, SİL</button>
                  </div>
              </div>
          </div>
      )}

      {/* Summary Bulletin Modal */}
      {showSummaryModal && (
          <div 
            className="fixed inset-0 z-[500] bg-slate-950/40 backdrop-blur-xl flex items-center justify-center p-0 md:p-6 animate-in fade-in"
            onClick={() => setShowSummaryModal(false)}
          >
              <div 
                className={`bg-white w-full max-w-6xl md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col h-full md:max-h-[90vh] border border-white/20`}
                onClick={e => e.stopPropagation()}
              >
                  <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                      <div className="flex items-center gap-5">
                          <div className="p-4 bg-brand-950 text-white rounded-2xl shadow-xl shadow-brand-100">
                              <Sparkles className="w-7 h-7" />
                          </div>
                          <div>
                              <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Yönetici AI Bülteni</h3>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1">{summaryData ? 'ANALİZ TAMAMLANDI' : ' ANALİZ EDİLECEK KAYITLARI SEÇİN'}</p>
                          </div>
                      </div>
                      <button onClick={() => setShowSummaryModal(false)} className="p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full text-slate-400 transition-all shadow-sm"><X className="w-6 h-6" /></button>
                  </div>
                  
                  <div className="flex-1 overflow-hidden flex flex-col bg-slate-50/30">
                      {!summaryData ? (
                          <div className="flex flex-col h-full">
                              <div className="px-10 py-5 bg-white border-b border-slate-100 flex items-center gap-3 overflow-x-auto no-scrollbar shrink-0">
                                  <button onClick={() => selectReportsByRange('today')} className="px-4 py-2 rounded-xl border border-slate-200 text-[10px] font-black text-slate-600 hover:bg-slate-50 uppercase tracking-widest">Bugün</button>
                                  <button onClick={() => selectReportsByRange('week')} className="px-4 py-2 rounded-xl border border-slate-200 text-[10px] font-black text-slate-600 hover:bg-slate-50 uppercase tracking-widest">Son 7 Gün</button>
                                  <button onClick={() => selectReportsByRange('all')} className="px-4 py-2 rounded-xl border border-slate-200 text-[10px] font-black text-slate-600 hover:bg-slate-50 uppercase tracking-widest">Tümü</button>
                                  <div className="ml-auto flex items-center gap-3">
                                      <button onClick={handleBulkExport} disabled={isBulkPrinting || selectedReportIds.size === 0} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors flex items-center gap-2 border border-slate-200 disabled:opacity-50">{isBulkPrinting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />} Seçilenleri PDF Yap</button>
                                      <div className="w-px h-6 bg-slate-200"></div>
                                      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></div><span className="text-xs font-black text-brand-700">{selectedReportIds.size} Kayıt Seçili</span></div>
                                  </div>
                              </div>
                              <div className="flex-1 overflow-y-auto custom-scroll p-10 space-y-4">
                                  {groupedReports.length === 0 ? (
                                      <div className="text-center py-20 text-slate-400 font-bold uppercase tracking-widest">Rapor bulunmuyor</div>
                                  ) : (
                                      groupedReports.map(([date, items]) => (
                                          <div key={date} className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
                                              <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">{date}</div>
                                              <div className="divide-y divide-slate-50">
                                                  {items.map(r => (
                                                      <div key={r.id} onClick={() => toggleReportSelection(r.id)} className={`p-6 flex items-center gap-6 cursor-pointer transition-all ${selectedReportIds.has(r.id) ? 'bg-brand-50/40' : 'hover:bg-slate-50'}`}>
                                                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all ${selectedReportIds.has(r.id) ? 'bg-brand-600 border-brand-600 text-white shadow-lg' : 'bg-white border-slate-200 text-transparent'}`}><CheckSquare className="w-4 h-4" /></div>
                                                          <div className="flex-1">
                                                              <div className="flex justify-between items-center mb-1">
                                                                  <span className="text-sm font-black text-slate-800">{r.shiftName}</span>
                                                                  <span className="text-[10px] font-black px-2 py-0.5 bg-white border border-slate-200 rounded-lg text-slate-400 uppercase tracking-wider">{r.createdBy.split('@')[0]}</span>
                                                              </div>
                                                              <p className="text-xs font-medium text-slate-500 line-clamp-1">{r.aiSummary}</p>
                                                          </div>
                                                      </div>
                                                  ))}
                                              </div>
                                          </div>
                                      ))
                                  )}
                              </div>
                              <div className="p-10 bg-white border-t border-slate-100 flex justify-between items-center shrink-0">
                                  <button onClick={clearSelection} className="text-xs font-black text-slate-300 hover:text-rose-500 uppercase tracking-[0.2em]">Seçimleri Temizle</button>
                                  <button onClick={handleGenerateSummary} disabled={isSummarizing || selectedReportIds.size === 0} className="px-12 py-5 bg-brand-950 text-white font-black rounded-2xl hover:bg-brand-900 shadow-2xl transition-all flex items-center gap-3 uppercase tracking-widest text-xs disabled:opacity-30">
                                      {isSummarizing ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-5 h-5" /> Analizi Gerçekleştir</>}
                                  </button>
                              </div>
                          </div>
                      ) : (
                          <div className="flex flex-col h-full bg-white overflow-y-auto custom-scroll p-8 md:p-16 space-y-12">
                              <div className="relative p-10 md:p-16 bg-slate-900 rounded-[4rem] text-white shadow-2xl overflow-hidden">
                                  <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-600/20 rounded-full blur-[100px] -mr-48 -mt-48"></div>
                                  <div className="relative z-10 space-y-8">
                                      <span className="inline-block px-5 py-2 rounded-2xl bg-white/10 text-brand-400 text-xs font-black uppercase tracking-[0.3em] backdrop-blur-sm border border-white/5">{summaryData.dateRangeLabel}</span>
                                      <h2 className="text-4xl md:text-6xl font-black leading-[1.1] tracking-tighter">{summaryData.title}</h2>
                                      <p className="text-lg md:text-xl text-slate-300 leading-relaxed max-w-4xl font-medium">{summaryData.executiveSummary}</p>
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
                                          {summaryData.keyMetrics?.map((m, i) => (
                                              <div key={i} className="p-8 bg-white/5 rounded-[2.5rem] border border-white/10 backdrop-blur-md">
                                                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 block mb-3">{m.label}</span>
                                                  <span className="text-4xl font-black tracking-tighter">{m.value}</span>
                                              </div>
                                          ))}
                                      </div>
                                  </div>
                              </div>
                              
                              {summaryData.shiftsTimeline && summaryData.shiftsTimeline.length > 0 && (
                                  <div className="space-y-8">
                                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] px-2">OPERASYONEL ZAMAN ÇİZELGESİ</h4>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                          {summaryData.shiftsTimeline.map((s, i) => (
                                              <div key={i} className="p-6 bg-white border border-slate-100 rounded-3xl shadow-sm">
                                                  <div className="flex justify-between items-center mb-4">
                                                      <span className="text-[10px] font-black text-slate-400">{s.date}</span>
                                                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${s.status === 'Perfect' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{s.status}</span>
                                                  </div>
                                                  <div className="text-lg font-black text-slate-800 mb-1">%{s.score}</div>
                                                  <p className="text-xs font-medium text-slate-500 line-clamp-2">{s.mainEvent}</p>
                                              </div>
                                          ))}
                                      </div>
                                  </div>
                              )}

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                  <div className="p-10 bg-slate-50 rounded-[3rem] border border-slate-100">
                                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-6">TEKRARLAYAN ARIZALAR</h4>
                                      <div className="space-y-4">
                                          {summaryData.topFailures?.map((f, i) => (
                                              <div key={i} className="flex gap-4 items-center">
                                                  <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                                                  <span className="text-sm font-bold text-slate-700">{f}</span>
                                              </div>
                                          ))}
                                      </div>
                                  </div>
                                  <div className="p-10 bg-brand-50/30 rounded-[3rem] border border-brand-100">
                                      <h4 className="text-[10px] font-black text-brand-400 uppercase tracking-[0.4em] mb-6">STRATEJİK ÖNERİLER</h4>
                                      <div className="space-y-4">
                                          {summaryData.strategicRecommendations?.map((r, i) => (
                                              <div key={i} className="flex gap-4 items-center">
                                                  <div className="w-2 h-2 rounded-full bg-brand-500"></div>
                                                  <span className="text-sm font-bold text-brand-900">{r}</span>
                                              </div>
                                          ))}
                                      </div>
                                  </div>
                              </div>

                              <div className="p-10 bg-slate-900 rounded-[3rem] border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-10">
                                  <div className="flex items-center gap-8">
                                      <div className="w-20 h-20 bg-brand-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl">
                                          <Target className="w-10 h-10" />
                                      </div>
                                      <div>
                                          <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] mb-2">HAFTALIK ODAK NOKTASI</h4>
                                          <p className="text-xl md:text-2xl font-black text-white max-w-2xl leading-snug">{summaryData.weeklyFocus}</p>
                                      </div>
                                  </div>
                                  <button onClick={() => setSummaryData(null)} className="px-10 py-5 bg-white text-slate-900 font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-slate-100 transition-all">Yeni Analiz</button>
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
