
import React, { useMemo, useState } from 'react';
import { WorkOrder, SortConfig } from '../types';
import { formatFullDate, excelDateToJSDate } from '../utils';
import { ArrowUpDown, ArrowUp, ArrowDown, AlertCircle, CheckCircle2, Clock, HelpCircle, ListFilter, Rows, AlignJustify, TimerOff, Calendar, CalendarCheck, PackageSearch, Info, ChevronRight, Briefcase, ArrowRight } from 'lucide-react';

interface WorkOrderTableProps {
  data: WorkOrder[];
  onRowClick: (item: WorkOrder) => void;
  sortConfig: SortConfig;
  onSort: (key: string) => void;
}

const SortIcon = ({ active, direction }: { active: boolean, direction: 'asc' | 'desc' }) => {
    if (!active) return <ArrowUpDown className="w-3 h-3 text-slate-300 ml-1 opacity-50" />;
    return direction === 'asc' ? <ArrowUp className="w-3 h-3 text-brand-600 ml-1" /> : <ArrowDown className="w-3 h-3 text-brand-600 ml-1" />;
};

const WorkOrderTable: React.FC<WorkOrderTableProps> = ({ data, onRowClick, sortConfig, onSort }) => {
  const [isCompact, setIsCompact] = useState(false);

  const getStatusStyle = (status: string) => {
      const lower = status.toLowerCase();
      if (lower.includes('closed') || lower.includes('kapa') || lower.includes('teco') || lower.includes('finish')) {
          return { bg: 'bg-emerald-50/60', rowBorder: 'border-l-emerald-500', text: 'text-emerald-700', border: 'border-emerald-200', hover: 'hover:bg-emerald-100/50', icon: CheckCircle2 };
      }
      if (lower.includes('wait') || lower.includes('bekli') || lower.includes('spare') || lower.includes('malzeme')) {
          return { bg: 'bg-amber-50/60', rowBorder: 'border-l-amber-500', text: 'text-amber-700', border: 'border-amber-200', hover: 'hover:bg-amber-100/50', icon: PackageSearch };
      }
      if (lower.includes('open') || lower.includes('açık') || lower.includes('progress') || lower.includes('devam')) {
          return { bg: 'bg-blue-50/40', rowBorder: 'border-l-blue-500', text: 'text-blue-700', border: 'border-blue-200', hover: 'hover:bg-blue-100/40', icon: AlertCircle };
      }
      return { bg: 'bg-white', rowBorder: 'border-l-slate-300', text: 'text-slate-600', border: 'border-slate-200', hover: 'hover:bg-slate-50', icon: HelpCircle };
  };

  return (
    <div className="bg-white lg:rounded-[2rem] border-none lg:border lg:border-slate-200 lg:shadow-sm overflow-hidden flex flex-col h-full max-h-[900px]">
      <div className="px-4 md:px-8 py-5 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center shrink-0 bg-slate-50/50 gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100"><ListFilter className="w-5 h-5 text-slate-500" /></div>
            <div>
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Varlık Yönetim Merkezi</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{data.length} Aktif Kayıt</p>
            </div>
        </div>
        <div className="flex items-center justify-between w-full md:w-auto gap-3">
            {/* Mobile Sort Options (Simple) */}
            <div className="md:hidden flex gap-2 overflow-x-auto no-scrollbar">
                <button onClick={() => onSort('Work order start date/time')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black border uppercase tracking-wider ${sortConfig.key === 'Work order start date/time' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-500 border-slate-200'}`}>Tarih</button>
                <button onClick={() => onSort('Status code')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black border uppercase tracking-wider ${sortConfig.key === 'Status code' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-500 border-slate-200'}`}>Durum</button>
            </div>

            <button onClick={() => setIsCompact(!isCompact)} className={`hidden md:flex items-center gap-2 px-4 py-2 rounded-xl border text-[10px] font-black tracking-widest transition-all ${isCompact ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                {isCompact ? <AlignJustify className="w-4 h-4" /> : <Rows className="w-4 h-4" />}
                {isCompact ? 'SIKIŞTIRILMIŞ' : 'NORMAL GÖRÜNÜM'}
            </button>
        </div>
      </div>
      
      <div className="overflow-auto custom-scroll flex-1 p-0 md:p-0 pdf-scroll-container">
        
        {/* DESKTOP TABLE VIEW */}
        <table className="w-full text-left min-w-[1100px] border-separate border-spacing-0 hidden md:table">
          <thead className="bg-white border-b border-slate-100 sticky top-0 z-20 shadow-sm">
            <tr>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer" onClick={() => onSort('Work order code')}>
                  <div className="flex items-center">KOD <SortIcon active={sortConfig.key === 'Work order code'} direction={sortConfig.direction} /></div>
              </th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer" onClick={() => onSort('Work order name')}>
                   <div className="flex items-center">İŞ / VARLIK TANIMI <SortIcon active={sortConfig.key === 'Work order name'} direction={sortConfig.direction} /></div>
              </th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer text-center" onClick={() => onSort('Work order start date/time')}>
                  <div className="flex items-center justify-center">BAŞLANGIÇ <SortIcon active={sortConfig.key === 'Work order start date/time'} direction={sortConfig.direction} /></div>
              </th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer text-center" onClick={() => onSort('Work order end date/time')}>
                  <div className="flex items-center justify-center">BİTİŞ <SortIcon active={sortConfig.key === 'Work order end date/time'} direction={sortConfig.direction} /></div>
              </th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right cursor-pointer" onClick={() => onSort('Status code')}>
                  <div className="flex items-center justify-end gap-1">
                      DURUM & İŞLEMLER 
                      <SortIcon active={sortConfig.key === 'Status code'} direction={sortConfig.direction} />
                  </div>
              </th>
            </tr>
          </thead>
          
          <tbody className="bg-white">
            {data.length === 0 ? (
                <tr><td colSpan={5} className="px-10 py-32 text-center text-slate-400 italic font-bold uppercase tracking-widest text-xs">Veri Bulunamadı</td></tr>
            ) : (
                data.map(row => {
                    const statusStyle = getStatusStyle(row['Status code']);
                    const isOutOfOrder = String(row['Asset out of order?'] || '').toLowerCase() === 'doğru' || String(row['Asset out of order?'] || '').toLowerCase() === 'true';
                    const hasEndDate = row['Work order end date/time'] !== undefined && row['Work order end date/time'] !== null;
                    
                    return (
                        <tr 
                            key={row['Work order code']} 
                            onClick={() => onRowClick(row)} 
                            className={`cursor-pointer transition-all border-b border-slate-50 group ${statusStyle.bg} ${statusStyle.hover}`}
                        >
                            <td className={`px-8 ${isCompact ? 'py-3' : 'py-6'} font-mono text-[11px] font-black text-brand-700 whitespace-nowrap border-l-4 ${statusStyle.rowBorder} transition-colors`}>
                                {row['Work order code']}
                            </td>
                            <td className={`px-8 ${isCompact ? 'py-3' : 'py-6'}`}>
                                <div className="flex items-center gap-3">
                                    {isOutOfOrder && (
                                        <div className="p-1.5 bg-rose-100 text-rose-600 rounded-lg animate-pulse border border-rose-200" title="Varlık Duruşta!">
                                            <TimerOff className="w-4 h-4" />
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <div className={`font-black ${isCompact ? 'text-xs' : 'text-sm'} text-slate-800 leading-tight mb-1 truncate max-w-[300px]`}>
                                            {row['Work order name']}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{row['Asset Name'] || 'Genel Saha'}</span>
                                            {row['WO Activity type Activity type code'] && (
                                                <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 uppercase">{row['WO Activity type Activity type code']}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-8 text-center">
                                <div className="flex flex-col items-center">
                                    <div className="flex items-center gap-1.5 text-slate-700 text-[11px] font-bold">
                                        <Calendar className="w-3 h-3 text-slate-400" />
                                        {formatFullDate(row['Work order start date/time']).split(' ')[0]}
                                    </div>
                                    <div className="text-[9px] text-slate-400 font-medium tracking-tight">
                                        {formatFullDate(row['Work order start date/time']).split(' ')[1] || ''}
                                    </div>
                                </div>
                            </td>
                            <td className="px-8 text-center">
                                {hasEndDate ? (
                                    <div className="flex flex-col items-center">
                                        <div className="flex items-center gap-1.5 text-emerald-700 text-[11px] font-bold">
                                            <CalendarCheck className="w-3 h-3 text-emerald-400" />
                                            {formatFullDate(row['Work order end date/time']).split(' ')[0]}
                                        </div>
                                        <div className="text-[9px] text-emerald-500 font-medium tracking-tight">
                                            {formatFullDate(row['Work order end date/time']).split(' ')[1] || ''}
                                        </div>
                                    </div>
                                ) : (
                                    <span className="text-[10px] font-black text-slate-300 uppercase italic tracking-widest">AÇIK İŞ</span>
                                )}
                            </td>
                            <td className="px-8 text-right">
                                <div className="flex items-center justify-end gap-3">
                                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border shadow-sm transition-all ${statusStyle.bg.replace('50/40', '100').replace('50/60', '100')} ${statusStyle.text} ${statusStyle.border} group-hover:scale-105`}>
                                        <statusStyle.icon className="w-3.5 h-3.5" />
                                        {row['Status code']}
                                    </div>
                                    <div className="p-2 bg-slate-100 text-slate-400 rounded-xl hover:bg-brand-600 hover:text-white transition-all shadow-sm">
                                        <Info className="w-4 h-4" />
                                    </div>
                                </div>
                            </td>
                        </tr>
                    );
                })
            )}
          </tbody>
        </table>

        {/* MOBILE CARD VIEW */}
        <div className="md:hidden space-y-4 pb-20 p-2">
            {data.length === 0 ? (
                <div className="text-center py-20 text-slate-400 italic text-xs uppercase font-bold">Kayıt Bulunamadı</div>
            ) : (
                data.map(row => {
                    const statusStyle = getStatusStyle(row['Status code']);
                    const isOutOfOrder = String(row['Asset out of order?'] || '').toLowerCase() === 'doğru' || String(row['Asset out of order?'] || '').toLowerCase() === 'true';
                    const hasEndDate = row['Work order end date/time'] !== undefined && row['Work order end date/time'] !== null;

                    return (
                        <div 
                            key={row['Work order code']}
                            onClick={() => onRowClick(row)}
                            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm active:scale-[0.98] transition-all flex flex-col gap-3 relative overflow-hidden"
                        >
                            <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${statusStyle.text.replace('text-', 'bg-')}`}></div>
                            
                            <div className="flex justify-between items-start gap-2">
                                <span className="font-mono text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                                    {row['Work order code']}
                                </span>
                                <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                                    <statusStyle.icon className="w-3 h-3" /> {row['Status code']}
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                {isOutOfOrder && (
                                    <div className="mt-0.5 p-1.5 bg-rose-100 text-rose-600 rounded-lg animate-pulse border border-rose-200 shrink-0">
                                        <TimerOff className="w-4 h-4" />
                                    </div>
                                )}
                                <div>
                                    <h4 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">{row['Work order name']}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Briefcase className="w-3 h-3 text-slate-400" />
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate max-w-[150px]">{row['Asset Name'] || 'Genel Varlık'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-slate-50 flex items-center justify-between mt-auto">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5 text-slate-500">
                                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="text-[10px] font-bold">{formatFullDate(row['Work order start date/time']).split(' ')[0]}</span>
                                    </div>
                                    {hasEndDate && (
                                        <>
                                            <ArrowRight className="w-3 h-3 text-slate-300" />
                                            <div className="flex items-center gap-1.5 text-emerald-600">
                                                <CalendarCheck className="w-3.5 h-3.5 text-emerald-500" />
                                                <span className="text-[10px] font-bold">{formatFullDate(row['Work order end date/time']).split(' ')[0]}</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                                {row['WO Activity type Activity type code'] && (
                                    <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 uppercase max-w-[80px] truncate">
                                        {row['WO Activity type Activity type code']}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })
            )}
        </div>

      </div>
    </div>
  );
};

export default WorkOrderTable;
