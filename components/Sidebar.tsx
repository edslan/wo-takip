
import React from 'react';
import { SlidersHorizontal, Search, X, Check, RotateCcw, Trash2 } from 'lucide-react';
import { FilterState, WorkOrder } from '../types';

interface SidebarProps {
  rawData: WorkOrder[];
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  onClose: () => void;
  onReset: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ rawData, filters, setFilters, onClose, onReset }) => {
  
  // Extract unique values
  const activityTypes = React.useMemo(() => {
    return Array.from(new Set(rawData.map(d => d['WO Activity type Activity type code']).filter(Boolean))).sort() as string[];
  }, [rawData]);

  const statuses = React.useMemo(() => {
    return Array.from(new Set(rawData.map(d => d['Status code']).filter(Boolean))).sort() as string[];
  }, [rawData]);

  const handleCheckboxChange = (type: 'activityTypes' | 'statuses', value: string) => {
    setFilters(prev => {
        const newSet = new Set(prev[type]);
        if (newSet.has(value)) newSet.delete(value);
        else newSet.add(value);
        return { ...prev, [type]: newSet };
    });
  };

  const clearFilters = () => {
    setFilters({
        searchTerm: '',
        startDate: '',
        endDate: '',
        activityTypes: new Set(),
        statuses: new Set(),
        monthKey: null
    });
  };

  return (
    <div className="w-[85vw] md:w-[400px] lg:w-full bg-white lg:rounded-2xl border-l lg:border border-slate-200 shadow-2xl h-full lg:h-[calc(100vh-8rem)] lg:sticky lg:top-24 flex flex-col p-6 animate-in origin-right overflow-hidden">
      <div className="flex items-center justify-between shrink-0 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-50 text-brand-700 rounded-lg flex items-center justify-center border border-brand-100">
                <SlidersHorizontal className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">FİLTRELEME SEÇENEKLERİ</h4>
        </div>
        <button onClick={onClose} className="p-2 lg:hidden bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
            <X className="w-5 h-5" />
        </button>
      </div>

      {/* Arama */}
      <div className="space-y-2 mt-4 shrink-0">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">KOD VEYA TANIM ARA</label>
        <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-600" />
            <input 
                type="text" 
                placeholder="Örn: VBE-TEA..." 
                value={filters.searchTerm}
                onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 transition-all text-slate-900 placeholder:text-slate-400" 
            />
        </div>
      </div>

      {/* Tarih Aralığı */}
      <div className="space-y-2 mt-4 shrink-0">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">TARİH ARALIĞI</label>
        <div className="grid grid-cols-2 gap-3">
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400">BAŞ</span>
                <input 
                    type="date" 
                    value={filters.startDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full pl-10 pr-2 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10" 
                />
            </div>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400">BİT</span>
                <input 
                    type="date" 
                    value={filters.endDate}
                    onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full pl-10 pr-2 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10" 
                />
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scroll space-y-6 min-h-0 py-4">
          {/* Aktivite Tipi */}
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">AKTİVİTE TİPİ</label>
            <div className="flex flex-wrap gap-2">
                {activityTypes.map(type => (
                    <button 
                        key={type} 
                        onClick={() => handleCheckboxChange('activityTypes', type)}
                        className={`px-3 py-2 rounded-lg text-[10px] font-bold border transition-all ${filters.activityTypes.has(type) ? 'bg-brand-600 text-white border-brand-600 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-700'}`}
                    >
                        {type}
                    </button>
                ))}
            </div>
          </div>

          {/* Durum */}
          <div className="space-y-3">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">DURUM FİLTRESİ</label>
            <div className="space-y-2">
                {statuses.map(status => (
                    <div 
                        key={status} 
                        onClick={() => handleCheckboxChange('statuses', status)} 
                        className={`flex items-center justify-between p-3 rounded-xl cursor-pointer border transition-all ${filters.statuses.has(status) ? 'bg-brand-50 border-brand-200 shadow-sm' : 'bg-white border-slate-200 hover:border-brand-200'}`}
                    >
                        <span className={`text-[11px] font-bold ${filters.statuses.has(status) ? 'text-brand-700' : 'text-slate-600'}`}>{status}</span>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${filters.statuses.has(status) ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-slate-300'}`}>
                            {filters.statuses.has(status) && <Check className="w-3 h-3" />}
                        </div>
                    </div>
                ))}
            </div>
          </div>
      </div>

      <div className="space-y-3 pt-4 border-t border-slate-100 mt-auto shrink-0 bg-white z-10">
          <button onClick={clearFilters} className="w-full py-3 bg-slate-100 text-slate-600 text-xs font-bold rounded-xl flex items-center justify-center gap-2 uppercase tracking-wide hover:bg-slate-200 transition-colors border border-slate-200">
            <RotateCcw className="w-4 h-4" /> SEÇİMLERİ SIFIRLA
          </button>
          
          <button 
            type="button"
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onReset();
            }}
            className="w-full py-3 bg-rose-50 text-rose-600 text-xs font-bold rounded-xl flex items-center justify-center gap-2 uppercase tracking-wide hover:bg-rose-100 hover:border-rose-200 transition-colors border border-rose-100 group shadow-sm hover:shadow-md cursor-pointer"
          >
            <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" /> TÜM KAYITLARI SİL
          </button>
      </div>
    </div>
  );
};

export default Sidebar;
