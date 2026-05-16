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
                      const provN2 = selectedProveedorId
                ? (proveedores.find(p => p.id === selectedProveedorId)?.nombre || 'Varios')
                : 'Varios';
              const provObj2 = selectedProveedorId ? proveedores.find(p => p.id === selectedProveedorId) : null;
              const fmt2 = (n) => '$' + Number(n || 0).toLocaleString('es-CO');
              const subtotal2 = active.reduce((a,i) => a + (i.precio*(quantities[i.id]||0)),0);
              const fechaStr = new Date().toLocaleDateString('es-CO',{year:'numeric',month:'long',day:'numeric'});

              const itemRows2 = active.map((i,idx) => [
                '<tr>',
                '<td style="border:1px solid #bbb;padding:5px 7px;text-align:center;font-size:10px;">' + (idx+1) + '</td>',
                '<td style="border:1px solid #bbb;padding:5px 7px;font-size:10px;">' + i.nombre + (i.categoria ? ' - ' + i.categoria : '') + '</td>',
                '<td style="border:1px solid #bbb;padding:5px 7px;text-align:center;font-size:10px;">' + (quantities[i.id]||0) + ' ' + i.unidad + '</td>',
                '<td style="border:1px solid #bbb;padding:5px 7px;text-align:right;font-size:10px;">' + fmt2(i.precio) + '</td>',
                '<td style="border:1px solid #bbb;padding:5px 7px;text-align:right;font-size:10px;">' + fmt2((quantities[i.id]||0)*i.precio) + '</td>',
                '</tr>'
              ].join('')).join('');

              const emptyRows2 = Array(Math.max(0, 16 - active.length)).fill(0).map((_,idx) => [
                '<tr>',
                '<td style="border:1px solid #bbb;padding:5px 7px;font-size:10px;text-align:center;">' + (active.length+idx+1) + '</td>',
                '<td style="border:1px solid #bbb;padding:14px 7px;font-size:10px;">&nbsp;</td>',
                '<td style="border:1px solid #bbb;padding:5px 7px;font-size:10px;">&nbsp;</td>',
                '<td style="border:1px solid #bbb;padding:5px 7px;font-size:10px;">&nbsp;</td>',
                '<td style="border:1px solid #bbb;padding:5px 7px;font-size:10px;">&nbsp;</td>',
                '</tr>'
              ].join('')).join('');

              const html = '<!DOCTYPE html><html><head><meta charset="utf-8"/><style>' +
                'body{font-family:Arial,sans-serif;font-size:11px;color:#222;margin:0;padding:0;}' +
                '.page{padding:28px 32px;}' +
                '.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;}' +
                '.title{font-size:26px;font-weight:900;color:#111;margin:0;}' +
                '.co-info{text-align:right;font-size:9.5px;line-height:1.8;color:#555;}' +
                '.meta{display:flex;gap:36px;border-bottom:1px solid #ddd;padding-bottom:10px;margin-bottom:14px;}' +
                '.meta .lbl{font-weight:700;}' +
                '.parties{display:flex;gap:12px;margin-bottom:14px;}' +
                '.pbox{flex:1;border:1px solid #bbb;border-radius:1px;}' +
                '.pbox-hdr{background:#2d3f6b;color:white;font-weight:700;font-size:10px;padding:5px 9px;text-transform:uppercase;letter-spacing:.5px;}' +
                '.pbox-body{padding:7px 9px;line-height:1.9;font-size:9.5px;}' +
                '.sec-hdr{background:#2d3f6b;color:white;padding:6px 9px;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.5px;}' +
                'table.pt{width:100%;border-collapse:collapse;}' +
                'table.pt th{background:#dde4f0;color:#2d3f6b;border:1px solid #bbb;padding:6px 7px;font-size:9.5px;font-weight:700;text-transform:uppercase;text-align:center;}' +
                'table.pt th.tl{text-align:left;}' +
                '.totrow{display:flex;justify-content:flex-end;margin-top:2px;}' +
                'table.tt{border-collapse:collapse;width:240px;}' +
                'table.tt td{border:1px solid #bbb;padding:4px 9px;font-size:10px;}' +
                '.ttlbl{text-align:right;font-weight:700;text-transform:uppercase;background:#f0f0f0;}' +
                '.tval{text-align:right;}' +
                '.grand td{background:#2d3f6b;color:white;font-weight:900;font-size:12px;}' +
                '.cmts{border:1px solid #bbb;margin-top:10px;}' +
                '.cmts-hdr{background:#2d3f6b;color:white;padding:5px 9px;font-weight:700;font-size:10px;text-transform:uppercase;}' +
                '.cmts-body{padding:9px;min-height:44px;font-size:9.5px;line-height:1.5;}' +
                '</style></head><body><div class="page">' +
                '<div class="hdr">' +
                  '<h1 class="title">Orden de compra</h1>' +
                  '<div class="co-info">' +
                    '<strong>Rocoto Restaurantes</strong><br/>' +
                    'Dir: ' + (sede||'Rocoto Laureles') + ', Medellin<br/>' +
                    'Tel: (604) 987 6543<br/>' +
                    'Email: comprasrocoto@gmail.com' +
                  '</div>' +
                '</div>' +
                '<div class="meta">' +
                  '<span><span class="lbl">N. de orden de compra: </span>OC-' + nextNumber + '</span>' +
                  '<span><span class="lbl">Fecha: </span>' + fechaStr + '</span>' +
                '</div>' +
                '<div class="parties">' +
                  '<div class="pbox">' +
                    '<div class="pbox-hdr">Vendedor</div>' +
                    '<div class="pbox-body">' +
                      '<strong>' + provN2 + '</strong><br/>' +
                      'Tel: ' + (provObj2 ? (provObj2.telefono||'—') : '—') + '<br/>' +
                      'Email: ' + (provObj2 ? (provObj2.email||'—') : '—') +
                    '</div>' +
                  '</div>' +
                  '<div class="pbox">' +
                    '<div class="pbox-hdr">Cliente</div>' +
                    '<div class="pbox-body">' +
                      '<strong>Rocoto Restaurantes</strong><br/>' +
                      'Dir: ' + (direccionEntrega||'Calle 45 No22-18, Laureles, Medellin') + '<br/>' +
                      'Tel: (604) 987 6543<br/>' +
                      'Email: comprasrocoto@gmail.com' +
                    '</div>' +
                  '</div>' +
                '</div>' +
                '<div class="sec-hdr">Producto o Servicio</div>' +
                '<table class="pt"><thead><tr>' +
                  '<th style="width:5%;">N.</th>' +
                  '<th class="tl" style="width:50%;">Descripcion</th>' +
                  '<th style="width:15%;">Cantidad</th>' +
                  '<th style="width:15%;">Precio unitario</th>' +
                  '<th style="width:15%;">Total</th>' +
                '</tr></thead><tbody>' +
                itemRows2 + emptyRows2 +
                '</tbody></table>' +
                '<div class="totrow"><table class="tt">' +
                  '<tr><td class="ttlbl">Subtotal</td><td class="tval">' + fmt2(subtotal2) + '</td></tr>' +
                  '<tr><td class="ttlbl">Impuesto</td><td class="tval">0 %</td></tr>' +
                  '<tr><td class="ttlbl">Envio</td><td class="tval">' + fmt2(0) + '</td></tr>' +
                  '<tr class="grand"><td class="ttlbl" style="color:white;">Total</td><td class="tval">' + fmt2(subtotal2) + '</td></tr>' +
                '</table></div>' +
                '<div class="cmts">' +
                  '<div class="cmts-hdr">Comentarios o instrucciones especiales</div>' +
                  '<div class="cmts-body">' + (notas||'Sin comentarios.') + '<br/>' +
                    'Solicitado por: ' + responsable + ' | Sede: ' + (sede||'—') + ' | Horario: ' + (horarioRecepcion||'—') +
                  '</div>' +
                '</div>' +
                '</div></body></html>';

              const opt = {
                margin: [8, 8, 8, 8],
                filename: 'OrdenCompra_OC' + nextNumber + '_' + fechaHoy + '.pdf',
                image: { type: 'jpeg', quality: 0.95 },
                html2canvas: {
                  scale: 2,
                  useCORS: true,
                  logging: false,
                  onclone: (clonedDoc) => {
                    const styles = clonedDoc.getElementsByTagName('style');
                    for (let s = 0; s < styles.length; s++) {
                      if (styles[s].innerHTML.includes('oklch')) {
                        styles[s].innerHTML = styles[s].innerHTML.replace(/oklch\([^)]+\)/g, '#ccc');
                      }
                    }
                  }
                },
                jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
              };

              // Send email notification
              try {
                const appsUrl2 = import.meta.env.VITE_APPS_SCRIPT_URL || '';
                if (appsUrl2) {
                  const eHtml = '<h2>Nueva Orden OC-' + nextNumber + '</h2>' +
                    '<p><b>Fecha:</b> ' + fechaHoy + '</p>' +
                    '<p><b>Sede:</b> ' + (sede||'—') + '</p>' +
                    '<p><b>Proveedor:</b> ' + provN2 + '</p>' +
                    '<p><b>Solicitado por:</b> ' + responsable + '</p>' +
                    '<p><b>Total items:</b> ' + active.length + '</p>' +
                    '<p>Pedido guardado en Google Sheets (BASE DE PEDIDOS).</p>';
                  fetch(appsUrl2, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({ action: 'sendEmail', nOrden: 'OC-'+nextNumber, subject: 'Orden OC-'+nextNumber+' - '+provN2, htmlBody: eHtml }),
                    redirect: 'follow',
                  }).catch(eE => console.warn('[Email] Error:', eE));
                }
              } catch(eE2) { console.warn('[Email]', eE2); }

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
