
import React, { useState } from 'react';
import { Layers, ArrowRight, Loader2, User } from 'lucide-react';
import { UserProfile } from '../types';

interface AuthProps {
    onLogin?: (user: UserProfile) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setLoading(true);
    // Simulate network delay for effect
    setTimeout(() => {
        const mockUser: UserProfile = {
            uid: Date.now().toString(),
            email: name.toLowerCase().replace(/\s/g, '.') + '@enterprise.admin',
            displayName: name
        };
        if (onLogin) onLogin(mockUser);
        setLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-8 animate-in border border-slate-100">
        
        <div className="text-center mb-8">
            <div className="w-16 h-16 bg-brand-700 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-200 mx-auto mb-4">
                <Layers className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                WO MANAGER
            </h1>
            <div className="flex items-center justify-center gap-2 mt-2">
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest">
                    Bulut Senkronizasyon Modu
                </p>
            </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 ml-4 uppercase">Yönetici İsmi / E-posta</label>
                <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Adınızı giriniz..."
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 focus:border-brand-500 outline-none transition-colors"
                        required
                        autoFocus
                    />
                </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-[10px] text-slate-500 leading-relaxed text-center">
                    Bu oturumda verileriniz <strong>bulut veritabanına</strong> kaydedilecek ve tüm cihazlarınızdan erişilebilir olacaktır.
                </p>
            </div>

            <button 
                type="submit" 
                disabled={loading || !name.trim()}
                className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-brand-600 shadow-xl shadow-slate-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <>
                        BAŞLAT <ArrowRight className="w-5 h-5" />
                    </>
                )}
            </button>
        </form>
      </div>
    </div>
  );
};

export default Auth;
