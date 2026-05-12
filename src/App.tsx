import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Database, Download, RefreshCw, BarChart3, List, LayoutGrid, LogIn, LogOut, ShoppingCart, Send, FileText, CheckCircle, AlertCircle, X } from 'lucide-react';
import { Insumo, Proveedor, Pedido, ItemPedido } from './types';
import Filters from './components/Filters';
import InsumoTable from './components/InsumoTable';
import ProveedorCard from './components/ProveedorCard';
import { cn } from './lib/utils';
import { dbService, Sede } from './services/db';
import { auth } from './lib/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { fetchCatalogo } from './services/sheetsService';
import { guardarPedido, getNextNumeroPedido } from './services/pedidosService';
import { enviarCorreoPedido } from './services/emailService';
// @ts-ignore
import html2pdf from 'html2pdf.js';

type ToastType = 'success' | 'error' | 'info';
interface Toast { id: number; msg: string; type: ToastType; }

export default function App() {
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [insumos, setInsumos] = useState<Insumo[]>([]);
    const [proveedores, setProveedores] = useState<Proveedor[]>([]);
    const [sedes, setSedes] = useState<Sede[]>([]);
    const [sheetsLoading, setSheetsLoading] = useState(false);
    const [sheetsError, setSheetsError] = useState('');

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
    const [correoResponsable, setCorreoResponsable] = useState(() => localStorage.getItem('order_config_correo') || '');

  const [isSaving, setIsSaving] = useState(false);
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [lastPedido, setLastPedido] = useState<Pedido | null>(null);
    const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((msg: string, type: ToastType = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, msg, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setAuthLoading(false); });
        return () => unsub();
  }, []);

  const loadFromSheets = useCallback(async () => {
        setSheetsLoading(true);
        setSheetsError('');
        try {
                const { proveedores: ps, insumos: ins } = await fetchCatalogo();
                if (ps.length > 0) {
                          setProveedores(ps);
                          setInsumos(ins);
                          addToast(`Catalogo actualizado: ${ps.length} proveedores, ${ins.length} articulos`, 'success');
                } else {
                          throw new Error('La hoja esta vacia o la API Key no esta configurada.');
                }
        } catch (err: any) {
                setSheetsError(err.message || 'Error al cargar desde Google Sheets');
                addToast('Error al cargar desde Sheets. Usando datos locales.', 'error');
        } finally {
                setSheetsLoading(false);
        }
  }, [addToast]);

  useEffect(() => {
        if (!user) return;
        dbService.initializeIfEmpty([], [], []);
        const unsubSedes = dbService.subscribeToSedes(setSedes);
        // Try loading from Sheets, fallback to Firestore
                loadFromSheets().catch(() => {
                        const unsubInsumos = dbService.subscribeToInsumos(setInsumos);
                        const unsubProveedores = dbService.subscribeToProveedores(setProveedores);
                        return () => { unsubInsumos(); unsubProveedores(); };
                });
        return () => unsubSedes();
  }, [user, loadFromSheets]);

  const handleLogin = async () => {
        try { await signInWithPopup(auth, new GoogleAuthProvider()); }
        catch (e) { console.error(e); }
  };
    const handleLogout = async () => {
          try { await signOut(auth); }
          catch (e) { console.error(e); }
    };

  const handleConfigChange = (field: 'sede' | 'direccion' | 'horario' | 'correo', value: string) => {
        if (field === 'sede') {
                setSede(value);
                localStorage.setItem('order_config_sede', value);
                const found = sedes.find(s => s.nombre === value);
                if (found) {
                          setDireccionEntrega(found.direccion);
                          localStorage.setItem('order_config_direccion', found.direccion);
                          setHorarioRecepcion(found.horario);
                          localStorage.setItem('order_config_horario', found.horario);
                }
        } else if (field === 'direccion') {
                setDireccionEntrega(value);
                localStorage.setItem('order_config_direccion', value);
        } else if (field === 'horario') {
                setHorarioRecepcion(value);
                localStorage.setItem('order_config_horario', value);
        } else if (field === 'correo') {
                setCorreoResponsable(value);
                localStorage.setItem('order_config_correo', value);
        }
  };

  const handleQuantityChange = (id: string, value: number) => {
        setQuantities(prev => ({ ...prev, [id]: Math.max(0, value) }));
  };

  const categories = useMemo(() => {
        return Array.from(new Set(insumos.map(i => i.categoria))).sort();
  }, [insumos]);

  const filteredInsumos = useMemo<Insumo[]>(() => {
        return insumos.filter(insumo => {
                const proveedor = proveedores.find(p => p.id === insumo.proveedorId);
                const matchesSearch = !searchTerm ||
                          insumo.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          insumo.categoria.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          proveedor?.nombre.toLowerCase().includes(searchTerm.toLowerCase());
                const matchesProveedor = !selectedProveedorId || insumo.proveedorId === selectedProveedorId;
                const matchesCategory = !selectedCategory || insumo.categoria === selectedCategory;
                return matchesSearch && matchesProveedor && matchesCategory;
        }).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [insumos, proveedores, searchTerm, selectedProveedorId, selectedCategory]);

  const activeItems = useMemo((): ItemPedido[] => {
        return filteredInsumos
          .filter(i => (quantities[i.id] || 0) > 0)
          .map(i => ({
                    insumoId: i.id,
                    nombre: i.nombre,
                    categoria: i.categoria,
                    unidad: i.unidad,
                    precio: i.precio,
                    cantidad: quantities[i.id],
                    subtotal: i.precio * quantities[i.id],
          }));
  }, [filteredInsumos, quantities]);

  const totalPedido = useMemo(() => activeItems.reduce((s, i) => s + i.subtotal, 0), [activeItems]);

      const buildPedidoData = async (): Promise<Pedido | null> => {
            if (!responsable.trim()) { addToast('Ingresa el nombre del responsable.', 'error'); return null; }
            if (!correoResponsable.trim()) { addToast('Ingresa el correo del responsable.', 'error'); return null; }
            if (activeItems.length === 0) { addToast('Agrega al menos un articulo con cantidad > 0.', 'error'); return null; }
            const proveedor = proveedores.find(p => p.id === selectedProveedorId);
            const numeroPedido = await getNextNumeroPedido();
            return {
                    proveedor: proveedor?.nombre || 'Todos los Proveedores',
                    proveedorEmail: proveedor?.email || '',
                    puntoDeVenta: sede || 'Sin especificar',
                    direccionEntrega,
                    horarioRecepcion,
                    responsable,
                    correoResponsable,
                    notas,
                    fecha: new Date().toLocaleDateString('es-CO'),
                    numeroPedido,
                    items: activeItems,
                    total: totalPedido,
            };
      };

  const handleGuardarPedido = async () => {
        setIsSaving(true);
        try {
                const pedido = await buildPedidoData();
                if (!pedido) return;
                const id = await guardarPedido(pedido);
                setLastPedido({ ...pedido, id });
                addToast(`Pedido ${pedido.numeroPedido} guardado correctamente.`, 'success');
        } catch (e: any) {
                addToast('Error al guardar pedido: ' + e.message, 'error');
        } finally {
                setIsSaving(false);
        }
  };

  const handleEnviarCorreo = async () => {
        if (!lastPedido) { addToast('Primero guarda el pedido.', 'error'); return; }
        setIsSendingEmail(true);
        try {
                await enviarCorreoPedido(lastPedido);
                addToast('Correo enviado a ' + lastPedido.correoResponsable, 'success');
        } catch (e: any) {
                addToast('Error al enviar correo: ' + e.message, 'error');
        } finally {
                setIsSendingEmail(false);
        }
  };

  const handleDescargarPDF = async () => {
        const pedido = lastPedido || await buildPedidoData();
        if (!pedido) return;
        const proveedor = proveedores.find(p => p.nombre === pedido.proveedor);
        const rows = pedido.items.map(i => `<tr>
              <td style="padding:8px;border-bottom:1px solid #eee">${i.nombre}</td>
                    <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${i.unidad}</td>
                          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;font-weight:bold">${i.cantidad}</td>
                                <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;font-family:monospace">$${i.subtotal.toLocaleString('es-CO')}</td>
                                    </tr>`).join('');
        const html = `<!DOCTYPE html><html><head>
            <style>
                  @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700;900&display=swap');
                        body{font-family:'Roboto',sans-serif;color:#000;padding:0;margin:0;font-size:11px}
                              .page{padding:50px}
                                    h1{text-align:center;color:#002060;font-size:28px;font-weight:900;margin-bottom:30px}
                                          .grid{display:flex;justify-content:space-between;margin-bottom:25px}
                                                .col{width:48%}
                                                      .sh{border-bottom:2px solid #002060;padding-bottom:4px;margin-bottom:10px;font-weight:700;color:#002060;font-size:12px;text-transform:uppercase}
                                                            table.dt{width:100%;border-collapse:collapse}
                                                                  table.dt td{padding:3px 0;vertical-align:top;font-size:11px}
                                                                        .lbl{font-weight:700;width:110px;color:#000}
                                                                              .ord{display:flex;gap:30px;padding:8px 0;border-top:1px solid #eee;border-bottom:1px solid #eee;margin:15px 0}
                                                                                    .oi-lbl{font-weight:700;font-size:11px;color:#002060}
                                                                                          .oi-val{font-weight:900;font-size:16px}
                                                                                                table.it{width:100%;border-collapse:collapse;margin-bottom:15px;border:1px solid #ccc}
                                                                                                      table.it th{background:#002060;color:white;padding:9px;font-size:11px;text-align:center;font-weight:700}
                                                                                                            table.it td{border:1px solid #ccc;padding:8px 10px}
                                                                                                                  .tc{text-align:center}.tr{text-align:right}
                                                                                                                        .footer-row{display:flex;justify-content:space-between;gap:15px;align-items:flex-start;margin-top:10px}
                                                                                                                              .notes{width:55%;border:1px solid #ccc;overflow:hidden}
                                                                                                                                    .nh{background:white;padding:7px 10px;border-bottom:1px solid #ccc;font-weight:700;text-transform:uppercase;font-size:11px;color:#002060}
                                                                                                                                          .nb{padding:10px;min-height:60px;color:#333}
                                                                                                                                                .totals{width:42%}
                                                                                                                                                      table.tt{width:100%;border-collapse:collapse;border:1px solid #ccc}
                                                                                                                                                            table.tt td{border:1px solid #ccc;padding:7px 10px;font-size:11px}
                                                                                                                                                                  .tl{font-weight:700;width:50%}.tv{text-align:right;font-weight:500}
                                                                                                                                                                        .tr-tot td{background:#002060;color:white;font-weight:900;border:1px solid #002060;font-size:14px;padding:10px}
                                                                                                                                                                              .final{text-align:center;margin-top:50px;color:#2e5a9e;font-style:italic;font-size:14px;border-top:1px solid #e2e8f0;padding-top:20px}
                                                                                                                                                                                  </style></head><body><div class="page">
                                                                                                                                                                                      <h1>ORDEN DE COMPRA</h1>
                                                                                                                                                                                          <div class="grid">
                                                                                                                                                                                                <div class="col">
                                                                                                                                                                                                        <div class="sh">Datos del Proveedor</div>
                                                                                                                                                                                                                <table class="dt">
                                                                                                                                                                                                                          <tr><td class="lbl">Proveedor:</td><td>${pedido.proveedor}</td></tr>
                                                                                                                                                                                                                                    <tr><td class="lbl">Email:</td><td>${pedido.proveedorEmail || 'N/A'}</td></tr>
                                                                                                                                                                                                                                            </table>
                                                                                                                                                                                                                                                  </div>
                                                                                                                                                                                                                                                        <div class="col">
                                                                                                                                                                                                                                                                <div class="sh">Datos del Pedido</div>
                                                                                                                                                                                                                                                                        <table class="dt">
                                                                                                                                                                                                                                                                                  <tr><td class="lbl">Solicitado por:</td><td>${pedido.responsable}</td></tr>
                                                                                                                                                                                                                                                                                            <tr><td class="lbl">Correo:</td><td>${pedido.correoResponsable}</td></tr>
                                                                                                                                                                                                                                                                                                      <tr><td class="lbl">Sede:</td><td>${pedido.puntoDeVenta}</td></tr>
                                                                                                                                                                                                                                                                                                                <tr><td class="lbl">Direccion:</td><td>${pedido.direccionEntrega}</td></tr>
                                                                                                                                                                                                                                                                                                                          <tr><td class="lbl">Horario:</td><td>${pedido.horarioRecepcion}</td></tr>
                                                                                                                                                                                                                                                                                                                                  </table>
                                                                                                                                                                                                                                                                                                                                        </div>
                                                                                                                                                                                                                                                                                                                                            </div>
                                                                                                                                                                                                                                                                                                                                                <div class="ord">
                                                                                                                                                                                                                                                                                                                                                      <div><span class="oi-lbl">N ORDEN: </span><span class="oi-val">${pedido.numeroPedido}</span></div>
                                                                                                                                                                                                                                                                                                                                                            <div><span class="oi-lbl">Fecha: </span><span class="oi-val" style="font-size:14px;font-weight:400">${pedido.fecha}</span></div>
                                                                                                                                                                                                                                                                                                                                                                </div>
                                                                                                                                                                                                                                                                                                                                                                    <table class="it"><thead><tr>
                                                                                                                                                                                                                                                                                                                                                                          <th style="width:10%">CANT</th><th style="width:48%">DESCRIPCION</th>
                                                                                                                                                                                                                                                                                                                                                                                <th style="width:14%">UNIDAD</th><th style="width:14%">PRECIO</th><th style="width:14%">TOTAL</th>
                                                                                                                                                                                                                                                                                                                                                                                    </tr></thead><tbody>${rows}
                                                                                                                                                                                                                                                                                                                                                                                        ${Array(Math.max(0,3-pedido.items.length)).fill('<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>').join('')}
                                                                                                                                                                                                                                                                                                                                                                                            </tbody></table>
                                                                                                                                                                                                                                                                                                                                                                                                <div class="footer-row">
                                                                                                                                                                                                                                                                                                                                                                                                      <div class="notes"><div class="nh">Notas y Comentarios</div><div class="nb">${pedido.notas || 'Sin notas adicionales.'}</div></div>
                                                                                                                                                                                                                                                                                                                                                                                                            <div class="totals"><table class="tt">
                                                                                                                                                                                                                                                                                                                                                                                                                    <tr><td class="tl">SUBTOTAL</td><td class="tv">$${pedido.total.toLocaleString('es-CO')}</td></tr>
                                                                                                                                                                                                                                                                                                                                                                                                                            <tr><td class="tl">IVA 0%</td><td class="tv">$0</td></tr>
                                                                                                                                                                                                                                                                                                                                                                                                                                    <tr class="tr-tot"><td>TOTAL</td><td style="text-align:right">$${pedido.total.toLocaleString('es-CO')}</td></tr>
                                                                                                                                                                                                                                                                                                                                                                                                                                          </table></div>
                                                                                                                                                                                                                                                                                                                                                                                                                                              </div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                  <div class="final">Documento generado por InsumoMaster - comprasrocoto.com</div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                      </div></body></html>`;
        html2pdf().set({
                margin: 25,
                filename: `Pedido-${pedido.numeroPedido}-${pedido.proveedor.slice(0,20)}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 3, useCORS: true, onclone: (d: Document) => {
                          const styles = d.getElementsByTagName('style');
                          for (let i = 0; i < styles.length; i++) {
                                      if (styles[i].innerHTML.includes('oklch')) {
                                                    styles[i].innerHTML = styles[i].innerHTML.replace(/oklch\([^)]+\)/g, '#888');
                                      }
                          }
                }},
                jsPDF: { unit: 'mm', format: 'letter', orientation: 'landscape' }
        }).from(html).save();
  };

  if (authLoading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
              <RefreshCw className="w-8 h-8 text-brand-500 animate-spin" />
        </div>div>
      );
  
    if (!user) return (
          <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}
                          className="w-full max-w-md bg-white p-10 rounded-3xl shadow-2xl text-center">
                        <div className="w-20 h-20 bg-brand-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                                  <Database className="w-10 h-10 text-white" />
                        </div>div>
                        <h1 className="text-4xl font-extrabold text-slate-900 mb-2">InsumoMaster</h1>h1>
                        <p className="text-slate-500 mb-8">Gestion de Pedidos <span className="text-brand-600 font-bold">Rocoto</span>span></p>p>
                        <button onClick={handleLogin}
                                    className="w-full flex items-center justify-center gap-3 bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-bold text-lg transition-all">
                                  <LogIn className="w-5 h-5" /> Acceder con Google
                        </button>button>
                </motion.div>motion.div>
          </div>div>
        );
  
    return (
          <div className="min-h-screen flex flex-col bg-slate-50">
            {/* Toast Notifications */}
                <div className="fixed top-4 right-4 z-50 space-y-2">
                        <AnimatePresence>
                          {toasts.map(t => (
                        <motion.div key={t.id} initial={{opacity:0,x:60}} animate={{opacity:1,x:0}} exit={{opacity:0,x:60}}
                                        className={cn('flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium max-w-sm',
                                                                      t.type==='success'?'bg-emerald-600':t.type==='error'?'bg-red-600':'bg-blue-600')}>
                          {t.type==='success'?<CheckCircle className="w-4 h-4 shrink-0"/>:t.type==='error'?<AlertCircle className="w-4 h-4 shrink-0"/>:null}
                                      <span className="flex-1">{t.msg}</span>span>
                                      <button onClick={()=>setToasts(prev=>prev.filter(x=>x.id!==t.id))} className="ml-1 opacity-70 hover:opacity-100"><X className="w-4 h-4"/></button>button>
                        </motion.div>motion.div>
                      ))}
                        </AnimatePresence>AnimatePresence>
                </div>div>
          
            {/* Header */}
                <header className="bg-slate-900 text-white shadow-lg z-30">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                                  <div className="flex items-center justify-between h-16">
                                              <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center shadow-lg">
                                                                            <Database className="w-6 h-6 text-white" />
                                                            </div>div>
                                                            <div>
                                                                            <h1 className="text-lg font-bold">InsumoMaster</h1>h1>
                                                                            <span className="text-[10px] text-slate-400 uppercase tracking-widest">Catalogo de Proveedores</span>span>
                                                            </div>div>
                                              </div>div>
                                              <div className="flex items-center gap-3">
                                                {sheetsLoading && <RefreshCw className="w-4 h-4 text-brand-400 animate-spin" />}
                                                            <button onClick={loadFromSheets} disabled={sheetsLoading}
                                                                              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-800 transition-all text-slate-300 disabled:opacity-50">
                                                                            <RefreshCw className={cn("w-4 h-4", sheetsLoading && "animate-spin")} /> Sincronizar Sheets
                                                            </button>button>
                                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700/50">
                                                                            <div className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center text-[10px] font-bold">
                                                                              {user?.email?.charAt(0).toUpperCase()}
                                                                            </div>div>
                                                                            <span className="text-xs text-slate-300 hidden md:block">{user?.email}</span>span>
                                                            </div>div>
                                                            <button onClick={handleLogout}
                                                                              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-800 text-slate-300">
                                                                            <LogOut className="w-4 h-4" /> Salir
                                                            </button>button>
                                              </div>div>
                                  </div>div>
                        </div>div>
                </header>header></div>

      {/* Filters */}
      <div className="filters-bar">
              <Filters searchTerm={searchTerm} setSearchTerm={setSearchTerm}
                          selectedProveedorId={selectedProveedorId} setSelectedProveedorId={setSelectedProveedorId}
                          selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory}
                          viewMode={viewMode} setViewMode={setViewMode}
                          proveedores={proveedores} categories={categories} />
      </div>div>
        
              <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              
                {/* Google Sheets Error Banner */}
                {sheetsError && (
                          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                      <div>
                                                    <p className="text-sm font-semibold text-amber-800">Google Sheets no disponible</p>p>
                                                    <p className="text-xs text-amber-700 mt-1">{sheetsError}</p>p>
                                                    <p className="text-xs text-amber-600 mt-1">Tip: Configura VITE_SHEETS_API_KEY en .env.local y verifica que la hoja este publica.</p>p>
                                      </div>div>
                          </div>div>
                      )}
              
                {/* Pedido Guardado Banner */}
                {lastPedido && (
                          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
                                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                                      <div className="flex-1">
                                                    <p className="text-sm font-semibold text-emerald-800">Pedido {lastPedido.numeroPedido} guardado</p>p>
                                                    <p className="text-xs text-emerald-700">{lastPedido.proveedor} — {lastPedido.items.length} articulos — ${lastPedido.total.toLocaleString('es-CO')}</p>p>
                                      </div>div>
                                      <button onClick={handleEnviarCorreo} disabled={isSendingEmail}
                                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50">
                                                    <Send className="w-3.5 h-3.5" />{isSendingEmail ? 'Enviando...' : 'Enviar Correo'}
                                      </button>button>
                                      <button onClick={handleDescargarPDF}
                                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold">
                                                    <FileText className="w-3.5 h-3.5" /> Descargar PDF
                                      </button>button>
                          </div>div>
                      )}</div>

  {/* Order Configuration */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <LayoutGrid className="w-4 h-4" /> Configuracion del Pedido
                    </h3>h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-1.5">
                                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sede / Punto de Venta</label>label>
                                              <select value={sede} onChange={e => handleConfigChange('sede', e.target.value)}
                                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all">
                                                              <option value="">Seleccionar Sede...</option>option>
                                                {sedes.map(s => <option key={s.id} value={s.nombre}>{s.nombre}</option>option>)}
                                                              <option value="Otra">Otra (Manual)</option>option>
                                              </select>select>
                                  {sede === 'Otra' && (
                            <input type="text" autoFocus placeholder="Escribir sede..."
                                                onChange={e => setSede(e.target.value)}
                                                className="mt-2 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all" />
                          )}
                                </div>div>
                                <div className="space-y-1.5">
                                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Direccion de Entrega</label>label>
                                              <input type="text" value={direccionEntrega} onChange={e => handleConfigChange('direccion', e.target.value)}
                                                                placeholder="Ej: Calle 45 # 22 - 18"
                                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all" />
                                </div>div>
                                <div className="space-y-1.5">
                                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Horario de Recepcion</label>label>
                                              <input type="text" value={horarioRecepcion} onChange={e => handleConfigChange('horario', e.target.value)}
                                                                placeholder="Ej: 7:00 AM - 11:00 AM"
                                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all" />
                                </div>div>
                    </div>div>
                    <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Responsable del Pedido *</label>label>
                                              <input type="text" value={responsable} onChange={e => setResponsable(e.target.value)}
                                                                placeholder="Nombre completo..."
                                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all" />
                                </div>div>
                                <div className="space-y-1.5">
                                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Correo del Responsable *</label>label>
                                              <input type="email" value={correoResponsable} onChange={e => handleConfigChange('correo', e.target.value)}
                                                                placeholder="correo@empresa.com"
                                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all" />
                                </div>div>
                                <div className="space-y-1.5 md:col-span-2">
                                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Notas del Pedido (opcional)</label>label>
                                              <textarea value={notas} onChange={e => setNotas(e.target.value)}
                                                                placeholder="Instrucciones especiales, observaciones..." rows={2}
                                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all resize-none" />
                                </div>div>
                    </div>div>
          
            {/* Action Buttons */}
                    <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-3">
                                <button onClick={handleGuardarPedido} disabled={isSaving || activeItems.length === 0}
                                                className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold text-sm transition-all shadow-md shadow-brand-600/20 disabled:opacity-50 disabled:cursor-not-allowed">
                                              <ShoppingCart className="w-4 h-4" />
                                  {isSaving ? 'Guardando...' : `Guardar Pedido (${activeItems.length} items)`}
                                </button>button>
                                <button onClick={handleEnviarCorreo} disabled={!lastPedido || isSendingEmail}
                                                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                              <Send className="w-4 h-4" />
                                  {isSendingEmail ? 'Enviando...' : 'Enviar Correo'}
                                </button>button>
                                <button onClick={handleDescargarPDF} disabled={activeItems.length === 0}
                                                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                              <Download className="w-4 h-4" /> Descargar PDF
                                </button>button>
                      {activeItems.length > 0 && (
                          <span className="flex items-center text-sm text-slate-500 ml-auto">
                                          <BarChart3 className="w-4 h-4 mr-1.5" />
                            {activeItems.length} items — Total: <strong className="ml-1 text-slate-900">${totalPedido.toLocaleString('es-CO')}</strong>strong>
                          </span>span>
                                )}
                    </div>div>
          </div>div></div>

            {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 statistics-row">
                      {[
            { label: 'Proveedores', value: proveedores.length, icon: <BarChart3 className="w-6 h-6" />, color: 'text-blue-500 bg-blue-50' },
            { label: 'Insumos Filtrados', value: filteredInsumos.length, icon: <Database className="w-6 h-6" />, color: 'text-emerald-500 bg-emerald-50' },
            { label: 'Items en Pedido', value: activeItems.length, icon: <ShoppingCart className="w-6 h-6" />, color: 'text-brand-500 bg-brand-50' },
                      ].map(s => (
                                    <div key={s.label} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                                                  <div>
                                                                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>p>
                                                                  <h4 className="text-3xl font-bold text-slate-900 font-mono">{s.value}</h4>h4>
                                                  </div>div>
                                                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${s.color}`}>{s.icon}</div>div>
                                    </div>div>
                                  ))}
                    </div>div>
          
            {/* Main List / Grid */}
                  <AnimatePresence mode="wait">
                    {viewMode === 'list' ? (
                        <motion.div key="list" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} transition={{duration:0.25}}>
                                      <div className="flex items-center justify-between mb-4">
                                                      <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                                        <List className="w-4 h-4" /> Lista Detallada
                                                      </h2>h2>
                                      </div>div>
                                      <InsumoTable insumos={filteredInsumos} proveedores={proveedores} quantities={quantities} onQuantityChange={handleQuantityChange} />
                        </motion.div>motion.div>
                      ) : (
                        <motion.div key="grid" initial={{opacity:0,scale:0.98}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.98}} transition={{duration:0.25}}>
                                      <div className="flex items-center justify-between mb-4">
                                                      <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                                        <LayoutGrid className="w-4 h-4" /> Catalogo por Proveedor
                                                      </h2>h2>
                                      </div>div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                        {proveedores.filter(p => !selectedProveedorId || p.id === selectedProveedorId).map(p => (
                                            <ProveedorCard key={p.id} proveedor={p} insumos={filteredInsumos as Insumo[]}
                                                                  quantities={quantities} onQuantityChange={handleQuantityChange}
                                                                  sede={sede} direccionEntrega={direccionEntrega} horarioRecepcion={horarioRecepcion}
                                                                  notas={notas} responsable={responsable} />
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
                                  <h3 className="text-xl font-bold text-slate-900 mb-2">Sin resultados</h3>h3>
                                  <p className="text-slate-500 max-w-sm">Ajusta los filtros o sincroniza el catalogo desde Google Sheets.</p>p>
                                  <button onClick={() => { setSearchTerm(''); setSelectedProveedorId(''); setSelectedCategory(''); }}
                                                  className="mt-6 px-6 py-2 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 transition-all">
                                                Limpiar filtros
                                  </button>button>
                      </div>div>
                  )}
          </>main>
            
                  <footer className="bg-white border-t border-slate-200 py-6">
                          <div className="max-w-7xl mx-auto px-4 text-center">
                                    <p className="text-xs text-slate-400 font-medium tracking-wide uppercase">
                                                InsumoMaster — comprasrocoto.com — {new Date().getFullYear()}
                                    </p>p>
                          </div>div>
                  </footer>footer>
            </div>
              );
              }</div>
