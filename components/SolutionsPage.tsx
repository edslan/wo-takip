
import React, { useState, useMemo, useEffect } from 'react';
import { WorkOrder, AiAnalysisResult, SolutionEntry } from '../types';
import { BookOpenCheck, Search, Filter, Wrench, CheckCircle2, ChevronRight, BrainCircuit, Loader2, ThumbsUp, Calendar, AlertCircle, Quote, Save, BookmarkCheck, GitBranch, List, Network, ArrowUpDown } from 'lucide-react';
import { excelDateToJSDate } from '../utils';
import { GoogleGenAI } from "@google/genai";
import { db } from '../firebase';
import { doc, setDoc, onSnapshot, collection, query } from 'firebase/firestore';

interface SolutionsPageProps {
  workOrders: WorkOrder[];
  currentUserEmail?: string;
}

export const SolutionsPage: React.FC<SolutionsPageProps> = ({ workOrders, currentUserEmail }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState<WorkOrder | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'withNotes'>('withNotes');
  const [sortMode, setSortMode] = useState<'date' | 'status'>('status'); // Default to status (Open first) per user request
  const [viewTab, setViewTab] = useState<'guide' | 'map'>('map'); 
  
  // AI & Data State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysisResult | null>(null);
  
  // Database State
  const [existingSolution, setExistingSolution] = useState<SolutionEntry | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSolutionIds, setSavedSolutionIds] = useState<Set<string>>(new Set());

  // 1. Subscribe to ALL solutions to show badges in the sidebar
  useEffect(() => {
      const q = query(collection(db, 'solutions'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
          const ids = new Set<string>();
          snapshot.forEach(doc => ids.add(doc.id));
          setSavedSolutionIds(ids);
      });
      return () => unsubscribe();
  }, []);

  // 2. When an item is selected, check if a solution exists in DB
  useEffect(() => {
      setAiAnalysis(null);
      setExistingSolution(null);
      setIsAnalyzing(false);
      setViewTab('map'); 

      if (selectedItem) {
          const code = selectedItem['Work order code'];
          const unsub = onSnapshot(doc(db, 'solutions', code), (docSnap) => {
              if (docSnap.exists()) {
                  const data = docSnap.data() as SolutionEntry;
                  setExistingSolution(data);
                  // Auto-load the saved analysis into view
                  setAiAnalysis(data.analysis);
              } else {
                  setExistingSolution(null);
              }
          });
          return () => unsub();
      }
  }, [selectedItem]);

  // Filter & Sort Logic:
  const solutionCandidates = useMemo(() => {
      let filtered = workOrders.filter(wo => {
          const hasComments = wo['Comments: Name without formatting'] && wo['Comments: Name without formatting'].trim().length > 5;
          const isClosed = String(wo['Status code']).toLowerCase().includes('closed') || String(wo['Status code']).toLowerCase().includes('teco');
          
          if (activeFilter === 'withNotes') return hasComments;
          return hasComments || isClosed;
      });

      if (searchTerm) {
          const lowerTerm = searchTerm.toLowerCase();
          filtered = filtered.filter(wo => 
              wo['Work order name'].toLowerCase().includes(lowerTerm) || 
              (wo['Asset Name'] || '').toLowerCase().includes(lowerTerm) ||
              (wo['Comments: Name without formatting'] || '').toLowerCase().includes(lowerTerm)
          );
      }

      // Sort Logic
      return filtered.sort((a,b) => {
          const dateA = excelDateToJSDate(a['Work order start date/time']).getTime() || 0;
          const dateB = excelDateToJSDate(b['Work order start date/time']).getTime() || 0;

          if (sortMode === 'status') {
              // Status Priority: Open/Active first, Closed last
              const isClosedA = String(a['Status code']).toLowerCase().includes('closed') || String(a['Status code']).toLowerCase().includes('teco');
              const isClosedB = String(b['Status code']).toLowerCase().includes('closed') || String(b['Status code']).toLowerCase().includes('teco');

              if (isClosedA !== isClosedB) {
                  return isClosedA ? 1 : -1; // If A is closed, it goes down (1). If A is open, it goes up (-1).
              }
          }

          // Secondary sort: Date Descending (Newest first)
          return dateB - dateA;
      });
  }, [workOrders, searchTerm, activeFilter, sortMode]);

  // Find Similar Past Incidents for the selected item
  const similarIncidents = useMemo(() => {
      if (!selectedItem) return [];
      const assetName = (selectedItem['Asset Name'] || '').toLowerCase();
      const nameParts = selectedItem['Work order name'].toLowerCase().split(' ').filter(w => w.length > 3).slice(0, 2);
      
      return workOrders.filter(wo => {
          if (wo['Work order code'] === selectedItem['Work order code']) return false;
          const otherAsset = (wo['Asset Name'] || '').toLowerCase();
          const otherName = wo['Work order name'].toLowerCase();
          
          const sameAsset = otherAsset === assetName;
          const keywordMatch = nameParts.some(part => otherName.includes(part));
          
          return sameAsset && keywordMatch;
      }).slice(0, 5);
  }, [selectedItem, workOrders]);

  const handleAiAnalysis = async () => {
      if (!selectedItem) return;
      setIsAnalyzing(true);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const prompt = `
            Sen uzman bir Teknik Bakım ve Güvenilirlik Mühendisisin. Aşağıdaki iş emri kaydını analiz et.
            
            İŞ EMRİ:
            Başlık: ${selectedItem['Work order name']}
            Varlık: ${selectedItem['Asset Name']}
            Notlar: ${selectedItem['Comments: Name without formatting'] || 'Açıklama yok'}
            
            GÖREVLER:
            1. Teknik Çözüm Rehberi Oluştur.
            2. "Kök Neden Analizi Haritası" (Fishbone/Ishikawa benzeri) için veri yapısı oluştur. Bu, sorunun olası sebeplerini kategorize etmelidir (Makine, İnsan, Malzeme, Metot, Çevre).
            
            ÇIKTI FORMATI (JSON):
            {
                "problemSummary": "Teknik özet",
                "rootCause": "En olası temel kök neden",
                "solutionSteps": ["Adım 1", "Adım 2..."],
                "preventionTip": "Tekrarı önleme tavsiyesi",
                "rootCauseMap": {
                    "centralProblem": "Kısa Problem Tanımı",
                    "branches": [
                        { "category": "MAKİNE (Ekipman)", "factors": ["Olası Sebep 1", "Olası Sebep 2"] },
                        { "category": "İNSAN (Operatör)", "factors": ["Olası Sebep"] },
                        { "category": "ORTAM (Çevre)", "factors": ["Olası Sebep"] },
                        { "category": "METOT (Prosedür)", "factors": ["Olası Sebep"] }
                    ]
                }
            }
          `;

          const response = await ai.models.generateContent({ 
              model: "gemini-3-flash", 
              contents: prompt, 
              config: { responseMimeType: "application/json" } 
          });
          
          const text = response.text || '{}';
          setAiAnalysis(JSON.parse(text));
      } catch (error) {
          console.error(error);
          alert("Analiz yapılamadı.");
      } finally {
          setIsAnalyzing(false);
      }
  };

  const handleSaveToLibrary = async () => {
      if (!selectedItem || !aiAnalysis) return;
      setIsSaving(true);
      try {
          const entry: SolutionEntry = {
              id: selectedItem['Work order code'],
              workOrderCode: selectedItem['Work order code'],
              assetName: selectedItem['Asset Name'] || 'Bilinmiyor',
              analysis: aiAnalysis,
              createdAt: existingSolution ? existingSolution.createdAt : Date.now(),
              createdBy: existingSolution ? existingSolution.createdBy : (currentUserEmail || 'System'),
              lastUpdatedAt: Date.now()
          };

          await setDoc(doc(db, 'solutions', entry.id), entry);
      } catch (e) {
          console.error(e);
          alert("Kayıt sırasında hata oluştu.");
      } finally {
          setIsSaving(false);
      }
  };

  return (
    <div className="flex flex-col h-full animate-in w-full max-w-[1920px] mx-auto overflow-hidden bg-slate-50">
        
        {/* Header */}
        <div className="bg-white px-6 md:px-10 py-6 border-b border-slate-200 flex flex-col md:flex-row justify-between md:items-center gap-6 shrink-0">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 border border-indigo-100 shadow-sm">
                    <BookOpenCheck className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Çözüm Kütüphanesi</h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Kurumsal Hafıza & Teknik Bilgi Bankası</p>
                </div>
            </div>
            
            <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1">
                    <button onClick={() => setActiveFilter('withNotes')} className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeFilter === 'withNotes' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Notlu</button>
                    <button onClick={() => setActiveFilter('all')} className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeFilter === 'all' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Tümü</button>
                </div>
                
                <button 
                    onClick={() => setSortMode(prev => prev === 'date' ? 'status' : 'date')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${sortMode === 'status' ? 'bg-white text-indigo-700 border-indigo-200 shadow-sm' : 'bg-slate-50 text-slate-500 border-slate-200'}`}
                >
                    <ArrowUpDown className="w-4 h-4" />
                    {sortMode === 'status' ? 'Önce Açıklar' : 'Tarih (Yeni)'}
                </button>

                <div className="relative flex-1 md:w-64 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                    <input 
                        type="text" 
                        placeholder="Ara..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400 shadow-inner"
                    />
                </div>
            </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
            
            {/* List Sidebar */}
            <div className={`w-full lg:w-1/3 xl:w-[400px] border-r border-slate-200 bg-white flex flex-col ${selectedItem ? 'hidden lg:flex' : 'flex'}`}>
                <div className="p-4 border-b border-slate-100 bg-slate-50/30">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Filter className="w-3 h-3" /> {solutionCandidates.length} Kayıt Bulundu
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scroll p-4 space-y-3">
                    {solutionCandidates.length === 0 ? (
                        <div className="text-center py-20 opacity-40">
                            <Search className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                            <p className="text-xs font-bold text-slate-400 uppercase">Kriterlere uygun kayıt yok</p>
                        </div>
                    ) : (
                        solutionCandidates.map(wo => (
                            <div 
                                key={wo['Work order code']} 
                                onClick={() => setSelectedItem(wo)}
                                className={`p-4 rounded-2xl border transition-all cursor-pointer group flex flex-col gap-2 relative
                                    ${selectedItem?.['Work order code'] === wo['Work order code'] 
                                        ? 'bg-indigo-50 border-indigo-200 shadow-md ring-1 ring-indigo-100' 
                                        : 'bg-white border-slate-100 hover:border-indigo-100 hover:shadow-sm'
                                    }
                                `}
                            >
                                {/* Saved Badge */}
                                {savedSolutionIds.has(wo['Work order code']) && (
                                    <div className="absolute top-0 right-0 p-2">
                                        <BookmarkCheck className="w-4 h-4 text-indigo-500 fill-indigo-100" />
                                    </div>
                                )}

                                <div className="flex justify-between items-start">
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-wider
                                        ${wo['Status code'].toLowerCase().includes('closed') ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200'}
                                    `}>
                                        {wo['Status code']}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400 mr-6">{excelDateToJSDate(wo['Work order start date/time']).toLocaleDateString('tr-TR')}</span>
                                </div>
                                <h4 className={`text-xs font-bold leading-snug line-clamp-2 ${selectedItem?.['Work order code'] === wo['Work order code'] ? 'text-indigo-900' : 'text-slate-700'}`}>
                                    {wo['Work order name']}
                                </h4>
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                                    <Wrench className="w-3 h-3 text-slate-300" />
                                    <span className="truncate">{wo['Asset Name'] || 'Genel Varlık'}</span>
                                </div>
                                {wo['Comments: Name without formatting'] && (
                                    <div className="mt-1 pt-2 border-t border-slate-100/50 flex items-start gap-1.5">
                                        <Quote className="w-3 h-3 text-indigo-300 shrink-0 mt-0.5" />
                                        <p className="text-[10px] text-slate-500 italic line-clamp-2">{wo['Comments: Name without formatting']}</p>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Detail View */}
            <div className={`flex-1 bg-slate-50 flex flex-col h-full overflow-hidden relative ${!selectedItem ? 'hidden lg:flex' : 'flex'}`}>
                {selectedItem ? (
                    <div className="flex-1 overflow-y-auto custom-scroll p-6 md:p-10 space-y-8">
                        {/* Mobile Back Button */}
                        <button onClick={() => setSelectedItem(null)} className="lg:hidden flex items-center gap-2 text-slate-500 font-bold text-xs mb-4">
                            <ChevronRight className="w-4 h-4 rotate-180" /> Listeye Dön
                        </button>

                        {/* Main Card */}
                        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-6">
                                <div>
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className="font-mono text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">
                                            {selectedItem['Work order code']}
                                        </span>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{selectedItem['WO Activity type Activity type code']}</span>
                                    </div>
                                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">
                                        {selectedItem['Work order name']}
                                    </h1>
                                </div>
                                <div className="hidden md:block p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center min-w-[120px]">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">VARLIK</span>
                                    <div className="text-sm font-bold text-slate-700">{selectedItem['Asset Name'] || '-'}</div>
                                </div>
                            </div>

                            {selectedItem['Comments: Name without formatting'] ? (
                                <div className="bg-amber-50/50 p-6 rounded-2xl border border-amber-100 relative">
                                    <Quote className="absolute top-4 left-4 w-8 h-8 text-amber-200/50" />
                                    <p className="text-sm font-medium text-slate-700 leading-relaxed relative z-10 pl-6 border-l-2 border-amber-200 ml-2">
                                        {selectedItem['Comments: Name without formatting']}
                                    </p>
                                    <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Teknisyen Notu
                                    </div>
                                </div>
                            ) : (
                                <div className="p-6 rounded-2xl border-2 border-dashed border-slate-200 text-center">
                                    <p className="text-xs font-bold text-slate-400">Bu iş emrine ait özel bir açıklama girilmemiş.</p>
                                </div>
                            )}
                        </div>

                        {/* AI Analysis Section */}
                        <div className={`bg-white rounded-[2.5rem] border overflow-hidden shadow-lg transition-all ${existingSolution ? 'border-emerald-200 ring-2 ring-emerald-50' : 'border-slate-200'}`}>
                            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between md:items-center gap-6">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 text-white rounded-xl shadow-lg ${existingSolution ? 'bg-emerald-600 shadow-emerald-200' : 'bg-indigo-600 shadow-indigo-200'}`}>
                                        <BrainCircuit className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm">Akıllı Çözüm & Kök Neden</h3>
                                        {existingSolution && <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-0.5">Kütüphanede Kayıtlı</p>}
                                    </div>
                                </div>
                                <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                                    {/* View Toggle */}
                                    {aiAnalysis && (
                                        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                                            <button onClick={() => setViewTab('map')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewTab === 'map' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                                <Network className="w-4 h-4" /> Kök Neden Haritası
                                            </button>
                                            <button onClick={() => setViewTab('guide')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewTab === 'guide' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                                <List className="w-4 h-4" /> Çözüm Adımları
                                            </button>
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        {aiAnalysis && (
                                            <button 
                                                onClick={handleSaveToLibrary}
                                                disabled={isSaving}
                                                className={`px-5 py-2.5 text-white font-black rounded-xl text-[10px] uppercase tracking-widest transition-all shadow-lg flex items-center gap-2 disabled:opacity-50
                                                    ${existingSolution ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' : 'bg-slate-900 hover:bg-slate-800 shadow-slate-200'}
                                                `}
                                            >
                                                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                                {existingSolution ? 'GÜNCELLE' : 'KAYDET'}
                                            </button>
                                        )}
                                        {!aiAnalysis && (
                                            <button 
                                                onClick={handleAiAnalysis} 
                                                disabled={isAnalyzing}
                                                className="w-full md:w-auto px-6 py-2.5 bg-indigo-600 text-white font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                {isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BrainCircuit className="w-3.5 h-3.5" />}
                                                {isAnalyzing ? 'Analiz Ediliyor...' : 'Analizi Başlat'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            {aiAnalysis ? (
                                <div className="p-8 animate-in fade-in">
                                    {/* TAB: ROOT CAUSE MAP */}
                                    {viewTab === 'map' && aiAnalysis.rootCauseMap && (
                                        <div className="mb-8">
                                            <div className="flex items-center justify-center mb-8">
                                                <div className="bg-rose-50 border border-rose-100 px-6 py-4 rounded-3xl text-center shadow-sm max-w-lg">
                                                    <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest block mb-1">ANA PROBLEM</span>
                                                    <h4 className="text-lg font-black text-rose-700 leading-tight">
                                                        {aiAnalysis.rootCauseMap.centralProblem}
                                                    </h4>
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
                                                {/* Connecting Lines (Visual Fake) */}
                                                <div className="hidden lg:block absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-8 border-t-2 border-l-2 border-r-2 border-slate-200 rounded-t-3xl -z-10 mt-[-1rem]"></div>

                                                {aiAnalysis.rootCauseMap.branches.map((branch, idx) => (
                                                    <div key={idx} className="bg-slate-50 rounded-2xl p-5 border border-slate-200 flex flex-col h-full relative group hover:border-indigo-200 hover:shadow-lg transition-all">
                                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-3 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center z-10 text-slate-400 group-hover:border-indigo-300 group-hover:text-indigo-500 transition-colors">
                                                            <GitBranch className="w-3 h-3" />
                                                        </div>
                                                        <h5 className="text-center font-black text-xs text-slate-700 uppercase tracking-widest mb-4 pb-2 border-b border-slate-200">
                                                            {branch.category}
                                                        </h5>
                                                        <ul className="space-y-3 flex-1">
                                                            {branch.factors.map((factor, fIdx) => (
                                                                <li key={fIdx} className="flex items-start gap-2 text-xs font-medium text-slate-600 leading-snug bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 mt-1.5"></span>
                                                                    {factor}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                ))}
                                            </div>
                                            
                                            <div className="mt-8 p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center gap-4">
                                                <div className="p-2 bg-white rounded-full text-indigo-600 shadow-sm"><CheckCircle2 className="w-5 h-5" /></div>
                                                <div>
                                                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">EN OLASI KÖK NEDEN</span>
                                                    <p className="text-sm font-bold text-indigo-900">{aiAnalysis.rootCause}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* TAB: GUIDE & STEPS */}
                                    {viewTab === 'guide' && (
                                        <div className="space-y-8">
                                            <div className="grid grid-cols-1 gap-8">
                                                <div>
                                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">SORUN ÖZETİ</h4>
                                                    <p className="text-sm font-bold text-slate-800 leading-relaxed">{aiAnalysis.problemSummary}</p>
                                                </div>
                                            </div>
                                            
                                            <div>
                                                <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-4">ADIM ADIM ÇÖZÜM</h4>
                                                <div className="space-y-3">
                                                    {aiAnalysis.solutionSteps.map((step, i) => (
                                                        <div key={i} className="flex gap-4 items-start bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100/50">
                                                            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-black shrink-0 border border-emerald-200">{i+1}</div>
                                                            <p className="text-sm font-medium text-slate-700 pt-0.5">{step}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="bg-slate-900 text-white p-6 rounded-2xl flex items-start gap-4 shadow-xl">
                                                <ThumbsUp className="w-6 h-6 text-yellow-400 mt-1 shrink-0" />
                                                <div>
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">MÜHENDİSLİK TAVSİYESİ</span>
                                                    <p className="font-bold text-sm leading-relaxed text-slate-200">{aiAnalysis.preventionTip}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="p-12 text-center opacity-60">
                                    <BrainCircuit className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Detaylı kök neden haritası ve çözüm analizi için butona tıklayın.</p>
                                </div>
                            )}
                        </div>

                        {/* Similar Incidents */}
                        {similarIncidents.length > 0 && (
                            <div>
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 pl-2">BENZER GEÇMİŞ KAYITLAR</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {similarIncidents.map(inc => (
                                        <div key={inc['Work order code']} onClick={() => setSelectedItem(inc)} className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer group">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-[9px] font-black text-slate-400">{excelDateToJSDate(inc['Work order start date/time']).toLocaleDateString('tr-TR')}</span>
                                                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500" />
                                            </div>
                                            <p className="text-xs font-bold text-slate-700 line-clamp-2 group-hover:text-indigo-700 transition-colors">{inc['Work order name']}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-300">
                        <BookOpenCheck className="w-32 h-32 mb-6 opacity-20" />
                        <p className="text-sm font-black uppercase tracking-widest">Detay görüntülemek için bir kayıt seçin</p>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};
