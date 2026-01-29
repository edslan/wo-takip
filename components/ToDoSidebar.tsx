
import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Circle, Trash2, Plus, CalendarClock, AlertTriangle, ArrowUpCircle, ArrowDownCircle, AlertCircle } from 'lucide-react';
import { ToDoItem } from '../types';

interface ToDoSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  todos: ToDoItem[];
  // Fix: Added 'createdBy' to Omit to match the fields provided during task creation in App.tsx
  onAdd: (item: Omit<ToDoItem, 'id' | 'createdAt' | 'status' | 'notes' | 'createdBy'>) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

const ToDoSidebar: React.FC<ToDoSidebarProps> = ({ isOpen, onClose, todos, onAdd, onToggle, onDelete }) => {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<'Yüksek' | 'Orta' | 'Düşük'>('Orta');
  const [comments, setComments] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Lock scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    // Fix: The arguments here now match the updated Omit type in ToDoSidebarProps
    onAdd({ title, priority, comments });
    setTitle('');
    setComments('');
    setPriority('Orta');
    setShowForm(false);
  };

  const priorityConfig = {
    'Yüksek': { color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100', icon: AlertCircle },
    'Orta': { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', icon: AlertTriangle },
    'Düşük': { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', icon: ArrowDownCircle },
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[60]" onClick={onClose} />
      )}

      {/* Sidebar Panel */}
      <div className={`fixed inset-y-0 right-0 z-[70] w-full md:w-[400px] bg-white shadow-2xl transform transition-transform duration-300 ease-in-out border-l border-slate-100 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">YAPILACAKLAR</h2>
            <span className="bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full text-[10px] font-bold">
                {todos.filter(t => t.status !== 'Tamamlandı').length}
            </span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scroll p-6 space-y-6">
            
            {/* Add New Button */}
            {!showForm && (
                <button 
                    onClick={() => setShowForm(true)}
                    className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold text-xs flex items-center justify-center gap-2 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                >
                    <Plus className="w-4 h-4" /> YENİ GÖREV EKLE
                </button>
            )}

            {/* Form */}
            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white border border-indigo-100 rounded-2xl p-4 shadow-lg shadow-indigo-50 space-y-4 animate-in">
                    <div>
                        <input 
                            type="text" 
                            placeholder="Görev başlığı..." 
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full text-sm font-bold text-slate-800 placeholder:text-slate-300 border-none outline-none focus:ring-0 p-0"
                            autoFocus
                        />
                    </div>
                    
                    <div className="flex gap-2">
                        {(['Yüksek', 'Orta', 'Düşük'] as const).map(p => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => setPriority(p)}
                                className={`px-3 py-1 rounded-lg text-[10px] font-bold border transition-all ${priority === p ? priorityConfig[p].bg + ' ' + priorityConfig[p].color + ' ' + priorityConfig[p].border : 'bg-white border-slate-200 text-slate-400'}`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>

                    <textarea 
                        placeholder="Notlar ekleyin..." 
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        className="w-full text-xs text-slate-600 placeholder:text-slate-300 bg-slate-50 rounded-xl p-3 border-none resize-none h-20 outline-none focus:ring-1 focus:ring-indigo-200"
                    />

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-50">
                        <button type="button" onClick={() => setShowForm(false)} className="px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-lg">İPTAL</button>
                        <button type="submit" disabled={!title.trim()} className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50">EKLE</button>
                    </div>
                </form>
            )}

            {/* List */}
            <div className="space-y-3">
                {todos.length === 0 && !showForm && (
                    <div className="text-center py-10 opacity-50">
                        <CalendarClock className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                        <p className="text-xs text-slate-400 font-medium">Henüz görev eklenmemiş.</p>
                    </div>
                )}

                {todos.sort((a, b) => {
                     const aDone = a.status === 'Tamamlandı';
                     const bDone = b.status === 'Tamamlandı';
                     if (aDone === bDone) return 0;
                     return aDone ? 1 : -1;
                }).map(todo => {
                    const PIcon = priorityConfig[todo.priority].icon;
                    const isCompleted = todo.status === 'Tamamlandı';
                    return (
                        <div key={todo.id} className={`group relative p-4 rounded-2xl border transition-all ${isCompleted ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-200 hover:shadow-md'}`}>
                            <div className="flex items-start gap-3">
                                <button onClick={() => onToggle(todo.id)} className="mt-0.5 shrink-0 text-slate-300 hover:text-indigo-500 transition-colors">
                                    {isCompleted ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Circle className="w-5 h-5" />}
                                </button>
                                
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded flex items-center gap-1 ${priorityConfig[todo.priority].bg} ${priorityConfig[todo.priority].color}`}>
                                            <PIcon className="w-3 h-3" /> {todo.priority}
                                        </span>
                                        <span className="text-[9px] text-slate-300 font-bold">{new Date(todo.createdAt).toLocaleDateString('tr-TR')}</span>
                                    </div>
                                    <h4 className={`text-sm font-bold text-slate-800 ${isCompleted ? 'line-through text-slate-400' : ''}`}>{todo.title}</h4>
                                    {todo.comments && (
                                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{todo.comments}</p>
                                    )}
                                </div>
                                
                                <button onClick={() => onDelete(todo.id)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-all">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      </div>
    </>
  );
};

export default ToDoSidebar;
