
import React, { useMemo, useState } from 'react';
import { WorkOrder } from '../types';
import { excelDateToJSDate } from '../utils';
import { Coins, TrendingUp, Wallet, ArrowUpRight, BarChart3, Wrench, Factory, Filter, CalendarDays, Loader2, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';

interface CostAnalysisPageProps {
  workOrders: WorkOrder[];
}

const COLORS = ['#059669', '#0284c7', '#d97706', '#e11d48', '#7c3aed', '#db2777'];

export const CostAnalysisPage: React.FC<CostAnalysisPageProps> = ({ workOrders }) => {
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(false);

  // --- 1. DATA ENRICHMENT & CALCULATION ---
  // In a real app, costs would come from the DB. Here we simulate them based on WO type and duration if missing.
  const processedData = useMemo(() => {
      const enriched = workOrders.map(wo => {
          let laborCost = wo['Labor Cost'] || 0;
          let materialCost = wo['Material Cost'] || 0;
          let totalCost = wo['Total Cost'] || (laborCost + materialCost);

          // If no cost data exists, SIMULATE IT for demonstration
          if (totalCost === 0) {
              const start = wo['Work order start date/time'] ? excelDateToJSDate(wo['Work order start date/time']) : null;
              const end = wo['Work order end date/time'] ? excelDateToJSDate(wo['Work order end date/time']) : null;
              
              let durationHours = 2; // Default
              if (start && end && !isNaN(start.getTime()) && !isNaN(end.getTime())) {
                  durationHours = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
              }

              const isBreakdown = (wo['WO Activity type Activity type code'] || '').toLowerCase().includes('arıza') || String(wo['Asset out of order?'] || '').toLowerCase() === 'true';
              
              // Simulated Rates
              const hourlyRate = 650; // TL
              laborCost = durationHours * hourlyRate;
              materialCost = isBreakdown ? Math.random() * 5000 + 1000 : Math.random() * 500; // Breakdowns are expensive
              totalCost = laborCost + materialCost;
          }

          return { ...wo, _labor: laborCost, _material: materialCost, _total: totalCost };
      });
      return enriched;
  }, [workOrders]);

  const filteredData = useMemo(() => {
      return processedData.filter(wo => {
          if (!wo['Work order start date/time']) return false;
          const d = excelDateToJSDate(wo['Work order start date/time']);
          return !isNaN(d.getTime()) && d.getFullYear().toString() === selectedYear;
      });
  }, [processedData, selectedYear]);

  // --- 2. AGGREGATIONS ---
  const totalSpend = filteredData.reduce((acc, curr) => acc + curr._total, 0);
  const totalLabor = filteredData.reduce((acc, curr) => acc + curr._labor, 0);
  const totalMaterial = filteredData.reduce((acc, curr) => acc + curr._material, 0);
  const avgCostPerWO = filteredData.length > 0 ? totalSpend / filteredData.length : 0;

  const monthlyTrend = useMemo(() => {
      const agg: Record<number, number> = {};
      filteredData.forEach(wo => {
          const d = excelDateToJSDate(wo['Work order start date/time']);
          const month = d.getMonth();
          agg[month] = (agg[month] || 0) + wo._total;
      });
      return Array.from({ length: 12 }, (_, i) => ({
          name: new Date(2024, i, 1).toLocaleDateString('tr-TR', { month: 'short' }),
          tutar: Math.round(agg[i] || 0)
      }));
  }, [filteredData]);

  const costByType = useMemo(() => {
      const agg: Record<string, number> = {};
      filteredData.forEach(wo => {
          const type = wo['WO Activity type Activity type code'] || 'Diğer';
          agg[type] = (agg[type] || 0) + wo._total;
      });
      return Object.entries(agg)
          .map(([name, value]) => ({ name, value: Math.round(value) }))
          .sort((a,b) => b.value - a.value);
  }, [filteredData]);

  const topAssets = useMemo(() => {
      const agg: Record<string, number> = {};
      filteredData.forEach(wo => {
          const asset = wo['Asset Name'] || 'Genel';
          agg[asset] = (agg[asset] || 0) + wo._total;
      });
      return Object.entries(agg)
          .map(([name, value]) => ({ name, value: Math.round(value) }))
          .sort((a,b) => b.value - a.value)
          .slice(0, 5);
  }, [filteredData]);

  const availableYears = useMemo(() => {
      const years = new Set<number>(processedData.map(wo => {
          if (!wo['Work order start date/time']) return new Date().getFullYear();
          const d = excelDateToJSDate(wo['Work order start date/time']);
          return isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
      }));
      return Array.from(years).sort((a,b) => b-a);
  }, [processedData]);

  const formatCurrency = (val: number) => {
      return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="flex flex-col h-full animate-in w-full max-w-[1920px] mx-auto overflow-hidden bg-slate-50">
        <div className="bg-white px-6 md:px-10 py-6 border-b border-slate-200 flex flex-col md:flex-row justify-between md:items-center gap-6 shrink-0">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600 border border-emerald-100 shadow-sm">
                    <Coins className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Maliyet Analizi</h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Bütçe & Harcama Yönetimi</p>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                    <CalendarDays className="w-4 h-4 text-slate-400 ml-2" />
                    <select 
                        value={selectedYear} 
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className="bg-transparent text-xs font-black text-slate-700 outline-none p-1"
                    >
                        {availableYears.map(y => <option key={y} value={y.toString()}>{y}</option>)}
                    </select>
                </div>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scroll p-6 md:p-10 space-y-8">
            
            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-5"><Coins className="w-24 h-24 text-emerald-600" /></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">TOPLAM HARCAMA (YTD)</p>
                    <h3 className="text-3xl font-black text-slate-900">{formatCurrency(totalSpend)}</h3>
                    <div className="flex items-center gap-1 mt-4 text-xs font-bold text-emerald-600 bg-emerald-50 w-fit px-2 py-1 rounded-lg">
                        <TrendingUp className="w-3 h-3" /> Veri Tahmini
                    </div>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-5"><Wrench className="w-24 h-24 text-blue-600" /></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">İŞÇİLİK MALİYETİ</p>
                    <h3 className="text-3xl font-black text-slate-900">{formatCurrency(totalLabor)}</h3>
                    <p className="text-xs font-medium text-slate-400 mt-2">% {Math.round((totalLabor/totalSpend)*100)} Toplam Pay</p>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-5"><Factory className="w-24 h-24 text-amber-600" /></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">YEDEK PARÇA / MALZEME</p>
                    <h3 className="text-3xl font-black text-slate-900">{formatCurrency(totalMaterial)}</h3>
                    <p className="text-xs font-medium text-slate-400 mt-2">% {Math.round((totalMaterial/totalSpend)*100)} Toplam Pay</p>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-5"><Wallet className="w-24 h-24 text-purple-600" /></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">ORTALAMA İŞ EMRİ MALİYETİ</p>
                    <h3 className="text-3xl font-black text-slate-900">{formatCurrency(avgCostPerWO)}</h3>
                    <p className="text-xs font-medium text-slate-400 mt-2">{filteredData.length} Kayıt Üzerinden</p>
                </div>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm h-[400px] flex flex-col">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600"><BarChart3 className="w-5 h-5" /></div>
                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Aylık Harcama Trendi</h4>
                    </div>
                    <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyTrend}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} axisLine={false} tickLine={false} dy={10} />
                                <YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} axisLine={false} tickLine={false} tickFormatter={(val) => `₺${val/1000}k`} />
                                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border:'none', boxShadow:'0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                                <Bar dataKey="tutar" fill="#10b981" radius={[6, 6, 0, 0]} barSize={32} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm h-[400px] flex flex-col">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-blue-50 rounded-xl text-blue-600"><Wrench className="w-5 h-5" /></div>
                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Aktivite Bazlı Maliyet</h4>
                    </div>
                    <div className="flex-1 min-h-0 flex items-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={costByType} cx="50%" cy="50%" innerRadius={60} outerRadius={100} fill="#8884d8" paddingAngle={5} dataKey="value">
                                    {costByType.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{fontSize: '11px', fontWeight: 700}} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Top Spenders List */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 bg-rose-50 rounded-xl text-rose-600"><AlertTriangle className="w-5 h-5" /></div>
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">En Yüksek Maliyetli 5 Varlık</h4>
                </div>
                <div className="space-y-4">
                    {topAssets.map((asset, idx) => (
                        <div key={idx} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 group hover:border-rose-200 hover:bg-rose-50/30 transition-all">
                            <span className="w-8 h-8 flex items-center justify-center bg-white rounded-xl text-xs font-black text-slate-400 shadow-sm border border-slate-100">{idx + 1}</span>
                            <div className="flex-1">
                                <h5 className="text-sm font-bold text-slate-800">{asset.name}</h5>
                                <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                                    <div className="h-full bg-rose-500 rounded-full" style={{ width: `${(asset.value / topAssets[0].value) * 100}%` }}></div>
                                </div>
                            </div>
                            <span className="text-sm font-black text-rose-600">{formatCurrency(asset.value)}</span>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    </div>
  );
};
