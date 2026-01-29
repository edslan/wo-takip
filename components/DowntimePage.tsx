
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { WorkOrder } from '../types';
import { excelDateToJSDate, formatFullDate } from '../utils';
import { TimerOff, AlertCircle, CalendarRange, Clock, CheckCircle2, Search, ArrowRight, MessageSquare, Briefcase, Filter, X, Check, ChevronDown, Printer, Loader2, BarChart3, Calculator, Hash } from 'lucide-react';
import { generateDowntimeReportPDF } from '../services/pdfService';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface DowntimePageProps {
  workOrders: WorkOrder[];
  onItemClick: (item: WorkOrder) => void;
}

const DowntimePage: React.FC<DowntimePageProps> = ({ workOrders, onItemClick }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const activeListRef = useRef<HTMLDivElement>(null);
  const resolvedListRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const availableActivityTypes = useMemo(() => {
      const types = new Set<string>();
      workOrders.forEach(wo => {
          const type = wo['WO Activity type Activity type code'];
          if (type) types.add(String(type).trim());
      });
      return Array.from(types).sort();
  }, [workOrders]);

  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(() => {
      const defaults = new Set<string>();
      workOrders.forEach(wo => {
          const type = String(wo['WO Activity type Activity type code'] || '').trim();
          if (!type) return;
          const lower = type.toLowerCase();
          if (lower.includes('arıza') || lower.includes('corrective') || lower.includes('onarım') || lower.includes('repair') || lower.includes('breakdown') || lower.includes('acil')) {
              defaults.add(type);
          }
      });
      return defaults;
  });

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
              setShowFilterDropdown(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleType = (type: string) => {
      setSelectedTypes(prev => {
          const next = new Set(prev);
          if (next.has(type)) next.delete(type);
          else next.add(type);
          return next;
      });
  };

  const chartData = useMemo(() => {
      const [year, month] = selectedMonth.split('-').map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      const data = [];
      const relevantWOs = workOrders.filter(wo => {
          const isOutOfOrder = String(wo['Asset out of order?'] || '').toLowerCase();
          const isExplicitDown = isOutOfOrder === 'doğru' || isOutOfOrder === 'true' || isOutOfOrder === 'evet' || isOutOfOrder === '1';
          const activityType = String(wo['WO Activity type Activity type code'] || '').trim();
          const isSelectedType = selectedTypes.has(activityType);
          return isExplicitDown || isSelectedType;
      });

      for (let day = 1; day <= daysInMonth; day++) {
          const currentDayStart = new Date(year, month - 1, day, 0, 0, 0);
          const currentDayEnd = new Date(year, month - 1, day, 23, 59, 59);
          let created = 0; let resolved = 0; let active = 0;
          relevantWOs.forEach(wo => {
              const start = wo['Work order start date/time'] ? excelDateToJSDate(wo['Work order start date/time']) : null;
              const end = wo['Work order end date/time'] ? excelDateToJSDate(wo['Work order end date/time']) : null;
              if (start && !isNaN(start.getTime())) {
                  if (start >= currentDayStart && start <= currentDayEnd) { created++; }
                  if (end && !isNaN(end.getTime()) && end >= currentDayStart && end <= currentDayEnd) { resolved++; }
                  const isStarted = start <= currentDayEnd;
                  const notEndedYet = !end || end > currentDayEnd;
                  if (isStarted && notEndedYet) { active++; }
              }
          });
          data.push({ name: day.toString(), Yeni: created, Cozulen: resolved, Devam: active });
      }
      return data;
  }, [workOrders, selectedMonth, selectedTypes]);

  const { activeDowntimes, resolvedDowntimes, totalDownTimeHours } = useMemo(() => {
      const [year, month] = selectedMonth.split('-').map(Number);
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0, 23, 59, 59);
      const active: WorkOrder[] = []; const resolved: WorkOrder[] = []; let totalHours = 0;
      workOrders.forEach(wo => {
          const isOutOfOrder = String(wo['Asset out of order?'] || '').toLowerCase();
          const isExplicitDown = isOutOfOrder === 'doğru' || isOutOfOrder === 'true' || isOutOfOrder === 'evet' || isOutOfOrder === '1';
          const activityType = String(wo['WO Activity type Activity type code'] || '').trim();
          const isSelectedType = selectedTypes.has(activityType);
          if (!isExplicitDown && !isSelectedType) return;
          const startDate = wo['Work order start date/time'] ? excelDateToJSDate(wo['Work order start date/time']) : null;
          const endDate = wo['Work order end date/time'] ? excelDateToJSDate(wo['Work order end date/time']) : null;
          if (!startDate || isNaN(startDate.getTime())) return;
          const status = String(wo['Status code']).toLowerCase();
          const isClosed = status.includes('closed') || status.includes('comp') || status.includes('teco') || status.includes('kapa') || status.includes('bit');
          const matchesSearch = !searchTerm || wo['Work order name'].toLowerCase().includes(searchTerm.toLowerCase()) || (wo['Asset Name'] || '').toLowerCase().includes(searchTerm.toLowerCase());
          if (!matchesSearch) return;
          if (!isClosed) {
              active.push(wo); const durationMs = new Date().getTime() - startDate.getTime(); totalHours += durationMs / (1000 * 60 * 60);
          } else {
              if (endDate && endDate >= startOfMonth && endDate <= endOfMonth) { resolved.push(wo); const durationMs = endDate.getTime() - startDate.getTime(); totalHours += durationMs / (1000 * 60 * 60); }
          }
      });
      active.sort((a,b) => (excelDateToJSDate(a['Work order start date/time']).getTime() - excelDateToJSDate(b['Work order start date/time']).getTime()));
      resolved.sort((a,b) => (excelDateToJSDate(b['Work order end date/time']).getTime() - excelDateToJSDate(a['Work order end date/time']).getTime()));
      return { activeDowntimes: active, resolvedDowntimes: resolved, totalDownTimeHours: Math.round(totalHours) };
  }, [workOrders, selectedMonth, searchTerm, selectedTypes]);

  const getDurationString = (start: any, end?: any) => {
      const s = excelDateToJSDate(start); const e = end ? excelDateToJSDate(end) : new Date(); if (isNaN(s.getTime())) return '-';
      const diffMs = e.getTime() - s.getTime(); const diffHrs = Math.floor(diffMs / (1000 * 60 * 60)); const diffDays = Math.floor(diffHrs / 24);
      if (diffDays > 0) return `${diffDays} Gün ${diffHrs % 24} Saat`; return `${diffHrs} Saat`;
  };

  const handleDownloadPDF = async () => {
      setIsGeneratingPDF(true);
      try {
          await generateDowntimeReportPDF(activeDowntimes, resolvedDowntimes, activeDowntimes.length + resolvedDowntimes.length, selectedMonth, chartRef.current);
      } catch (e) { console.error(e); alert("PDF oluşturulamadı."); } finally { setIsGeneratingPDF(false); }
  };

  const scrollToSection = (ref: React.RefObject<HTMLDivElement>) => { ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const CustomTooltip = ({ active, payload, label }: any) => { if (active && payload && payload.length) { return (<div className="bg-white p-3 border border-slate-100 shadow-xl rounded-xl text-xs"><p className="font-bold text-slate-500 mb-2">{label} {selectedMonth.split('-')[1]}</p>{payload.map((entry: any, index: number) => (<div key={index} className="flex items-center gap-2 mb-1"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div><span className="font-bold text-slate-700">{entry.name}: {entry.value}</span></div>))}</div>); } return null; };

  return (
    <div className="flex flex-col h-full animate-in w-full max-w-[1920px] mx-auto overflow-hidden bg-slate-50">
        <div className="bg-white px-6 md:px-10 py-6 border-b border-slate-200 flex flex-col md:flex-row justify-between md:items-center gap-6 shrink-0 relative z-20">
            <div className="flex items-center gap-4"><div className="p-3 bg-rose-50 rounded-2xl text-rose-600 border border-rose-100 shadow-sm"><TimerOff className="w-6 h-6" /></div><div><h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Arıza & Duruş Raporu</h2><p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Devam Eden & Kapanan İşler</p></div></div>
            <div className="flex flex-wrap gap-4 items-center justify-end w-full md:w-auto">
                <button onClick={handleDownloadPDF} disabled={isGeneratingPDF} className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 active:scale-95 disabled:opacity-50 z-30 relative order-1 md:order-none w-full md:w-auto justify-center">
                    {isGeneratingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                    <span>PDF RAPORU</span>
                </button>
                <div className="relative order-2 md:order-none flex-1 md:flex-none" ref={filterRef}>
                    <button onClick={() => setShowFilterDropdown(!showFilterDropdown)} className={`flex items-center justify-between w-full md:w-auto gap-2 px-4 py-3 rounded-xl text-xs font-bold border transition-all ${selectedTypes.size > 0 ? 'bg-white text-slate-800 border-slate-300 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}><div className="flex items-center gap-2"><Filter className="w-4 h-4" /><span>TİP FİLTRESİ ({selectedTypes.size})</span></div><ChevronDown className="w-3 h-3 ml-1 opacity-70" /></button>
                    {showFilterDropdown && (<div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 animate-in slide-in-from-top-2 z-50"><div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-100"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">RAPORA DAHİL ET</span><button onClick={() => setShowFilterDropdown(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button></div><div className="max-h-60 overflow-y-auto custom-scroll space-y-1">{availableActivityTypes.length === 0 ? (<p className="text-xs text-slate-400 italic p-2">Aktivite tipi bulunamadı.</p>) : (availableActivityTypes.map(type => (<button key={type} onClick={() => toggleType(type)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition-all text-left ${selectedTypes.has(type) ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}><span className="truncate mr-2">{type}</span>{selectedTypes.has(type) && <Check className="w-3.5 h-3.5 text-brand-600" />}</button>)))}</div><div className="pt-3 mt-3 border-t border-slate-100 text-center"><button onClick={() => setSelectedTypes(new Set())} className="text-[10px] font-black text-rose-500 hover:underline uppercase tracking-wider">Temizle</button></div></div>)}
                </div>
                <div className="relative group flex-1 md:flex-none order-3 md:order-none min-w-[200px]"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-600 transition-colors" /><input type="text" placeholder="Ekipman ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all placeholder:text-slate-400" /></div>
                <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200 flex-1 md:flex-none order-4 md:order-none"><span className="text-[10px] font-black text-slate-400 uppercase px-3 whitespace-nowrap">Dönem:</span><input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-3 py-2 outline-none focus:border-brand-500 w-full" /></div>
            </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scroll p-6 md:p-10 space-y-8">
            <div ref={chartRef} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm"><div className="flex items-center justify-between mb-6 px-2"><div className="flex items-center gap-3"><div className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><BarChart3 className="w-5 h-5" /></div><div><h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Günlük Arıza Trendi</h4><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{selectedMonth} Dönemi</p></div></div></div><div className="h-[250px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}><defs><linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/><stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/></linearGradient><linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient><linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 800 }} axisLine={false} tickLine={false} dy={10} interval={2} /><YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 800 }} axisLine={false} tickLine={false} /><Tooltip content={<CustomTooltip />} /><Legend wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }} /><Area type="monotone" dataKey="Devam" name="Devam Eden" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorActive)" /><Area type="monotone" dataKey="Cozulen" name="Günlük Çözülen" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorResolved)" /><Area type="monotone" dataKey="Yeni" name="Günlük Yeni Kayıt" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorNew)" /></AreaChart></ResponsiveContainer></div></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6"><button onClick={() => scrollToSection(activeListRef)} className="bg-rose-600 p-6 rounded-[2rem] text-white shadow-xl shadow-rose-200 relative overflow-hidden text-left hover:scale-[1.02] transition-transform active:scale-95"><div className="absolute top-0 right-0 p-6 opacity-20"><AlertCircle className="w-16 h-16" /></div><p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-2">DEVAM EDEN</p><h3 className="text-4xl font-black">{activeDowntimes.length}</h3><p className="text-xs font-medium mt-2 opacity-90">Şu an müdahale bekleyen</p></button><button onClick={() => scrollToSection(resolvedListRef)} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden text-left hover:border-emerald-300 hover:shadow-md transition-all active:scale-95 group"><div className="absolute top-0 right-0 p-6 opacity-10 text-emerald-600 group-hover:scale-110 transition-transform"><CheckCircle2 className="w-16 h-16" /></div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">BU AY ÇÖZÜLEN</p><h3 className="text-4xl font-black text-slate-800">{resolvedDowntimes.length}</h3><p className="text-xs font-bold text-emerald-600 mt-2">Arıza giderildi</p></button><div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden"><div className="absolute top-0 right-0 p-6 opacity-10 text-slate-600"><Calculator className="w-16 h-16" /></div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">TOPLAM KAYIT</p><h3 className="text-4xl font-black text-slate-800">{activeDowntimes.length + resolvedDowntimes.length} <span className="text-lg">Adet</span></h3><p className="text-xs font-medium text-slate-400 mt-2">Seçili dönemdeki toplam</p></div></div>
            <div ref={activeListRef}><div className="flex items-center gap-3 mb-6"><div className="w-2 h-8 bg-rose-500 rounded-full"></div><h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Devam Eden Kritik Arızalar</h3></div>{activeDowntimes.length === 0 ? (<div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-8 text-center"><CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" /><p className="text-sm font-bold text-emerald-800">Şu anda aktif/açık durumda olan bir arıza kaydı bulunamadı.</p><p className="text-xs text-emerald-600 mt-2 opacity-80">{selectedTypes.size === 0 ? 'Lütfen yukarıdaki "Tip Filtresi"nden arıza tiplerini seçin.' : 'Seçili filtre kriterlerine uygun açık iş yok.'}</p></div>) : (<div className="space-y-4">{activeDowntimes.map(item => (<div key={item['Work order code']} onClick={() => onItemClick(item)} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-lg transition-all cursor-pointer group"><div className="flex flex-col lg:flex-row gap-6 items-start"><div className="w-full lg:w-32 shrink-0"><div className="bg-rose-50 text-rose-600 px-3 py-3 rounded-xl flex flex-col items-center justify-center gap-1 border border-rose-100 shadow-sm h-full"><AlertCircle className="w-6 h-6 mb-1" /><span className="text-[10px] font-black uppercase tracking-widest text-center">KRİTİK</span></div></div><div className="w-full lg:w-28 shrink-0 flex lg:flex-col justify-between lg:justify-start gap-1 lg:border-r lg:border-slate-100 lg:pr-6"><div className="flex items-center gap-2 lg:block"><Hash className="w-3 h-3 text-slate-300 lg:hidden" /><span className="text-[9px] font-black text-slate-400 block mb-0.5 uppercase tracking-wider">KOD</span><span className="font-mono text-xs font-bold text-slate-500">{item['Work order code']}</span></div></div><div className="flex-1 min-w-0 space-y-2"><div><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">İŞ TANIMI</span><h4 className="text-lg font-black text-slate-900 leading-tight group-hover:text-brand-700 transition-colors">{item['Work order name']}</h4></div><div className="flex items-center gap-2 text-sm font-bold text-slate-600"><Briefcase className="w-4 h-4 text-slate-400" /><span>{item['Asset Name']}</span></div>{item['Comments: Name without formatting'] && (<div className="mt-3 flex items-start gap-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100"><MessageSquare className="w-3 h-3 mt-0.5 shrink-0 opacity-50" /><p className="line-clamp-2 italic">{item['Comments: Name without formatting']}</p></div>)}</div><div className="w-full lg:w-64 shrink-0 flex flex-row lg:flex-col justify-between gap-4 bg-slate-50 lg:bg-transparent p-4 lg:p-0 rounded-xl lg:rounded-none border lg:border-none border-slate-100"><div><span className="text-[9px] font-black text-slate-900 uppercase tracking-widest block mb-1">BAŞLANGIÇ</span><div className="flex items-center gap-2 text-xs font-bold text-slate-600"><CalendarRange className="w-3.5 h-3.5 text-slate-400" />{formatFullDate(item['Work order start date/time'])}</div></div><div><span className="text-[9px] font-black text-slate-900 uppercase tracking-widest block mb-1">GEÇEN SÜRE</span><div className="flex items-center gap-2 text-sm font-black text-rose-600"><TimerOff className="w-4 h-4" />{getDurationString(item['Work order start date/time'])}</div></div></div></div></div>))}</div>)}</div>
            <div ref={resolvedListRef}><div className="flex items-center gap-3 mb-6"><div className="w-2 h-8 bg-emerald-500 rounded-full"></div><h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Bu Ay Çözülenler</h3></div>{resolvedDowntimes.length === 0 ? (<div className="p-8 text-center opacity-50 border-2 border-dashed border-slate-200 rounded-2xl"><p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Bu ay içinde kapanan bir duruş kaydı yok.</p><p className="text-[10px] mt-1 text-slate-400">Üstteki ay filtresini veya Tip Filtresini kontrol edin.</p></div>) : (<div className="space-y-4">{resolvedDowntimes.map(item => (<div key={item['Work order code']} onClick={() => onItemClick(item)} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:border-emerald-200 hover:shadow-md transition-all cursor-pointer group"><div className="flex flex-col lg:flex-row gap-6 items-start"><div className="w-full lg:w-32 shrink-0"><div className="bg-emerald-50 text-emerald-700 px-3 py-3 rounded-xl flex flex-col items-center justify-center gap-1 border border-emerald-100 shadow-sm h-full"><CheckCircle2 className="w-6 h-6 mb-1" /><span className="text-[10px] font-black uppercase tracking-widest text-center">ÇÖZÜLDÜ</span></div></div><div className="w-full lg:w-28 shrink-0 flex lg:flex-col justify-between lg:justify-start gap-1 lg:border-r lg:border-slate-100 lg:pr-6"><div className="flex items-center gap-2 lg:block"><Hash className="w-3 h-3 text-slate-300 lg:hidden" /><span className="text-[9px] font-black text-slate-400 block mb-0.5 uppercase tracking-wider">KOD</span><span className="font-mono text-xs font-bold text-slate-500">{item['Work order code']}</span></div></div><div className="flex-1 min-w-0 space-y-2"><div><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">İŞ TANIMI & VARLIK</span><h4 className="text-lg font-black text-slate-900 leading-tight mb-1 truncate">{item['Work order name']}</h4></div><div className="flex items-center gap-2 text-sm font-bold text-slate-600"><Briefcase className="w-4 h-4 text-slate-400" /><span>{item['Asset Name']}</span></div>{item['WO Activity type Activity type code'] && (<span className="inline-block mt-1 px-2 py-0.5 bg-slate-50 text-[9px] font-bold text-slate-500 rounded border border-slate-100 uppercase">{item['WO Activity type Activity type code']}</span>)}</div><div className="w-full lg:w-64 shrink-0 flex flex-row lg:flex-col justify-between gap-4 bg-slate-50 lg:bg-transparent p-4 lg:p-0 rounded-xl lg:rounded-none border lg:border-none border-slate-100"><div><span className="text-[9px] font-black text-slate-900 uppercase tracking-widest block mb-1">TOPLAM SÜRE</span><div className="text-sm font-black text-slate-700">{getDurationString(item['Work order start date/time'], item['Work order end date/time'])}</div></div><div><span className="text-[9px] font-black text-slate-900 uppercase tracking-widest block mb-1">BİTİŞ TARİHİ</span><div className="flex items-center gap-2 text-xs font-bold text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" />{excelDateToJSDate(item['Work order end date/time']).toLocaleDateString('tr-TR')}</div></div></div></div></div>))}</div>)}</div>
        </div>
    </div>
  );
};

export default DowntimePage;
