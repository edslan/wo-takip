
import React, { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, Activity, Database, Zap, Server, Settings, AlertTriangle, TrendingUp, DollarSign } from 'lucide-react';
import { getUsageStats, getHistoricalUsageStats } from '../services/usageService';
import { SystemUsageStats, QuotaConfig } from '../types';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const DEFAULT_QUOTAS: QuotaConfig = {
    aiDailyLimit: 100, // Free tier rough estimate or budget limit
    dbReadLimit: 50000, // Firebase free tier
    dbWriteLimit: 20000 // Firebase free tier
};

const Gauge = ({ value, max, label, colorClass, icon: Icon }: any) => {
    const percentage = Math.min(100, (value / max) * 100);
    const isCritical = percentage > 80;
    
    return (
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col items-center text-center relative overflow-hidden">
            <div className={`absolute top-0 left-0 h-1.5 w-full bg-slate-100`}>
                <div className={`h-full transition-all duration-1000 ${colorClass}`} style={{ width: `${percentage}%` }}></div>
            </div>
            <div className={`p-4 rounded-full mb-4 ${colorClass.replace('bg-', 'bg-opacity-10 text-').replace('500', '600')}`}>
                <Icon className="w-8 h-8" />
            </div>
            <h3 className="text-3xl font-black text-slate-900 mb-1">{value.toLocaleString()}</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">{label}</p>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-1000 ${colorClass}`} style={{ width: `${percentage}%` }}></div>
            </div>
            <p className="text-[10px] font-bold text-slate-400 mt-2 flex justify-between w-full">
                <span>0</span>
                <span className={isCritical ? 'text-rose-500' : 'text-slate-400'}>{Math.round(percentage)}%</span>
                <span>{max.toLocaleString()}</span>
            </p>
        </div>
    );
};

export const AdminPage: React.FC = () => {
    const [stats, setStats] = useState<SystemUsageStats | null>(null);
    const [historicalStats, setHistoricalStats] = useState<SystemUsageStats[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();
        // Refresh every 30 seconds
        const interval = setInterval(loadStats, 30000);
        return () => clearInterval(interval);
    }, []);

    const loadStats = async () => {
        const [data, historical] = await Promise.all([
            getUsageStats(),
            getHistoricalUsageStats(7)
        ]);
        setStats(data);
        setHistoricalStats(historical);
        setLoading(false);
    };

    if (loading || !stats) return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div></div>;

    const aiUsagePercent = (stats.aiRequests / DEFAULT_QUOTAS.aiDailyLimit) * 100;
    const dbUsagePercent = (stats.dbReads / DEFAULT_QUOTAS.dbReadLimit) * 100;
    
    // Determine Safety Zone
    let safetyStatus: 'SAFE' | 'WARNING' | 'CRITICAL' = 'SAFE';
    if (aiUsagePercent > 90 || dbUsagePercent > 90) safetyStatus = 'CRITICAL';
    else if (aiUsagePercent > 70 || dbUsagePercent > 70) safetyStatus = 'WARNING';

    return (
        <div className="flex flex-col h-full animate-in w-full max-w-[1920px] mx-auto overflow-hidden bg-slate-50">
            {/* Header */}
            <div className="bg-white px-6 md:px-10 py-6 border-b border-slate-200 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-900 rounded-2xl text-white shadow-lg shadow-slate-200">
                        <Settings className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Sistem Yönetimi</h2>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Kota Takibi & Sağlık Durumu</p>
                    </div>
                </div>
                <div className={`px-6 py-3 rounded-xl border flex items-center gap-3 shadow-sm ${
                    safetyStatus === 'SAFE' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                    safetyStatus === 'WARNING' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                    'bg-rose-50 border-rose-200 text-rose-700'
                }`}>
                    {safetyStatus === 'SAFE' ? <ShieldCheck className="w-5 h-5" /> : safetyStatus === 'WARNING' ? <AlertTriangle className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest">SİSTEM DURUMU</span>
                        <span className="text-sm font-black">{safetyStatus === 'SAFE' ? 'GÜVENLİ BÖLGE' : safetyStatus === 'WARNING' ? 'DİKKAT GEREKTİRİR' : 'RİSKLİ BÖLGE'}</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scroll p-6 md:p-10 space-y-8">
                
                {/* Main Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Gauge 
                        value={stats.aiRequests} 
                        max={DEFAULT_QUOTAS.aiDailyLimit} 
                        label="GÜNLÜK AI SORGU" 
                        colorClass="bg-violet-500" 
                        icon={Zap}
                    />
                    <Gauge 
                        value={stats.dbReads} 
                        max={DEFAULT_QUOTAS.dbReadLimit} 
                        label="VERİTABANI OKUMA" 
                        colorClass="bg-blue-500" 
                        icon={Database}
                    />
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-center relative overflow-hidden">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
                                <DollarSign className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-slate-500 uppercase tracking-widest">TAHMİNİ MALİYET</h4>
                                <p className="text-3xl font-black text-slate-900">${stats.estimatedCost.toFixed(4)}</p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between text-xs font-bold text-slate-500">
                                <span>Veri Yazma</span>
                                <span>{stats.dbWrites} / {DEFAULT_QUOTAS.dbWriteLimit}</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500" style={{ width: `${(stats.dbWrites / DEFAULT_QUOTAS.dbWriteLimit) * 100}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Analysis Section */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <Activity className="w-5 h-5 text-slate-400" />
                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Kullanım Analizi & Öneriler</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <div className={`p-4 rounded-2xl border ${safetyStatus === 'SAFE' ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                                <h4 className={`text-xs font-black uppercase tracking-widest mb-2 ${safetyStatus === 'SAFE' ? 'text-emerald-700' : 'text-amber-700'}`}>
                                    AI ENTEGRASYON DURUMU
                                </h4>
                                <p className="text-sm font-medium text-slate-700 leading-relaxed">
                                    {safetyStatus === 'SAFE' 
                                        ? "Sistem şu anda güvenli sınırlar içerisinde çalışıyor. AI sorgu hacmi bütçe dostu seviyede. Günlük operasyonlara kesintisiz devam edebilirsiniz."
                                        : "AI sorgu limitlerine yaklaşıyorsunuz. Gereksiz analizleri azaltarak veya raporları toplu işleyerek kotanızı koruyabilirsiniz."}
                                </p>
                            </div>
                            <div className="p-4 rounded-2xl border bg-slate-50 border-slate-100">
                                <h4 className="text-xs font-black uppercase tracking-widest mb-2 text-slate-500">
                                    VERİTABANI OPTİMİZASYONU
                                </h4>
                                <ul className="space-y-2 text-sm font-bold text-slate-600">
                                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Okuma İşlemleri: {stats.dbReads < 1000 ? 'Düşük (İyi)' : 'Yüksek'}</li>
                                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Yazma İşlemleri: {stats.dbWrites < 500 ? 'Normal' : 'Yoğun'}</li>
                                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-violet-500"></div> Depolama: Optimize Edildi</li>
                                </ul>
                            </div>
                        </div>

                        {/* Historical Usage Trend */}
                        <div className="bg-slate-50 rounded-2xl p-6 flex flex-col">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">7 GÜNLÜK AKTİVİTE TRENDİ</h4>
                            <div className="flex-1 min-h-[150px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={historicalStats.map(s => ({
                                        name: new Date(s.date).toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric' }),
                                        val: s.aiRequests
                                    }))}>
                                        <defs>
                                            <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="name" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                                        <Tooltip contentStyle={{borderRadius: '12px', border: 'none'}} />
                                        <Area type="monotone" dataKey="val" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
