
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { WorkOrder } from '../types';
import { excelDateToJSDate } from '../utils';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, AlertCircle, X, CheckCircle2, HelpCircle, Briefcase, ListTodo, LayoutGrid, ArrowUpRight, AlertTriangle, PlayCircle, Plus, Printer, Loader2 } from 'lucide-react';
import { generateCalendarPDF } from '../services/pdfService';

interface CalendarViewProps {
  data: WorkOrder[];
  onItemClick: (item: WorkOrder) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({ data, onItemClick }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedDayInfo, setSelectedDayInfo] = useState<{ date: Date, items: WorkOrder[] } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const isPreventive = (type?: string) => {
    const t = (type || '').toLowerCase();
    return t.includes('preventive') || t.includes('periyodik') || t.includes('kontrol') || t.includes('bakım') || t.includes('pm');
  };

  const isClosed = (status: any) => {
      const s = String(status || '').toLowerCase().trim();
      return s.includes('closed') || s.includes('clsd') || s.includes('teco') || s.includes('comp') || s.includes('kapa') || s.includes('bitti') || s.includes('tamam');
  };

  const isBreakdown = (item: WorkOrder) => {
      const type = (item['WO Activity type Activity type code'] || '').toLowerCase();
      const status = (item['Status code'] || '').toLowerCase();
      const isDowntime = String(item['Asset out of order?'] || '').toLowerCase() === 'true' || String(item['Asset out of order?'] || '').toLowerCase() === 'doğru';
      return isDowntime || type.includes('arıza') || type.includes('corrective') || type.includes('breakdown');
  };

  // --- Calendar Logic ---
  const { daysInMonth, firstDayOfMonth, monthYearString } = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;

    return {
      daysInMonth: lastDay.getDate(),
      firstDayOfMonth: startDay,
      monthYearString: firstDay.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
    };
  }, [currentDate]);

  const calendarData = useMemo(() => {
    const map: Record<number, WorkOrder[]> = {};
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    data.forEach(d => {
        if (!d['Work order start date/time']) return;
        const date = excelDateToJSDate(d['Work order start date/time']);
        if (isNaN(date.getTime())) return;

        if (date.getFullYear() === year && date.getMonth() === month) {
            const day = date.getDate();
            if (!map[day]) map[day] = [];
            map[day].push(d);
        }
    });

    Object.keys(map).forEach(key => {
        const day = Number(key);
        map[day].sort((a, b) => {
            const scoreA = isClosed(a['Status code']) ? 0 : isBreakdown(a) ? 3 : isPreventive(a['WO Activity type Activity type code']) ? 2 : 1;
            const scoreB = isClosed(b['Status code']) ? 0 : isBreakdown(b) ? 3 : isPreventive(b['WO Activity type Activity type code']) ? 2 : 1;
            return scoreB - scoreA;
        });
    });

    return map;
  }, [data, currentDate]);

  const mobileDayItems = useMemo(() => {
    return calendarData[selectedDate.getDate()] || [];
  }, [calendarData, selectedDate]);

  const changeMonth = (delta: number) => {
      const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + delta, 1);
      setCurrentDate(newDate);
      setSelectedDate(newDate);
  };

  const days = Array.from({ length: 42 }, (_, i) => {
      const dayNumber = i - firstDayOfMonth + 1;
      const isCurrentMonth = dayNumber > 0 && dayNumber <= daysInMonth;
      return {
          day: dayNumber,
          isCurrentMonth,
          items: isCurrentMonth ? (calendarData[dayNumber] || []) : []
      };
  });

  const getEventStyle = (item: WorkOrder) => {
      if (isClosed(item['Status code'])) { return { bg: 'bg-slate-100', text: 'text-slate-500', border: 'border-slate-200', icon: CheckCircle2 }; }
      if (isBreakdown(item)) { return { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', icon: AlertTriangle }; }
      if (isPreventive(item['WO Activity type Activity type code'])) { return { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', icon: CalendarIcon }; }
      return { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', icon: Briefcase };
  };

  const handlePrint = async () => {
      if (!containerRef.current) return;
      setIsGeneratingPdf(true);
      try {
          await generateCalendarPDF(containerRef.current, monthYearString);
      } catch (e) {
          alert('PDF oluşturulamadı');
          console.error(e);
      } finally {
          setIsGeneratingPdf(false);
      }
  };

  return (
    <div ref={containerRef} className="bg-white lg:rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden animate-in relative">
        <div className="p-4 lg:p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center bg-slate-50/50 gap-4">
            <div className="flex items-center gap-3 lg:gap-4 w-full sm:w-auto">
                <div className="p-2 lg:p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                    <CalendarIcon className="w-5 h-5 lg:w-6 lg:h-6 text-brand-600" />
                </div>
                <div>
                    <h2 className="text-base lg:text-xl font-black text-slate-800 uppercase tracking-tight">{monthYearString}</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block lg:hidden">Gündem Görünümü</p>
                </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto justify-between sm:justify-end items-center">
                <button 
                    onClick={handlePrint}
                    disabled={isGeneratingPdf}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all disabled:opacity-50"
                >
                    {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />} <span className="hidden sm:inline">RAPOR</span>
                </button>
                <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
                <div className="flex gap-1">
                    <button onClick={() => changeMonth(-1)} className="p-2 bg-white hover:shadow-md rounded-lg transition-all border border-slate-200"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
                    <button onClick={() => changeMonth(1)} className="p-2 bg-white hover:shadow-md rounded-lg transition-all border border-slate-200"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
                </div>
                <button onClick={() => { const now = new Date(); setCurrentDate(now); setSelectedDate(now); }} className="px-4 py-2 bg-brand-600 text-white text-[10px] font-black rounded-lg hover:bg-brand-700 shadow-lg shadow-brand-100 uppercase tracking-widest">BUGÜN</button>
            </div>
        </div>

        <div className="lg:hidden flex overflow-x-auto custom-scroll p-4 bg-white border-b border-slate-100 gap-3 shrink-0" ref={scrollRef}>
            {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1; const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day); const isSelected = selectedDate.getDate() === day; const dayName = date.toLocaleDateString('tr-TR', { weekday: 'short' });
                const items = calendarData[day] || []; let dotColor = 'bg-transparent'; if (items.some(i => !isClosed(i['Status code']) && isBreakdown(i))) dotColor = 'bg-rose-500'; else if (items.some(i => !isClosed(i['Status code']))) dotColor = 'bg-blue-500'; else if (items.length > 0) dotColor = 'bg-slate-300';
                return (
                    <button key={day} onClick={() => setSelectedDate(date)} className={`flex flex-col items-center justify-center min-w-[56px] h-20 rounded-2xl transition-all border-2 relative ${isSelected ? 'bg-brand-600 border-brand-600 text-white shadow-xl scale-105' : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'}`}><span className={`text-[10px] font-black uppercase mb-1 ${isSelected ? 'text-brand-100' : 'text-slate-400'}`}>{dayName}</span><span className="text-lg font-black">{day}</span>{items.length > 0 && !isSelected && (<div className={`absolute bottom-2 w-1.5 h-1.5 rounded-full ${dotColor}`}></div>)}</button>
                );
            })}
        </div>

        <div className="hidden lg:grid grid-cols-7 border-b border-slate-200 bg-slate-50">
            {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map(d => (<div key={d} className="py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">{d}</div>))}
        </div>
        <div className="hidden lg:grid grid-cols-7 grid-rows-6 flex-1 bg-slate-200 gap-px border-b border-slate-200 overflow-hidden">
            {days.map((cell, idx) => {
                const isToday = cell.isCurrentMonth && cell.day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear();
                const displayItems = cell.items.slice(0, 3); const remainingCount = cell.items.length - 3;
                return (
                    <div key={idx} onClick={() => { if (cell.isCurrentMonth) { const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), cell.day); setSelectedDayInfo({ date: targetDate, items: cell.items }); } }} className={`bg-white min-h-[120px] p-2 flex flex-col gap-1 relative group cursor-pointer transition-all ${!cell.isCurrentMonth ? 'bg-slate-50/50 cursor-default pointer-events-none' : 'hover:bg-slate-50'}`}>
                        <div className="flex justify-between items-start mb-1">{cell.isCurrentMonth && (<span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full transition-colors ${isToday ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400'}`}>{cell.day}</span>)}</div>
                        {cell.isCurrentMonth && (<div className="flex flex-col gap-1">{displayItems.map((item, i) => { const style = getEventStyle(item); return (<div key={i} className={`px-2 py-1 rounded-md text-[9px] font-bold truncate border ${style.bg} ${style.text} ${style.border} flex items-center gap-1`}><div className={`w-1.5 h-1.5 rounded-full ${style.text.replace('text-', 'bg-')} shrink-0`}></div><span className="truncate">{item['Work order name']}</span></div>); })}{remainingCount > 0 && (<div className="text-[9px] font-bold text-slate-400 pl-2 hover:text-slate-600">+ {remainingCount} diğer...</div>)}</div>)}
                    </div>
                );
            })}
        </div>

        <div className="lg:hidden flex-1 overflow-y-auto bg-slate-50 p-4 space-y-4 custom-scroll">
            <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><ListTodo className="w-4 h-4 text-slate-400" /><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{selectedDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })}</span></div><span className="text-[10px] font-black text-brand-600 bg-brand-50 px-2 py-1 rounded-lg border border-brand-100">{mobileDayItems.length} İŞ EMRİ</span></div>
            {mobileDayItems.length === 0 ? (<div className="bg-white rounded-3xl p-10 text-center border border-slate-200 border-dashed"><HelpCircle className="w-12 h-12 text-slate-200 mx-auto mb-3" /><p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Bugün için kayıt bulunamadı</p></div>) : (mobileDayItems.map(item => { const style = getEventStyle(item); const Icon = style.icon; return (<div key={item['Work order code']} onClick={() => onItemClick(item)} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm active:scale-95 transition-all flex flex-col gap-4 relative overflow-hidden"><div className={`absolute top-0 left-0 bottom-0 w-1.5 ${style.text.replace('text-', 'bg-')}`}></div><div className="flex justify-between items-start gap-4"><div className="min-w-0"><span className="text-[9px] font-black text-brand-600 bg-brand-50 px-2 py-0.5 rounded border border-brand-100 uppercase tracking-wider mb-2 inline-block">{item['Work order code']}</span><h4 className="text-sm font-black text-slate-800 leading-snug">{item['Work order name']}</h4></div><div className={`p-2 rounded-xl shrink-0 ${style.bg} ${style.text} border ${style.border}`}><Icon className="w-5 h-5" /></div></div><div className="flex items-center gap-4 pt-4 border-t border-slate-50"><div className="flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5 text-slate-300" /><span className="text-[11px] font-bold text-slate-500 truncate max-w-[120px]">{item['Asset Name'] || 'Saha'}</span></div><div className="flex items-center gap-1.5 ml-auto"><Clock className="w-3.5 h-3.5 text-slate-300" /><span className="text-[11px] font-bold text-slate-500">{excelDateToJSDate(item['Work order start date/time']).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span></div></div></div>); }))}
        </div>
        
        <div className="hidden lg:flex p-3 bg-white border-t border-slate-100 items-center gap-8 text-[10px] font-black text-slate-400 justify-center uppercase tracking-widest"><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm"></div> ARIZA (Kritik)</div><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm"></div> BAKIM (Periyodik)</div><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm"></div> DİĞER (Açık)</div><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-slate-300 shadow-sm"></div> KAPALI</div></div>

        {selectedDayInfo && (<div className="hidden lg:flex absolute inset-0 z-[50] bg-brand-950/20 backdrop-blur-sm items-center justify-center p-12 animate-in fade-in zoom-in-95 duration-200"><div className="bg-white w-full max-w-4xl h-full max-h-[800px] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden border border-white/20"><div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50"><div className="flex items-center gap-5"><div className="w-14 h-14 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center justify-center"><CalendarIcon className="w-7 h-7 text-brand-600" /></div><div><h3 className="text-2xl font-black text-slate-900 leading-none tracking-tight">{selectedDayInfo.date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</h3><p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-2">{selectedDayInfo.items.length} Kayıtlı Faaliyet</p></div></div><button onClick={() => setSelectedDayInfo(null)} className="p-4 bg-white rounded-full text-slate-400 hover:text-rose-500 hover:shadow-lg transition-all border border-slate-100"><X className="w-6 h-6" /></button></div><div className="flex-1 overflow-y-auto custom-scroll bg-slate-50/30 p-10 space-y-4">{selectedDayInfo.items.length === 0 ? (<div className="flex flex-col items-center justify-center h-full text-slate-300 opacity-40"><Briefcase className="w-24 h-24 mb-6" /><p className="text-sm font-black uppercase tracking-widest">Bu tarih için planlanmış iş bulunmuyor</p></div>) : (selectedDayInfo.items.map(item => { const style = getEventStyle(item); const StatusIcon = style.icon; return (<div key={item['Work order code']} onClick={() => { onItemClick(item); }} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:border-brand-300 transition-all cursor-pointer group flex items-start gap-6 relative overflow-hidden"><div className={`absolute top-0 left-0 bottom-0 w-2 ${style.text.replace('text-', 'bg-')}`}></div><div className="flex-1 min-w-0"><div className="flex justify-between items-start mb-3"><span className="font-mono text-[10px] font-black text-brand-600 bg-brand-50 px-2.5 py-1 rounded-lg border border-brand-100 group-hover:bg-brand-600 group-hover:text-white transition-colors">{item['Work order code']}</span><div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border ${style.bg} ${style.text} ${style.border}`}><StatusIcon className="w-4 h-4" /> {item['Status code']}</div></div><h4 className="text-lg font-black text-slate-900 group-hover:text-brand-700 transition-colors leading-tight mb-4">{item['Work order name']}</h4><div className="flex items-center gap-6"><span className="text-xs font-bold text-slate-500 flex items-center gap-2"><Briefcase className="w-4 h-4 text-slate-300" /> {item['Asset Name'] || 'Varlık Tanımsız'}</span><span className="text-xs font-bold text-slate-400 border border-slate-100 px-3 py-1 rounded-lg bg-slate-50">{item['WO Activity type Activity type code'] || 'Standart İş'}</span></div></div></div>); }))}</div></div></div>)}
    </div>
  );
};

export default CalendarView;
