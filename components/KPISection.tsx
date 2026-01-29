
import React, { useState, useMemo } from 'react';
import { WorkOrder, KpiConfig } from '../types';
import { excelDateToJSDate } from '../utils';
import { Activity, Clock, CalendarCheck, AlertCircle, Timer, Settings, Eye, EyeOff, ChevronUp, ChevronDown, X, PlayCircle, Zap, TrendingUp } from 'lucide-react';

interface KPISectionProps {
  data: WorkOrder[];
  activeFilter?: string;
  onFilterClick: (filterType: 'all' | 'weekly' | 'waiting' | 'overdue' | 'active') => void;
  kpiConfig: KpiConfig[];
  onConfigChange: (config: KpiConfig[]) => void;
}

interface KPICardProps {
    id: string;
    title: string;
    count: string | number;
    details: string;
    progress: number | null;
    icon: React.ElementType;
    theme: {
        gradient: string;
        shadow: string;
        text: string;
        iconBg: string;
        progressBg: string;
        progressValue: string;
    };
    isActive: boolean;
    onClick: () => void;
}

const KPICard: React.FC<KPICardProps> = ({ title, count, details, progress, icon: Icon, theme, isActive, onClick }) => {
    return (
        <button
            onClick={onClick}
            className={`relative flex flex-col p-5 md:p-6 rounded-3xl transition-all duration-300 ease-out text-left w-full overflow-hidden shadow-xl md:shadow-2xl md:hover:-translate-y-2 group
                bg-gradient-to-br ${theme.gradient} ${theme.shadow} ${isActive ? 'ring-4 ring-offset-2 ring-white/90' : ''}`}
        >
            <div className="absolute -top-4 -right-4 w-24 h-24 md:w-32 md:h-32 rounded-full bg-white/5 opacity-80 group-hover:scale-125 transition-transform duration-500 ease-in-out"></div>
            
            <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-8">
                    <div className={`p-2.5 md:p-3.5 rounded-2xl ${theme.iconBg} shadow-inner`}>
                        <Icon className={`w-5 h-5 md:w-6 md:h-6 ${theme.text}`} />
                    </div>
                    <span className={`text-xs md:text-base font-black uppercase tracking-tight ${theme.text} line-clamp-1`}>{title}</span>
                </div>

                <div className="mt-auto mb-4 md:mb-6">
                    <h3 className={`text-3xl md:text-5xl lg:text-6xl font-black ${theme.text} tracking-tight`}>{count}</h3>
                    <p className={`text-[10px] md:text-sm font-bold opacity-80 ${theme.text} mt-1 truncate`}>{details}</p>
                </div>

                {progress !== null && (
                    <div className={`w-full h-1.5 md:h-2.5 rounded-full mt-auto ${theme.progressBg} shadow-inner`}>
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${theme.progressValue}`}
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                )}
            </div>
        </button>
    );
};

const KPISection: React.FC<KPISectionProps> = ({ data, activeFilter, onFilterClick, kpiConfig, onConfigChange }) => {
  const [showSettings, setShowSettings] = useState(false);

  const isClosed = (status: any) => {
    const s = String(status || '').toLowerCase().trim();
    return s.includes('closed') || s.includes('clsd') || s.includes('teco') || s.includes('comp') || s.includes('kapa') || s.includes('bitti') || s.includes('tamam');
  };

  const isWaiting = (status: any) => {
      const s = String(status || '').toLowerCase().trim();
      return s.includes('wait') || s.includes('bekli') || s.includes('spare') || s.includes('onay');
  };

  const isPreventive = (type?: string) => {
      const t = (type || '').toLowerCase();
      return t.includes('preventive') || t.includes('periyodik') || t.includes('kontrol') || t.includes('bakım') || t.includes('pm') || t.includes('control');
  };

  // --- KPI Calculations ---
  const kpiData = useMemo(() => {
      const totalCount = data.length;
      const closed = data.filter(d => isClosed(d['Status code'])).length;
      const open = totalCount - closed;
      const completionRate = totalCount > 0 ? Math.round((closed / totalCount) * 100) : 0;

      const waitingItems = data.filter(d => isWaiting(d['Status code']));
      const waitingRate = totalCount > 0 ? Math.round((waitingItems.length / totalCount) * 100) : 0;
      
      const activeItems = data.filter(d => {
          const s = String(d['Status code']).toLowerCase();
          return !isClosed(s) && !isWaiting(s);
      });

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const overdueStarts = data.filter(d => {
          const status = String(d['Status code']).toLowerCase();
          if (isClosed(status)) return false;
          if (d['Work order start date/time']) {
              const startDate = excelDateToJSDate(d['Work order start date/time']);
              return startDate < today && isPreventive(d['WO Activity type Activity type code']);
          }
          return false;
      });

      // MTTR Calculation (Mean Time To Repair)
      let totalResolutionDays = 0;
      let resolvedCount = 0;
      data.forEach(d => {
          if (isClosed(d['Status code']) && d['Work order start date/time'] && d['Work order end date/time']) {
              const start = excelDateToJSDate(d['Work order start date/time']);
              const end = excelDateToJSDate(d['Work order end date/time']);
              
              if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                  const diff = (end.getTime() - start.getTime()) / (1000 * 3600 * 24);
                  if (diff >= 0) {
                      totalResolutionDays += diff;
                      resolvedCount++;
                  }
              }
          }
      });
      const mttr = resolvedCount > 0 ? (totalResolutionDays / resolvedCount).toFixed(1) : '0';

      // Preventive Ratio
      const preventiveCount = data.filter(d => isPreventive(d['WO Activity type Activity type code'])).length;
      const preventiveRatio = totalCount > 0 ? Math.round((preventiveCount / totalCount) * 100) : 0;

      return { totalCount, open, closed, completionRate, waitingItems, waitingRate, activeItems, overdueStarts, mttr, preventiveCount, preventiveRatio };
  }, [data]);

  // --- KPI Card Definitions ---
  const kpiDefinitions: Record<string, any> = {
    all: {
        title: "Toplam İş Emri",
        count: kpiData.totalCount,
        details: `${kpiData.open} Açık  |  ${kpiData.closed} Kapalı`,
        progress: kpiData.completionRate,
        icon: Activity,
        theme: {
            gradient: 'from-blue-500 to-blue-600', shadow: 'shadow-blue-200', text: 'text-white',
            iconBg: 'bg-white/10', progressBg: 'bg-white/20', progressValue: 'bg-white'
        },
        targetFilter: 'all'
    },
    active: { 
        title: "Devam Eden İşler",
        count: kpiData.activeItems.length,
        details: "Sahada aktif çalışılan",
        progress: null,
        icon: PlayCircle,
        theme: {
            gradient: 'from-emerald-500 to-emerald-600', shadow: 'shadow-emerald-200', text: 'text-white',
            iconBg: 'bg-white/10', progressBg: '', progressValue: ''
        },
        targetFilter: 'active'
    },
    mttr: { 
        title: "Ort. Çözüm (MTTR)",
        count: `${kpiData.mttr}`,
        details: "Gün / Ortalama Süre",
        progress: null,
        icon: Timer,
        theme: {
            gradient: 'from-violet-600 to-purple-600', shadow: 'shadow-purple-200', text: 'text-white',
            iconBg: 'bg-white/10', progressBg: '', progressValue: ''
        },
        targetFilter: 'all' // MTTR is a metric, showing 'all' context usually makes sense or maybe 'closed'
    },
    preventive: { 
        title: "Proaktif Oran",
        count: `%${kpiData.preventiveRatio}`,
        details: `${kpiData.preventiveCount} Planlı Bakım`,
        progress: kpiData.preventiveRatio,
        icon: Zap,
        theme: {
            gradient: 'from-cyan-500 to-teal-500', shadow: 'shadow-cyan-200', text: 'text-white',
            iconBg: 'bg-white/10', progressBg: 'bg-white/20', progressValue: 'bg-white'
        },
        targetFilter: 'weekly' // Usually preventive maintenance is weekly/planned
    },
    waiting: {
        title: "Bekleyen İşler",
        count: kpiData.waitingItems.length,
        details: `Parça/Onay bekleyen`,
        progress: kpiData.waitingRate,
        icon: Clock,
        theme: {
            gradient: 'from-amber-500 to-amber-600', shadow: 'shadow-amber-200', text: 'text-white',
            iconBg: 'bg-white/10', progressBg: 'bg-white/20', progressValue: 'bg-white'
        },
        targetFilter: 'waiting'
    },
    overdue: {
        title: "Geciken Kontroller",
        count: kpiData.overdueStarts.length,
        details: "Termini geçmiş periyodikler",
        progress: null,
        icon: AlertCircle,
        theme: {
            gradient: 'from-rose-600 to-rose-700', shadow: 'shadow-rose-300', text: 'text-white',
            iconBg: 'bg-white/10', progressBg: '', progressValue: ''
        },
        targetFilter: 'overdue'
    }
  };

  const moveKpi = (index: number, direction: 'up' | 'down') => {
      const newConfig = [...kpiConfig];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newConfig.length) return;
      
      const temp = newConfig[index];
      newConfig[index] = newConfig[targetIndex];
      newConfig[targetIndex] = temp;

      // Update order numbers
      newConfig.forEach((cfg, idx) => { cfg.order = idx; });
      onConfigChange(newConfig);
  };

  const toggleKpi = (id: string) => {
      const newConfig = kpiConfig.map(cfg => 
          cfg.id === id ? { ...cfg, visible: !cfg.visible } : cfg
      );
      onConfigChange(newConfig);
  };

  const visibleKpis = kpiConfig
    .filter(cfg => cfg.visible)
    .map(cfg => {
        // Migration logic for old keys
        let key = cfg.id;
        if (cfg.id === 'downtime' || cfg.id === 'priority') key = 'active';
        
        const def = kpiDefinitions[key] || kpiDefinitions['all'];
        return { id: cfg.id, ...def };
    });

  return (
    <div className="w-full space-y-4">
      <div className="flex justify-end">
        <button 
          onClick={() => setShowSettings(true)}
          className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-brand-600 hover:shadow-sm transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
        >
          <Settings className="w-4 h-4" /> <span className="hidden sm:inline">Paneli Düzenle</span>
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 md:gap-6 w-full">
        {visibleKpis.map(kpi => (
          <KPICard 
            key={kpi.id}
            {...kpi}
            isActive={activeFilter === kpi.id}
            onClick={() => onFilterClick(kpi.targetFilter)}
          />
        ))}
        {visibleKpis.length === 0 && (
            <div className="col-span-full py-12 text-center bg-slate-100 rounded-[2.5rem] border-2 border-dashed border-slate-300">
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Görüntülenecek KPI seçilmedi.</p>
            </div>
        )}
      </div>

      {showSettings && (
          <div className="fixed inset-0 z-[500] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
                  <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <div className="flex items-center gap-2">
                        <Settings className="w-5 h-5 text-brand-600" />
                        <h3 className="font-black text-slate-800 uppercase text-sm tracking-tight">GÖSTERGE PANELİ AYARLARI</h3>
                      </div>
                      <button onClick={() => setShowSettings(false)} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                        <X className="w-5 h-5" />
                      </button>
                  </div>
                  <div className="p-6 space-y-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Kartların görünürlüğünü ve sırasını belirleyin</p>
                      {kpiConfig.map((cfg, idx) => {
                          let key = cfg.id;
                          if (cfg.id === 'downtime' || cfg.id === 'priority') key = 'active';
                          const def = kpiDefinitions[key];
                          
                          return (
                              <div key={cfg.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${cfg.visible ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-transparent opacity-60'}`}>
                                  <div className="flex items-center gap-4">
                                      <button 
                                        onClick={() => toggleKpi(cfg.id)}
                                        className={`p-2 rounded-xl transition-all ${cfg.visible ? 'bg-brand-50 text-brand-600 border border-brand-100' : 'bg-slate-200 text-slate-400'}`}
                                      >
                                          {cfg.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                      </button>
                                      <div>
                                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">{def?.title || cfg.id}</h4>
                                      </div>
                                  </div>
                                  <div className="flex gap-1">
                                      <button 
                                        disabled={idx === 0}
                                        onClick={() => moveKpi(idx, 'up')}
                                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 disabled:opacity-20"
                                      >
                                          <ChevronUp className="w-4 h-4" />
                                      </button>
                                      <button 
                                        disabled={idx === kpiConfig.length - 1}
                                        onClick={() => moveKpi(idx, 'down')}
                                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 disabled:opacity-20"
                                      >
                                          <ChevronDown className="w-4 h-4" />
                                      </button>
                                  </div>
                              </div>
                          );
                      })}
                  </div>
                  <div className="p-6 border-t border-slate-50 bg-slate-50 flex justify-end">
                      <button 
                        onClick={() => setShowSettings(false)}
                        className="px-8 py-3 bg-brand-950 text-white text-xs font-black rounded-xl uppercase tracking-widest hover:bg-brand-900 transition-all shadow-xl shadow-brand-200"
                      >
                        Tamam
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default KPISection;
