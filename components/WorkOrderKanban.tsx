
import React, { useState } from 'react';
import { WorkOrder } from '../types';
import { formatFullDate } from '../utils';
import { Briefcase, Calendar, CheckCircle2, Clock, AlertCircle, HelpCircle, Info, CalendarCheck } from 'lucide-react';

interface WorkOrderKanbanProps {
  data: WorkOrder[];
  onCardClick: (item: WorkOrder) => void;
  onStatusChange?: (item: WorkOrder, newStatus: string) => void;
}

const WorkOrderKanban: React.FC<WorkOrderKanbanProps> = ({ data, onCardClick, onStatusChange }) => {
  const [draggedItem, setDraggedItem] = useState<WorkOrder | null>(null);

  const groupedData = React.useMemo(() => {
    const groups: Record<string, WorkOrder[]> = {};
    data.forEach(item => {
      const status = item['Status code'] || 'DİĞER';
      if (!groups[status]) groups[status] = [];
      groups[status].push(item);
    });
    return groups;
  }, [data]);

  const sortedStatuses = Object.keys(groupedData).sort((a, b) => {
      const getPriority = (s: string) => {
          const lower = s.toLowerCase();
          if (lower.includes('wait') || lower.includes('bekli')) return 0;
          if (lower.includes('open') || lower.includes('açık') || lower.includes('devam')) return 1;
          if (lower.includes('close') || lower.includes('kapa')) return 3;
          return 2;
      };
      return getPriority(a) - getPriority(b);
  });

  const getStatusConfig = (status: string) => {
      const lower = status.toLowerCase();
      if (lower.includes('closed') || lower.includes('kapa')) return { 
          bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', headerBar: 'bg-emerald-600', icon: CheckCircle2 
      };
      if (lower.includes('wait') || lower.includes('bekli')) return { 
          bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', headerBar: 'bg-amber-500', icon: Clock 
      };
      if (lower.includes('open') || lower.includes('açık') || lower.includes('devam')) return { 
          bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', headerBar: 'bg-blue-600', icon: AlertCircle 
      };
      return { 
          bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', headerBar: 'bg-slate-500', icon: HelpCircle 
      };
  };

  const handleDragStart = (e: React.DragEvent, item: WorkOrder) => {
      setDraggedItem(item);
      e.dataTransfer.setData('text/plain', item['Work order code']);
      e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetStatus: string) => {
      e.preventDefault();
      if (draggedItem && draggedItem['Status code'] !== targetStatus) {
          onStatusChange?.(draggedItem, targetStatus);
      }
      setDraggedItem(null);
  };

  return (
    <div className="flex gap-6 overflow-x-auto pb-6 custom-scroll min-h-[600px] select-none items-start">
      {sortedStatuses.map(status => {
        const items = groupedData[status];
        const config = getStatusConfig(status);
        const Icon = config.icon;

        return (
          <div 
            key={status} 
            className="min-w-[340px] max-w-[340px] flex flex-col bg-slate-50 rounded-xl border border-slate-200 h-full max-h-[800px] transition-colors"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, status)}
          >
            <div className="p-4 border-b border-slate-200 bg-white rounded-t-xl sticky top-0 z-10 shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${config.bg} ${config.text}`}>
                        <Icon className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wide truncate max-w-[180px]" title={status}>{status}</h3>
                </div>
                <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-bold">{items.length}</span>
              </div>
              <div className={`h-1 w-full ${config.headerBar} rounded-full opacity-80`}></div>
            </div>

            <div className={`p-3 overflow-y-auto custom-scroll flex-1 space-y-3 bg-slate-50/50 ${draggedItem && draggedItem['Status code'] !== status ? 'bg-blue-50/30 border-2 border-dashed border-blue-200 m-1 rounded-lg' : ''}`}>
              {items.map(item => (
                <div 
                  key={item['Work order code']}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item)}
                  onClick={() => onCardClick(item)}
                  className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-brand-300 transition-all cursor-grab active:cursor-grabbing group flex flex-col gap-3 relative"
                >
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                        {item['Work order code']}
                    </span>
                    <button className="p-1.5 bg-slate-50 text-slate-400 rounded-lg hover:bg-brand-600 hover:text-white transition-all shadow-sm">
                        <Info className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  
                  <h4 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2 group-hover:text-brand-700 transition-colors pr-8">
                    {item['Work order name']}
                  </h4>

                  <div className="pt-3 border-t border-slate-50 space-y-2">
                    <div className="flex items-center gap-2 text-slate-500">
                        <Briefcase className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        <span className="text-[11px] font-medium truncate">{item['Asset Name'] || 'Genel Varlık'}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                            <span className="text-[11px] font-medium">{formatFullDate(item['Work order start date/time']).split(' ')[0]}</span>
                        </div>
                        {item['Work order end date/time'] && (
                            <div className="flex items-center gap-2">
                                <CalendarCheck className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                                <span className="text-[11px] font-medium text-emerald-600">{formatFullDate(item['Work order end date/time']).split(' ')[0]}</span>
                            </div>
                        )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default WorkOrderKanban;
