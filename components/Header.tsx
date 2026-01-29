
import React, { useState, useEffect, useRef } from 'react';
import { Layers, Bell, Printer, Trash2, PlusCircle, CheckCircle2, LayoutDashboard, CheckSquare, NotebookPen, LogOut, AlertTriangle, CalendarDays, ChevronDown, PieChart, Calendar as CalendarIcon, Settings, X, Plus, ClipboardList, Inbox, Sparkles, Factory, Zap, TimerOff, Coins, BookOpenCheck, ShieldCheck } from 'lucide-react';
import { WorkOrder, ViewMode, SmartAlertRule } from '../types';
import { formatFullDate, excelDateToJSDate } from '../utils';

interface HeaderProps {
  onFileUpload: (file: File) => void;
  onExportPDF: () => void;
  onExportExcel: () => void;
  rawData: WorkOrder[];
  onOpenAlert: (code: string) => void;
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  userEmail?: string | null;
  onLogout?: () => void;
  onResetData: () => void;
}

const NAV_ITEMS: { id: ViewMode; label: string; icon: any }[] = [
    { id: 'dashboard', label: 'Genel', icon: LayoutDashboard },
    { id: 'solutions', label: 'Çözümler', icon: BookOpenCheck }, // Replaced Cost
    { id: 'downtime', label: 'Arıza Raporu', icon: TimerOff },
    { id: 'assets', label: 'Varlıklar', icon: Factory },
    { id: 'predictive', label: 'Proaktif', icon: Zap },
    { id: 'calendar', label: 'Takvim', icon: CalendarIcon },
    { id: 'charts', label: 'Grafikler', icon: PieChart },
    { id: 'todo', label: 'Görevler', icon: CheckSquare },
    { id: 'shifts', label: 'Vardiya', icon: ClipboardList },
];

const Header: React.FC<HeaderProps> = ({ 
    onFileUpload, 
    onExportPDF, 
    onExportExcel, 
    rawData, 
    onOpenAlert,
    currentView,
    onViewChange,
    userEmail,
    onLogout,
    onResetData
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSmartAlertsModal, setShowSmartAlertsModal] = useState(false);
  
  // Standard Alerts
  const [overdueAlerts, setOverdueAlerts] = useState<WorkOrder[]>([]);
  const [weeklyAlerts, setWeeklyAlerts] = useState<WorkOrder[]>([]);
  // Smart Custom Alerts
  const [smartMatches, setSmartMatches] = useState<{ruleName: string, items: WorkOrder[]}[]>([]);
  const [customRules, setCustomRules] = useState<SmartAlertRule[]>(() => {
      const saved = localStorage.getItem('smart_alert_rules');
      return saved ? JSON.parse(saved) : [];
  });

  // Rule Form State
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleStatus, setNewRuleStatus] = useState('');
  const [newRuleDays, setNewRuleDays] = useState('3');

  const [acceptedAlerts, setAcceptedAlerts] = useState<string[]>(() => {
    const saved = localStorage.getItem('accepted_alerts');
    return saved ? JSON.parse(saved) : [];
  });

  // Distinct Statuses for Rule Creation
  const availableStatuses = React.useMemo(() => {
     return Array.from(new Set(rawData.map(d => d['Status code']))).sort();
  }, [rawData]);

  const isPreventive = (type?: string) => {
      const t = (type || '').toLowerCase();
      return t.includes('preventive') || t.includes('periyodik') || t.includes('kontrol') || t.includes('bakım') || t.includes('pm') || t.includes('control');
  };

  useEffect(() => {
    if (rawData.length === 0) {
        setOverdueAlerts([]);
        setWeeklyAlerts([]);
        setSmartMatches([]);
        return;
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(today.getDate() + 7);

    const overdue: WorkOrder[] = [];
    const thisWeek: WorkOrder[] = [];

    // 1. Process Standard Alerts
    rawData.forEach(d => {
        if (acceptedAlerts.includes(d['Work order code'])) return;

        const status = String(d['Status code'] || '').toLowerCase();
        const isOpen = !status.includes('closed') && !status.includes('cancel');
        const activityType = d['WO Activity type Activity type code'];
        
        if (isOpen && d['Work order start date/time']) {
            const startDate = excelDateToJSDate(d['Work order start date/time']);
            const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
            
            if (isPreventive(activityType)) {
                 if (startDateOnly < today) {
                    overdue.push(d);
                } else if (startDateOnly >= today && startDateOnly <= sevenDaysLater) {
                    thisWeek.push(d);
                }
            }
        }
    });

    setOverdueAlerts(overdue);
    setWeeklyAlerts(thisWeek);

    // 2. Process Smart Alerts
    const matches: {ruleName: string, items: WorkOrder[]}[] = [];
    customRules.forEach(rule => {
        const matchedItems = rawData.filter(d => {
            if (acceptedAlerts.includes(d['Work order code'])) return false;
            
            const isStatusMatch = d['Status code'] === rule.targetStatus;
            let isAgeMatch = false;

            if (d['Work order start date/time']) {
                const start = excelDateToJSDate(d['Work order start date/time']);
                const ageInDays = (now.getTime() - start.getTime()) / (1000 * 3600 * 24);
                if (ageInDays > rule.daysThreshold) isAgeMatch = true;
            }
            return isStatusMatch && isAgeMatch;
        });

        if (matchedItems.length > 0) {
            matches.push({ ruleName: rule.name, items: matchedItems });
        }
    });
    setSmartMatches(matches);

  }, [rawData, acceptedAlerts, customRules]);

  const totalNew = overdueAlerts.length + weeklyAlerts.length + smartMatches.reduce((acc, curr) => acc + curr.items.length, 0);

  const handleAcceptAlert = (code: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const newAccepted = [...acceptedAlerts, code];
      setAcceptedAlerts(newAccepted);
      localStorage.setItem('accepted_alerts', JSON.stringify(newAccepted));
  };

  const handleAcceptAll = () => {
      const allCodes = [
          ...overdueAlerts.map(a => a['Work order code']), 
          ...weeklyAlerts.map(a => a['Work order code']),
          ...smartMatches.flatMap(m => m.items.map(i => i['Work order code']))
      ];
      const newAccepted = [...acceptedAlerts, ...allCodes];
      setAcceptedAlerts(newAccepted);
      localStorage.setItem('accepted_alerts', JSON.stringify(newAccepted));
  };

  const addCustomRule = () => {
      if (!newRuleName || !newRuleStatus) return;
      const newRule: SmartAlertRule = {
          id: Date.now().toString(),
          name: newRuleName,
          targetStatus: newRuleStatus,
          daysThreshold: parseInt(newRuleDays) || 0
      };
      const updated = [...customRules, newRule];
      setCustomRules(updated);
      localStorage.setItem('smart_alert_rules', JSON.stringify(updated));
      setNewRuleName('');
  };

  const deleteRule = (id: string) => {
      const updated = customRules.filter(r => r.id !== id);
      setCustomRules(updated);
      localStorage.setItem('smart_alert_rules', JSON.stringify(updated));
  };

  return (
    <>
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 shadow-sm transition-all duration-300">
      {/* Top Bar */}
      <div className="w-full px-4 md:px-6 h-16 flex justify-between items-center max-w-[1920px] mx-auto">
        
        {/* Logo & Navigation (Desktop) */}
        <div className="flex items-center gap-4 md:gap-8">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-brand-700 rounded-lg flex items-center justify-center text-white shrink-0">
                    <Layers className="w-5 h-5" />
                </div>
                <div className="hidden md:block">
                    <h1 className="text-sm font-bold text-slate-900 leading-none tracking-tight">WO MANAGER</h1>
                    <p className="text-[10px] text-slate-500 font-medium">Enterprise Edition</p>
                </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden xl:flex items-center gap-1 bg-slate-100/50 p-1 rounded-lg border border-slate-200">
                {NAV_ITEMS.map(item => (
                    <button 
                        key={item.id}
                        onClick={() => onViewChange(item.id)} 
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${currentView === item.id ? 'bg-white text-brand-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'}`}
                    >
                        <item.icon className="w-4 h-4" /> {item.label}
                    </button>
                ))}
            </nav>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 md:gap-3">
            
            {/* Bell Icon */}
            <button 
                onClick={() => setShowNotifications(!showNotifications)} 
                className={`p-2 rounded-xl transition-all relative ${totalNew > 0 ? 'text-brand-600 bg-brand-50 hover:bg-brand-100 ring-1 ring-brand-200' : 'text-slate-500 hover:bg-slate-100'}`}
            >
                <Bell className="w-5 h-5" />
                {totalNew > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white"></span>
                )}
            </button>

            <div className="h-6 w-px bg-slate-200 mx-1 hidden md:block"></div>

            <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls, .csv" onChange={(e) => e.target.files?.[0] && onFileUpload(e.target.files[0])} />
            
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                <PlusCircle className="w-4 h-4 text-slate-500" /> <span className="hidden md:inline">Veri Yükle</span>
            </button>
            
            <div className="ml-2 pl-2 border-l border-slate-200 flex items-center gap-2">
                {/* Global Reset Button - Always Visible */}
                {rawData.length > 0 && (
                    <button 
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onResetData();
                        }}
                        className="flex items-center justify-center w-9 h-9 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 transition-colors border border-rose-100 cursor-pointer"
                        title="Verileri Temizle / Sıfırla"
                    >
                        <Trash2 className="w-4 h-4 pointer-events-none" />
                    </button>
                )}
                
                <button onClick={onLogout} className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors">
                    <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Çıkış</span>
                </button>
            </div>
        </div>
      </div>

      {/* Mobile/Tablet Navigation (Secondary Row) */}
      <div className="xl:hidden w-full overflow-x-auto border-t border-slate-200 bg-slate-50 px-4 py-2 flex items-center gap-2 custom-scroll shadow-inner h-14 no-scrollbar">
           {NAV_ITEMS.map(item => (
                <button 
                    key={item.id}
                    onClick={() => onViewChange(item.id)} 
                    className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-bold transition-all duration-200 whitespace-nowrap active:scale-95 ${
                        currentView === item.id 
                        ? 'bg-white text-brand-700 shadow-sm border border-slate-200 ring-1 ring-black/5' 
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 active:bg-slate-200'
                    }`}
                >
                    <item.icon className="w-3.5 h-3.5" /> {item.label}
                </button>
            ))}
      </div>
    </header>

    {/* Notification Panel Overlay */}
    {showNotifications && (
        <>
            <div className="fixed inset-0 z-[60] bg-slate-900/20 backdrop-blur-sm animate-in fade-in" onClick={() => setShowNotifications(false)} />
            <div className="fixed top-20 right-4 w-[calc(100vw-2rem)] md:w-[450px] max-h-[80vh] bg-white rounded-[1.5rem] shadow-2xl border border-slate-200 z-[70] overflow-hidden flex flex-col animate-in slide-in-from-top-4 duration-300">
                
                {/* Panel Header */}
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded-xl text-slate-500">
                            <Bell className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Bildirim Merkezi</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{totalNew} Yeni Uyarı</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {totalNew > 0 && (
                            <button onClick={handleAcceptAll} className="px-3 py-1.5 bg-brand-50 text-brand-600 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-brand-100 transition-colors mr-2">
                                Tümünü Oku
                            </button>
                        )}
                        <button onClick={() => { setShowSmartAlertsModal(true); setShowNotifications(false); }} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-slate-50 rounded-lg transition-all" title="Kuralları Yönet">
                            <Settings className="w-5 h-5" />
                        </button>
                        <button onClick={() => setShowNotifications(false)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Notification List */}
                <div className="flex-1 overflow-y-auto custom-scroll p-4 space-y-3 bg-slate-50/50">
                    {totalNew === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center">
                            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-300">
                                <Inbox className="w-10 h-10" />
                            </div>
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Tüm bildirimler okundu</p>
                        </div>
                    ) : (
                        <>
                            {/* Smart Matches */}
                            {smartMatches.map(group => group.items.map(item => (
                                    <div key={item['Work order code']} className="bg-white p-4 rounded-2xl border border-purple-100 shadow-sm hover:shadow-md transition-all cursor-pointer flex gap-4 relative group" onClick={() => { onOpenAlert(item['Work order code']); setShowNotifications(false); }}>
                                        <div className="w-1.5 absolute left-0 top-4 bottom-4 bg-purple-500 rounded-r-full"></div>
                                        <div className="p-2.5 bg-purple-50 rounded-xl text-purple-600 h-fit shrink-0">
                                            <Sparkles className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="text-[10px] font-black text-purple-600 bg-purple-50 px-2 py-0.5 rounded uppercase tracking-wider">AKILLI KURAL</span>
                                                <span className="text-[9px] font-bold text-slate-400">{formatFullDate(item['Work order start date/time']).split(' ')[0]}</span>
                                            </div>
                                            <p className="text-xs font-bold text-slate-800 leading-snug line-clamp-2">{item['Work order name']}</p>
                                            <p className="text-[10px] text-slate-500 font-medium mt-1">Kural: {group.ruleName}</p>
                                        </div>
                                        <button onClick={(e) => handleAcceptAlert(item['Work order code'], e)} className="p-2 text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all self-center">
                                            <CheckCircle2 className="w-6 h-6" />
                                        </button>
                                </div>
                            )))}

                            {/* Overdue Alerts */}
                            {overdueAlerts.map(alert => (
                                <div key={alert['Work order code']} className="bg-white p-4 rounded-2xl border border-rose-100 shadow-sm hover:shadow-md transition-all cursor-pointer flex gap-4 relative group" onClick={() => { onOpenAlert(alert['Work order code']); setShowNotifications(false); }}>
                                    <div className="w-1.5 absolute left-0 top-4 bottom-4 bg-rose-500 rounded-r-full"></div>
                                    <div className="p-2.5 bg-rose-50 rounded-xl text-rose-500 h-fit shrink-0">
                                        <AlertTriangle className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded uppercase tracking-wider">GECİKEN İŞ</span>
                                            <span className="text-[9px] font-bold text-rose-400">{formatFullDate(alert['Work order start date/time']).split(' ')[0]}</span>
                                        </div>
                                        <p className="text-xs font-bold text-slate-800 leading-snug line-clamp-2">{alert['Work order name']}</p>
                                        <p className="text-[10px] text-slate-500 font-medium mt-1 truncate">{alert['Asset Name'] || 'Genel Varlık'}</p>
                                    </div>
                                    <button onClick={(e) => handleAcceptAlert(alert['Work order code'], e)} className="p-2 text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all self-center">
                                        <CheckCircle2 className="w-6 h-6" />
                                    </button>
                                </div>
                            ))}

                            {/* Weekly Alerts */}
                            {weeklyAlerts.map(alert => (
                                <div key={alert['Work order code']} className="bg-white p-4 rounded-2xl border border-blue-100 shadow-sm hover:shadow-md transition-all cursor-pointer flex gap-4 relative group" onClick={() => { onOpenAlert(alert['Work order code']); setShowNotifications(false); }}>
                                    <div className="w-1.5 absolute left-0 top-4 bottom-4 bg-blue-500 rounded-r-full"></div>
                                    <div className="p-2.5 bg-blue-50 rounded-xl text-blue-500 h-fit shrink-0">
                                        <CalendarDays className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-wider">BU HAFTA</span>
                                            <span className="text-[9px] font-bold text-slate-400">{formatFullDate(alert['Work order start date/time']).split(' ')[0]}</span>
                                        </div>
                                        <p className="text-xs font-bold text-slate-800 leading-snug line-clamp-2">{alert['Work order name']}</p>
                                        <p className="text-[10px] text-slate-500 font-medium mt-1 truncate">{alert['Asset Name'] || 'Genel Varlık'}</p>
                                    </div>
                                    <button onClick={(e) => handleAcceptAlert(alert['Work order code'], e)} className="p-2 text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all self-center">
                                        <CheckCircle2 className="w-6 h-6" />
                                    </button>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>
        </>
    )}

    {/* Smart Alerts Modal (Settings) */}
    {showSmartAlertsModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-purple-100 rounded-xl text-purple-600 shadow-sm"><Sparkles className="w-6 h-6" /></div>
                        <div>
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Akıllı Kurallar</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Özel Bildirim Senaryoları</p>
                        </div>
                    </div>
                    <button onClick={() => setShowSmartAlertsModal(false)} className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                
                <div className="p-6 space-y-8 flex-1 overflow-y-auto custom-scroll bg-slate-50/50">
                    {/* Create New Rule */}
                    <div className="space-y-4 bg-white p-5 rounded-[1.5rem] border border-slate-200 shadow-sm">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">YENİ KURAL EKLE</span>
                        <div className="space-y-3">
                            <input 
                                type="text" 
                                placeholder="Kural Adı (Örn: Uzun Süren Onaylar)" 
                                value={newRuleName}
                                onChange={e => setNewRuleName(e.target.value)}
                                className="w-full p-3 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-purple-500/20 transition-all placeholder:text-slate-400"
                            />
                            <div className="flex gap-3">
                                <div className="relative flex-1">
                                    <select 
                                        value={newRuleStatus}
                                        onChange={e => setNewRuleStatus(e.target.value)}
                                        className="w-full p-3 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none appearance-none text-slate-600"
                                    >
                                        <option value="">Hedef Durum Seç</option>
                                        {availableStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                                <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 w-32 border border-transparent focus-within:border-purple-200 transition-colors">
                                    <span className="text-[10px] font-black text-slate-400">&gt;</span>
                                    <input 
                                        type="number" 
                                        placeholder="Gün" 
                                        value={newRuleDays}
                                        onChange={e => setNewRuleDays(e.target.value)}
                                        className="w-full bg-transparent border-none outline-none text-xs font-bold text-center py-3"
                                    />
                                    <span className="text-[10px] font-black text-slate-400">GÜN</span>
                                </div>
                            </div>
                            <button onClick={addCustomRule} disabled={!newRuleName || !newRuleStatus} className="w-full py-3 bg-purple-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-purple-700 disabled:opacity-50 transition-all shadow-lg shadow-purple-100 mt-2">
                                KURALI KAYDET
                            </button>
                        </div>
                    </div>

                    {/* Existing Rules */}
                    <div className="space-y-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">AKTİF KURALLAR ({customRules.length})</span>
                        {customRules.length === 0 ? (
                            <div className="text-center py-8 opacity-40 border-2 border-dashed border-slate-200 rounded-2xl">
                                <p className="text-xs font-bold text-slate-400">Henüz kural eklenmedi.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {customRules.map(rule => (
                                    <div key={rule.id} className="flex justify-between items-center p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-purple-200 transition-colors group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-800 uppercase tracking-tight">{rule.name}</p>
                                                <p className="text-[10px] text-slate-500 font-medium mt-0.5">Durum: <b>{rule.targetStatus}</b>, Süre &gt; <b>{rule.daysThreshold} Gün</b></p>
                                            </div>
                                        </div>
                                        <button onClick={() => deleteRule(rule.id)} className="p-2 bg-slate-50 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )}
    </>
  );
};

export default Header;
