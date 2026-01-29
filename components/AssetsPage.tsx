
import React, { useMemo, useState } from 'react';
import { WorkOrder, AssetItem } from '../types';
import { Factory, Wrench, AlertTriangle, CheckCircle2, TrendingUp, Search, Activity, History, ChevronRight, Trash2, Printer, Loader2 } from 'lucide-react';
import { excelDateToJSDate } from '../utils';
import { generateAssetsReportPDF } from '../services/pdfService';

interface AssetsPageProps {
  assets: AssetItem[];
  workOrders: WorkOrder[];
  onItemClick: (item: WorkOrder) => void;
  onDeleteAsset?: (id: string) => void;
}

interface AssetMetrics {
    id: string;
    name: string;
    totalWOs: number;
    openWOs: number;
    downtimeEvents: number;
    lastMaintenanceDate: Date | null;
    healthScore: number;
    status: 'Operational' | 'Warning' | 'Critical' | 'No Data';
    history: WorkOrder[];
}

const AssetsPage: React.FC<AssetsPageProps> = ({ assets, workOrders, onItemClick, onDeleteAsset }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<AssetMetrics | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const assetMetricsList = useMemo(() => {
      // Create a map of WorkOrders by Asset Name for fast lookup
      const woMap = new Map<string, WorkOrder[]>();
      workOrders.forEach(wo => {
          const name = (wo['Asset Name'] || 'Tanımsız Varlık').trim().toUpperCase();
          if (!woMap.has(name)) woMap.set(name, []);
          woMap.get(name)?.push(wo);
      });

      // Map persistent assets to metrics
      const metrics: AssetMetrics[] = assets.map(asset => {
          const items = woMap.get(asset.name.trim().toUpperCase()) || [];
          
          // Combine Historical + Current Stats
          const historicalTotal = asset.stats?.totalWOs || 0;
          const currentTotal = items.length;
          const totalWOs = historicalTotal + currentTotal;
          
          // Calculate Open WOs (Only from current list)
          const openWOs = items.filter(i => {
              const s = String(i['Status code'] || '').toLowerCase();
              return !s.includes('closed') && !s.includes('cancel');
          }).length;

          // Calculate Downtime (Historic + Current)
          const historicalDowntime = asset.stats?.downtimeEvents || 0;
          const currentDowntime = items.filter(i => {
              const out = String(i['Asset out of order?'] || '').toLowerCase();
              return out === 'doğru' || out === 'true' || out === 'evet' || out === '1';
          }).length;
          const downtimeEvents = historicalDowntime + currentDowntime;

          // Find Last Maintenance (Compare Historic vs Current)
          let lastMaintenanceDate: Date | null = null;
          
          // Check historic date
          if (asset.stats?.lastMaintenanceDate) {
              lastMaintenanceDate = new Date(asset.stats.lastMaintenanceDate);
          }

          // Check current items dates
          items.forEach(i => {
              if (i['Work order start date/time']) {
                  const d = excelDateToJSDate(i['Work order start date/time']);
                  if (!isNaN(d.getTime())) {
                      if (!lastMaintenanceDate || d > lastMaintenanceDate) {
                          lastMaintenanceDate = d;
                      }
                  }
              }
          });

          // Health Score Calculation
          // Logic: Base 100. Deduct for open issues and historical failures.
          let score = 100;
          if (totalWOs === 0) {
              score = 100; // No data means no known issues, technically "Clean"
          } else {
              score -= (openWOs * 5); // Current open issues hurt score
              
              // Failure rate impact (downtime / total jobs)
              // If a machine fails often relative to its jobs, score drops.
              const failureRate = totalWOs > 0 ? (downtimeEvents / totalWOs) : 0;
              score -= (failureRate * 40); 

              score = Math.max(0, Math.min(100, score));
          }

          let status: 'Operational' | 'Warning' | 'Critical' | 'No Data' = 'Operational';
          if (totalWOs === 0) status = 'No Data';
          else if (score < 50) status = 'Critical';
          else if (score < 80) status = 'Warning';

          return {
              id: asset.id,
              name: asset.name,
              totalWOs,
              openWOs,
              downtimeEvents,
              lastMaintenanceDate,
              healthScore: Math.round(score),
              status,
              history: items.sort((a,b) => {
                  const dA = excelDateToJSDate(a['Work order start date/time']).getTime() || 0;
                  const dB = excelDateToJSDate(b['Work order start date/time']).getTime() || 0;
                  return dB - dA;
              })
          };
      });

      return metrics.sort((a, b) => {
          // Sort priorities: Critical > Warning > Operational > No Data
          const priority = { 'Critical': 0, 'Warning': 1, 'Operational': 2, 'No Data': 3 };
          if (priority[a.status] !== priority[b.status]) {
              return priority[a.status] - priority[b.status];
          }
          return a.name.localeCompare(b.name);
      });
  }, [assets, workOrders]);

  const filteredAssets = useMemo(() => {
      return assetMetricsList.filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [assetMetricsList, searchTerm]);

  const handlePrint = async () => {
      if (filteredAssets.length === 0) return;
      setIsGeneratingPdf(true);
      try {
          await generateAssetsReportPDF(filteredAssets);
      } catch (e) {
          console.error(e);
          alert('PDF Raporu oluşturulamadı.');
      } finally {
          setIsGeneratingPdf(false);
      }
  };

  return (
    <div className="flex flex-col h-full animate-in w-full max-w-[1920px] mx-auto overflow-hidden bg-slate-50">
        
        {/* Header */}
        <div className="bg-white px-6 md:px-10 py-6 border-b border-slate-200 flex flex-col md:flex-row justify-between md:items-center gap-6 shrink-0">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600 border border-indigo-100 shadow-sm">
                    <Factory className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Varlık Yönetimi</h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Sabit Kıymetler & Durum Analizi</p>
                </div>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
                {/* Search */}
                <div className="relative flex-1 md:w-96 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-600 transition-colors" />
                    <input 
                        type="text" 
                        placeholder="Varlık adı ile ara..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all placeholder:text-slate-400 shadow-inner"
                    />
                </div>

                {/* Print Button (Contextual) */}
                <button 
                    onClick={handlePrint}
                    disabled={isGeneratingPdf || filteredAssets.length === 0}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 hover:text-brand-700 transition-all disabled:opacity-50 shadow-sm"
                    title="Bu sayfayı raporla"
                >
                    {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                    <span className="text-[10px] font-black uppercase hidden lg:inline">PDF RAPOR</span>
                </button>
            </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
            
            {/* Asset Grid */}
            <div className={`flex-1 overflow-y-auto custom-scroll p-6 md:p-8 ${selectedAsset ? 'hidden lg:block' : 'block'}`}>
                {filteredAssets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-300 opacity-50">
                        <Factory className="w-24 h-24 mb-4" />
                        <p className="text-sm font-black uppercase tracking-widest">Kayıtlı Varlık Bulunamadı</p>
                        <p className="text-xs text-slate-400 mt-2">Excel yüklediğinizde varlıklar otomatik oluşturulur.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                        {filteredAssets.map(asset => (
                            <div 
                                key={asset.id}
                                onClick={() => setSelectedAsset(asset)}
                                className={`bg-white p-6 rounded-[2rem] border transition-all cursor-pointer group hover:-translate-y-1 hover:shadow-xl flex flex-col relative overflow-hidden
                                    ${selectedAsset?.id === asset.id ? 'border-brand-500 ring-4 ring-brand-50 shadow-xl' : 'border-slate-200 shadow-sm hover:border-slate-300'}
                                `}
                            >
                                <div className={`absolute top-0 right-0 p-3 rounded-bl-2xl font-black text-[10px] uppercase tracking-widest
                                    ${asset.status === 'Operational' ? 'bg-emerald-50 text-emerald-600' : 
                                      asset.status === 'Warning' ? 'bg-amber-50 text-amber-600' : 
                                      asset.status === 'Critical' ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'}
                                `}>
                                    {asset.status === 'No Data' ? 'VERİ YOK' : `${asset.healthScore}/100`}
                                </div>

                                <div className="flex items-center gap-4 mb-6">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border
                                        ${asset.status === 'Operational' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 
                                          asset.status === 'Warning' ? 'bg-amber-50 border-amber-100 text-amber-600' : 
                                          asset.status === 'Critical' ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-slate-50 border-slate-100 text-slate-300'}
                                    `}>
                                        <Activity className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-sm font-black text-slate-800 leading-snug line-clamp-2 pr-12">{asset.name}</h3>
                                </div>

                                <div className="space-y-3 mb-6">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="font-bold text-slate-400">Açık İş Emri</span>
                                        <span className={`font-black ${asset.openWOs > 0 ? 'text-rose-600' : 'text-slate-800'}`}>{asset.openWOs}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="font-bold text-slate-400">Toplam Arıza</span>
                                        <span className={`font-black ${asset.downtimeEvents > 0 ? 'text-rose-600' : 'text-slate-800'}`}>{asset.downtimeEvents}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="font-bold text-slate-400">Son İşlem</span>
                                        <span className="font-bold text-slate-600">{asset.lastMaintenanceDate ? asset.lastMaintenanceDate.toLocaleDateString('tr-TR') : '-'}</span>
                                    </div>
                                </div>

                                <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{asset.totalWOs} TOPLAM KAYIT</span>
                                    {onDeleteAsset && asset.totalWOs === 0 && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onDeleteAsset(asset.id); }}
                                            className="p-2 bg-slate-50 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                            title="Varlığı Sil"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                                
                                {/* Health Bar */}
                                {asset.status !== 'No Data' && (
                                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100">
                                        <div 
                                            className={`h-full transition-all duration-1000 ${asset.status === 'Operational' ? 'bg-emerald-500' : asset.status === 'Warning' ? 'bg-amber-500' : 'bg-rose-500'}`} 
                                            style={{ width: `${asset.healthScore}%` }}
                                        ></div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Detail View */}
            {selectedAsset && (
                <div className="w-full lg:w-[450px] xl:w-[500px] bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-in slide-in-from-right-4 absolute lg:relative inset-0 lg:inset-auto z-20">
                    <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                        <div>
                            <h3 className="text-lg font-black text-slate-900 leading-tight mb-2 pr-8">{selectedAsset.name}</h3>
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border 
                                    ${selectedAsset.status === 'Operational' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                                      selectedAsset.status === 'Warning' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                                      selectedAsset.status === 'Critical' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-500 border-slate-200'}
                                `}>
                                    {selectedAsset.status === 'Operational' ? 'SAĞLIKLI' : 
                                     selectedAsset.status === 'Warning' ? 'DİKKAT' : 
                                     selectedAsset.status === 'Critical' ? 'KRİTİK' : 'VERİ YOK'}
                                </span>
                                {selectedAsset.status !== 'No Data' && <span className="text-[10px] font-bold text-slate-400">Skor: {selectedAsset.healthScore}</span>}
                            </div>
                        </div>
                        <button onClick={() => setSelectedAsset(null)} className="p-2 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-all"><ChevronRight className="w-5 h-5" /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scroll p-6 md:p-8 space-y-8">
                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                <div className="text-slate-400 mb-2"><Wrench className="w-5 h-5" /></div>
                                <div className="text-2xl font-black text-slate-900">{selectedAsset.totalWOs}</div>
                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Tüm Zamanlar</div>
                            </div>
                            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100">
                                <div className="text-rose-400 mb-2"><AlertTriangle className="w-5 h-5" /></div>
                                <div className="text-2xl font-black text-rose-700">{selectedAsset.downtimeEvents}</div>
                                <div className="text-[9px] font-bold text-rose-400 uppercase tracking-widest">Toplam Duruş</div>
                            </div>
                        </div>

                        {/* History Timeline */}
                        <div>
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                <History className="w-4 h-4" /> Güncel Liste Geçmişi
                            </h4>
                            {selectedAsset.history.length === 0 ? (
                                <div className="text-center py-8 opacity-50">
                                    <p className="text-xs text-slate-400 font-bold">Mevcut listede bu varlık için kayıt yok.</p>
                                </div>
                            ) : (
                                <div className="space-y-4 relative pl-4 border-l-2 border-slate-100 ml-2">
                                    {selectedAsset.history.map(item => {
                                        const isClosed = String(item['Status code']).toLowerCase().includes('closed');
                                        return (
                                            <div 
                                                key={item['Work order code']} 
                                                onClick={() => onItemClick(item)}
                                                className="relative pl-6 cursor-pointer group"
                                            >
                                                <div className={`absolute -left-[21px] top-1.5 w-3 h-3 rounded-full border-2 border-white shadow-sm ${isClosed ? 'bg-slate-300' : 'bg-brand-500'}`}></div>
                                                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-brand-300 transition-all">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className="text-[9px] font-black text-slate-400">{item['Work order start date/time'] ? excelDateToJSDate(item['Work order start date/time']).toLocaleDateString('tr-TR') : '-'}</span>
                                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isClosed ? 'bg-slate-100 text-slate-500' : 'bg-brand-50 text-brand-600'}`}>{item['Status code']}</span>
                                                    </div>
                                                    <h5 className="text-xs font-bold text-slate-800 leading-snug">{item['Work order name']}</h5>
                                                    {item['WO Activity type Activity type code'] && (
                                                        <span className="inline-block mt-2 text-[9px] font-bold text-slate-400 border border-slate-100 px-2 py-0.5 rounded-md bg-slate-50">{item['WO Activity type Activity type code']}</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default AssetsPage;
