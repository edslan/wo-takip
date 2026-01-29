import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { RefreshCcw, ShieldAlert, Terminal } from 'lucide-react';

console.log("%c[BOOTSTRAP] Sistem Başlatılıyor...", "color: #3b82f6; font-weight: bold; font-size: 14px;");

// Global Hata Yakalama
window.addEventListener('error', (event) => {
    console.error("%c[CRITICAL ERROR]", "color: red; font-weight: bold;", event.message);
});

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class GlobalErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[REACT BOUNDARY]", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center font-sans">
          <div className="w-24 h-24 bg-rose-100 rounded-full flex items-center justify-center mb-6 border-4 border-white shadow-xl animate-pulse">
            <ShieldAlert className="w-12 h-12 text-rose-600" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Sistem Başlatılamadı</h1>
          <p className="text-slate-500 mb-8 max-w-md mx-auto text-sm font-medium">
            Kritik bir sürüm uyuşmazlığı veya çalışma zamanı hatası tespit edildi.
          </p>
          
          <div className="bg-slate-900 text-slate-300 p-6 rounded-2xl text-left text-xs font-mono w-full max-w-2xl overflow-auto max-h-64 mb-8 shadow-2xl border border-slate-800">
            <div className="flex items-center gap-2 mb-4 text-rose-400 border-b border-slate-700 pb-2">
                <Terminal className="w-4 h-4" /> 
                <span className="font-bold uppercase tracking-widest">HATA GÜNLÜĞÜ</span>
            </div>
            <code className="block whitespace-pre-wrap break-all text-slate-400">
                {this.state.error?.toString() || "Bilinmeyen Hata"}
            </code>
            {this.state.errorInfo && (
                <code className="block mt-4 text-slate-600 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                </code>
            )}
          </div>

          <button 
            onClick={() => window.location.reload()} 
            className="flex items-center gap-3 px-8 py-4 bg-brand-600 text-white rounded-2xl font-bold hover:bg-brand-700 transition-all shadow-xl shadow-brand-200 active:scale-95 uppercase tracking-widest text-xs"
          >
            <RefreshCcw className="w-4 h-4" /> Sistemi Yeniden Yükle
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const container = document.getElementById('root');

if (container) {
  try {
      const root = createRoot(container);
      root.render(
        <React.StrictMode>
          <GlobalErrorBoundary>
            <App />
          </GlobalErrorBoundary>
        </React.StrictMode>
      );
      console.log("%c[BOOTSTRAP] Render Başarılı", "color: #10b981; font-weight: bold;");
  } catch (e) {
      console.error("[BOOTSTRAP FATAL]", e);
      container.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#ef4444;text-align:center;">
            <h1 style="font-size:24px;font-weight:900;margin-bottom:16px;">KRİTİK BAŞLATMA HATASI</h1>
            <pre style="background:#f1f5f9;padding:16px;border-radius:12px;color:#334155;max-width:800px;overflow:auto;">${e}</pre>
        </div>
      `;
  }
} else {
  console.error("Root elementi bulunamadı. index.html dosyasını kontrol edin.");
}