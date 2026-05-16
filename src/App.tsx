// @ts-nocheck
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
import { getSedes as getSheetsSedesRaw, getProveedores as getSheetsProveedores, getProveedorSheetNames, getProductosByProveedor } from './services/googleSheets';
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

    // SHEETS: Load all insumos from all proveedor sheets
    getProveedorSheetNames().then(async (sheetNames) => {
      const today = new Date().toISOString();
      const allInsumos = [];
      for (const sheetName of sheetNames) {
        const productos = await getProductosByProveedor(sheetName);
        productos.forEach((p, idx) => {
          allInsumos.push({
            id: sheetName + '-' + idx,
            nombre: p.articulo,
            categoria: p.subArticulo || sheetName,
            unidad: 'UND',
            precio: 0,
            proveedorId: 'sheets-prov-' + sheetName,
            actualizadoAt: today,
          });
        });
      }
      if (allInsumos.length > 0) setInsumos(allInsumos);
    }).catch(err => { console.warn('Sheets insumos load failed:', err); });

    return () => {
      unsubInsumos();
      unsubProveedores();
      unsubSedes();
    };
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

                      // Get and increment consecutive number from Firebase
                      const nextNumber = await dbService.getNextGlobalConsecutive();

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
                      const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700;900&display=swap');
    body { font-family: 'Roboto', sans-serif; color: #000; padding: 0; margin: 0; font-size: 11px; }
    .page { padding: 60px; }
    
    .title-centered { text-align: center; color: #002060; font-size: 32px; font-weight: 900; margin-bottom: 40px; letter-spacing: 1px; }
    
    .flex { display: flex; }
    .justify-between { justify-content: space-between; }
    .items-center { align-items: center; }
    .gap-20 { gap: 20px; }
    
    .section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; border-bottom: 2px solid #002060; padding-bottom: 5px; }
    .section-icon { width: 32px; height: 32px; background: #002060; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0; }
    .section-title { font-weight: 700; color: #002060; font-size: 13px; text-transform: uppercase; }
    
    .data-table { border: none; width: 100%; border-collapse: collapse; }
    .data-table td { padding: 4px 0; vertical-align: top; border: none; }
    .data-label { font-weight: 700; width: 110px; color: #000; padding-right: 15px; }
    .data-value { color: #333; }
    
    .order-info-row { display: flex; align-items: flex-end; gap: 40px; margin: 25px 0; padding: 10px 0; border-top: 1px solid #eee; border-bottom: 1px solid #eee; }
    .order-info-group { display: flex; align-items: baseline; gap: 8px; }
    .order-info-label { font-weight: 700; font-size: 11px; text-transform: uppercase; color: #002060; }
    .order-info-value { font-weight: 900; font-size: 16px; color: #000; }
    .order-info-value.date { font-weight: 400; font-size: 14px; }
    
    .logistics-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; border: 1px solid #ccc; }
    .logistics-table th { background-color: #002060; color: white; padding: 8px; font-size: 11px; font-weight: 700; text-align: center; border: 1px solid #002060; }
    .logistics-table td { border: 1px solid #ccc; padding: 15px 10px; text-align: center; width: 33.33%; vertical-align: middle; min-height: 50px; }
    
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; border: 1px solid #ccc; }
    .items-table th { background-color: #002060; color: white; padding: 10px; font-size: 11px; font-weight: 700; border: 1px solid #002060; text-transform: uppercase; text-align: center; }
    .items-table td { border: 1px solid #ccc; padding: 8px 10px; text-align: left; }
    .items-table .text-center { text-align: center; }
    .items-table .text-right { text-align: right; }
    
    .footer-flex { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; }
    .comments-wrap { width: 55%; border: 1px solid #ccc; border-radius: 0; overflow: hidden; }
    .comments-header { background: white; padding: 8px 12px; border-bottom: 1px solid #ccc; font-weight: 700; text-transform: uppercase; font-size: 11px; color: #002060; }
    .comments-body { padding: 12px; min-height: 80px; line-height: 1.4; color: #333; }
    
    .totals-wrap { width: 42%; }
    .totals-table { width: 100%; border-collapse: collapse; border: 1px solid #ccc; }
    .totals-table td { border: 1px solid #ccc; padding: 8px 12px; font-size: 11px; }
    .totals-table .label { background: white; font-weight: 700; text-transform: uppercase; width: 50%; color: #000; }
    .totals-table .value { text-align: right; font-weight: 500; color: #000; }
    .totals-table .total-row td { background: #002060; color: white; font-weight: 900; border: 1px solid #002060; }
    
    .signature-area { margin-top: 60px; }
    .signature-label { font-weight: 700; color: #002060; text-transform: uppercase; font-size: 11px; margin-bottom: 30px; }
    .signature-line { width: 400px; border-bottom: 2px solid #000; margin-bottom: 5px; }
    .signature-name { text-align: center; width: 400px; font-weight: 600; font-size: 13px; text-transform: lowercase; }
    
    .final-phrase { text-align: center; margin-top: 80px; color: #2e5a9e; font-style: italic; font-size: 16px; border-top: 1px solid #e2e8f0; padding-top: 30px; }
  </style>
</head>
<body>
  <div class="page">
    <h1 class="title-centered">ORDEN DE COMPRA</h1>

    <div class="flex justify-between" style="margin-bottom: 30px;">
      <div style="width: 48%;">
        <div class="section-header">
          <div class="section-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><path d="M9 22v-4h6v4"></path><path d="M8 6h.01"></path><path d="M16 6h.01"></path><path d="M12 6h.01"></path><path d="M12 10h.01"></path><path d="M12 14h.01"></path><path d="M16 10h.01"></path><path d="M16 14h.01"></path><path d="M8 10h.01"></path><path d="M8 14h.01"></path></svg>
          </div>
          <span class="section-title">Datos del Proveedor</span>
        </div>
        <table class="data-table">
          <tr><td class="data-label">Proveedor:</td><td class="data-value">${proveedorName}</td></tr>
          <tr><td class="data-label">Contacto:</td><td class="data-value">${selectedProveedorId ? proveedores.find(p => p.id === selectedProveedorId)?.contacto || 'Varios' : 'Varios'}</td></tr>
          <tr><td class="data-label">Teléfono:</td><td class="data-value">(604) 123 4567</td></tr>
          <tr><td class="data-label">Email:</td><td class="data-value">${selectedProveedorId ? proveedores.find(p => p.id === selectedProveedorId)?.email || 'N/A' : 'Varios'}</td></tr>
          <tr><td class="data-label">Dirección:</td><td class="data-value">Cra 43A # 1-50, Medellín</td></tr>
        </table>
      </div>
      
      <div style="width: 48%;">
        <div class="section-header">
          <div class="section-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          </div>
          <span class="section-title">Datos de quien realiza el pedido</span>
        </div>
        <table class="data-table">
          <tr><td class="data-label">Solicitado por:</td><td class="data-value">${responsable}</td></tr>
          <tr><td class="data-label">ENVIAR A:</td><td class="data-value">${sede || 'Rocoto Laureles'}</td></tr>
          <tr><td class="data-label">Dirección:</td><td class="data-value"> Calle 45 #22-18, Laureles</td></tr>
          <tr><td class="data-label">Teléfono:</td><td class="data-value">(604) 987 6543</td></tr>
          <tr><td class="data-label">Email:</td><td class="data-value">comprasrocoto@gmail.com</td></tr>
        </table>
      </div>
    </div>

    <div class="order-info-row">
      <div class="order-info-group">
        <span class="order-info-label">N° ORDEN:</span>
        <span class="order-info-value">OC-${nextNumber}</span>
      </div>
      <div class="order-info-group">
        <span class="order-info-label">Fecha:</span>
        <span class="order-info-value date">${new Date().toLocaleDateString()}</span>
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 10%;">CANT</th>
          <th style="width: 45%;">DESCRIPCIÓN</th>
          <th style="width: 15%;">IMPUESTO</th>
          <th style="width: 15%;">PRECIO UNITARIO</th>
          <th style="width: 15%;">TOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${active.map((i) => `
          <tr>
            <td class="text-center">${quantities[i.id] || 0}</td>
            <td>${i.nombre} (${i.categoria})</td>
            <td class="text-center">0%</td>
            <td class="text-right">${new Intl.NumberFormat('es-MX', {style: 'currency', currency: 'MXN'}).format(i.precio)}</td>
            <td class="text-right">${new Intl.NumberFormat('es-MX', {style: 'currency', currency: 'MXN'}).format((quantities[i.id] || 0) * i.precio)}</td>
          </tr>
        `).join('')}
        ${Array(Math.max(0, 3 - active.length)).fill(0).map(() => `
          <tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>
        `).join('')}
      </tbody>
    </table>

    <div class="footer-flex">
      <div class="comments-wrap">
        <div class="comments-header">Otros Comentarios o Instrucciones Especiales</div>
        <div class="comments-body">${notas || 'Sin comentarios.'}</div>
      </div>
      
      <div class="totals-wrap">
        <table class="totals-table">
          <tr><td class="label">SUBTOTAL</td><td class="value">${new Intl.NumberFormat('es-MX', {style: 'currency', currency: 'MXN'}).format(total)}</td></tr>
          <tr><td class="label">IMPONIBLE</td><td class="value">${new Intl.NumberFormat('es-MX', {style: 'currency', currency: 'MXN'}).format(total)}</td></tr>
          <tr><td class="label">IVA 0%</td><td class="value">$0.00</td></tr>
          <tr><td class="label">IMPUESTOS</td><td class="value">$0.00</td></tr>
          <tr class="total-row">
            <td class="label" style="background:transparent;color:white;font-size:14px;padding-top:12px;padding-bottom:12px;">TOTAL</td>
            <td class="value" style="font-size:20px;padding-top:12px;padding-bottom:12px;">${new Intl.NumberFormat('es-MX', {style: 'currency', currency: 'MXN'}).format(total).replace('$', '$ ')}</td>
          </tr>
        </table>
      </div>
    </div>

  </div>
</body>
</html>
                       `;


                      const opt = {
                        margin: 30,
                        filename: `OrdenMaestra_${Date.now()}.pdf`,
                        image: { type: 'jpeg' as const, quality: 0.98 },
                        html2canvas: { 
                          scale: 3, 
                          useCORS: true,
                          onclone: (clonedDoc: Document) => {
                            // Fix for oklch error in html2canvas (Tailwind 4)
                            // Remove stylesheets that might contain oklch
                            const styles = clonedDoc.getElementsByTagName('style');
                            for (let i = 0; i < styles.length; i++) {
                              const style = styles[i];
                              if (style.innerHTML.includes('oklch')) {
                                style.innerHTML = style.innerHTML.replace(/oklch\([^)]+\)/g, '#ccc');
                              }
                            }
                          }
                        },
                        jsPDF: { unit: 'mm' as const, format: 'letter' as const, orientation: 'landscape' as const }
                      };

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
