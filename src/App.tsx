// @ts-nocheck
// build: 1778940595853
import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Database, Plus, FileSpreadsheet, Download, RefreshCw, BarChart3, List, LayoutGrid, ShoppingBag } from 'lucide-react';
import { INSUMOS, PROVEEDORES, SEDES } from './data/mockData';
import { Insumo, Proveedor } from './types';
import Filters from './components/Filters';
import InsumoTable from './components/InsumoTable';
import ProveedorCard from './components/ProveedorCard';
import SheetsOrderForm from './components/SheetsOrderForm';
import { cn } from './lib/utils';
import { dbService, Sede } from './services/db';
import { getSedes as getSheetsSedesRaw, getProveedores as getSheetsProveedores, appendPedido } from './services/googleSheets';
// @ts-ignore
import html2pdf from 'html2pdf.js';

export default function App() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [activeTab, setActiveTab] = useState('catalogo');
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProveedorId, setSelectedProveedorId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [isUpdating, setIsUpdating] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  
  // Header fields state
  const [sede, setSede] = useState(() => localStorage.getItem('order_config_sede') || '');
  const [direccionEntrega, setDireccionEntrega] = useState(() => localStorage.getItem('order_config_direccion') || '');
  const [horarioRecepcion, setHorarioRecepcion] = useState(() => localStorage.getItem('order_config_horario') || '');
  const [notas, setNotas] = useState('');
  const [responsable, setResponsable] = useState('');

  // Initial data check
  useEffect(() => {
    dbService.initializeIfEmpty(INSUMOS, PROVEEDORES, SEDES);
  }, []);

  // Initialize and Subscribe
  useEffect(() => {
    const unsubInsumos = dbService.subscribeToInsumos(setInsumos);
    const unsubProveedores = dbService.subscribeToProveedores(setProveedores);
    const unsubSedes = dbService.subscribeToSedes(setSedes);

    // SHEETS: Load sedes from Google Sheets (primary source)
    getSheetsSedesRaw().then(sheetsSedes => {
      if (sheetsSedes && sheetsSedes.length > 0) {
        setSedes(sheetsSedes.map((s, i) => ({
          id: 'sheets-sede-' + i,
          nombre: s.nombre,
          direccion: s.direccion || '',
          horario: s.horaEntrega || '',
        })));
      }
    }).catch(err => { console.warn('Sheets sedes fallback failed:', err); });

    // SHEETS: Load proveedores from Google Sheets (primary source)
    getSheetsProveedores().then(sheetProvs => {
      if (sheetProvs && sheetProvs.length > 0) {
        setProveedores(sheetProvs.map((p) => ({
          id: 'sheets-prov-' + p.nombre,
          nombre: p.nombre,
          contacto: p.asesor || '',
          email: p.correo || '',
          telefono: p.telefono || '',
          activo: true,
          categoria: '',
        })));
      }
    }).catch(err => { console.warn('Sheets proveedores fallback failed:', err); });

    
    return () => {
      unsubInsumos();
      unsubProveedores();
      unsubSedes();
    };
  }, []);
  // Separate useEffect to load insumos from Sheets
  useEffect(() => {
    // SHEETS: Load all insumos (inline fetch to Apps Script)
    (async () => {
      try {
        const scriptEndpoint = import.meta.env.VITE_APPS_SCRIPT_URL || '';
        if (!scriptEndpoint) return; console.log("[Sheets] Loading insumos v2");
        const url = scriptEndpoint + (scriptEndpoint.includes('?') ? '&' : '?') + 'action=getDatos';
        const res = await fetch(url, { redirect: 'follow' });
        const datos = await res.json();
        const artPorProv = datos.articulosPorProveedor || {};
        const today = new Date().toISOString();
        const allInsumos = [];
        Object.keys(artPorProv).forEach(sheetName => {
          (artPorProv[sheetName] || []).forEach((p, idx) => {
            allInsumos.push({
              id: sheetName + '-' + idx,
              nombre: p.articulo || '',
              categoria: p.subArticulo || sheetName,
              unidad: 'UND',
              precio: 0,
              proveedorId: 'sheets-prov-' + sheetName,
              actualizadoAt: today,
            });
          });
        });
        if (allInsumos.length > 0) setInsumos(allInsumos);
      } catch (err) {
        console.warn('Sheets insumos inline load failed:', err);
      }
    })();
  }, []);


  const handleConfigChange = (field: 'sede' | 'direccion' | 'horario', value: string) => {
    if (field === 'sede') {
      setSede(value);
      localStorage.setItem('order_config_sede', value);
      
      // Auto-fill address and schedule if it's a known sede
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
    } else if (field === 'horario') {
      setHorarioRecepcion(value);
      localStorage.setItem('order_config_horario', value);
    }
  };

  const handleQuantityChange = (id: string, value: number) => {
    setQuantities(prev => ({
      ...prev,
      [id]: Math.max(0, value)
    }));
  };

  // Derive categories from data
  const categories = useMemo(() => {
    const cats = new Set(insumos.map(i => i.categoria));
    return Array.from(cats).sort();
  }, [insumos]);

  // Filtering & Sorting Logic
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

  const handleSimulateUpdate = () => {
    setIsUpdating(true);
    setTimeout(() => setIsUpdating(false), 800);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Top Navigation */}
      <header className="bg-slate-900 text-white shadow-lg z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/20">
                <Database className="w-6 h-6 text-white" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-lg font-bold tracking-tight">InsumoMaster</h1>
                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-[0.2em]">Catalogo de Proveedores</span>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-4">
              <button 
                onClick={handleSimulateUpdate}
                disabled={isUpdating}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-800 transition-all text-slate-300 disabled:opacity-50"
              >
                <RefreshCw className={cn("w-4 h-4", isUpdating && "animate-spin")} />
                Sincronizar
              </button>
              <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-600 hover:bg-brand-700 transition-all text-white shadow-md shadow-brand-600/20">
                <Plus className="w-4 h-4" />
                Nuevo Insumo
              </button>
            </div>
          </div>
        </div>
      
      <div style={{display:"flex",gap:"8px",padding:"8px 16px",borderTop:"1px solid rgba(255,255,255,0.2)"}}>
        <button onClick={()=>setActiveTab("catalogo")} style={{padding:"8px 16px",borderRadius:"8px",border:"none",cursor:"pointer",fontWeight:"600",background:activeTab==="catalogo"?"white":"rgba(255,255,255,0.2)",color:activeTab==="catalogo"?"#1a237e":"white"}}><Database size={16} style={{display:"inline",marginRight:"4px"}} /> Catálogo Firebase</button>
        <button onClick={()=>setActiveTab("pedido-sheets")} style={{padding:"8px 16px",borderRadius:"8px",border:"none",cursor:"pointer",fontWeight:"600",background:activeTab==="pedido-sheets"?"white":"rgba(255,255,255,0.2)",color:activeTab==="pedido-sheets"?"#1a237e":"white"}}><ShoppingBag size={16} style={{display:"inline",marginRight:"4px"}} /> Pedido desde Drive</button>
      </div>
      </header>
{activeTab === "catalogo" && (
      <>

      {/* Filters Bar */}
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
      </div>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Configuration Section */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-4 flex items-center gap-2">
            <LayoutGrid className="w-4 h-4" />
            Configuración de Orden de Compra
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sede</label>
              <div className="relative">
                <select 
                  value={sede}
                  onChange={(e) => handleConfigChange('sede', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all appearance-none cursor-pointer"
                >
                  <option value="">Seleccionar Sede...</option>
                  {sedes.map(s => (
                    <option key={s.id} value={s.nombre}>{s.nombre}</option>
                  ))}
                  <option value="Otra">Otra (Manual)</option>
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                  <LayoutGrid className="w-3 h-3 text-slate-400" />
                </div>
              </div>
              {sede === 'Otra' && (
                <input 
                  type="text" 
                  autoFocus
                  placeholder="Escribir sede..."
                  onChange={(e) => setSede(e.target.value)}
                  className="mt-2 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                />
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dirección de Entrega</label>
              <input 
                type="text" 
                value={direccionEntrega}
                onChange={(e) => handleConfigChange('direccion', e.target.value)}
                placeholder="Ej: Calle 45 # 22 - 18"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider underline decoration-brand-500/30 underline-offset-2">Horario de Recepción</label>
              <input 
                type="text" 
                value={horarioRecepcion}
                onChange={(e) => handleConfigChange('horario', e.target.value)}
                placeholder="Ej: 7:00 AM - 11:00 AM"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
              />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label htmlFor="responsable" className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 block tracking-wider">
                      Nombre de quien realiza el pedido (obligatorio)
                    </label>
                    <input 
                      id="responsable"
                      type="text"
                      value={responsable}
                      onChange={(e) => setResponsable(e.target.value)}
                      placeholder="Ingresa tu nombre..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                    />
                </div>
                <div className="space-y-1.5">
                    <label htmlFor="notas" className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 block tracking-wider">
                      Notas del pedido (opcional)
                    </label>
                    <textarea 
                      id="notas"
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      placeholder="Escribe aquí notas adicionales..."
                      rows={1}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all resize-none"
                    />
                </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
             <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Orden Global</span>
                  <button 
                    onClick={async () => {
                      const val = prompt("Ingresa el nuevo número consecutivo (ej: 13 para que la siguiente sea OC-14):");
                      if (val !== null && !isNaN(parseInt(val))) {
                        await dbService.setGlobalConsecutive(parseInt(val));
                        alert("Consecutivo actualizado exitosamente.");
                      }
                    }}
                    className="text-[9px] text-brand-600 hover:underline text-left font-bold"
                  >
                    Ajustar Consecutivo
                  </button>
                  <span className="text-xs font-mono text-slate-500 italic">Sincronizado vía Firebase</span>
                </div>
             </div>
             <p className="text-[10px] text-slate-400 italic">Los datos se guardan en tiempo real en la base de datos.</p>
          </div>
        </div>

        {/* Statistics Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 statistics-row">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between overflow-hidden relative group">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Proveedores Activos</p>
              <h4 className="text-3xl font-bold text-slate-900 font-mono tracking-tighter">{proveedores.length}</h4>
            </div>
            <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
              <BarChart3 className="w-6 h-6" />
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between overflow-hidden relative group">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Insumos Registrados</p>
              <h4 className="text-3xl font-bold text-slate-900 font-mono tracking-tighter">{filteredInsumos.length}</h4>
            </div>
            <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
              <Database className="w-6 h-6" />
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between overflow-hidden relative group">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Ultima Actualización</p>
              <h4 className="text-lg font-bold text-slate-900">Hoy, 10:45 AM</h4>
            </div>
            <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Dynamic Display Mode */}
        <AnimatePresence mode="wait">
          {viewMode === 'list' ? (
            <motion.div
              key="list-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <List className="w-4 h-4" />
                  Lista Detallada
                </h2>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={async () => {
                      if (!responsable.trim()) {
                        alert("⚠ Debes ingresar el nombre de quien realiza el pedido.");
                        return;
                      }

                      const active = filteredInsumos.filter(i => (quantities[i.id] || 0) > 0);
                      if (active.length === 0) {
                        alert("No hay insumos con cantidades mayores a 0.");
                        return;
                      }

              // Get consecutive number (fallback if Firebase fails)
              let nextNumber = Math.floor(Date.now() / 1000);
              try { nextNumber = await dbService.getNextGlobalConsecutive(); } catch(eN) { console.warn("Firebase error:", eN); }
              // Save to Drive
              const fechaHoy = new Date().toISOString().split("T")[0];
              try {
                for (const itm of active) {
                  const pvN = proveedores.find(pp=>pp.id===itm.proveedorId)?.nombre || "Varios";
                  await appendPedido({fecha:fechaHoy,sede:sede||"",proveedor:pvN,articulo:itm.nombre,subArticulo:itm.categoria,cantidad:quantities[itm.id]||0,unidad:itm.unidad,responsable,correoResponsable:"",notas:notas||"",numeroOrden:nextNumber});
                }
                console.log("[Drive] Pedido guardado:", active.length, "items");
              } catch(eP) { console.warn("[Drive] Error al guardar:", eP); }

                      const proveedorName = selectedProveedorId 
                        ? proveedores.find(p => p.id === selectedProveedorId)?.nombre 
                        : "Todos los Proveedores";

                      const rows = active.map(i => `
                        <tr>
                          <td style="padding: 10px; border-bottom: 1px solid #eee;">${i.nombre}</td>
                          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${i.unidad}</td>
                          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center; font-weight: bold;">${quantities[i.id] || 0}</td>
                          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-family: monospace;">${new Intl.NumberFormat('es-MX', {style: 'currency', currency: 'MXN'}).format((quantities[i.id] || 0) * i.precio)}</td>
                        </tr>
                      `).join('');

                      const total = active.reduce((acc, i) => acc + (i.precio * (quantities[i.id] || 0)), 0);
                      const proveedorNameForPdf = selectedProveedorId
                ? (proveedores.find(p => p.id === selectedProveedorId)?.nombre || 'Varios')
                : 'Varios';
              const proveedorObjForPdf = selectedProveedorId ? proveedores.find(p => p.id === selectedProveedorId) : null;
              const fmt = (n) => new Intl.NumberFormat('es-CO', {style:'currency',currency:'COP',minimumFractionDigits:0}).format(n);
              const subtotal = active.reduce((a,i) => a + (i.precio*(quantities[i.id]||0)),0);

              // Rows: fill up to 16 rows minimum
              const itemRows = active.map((i,idx) => `
                <tr>
                  <td style="border:1px solid #ccc;padding:5px 8px;text-align:center;">${idx+1}</td>
                  <td style="border:1px solid #ccc;padding:5px 8px;">${i.nombre}${i.categoria ? ' - '+i.categoria : ''}</td>
                  <td style="border:1px solid #ccc;padding:5px 8px;text-align:center;">${quantities[i.id]||0} ${i.unidad}</td>
                  <td style="border:1px solid #ccc;padding:5px 8px;text-align:right;">${fmt(i.precio)}</td>
                  <td style="border:1px solid #ccc;padding:5px 8px;text-align:right;">${fmt((quantities[i.id]||0)*i.precio)}</td>
                </tr>`).join('');

              const emptyRows = Array(Math.max(0, 16 - active.length)).fill(0).map((_,idx) => `
                <tr>
                  <td style="border:1px solid #ccc;padding:5px 8px;text-align:center;">${active.length+idx+1}</td>
                  <td style="border:1px solid #ccc;padding:5px 8px;">&nbsp;</td>
                  <td style="border:1px solid #ccc;padding:5px 8px;">&nbsp;</td>
                  <td style="border:1px solid #ccc;padding:5px 8px;">&nbsp;</td>
                  <td style="border:1px solid #ccc;padding:5px 8px;">&nbsp;</td>
                </tr>`).join('');

              const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; color: #222; margin: 0; padding: 0; }
  .page { padding: 32px 36px; }
  .header-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; }
  .title { font-size: 28px; font-weight: 900; color: #222; margin: 0; }
  .company-info { text-align: right; font-size: 10px; line-height: 1.7; color: #444; }
  .order-meta { display: flex; gap: 40px; margin-bottom: 16px; font-size: 11px; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
  .order-meta .field { display: flex; gap: 6px; align-items: baseline; }
  .order-meta .label { font-weight: 700; white-space: nowrap; }
  .parties { display: flex; gap: 16px; margin-bottom: 16px; }
  .party-box { flex: 1; border: 1px solid #ccc; border-radius: 2px; overflow: hidden; }
  .party-header { background: #2d3f6b; color: white; font-weight: 700; font-size: 11px; padding: 6px 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  .party-body { padding: 8px 10px; line-height: 1.8; font-size: 10px; }
  .party-body .row { display: flex; gap: 6px; }
  .party-body .icon { color: #888; width: 14px; flex-shrink: 0; }
  .products-section { margin-bottom: 14px; }
  .products-header { background: #2d3f6b; color: white; padding: 7px 10px; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0; }
  .products-table { width: 100%; border-collapse: collapse; font-size: 10px; }
  .products-table thead th { background: #e8ecf4; color: #2d3f6b; border: 1px solid #ccc; padding: 6px 8px; text-align: center; font-weight: 700; text-transform: uppercase; font-size: 9px; }
  .products-table thead th.left { text-align: left; }
  .products-table tbody td { vertical-align: middle; font-size: 10px; min-height: 22px; }
  .totals-row { display: flex; justify-content: flex-end; margin-top: 0; }
  .totals-table { border-collapse: collapse; width: 260px; font-size: 10px; }
  .totals-table td { border: 1px solid #ccc; padding: 5px 10px; }
  .totals-table .tlabel { text-align: right; font-weight: 700; text-transform: uppercase; background: #f5f5f5; }
  .totals-table .tvalue { text-align: right; }
  .totals-table .grand-row td { background: #2d3f6b; color: white; font-weight: 900; font-size: 12px; }
  .comments-box { border: 1px solid #ccc; margin-top: 12px; border-radius: 2px; overflow: hidden; }
  .comments-header { background: #2d3f6b; color: white; padding: 6px 10px; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
  .comments-body { padding: 10px; min-height: 50px; font-size: 10px; line-height: 1.5; }
</style>
</head>
<body>
<div class="page">

  <!-- TOP HEADER -->
  <div class="header-top">
    <h1 class="title">Orden de compra</h1>
    <div class="company-info">
      <strong>Rocoto Restaurantes</strong><br/>
      &#x1F4CD; ${sede||'Rocoto Laureles'}, Medellín<br/>
      &#x260E; (604) 987 6543<br/>
      &#x2709; comprasrocoto@gmail.com
    </div>
  </div>

  <!-- ORDER META -->
  <div class="order-meta">
    <div class="field">
      <span class="label">N.° de orden de compra:</span>
      <span>OC-${nextNumber}</span>
    </div>
    <div class="field">
      <span class="label">Fecha:</span>
      <span>${new Date().toLocaleDateString('es-CO',{year:'numeric',month:'long',day:'numeric'})}</span>
    </div>
  </div>

  <!-- VENDEDOR / CLIENTE -->
  <div class="parties">
    <div class="party-box">
      <div class="party-header">Vendedor</div>
      <div class="party-body">
        <div style="font-weight:700;margin-bottom:4px;">${proveedorNameForPdf}</div>
        <div class="row"><span class="icon">&#x1F4CD;</span><span>${proveedorObjForPdf?.contacto||'Ver datos del proveedor'}</span></div>
        <div class="row"><span class="icon">&#x260E;</span><span>${proveedorObjForPdf?.telefono||'—'}</span></div>
        <div class="row"><span class="icon">&#x2709;</span><span>${proveedorObjForPdf?.email||'—'}</span></div>
      </div>
    </div>
    <div class="party-box">
      <div class="party-header">Cliente</div>
      <div class="party-body">
        <div style="font-weight:700;margin-bottom:4px;">Rocoto Restaurantes</div>
        <div class="row"><span class="icon">&#x1F4CD;</span><span>${direccionEntrega||'Calle 45 #22-18, Laureles, Medellín'}</span></div>
        <div class="row"><span class="icon">&#x260E;</span><span>(604) 987 6543</span></div>
        <div class="row"><span class="icon">&#x2709;</span><span>comprasrocoto@gmail.com</span></div>
      </div>
    </div>
  </div>

  <!-- PRODUCTS TABLE -->
  <div class="products-section">
    <div class="products-header">Producto o Servicio</div>
    <table class="products-table">
      <thead>
        <tr>
          <th style="width:5%;">N.°</th>
          <th class="left" style="width:50%;">Descripción</th>
          <th style="width:15%;">Cantidad</th>
          <th style="width:15%;">Precio unitario</th>
          <th style="width:15%;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
        ${emptyRows}
      </tbody>
    </table>
  </div>

  <!-- TOTALS -->
  <div class="totals-row">
    <table class="totals-table">
      <tr><td class="tlabel">Subtotal</td><td class="tvalue">${fmt(subtotal)}</td></tr>
      <tr><td class="tlabel">Impuesto</td><td class="tvalue">0 %</td></tr>
      <tr><td class="tlabel">Envío</td><td class="tvalue">${fmt(0)}</td></tr>
      <tr class="grand-row"><td class="tlabel" style="color:white;">Total</td><td class="tvalue">${fmt(subtotal)}</td></tr>
    </table>
  </div>

  <!-- COMMENTS -->
  <div class="comments-box">
    <div class="comments-header">Comentarios o instrucciones especiales</div>
    <div class="comments-body">
      ${notas||'Comentarios o instrucciones especiales'}<br/>
      <em>Solicitado por: ${responsable} &nbsp;|&nbsp; Sede destino: ${sede||'—'} &nbsp;|&nbsp; Horario recepción: ${horarioRecepcion||'—'}</em>
    </div>
  </div>

</div>
</body>
</html>`;

              const opt = {
                margin: [10, 10, 10, 10],
                filename: `OrdenCompra_OC${nextNumber}_${new Date().toISOString().split('T')[0]}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                  scale: 2,
                  useCORS: true,
                  onclone: (clonedDoc) => {
                    const styles = clonedDoc.getElementsByTagName('style');
                    for (let i = 0; i < styles.length; i++) {
                      if (styles[i].innerHTML.includes('oklch')) {
                        styles[i].innerHTML = styles[i].innerHTML.replace(/oklch\([^)]+\)/g, '#ccc');
                      }
                    }
                  }
                },
                jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
              };

              // Send email notification via Apps Script
              try {
                const appsUrl = import.meta.env.VITE_APPS_SCRIPT_URL || '';
                if (appsUrl) {
                  const emailHtml = `<h2>Nueva Orden de Compra OC-${nextNumber}</h2>
                    <p><strong>Fecha:</strong> ${fechaHoy}</p>
                    <p><strong>Sede:</strong> ${sede||'—'}</p>
                    <p><strong>Proveedor:</strong> ${proveedorNameForPdf}</p>
                    <p><strong>Solicitado por:</strong> ${responsable}</p>
                    <p><strong>Items:</strong> ${active.length} productos</p>
                    <p><strong>Total:</strong> ${fmt(subtotal)}</p>
                    <p>El pedido ha sido guardado en Google Sheets (BASE DE PEDIDOS).</p>`;
                  await fetch(appsUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({ action: 'sendEmail', nOrden: 'OC-'+nextNumber, subject: 'Nueva Orden de Compra OC-'+nextNumber+' - '+proveedorNameForPdf, htmlBody: emailHtml }),
                    redirect: 'follow',
                  });
                  console.log('[Email] Notificación enviada');
                }
              } catch(eE) { console.warn('[Email] Error:', eE); }

              html2pdf().set(opt).from(html).save();
                    }}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar PDF
                  </button>
                  <button className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1.5 transition-colors">
                    <Download className="w-3.5 h-3.5" />
                    Exportar CSV
                  </button>
                </div>
              </div>
              <InsumoTable 
                insumos={filteredInsumos} 
                proveedores={proveedores} 
                quantities={quantities}
                onQuantityChange={handleQuantityChange}
              />
            </motion.div>
          ) : (
            <motion.div
              key="grid-view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4" />
                  Paneles por Proveedor
                </h2>
              </div>
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {filteredInsumos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
              <Database className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No se encontraron resultados</h3>
            <p className="text-slate-500 max-w-sm">
              Intenta ajustar los filtros de proveedor o categoría para encontrar lo que buscas.
            </p>
            <button 
              onClick={() => {
                setSearchTerm('');
                setSelectedProveedorId('');
                setSelectedCategory('');
              }}
              className="mt-6 px-6 py-2 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 transition-all"
            >
              Limpiar todos los filtros
            </button>
          </div>
        )}
      </main>

            </>
      )}
      {activeTab === "pedido-sheets" && (
        <div style={{padding:"20px"}}><SheetsOrderForm /></div>
      )}
      <footer className="bg-white border-t border-slate-200 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-xs text-slate-400 font-medium tracking-wide uppercase">
            InsumoMaster Dashboard • {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
