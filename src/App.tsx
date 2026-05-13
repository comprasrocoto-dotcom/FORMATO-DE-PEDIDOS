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
      const [direccionEntrega, setDireccionEntrega] = useState(() => localStorage.getItem('order_config_direccion') || '');
      const [horarioRecepcion, setHorarioRecepcion] = useState(() => localStorage.getItem('order_config_horario') || '');
      const [notas, setNotas] = useState('');
      const [responsable, setResponsable] = useState('');

  useEffect(() => {
          dbService.initializeIfEmpty(INSUMOS, PROVEEDORES, SEDES);
  }, []);

  useEffect(() => {
          const unsubInsumos = dbService.subscribeToInsumos(setInsumos);
          const unsubProveedores = dbService.subscribeToProveedores(setProveedores);
          const unsubSedes = dbService.subscribeToSedes(setSedes);
          return () => { unsubInsumos(); unsubProveedores(); unsubSedes(); };
  }, []);

  const handleConfigChange = (field: 'sede' | 'direccion' | 'horario', value: string) => {
          if (field === 'sede') {
                    setSede(value);
                    localStorage.setItem('order_config_sede', value);
                    const foundSede = sedes.find(s => s.nombre === value);
                    if (foundSede) {
                                setDireccionEntrega(foundSede.direccion);
                                localStorage.setItem('order_config_direccion', foundSede.direccion);
                                setHorarioRecepcion(foundSede.horario);
                                localStorage.setItem('order_config_horario', foundSede.horario);
                    }
          } else if (field === 'direccion') {
                    setDireccionEntrega(value);
                    localStorage.setItem('order_config_direccion', value);
          } else {
                    setHorarioRecepcion(value);
                    localStorage.setItem('order_config_horario', value);
          }
  };

  const handleQuantityChange = (id: string, value: number) => {
          setQuantities(prev => ({ ...prev, [id]: Math.max(0, value) }));
  };

  const categories = useMemo(() => {
          const cats = new Set(insumos.map(i => i.categoria));
          return Array.from(cats).sort();
  }, [insumos]);

  const filteredInsumos = useMemo<Insumo[]>(() => {
          return insumos.filter(insumo => {
                    const proveedor = proveedores.find(p => p.id === insumo.proveedorId);
                    const matchesSearch =
                                insumo.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                insumo.categoria.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                proveedor?.nombre.toLowerCase().includes(searchTerm.toLowerCase());
                    const matchesProveedor = !selectedProveedorId || insumo.proveedorId === selectedProveedorId;
                    const matchesCategory = !selectedCategory || insumo.categoria === selectedCategory;
                    return matchesSearch && matchesProveedor && matchesCategory;
          }).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [insumos, proveedores, searchTerm, selectedProveedorId, selectedCategory]);

  return (
          <div className="min-h-screen flex flex-col bg-slate-50">
                <header className="bg-slate-900 text-white shadow-lg z-30">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                                  <div className="flex items-center justify-between h-16">
                                              <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center shadow-lg">
                                                                            <Database className="w-6 h-6 text-white" />
                                                            </div>div>
                                                            <div className="flex flex-col">
                                                                            <h1 className="text-lg font-bold tracking-tight">InsumoMaster</h1>h1>
                                                                            <span className="text-xs text-slate-400 font-medium uppercase">Compras Rocoto</span>span>
                                                            </div>div>
                                              </div>div>
                                              <div className="hidden md:flex items-center gap-2">
                                                            <button
                                                                                onClick={() => { setIsUpdating(true); setTimeout(() => setIsUpdating(false), 800); }}
                                                                                disabled={isUpdating}
                                                                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-800 transition-all text-slate-300 disabled:opacity-50"
                                                                              >
                                                                            <RefreshCw className={cn("w-4 h-4", isUpdating && "animate-spin")} />
                                                                            Sincronizar
                                                            </button>button>
                                              </div>div>
                                  </div>div>
                        </div>div>
                        <div className="border-t border-slate-800">
                                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-1">
                                              <button
                                                                onClick={() => setActiveTab('catalogo')}
                                                                className={cn(
                                                                                    "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all",
                                                                                    activeTab === 'catalogo' ? "border-brand-500 text-white" : "border-transparent text-slate-400 hover:text-slate-200"
                                                                                  )}
                                                              >
                                                            <List className="w-4 h-4" />
                                                            Catalogo Firebase
                                              </button>button>
                                              <button
                                                                onClick={() => setActiveTab('pedido-sheets')}
                                                                className={cn(
                                                                                    "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all",
                                                                                    activeTab === 'pedido-sheets' ? "border-brand-500 text-white" : "border-transparent text-slate-400 hover:text-slate-200"
                                                                                  )}
                                                              >
                                                            <ShoppingBag className="w-4 h-4" />
                                                            Pedido desde Drive
                                                            <span className="bg-brand-600 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">NUEVO</span>span>
                                              </button>button>
                                  </div>div>
                        </div>div>
                </header>header>
          
                <AnimatePresence mode="wait">
                    {activeTab === 'pedido-sheets' ? (
                        <motion.div key="sheets-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1">
                                    <SheetsOrderForm />
                        </motion.div>motion.div>
                      ) : (
                        <motion.div key="catalogo-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col">
                                    <div className="filters-bar">
                                                  <Filters
                                                                      searchTerm={searchTerm}
                                                                      setSearchTerm={setSearchTerm}
                                                                      selectedProveedorId={selectedProveedorId}
                                                                      setSelectedProveedorId={setSelectedProveedorId}
                                                                      selectedCategory={selectedCategory}
                                                                      setSelectedCategory={setSelectedCategory}
                                                                      viewMode={viewMode}
                                                                      setViewMode={setViewMode}
                                                                      proveedores={proveedores}
                                                                      categories={categories}
                                                                    />
                                    </div>div>
                        
                                    <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                                                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
                                                                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                                                    <LayoutGrid className="w-4 h-4" />
                                                                                    Configuracion de Orden de Compra (Firebase)
                                                                  </h3>h3>
                                                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                                                    <div className="space-y-1.5">
                                                                                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sede</label>label>
                                                                                                        <select
                                                                                                                                  value={sede}
                                                                                                                                  onChange={(e) => handleConfigChange('sede', e.target.value)}
                                                                                                                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all appearance-none cursor-pointer"
                                                                                                                                >
                                                                                                                              <option value="">Seleccionar Sede...</option>option>
                                                                                                            {sedes.map(s => <option key={s.id} value={s.nombre}>{s.nombre}</option>option>)}
                                                                                                                              <option value="Otra">Otra (Manual)</option>option>
                                                                                                            </select>select>
                                                                                        </div>div>
                                                                                    <div className="space-y-1.5">
                                                                                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Direccion de Entrega</label>label>
                                                                                                        <input
                                                                                                                                  type="text"
                                                                                                                                  value={direccionEntrega}
                                                                                                                                  onChange={(e) => handleConfigChange('direccion', e.target.value)}
                                                                                                                                  placeholder="Ej: Calle 45 # 22 - 18"
                                                                                                                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                                                                                                                                />
                                                                                        </div>div>
                                                                                    <div className="space-y-1.5">
                                                                                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Horario de Recepcion</label>label>
                                                                                                        <input
                                                                                                                                  type="text"
                                                                                                                                  value={horarioRecepcion}
                                                                                                                                  onChange={(e) => handleConfigChange('horario', e.target.value)}
                                                                                                                                  placeholder="Ej: 7:00 AM - 11:00 AM"
                                                                                                                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                                                                                                                                />
                                                                                        </div>div>
                                                                  </div>div>
                                                                  <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                                    <div className="space-y-1.5">
                                    <label className="text-xs uppercase font-bold text-slate-400 block tracking-wider">
                                                          Nombre de quien realiza el pedido (obligatorio)
                                    </label>label>
                                                                                                        <input
                                                                                                                                  type="text"
                                                                                                                                  value={responsable}
                                                                                                                                  onChange={(e) => setResponsable(e.target.value)}
                                                                                                                                  placeholder="Ingresa tu nombre..."
                                                                                                                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                                                                                                                                />
                                                                                        </div>div>
                                                                                    <div className="space-y-1.5">
                                                                                                        <label className="text-xs uppercase font-bold text-slate-400 block tracking-wider">
                                                                                                                              Notas del pedido (opcional)
                                                                                                            </label>label>
                                                                                                        <textarea
                                                                                                                                  value={notas}
                                                                                                                                  onChange={(e) => setNotas(e.target.value)}
                                                                                                                                  placeholder="Escribe aqui notas adicionales..."
                                                                                                                                  rows={1}
                                                                                                                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all resize-none"
                                                                                                                                />
                                                                                        </div>div>
                                                                  </div>div>
                                                                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                                                                                    <div className="flex flex-col">
                                                                                                        <span className="text-xs font-bold text-slate-400 uppercase">Orden Global</span>span>
                                                                                                        <button
                                                                                                                                  onClick={async () => {
                                                                                                                                                              const val = prompt("Ingresa el nuevo numero consecutivo:");
                                                                                                                                                              if (val !== null && !isNaN(parseInt(val))) {
                                                                                                                                                                                            await dbService.setGlobalConsecutive(parseInt(val));
                                                                                                                                                                                            alert("Consecutivo actualizado.");
                                                                                                                                                                  }
                                                                                                                                      }}
                                                                                                                                  className="text-xs text-brand-600 hover:underline text-left font-bold"
                                                                                                                                >
                                                                                                                              Ajustar Consecutivo
                                                                                                            </button>button>
                                                                                                        <span className="text-xs font-mono text-slate-500 italic">Sincronizado via Firebase</span>span>
                                                                                        </div>div>
                                                                                    <p className="text-xs text-slate-400 italic">Los datos se guardan en tiempo real.</p>p>
                                                                  </div>div>
                                                  </div>div>
                                    
                                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                                                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                                                                                    <div>
                                                                                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Proveedores Activos</p>p>
                                                                                                        <h4 className="text-3xl font-bold text-slate-900 font-mono">{proveedores.length}</h4>h4>
                                                                                        </div>div>
                                                                                    <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center">
                                                                                                        <BarChart3 className="w-6 h-6" />
                                                                                        </div>div>
                                                                  </div>div>
                                                                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                                                                                    <div>
                                                                                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Insumos Registrados</p>p>
                                                                                                        <h4 className="text-3xl font-bold text-slate-900 font-mono">{filteredInsumos.length}</h4>h4>
                                                                                        </div>div>
                                                                                    <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center">
                                                                                                        <Database className="w-6 h-6" />
                                                                                        </div>div>
                                                                  </div>div>
                                                                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                                                                                    <div>
                                                                                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Ultima Actualizacion</p>p>
                                                                                                        <h4 className="text-lg font-bold text-slate-900">Hoy</h4>h4>
                                                                                        </div>div>
                                                                                    <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center">
                                                                                                        <FileSpreadsheet className="w-6 h-6" />
                                                                                        </div>div>
                                                                  </div>div>
                                                  </div>div>
                                    
                                                  <AnimatePresence mode="wait">
                                                      {viewMode === 'list' ? (
                                              <motion.div key="list-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                                                  <div className="flex items-center justify-between mb-4">
                                                                                        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                                                                                <List className="w-4 h-4" />
                                                                                                                Lista Detallada
                                                                                            </h2>h2>
                                                                                        <button
                                                                                                                    onClick={async () => {
                                                                                                                                                  if (!responsable.trim()) { alert("Debes ingresar el nombre de quien realiza el pedido."); return; }
                                                                                                                                                  const active = filteredInsumos.filter(i => (quantities[i.id] || 0) > 0);
                                                                                                                                                  if (active.length === 0) { alert("No hay insumos con cantidades mayores a 0."); return; }
                                                                                                                                                  const nextNumber = await dbService.getNextGlobalConsecutive();
                                                                                                                                                  const proveedorName = selectedProveedorId ? proveedores.find(p => p.id === selectedProveedorId)?.nombre : "Todos";
                                                                                                                                                  const total = active.reduce((acc, i) => acc + (i.precio * (quantities[i.id] || 0)), 0);
                                                                                                                                                  const html = `<!DOCTYPE html><html><head><style>body{font-family:Arial,sans-serif;padding:40px;font-size:12px;}h1{color:#002060;}table{width:100%;border-collapse:collapse;}th{background:#002060;color:white;padding:10px;}td{padding:8px;border-bottom:1px solid #eee;}.total{font-weight:bold;font-size:16px;text-align:right;margin-top:20px;}</style></head><body><h1>ORDEN DE COMPRA OC-${nextNumber}</h1><p><b>Fecha:</b> ${new Date().toLocaleDateString()} | <b>Sede:</b> ${sede} | <b>Proveedor:</b> ${proveedorName}</p><table><thead><tr><th>Producto</th><th>Cantidad</th></tr></thead><tbody>${active.map(i => `<tr><td>${i.nombre}</td><td>${quantities[i.id]}</td></tr>`).join('')}</tbody></table><p class="total">TOTAL: $${total.toLocaleString()}</p><p><i>Elaboro: ${responsable}</i></p></body></html>`;
                                                                                                                                                  html2pdf().set({ margin: 20, filename: `OC-${nextNumber}.pdf`, jsPDF: { format: 'letter' } }).from(html).save();
                                                                                                                        }}
                                                                                                                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1.5 transition-colors"
                                                                                                                  >
                                                                                                                <Download className="w-3.5 h-3.5" />
                                                                                                                Descargar PDF
                                                                                            </button>button>
                                                                  </div>div>
                                                                  <InsumoTable
                                                                                            insumos={filteredInsumos}
                                                                                            proveedores={proveedores}
                                                                                            quantities={quantities}
                                                                                            onQuantityChange={handleQuantityChange}
                                                                                          />
                                              </motion.div>motion.div>
                                            ) : (
                                              <motion.div key="grid-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                                                      {proveedores.filter(p => !selectedProveedorId || p.id === selectedProveedorId).map(p => (
                                                                          <ProveedorCard
                                                                                                        key={p.id}
                                                                                                        proveedor={p}
                                                                                                        insumos={filteredInsumos as Insumo[]}
                                                                                                        quantities={quantities}
                                                                                                        onQuantityChange={handleQuantityChange}
                                                                                                        sede={sede}
                                                                                                        direccionEntrega={direccionEntrega}
                                                                                                        horarioRecepcion={horarioRecepcion}
                                                                                                        notas={notas}
                                                                                                        responsable={responsable}
                                                                                                      />
                                                                        ))}
                                                                  </div>div>
                                              </motion.div>motion.div>
                                            )}
                                                  </AnimatePresence>AnimatePresence>
                                    
                                        {filteredInsumos.length === 0 && (
                                            <div className="flex flex-col items-center justify-center py-24 text-center">
                                                              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                                                                                  <Database className="w-10 h-10 text-slate-300" />
                                                              </div>div>
                                                              <h3 className="text-xl font-bold text-slate-900 mb-2">No se encontraron resultados</h3>h3>
                                                              <button
                                                                                      onClick={() => { setSearchTerm(''); setSelectedProveedorId(''); setSelectedCategory(''); }}
                                                                                      className="mt-6 px-6 py-2 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 transition-all"
                                                                                    >
                                                                                  Limpiar todos los filtros
                                                              </button>button>
                                            </div>div>
                                                  )}
                                    </main>main>
                        </motion.div>motion.div>
                      )}
                </AnimatePresence>AnimatePresence>
          
                <footer className="bg-white border-t border-slate-200 py-6">
                        <div className="max-w-7xl mx-auto px-4 text-center">
                                  <p className="text-xs text-slate-400 font-medium tracking-wide uppercase">
                                              Compras Rocoto Sistema de Pedidos {new Date().getFullYear()}
                                  </p>p>
                        </div>div>
                </footer>footer>
          </div>div>
        );
}
</div>
