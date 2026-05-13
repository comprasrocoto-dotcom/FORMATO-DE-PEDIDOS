import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Database, FileSpreadsheet, Download, RefreshCw, BarChart3, List, LayoutGrid, ShoppingBag } from 'lucide-react';
import { INSUMOS, PROVEEDORES, SEDES } from './data/mockData';
import { Insumo, Proveedor } from './types';
import Filters from './components/Filters';
import InsumoTable from './components/InsumoTable';
import ProveedorCard from './components/ProveedorCard';
import SheetsOrderForm from './components/SheetsOrderForm';
import { cn } from './lib/utils';
import { dbService, Sede } from './services/db';
// @ts-ignore
import html2pdf from 'html2pdf.js';

type Tab = 'catalogo' | 'pedido-sheets';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('catalogo');
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProveedorId, setSelectedProveedorId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [isUpdating, setIsUpdating] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [sede, setSede] = useState(() => localStorage.getItem('order_config_sede') || '');
  const [notas, setNotas] = useState('');
  const [responsable, setResponsable] = useState('');

  useEffect(() => { dbService.initializeIfEmpty(INSUMOS, PROVEEDORES, SEDES); }, []);
  useEffect(() => {
    const u1 = dbService.subscribeToInsumos(setInsumos);
    const u2 = dbService.subscribeToProveedores(setProveedores);
    const u3 = dbService.subscribeToSedes(setSedes);
    return () => { u1(); u2(); u3(); };
  }, []);

  const categories = useMemo(() => Array.from(new Set(insumos.map(i => i.categoria))).sort(), [insumos]);
  const filteredInsumos = useMemo<Insumo[]>(() => insumos.filter(insumo => {
    const p = proveedores.find(p => p.id === insumo.proveedorId);
    return (insumo.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      insumo.categoria.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p?.nombre.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (!selectedProveedorId || insumo.proveedorId === selectedProveedorId) &&
      (!selectedCategory || insumo.categoria === selectedCategory);
  }).sort((a, b) => a.nombre.localeCompare(b.nombre)), [insumos, proveedores, searchTerm, selectedProveedorId, selectedCategory]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-slate-900 text-white shadow-lg z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center">
                <Database className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold">InsumoMaster</h1>
                <span className="text-xs text-slate-400 uppercase">Compras Rocoto</span>
              </div>
            </div>
            <button onClick={() => { setIsUpdating(true); setTimeout(() => setIsUpdating(false), 800); }}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm hover:bg-slate-800 text-slate-300">
              <RefreshCw className={cn("w-4 h-4", isUpdating && "animate-spin")} />
              Sincronizar
            </button>
          </div>
        </div>
        <div className="border-t border-slate-800">
          <div className="max-w-7xl mx-auto px-4 flex gap-1">
            <button onClick={() => setActiveTab('catalogo')}
              className={cn("flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all",
                activeTab === 'catalogo' ? "border-brand-500 text-white" : "border-transparent text-slate-400")}>
              <List className="w-4 h-4" /> Catalogo Firebase
            </button>
            <button onClick={() => setActiveTab('pedido-sheets')}
              className={cn("flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all",
                activeTab === 'pedido-sheets' ? "border-brand-500 text-white" : "border-transparent text-slate-400")}>
              <ShoppingBag className="w-4 h-4" /> Pedido desde Drive
              <span className="bg-brand-600 text-white text-xs px-1.5 py-0.5 rounded-full">NUEVO</span>
            </button>
          </div>
        </div>
      </header>
      <AnimatePresence mode="wait">
        {activeTab === 'pedido-sheets' ? (
          <motion.div key="sheets-tab" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex-1">
            <SheetsOrderForm />
          </motion.div>
        ) : (
          <motion.div key="catalogo-tab" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex-1 flex flex-col">
            <div className="filters-bar">
              <Filters searchTerm={searchTerm} setSearchTerm={setSearchTerm}
                selectedProveedorId={selectedProveedorId} setSelectedProveedorId={setSelectedProveedorId}
                selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory}
                viewMode={viewMode} setViewMode={setViewMode} proveedores={proveedores} categories={categories} />
            </div>
            <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
                <h3 className="text-sm font-bold text-slate-700 uppercase mb-4 flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4" /> Configuracion de Orden
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Sede</label>
                    <select value={sede} onChange={e => { setSede(e.target.value); localStorage.setItem('order_config_sede', e.target.value); }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                      <option value="">Seleccionar...</option>
                      {sedes.map(s => <option key={s.id} value={s.nombre}>{s.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Responsable</label>
                    <input type="text" value={responsable} onChange={e => setResponsable(e.target.value)}
                      placeholder="Tu nombre" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Notas</label>
                    <input type="text" value={notas} onChange={e => setNotas(e.target.value)}
                      placeholder="Observaciones" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div><p className="text-xs font-bold text-slate-400 uppercase mb-1">Proveedores</p><h4 className="text-3xl font-bold">{proveedores.length}</h4></div>
                  <BarChart3 className="w-8 h-8 text-blue-400" />
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div><p className="text-xs font-bold text-slate-400 uppercase mb-1">Insumos</p><h4 className="text-3xl font-bold">{filteredInsumos.length}</h4></div>
                  <Database className="w-8 h-8 text-emerald-400" />
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div><p className="text-xs font-bold text-slate-400 uppercase mb-1">Estado</p><h4 className="text-lg font-bold">Live</h4></div>
                  <FileSpreadsheet className="w-8 h-8 text-amber-400" />
                </div>
              </div>
              {viewMode === 'list' ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2"><List className="w-4 h-4" /> Lista</h2>
                    <button onClick={async () => {
                      const active = filteredInsumos.filter(i => (quantities[i.id] || 0) > 0);
                      if (!active.length) { alert('Selecciona insumos.'); return; }
                      const n = await dbService.getNextGlobalConsecutive();
                      html2pdf().set({margin:20,filename:'OC-'+n+'.pdf'}).from('<h1>OC-'+n+'</h1><ul>'+active.map(i=>'<li>'+i.nombre+' x'+quantities[i.id]+'</li>').join('')+'</ul>').save();
                    }} className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
                      <Download className="w-3.5 h-3.5" /> PDF
                    </button>
                  </div>
                  <InsumoTable insumos={filteredInsumos} proveedores={proveedores} quantities={quantities}
                    onQuantityChange={(id, v) => setQuantities(prev => ({...prev, [id]: Math.max(0, v)}))} />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {proveedores.filter(p => !selectedProveedorId || p.id === selectedProveedorId).map(p => (
                    <ProveedorCard key={p.id} proveedor={p} insumos={filteredInsumos as Insumo[]} quantities={quantities}
                      onQuantityChange={(id,v) => setQuantities(prev => ({...prev, [id]: Math.max(0,v)}))}
                      sede={sede} direccionEntrega="" horarioRecepcion="" notas={notas} responsable={responsable} />
                  ))}
                </div>
              )}
            </main>
          </motion.div>
        )}
      </AnimatePresence>
      <footer className="bg-white border-t border-slate-200 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-xs text-slate-400 uppercase">Compras Rocoto - {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
