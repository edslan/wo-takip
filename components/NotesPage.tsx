
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Note } from '../types';
import { Plus, Trash2, Calendar, StickyNote, X, Search, Bold, Italic, Underline, List, User, Loader2, Palette, FileText, ChevronRight, LayoutGrid, AlignJustify, Pin, PinOff, Clock, Grip, GripHorizontal, Highlighter } from 'lucide-react';

interface NotesPageProps {
  notes: Note[];
  onAdd: (note: Omit<Note, 'id' | 'date'>) => Promise<void>;
  onUpdate: (note: Note) => Promise<void>;
  onDelete: (id: string) => void;
}

const colorMap = {
    yellow: { border: 'border-amber-200', ring: 'ring-amber-400', tag: 'bg-amber-100 text-amber-800', dot: 'bg-amber-400', bg: 'bg-gradient-to-br from-amber-50 to-amber-50/50', shadow: 'shadow-amber-100' },
    blue: { border: 'border-blue-200', ring: 'ring-blue-500', tag: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500', bg: 'bg-gradient-to-br from-blue-50 to-blue-50/50', shadow: 'shadow-blue-100' },
    green: { border: 'border-emerald-200', ring: 'ring-emerald-500', tag: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500', bg: 'bg-gradient-to-br from-emerald-50 to-emerald-50/50', shadow: 'shadow-emerald-100' },
    rose: { border: 'border-rose-200', ring: 'ring-rose-500', tag: 'bg-rose-100 text-rose-800', dot: 'bg-rose-500', bg: 'bg-gradient-to-br from-rose-50 to-rose-50/50', shadow: 'shadow-rose-100' },
    purple: { border: 'border-purple-200', ring: 'ring-purple-500', tag: 'bg-purple-100 text-purple-800', dot: 'bg-purple-500', bg: 'bg-gradient-to-br from-purple-50 to-purple-50/50', shadow: 'shadow-purple-100' },
    slate: { border: 'border-slate-200', ring: 'ring-slate-500', tag: 'bg-slate-100 text-slate-800', dot: 'bg-slate-500', bg: 'bg-gradient-to-br from-slate-50 to-slate-50/50', shadow: 'shadow-slate-200' },
};

const stripHtml = (html: string) => {
   const tmp = document.createElement("DIV");
   const formattedHtml = html
       .replace(/<\/div>/gi, '\n')
       .replace(/<\/li>/gi, '\n')
       .replace(/<li>/gi, ' • ')
       .replace(/<br\s*[\/]?>/gi, '\n');
   tmp.innerHTML = formattedHtml;
   return tmp.textContent || tmp.innerText || "";
};

const getRelativeDateLabel = (timestamp: number) => {
    const d = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const dayDiff = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (dayDiff === 0) return 'BUGÜN';
    if (dayDiff === 1) return 'DÜN';
    if (dayDiff < 7) return 'BU HAFTA';
    return d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }).toUpperCase();
};

const NotesPage: React.FC<NotesPageProps> = ({ notes, onAdd, onUpdate, onDelete }) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [title, setTitle] = useState('');
  const [color, setColor] = useState<Note['color']>('blue');
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isModalOpen && editorRef.current) {
        editorRef.current.innerHTML = editingNote ? editingNote.content : '';
        editorRef.current.focus();
    }
  }, [isModalOpen, editingNote]);

  const openAddModal = () => {
      setEditingNote(null);
      setTitle('');
      setColor('blue');
      setIsModalOpen(true);
  };

  const openEditModal = (note: Note) => {
      setEditingNote(note);
      setTitle(note.title);
      setColor(note.color);
      setIsModalOpen(true);
  };

  const executeCommand = (command: string, value: string | undefined = undefined) => {
      document.execCommand(command, false, value);
      editorRef.current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const content = editorRef.current?.innerHTML || '';
      if (!title.trim() && !stripHtml(content).trim()) return;

      setIsSubmitting(true);
      try {
        if (editingNote) {
            await onUpdate({ ...editingNote, title, content, color, date: Date.now() });
        } else {
            await onAdd({ title, content, color });
        }
        setIsModalOpen(false);
      } catch (error) { console.error(error); } finally { setIsSubmitting(false); }
  };

  const togglePin = async (e: React.MouseEvent, note: Note) => {
      e.stopPropagation();
      await onUpdate({ ...note, pinned: !note.pinned });
  };

  const filteredNotes = useMemo(() => {
    return notes.filter(n => 
      n.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      stripHtml(n.content).toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a,b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.date - a.date;
    });
  }, [notes, searchTerm]);

  const groupedNotes = useMemo(() => {
      const groups: Record<string, Note[]> = {};
      filteredNotes.forEach(n => {
          if (n.pinned) {
              if (!groups['SABİTLENMİŞ']) groups['SABİTLENMİŞ'] = [];
              groups['SABİTLENMİŞ'].push(n);
          } else {
              const label = getRelativeDateLabel(n.date);
              if (!groups[label]) groups[label] = [];
              groups[label].push(n);
          }
      });
      return Object.entries(groups);
  }, [filteredNotes]);

  return (
    <div className="flex flex-col h-full animate-in max-w-[1920px] mx-auto overflow-hidden relative">
      
      {/* Search and Action Header */}
      <div className="bg-white px-4 md:px-8 py-5 border-b border-slate-100 flex flex-col xl:flex-row justify-between gap-6 xl:items-center shrink-0 relative z-10">
        <div>
            <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-brand-800 to-brand-950 text-white rounded-xl shadow-lg shadow-brand-200">
                    <StickyNote className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-lg font-black text-slate-900 tracking-tight uppercase leading-none">Doküman Deposu</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Teknik Prosedürler & Notlar</p>
                </div>
            </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
            <div className="bg-slate-100 p-1 rounded-xl flex gap-1 border border-slate-200 w-full sm:w-auto shrink-0">
                <button onClick={() => setViewMode('grid')} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'grid' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}>
                    <LayoutGrid className="w-4 h-4" /> Grid
                </button>
                <button onClick={() => setViewMode('list')} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'list' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}>
                    <AlignJustify className="w-4 h-4" /> Liste
                </button>
            </div>

            <div className="relative w-full sm:w-80 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-600 transition-colors" />
                <input 
                    type="text" 
                    placeholder="İçeriklerde ara..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-500 transition-all placeholder:text-slate-400"
                />
            </div>
            
            <button onClick={openAddModal} className="hidden sm:flex px-6 py-2.5 bg-brand-950 text-white font-black rounded-xl hover:bg-brand-800 shadow-xl shadow-brand-100 transition-all items-center justify-center gap-2 text-[10px] uppercase tracking-widest active:scale-95 shrink-0">
                <Plus className="w-4 h-4" /> Yeni Not
            </button>
        </div>
      </div>

      {/* MOBILE: Floating Action Button */}
      <button 
        onClick={openAddModal}
        className="sm:hidden fixed bottom-6 right-6 w-14 h-14 bg-brand-950 text-white rounded-2xl flex items-center justify-center shadow-2xl z-[100] active:scale-90 transition-all border border-white/10"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Content Scroll Area */}
      <div className="flex-1 overflow-y-auto custom-scroll p-4 md:p-8 bg-slate-50">
        {filteredNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-40 opacity-20 grayscale">
               <FileText className="w-24 h-24 mb-6" />
               <p className="text-sm font-black uppercase tracking-[0.3em]">Arşiv Boş</p>
            </div>
        ) : (
            <div className="space-y-12 pb-24">
                {groupedNotes.map(([label, items]) => (
                    <div key={label} className="space-y-6">
                        <div className="flex items-center gap-4 px-2">
                            <span className="text-[10px] font-black text-slate-400 tracking-[0.3em] uppercase">{label}</span>
                            <div className="flex-1 h-px bg-slate-200"></div>
                        </div>
                        
                        {viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {items.map(note => {
                                    const theme = colorMap[note.color];
                                    return (
                                    <div 
                                        key={note.id} 
                                        onClick={() => openEditModal(note)}
                                        className={`group relative p-6 rounded-[2rem] border transition-all cursor-pointer flex flex-col h-[300px] overflow-hidden animate-in hover:-translate-y-1 hover:shadow-xl ${theme.bg} ${theme.border} ${theme.shadow}`}
                                    >
                                        <div className="flex justify-between items-start mb-4 relative z-10">
                                            <div className="min-w-0 pr-4">
                                                <h3 className="font-black text-base text-slate-900 truncate leading-tight tracking-tight uppercase">
                                                    {note.title || 'Başlıksız'}
                                                </h3>
                                                <div className="text-[9px] font-black text-slate-500 mt-1 uppercase tracking-widest flex items-center gap-2">
                                                    <User className="w-3 h-3" /> {note.createdBy?.split('@')[0] || 'Sistem'}
                                                </div>
                                            </div>
                                            <button 
                                                onClick={(e) => togglePin(e, note)}
                                                className={`p-2 rounded-xl transition-all ${note.pinned ? 'bg-white text-brand-600 shadow-sm' : 'bg-white/50 text-slate-400 hover:text-brand-600 hover:bg-white'}`}
                                            >
                                                {note.pinned ? <Pin className="w-3.5 h-3.5 fill-current" /> : <PinOff className="w-3.5 h-3.5" />}
                                            </button>
                                        </div>
                                        
                                        <div className="flex-1 text-xs font-medium text-slate-600 leading-relaxed overflow-hidden relative mb-4 opacity-80">
                                            <div className="line-clamp-6">{stripHtml(note.content) || 'İçerik boş...'}</div>
                                            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white/0 to-transparent pointer-events-none"></div>
                                        </div>

                                        <div className="pt-4 border-t border-slate-200/50 flex items-center justify-between mt-auto relative z-10">
                                            <div className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider ${theme.tag} border border-black/5`}>
                                                {note.color}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                                                <Clock className="w-3 h-3" />
                                                {new Date(note.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                                            </div>
                                        </div>
                                        
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setNoteToDelete(note.id); }}
                                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-4 bg-rose-600 text-white rounded-full transition-all opacity-0 group-hover:opacity-100 shadow-2xl scale-0 group-hover:scale-100 active:scale-90 z-20"
                                        >
                                            <Trash2 className="w-6 h-6" />
                                        </button>
                                    </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                                <div className="divide-y divide-slate-50">
                                    {items.map(note => {
                                        const theme = colorMap[note.color];
                                        return (
                                            <div 
                                                key={note.id} 
                                                onClick={() => openEditModal(note)}
                                                className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition-all cursor-pointer group"
                                            >
                                                <div className="col-span-8 lg:col-span-6 min-w-0">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-3 h-3 rounded-full shrink-0 shadow-sm ${theme.dot}`}></div>
                                                        <h4 className="text-xs font-black text-slate-800 truncate uppercase tracking-tight">{note.title || 'İsimsiz'}</h4>
                                                    </div>
                                                </div>
                                                <div className="hidden lg:block lg:col-span-2 text-center">
                                                    <span className={`inline-block px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${theme.tag}`}>{note.color}</span>
                                                </div>
                                                <div className="hidden md:block col-span-3 lg:col-span-2">
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{note.createdBy || 'Bilinmiyor'}</span>
                                                </div>
                                                <div className="col-span-4 lg:col-span-2 text-right flex items-center justify-end gap-3">
                                                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">{new Date(note.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</span>
                                                    <button onClick={(e) => togglePin(e, note)} className={`p-1.5 rounded-lg ${note.pinned ? 'text-brand-600 bg-brand-50' : 'text-slate-300'}`}><Pin className={`w-3.5 h-3.5 ${note.pinned ? 'fill-current' : ''}`} /></button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        )}
      </div>

      {/* Editor Modal */}
      {isModalOpen && (
          <div className="fixed inset-0 z-[500] bg-slate-900/40 backdrop-blur-xl flex items-center justify-center p-0 md:p-6 animate-in fade-in">
              <div className="bg-white w-full max-w-5xl h-full md:h-[90vh] md:rounded-[2.5rem] shadow-2xl flex flex-col border border-white/20 overflow-hidden">
                  
                  {/* Editor Header */}
                  <div className="px-6 md:px-8 py-5 border-b border-slate-100 bg-white flex justify-between items-center shrink-0">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg shadow-sm ${colorMap[color].tag}`}>
                            <Palette className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{editingNote ? 'Düzenleme Modu' : 'Yeni Doküman'}</h3>
                        </div>
                      </div>
                      <button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full text-slate-400 transition-all"><X className="w-5 h-5" /></button>
                  </div>

                  <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 bg-white relative">
                      {/* Meta & Customization Bar */}
                      <div className="px-6 md:px-8 py-3 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-6 items-center shrink-0">
                           <div className="flex items-center gap-4 shrink-0">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">ETİKET</span>
                                <div className="flex gap-2">
                                    {(Object.keys(colorMap) as Note['color'][]).map(c => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setColor(c)}
                                            className={`w-5 h-5 rounded-full transition-all ${colorMap[c].dot} ${color === c ? `ring-2 ring-offset-2 ${colorMap[c].ring} scale-110` : 'opacity-40 hover:opacity-100'}`}
                                        />
                                    ))}
                                </div>
                           </div>
                           <div className="h-4 w-px bg-slate-200 hidden md:block"></div>
                           <div className="flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-500 uppercase tracking-wider shadow-sm">
                               <User className="w-3 h-3 text-slate-400" /> {editingNote?.createdBy || 'Oturum Sahibi'}
                           </div>
                      </div>

                      {/* Document Content */}
                      <div className="flex-1 flex flex-col p-6 md:p-10 min-h-0 overflow-y-auto custom-scroll">
                        <input 
                            type="text" 
                            placeholder="Başlık girin..."
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full text-3xl md:text-4xl font-black text-slate-900 placeholder:text-slate-200 border-none outline-none py-2 bg-transparent tracking-tight mb-6"
                            autoFocus
                        />
                        
                        {/* Editor Canvas */}
                        <div className="flex-1 relative group cursor-text" onClick={() => editorRef.current?.focus()}>
                            <div 
                                ref={editorRef}
                                contentEditable
                                className="absolute inset-0 text-base font-medium text-slate-600 outline-none leading-relaxed tracking-wide [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 pb-20"
                                data-placeholder="Notlarınızı buraya yazın..."
                            />
                        </div>
                      </div>

                      {/* Contextual Toolbar - High-End Floating Feel */}
                      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 p-2 pl-4 bg-slate-900 text-white rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4">
                           <div className="flex items-center gap-1">
                                <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => executeCommand('bold')} className="p-2 hover:bg-white/10 rounded-lg transition-all"><Bold className="w-4 h-4" /></button>
                                <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => executeCommand('italic')} className="p-2 hover:bg-white/10 rounded-lg transition-all"><Italic className="w-4 h-4" /></button>
                                <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => executeCommand('underline')} className="p-2 hover:bg-white/10 rounded-lg transition-all"><Underline className="w-4 h-4" /></button>
                                <div className="w-px h-4 bg-white/20 mx-1"></div>
                                <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => executeCommand('insertUnorderedList')} className="p-2 hover:bg-white/10 rounded-lg transition-all"><List className="w-4 h-4" /></button>
                                <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => executeCommand('hiliteColor', 'yellow')} className="p-2 hover:bg-white/10 rounded-lg transition-all"><Highlighter className="w-4 h-4" /></button>
                           </div>

                           <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 bg-white text-slate-900 font-black rounded-xl hover:bg-brand-50 transition-all text-[10px] flex items-center gap-2 uppercase tracking-widest active:scale-95 shadow-lg">
                              {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'KAYDET'}
                           </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* Delete Confirmation Modal */}
      {noteToDelete && (
          <div className="fixed inset-0 z-[600] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 animate-in">
              <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20">
                  <div className="p-10 text-center">
                      <div className="w-20 h-20 bg-rose-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-rose-100 shadow-inner">
                          <Trash2 className="w-10 h-10 text-rose-500" />
                      </div>
                      <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tighter uppercase">Dokümanı Sil?</h3>
                      <p className="text-sm text-slate-500 leading-relaxed mb-10 font-bold opacity-60">
                          Bu teknik doküman sistemden kalıcı olarak temizlenecektir.
                      </p>
                      <div className="flex gap-4">
                          <button onClick={() => setNoteToDelete(null)} className="flex-1 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-white transition-all">Vazgeç</button>
                          <button onClick={() => { if(noteToDelete) { onDelete(noteToDelete); setNoteToDelete(null); } }} className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-700 shadow-xl shadow-rose-200 transition-all">SİL</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default NotesPage;
