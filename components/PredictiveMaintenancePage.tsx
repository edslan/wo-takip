
import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { WorkOrder, ShiftReport, AssetItem, PredictiveInsight, ToDoItem, PredictiveAnalysisSession } from '../types';
import { BrainCircuit, Zap, AlertTriangle, CalendarClock, ArrowRight, Loader2, CheckCircle2, History, AlertCircle, RefreshCw, FileText, TrendingUp, Save, CalendarDays, Filter, Printer } from 'lucide-react';
import { excelDateToJSDate } from '../utils';
import { db } from '../firebase';
import { collection, addDoc, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { generatePredictiveReportPDF } from '../services/pdfService';

interface PredictiveMaintenancePageProps {
  workOrders: WorkOrder[];
  shiftReports: ShiftReport[];
  assets: AssetItem[];
  currentUserEmail: string;
  onAddToTodo: (item: Omit<ToDoItem, 'id' | 'createdAt' | 'status' | 'notes' | 'createdBy'>) => void;
}

const PredictiveMaintenancePage: React.FC<PredictiveMaintenancePageProps> = ({ workOrders, shiftReports, assets, currentUserEmail, onAddToTodo }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [insights, setInsights] = useState<PredictiveInsight[]>([]);
  const [lastAnalysisDate, setLastAnalysisDate] = useState<Date | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  const [analysisRange, setAnalysisRange] = useState<7 | 30 | 90>(30);

  useEffect(() => {
      const fetchLatestAnalysis = async () => {
          try {
              const q = query(collection(db, 'predictive_analysis'), orderBy('date', 'desc'), limit(1));
              const querySnapshot = await getDocs(q);
              if (!querySnapshot.empty) {
                  const data = querySnapshot.docs[0].data() as PredictiveAnalysisSession;
                  setInsights(data.insights);
                  setLastAnalysisDate(new Date(data.date));
              }
          } catch (error) { console.error("Error fetching history:", error); } finally { setIsLoadingHistory(false); }
      };
      fetchLatestAnalysis();
  }, []);

  const runAnalysis = async () => {
    setIsAnalyzing(true);
    setInsights([]);
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - analysisRange);

        const recentReports = shiftReports.filter(r => { const d = excelDateToJSDate(r.dateStr); return !isNaN(d.getTime()) && d >= startDate; }).map(r => ({ date: r.dateStr, shift: r.shiftName, reported_issues: r.issues.join(', '), incomplete_tasks: r.pending.join(', '), operator_notes: r.rawText.substring(0, 1000) }));
        const assetFailures: Record<string, { count: number, descriptions: string[] }> = {};
        workOrders.forEach(wo => {
            const name = wo['Asset Name']; if (!name) return;
            const woDate = excelDateToJSDate(wo['Work order start date/time']);
            if (woDate >= startDate) {
                if (!assetFailures[name]) assetFailures[name] = { count: 0, descriptions: [] };
                assetFailures[name].count++;
                if (assetFailures[name].descriptions.length < 5) { assetFailures[name].descriptions.push(wo['Work order name']); }
            }
        });

        const prompt = `Sen kıdemli bir **Güvenilirlik Mühendisisin (Reliability Engineer)**. Görevin: Verilen SON ${analysisRange} GÜNLÜK vardiya raporlarını ve geçmiş iş emirlerini analiz ederek, sahadaki teknisyenlere verilecek **PROAKTİF (Önleyici)** bakım iş emirlerini oluşturmak. MÜHENDİSLİK YAKLAŞIMIN (P-F Eğrisi Mantığı): Sadece "kırılan" makineleri değil, kırılmaya giden "belirtileri" bulmalısın. GİRDİ VERİLERİ (Kapsam: Son ${analysisRange} Gün): --- VARDİYA RAPORLARI (İnsan Gözlemi) --- ${JSON.stringify(recentReports)} --- İŞ EMRİ ÖZETİ (Sistem Kaydı) --- ${JSON.stringify(assetFailures)} ÇIKTI FORMATI (SADECE VE SADECE SAF JSON ARRAY): [ { "assetName": "Makine Adı", "riskLevel": "High" | "Medium" | "Low", "probability": 0-100, "reason": "Teknik Gerekçe", "suggestedAction": "Teknik Talimat", "suggestedDate": "YYYY-MM-DD", "source": "ShiftReport" | "WorkOrderHistory" | "Hybrid" } ]`;
        const response = await ai.models.generateContent({ model: "gemini-3-pro-preview", contents: prompt, config: { responseMimeType: "application/json", temperature: 0.3 } });
        const text = response.text || '[]';
        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(cleanJson);
        const newSession: Omit<PredictiveAnalysisSession, 'id'> = { date: Date.now(), insights: result, createdBy: currentUserEmail };
        await addDoc(collection(db, 'predictive_analysis'), newSession);
        setInsights(result); setLastAnalysisDate(new Date());
    } catch (error) { console.error("Analysis failed", error); alert("Analiz sırasında bir hata oluştu."); } finally { setIsAnalyzing(false); }
  };

  const handleCreateTodo = (insight: PredictiveInsight) => {
      onAddToTodo({ title: `PROAKTİF: ${insight.assetName} Kontrolü`, priority: insight.riskLevel === 'High' ? 'Yüksek' : 'Orta', comments: `🔍 MÜHENDİS ANALİZİ:\n${insight.reason}\n\n🛠️ YAPILACAK İŞLEM:\n${insight.suggestedAction}\n\n📊 Tespit Kaynağı: ${insight.source}`, dueDate: insight.suggestedDate });
  };

  const handlePrint = async () => {
      if(insights.length === 0) return;
      setIsGeneratingPdf(true);
      try { await generatePredictiveReportPDF(insights); } catch(e) { alert("PDF üretilemedi."); } finally { setIsGeneratingPdf(false); }
  };

  if (isLoadingHistory) { return (<div className="flex flex-col items-center justify-center h-full min-h-[400px]"><Loader2 className="w-8 h-8 text-violet-600 animate-spin mb-4" /><p className="text-xs font-black text-slate-400 uppercase tracking-widest">Geçmiş Analizler Yükleniyor...</p></div>); }

  return (
    <div className="flex flex-col h-full animate-in w-full max-w-[1920px] mx-auto overflow-hidden bg-slate-50">
        <div className="bg-white px-6 md:px-10 py-6 border-b border-slate-200 flex flex-col xl:flex-row justify-between xl:items-center gap-6 shrink-0">
            <div className="flex items-center gap-5">
                <div className="p-4 bg-violet-600 rounded-2xl text-white shadow-xl shadow-violet-200 ring-4 ring-violet-50"><BrainCircuit className="w-8 h-8" /></div>
                <div><h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Proaktif Bakım Kahini</h2><p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Vardiya Analizi & Arıza Tahmini</p></div>
            </div>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
                <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 hidden md:inline-block">Analiz Kapsamı:</span>
                    {(['7', '30', '90'] as const).map(days => (<button key={days} onClick={() => setAnalysisRange(Number(days) as any)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${analysisRange === Number(days) ? 'bg-white text-violet-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>Son {days} Gün</button>))}
                </div>
                <div className="h-8 w-px bg-slate-200 hidden md:block"></div>
                <div className="flex items-center gap-4">
                    {lastAnalysisDate && (<div className="hidden md:flex flex-col items-end mr-2"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Son Analiz</span><div className="flex items-center gap-1.5"><History className="w-3 h-3 text-violet-500" /><span className="text-[10px] font-bold text-slate-700">{lastAnalysisDate.toLocaleString('tr-TR')}</span></div></div>)}
                    <button onClick={handlePrint} disabled={isGeneratingPdf || insights.length === 0} className="p-3 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-violet-600 hover:bg-violet-50 transition-all disabled:opacity-50"><Printer className="w-5 h-5" /></button>
                    <button onClick={runAnalysis} disabled={isAnalyzing} className="px-6 py-3 bg-slate-900 text-white font-black rounded-xl hover:bg-violet-600 hover:shadow-2xl hover:shadow-violet-200 transition-all flex items-center gap-3 text-xs uppercase tracking-widest disabled:opacity-50 active:scale-95 group">{isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 group-hover:text-yellow-300 transition-colors" />}{isAnalyzing ? 'Analiz Sürüyor' : 'Analizi Başlat'}</button>
                </div>
            </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scroll p-6 md:p-10">
            {insights.length === 0 && !isAnalyzing ? (<div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center space-y-8 opacity-60"><div className="relative"><div className="w-40 h-40 bg-white rounded-full flex items-center justify-center shadow-2xl border border-slate-100 z-10 relative"><TrendingUp className="w-16 h-16 text-slate-300" /></div><div className="absolute inset-0 bg-violet-100 rounded-full blur-3xl opacity-50 animate-pulse"></div></div><div className="max-w-md space-y-3"><h3 className="text-xl font-black text-slate-700 uppercase tracking-widest">Analiz Bekleniyor</h3><p className="text-sm font-medium text-slate-500 leading-relaxed">Yapay zeka, seçili tarih aralığındaki ({analysisRange} gün) vardiya notlarını, operatör gözlemlerini ve geçmiş arıza verilerini birleştirerek <strong>gizli arıza sinyallerini</strong> arar.</p></div></div>) : isAnalyzing ? (<div className="flex flex-col items-center justify-center h-full min-h-[400px] space-y-6"><div className="relative w-24 h-24"><div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div><div className="absolute inset-0 border-4 border-violet-600 rounded-full border-t-transparent animate-spin"></div><BrainCircuit className="absolute inset-0 m-auto w-8 h-8 text-violet-600 animate-pulse" /></div><p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] animate-pulse">Mühendis YZ verileri yorumluyor...</p></div>) : (
                <div className="space-y-8 animate-in slide-in-from-bottom-4">
                    <div className="flex items-center gap-3"><div className="bg-violet-100 p-2 rounded-lg text-violet-700"><FileText className="w-5 h-5" /></div><span className="text-sm font-black text-slate-700 uppercase tracking-wide">{insights.length} Potansiyel Risk Tespit Edildi</span></div>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {insights.map((insight, idx) => (
                            <div key={idx} className="bg-white p-0 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-100/50 flex flex-col overflow-hidden group hover:border-violet-300 transition-all duration-300">
                                <div className={`px-8 py-4 flex justify-between items-center ${insight.riskLevel === 'High' ? 'bg-rose-50 text-rose-700' : insight.riskLevel === 'Medium' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}><div className="flex items-center gap-2"><AlertTriangle className="w-5 h-5" /><span className="text-[10px] font-black uppercase tracking-widest">{insight.riskLevel} RİSK</span></div><span className="text-[10px] font-black opacity-80">% {insight.probability} İHTİMAL</span></div>
                                <div className="p-8 flex-1 flex flex-col gap-6">
                                    <div className="flex justify-between items-start"><div><h3 className="text-xl font-black text-slate-900 tracking-tight mb-1">{insight.assetName}</h3><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-100 px-2 py-1 rounded-md">Kaynak: {insight.source}</span></div><div className="text-right"><div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Önerilen Tarih</div><div className="flex items-center justify-end gap-1.5 text-sm font-black text-slate-800 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100"><CalendarClock className="w-4 h-4 text-violet-600" /> {insight.suggestedDate}</div></div></div>
                                    <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-100 relative"><div className="absolute top-5 left-5 w-1 h-8 bg-violet-500 rounded-full"></div><div className="pl-4"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">TESPİT NEDENİ (KÖK ANALİZ)</span><p className="text-sm font-medium text-slate-700 leading-relaxed italic">"{insight.reason}"</p></div></div>
                                    <div className="mt-auto pt-6 border-t border-slate-50"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-3">MÜHENDİS AKSİYON PLANI</span><div className="flex items-start gap-3"><CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" /><p className="text-sm font-bold text-slate-800 leading-relaxed whitespace-pre-wrap">{insight.suggestedAction}</p></div></div>
                                </div>
                                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end"><button onClick={() => handleCreateTodo(insight)} className="px-6 py-3 bg-white border-2 border-slate-200 text-slate-700 text-xs font-black rounded-xl uppercase tracking-widest hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm flex items-center gap-2">Görev Listesine Ekle <ArrowRight className="w-4 h-4" /></button></div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default PredictiveMaintenancePage;
