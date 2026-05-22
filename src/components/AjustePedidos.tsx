// @ts-nocheck
/**
 * AjustePedidos.tsx
 * Módulo independiente para editar pedidos pendientes
 * - Lista pedidos sin factura (pendientes)
 * - Edición de cantidades con decimales
 * - Control de cambios: quién/cuándo/qué
 * - Sincronización directa con Drive
 */
import { useState, useEffect } from 'react';
import { RefreshCw, Edit3, Save, X, AlertCircle, CheckCircle, Package, Clock } from 'lucide-react';
import { actualizarPedido } from '../services/googleSheets';

const ENDPOINT = 'https://script.google.com/macros/s/AKfycbzlfjOyyYCGj5AaSTScISTq3rEL3b8AB9en2LYKsbhmZ8P3goP9J15NC7QVt1ePgIAWCA/exec';

interface LineaPedido {
  nOrden: string;
  fecha: string;
  sede: string;
  proveedor: string;
  codigo: string;
  articulo: string;
  unidad: string;
  cantidad: number;
  responsable: string;
  observaciones: string;
  medioPago: string;
}

interface GrupoPedido {
  nOrden: string;
  fecha: string;
  sede: string;
  proveedor: string;
  responsable: string;
  medioPago: string;
  lineas: LineaPedido[];
}

export default function AjustePedidos() {
  var [grupos, setGrupos] = useState<GrupoPedido[]>([]);
  var [cargando, setCargando] = useState(false);
  var [err, setErr] = useState('');
  var [success, setSuccess] = useState('');
  var [expandido, setExpandido] = useState<string | null>(null);
  var [editandoOrden, setEditandoOrden] = useState<string | null>(null);
  var [cantidadesEdit, setCantidadesEdit] = useState<Record<string, number | string>>({});
  var [modificadoPor, setModificadoPor] = useState(function(){ return localStorage.getItem('ped_responsable') || ''; });
  var [obsModificacion, setObsModificacion] = useState('');
  var [guardando, setGuardando] = useState(false);
  var [filtroSede, setFiltroSede] = useState('');
  var [filtroProveedor, setFiltroProveedor] = useState('');

  useEffect(function(){ cargarPendientes(); }, []);

  async function cargarPendientes() {
    setCargando(true); setErr(''); setGrupos([]);
    try {
      var res = await fetch(ENDPOINT + '?action=getAjustes', { redirect: 'follow' });
      var data = await res.json();
      if (!data.ok) { setErr(data.error || 'Error cargando pedidos pendientes.'); return; }
      var rows = data.rows || [];
      var mapa: Record<string, GrupoPedido> = {};
      rows.forEach(function(r: any[]) {
        var nOrden = String(r[0] || '');
        if (!nOrden) return;
        if (!mapa[nOrden]) {
          mapa[nOrden] = {
            nOrden, fecha: String(r[1]||'---').split('T')[0]||String(r[1]||'---'),
            sede: String(r[2]||'---'), proveedor: String(r[3]||'---'),
            responsable: String(r[9]||'---'), medioPago: String(r[11]||'contado'), lineas: []
          };
        }
        if (r[4] || r[5]) {
          mapa[nOrden].lineas.push({
            nOrden, fecha: mapa[nOrden].fecha, sede: mapa[nOrden].sede, proveedor: mapa[nOrden].proveedor,
            codigo: String(r[4]||''), articulo: String(r[5]||''),
            unidad: String(r[6]||''), cantidad: parseFloat(String(r[7]||'0'))||0,
            responsable: mapa[nOrden].responsable,
            observaciones: String(r[10]||''), medioPago: mapa[nOrden].medioPago,
          });
        }
      });
      setGrupos(Object.values(mapa).reverse());
    } catch(e: any) { setErr('Error: ' + e.message); }
    finally { setCargando(false); }
  }

  function iniciarEdicion(g: GrupoPedido) {
    var cants: Record<string, number | string> = {};
    g.lineas.forEach(function(l){ cants[l.codigo] = l.cantidad; });
    setCantidadesEdit(cants);
    setObsModificacion('');
    setEditandoOrden(g.nOrden);
  }

  async function guardarCambios(g: GrupoPedido) {
    if (!modificadoPor.trim()) { alert('Ingresa tu nombre en "Modificado por".'); return; }
    setGuardando(true); setErr(''); setSuccess('');
    var errores = 0;
    for (var i = 0; i < g.lineas.length; i++) {
      var linea = g.lineas[i];
      var nuevaCant = parseFloat(String(cantidadesEdit[linea.codigo] || linea.cantidad));
      if (isNaN(nuevaCant)) nuevaCant = linea.cantidad;
      if (nuevaCant === linea.cantidad) continue; // sin cambio
      try {
        var r = await actualizarPedido({ nOrden: g.nOrden, codigo: linea.codigo, cantidad: nuevaCant, modificadoPor, obsModificacion });
        if (!r.ok) { console.warn('Error ajuste:', r.error); errores++; }
      } catch(e2: any) { console.warn('[ajuste]', e2.message); errores++; }
    }
    setGuardando(false);
    setEditandoOrden(null);
    if (errores > 0) { setErr(errores + ' línea(s) no pudieron actualizarse.'); }
    else { setSuccess('Cambios guardados exitosamente en Drive.'); setTimeout(function(){ setSuccess(''); }, 5000); }
    await cargarPendientes();
  }

  var sedesDisp = [...new Set(grupos.map(function(g){ return g.sede; }))].filter(Boolean).sort();
  var provDisp  = [...new Set(grupos.map(function(g){ return g.proveedor; }))].filter(Boolean).sort();
  var gruposFiltrados = grupos.filter(function(g){
    return (!filtroSede || g.sede === filtroSede) && (!filtroProveedor || g.proveedor === filtroProveedor);
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-5">

      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4" style={{background:'#1a3c6e'}}>
          <div className="flex items-center gap-3">
            <Edit3 className="w-5 h-5 text-blue-300"/>
            <div>
              <div className="text-white font-bold text-sm">Ajuste de Pedidos</div>
              <div className="text-blue-300 text-xs">{gruposFiltrados.length} pedido(s) pendiente(s) de factura</div>
            </div>
          </div>
          <button onClick={cargarPendientes} disabled={cargando}
            className="flex items-center gap-1.5 text-xs text-blue-200 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 transition-all disabled:opacity-50">
            <RefreshCw className={"w-3.5 h-3.5 " + (cargando?'animate-spin':'')}/>{cargando?'Cargando...':'Actualizar'}
          </button>
        </div>

        {/* Filtros */}
        <div className="p-4 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row gap-2">
            <select value={filtroSede} onChange={function(e){setFiltroSede(e.target.value);}}
              className="flex-1 py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500">
              <option value="">Todas las sedes</option>
              {sedesDisp.map(function(s){ return <option key={s} value={s}>{s}</option>; })}
            </select>
            <select value={filtroProveedor} onChange={function(e){setFiltroProveedor(e.target.value);}}
              className="flex-1 py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500">
              <option value="">Todos los proveedores</option>
              {provDisp.map(function(p){ return <option key={p} value={p}>{p}</option>; })}
            </select>
          </div>
        </div>

        {/* Mensajes */}
        {err && <div className="p-4"><div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm"><AlertCircle className="w-4 h-4 flex-shrink-0"/>{err}</div></div>}
        {success && <div className="p-4"><div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-700 text-sm"><CheckCircle className="w-4 h-4 flex-shrink-0"/>{success}</div></div>}
        {cargando && <div className="p-8 text-center text-slate-400 text-sm">Cargando pedidos pendientes...</div>}
        {!cargando && grupos.length === 0 && !err && <div className="p-8 text-center text-slate-400 text-sm flex flex-col items-center gap-2"><Package className="w-8 h-8 text-slate-300"/><span>No hay pedidos pendientes.</span><span className="text-xs">Los pedidos sin factura aparecen aquí.</span></div>}

        {/* Lista de pedidos */}
        {!cargando && gruposFiltrados.length > 0 && (
          <div className="divide-y divide-slate-100 max-h-[800px] overflow-y-auto">
            {gruposFiltrados.map(function(g) {
              var isOpen = expandido === g.nOrden;
              var isEdit = editandoOrden === g.nOrden;
              return (
                <div key={g.nOrden}>
                  {/* Fila resumen */}
                  <button onClick={function(){ setExpandido(isOpen ? null : g.nOrden); if(!isOpen) setEditandoOrden(null); }}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold" style={{background:'#1a3c6e'}}>
                        {(g.sede||'X').charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-800 truncate">{g.proveedor}</div>
                        <div className="text-xs text-slate-500">{g.sede} · {g.fecha} · {g.lineas.length} art.
                          <span className={"ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold " + (g.medioPago==='credito'?'bg-amber-100 text-amber-700':'bg-emerald-100 text-emerald-700')}>{g.medioPago}</span>
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-700 flex-shrink-0 inline-flex items-center gap-0.5"><Clock className="w-2.5 h-2.5"/> Pendiente</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-slate-400 font-mono hidden sm:block">#{g.nOrden}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1a3c6e" strokeWidth="3" strokeLinecap="round" className={"transition-transform "+(isOpen?'rotate-180':'')}><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                  </button>

                  {/* Detalle expandido */}
                  {isOpen && (
                    <div className="px-4 pb-4 bg-slate-50/50">
                      {/* Info del pedido */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-xl bg-white border border-slate-100 text-xs mb-3">
                        {[{l:'Orden',v:'#'+g.nOrden},{l:'Fecha',v:g.fecha},{l:'Sede',v:g.sede},{l:'Responsable',v:g.responsable}].map(function(x){
                          return (<div key={x.l}><div className="font-bold uppercase tracking-wider text-slate-400 mb-0.5">{x.l}</div><div className="font-semibold text-slate-700">{x.v}</div></div>);
                        })}
                      </div>

                      {/* Campo modificado por */}
                      {isEdit && (
                        <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-bold text-amber-700 uppercase block mb-1">Modificado por *</label>
                              <input type="text" value={modificadoPor} onChange={function(e){setModificadoPor(e.target.value); localStorage.setItem('ped_responsable', e.target.value);}}
                                className="w-full px-2 py-1.5 bg-white border border-amber-200 rounded-lg text-xs focus:outline-none focus:border-amber-500" placeholder="Tu nombre..."/>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-amber-700 uppercase block mb-1">Motivo del ajuste</label>
                              <input type="text" value={obsModificacion} onChange={function(e){setObsModificacion(e.target.value);}}
                                className="w-full px-2 py-1.5 bg-white border border-amber-200 rounded-lg text-xs focus:outline-none focus:border-amber-500" placeholder="Ej: Error en cantidad, precio..."/>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Tabla artículos */}
                      <div className="rounded-xl overflow-hidden border border-slate-200 mb-3">
                        <table className="w-full text-xs">
                          <thead><tr style={{background:'#1a3c6e'}}>
                            <th className="py-2 px-3 text-left text-white font-bold uppercase">Código</th>
                            <th className="py-2 px-3 text-left text-white font-bold uppercase">Artículo</th>
                            <th className="py-2 px-3 text-center text-white font-bold uppercase w-20">Unidad</th>
                            <th className="py-2 px-3 text-center text-white font-bold uppercase w-32">Cantidad</th>
                          </tr></thead>
                          <tbody>
                            {g.lineas.map(function(l, i){
                              var cantActual = isEdit ? (cantidadesEdit[l.codigo] !== undefined ? cantidadesEdit[l.codigo] : l.cantidad) : l.cantidad;
                              var cambio = isEdit && parseFloat(String(cantidadesEdit[l.codigo]||l.cantidad)) !== l.cantidad;
                              return (
                                <tr key={l.codigo||i} className={'border-b border-slate-100 ' + (cambio?'bg-amber-50':i%2===0?'bg-white':'bg-slate-50')}>
                                  <td className="py-1.5 px-3 font-mono text-slate-500">{l.codigo}</td>
                                  <td className="py-1.5 px-3 font-medium text-slate-800">{l.articulo}</td>
                                  <td className="py-1.5 px-3 text-center text-slate-500">{l.unidad||'---'}</td>
                                  <td className="py-1.5 px-3 text-center">
                                    {isEdit ? (
                                      <div className="flex items-center gap-1 justify-center">
                                        <button onClick={function(){
                                          var v = Math.max(0, parseFloat(String(cantidadesEdit[l.codigo]||l.cantidad))-1);
                                          setCantidadesEdit(function(p){ return Object.assign({},p,{[l.codigo]:v}); });
                                        }} className="w-6 h-6 rounded bg-slate-200 hover:bg-slate-300 font-bold text-slate-600 text-sm">-</button>
                                        <input type="number" min="0" step="0.01" value={cantActual}
                                          onChange={function(e){
                                            var v = e.target.value;
                                            setCantidadesEdit(function(p){ return Object.assign({},p,{[l.codigo]:v}); });
                                          }}
                                          className={"w-16 text-center py-1 border rounded text-xs font-bold focus:outline-none " + (cambio?'border-amber-400 bg-amber-50':'border-slate-200 focus:border-cyan-500')}/>
                                        <button onClick={function(){
                                          var v = parseFloat(String(cantidadesEdit[l.codigo]||l.cantidad))+1;
                                          setCantidadesEdit(function(p){ return Object.assign({},p,{[l.codigo]:v}); });
                                        }} className="w-6 h-6 rounded bg-cyan-500 hover:bg-cyan-600 font-bold text-white text-sm">+</button>
                                        {cambio && <span className="text-[9px] text-amber-600 font-bold ml-1">({l.cantidad}→{parseFloat(String(cantidadesEdit[l.codigo]||l.cantidad)).toFixed(2).replace(/.00$/,'')})</span>}
                                      </div>
                                    ) : (
                                      <span className="font-bold text-blue-800">{l.cantidad % 1 === 0 ? l.cantidad : l.cantidad.toFixed(2)}</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Botones de acción */}
                      <div className="flex gap-2 flex-wrap">
                        {!isEdit ? (
                          <button onClick={function(){ iniciarEdicion(g); }}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white" style={{background:'#1a3c6e'}}>
                            <Edit3 className="w-3.5 h-3.5"/> Editar cantidades
                          </button>
                        ) : (
                          <>
                            <button onClick={function(){ guardarCambios(g); }} disabled={guardando}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50">
                              <Save className="w-3.5 h-3.5"/>{guardando?'Guardando...':'Guardar cambios'}
                            </button>
                            <button onClick={function(){ setEditandoOrden(null); setCantidadesEdit({}); }}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200">
                              <X className="w-3.5 h-3.5"/> Cancelar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Leyenda */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700">
        <p className="font-bold mb-1">ℹ️ Acerca de este módulo</p>
        <p>Aquí se muestran todos los pedidos <strong>sin factura registrada</strong>. Puedes editar las cantidades antes de confirmar la recepción. Los cambios quedan registrados en Drive con fecha, hora y nombre del responsable.</p>
      </div>
    </div>
  );
}
