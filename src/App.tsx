// @ts-nocheck
import { Component } from 'react';
import SheetsOrderForm from './components/SheetsOrderForm';

// ErrorBoundary para capturar crashes de componentes hijos
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error: error };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Capturado:', error.message);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{padding:'24px',fontFamily:'sans-serif'}}>
          <div style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:'12px',padding:'20px',marginBottom:'16px'}}>
            <p style={{fontWeight:'bold',color:'#dc2626',marginBottom:'8px'}}>Se produjo un error. Recargando...</p>
            <p style={{color:'#7f1d1d',fontSize:'12px'}}>{String(this.state.error && this.state.error.message)}</p>
          </div>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); }}
            style={{background:'#1a3c6e',color:'white',border:'none',borderRadius:'8px',padding:'10px 20px',cursor:'pointer',fontWeight:'bold'}}>
            Recuperar aplicacion
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{background:'linear-gradient(135deg,#0ea5e9,#06b6d4)'}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
              </svg>
            </div>
            <div>
              <div className="font-black text-sm tracking-tight">InsumoMaster</div>
              <div className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Restaurantes Rocoto</div>
            </div>
          </div>
          <button onClick={() => window.location.reload()} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-800">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
            </svg>
            Sincronizar
          </button>
        </div>
      </header>

      {/* Contenido principal */}
      <main>
        <ErrorBoundary>
          <SheetsOrderForm/>
        </ErrorBoundary>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <p className="text-center text-[10px] text-slate-400 font-medium uppercase tracking-widest">
            InsumoMaster &bull; Rocoto Restaurantes &bull; 2026
          </p>
        </div>
      </footer>
    </div>
  );
}
