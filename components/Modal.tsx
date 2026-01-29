
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    FileCheck, X, Printer, Loader2, Sparkles, Package, 
    HelpCircle, Globe, Search, AlertCircle, BrainCircuit, 
    RefreshCw, CheckCircle2, Send, Bot, User as UserIcon, 
    Trash2, CheckSquare, Calendar, CalendarCheck, Clock,
    Activity, ChevronRight, Copy, Hash, Wrench, ShieldAlert,
    Lightbulb, Hammer, StickyNote, ListChecks, ShieldCheck, ScanSearch,
    Maximize2, Minimize2, History, ArrowRight, XCircle
} from 'lucide-react';
import { WorkOrder, AiAnalysisResult } from '../types';
import { formatFullDate, excelDateToJSDate } from '../utils';
import { generateSinglePDF } from '../services/pdfService';
import { GoogleGenAI } from "@google/genai";

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
    sources?: any[];
}

interface ModalProps {
  item: WorkOrder | null;
  allData: WorkOrder[]; // New prop to access full history
  onClose: () => void;
  onUpdateStatus?: (status: string, closeReason?: string) => void;
  onDelete?: (code: string) => void;
}

const Modal: React.FC<ModalProps> = ({ item, allData, onClose, onUpdateStatus, onDelete }) => {
  const [printing, setPrinting] = useState(false);
  
  // UI State
  const [isExpanded, setIsExpanded] = useState(false);

  // AI Chat State
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Tabs State
  const [activeTab, setActiveTab] = useState<'chat' | 'guide' | 'history'>('chat');
  
  // AI Guide State
  const [analysisResult, setAnalysisResult] = useState<AiAnalysisResult | null>(null);
  const [isAnalyzingGuide, setIsAnalyzingGuide] = useState(false);

  // Close Reason State
  const [showCloseReasonModal, setShowCloseReasonModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState('İş Tamamlandı');
  
  // Mobile Tab State
  const [mobileTab, setMobileTab] = useState<'details' | 'ai'>('details');

  // Asset History Logic
  const assetHistory = useMemo(() => {
      if (!item || !item['Asset Name'] || !allData) return [];
      
      return allData.filter(d => 
          d['Asset Name'] === item['Asset Name'] && 
          d['Work order code'] !== item['Work order code']
      ).sort((a, b) => {
          const dateA = excelDateToJSDate(a['Work order start date/time']).getTime() || 0;
          const dateB = excelDateToJSDate(b['Work order start date/time']).getTime() || 0;
          return dateB - dateA; // Newest first
      });
  }, [item, allData]);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'chat') {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, mobileTab, activeTab]);

  if (!item || !item['Work order code']) return null;

  const handleAiChat = async (customQuery?: string) => {
    const queryToUse = customQuery || aiQuery;
    if (!queryToUse.trim()) return;

    setChatMessages(prev => [...prev, { role: 'user', text: queryToUse }]);
    setAiQuery('');
    
    setIsAiLoading(true);

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const systemInstruction = `
            Sen 20 yıllık tecrübeye sahip Kıdemli Bakım ve Güvenilirlik Mühendisisin (Senior Reliability Engineer). 
            Adın "Mühendis YZ".
            
            Şu an aşağıdaki teknik iş emri üzerinde çalışan saha teknisyenine destek oluyorsun:
            
            --- İŞ EMRİ DETAYLARI ---
            KOD: ${item['Work order code']}
            BAŞLIK: ${item['Work order name']}
            VARLIK/EKİPMAN: ${item['Asset Name']}
            AKTİVİTE TİPİ: ${item['WO Activity type Activity type code']}
            İŞ NOTU: ${item['Comments: Name without formatting'] || 'Girilmemiş'}
            DURUM: ${item['Status code']}
            -------------------------

            GÖREVİN:
            1. Teknisyenin sorusuna doğrudan, teknik ve çözüm odaklı yanıt ver.
            2. Gereksiz nezaket cümlelerini atla. Direkt teknik konuya gir.
            3. Yanıtlarını okunabilirliği artırmak için mutlaka **MADDE İŞARETLERİ** veya **NUMARALI LİSTELER** kullanarak yapılandır.
            4. Eğer "Kök Neden" sorulursa, olası mekanik, elektriksel veya hidrolik sebepleri teknik terimlerle sırala.
            5. Eğer "Güvenlik" sorulursa, LOTO (Lock-out Tag-out) prosedürlerini ve KKD gereksinimlerini hatırlat.
        `;

        const historyContext = chatMessages.slice(-6).map(m => `${m.role === 'user' ? 'Teknisyen' : 'Mühendis YZ'}: ${m.text}`).join('\n');

        const response = await ai.models.generateContent({ 
          model: "gemini-3-flash", 
          contents: `${historyContext}\nTeknisyen: ${queryToUse}`,
          config: { 
              systemInstruction: systemInstruction,
              tools: [{ googleSearch: {} }] 
          }
        });

        const responseText = response.text || "Analiz tamamlanamadı.";
        const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

        setChatMessages(prev => [...prev, { role: 'model', text: responseText, sources }]);
    } catch (err) { 
        setChatMessages(prev => [...prev, { role: 'model', text: "* Analiz servisine erişilemedi.\n* Lütfen internet bağlantınızı kontrol edin." }]); 
    } finally { 
        setIsAiLoading(false); 
    }
  };

  const runStructuredAnalysis = async () => {
      setIsAnalyzingGuide(true);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const prompt = `
            Sen uzman bir Teknik Bakım Mühendisisin. Aşağıdaki arıza kaydını incele ve saha personeli için uygulanabilir, teknik bir rehber oluştur.
            
            İŞ EMRİ:
            Başlık: ${item['Work order name']}
            Varlık: ${item['Asset Name']}
            Notlar: ${item['Comments: Name without formatting'] || 'Yok'}
            
            GÖREVLER:
            1. **Kök Neden Analizi:** Bu arızanın en olası teknik sebebini (aşınma, elektriksel kısa devre, yanlış kullanım vb.) belirle.
            2. **Çözüm Adımları:** Arızayı gidermek için yapılması gerekenleri adım adım, emir kipiyle ve numaralandırılmış liste mantığında yaz. İlk adım her zaman güvenlik (LOTO) olsun.
            3. **Önleme İpucu:** Arızanın tekrar etmemesi için bir mühendislik tavsiyesi ver.
            
            ÇIKTI FORMATI (JSON):
            {
                "problemSummary": "Sorunun kısa ve teknik özeti",
                "rootCause": "Olası Teknik Kök Neden",
                "solutionSteps": [
                    "1. Makine enerjisini kes ve etiketle (LOTO).", 
                    "2. [Teknik Adım 1]", 
                    "3. [Teknik Adım 2]"
                ],
                "preventionTip": "Önleme tavsiyesi"
            }
          `;

          const response = await ai.models.generateContent({ 
              model: "gemini-3-flash", 
              contents: prompt,
              config: { responseMimeType: "application/json" }
          });

          const text = response.text || '{}';
          setAnalysisResult(JSON.parse(text));
      } catch (e) {
          console.error(e);
          alert("Rehber oluşturulamadı.");
      } finally {
          setIsAnalyzingGuide(false);
      }
  };

  const handlePrint = async () => {
      setPrinting(true);
      try { await generateSinglePDF(item); } catch (error) { alert("PDF üretilemedi."); } finally { setPrinting(false); }
  };

  const statusOptions = ['In progress', 'Closed', 'In preparation corrective', 'Wait for spare parts'];
  const closeReasons = ['İş Tamamlandı', 'Yedek Parça Takıldı', 'Geçici Çözüm', 'Mükerrer Kayıt', 'İptal', 'Diğer'];

  const handleStatusClick = (status: string) => {
      if (status === 'Closed') {
          setShowCloseReasonModal(true);
      } else {
          onUpdateStatus?.(status);
      }
  };

  const confirmClose = () => {
      onUpdateStatus?.('Closed', selectedReason);
      setShowCloseReasonModal(false);
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
  };

  const quickPrompts = [
      { label: 'Kök Neden Analizi', icon: Search, query: 'Bu arızanın olası kök nedenleri nelerdir? Balık kılçığı yöntemiyle analiz et.' },
      { label: 'Güvenlik Önlemleri', icon: ShieldAlert, query: 'Bu işi yaparken almam gereken İSG ve güvenlik önlemleri nelerdir? Madde madde listele.' },
      { label: 'Çözüm Adımları', icon: Wrench, query: 'Bu arızayı gidermek için adım adım hangi teknik işlemleri uygulamalıyım?' },
      { label: 'Yedek Parça', icon: Package, query: 'Bu işlem için hangi yedek parçalar veya sarf malzemeler gerekebilir?' },
  ];

  return (
    <div 
        className={`fixed inset-0 z-[200] flex items-end lg:items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 ${isExpanded ? 'p-0' : 'p-0 lg:p-6'}`}
        onClick={onClose} // Close on backdrop click
    >
      <div 
        className={`bg-white flex flex-col lg:flex-row overflow-hidden border-t lg:border border-white/20 relative shadow-2xl transition-all duration-300 ease-in-out
            ${isExpanded 
                ? 'w-full h-full rounded-none max-w-none' 
                : 'w-full h-[100dvh] lg:h-[85vh] lg:max-w-7xl rounded-t-[2rem] lg:rounded-[2.5rem]'
            }`}
        onClick={(e) => e.stopPropagation()} // Prevent close on content click
      >
        
        {/* --- Close Reason Overlay --- */}
        {showCloseReasonModal && (
            <div className="absolute inset-0 z-[300] bg-white/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in zoom-in-95">
                <div className="w-full max-w-sm text-center">
                    <button onClick={() => setShowCloseReasonModal(false)} className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full text-slate-500"><XCircle className="w-6 h-6" /></button>
                    <div className="w-20 h-20 bg-emerald-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-sm border border-emerald-100">
                        <CheckSquare className="w-10 h-10 text-emerald-600" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">İşi Tamamla</h3>
                    <p className="text-sm text-slate-500 mb-8 font-medium">Kapanış nedenini seçerek işlemi onaylayın.</p>
                    
                    <div className="grid grid-cols-1 gap-3 mb-8">
                        {closeReasons.map(r => (
                            <button 
                                key={r} 
                                onClick={() => setSelectedReason(r)}
                                className={`py-3.5 px-6 rounded-2xl text-xs font-black uppercase tracking-widest border transition-all ${selectedReason === r ? 'border-brand-600 bg-brand-600 text-white shadow-lg shadow-brand-200' : 'border-slate-200 bg-white text-slate-500 hover:border-brand-200 hover:text-brand-600'}`}
                            >
                                {r}
                            </button>
                        ))}
                    </div>

                    <button onClick={confirmClose} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-slate-800 flex items-center justify-center gap-2">
                        <CheckCircle2 className="w-4 h-4" /> İşlemi Tamamla
                    </button>
                </div>
            </div>
        )}

        {/* --- LEFT PANEL: DETAILS (Scrollable) --- */}
        <div className={`flex-[1.2] flex flex-col min-h-0 bg-slate-50/50 ${mobileTab === 'details' ? 'flex h-full' : 'hidden lg:flex'}`}>
            
            {/* Header */}
            <div className="px-6 md:px-8 py-5 border-b border-slate-200 bg-white flex justify-between items-start sticky top-0 z-20 shrink-0 shadow-sm">
                <div className="flex gap-4">
                    <div className="mt-1 w-10 h-10 lg:w-12 lg:h-12 bg-slate-900 text-white rounded-xl lg:rounded-2xl flex items-center justify-center shadow-lg shadow-slate-200 shrink-0">
                        <FileCheck className="w-5 h-5 lg:w-6 lg:h-6" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span 
                                onClick={() => copyToClipboard(item['Work order code'])}
                                className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-mono font-bold text-slate-500 cursor-copy hover:bg-slate-200 transition-colors flex items-center gap-1 shrink-0"
                                title="Kodu Kopyala"
                            >
                                <Hash className="w-3 h-3" /> {item['Work order code']}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border shrink-0 ${
                                item['Status code'] === 'Closed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                item['Status code'].includes('Wait') ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                'bg-blue-50 text-blue-600 border-blue-100'
                            }`}>
                                {item['Status code']}
                            </span>
                        </div>
                        <h2 className="text-lg md:text-xl lg:text-2xl font-black text-slate-900 leading-tight line-clamp-2">{item['Work order name']}</h2>
                    </div>
                </div>
                <div className="flex items-center gap-2 pl-2">
                    <button 
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="hidden lg:flex p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-brand-600 hover:border-brand-200 transition-all shadow-sm"
                        title={isExpanded ? "Küçült" : "Tam Ekran"}
                    >
                        {isExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                    </button>
                    <button onClick={onClose} className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-rose-500 hover:border-rose-100 transition-all shadow-sm">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Content Scroll */}
            <div className="flex-1 overflow-y-auto custom-scroll p-5 md:p-8 space-y-6 pb-32 lg:pb-8">
                
                {/* Status Selector */}
                <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-2 w-full">
                    {statusOptions.map(opt => {
                        const isActive = item['Status code'] === opt;
                        return (
                            <button 
                                key={opt}
                                onClick={() => handleStatusClick(opt)}
                                className={`flex-1 py-3 px-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all border ${isActive ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-transparent text-slate-500 border-transparent hover:bg-slate-50'}`}
                            >
                                {opt.replace(/In |Wait for /g, '')}
                            </button>
                        );
                    })}
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Asset Card */}
                    <div className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-5 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Package className="w-24 h-24" />
                        </div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Activity className="w-3 h-3" /> İlgili Varlık
                        </span>
                        <div className="text-base md:text-lg font-black text-slate-800 leading-snug mb-1">{item['Asset Name'] || 'Genel Tesis'}</div>
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold text-slate-500 uppercase mt-2">
                            <Wrench className="w-3 h-3" /> {item['WO Activity type Activity type code'] || 'Genel Bakım'}
                        </div>
                    </div>

                    {/* Timeline Card */}
                    <div className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-center gap-4">
                         <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Calendar className="w-4 h-4" /></div>
                                <div>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Başlangıç</span>
                                    <span className="text-xs font-black text-slate-800">{formatFullDate(item['Work order start date/time'])}</span>
                                </div>
                            </div>
                         </div>
                         <div className="w-full h-px bg-slate-100"></div>
                         <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl ${item['Work order end date/time'] ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-300'}`}><CalendarCheck className="w-4 h-4" /></div>
                                <div>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Bitiş</span>
                                    <span className="text-xs font-black text-slate-800">{item['Work order end date/time'] ? formatFullDate(item['Work order end date/time']) : 'Devam Ediyor'}</span>
                                </div>
                            </div>
                         </div>
                    </div>
                </div>

                {/* Description Box */}
                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                        <StickyNote className="w-4 h-4 text-slate-400" />
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">İş Notları & Arıza Tanımı</span>
                    </div>
                    <div className="p-6 md:p-8">
                        <p className="text-sm font-medium text-slate-700 leading-relaxed whitespace-pre-wrap font-mono">
                            {item['Comments: Name without formatting'] || 'Herhangi bir detay açıklama girilmemiş.'}
                        </p>
                    </div>
                    {item.closeReason && (
                        <div className="px-6 py-4 bg-emerald-50/50 border-t border-emerald-100 flex items-center gap-3">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            <div>
                                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block">Kapanış Notu</span>
                                <span className="text-xs font-bold text-emerald-800">{item.closeReason}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions (Visible on Mobile inside scroll due to pb-32) */}
                <div className="pt-4 flex flex-col sm:flex-row gap-3">
                    <button 
                        onClick={handlePrint} 
                        disabled={printing} 
                        className="flex-1 py-4 bg-white border-2 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-sm"
                    >
                        {printing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                        Raporla
                    </button>
                    {onDelete && (
                        <button 
                            onClick={() => onDelete(item['Work order code'])}
                            className="flex-1 py-4 bg-rose-50 text-rose-600 border-2 border-rose-100 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-rose-100 flex items-center justify-center gap-2 transition-all"
                        >
                            <Trash2 className="w-4 h-4" /> Sil
                        </button>
                    )}
                </div>
            </div>
        </div>

        {/* --- RIGHT PANEL: ENGINEER AI (Chat & Guide & History) --- */}
        <div className={`flex-1 flex flex-col lg:border-l border-slate-200 bg-white ${mobileTab === 'ai' ? 'flex h-full' : 'hidden lg:flex'}`}>
            
            {/* AI Header with Tabs */}
            <div className="px-6 pt-5 pb-0 border-b border-slate-100 flex flex-col gap-4 bg-white shrink-0 shadow-sm relative z-10">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-100">
                                <BrainCircuit className="w-6 h-6" />
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full"></div>
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Mühendis YZ</h3>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-brand-500" /> Çevrimiçi Asistan
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {activeTab === 'chat' && (
                            <button 
                                onClick={() => setChatMessages([])} 
                                className="p-2 text-slate-300 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all" 
                                title="Sohbeti Temizle"
                            >
                                <RefreshCw className="w-4 h-4" />
                            </button>
                        )}
                        <button onClick={onClose} className="lg:hidden p-2 bg-slate-50 rounded-lg"><X className="w-5 h-5 text-slate-500" /></button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                    <button 
                        onClick={() => setActiveTab('chat')}
                        className={`flex-1 min-w-[80px] pb-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all flex items-center justify-center gap-2 ${activeTab === 'chat' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        <Bot className="w-4 h-4" /> Sohbet
                    </button>
                    <button 
                        onClick={() => setActiveTab('guide')}
                        className={`flex-1 min-w-[80px] pb-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all flex items-center justify-center gap-2 ${activeTab === 'guide' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        <ListChecks className="w-4 h-4" /> Çözüm
                    </button>
                    <button 
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 min-w-[80px] pb-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all flex items-center justify-center gap-2 ${activeTab === 'history' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                    >
                        <History className="w-4 h-4" /> Geçmiş
                    </button>
                </div>
            </div>

            {/* --- TAB CONTENT: CHAT --- */}
            {activeTab === 'chat' && (
                <>
                    <div className="flex-1 overflow-y-auto custom-scroll p-4 md:p-6 bg-slate-50 space-y-6 pb-32 lg:pb-6">
                        {chatMessages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full opacity-100 animate-in fade-in duration-500 min-h-[300px]">
                                <div className="w-20 h-20 bg-white rounded-[2rem] flex items-center justify-center shadow-xl shadow-slate-200 mb-6 relative">
                                    <Bot className="w-10 h-10 text-brand-600" />
                                    <div className="absolute inset-0 bg-brand-500/10 rounded-[2rem] animate-pulse"></div>
                                </div>
                                <h4 className="text-lg font-black text-slate-800 mb-2">Analize Hazır</h4>
                                <p className="text-xs text-slate-400 text-center max-w-xs leading-relaxed mb-8">
                                    İş emri detaylarını inceledim. Aşağıdaki hızlı işlemlerden birini seçin veya sorunuzu yazın.
                                </p>
                                
                                <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
                                    {quickPrompts.map((prompt, idx) => (
                                        <button 
                                            key={idx}
                                            onClick={() => handleAiChat(prompt.query)}
                                            disabled={isAiLoading}
                                            className="p-3 bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-brand-300 hover:shadow-md transition-all group disabled:opacity-50 active:scale-95"
                                        >
                                            <prompt.icon className="w-5 h-5 text-slate-400 group-hover:text-brand-600 transition-colors" />
                                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-wide text-center group-hover:text-brand-700">{prompt.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {chatMessages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
                                <div className={`max-w-[85%] lg:max-w-[90%] flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm border ${msg.role === 'user' ? 'bg-brand-600 border-brand-500 text-white' : 'bg-white border-slate-200 text-brand-600'}`}>
                                        {msg.role === 'user' ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                                    </div>
                                    <div className={`p-4 rounded-2xl shadow-sm text-[13px] leading-relaxed ${
                                        msg.role === 'user' 
                                            ? 'bg-brand-600 text-white rounded-tr-sm shadow-brand-200' 
                                            : 'bg-white text-slate-700 border border-slate-200 rounded-tl-sm shadow-sm'
                                    }`}>
                                        {msg.role === 'model' ? (
                                            <div className="space-y-2">
                                                {msg.text.split('\n').map((line, i) => {
                                                    const cleanLine = line.trim().replace(/^\*\s*/, '');
                                                    if (!cleanLine) return null;
                                                    return (
                                                        <div key={i} className="flex gap-2 items-start">
                                                            {line.trim().startsWith('*') && <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0" />}
                                                            <span className={line.includes(':') && line.length < 50 ? 'font-bold text-slate-900' : ''}>{cleanLine}</span>
                                                        </div>
                                                    )
                                                })}
                                                {msg.sources && msg.sources.length > 0 && (
                                                    <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                                                        {msg.sources.slice(0, 2).map((s, i) => (
                                                            <a key={i} href={s.web?.uri} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500 hover:text-brand-600 hover:border-brand-200 transition-colors">
                                                                <Globe className="w-3 h-3" /> {s.web?.title?.substring(0, 15)}...
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            msg.text
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                        
                        {isAiLoading && (
                            <div className="flex justify-start animate-in fade-in">
                                <div className="flex gap-3">
                                    <div className="w-8 h-8 bg-white border border-slate-200 rounded-xl flex items-center justify-center shrink-0">
                                        <Bot className="w-4 h-4 text-brand-600" />
                                    </div>
                                    <div className="bg-white p-4 rounded-2xl rounded-tl-sm border border-slate-200 shadow-sm flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 text-brand-600 animate-spin" />
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Analiz Ediliyor...</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    <div className="p-4 md:p-6 bg-white border-t border-slate-200 shrink-0 shadow-[0_-4px_15px_rgba(0,0,0,0.03)] lg:pb-6 pb-24">
                        <form 
                            onSubmit={(e) => { e.preventDefault(); handleAiChat(); }}
                            className="flex gap-3 relative"
                        >
                            <input 
                                type="text" 
                                value={aiQuery}
                                onChange={(e) => setAiQuery(e.target.value)}
                                placeholder="Teknik soru sorun..."
                                className="flex-1 pl-5 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-[13px] font-bold outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-slate-900 placeholder:text-slate-400"
                                disabled={isAiLoading}
                            />
                            <button 
                                type="submit"
                                disabled={isAiLoading || !aiQuery.trim()}
                                className="w-14 h-14 bg-brand-950 text-white rounded-2xl flex items-center justify-center hover:bg-brand-800 active:scale-95 transition-all disabled:opacity-50 shadow-xl shadow-brand-100"
                            >
                                {isAiLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                            </button>
                        </form>
                    </div>
                </>
            )}

            {/* --- TAB CONTENT: STRUCTURED GUIDE --- */}
            {activeTab === 'guide' && (
                <div className="flex-1 overflow-y-auto custom-scroll p-6 bg-slate-50/50 pb-32 lg:pb-6">
                    {!analysisResult ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-6">
                            <div className="w-32 h-32 bg-white rounded-[2.5rem] shadow-xl border border-indigo-100 flex items-center justify-center relative overflow-hidden group">
                                <ScanSearch className="w-12 h-12 text-indigo-500 group-hover:scale-110 transition-transform" />
                                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 to-transparent"></div>
                            </div>
                            <div className="text-center max-w-xs">
                                <h4 className="text-lg font-black text-slate-800 mb-2">Otomatik Çözüm Rehberi</h4>
                                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                                    Yapay zeka iş emrini analiz eder ve adım adım teknik çözüm planı oluşturur.
                                </p>
                            </div>
                            <button 
                                onClick={runStructuredAnalysis} 
                                disabled={isAnalyzingGuide}
                                className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-3 disabled:opacity-70"
                            >
                                {isAnalyzingGuide ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                {isAnalyzingGuide ? 'Rehber Oluşturuluyor...' : 'REHBER OLUŞTUR'}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            {/* Problem Summary */}
                            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">SORUN ÖZETİ</h4>
                                <p className="text-sm font-bold text-slate-800 leading-relaxed">{analysisResult.problemSummary}</p>
                            </div>

                            {/* Root Cause */}
                            <div className="bg-rose-50 p-6 rounded-[2rem] border border-rose-100 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-5"><Search className="w-24 h-24" /></div>
                                <h4 className="text-[10px] font-black text-rose-400 uppercase tracking-[0.2em] mb-2">OLASI KÖK NEDEN</h4>
                                <p className="text-sm font-black text-rose-700 leading-snug">{analysisResult.rootCause}</p>
                            </div>

                            {/* Steps */}
                            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100">
                                    <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em]">ÇÖZÜM ADIMLARI</h4>
                                </div>
                                <div className="p-6 space-y-4">
                                    {analysisResult.solutionSteps.map((step, idx) => (
                                        <div key={idx} className="flex gap-4">
                                            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-black shrink-0 border border-emerald-200">{idx + 1}</div>
                                            <p className="text-xs font-bold text-slate-600 leading-relaxed pt-1">{step}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Prevention */}
                            <div className="bg-indigo-600 p-6 rounded-[2rem] text-white shadow-xl shadow-indigo-200 relative overflow-hidden">
                                <div className="flex items-start gap-4 relative z-10">
                                    <ShieldCheck className="w-8 h-8 text-indigo-300 shrink-0" />
                                    <div>
                                        <h4 className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] mb-1">ÖNLEME İPUCU</h4>
                                        <p className="text-sm font-bold leading-relaxed">{analysisResult.preventionTip}</p>
                                    </div>
                                </div>
                            </div>

                            <button onClick={() => setAnalysisResult(null)} className="w-full py-4 text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors">
                                Yeni Analiz Yap
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* --- TAB CONTENT: ASSET HISTORY --- */}
            {activeTab === 'history' && (
                <div className="flex-1 overflow-y-auto custom-scroll p-6 bg-slate-50/50 pb-32 lg:pb-6">
                    {assetHistory.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-50">
                            <History className="w-16 h-16 text-slate-300" />
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Bu varlık için geçmiş kayıt bulunamadı.</p>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in">
                            <div className="px-2 flex items-center justify-between">
                                <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-2 py-1 rounded-lg">
                                    {assetHistory.length} GEÇMİŞ KAYIT
                                </span>
                            </div>
                            {assetHistory.map(hist => {
                                const isClosed = String(hist['Status code']).toLowerCase().includes('closed');
                                return (
                                    <div key={hist['Work order code']} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative group overflow-hidden">
                                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isClosed ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                        <div className="flex justify-between items-start mb-2 pl-2">
                                            <span className="text-[9px] font-black text-slate-400">{formatFullDate(hist['Work order start date/time'])}</span>
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isClosed ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                                {hist['Status code']}
                                            </span>
                                        </div>
                                        <h4 className="text-xs font-bold text-slate-800 leading-snug pl-2 mb-2 line-clamp-2">{hist['Work order name']}</h4>
                                        {hist['Comments: Name without formatting'] && (
                                            <div className="pl-2 mt-2 pt-2 border-t border-slate-50">
                                                <p className="text-[10px] text-slate-500 italic line-clamp-2">{hist['Comments: Name without formatting']}</p>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* --- MOBILE FLOATING TAB BAR --- */}
        <div className="lg:hidden absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex bg-white/90 backdrop-blur-xl p-1.5 rounded-full shadow-2xl border border-white/20 ring-1 ring-black/5 max-w-xs w-[90%]">
            <button 
                onClick={() => setMobileTab('details')}
                className={`flex-1 py-3 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${mobileTab === 'details' ? 'bg-slate-900 text-white shadow-lg' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
            >
                <FileCheck className="w-4 h-4" /> Detaylar
            </button>
            <button 
                onClick={() => setMobileTab('ai')}
                className={`flex-1 py-3 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${mobileTab === 'ai' ? 'bg-brand-600 text-white shadow-lg' : 'bg-transparent text-slate-500 hover:bg-slate-100'}`}
            >
                <BrainCircuit className="w-4 h-4" /> Asistan
            </button>
        </div>

      </div>
    </div>
  );
};

export default Modal;
