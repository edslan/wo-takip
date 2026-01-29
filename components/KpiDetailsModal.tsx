
import React, { useState, useMemo, useEffect } from 'react';
import { X, Search, Briefcase, Calendar, CheckCircle2, Clock, AlertCircle, HelpCircle, FileText, ChevronRight } from 'lucide-react';
import { WorkOrder } from '../types';
import { formatFullDate } from '../utils';

interface KpiDetailsModalProps {
  title: string;
  data: WorkOrder[];
  onClose: () => void;
  onItemClick: (item: WorkOrder) => void;
  icon: any;
  colorClass: string;
}

const KpiDetailsModal: React.FC<KpiDetailsModalProps> = ({ title, data, onClose, onItemClick, icon: Icon, colorClass }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Prevent background scrolling
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const filteredItems = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return data.filter(item => 
      String(item['Work order code']).toLowerCase().includes(term) ||
      String(item['Work order name']).toLowerCase().includes(term) ||
      String(item['Asset Name'] || '').toLowerCase().includes(term)
    );
  }, [data, searchTerm]);

  const getStatusStyle = (status: string) => {
    const lower = status.toLowerCase();
    if (lower.includes('closed') || lower.includes('kapa')) return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2 };
    if (lower.includes('wait') || lower.includes('bekli')) return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: Clock };
    if (lower.includes('open') || lower.includes('açık') || lower.includes('devam')) return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: AlertCircle };
    return { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', icon: HelpCircle };
  };

  return (
    <div 
      className="fixed inset-0 z-[250] bg-slate-900/40 backdrop-blur-md flex items-end lg:items-center justify-center p-0 lg:p-8 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white w-full h-[95vh] lg:h-auto lg:max-w-4xl lg:max-h-[85vh] rounded-t-[2rem] lg:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border-t lg:border border-white/20"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="px-6 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl bg-white shadow-sm border border-slate-100 ${colorClass.replace('text-', 'text-opacity-80 text-')}`}>
              <Icon className={`w-6 h-6 ${colorClass}`} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{title}</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{data.length} Kayıt Listeleniyor</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-slate-600 hover:shadow-md transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-4 bg-white border-b border-slate-50 shrink-0">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-600 transition-colors" />
            <input 
              type="text" 
              placeholder="Liste içinde ara (Kod, Tanım, Varlık)..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all placeholder:text-slate-400 focus:bg-white"
              autoFocus
            />
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto custom-scroll p-6 space-y-3 bg-slate-50/30 pb-24 lg:pb-6">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 opacity-60">
              <FileText className="w-16 h-16 mb-4" />
              <p className="text-sm font-bold uppercase tracking-widest">Kayıt Bulunamadı</p>
            </div>
          ) : (
            filteredItems.map(item => {
              const statusStyle = getStatusStyle(item['Status code']);
              const StatusIcon = statusStyle.icon;

              return (
                <div 
                  key={item['Work order code']}
                  onClick={() => onItemClick(item)}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-brand-300 transition-all cursor-pointer group flex items-start gap-4 relative overflow-hidden"
                >
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${statusStyle.bg.replace('bg-', 'bg-opacity-100 bg-').replace('50', '500')}`}></div>
                  
                  <div className="flex-1 min-w-0 pl-2">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-mono text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded border border-brand-100">
                        {item['Work order code']}
                      </span>
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                        <StatusIcon className="w-3 h-3" /> {item['Status code']}
                      </div>
                    </div>
                    
                    <h4 className="text-sm font-bold text-slate-900 leading-tight group-hover:text-brand-700 transition-colors mb-3">
                      {item['Work order name']}
                    </h4>

                    <div className="flex flex-wrap items-center gap-4 text-[11px] font-semibold text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-slate-300" />
                        <span className="truncate max-w-[150px]">{item['Asset Name'] || 'Varlık Tanımsız'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-300" />
                        <span>{formatFullDate(item['Work order start date/time'])}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="self-center p-2 rounded-xl bg-slate-50 text-slate-300 group-hover:text-brand-600 group-hover:bg-brand-50 transition-all">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-white border-t border-slate-100 shrink-0 flex justify-end pb-10 lg:pb-6">
          <button 
            onClick={onClose}
            className="w-full lg:w-auto px-8 py-3 bg-brand-950 text-white text-xs font-black rounded-xl uppercase tracking-widest hover:bg-brand-900 transition-all shadow-xl"
          >
            KAPAT
          </button>
        </div>
      </div>
    </div>
  );
};

export default KpiDetailsModal;
