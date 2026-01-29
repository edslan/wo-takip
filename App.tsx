
import React, { useState, useMemo, useRef, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import KPISection from './components/KPISection';
import ChartsSection from './components/ChartsSection';
import WorkOrderTable from './components/WorkOrderTable';
import WorkOrderKanban from './components/WorkOrderKanban';
import CalendarView from './components/CalendarView';
import AssetsPage from './components/AssetsPage';
import PredictiveMaintenancePage from './components/PredictiveMaintenancePage';
import DowntimePage from './components/DowntimePage';
import Modal from './components/Modal';
import KpiDetailsModal from './components/KpiDetailsModal';
import ToDoPage from './components/ToDoPage';
import NotesPage from './components/NotesPage';
import { ShiftReportsPage } from './components/ShiftReportsPage';
import { SolutionsPage } from './components/SolutionsPage'; 
import FileUpload from './components/FileUpload';
import { WorkOrder, FilterState, SortConfig, ToDoItem, ToDoStatus, ViewMode, Note, UserProfile, ShiftReport, KpiConfig, AssetItem, AssetStats } from './types';
import { parseExcelFile, exportToExcel } from './services/excelService';
import { generateDashboardPDF } from './services/pdfService';
import { getMonthKey, excelDateToJSDate } from './utils';
import { LayoutGrid, List, BrainCircuit, Loader2, Globe, Search, Filter, Send, Bot, User as UserIcon, X, Trash2, Activity, CalendarCheck, Clock, AlertCircle, ShieldCheck, AlertTriangle, ListPlus, Table as TableIcon, Zap, PlayCircle, Save, Printer, PieChart } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { db } from './firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, arrayUnion, setDoc, writeBatch, increment } from 'firebase/firestore';

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
    sources?: any[];
}

const DEFAULT_USER: UserProfile = {
    uid: 'single-user-admin',
    email: 'admin@manager.internal',
    displayName: 'Yönetici'
};

const DEFAULT_KPI_CONFIG: KpiConfig[] = [
    { id: 'all', visible: true, order: 0 },
    { id: 'active', visible: true, order: 1 }, // Replaces downtime/priority
    { id: 'mttr', visible: true, order: 2 },
    { id: 'preventive', visible: true, order: 3 },
    { id: 'waiting', visible: true, order: 4 },
    { id: 'overdue', visible: true, order: 5 }
];

const App: React.FC = () => {
  // --- Lifecycle Logs ---
  useEffect(() => {
      console.log("%c[APP] App Bileşeni Mount Edildi.", "color: #8b5cf6; font-weight: bold;");
      return () => {
          console.log("%c[APP] App Bileşeni Unmount Ediliyor.", "color: #8b5cf6;");
      };
  }, []);
  // ----------------------

  const [user] = useState<UserProfile>(DEFAULT_USER);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [rawData, setRawData] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [selectedItem, setSelectedItem] = useState<WorkOrder | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [showFilters, setShowFilters] = useState(window.innerWidth > 1024);
  
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard');
  const [activeKpiFilter, setActiveKpiFilter] = useState<'all' | 'weekly' | 'waiting' | 'overdue' | 'active'>('all');

  const [kpiConfig, setKpiConfig] = useState<KpiConfig[]>(() => {
      const saved = localStorage.getItem('kpi_dashboard_config');
      return saved ? JSON.parse(saved) : DEFAULT_KPI_CONFIG;
  });

  const updateKpiConfig = (newConfig: KpiConfig[]) => {
      setKpiConfig(newConfig);
      localStorage.setItem('kpi_dashboard_config', JSON.stringify(newConfig));
  };

  const [kpiModal, setKpiModal] = useState<{ isOpen: boolean; title: string; data: WorkOrder[]; icon: any; colorClass: string } | null>(null);

  const kpiContainerRef = useRef<HTMLDivElement>(null);
  const chartsAreaRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const [todos, setTodos] = useState<ToDoItem[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [shiftReports, setShiftReports] = useState<ShiftReport[]>([]);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [allUsers] = useState<UserProfile[]>([DEFAULT_USER]); 
  
  // Track if data has loaded to prevent false positive timeouts
  const dataLoadedRef = useRef(false);

  useEffect(() => { if (isAiDrawerOpen) { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); } }, [chatMessages, isAiDrawerOpen]);
  
  // Data Sync with Safety Timeout
  useEffect(() => {
    setLoading(true);
    dataLoadedRef.current = false;
    console.log("%c[APP] Firebase veri bağlantısı başlatılıyor...", "color: #f59e0b;");
    
    // Safety timeout to prevent infinite loading screen
    const safetyTimer = setTimeout(() => {
        if (!dataLoadedRef.current) {
            console.warn("[APP] Veri yükleme zaman aşımı. Arayüz açılıyor...");
            setLoading(false);
        }
    }, 5000);

    const unsubWOs = onSnapshot(doc(db, 'work_order_collections', user.email), (snapshot) => {
        dataLoadedRef.current = true;
        if (snapshot.exists()) { 
            const items = snapshot.data().items || [];
            console.log(`%c[APP] Veri yüklendi. Kayıt sayısı: ${items.length}`, "color: #10b981;");
            setRawData(items); 
        } else { 
            console.log("%c[APP] Veri bulunamadı (İlk kullanım).", "color: #64748b;");
            setRawData([]); 
        }
        setLoading(false);
    }, (error) => { 
        console.error("Master WO sync error:", error); 
        dataLoadedRef.current = true;
        setLoading(false); 
    });
    
    const qTodos = query(collection(db, 'todos'), orderBy('createdAt', 'desc'));
    const unsubTodos = onSnapshot(qTodos, (snapshot) => { 
        setTodos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ToDoItem))); 
    }, (error) => console.error("Todos sync error:", error));
    
    const qNotes = query(collection(db, 'notes'), orderBy('date', 'desc'));
    const unsubNotes = onSnapshot(qNotes, (snapshot) => { 
        setNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note))); 
    }, (error) => console.error("Notes sync error:", error));
    
    const qShifts = query(collection(db, 'shift_reports'), orderBy('dateStr', 'desc'));
    const unsubShifts = onSnapshot(qShifts, (snapshot) => { 
        setShiftReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShiftReport))); 
    }, (error) => console.error("Shifts sync error:", error));
    
    const qAssets = query(collection(db, 'assets'), orderBy('name', 'asc'));
    const unsubAssets = onSnapshot(qAssets, (snapshot) => { 
        setAssets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AssetItem))); 
    }, (error) => console.error("Assets sync error:", error));
    
    return () => { 
        clearTimeout(safetyTimer);
        unsubWOs(); unsubTodos(); unsubNotes(); unsubShifts(); unsubAssets(); 
    };
  }, [user.email]);

  const [filters, setFilters] = useState<FilterState>({ searchTerm: '', startDate: '', endDate: '', activityTypes: new Set(), statuses: new Set(), monthKey: null });
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'Work order start date/time', direction: 'desc' });

  const handleFileUpload = async (file: File) => {
    setSyncing(true); setSyncProgress(20);
    try {
        const newData = await parseExcelFile(file); setSyncProgress(50);
        if (newData.length === 0) { alert("Excel dosyasında veri bulunamadı."); setSyncing(false); return; }
        const mergedMap = new Map<string, WorkOrder>();
        rawData.forEach(item => { mergedMap.set(String(item['Work order code']), item); });
        newData.forEach(item => { mergedMap.set(String(item['Work order code']), item); });
        const finalData = Array.from(mergedMap.values());
        setSyncProgress(70);
        const uniqueAssetNames = new Set<string>();
        finalData.forEach(item => { const name = item['Asset Name']?.trim(); if (name) uniqueAssetNames.add(name); });
        const existingAssetIds = new Set(assets.map(a => a.id));
        const assetPromises: Promise<void>[] = [];
        uniqueAssetNames.forEach(name => {
            const id = name.replace(/[^a-zA-Z0-9_-]/g, '_').toUpperCase();
            if (!existingAssetIds.has(id)) { 
                assetPromises.push(setDoc(doc(db, 'assets', id), { id, name: name, createdAt: Date.now() }, { merge: true })); 
            }
        });
        await Promise.all(assetPromises);
        setSyncProgress(90);
        await setDoc(doc(db, 'work_order_collections', user.email), { items: finalData, lastUpdate: Date.now(), owner: user.email });
        setSyncProgress(100);
        const addedCount = finalData.length - rawData.length;
        setTimeout(() => alert(`✅ Senkronizasyon Tamamlandı!\n\nToplam Kayıt: ${finalData.length}\nYeni Eklenen: ${Math.max(0, addedCount)}\nYeni Varlıklar Eşlendi`), 200);
    } catch (err: any) { console.error("Upload Error:", err); alert(`Yükleme Hatası: ${err.message}`); } finally { setSyncing(false); }
  };

  const handleResetData = () => { setIsResetModalOpen(true); };
  const confirmResetData = async () => {
    setIsResetModalOpen(false); setIsDeleting(true);
    try {
        const assetAggregates: Record<string, { total: number, downtime: number, lastDate: number }> = {};
        rawData.forEach(wo => {
            const assetName = (wo['Asset Name'] || 'Tanımsız Varlık').trim();
            if (!assetAggregates[assetName]) { assetAggregates[assetName] = { total: 0, downtime: 0, lastDate: 0 }; }
            assetAggregates[assetName].total += 1;
            const out = String(wo['Asset out of order?'] || '').toLowerCase();
            if (out === 'doğru' || out === 'true' || out === 'evet' || out === '1') { assetAggregates[assetName].downtime += 1; }
            if (wo['Work order start date/time']) { const d = excelDateToJSDate(wo['Work order start date/time']).getTime(); if (!isNaN(d) && d > assetAggregates[assetName].lastDate) { assetAggregates[assetName].lastDate = d; } }
        });
        const batch = writeBatch(db); let updateCount = 0;
        assets.forEach(asset => {
            const agg = assetAggregates[asset.name.trim()];
            if (agg) {
                const assetRef = doc(db, 'assets', asset.id);
                batch.update(assetRef, { 'stats.totalWOs': increment(agg.total), 'stats.downtimeEvents': increment(agg.downtime), 'stats.lastMaintenanceDate': agg.lastDate });
                updateCount++;
            }
        });
        if (updateCount > 0) { await batch.commit(); }
        await deleteDoc(doc(db, 'work_order_collections', user.email));
        setRawData([]); setSelectedItem(null); setActiveKpiFilter('all');
    } catch (e) { console.error("Reset error:", e); alert("Veriler temizlenirken hata oluştu."); } finally { setIsDeleting(false); }
  };
  const handleDeleteWorkOrder = async (code: string) => { if (!confirm(`${code} nolu iş emrini silmek istediğinize emin misiniz?`)) return; try { const updatedData = rawData.filter(d => d['Work order code'] !== code); await setDoc(doc(db, 'work_order_collections', user.email), { items: updatedData, lastUpdate: Date.now(), owner: user.email }); setSelectedItem(null); } catch (e) { alert("Silme işlemi başarısız."); } };
  const handleStatusUpdate = async (item: WorkOrder, newStatus: string, closeReason?: string) => { try { const updatedData = rawData.map(d => d['Work order code'] === item['Work order code'] ? { ...d, 'Status code': newStatus, closeReason: closeReason || d.closeReason } : d ); await setDoc(doc(db, 'work_order_collections', user.email), { items: updatedData, lastUpdate: Date.now(), owner: user.email }); if (selectedItem && selectedItem['Work order code'] === item['Work order code']) { setSelectedItem({ ...selectedItem, 'Status code': newStatus, closeReason: closeReason || selectedItem.closeReason }); } } catch (e) { alert("Durum güncellenemedi."); } };

  const handleKpiCardClick = (filterType: 'all' | 'weekly' | 'waiting' | 'overdue' | 'active') => {
    setActiveKpiFilter(filterType);
    const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); const sevenDaysLater = new Date(today); sevenDaysLater.setDate(today.getDate() + 7);
    const isPreventive = (type?: string) => { const t = (type || '').toLowerCase(); return t.includes('preventive') || t.includes('periyodik') || t.includes('kontrol') || t.includes('bakım') || t.includes('pm') || t.includes('control'); };
    let kpiData: WorkOrder[] = []; let title = ''; let icon = Activity; let colorClass = 'text-blue-600';
    if (filterType === 'all') { kpiData = rawData; title = 'Tüm İş Emirleri'; icon = Activity; colorClass = 'text-blue-600'; } else if (filterType === 'active') { kpiData = rawData.filter(d => { const s = String(d['Status code'] || '').toLowerCase(); const isClosed = s.includes('closed') || s.includes('teco') || s.includes('cancel') || s.includes('comp') || s.includes('kapa'); const isWaiting = s.includes('wait') || s.includes('bekli') || s.includes('onay'); return !isClosed && !isWaiting; }); title = 'Devam Eden (Aktif) İşler'; icon = PlayCircle; colorClass = 'text-emerald-600'; } else if (filterType === 'weekly') { kpiData = rawData.filter(d => { const status = String(d['Status code']).toLowerCase(); const isOpen = !status.includes('closed') && !status.includes('cancel'); if (isOpen && d['Work order start date/time']) { const startDate = excelDateToJSDate(d['Work order start date/time']); return startDate >= today && startDate <= sevenDaysLater && isPreventive(d['WO Activity type Activity type code']); } return false; }); title = 'Bu Hafta Planlanan Bakımlar'; icon = CalendarCheck; colorClass = 'text-emerald-600'; } else if (filterType === 'waiting') { kpiData = rawData.filter(d => { const s = String(d['Status code'] || '').toLowerCase(); return s.includes('wait') || s.includes('bekli') || s.includes('spare') || s.includes('onay'); }); title = 'Bekleyen İş Emirleri'; icon = Clock; colorClass = 'text-amber-600'; } else if (filterType === 'overdue') { kpiData = rawData.filter(d => { const status = String(d['Status code']).toLowerCase(); const isOpen = !status.includes('closed') && !status.includes('cancel'); if (isOpen && d['Work order start date/time']) { const startDate = excelDateToJSDate(d['Work order start date/time']); return startDate < today && isPreventive(d['WO Activity type Activity type code']); } return false; }); title = 'Geciken Kritik Kontroller'; icon = AlertCircle; colorClass = 'text-rose-600'; }
    setKpiModal({ isOpen: true, title, data: kpiData, icon, colorClass });
  };

  const handleAddTodo = async (item: Omit<ToDoItem, 'id' | 'createdAt' | 'status' | 'notes' | 'createdBy'>) => { try { const newTodo = { ...item, createdAt: Date.now(), status: 'Bekliyor', notes: [], createdBy: user.email }; await addDoc(collection(db, 'todos'), newTodo); } catch (e) { alert("Görev eklenirken hata oluştu."); } };
  const handleUpdateTodoStatus = async (id: string, status: ToDoStatus) => { try { await updateDoc(doc(db, 'todos', id), { status }); } catch (e) { console.error(e); } };
  const handleDeleteTodo = async (id: string) => { try { await deleteDoc(doc(db, 'todos', id)); } catch (e) { console.error(e); } };
  const handleAddTodoNote = async (id: string, text: string) => { try { const newNote = { id: Date.now().toString(), text, author: user.email, date: Date.now() }; await updateDoc(doc(db, 'todos', id), { notes: arrayUnion(newNote) }); } catch (e) { console.error(e); } };
  const handleAddNote = async (n: Omit<Note, 'id' | 'date'>) => { try { const newNote = { ...n, date: Date.now(), createdBy: user.email }; await addDoc(collection(db, 'notes'), newNote); } catch (e) { alert("Not eklenirken hata oluştu."); } };
  const handleUpdateNote = async (n: Note) => { try { const { id, ...data } = n; await updateDoc(doc(db, 'notes', id), data); } catch (e) { console.error(e); } };
  const handleDeleteNote = async (id: string) => { try { await deleteDoc(doc(db, 'notes', id)); } catch (e) { console.error(e); } };
  const handleAddShiftReport = async (report: Omit<ShiftReport, 'id' | 'createdAt'>) => { try { await addDoc(collection(db, 'shift_reports'), { ...report, createdAt: Date.now(), createdBy: user.email }); } catch (e) { alert("Rapor kaydedilirken hata oluştu."); } };
  const handleDeleteShiftReport = async (id: string) => { try { await deleteDoc(doc(db, 'shift_reports', id)); } catch (e) { console.error(e); } };
  const handleDeleteAsset = async (id: string) => { if (!confirm("Bu varlığı kalıcı olarak silmek istediğinize emin misiniz?")) return; try { await deleteDoc(doc(db, 'assets', id)); } catch(e) { console.error(e); alert("Silinemedi"); } };

  const filteredData = useMemo(() => {
    const term = filters.searchTerm.toLowerCase(); const today = new Date(); today.setHours(0,0,0,0);
    return rawData.filter(d => {
        const matchesSearch = !term || String(d['Work order code']).toLowerCase().includes(term) || String(d['Work order name']).toLowerCase().includes(term) || String(d['Asset Name'] || '').toLowerCase().includes(term);
        const matchesActivity = filters.activityTypes.size === 0 || (d['WO Activity type Activity type code'] && filters.activityTypes.has(d['WO Activity type Activity type code']));
        const matchesStatus = filters.statuses.size === 0 || filters.statuses.has(d['Status code']);
        let matchesTime = true;
        if (filters.startDate || filters.endDate || filters.monthKey) {
            const rawDate = d['Work order start date/time'];
            if (!rawDate) { matchesTime = false; } else { const startDate = excelDateToJSDate(rawDate); if (isNaN(startDate.getTime())) { matchesTime = false; } else { const year = startDate.getFullYear(); const month = String(startDate.getMonth() + 1).padStart(2, '0'); const day = String(startDate.getDate()).padStart(2, '0'); const itemDateStr = `${year}-${month}-${day}`; if (filters.startDate && itemDateStr < filters.startDate) matchesTime = false; if (filters.endDate && itemDateStr > filters.endDate) matchesTime = false; if (filters.monthKey && getMonthKey(rawDate) !== filters.monthKey) matchesTime = false; } }
        }
        if (activeKpiFilter === 'overdue') { const statusStr = String(d['Status code']).toLowerCase(); const isClosed = statusStr.includes('closed') || statusStr.includes('cancel'); if (isClosed) return false; if (d['Work order start date/time']) { const startDate = excelDateToJSDate(d['Work order start date/time']); if (startDate >= today) return false; } else return false; }
        return matchesSearch && matchesActivity && matchesStatus && matchesTime;
    });
  }, [rawData, filters, activeKpiFilter]);

  const sortedData = useMemo(() => {
    const data = [...filteredData]; data.sort((a, b) => { const aVal = a[sortConfig.key]; const bVal = b[sortConfig.key]; if (aVal === bVal) return 0; if (aVal === undefined) return 1; if (bVal === undefined) return -1; return sortConfig.direction === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal)); }); return data;
  }, [filteredData, sortConfig]);

  const handleAiAnalyze = async (e?: React.FormEvent) => { 
      if (e) e.preventDefault(); 
      if (!aiQuery.trim() || filteredData.length === 0) return; 
      
      const userMessage = aiQuery; 
      setChatMessages(prev => [...prev, { role: 'user', text: userMessage }]); 
      setAiQuery(''); 
      setIsAiLoading(true); 
      
      try { 
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY }); 
          const dataSummary = filteredData.slice(0, 30).map(d => ({ id: d['Work order code'], title: d['Work order name'], asset: d['Asset Name'], status: d['Status code'], job_note: d['Comments: Name without formatting'] || 'Açıklama yok' })); 
          const history = chatMessages.slice(-6).map(m => `${m.role === 'user' ? 'Kullanıcı' : 'Bakım Asistanı'}: ${m.text}`).join('\n'); 
          const systemInstruction = `Sen profesyonel bir endüstriyel bakım analistisin. Kullanıcıyla karşılıklı sohbet ediyorsun. Veri tabanındaki "job_note" (Arıza/İş Notu) alanlarını mutlaka değerlendirerek arıza kök nedenlerini tespit etmeye çalış. Sohbet geçmişini hatırla ve takip sorularına cevap ver.`; 
          const prompt = `GEÇMİŞ KONUŞMALAR: ${history}\nKULLANICI SORUSU: "${userMessage}"\nGÜNCEL BAKIM VERİLERİ (Notlar Dahil):\n${JSON.stringify(dataSummary)}`; 
          const response = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: prompt, config: { systemInstruction, tools: [{ googleSearch: {} }] } }); 
          setChatMessages(prev => [...prev, { role: 'model', text: response.text || "Analiz yapılamadı.", sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [] }]); 
      } catch (err) { 
          setChatMessages(prev => [...prev, { role: 'model', text: "AI motoruyla bağlantı kurulamadı." }]); 
      } finally { 
          setIsAiLoading(false); 
      } 
  };

  const handleDashboardPrint = async () => {
      if (kpiContainerRef.current && chartsAreaRef.current) {
          setIsGeneratingPDF(true);
          try {
              await generateDashboardPDF(kpiContainerRef.current, chartsAreaRef.current, sortedData);
          } catch(e) { alert("PDF üretilemedi."); }
          finally { setIsGeneratingPDF(false); }
      }
  };

  if (isDeleting) return (<div className="fixed inset-0 z-[300] bg-white/95 backdrop-blur-xl flex flex-col items-center justify-center"><Loader2 className="w-10 h-10 text-rose-600 animate-spin mb-6" /><p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">VERİLER SİLİNİYOR...</p><p className="text-[9px] font-bold text-rose-600 uppercase tracking-widest flex items-center gap-2"><Save className="w-3 h-3" /> Varlık İstatistikleri Arşivleniyor</p></div>);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center overflow-x-hidden">
      
      {isResetModalOpen && (<div className="fixed inset-0 z-[500] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in-95"><div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-slate-200"><div className="p-6 text-center"><div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-6 h-6 text-rose-600" /></div><h3 className="text-lg font-bold text-slate-900 mb-2">İş Emirlerini Sil?</h3><p className="text-sm text-slate-500 leading-relaxed mb-6">Tüm iş emri listesi temizlenecek.<br/><span className="font-bold text-slate-700">Ancak; Makine arıza istatistikleri ve toplam duruş süreleri varlık kartlarına kalıcı olarak kaydedilecektir.</span></p><div className="flex gap-3"><button onClick={() => setIsResetModalOpen(false)} className="flex-1 py-3 bg-white border border-slate-300 rounded-xl text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors">İPTAL</button><button onClick={confirmResetData} className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold text-xs hover:bg-rose-700 shadow-lg shadow-rose-200 transition-colors flex items-center justify-center gap-2"><Trash2 className="w-4 h-4" /> ARŞİVLE VE SİL</button></div></div></div></div>)}
      {(syncing || loading) && (<div className="fixed inset-0 z-[300] bg-white/95 backdrop-blur-xl flex flex-col items-center justify-center">{syncing ? (<><div className="w-64 bg-slate-100 h-1.5 rounded-full overflow-hidden mb-6"><div className="bg-brand-600 h-full transition-all duration-300" style={{ width: `${syncProgress}%` }} /></div><p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-brand-600" /> SİSTEM YENİDEN BAŞLATILIYOR: %{syncProgress}</p></>) : (<><Loader2 className="w-10 h-10 text-brand-600 animate-spin mb-6" /><p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">VERİLER BULUTTAN ÇEKİLİYOR...</p></>)}</div>)}

      {rawData.length > 0 && (currentView === 'dashboard' || currentView === 'charts') && (
        <>
            <button onClick={() => setIsAiDrawerOpen(true)} className="fixed bottom-24 right-6 lg:bottom-8 lg:right-8 z-[150] w-14 h-14 lg:w-16 lg:h-16 bg-brand-950 text-white rounded-2xl flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all group animate-bounce-subtle"><div className="absolute inset-0 bg-brand-600 rounded-2xl animate-ping opacity-20 group-hover:opacity-40"></div><BrainCircuit className="w-6 h-6 lg:w-8 lg:h-8 relative z-10" /><span className="absolute right-full mr-4 px-4 py-2 bg-brand-950 text-white text-[10px] font-black rounded-xl opacity-0 group-hover:opacity-100 transition-all shadow-xl whitespace-nowrap hidden lg:block">MÜHENDİS YZ ASİSTANI</span></button>
            <div className={`fixed inset-0 z-[200] transition-all duration-300 ${isAiDrawerOpen ? 'visible' : 'invisible'}`}><div className={`absolute inset-0 bg-slate-900/30 backdrop-blur-sm transition-opacity duration-300 ${isAiDrawerOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setIsAiDrawerOpen(false)} /><div className={`absolute top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl transition-transform duration-300 transform ${isAiDrawerOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}><div className="p-6 bg-brand-950 text-white flex items-center justify-between shrink-0"><div className="flex items-center gap-4"><div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center"><BrainCircuit className="w-6 h-6" /></div><div><h3 className="text-sm font-black uppercase tracking-widest">Bakım Asistanı</h3><p className="text-[9px] text-brand-400 font-bold uppercase tracking-widest">Sohbet & Analiz</p></div></div><button onClick={() => setIsAiDrawerOpen(false)} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-6 h-6" /></button></div><div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scroll bg-slate-50">{chatMessages.length === 0 ? (<div className="h-full flex flex-col items-center justify-center text-center opacity-30 space-y-4"><Bot className="w-16 h-16 text-slate-400" /><p className="text-xs font-black text-slate-500 uppercase tracking-widest px-8 leading-relaxed">Veriler ve arıza notları hakkında her şeyi sorabilirsiniz.</p></div>) : (chatMessages.map((msg, idx) => (<div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in`}><div className={`max-w-[85%] flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}><div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-brand-600 text-white' : 'bg-brand-950 text-white'}`}>{msg.role === 'user' ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}</div><div className={`p-4 rounded-2xl text-[13px] font-semibold leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-brand-600 text-white rounded-tr-none' : 'bg-white text-slate-900 border border-slate-200 rounded-tl-none'}`}><div className="whitespace-pre-wrap">{msg.text}</div>{msg.sources && msg.sources.length > 0 && (<div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-2">{msg.sources.map((s, i) => (<a key={i} href={s.web?.uri} target="_blank" className="px-2 py-1 bg-brand-50 rounded text-[9px] font-black text-brand-600 flex items-center gap-1 border border-brand-100 hover:bg-brand-100 transition-colors"><Globe className="w-3 h-3" /> {s.web?.title?.substring(0, 15)}...</a>))}</div>)}</div></div></div>))) }<div ref={chatEndRef} /></div><form onSubmit={handleAiAnalyze} className="p-4 bg-white border-t border-slate-100 flex gap-2 shrink-0 shadow-[0_-4px_15px_rgba(0,0,0,0.03)]"><input type="text" value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} placeholder="Bakım verileri hakkında sor..." className="flex-1 px-5 py-4 bg-slate-100 border-none rounded-xl text-[13px] font-bold outline-none focus:ring-2 focus:ring-brand-600/10 transition-all text-slate-950 placeholder:text-slate-400" disabled={isAiLoading} /><button type="submit" disabled={isAiLoading || !aiQuery.trim()} className="w-14 h-14 bg-brand-950 text-white rounded-xl flex items-center justify-center hover:bg-brand-600 active:scale-95 transition-all disabled:opacity-20 shadow-xl">{isAiLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}</button></form></div></div>
        </>
      )}

      <Header 
        onFileUpload={handleFileUpload}
        onExportPDF={() => {}} // Now handled locally by each page
        onExportExcel={() => exportToExcel(sortedData, 'Bakim_Raporu.xlsx')}
        rawData={rawData}
        onOpenAlert={(code) => { const found = rawData.find(d => String(d['Work order code']) === String(code)); if (found) setSelectedItem(found); }}
        currentView={currentView}
        onViewChange={setCurrentView}
        userEmail={user.email}
        onLogout={handleResetData}
        onResetData={handleResetData}
      />

      <main className="pt-32 md:pt-36 xl:pt-24 pb-24 lg:pb-12 px-4 md:px-8 max-w-[1600px] w-full mx-auto flex flex-col items-center animate-in">
        
        <div className="w-full mb-6 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-3 shadow-sm animate-in fade-in slide-in-from-top-4 hidden"><ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" /><div className="flex-1 flex justify-between items-center"><span className="text-xs font-bold text-emerald-800">Akıllı Birleştirme Aktif</span><span className="text-[10px] text-emerald-600 font-medium">Yeni Excel verileri mevcut verilerle çakışmadan birleştirilir.</span></div></div>

        {(currentView === 'dashboard' || currentView === 'charts') && rawData.length > 0 && (
            <div className="w-full flex items-center justify-between mb-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 shadow-sm">
                        {currentView === 'dashboard' ? <Activity className="w-6 h-6" /> : <PieChart className="w-6 h-6" />}
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">{currentView === 'dashboard' ? 'Genel Bakış' : 'Grafik Analiz'}</h2>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Operasyonel Performans & KPI</p>
                    </div>
                </div>
                <button 
                    onClick={handleDashboardPrint} 
                    disabled={isGeneratingPDF}
                    className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl active:scale-95 disabled:opacity-50"
                >
                    {isGeneratingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                    <span className="hidden sm:inline">RAPORLA</span>
                </button>
            </div>
        )}

        {currentView === 'dashboard' && (
            rawData.length === 0 && !loading ? (
                <FileUpload onFileUpload={handleFileUpload} />
            ) : (
                <div className="space-y-8 w-full flex flex-col items-center">
                    <div ref={kpiContainerRef} className="w-full flex justify-center">
                      <KPISection 
                        data={rawData} 
                        activeFilter={activeKpiFilter} 
                        onFilterClick={handleKpiCardClick} 
                        kpiConfig={kpiConfig}
                        onConfigChange={updateKpiConfig}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 relative w-full items-start">
                        {showFilters && (
                            <div className="lg:col-span-3 fixed lg:relative inset-0 z-[100] lg:z-auto bg-slate-900/30 lg:bg-transparent backdrop-blur-sm lg:backdrop-blur-none flex justify-end lg:block">
                                <Sidebar rawData={rawData} filters={filters} setFilters={setFilters} onClose={() => setShowFilters(false)} onReset={handleResetData} />
                            </div>
                        )}
                        <div className={`${showFilters ? 'lg:col-span-9' : 'lg:col-span-12'} space-y-6 w-full`}>
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                                <button onClick={() => setShowFilters(!showFilters)} className="w-full sm:w-auto px-8 py-3 bg-white text-brand-700 border border-brand-200 rounded-xl flex items-center justify-center gap-3 font-bold text-xs tracking-wide hover:bg-brand-50 shadow-sm transition-all active:scale-95"><Filter className="w-5 h-5" /> {showFilters ? 'FİLTRELERİ GİZLE' : 'FİLTRELERİ GÖSTER'}</button>
                                <div className="bg-white p-1.5 rounded-xl border border-slate-200 flex gap-1 w-full sm:w-auto shadow-sm">
                                    <button 
                                        onClick={() => setViewMode('table')} 
                                        className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider ${viewMode === 'table' ? 'bg-brand-50 text-brand-600 border border-brand-100' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        <List className="w-4 h-4" />
                                        <span className="hidden sm:inline">LİSTE</span>
                                    </button>
                                    <button 
                                        onClick={() => setViewMode('kanban')} 
                                        className={`flex-1 sm:flex-none px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider ${viewMode === 'kanban' ? 'bg-brand-50 text-brand-600 border border-brand-100' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        <LayoutGrid className="w-4 h-4" />
                                        <span className="hidden sm:inline">PANO</span>
                                    </button>
                                </div>
                            </div>
                            <div ref={chartsAreaRef} className="animate-in w-full overflow-hidden">
                                {viewMode === 'table' ? (<WorkOrderTable data={sortedData} onRowClick={setSelectedItem} sortConfig={sortConfig} onSort={(key) => setSortConfig(c => ({ key, direction: c.key === key && c.direction === 'asc' ? 'desc' : 'asc' }))} />) : (<WorkOrderKanban data={sortedData} onCardClick={setSelectedItem} onStatusChange={(item, status) => handleStatusUpdate(item, status)} />)}
                            </div>
                        </div>
                    </div>
                </div>
            )
        )}

        {currentView === 'charts' && (
             rawData.length === 0 ? (<div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4"><p className="text-slate-400 font-medium">Görüntülenecek veri bulunamadı.</p><button onClick={() => setCurrentView('dashboard')} className="text-brand-600 hover:underline text-sm">Veri Yükleme Ekranına Dön</button></div>) : (
                <div className="space-y-8 w-full flex flex-col items-center">
                    <div ref={kpiContainerRef} className="w-full flex justify-center">
                      <KPISection 
                        data={rawData} 
                        activeFilter={activeKpiFilter} 
                        onFilterClick={handleKpiCardClick} 
                        kpiConfig={kpiConfig}
                        onConfigChange={updateKpiConfig}
                      />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 relative w-full items-start">
                         {showFilters && (<div className="lg:col-span-3 fixed lg:relative inset-0 z-[100] lg:z-auto bg-slate-900/30 lg:bg-transparent backdrop-blur-sm lg:backdrop-blur-none flex justify-end lg:block"><Sidebar rawData={rawData} filters={filters} setFilters={setFilters} onClose={() => setShowFilters(false)} onReset={handleResetData} /></div>)}
                        <div className={`${showFilters ? 'lg:col-span-9' : 'lg:col-span-12'} space-y-6 w-full`}>
                             <div className="flex flex-col sm:flex-row items-center justify-between gap-6"><button onClick={() => setShowFilters(!showFilters)} className="w-full sm:w-auto px-8 py-3 bg-white text-brand-700 border border-brand-200 rounded-xl flex items-center justify-center gap-3 font-bold text-xs tracking-wide hover:bg-brand-50 shadow-sm transition-all active:scale-95"><Filter className="w-5 h-5" /> {showFilters ? 'FİLTRELERİ GİZLE' : 'FİLTRELERİ GÖSTER'}</button><div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-700 text-xs font-semibold flex items-center gap-2"><Search className="w-4 h-4" /><span>Şu an görüntülenen kayıt sayısı: {filteredData.length}</span></div></div>
                            <div ref={chartsAreaRef} className="animate-in w-full space-y-8">
                                <ChartsSection data={filteredData} />
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center gap-2 px-2">
                                        <TableIcon className="w-5 h-5 text-slate-400" />
                                        <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest">İlgili Veri Listesi</h3>
                                    </div>
                                    <div className="h-[600px] w-full">
                                        <WorkOrderTable 
                                            data={sortedData} 
                                            onRowClick={setSelectedItem} 
                                            sortConfig={sortConfig} 
                                            onSort={(key) => setSortConfig(c => ({ key, direction: c.key === key && c.direction === 'asc' ? 'desc' : 'asc' }))} 
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )
        )}

        {/* --- SOLUTIONS LIBRARY VIEW --- */}
        {currentView === 'solutions' && (
            <div className="w-full h-full lg:h-[calc(100vh-140px)]">
                <SolutionsPage workOrders={rawData} currentUserEmail={user.email} />
            </div>
        )}

        {currentView === 'calendar' && (
             rawData.length === 0 ? (<div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4"><p className="text-slate-400 font-medium">Görüntülenecek veri bulunamadı.</p><button onClick={() => setCurrentView('dashboard')} className="text-brand-600 hover:underline text-sm">Veri Yükleme Ekranına Dön</button></div>) : (
                <div className="w-full h-full lg:h-[calc(100vh-140px)]">
                    <CalendarView data={filteredData} onItemClick={setSelectedItem} />
                </div>
            )
        )}

        {/* --- ASSETS VIEW --- */}
        {currentView === 'assets' && (
            <div className="w-full h-full lg:h-[calc(100vh-140px)]">
                <AssetsPage 
                    assets={assets}
                    workOrders={rawData} 
                    onItemClick={setSelectedItem} 
                    onDeleteAsset={handleDeleteAsset}
                />
            </div>
        )}

        {/* --- PREDICTIVE VIEW --- */}
        {currentView === 'predictive' && (
            <div className="w-full h-full lg:h-[calc(100vh-140px)]">
                <PredictiveMaintenancePage 
                    workOrders={rawData} 
                    shiftReports={shiftReports}
                    assets={assets}
                    currentUserEmail={user.email} // Pass user email for tracking
                    onAddToTodo={handleAddTodo}
                />
            </div>
        )}

        {/* --- DOWNTIME REPORT VIEW --- */}
        {currentView === 'downtime' && (
            <div className="w-full h-full lg:h-[calc(100vh-140px)]">
                <DowntimePage 
                    workOrders={rawData} 
                    onItemClick={setSelectedItem} 
                />
            </div>
        )}

        {(currentView === 'todo' || currentView === 'notes' || currentView === 'shifts') && (<div className="w-full">{currentView === 'todo' && (<ToDoPage todos={todos} users={allUsers} currentUserEmail={user.email || ''} onAdd={handleAddTodo} onUpdateStatus={handleUpdateTodoStatus} onDelete={handleDeleteTodo} onAddNote={handleAddTodoNote} />)}{currentView === 'notes' && (<NotesPage notes={notes} onAdd={handleAddNote} onUpdate={handleUpdateNote} onDelete={handleDeleteNote} />)}{currentView === 'shifts' && (<ShiftReportsPage reports={shiftReports} workOrders={rawData} currentUserEmail={user.email || 'User'} onAdd={handleAddShiftReport} onDelete={handleDeleteShiftReport} />)}</div>)}
      </main>

      {selectedItem && (
        <Modal 
          item={selectedItem} 
          allData={rawData}
          onClose={() => setSelectedItem(null)} 
          onUpdateStatus={(status, closeReason) => handleStatusUpdate(selectedItem, status, closeReason)}
          onDelete={(code) => handleDeleteWorkOrder(code)}
        />
      )}

      {kpiModal?.isOpen && (
        <KpiDetailsModal 
          title={kpiModal.title} 
          data={kpiModal.data} 
          icon={kpiModal.icon} 
          colorClass={kpiModal.colorClass} 
          onClose={() => setKpiModal(null)} 
          onItemClick={(item) => {
            setKpiModal(null);
            setSelectedItem(item);
          }} 
        />
      )}
    </div>
  );
};

export default App;
