// @ts-nocheck
import SheetsOrderForm, { HistorialDocumentado } from './components/SheetsOrderForm';
import AjustePedidos from './components/AjustePedidos';
import { useState } from 'react';
import { ShoppingBag, Edit3, Archive } from 'lucide-react';

export default function App() {
  var [tab, setTab] = useState('pedidos');
  var [proveedoresMeta, setProveedoresMeta] = useState([]);
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-[#1a3c6e] shadow-lg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-cyan-500 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4 text-white"/>
              </div>
              <div>
                <div className="text-white font-bold text-sm">InsumoMaster</div>
                <div className="text-cyan-300 text-[10px] uppercase tracking-wider">Restaurantes Rocoto</div>
              </div>
            </div>
            <nav className="flex gap-1">
              <button onClick={function(){setTab('pedidos');}}
                className={"flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all " + (tab==='pedidos'?'bg-white/20 text-white':'text-cyan-300 hover:text-white hover:bg-white/10')}>
                <ShoppingBag className="w-3.5 h-3.5"/> Pedido desde Drive
              </button>
              <button onClick={function(){setTab('documentado');}}
                className={"flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all " + (tab==='documentado'?'bg-white/20 text-white':'text-cyan-300 hover:text-white hover:bg-white/10')}>
                <Archive className="w-3.5 h-3.5"/> Historial Documentado
              </button>
              <button onClick={function(){setTab('ajuste');}}
                className={"flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all " + (tab==='ajuste'?'bg-white/20 text-white':'text-cyan-300 hover:text-white hover:bg-white/10')}>
                <Edit3 className="w-3.5 h-3.5"/> Ajuste de Pedidos
              </button>
            </nav>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {tab === 'pedidos' && <SheetsOrderForm />}
        {tab === 'documentado' && (
          <HistorialDocumentado proveedoresMeta={proveedoresMeta}/>
        )}
        {tab === 'ajuste' && <AjustePedidos />}
      </main>
    </div>
  );
}
