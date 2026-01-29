
import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid, AreaChart, Area } from 'recharts';
import { WorkOrder } from '../types';
import { excelDateToJSDate } from '../utils';
import { PieChart as PieIcon, Activity, CheckCircle2, TrendingUp, CalendarRange, Timer, Gauge, ListChecks, TimerOff } from 'lucide-react';

interface ChartsSectionProps {
  data: WorkOrder[];
}

const COLORS = ['#0284c7', '#059669', '#d97706', '#e11d48', '#0891b2', '#7c3aed', '#db2777', '#475569'];

type TimeView = 'daily' | 'monthly' | 'yearly';

const ChartsSection: React.FC<ChartsSectionProps> = ({ data }) => {
  const [timeView, setTimeView] = useState<TimeView>('monthly');

  const isClosed = (status: any) => {
      const s = String(status || '').toLowerCase().trim();
      return s.includes('closed') || s.includes('clsd') || s.includes('teco') || s.includes('comp') || s.includes('kapa') || s.includes('bitti') || s.includes('tamam');
  };

  const getLocalDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const mttrData = useMemo(() => {
      const agg: Record<string, { label: string, totalDays: number, count: number, sortKey: number }> = {};
      
      data.forEach(d => {
          if (isClosed(d['Status code']) && d['Work order start date/time'] && d['Work order end date/time']) {
              const start = excelDateToJSDate(d['Work order start date/time']);
              const end = excelDateToJSDate(d['Work order end date/time']);
              
              if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                  const diffDays = Math.max(0.1, (end.getTime() - start.getTime()) / (1000 * 3600 * 24));
                  let key = '';
                  let label = '';
                  let sortKey = 0;

                  if (timeView === 'monthly') {
                      key = `${start.getFullYear()}-${start.getMonth()}`;
                      label = start.toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' });
                      sortKey = new Date(start.getFullYear(), start.getMonth(), 1).getTime();
                  } else {
                      key = start.getFullYear().toString();
                      label = key;
                      sortKey = start.getFullYear();
                  }

                  if (!agg[key]) agg[key] = { label, totalDays: 0, count: 0, sortKey };
                  agg[key].totalDays += diffDays;
                  agg[key].count += 1;
              }
          }
      });

      return Object.values(agg)
          .map(item => ({
              label: item.label,
              days: parseFloat((item.totalDays / item.count).toFixed(1)),
              sortKey: item.sortKey
          }))
          .sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));
  }, [data, timeView]);

  const downtimeTrendData = useMemo(() => {
      const agg: Record<string, { label: string, hours: number, sortKey: number }> = {};
      
      data.forEach(d => {
          // Check if explicit downtime
          const isDowntime = String(d['Asset out of order?'] || '').toLowerCase();
          const isExplicit = isDowntime === 'true' || isDowntime === 'doğru' || isDowntime === '1' || isDowntime === 'evet';
          
          if (isExplicit && d['Work order start date/time']) {
              const start = excelDateToJSDate(d['Work order start date/time']);
              // Use end date if available, otherwise assume it's still ongoing (use now) for calculation purposes
              const end = d['Work order end date/time'] ? excelDateToJSDate(d['Work order end date/time']) : new Date();
              
              if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                  // Calculate duration in hours
                  const durationHours = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
                  
                  let key = '';
                  let label = '';
                  let sortKey = 0;

                  if (timeView === 'daily') {
                      key = getLocalDateKey(start);
                      label = start.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
                      sortKey = start.getTime();
                  } else if (timeView === 'monthly') {
                      key = `${start.getFullYear()}-${start.getMonth()}`;
                      label = start.toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' });
                      sortKey = new Date(start.getFullYear(), start.getMonth(), 1).getTime();
                  } else {
                      key = start.getFullYear().toString();
                      label = key;
                      sortKey = start.getFullYear();
                  }

                  if (!agg[key]) agg[key] = { label, hours: 0, sortKey };
                  agg[key].hours += durationHours;
              }
          }
      });

      return Object.values(agg)
          .map(item => ({
              label: item.label,
              hours: Math.round(item.hours), // Round to integer for cleaner charts
              sortKey: item.sortKey
          }))
          .sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));
  }, [data, timeView]);

  const performanceData = useMemo(() => {
      const agg: Record<string, { label: string, opened: number, closed: number, sortKey: number }> = {};
      data.forEach(d => {
          if (d['Work order start date/time']) {
            const startDate = excelDateToJSDate(d['Work order start date/time']);
            if (!isNaN(startDate.getTime())) {
                let key = '';
                let label = '';
                let sortKey = 0;
                if (timeView === 'daily') {
                    key = getLocalDateKey(startDate);
                    label = startDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
                    sortKey = startDate.getTime();
                } else if (timeView === 'monthly') {
                    key = `${startDate.getFullYear()}-${startDate.getMonth()}`;
                    label = startDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
                    sortKey = new Date(startDate.getFullYear(), startDate.getMonth(), 1).getTime();
                } else {
                    key = startDate.getFullYear().toString();
                    label = key;
                    sortKey = startDate.getFullYear();
                }
                if (!agg[key]) agg[key] = { label, opened: 0, closed: 0, sortKey };
                agg[key].opened += 1;
            }
          }
          if (isClosed(d['Status code'])) {
            const rawCloseDate = d['Work order end date/time'] || d['Work order start date/time'];
            if (rawCloseDate) {
                const closeDate = excelDateToJSDate(rawCloseDate);
                if (!isNaN(closeDate.getTime())) {
                    let key = (timeView === 'daily') ? getLocalDateKey(closeDate) : (timeView === 'monthly') ? `${closeDate.getFullYear()}-${closeDate.getMonth()}` : closeDate.getFullYear().toString();
                    if (!agg[key]) {
                        let label = (timeView === 'daily') ? closeDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) : (timeView === 'monthly') ? closeDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }) : closeDate.getFullYear().toString();
                        agg[key] = { label, opened: 0, closed: 0, sortKey: closeDate.getTime() };
                    }
                    agg[key].closed += 1;
                }
            }
          }
      });
      return Object.values(agg).sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0));
  }, [data, timeView]);

  const statusDistributionData = useMemo(() => {
    const agg = data.reduce((acc, curr) => {
        const status = curr['Status code'] || 'Tanımsız';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return Object.entries(agg).map(([name, value]) => ({ name, value }))
        .sort((a, b) => (b.value < a.value ? -1 : b.value > a.value ? 1 : 0));
  }, [data]);

  const activityTypeDistributionData = useMemo(() => {
    const agg = data.reduce((acc, curr) => {
        const type = curr['WO Activity type Activity type code'] || 'Genel';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return Object.entries(agg).map(([name, value]) => ({ name, value }))
        .sort((a, b) => (b.value < a.value ? -1 : b.value > a.value ? 1 : 0));
  }, [data]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const name = payload[0].name; // For Pie charts, the label is in 'name'
      return (
        <div className="bg-white p-4 border border-slate-100 shadow-2xl rounded-2xl z-50">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-50 pb-1">{label || name}</p>
          {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center gap-3 text-xs font-black mb-1" style={{ color: entry.color || entry.payload.fill }}>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color || entry.payload.fill }}></div>
                  <span>{entry.name}: {entry.value}</span>
              </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 w-full pb-12">
        {/* Performance & MTTR Row */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div className="bg-white p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-slate-200 shadow-sm">
                <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 border border-indigo-100"><Gauge className="w-6 h-6" /></div>
                        <div>
                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">İş Gücü Performansı</h4>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Açılan vs Biten</p>
                        </div>
                    </div>
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-full sm:w-auto">
                        {(['daily', 'monthly'] as const).map(v => (
                            <button key={v} onClick={() => setTimeView(v)} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] font-black transition-all uppercase tracking-widest ${timeView === v ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                                {v === 'daily' ? 'GÜNLÜK' : 'AYLIK'}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="h-[300px] md:h-[350px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={performanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 800 }} axisLine={false} tickLine={false} dy={10} />
                            <YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 800 }} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                            <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }} />
                            <Bar dataKey="opened" name="Yeni Kayıt" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={25} />
                            <Bar dataKey="closed" name="Kapatılan" fill="#10b981" radius={[6, 6, 0, 0]} barSize={25} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
            <div className="bg-white p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-amber-50 rounded-2xl text-amber-600 border border-amber-100"><Timer className="w-6 h-6" /></div>
                    <div>
                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Onarım Süresi (MTTR)</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Ortalama Kapanış Günü</p>
                    </div>
                </div>
                <div className="h-[300px] md:h-[350px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={mttrData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorDays" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/>
                                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 800 }} axisLine={false} tickLine={false} dy={10} />
                            <YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 800 }} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area type="monotone" dataKey="days" name="Ort. Gün" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorDays)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
        
        {/* Pie Charts Row */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div className="bg-white p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-cyan-50 rounded-2xl text-cyan-600 border border-cyan-100"><PieIcon className="w-6 h-6" /></div>
                    <div>
                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Durum Dağılımı</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">İş Emri Durumlarına Göre</p>
                    </div>
                </div>
                <div className="h-[300px] md:h-[350px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={statusDistributionData} cx="50%" cy="50%" labelLine={false} outerRadius={100} fill="#8884d8" dataKey="value" nameKey="name">
                                {statusDistributionData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
            <div className="bg-white p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-purple-50 rounded-2xl text-purple-600 border border-purple-100"><ListChecks className="w-6 h-6" /></div>
                    <div>
                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Aktivite Tipi Dağılımı</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Bakım Türlerine Göre</p>
                    </div>
                </div>
                <div className="h-[300px] md:h-[350px] w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={activityTypeDistributionData} cx="50%" cy="50%" labelLine={false} outerRadius={100} fill="#8884d8" dataKey="value" nameKey="name">
                                {activityTypeDistributionData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase' }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>

        {/* Downtime Trend Chart */}
        <div className="bg-white p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-rose-50 rounded-2xl text-rose-600 border border-rose-100"><TimerOff className="w-6 h-6" /></div>
                <div>
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Duruş Süresi Analizi</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Toplam Kayıp Zaman (Saat)</p>
                </div>
            </div>
            <div className="h-[300px] md:h-[350px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={downtimeTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorDowntime" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#e11d48" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#e11d48" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 800 }} axisLine={false} tickLine={false} dy={10} />
                        <YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 800 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="hours" name="Duruş (Saat)" stroke="#e11d48" strokeWidth={3} fillOpacity={1} fill="url(#colorDowntime)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    </div>
  );
};

export default ChartsSection;
