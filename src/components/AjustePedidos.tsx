// @ts-nocheck
/**
 * AjustePedidos.tsx v4
 * Fix: PDF ahora usa la misma estructura que generarPDF en SheetsOrderForm
 * - Mismos campos (Sede, Direccion, Telefono Sede, Horario, Encargado / Proveedor, NIT, Tel, Contacto, Correo)
 * - Misma tabla (Articulo, Unidad, Cantidad, Total)
 * - Agrega nroFactura, tipoFactura, obsFactura al historial de ajustes
 * Fix: pantalla en blanco al editar - seguridad nula en lineas/codigo
 * Fix: key estable sin remount innecesario
 * Fix: validacion F-G-H del proveedor antes de generar PDF
 * Fix: carga proveedoresMeta desde Drive con campos correos/telefono/contacto
 */
import { useState, useEffect, useRef } from 'react';
import { RefreshCw, Edit3, Save, X, AlertCircle, CheckCircle, Package, Clock, Download } from 'lucide-react';
import { actualizarPedido, getProveedores, getAllDatos } from '../services/googleSheets';
import { generarPDF } from '../utils/pdfGenerator';

const ENDPOINT = 'https://script.google.com/macros/s/AKfycbzlfjOyyYCGj5AaSTScISTq3rEL3b8AB9en2LYKsbhmZ8P3goP9J15NC7QVt1ePgIAWCA/exec';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getProvMeta(proveedoresMeta, nombre) {
  if (!proveedoresMeta || !nombre) return { nit:'---', telefono:'---', correo:'---', contacto:'---' };
  var found = (proveedoresMeta || []).find(function(p){ return p.nombre === nombre; });
  if (!found) return { nit:'---', telefono:'---', correo:'---', contacto:'---' };
  return {
    nit: found.nit||'---',
    telefono: found.telefono||'---',
    correo: found.correo||'---',
    contacto: found.contacto||found.asesor||'---'
  };
}

function validarProveedorFGH(pm) {
  // F=telefono, G=correo, H=contacto/asesor
  var tel = pm.telefono && pm.telefono !== '---' ? pm.telefono.trim() : '';
  var cor = pm.correo && pm.correo !== '---' ? pm.correo.trim() : '';
  var con = pm.contacto && pm.contacto !== '---' ? pm.contacto.trim() : '';
  return !!(tel || cor || con);
}

// ─── DetalleOrden ─────────────────────────────────────────────────────────────
function DetalleOrden({ g, editandoOrden, cantidadesEdit, setCantidadesEdit, modificadoPor, setModificadoPor, obsModificacion, setObsModificacion, guardando, iniciarEdicion, guardarCambios, cancelarEdicion, proveedoresMeta, onPDFError }) {
  var isEdit = editandoOrden === g.nOrden;
  var lineas = g.lineas || [];

  var pm = getProvMeta(proveedoresMeta, g.proveedor);

  function handleDescargarPDF() {
    // Buscamos los metadatos del proveedor de forma robusta ignorando mayúsculas/minúsculas
    var pmActual = (proveedoresMeta || []).find(function(p) {
      return String(p.nombre || '').trim().toLowerCase() === String(g.proveedor || '').trim().toLowerCase();
    }) || {};

    generarPDF({
      sede: g.sede || '---',
      sedeDireccion: g.sedeDireccion || pmActual.sedeDireccion || '---',
      sedeTelefono: g.sedeTelefono || pmActual.sedeTelefono || '---',
      sedeHorario: g.sedeHorario || pmActual.sedeHorario || '---',
      encargado: g.responsable || '---',
      proveedorNombre: g.proveedor || '',
      // Mapeamos soportando ambas estructuras del useEffect
      provNit: pmActual.nit || '---',
      provTel: pmActual.telefono || pmActual.tel || '---',
      provCorreo: pmActual.correo || pmActual.email || '---',
      provContacto: pmActual.contacto || pmActual.asesor || '---',
      
      lineas: lineas.map(function(l){ 
        return { 
          articulo: l.articulo || '', 
          unidad: l.unidad || '', 
          cantidad: parseFloat(String(l.cantidad || 0)) || 0, 
          // Pasamos el valor real si existe para que no multiplique por cero
          valorUnitario: parseFloat(String(l.valorUnitario || 0)) || 0, 
          codigo: l.codigo || '' 
        }; 
      }),
      notas: lineas[0] ? lineas[0].observaciones || '' : '',
      medioPago: g.medioPago || 'contado',
      numeroOrden: g.nOrden,
      nroFactura: g.nroFactura || '',
      tipoFactura: g.tipoFactura || '',
      obsFactura: g.obsFactura || '',
      numeroPedidoSistema: g.numeroPedidoSistema || ''
    });
  }
  
  return (
    <div className="px-4 pb-4 bg-slate-50/50">
      {/* Info del pedido */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-xl bg-white border border-slate-100 text-xs mb-3">
        {[{l:'Orden',v:'#'+g.nOrden},{l:'Fecha',v:g.fecha},{l:'Sede',v:g.sede},{l:'Responsable',v:g.responsable}].map(function(x){
          return (<div key={x.l}><div className="font-bold uppercase tracking-wider text-slate-400 mb-0.5">{x.l}</div><div className="font-semibold text-slate-700">{x.v||'---'}</div></div>);
        })}
      </div>

      {/* Campo modificado por — SIEMPRE presente en DOM, visible solo en isEdit */}
      <div style={{display: isEdit ? 'block' : 'none'}} className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-bold text-amber-700 uppercase block mb-1">Modificado por *</label>
            <input type="text" value={modificadoPor} onChange={function(e){setModificadoPor(e.target.value); localStorage.setItem('ped_responsable', e.target.value);}}
              className="w-full px-2 py-1.5 bg-white border border-amber-200 rounded-lg text-xs focus:outline-none focus:border-amber-500" placeholder="Tu nombre..."/>
          </div>
          <div>
            <label className="text-[10px] font-bold text-amber-700 uppercase block mb-1">Motivo del ajuste</label>
            <input type="text" value={obsModificacion} onChange={function(e){setObsModificacion(e.target.value);}}
              className="w-full px-2 py-1.5 bg-white border border-amber-200 rounded-lg text-xs focus:outline-none focus:border-amber-500" placeholder="Ej: Error en cantidad..."/>
          </div>
        </div>
      </div>

      {/* Tabla articulos */}
      <div className="rounded-xl overflow-hidden border border-slate-200 mb-3">
        <table className="w-full text-xs">
          <thead><tr style={{background:'#1a3c6e'}}>
            <th className="py-2 px-3 text-left text-white font-bold uppercase">Codigo</th>
            <th className="py-2 px-3 text-left text-white font-bold uppercase">Articulo</th>
            <th className="py-2 px-3 text-center text-white font-bold uppercase w-20">Unidad</th>
            <th className="py-2 px-3 text-center text-white font-bold uppercase w-32">Cantidad</th>
          </tr></thead>
          <tbody>
            {lineas.length === 0 && (
              <tr><td colSpan={4} className="py-4 text-center text-slate-400 text-xs">Sin artículos en este pedido.</td></tr>
            )}
            {lineas.map(function(l, i){
              var codigo = l.codigo || ('linea_' + i);
              var cantActual = isEdit ? (cantidadesEdit[codigo] !== undefined ? cantidadesEdit[codigo] : (l.cantidad || 0)) : (l.cantidad || 0);
              var cantOriginal = parseFloat(String(l.cantidad || 0)) || 0;
              var cantEdit = parseFloat(String(cantidadesEdit[codigo] !== undefined ? cantidadesEdit[codigo] : cantOriginal)) || 0;
              var cambio = isEdit && cantEdit !== cantOriginal;
              return (
                <tr key={codigo + '_' + i} className={'border-b border-slate-100 ' + (cambio?'bg-amber-50':i%2===0?'bg-white':'bg-slate-50')}>
                  <td className="py-1.5 px-3 font-mono text-slate-500">{l.codigo||'---'}</td>
                  <td className="py-1.5 px-3 font-medium text-slate-800">{l.articulo||'---'}</td>
                  <td className="py-1.5 px-3 text-center text-slate-500">{l.unidad||'---'}</td>
                  <td className="py-1.5 px-3 text-center">
                    {isEdit ? (
                      <div className="flex items-center gap-1 justify-center">
                        <button onClick={function(){
                          var v = Math.max(0, parseFloat(String(cantidadesEdit[codigo] !== undefined ? cantidadesEdit[codigo] : cantOriginal)) - 1);
                          setCantidadesEdit(function(p){ return Object.assign({},p,{[codigo]:v}); });
                        }} className="w-6 h-6 rounded bg-slate-200 hover:bg-slate-300 font-bold text-slate-600 text-sm">-</button>
                        <input type="number" min="0" step="0.01" value={cantActual}
                          onChange={function(e){
                            var v = e.target.value;
                            setCantidadesEdit(function(p){ return Object.assign({},p,{[codigo]:v}); });
                          }}
                          className={"w-16 text-center py-1 border rounded text-xs font-bold focus:outline-none " + (cambio?'border-amber-400 bg-amber-50':'border-slate-200 focus:border-cyan-500')}/>
                        <button onClick={function(){
                          var v = parseFloat(String(cantidadesEdit[codigo] !== undefined ? cantidadesEdit[codigo] : cantOriginal)) + 1;
                          setCantidadesEdit(function(p){ return Object.assign({},p,{[codigo]:v}); });
                        }} className="w-6 h-6 rounded bg-cyan-500 hover:bg-cyan-600 font-bold text-white text-sm">+</button>
                        {cambio && <span className="text-[9px] text-amber-600 font-bold ml-1">({cantOriginal})</span>}
                      </div>
                    ) : (
                      <span className="font-bold text-blue-800">{cantOriginal % 1 === 0 ? cantOriginal : cantOriginal.toFixed(2)}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Botones */}
      <div className="flex gap-2 flex-wrap">
        {!isEdit ? (
          <>
            <button onClick={function(){ iniciarEdicion(g); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white" style={{background:'#1a3c6e'}}>
              <Edit3 className="w-3.5 h-3.5"/> Editar cantidades
            </button>
            <button onClick={handleDescargarPDF}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-700">
              <Download className="w-3.5 h-3.5"/> Descargar PDF
            </button>
          </>
        ) : (
          <>
            <button onClick={function(){ guardarCambios(g); }} disabled={guardando}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50">
              <Save className="w-3.5 h-3.5"/>{guardando?'Guardando...':'Guardar cambios'}
            </button>
            <button onClick={cancelarEdicion}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200">
              <X className="w-3.5 h-3.5"/> Cancelar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
function getSemaforoAP(g) {
  var tieneFactura = g.nroFactura && g.nroFactura.trim() !== '';
  var tieneNPS = g.numeroPedidoSistema && g.numeroPedidoSistema.trim() !== '';
  if (tieneFactura && tieneNPS) return '🟢';
  return '🔴';
}

export default function AjustePedidos() {
  var [grupos, setGrupos] = useState([]);
  var [cargando, setCargando] = useState(false);
  var [err, setErr] = useState('');
  var [success, setSuccess] = useState('');
  var [expandido, setExpandido] = useState(null);
  var [editandoOrden, setEditandoOrden] = useState(null);
  var [cantidadesEdit, setCantidadesEdit] = useState({});
  var [modificadoPor, setModificadoPor] = useState(function(){ return localStorage.getItem('ped_responsable') || ''; });
  var [obsModificacion, setObsModificacion] = useState('');
  var [guardando, setGuardando] = useState(false);
  var [filtroSede, setFiltroSede] = useState('');
  var [filtroProveedor, setFiltroProveedor] = useState('');
  var [filtroEstadoAP, setFiltroEstadoAP] = useState('todos');
  var [proveedoresMeta, setProveedoresMeta] = useState([]);

  useEffect(function(){
    cargarPendientes();
    // Cargar meta proveedores desde Drive (F=telefono, G=correo, H=asesor/contacto)
    getProveedores()
      .then(function(ps){ if (ps && ps.length > 0) setProveedoresMeta(ps); })
      .catch(function(e){ console.warn('[proveedoresMeta]', e.message); });
    // Tambien intentar via getAllDatos para datos mas completos
    getAllDatos()
      .then(function(datos){
        var provMeta = datos && datos.proveedores;
        if (provMeta && provMeta.length > 0) {
          setProveedoresMeta(provMeta.map(function(p, idx){
            return {
              id: 'prov-' + idx,
              nombre: p.nombre||'',
              nit: p.nit||'',
              telefono: p.telefono||'',
              correo: p.correo||'',
              asesor: p.asesor||'',
              contacto: p.contacto||p.asesor||'',
              medioPago: ''
            };
          }));
        }
      })
      .catch(function(e){ console.warn('[getAllDatos prov]', e.message); });
  }, []);

  async function cargarPendientes() {
    setCargando(true); setErr(''); setGrupos([]);
    try {
      var res = await fetch(ENDPOINT + '?action=getAjustes', { redirect: 'follow' });
      if (!res.ok) { setErr('Error HTTP ' + res.status + ' al cargar pedidos.'); return; }
      var data = await res.json();
      if (!data.ok) { setErr(data.error || 'Error cargando pedidos pendientes.'); return; }
      var rows = data.rows || [];
      var mapa = {};
      rows.forEach(function(r) {
        if (!Array.isArray(r)) return;
        var nOrden = String(r[0] || '');
        if (!nOrden) return;
        if (!mapa[nOrden]) {
          mapa[nOrden] = {
            nOrden,
            fecha: String(r[1]||'---').split('T')[0]||String(r[1]||'---'),
            sede: String(r[2]||'---'),
            proveedor: String(r[3]||'---'),
            responsable: String(r[9]||'---'),
            medioPago: String(r[11]||'contado'),
            nroFactura: String(r[13]||''),
            tipoFactura: String(r[14]||''),
            obsFactura: String(r[15]||''),
            numeroPedidoSistema: String(r[16]||''),
            lineas: []
          };
        }
        if (r[4] || r[5]) {
          mapa[nOrden].lineas.push({
            nOrden,
            fecha: mapa[nOrden].fecha,
            sede: mapa[nOrden].sede,
            proveedor: mapa[nOrden].proveedor,
            codigo: String(r[4]||''),
            articulo: String(r[5]||''),
            unidad: String(r[6]||''),
            cantidad: parseFloat(String(r[7]||'0'))||0,
            responsable: mapa[nOrden].responsable,
            observaciones: String(r[10]||''),
            medioPago: mapa[nOrden].medioPago,
          });
        }
      });
      setGrupos(Object.values(mapa).reverse());
    } catch(e) { setErr('Error: ' + (e.message||'Error de red')); }
    finally { setCargando(false); }
  }

  function iniciarEdicion(g) {
    var cants = {};
    var lineas = g.lineas || [];
    lineas.forEach(function(l){
      var key = l.codigo || ('linea_idx');
      cants[key] = l.cantidad || 0;
    });
    // Primero actualizar cantidades, luego activar edicion
    setCantidadesEdit(cants);
    setObsModificacion('');
    // Usar setTimeout para asegurar que el estado se actualice antes de mostrar el editor
    setTimeout(function(){ setEditandoOrden(g.nOrden); }, 0);
  }

  function cancelarEdicion() {
    setEditandoOrden(null);
    setCantidadesEdit({});
  }

  async function guardarCambios(g) {
    if (!modificadoPor.trim()) { alert('Ingresa tu nombre en "Modificado por".'); return; }
    setGuardando(true); setErr(''); setSuccess('');
    var errores = 0;
    var lineas = g.lineas || [];
    for (var i = 0; i < lineas.length; i++) {
      var linea = lineas[i];
      var codigo = linea.codigo || '';
      var nuevaCant = parseFloat(String(cantidadesEdit[codigo] !== undefined ? cantidadesEdit[codigo] : linea.cantidad));
      if (isNaN(nuevaCant)) nuevaCant = linea.cantidad || 0;
      if (nuevaCant === (linea.cantidad || 0)) continue;
      try {
        var r = await actualizarPedido({ nOrden: g.nOrden, codigo, cantidad: nuevaCant, modificadoPor, obsModificacion });
        if (!r.ok) { console.warn('Error ajuste:', r.error); errores++; }
      } catch(e2) { console.warn('[ajuste]', e2.message); errores++; }
    }
    setGuardando(false);
    setEditandoOrden(null);
    setCantidadesEdit({});
    if (errores > 0) { setErr(errores + ' linea(s) no pudieron actualizarse.'); }
    else { setSuccess('Cambios guardados exitosamente en Drive.'); setTimeout(function(){ setSuccess(''); }, 5000); }
    await cargarPendientes();
  }

  var sedesDisp = [...new Set(grupos.map(function(g){ return g.sede; }))].filter(Boolean).sort();
  var provDisp = [...new Set(grupos.map(function(g){ return g.proveedor; }))].filter(Boolean).sort();
  var gruposFiltrados = grupos.filter(function(g){
    var pasaSede = !filtroSede || g.sede === filtroSede;
    var pasaProv = !filtroProveedor || g.proveedor === filtroProveedor;
    var sem = getSemaforoAP(g);
    var pasaEstado = filtroEstadoAP === 'todos' || (filtroEstadoAP === 'pendientes' && sem === '🔴') || (filtroEstadoAP === 'completados' && sem === '🟢');
    return pasaSede && pasaProv && pasaEstado;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
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
          <div className="flex gap-2 mt-2">
            <button onClick={function(){ setFiltroEstadoAP('todos'); }} className={"px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all " + (filtroEstadoAP==='todos'?'bg-slate-700 text-white border-slate-700':'bg-white text-slate-600 border-slate-200 hover:border-slate-400')}>Todos</button>
            <button onClick={function(){ setFiltroEstadoAP('pendientes'); }} className={"px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all " + (filtroEstadoAP==='pendientes'?'bg-red-600 text-white border-red-600':'bg-white text-slate-600 border-slate-200 hover:border-red-400')}>🔴 Pendientes</button>
            <button onClick={function(){ setFiltroEstadoAP('completados'); }} className={"px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all " + (filtroEstadoAP==='completados'?'bg-green-600 text-white border-green-600':'bg-white text-slate-600 border-slate-200 hover:border-green-400')}>🟢 Completados</button>
          </div>
        </div>

        {/* Mensajes */}
        {err && <div className="p-4"><div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm"><AlertCircle className="w-4 h-4 flex-shrink-0"/>{err}</div></div>}
        {success && <div className="p-4"><div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-700 text-sm"><CheckCircle className="w-4 h-4 flex-shrink-0"/>{success}</div></div>}
        {cargando && <div className="p-8 text-center text-slate-400 text-sm">Cargando pedidos pendientes...</div>}
        {!cargando && grupos.length === 0 && !err && (
          <div className="p-8 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
            <Package className="w-8 h-8 text-slate-300"/>
            <span>No hay pedidos pendientes.</span>
            <span className="text-xs">Los pedidos sin factura aparecen aqui.</span>
          </div>
        )}

        {/* Lista */}
        {!cargando && gruposFiltrados.length > 0 && (
          <div className="divide-y divide-slate-100 max-h-[800px] overflow-y-auto">
            {gruposFiltrados.map(function(g) {
              var isOpen = expandido === g.nOrden;
              return (
                <div key={g.nOrden}>
                  {/* Fila resumen */}
                  <button onClick={function(){
                    if (isOpen) {
                      setExpandido(null);
                      setEditandoOrden(null);
                      setCantidadesEdit({});
                    } else {
                      setExpandido(g.nOrden);
                    }
                  }} className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold" style={{background:'#1a3c6e'}}>
                        {(g.sede||'X').charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-800 truncate">{g.proveedor}</div>
                        <div className="text-xs text-slate-500">{g.sede} · {g.fecha} · {(g.lineas||[]).length} art.
                          <span className={"ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold " + (g.medioPago==='credito'?'bg-amber-100 text-amber-700':'bg-emerald-100 text-emerald-700')}>{g.medioPago}</span>
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-700 inline-flex items-center gap-0.5"><Clock className="w-2.5 h-2.5"/> Pendiente</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-slate-400 font-mono hidden sm:block">#{g.nOrden}</span>
                      <span className="text-base leading-none" title={"Semáforo: " + getSemaforoAP(g)}>{getSemaforoAP(g)}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1a3c6e" strokeWidth="3" strokeLinecap="round" className={"transition-transform "+(isOpen?'rotate-180':'')}><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                  </button>

                  {/* Detalle - key ESTABLE en g.nOrden, sin remount por estado de edicion */}
                  {isOpen && (
                    <DetalleOrden
                      key={g.nOrden}
                      g={g}
                      editandoOrden={editandoOrden}
                      cantidadesEdit={cantidadesEdit}
                      setCantidadesEdit={setCantidadesEdit}
                      modificadoPor={modificadoPor}
                      setModificadoPor={setModificadoPor}
                      obsModificacion={obsModificacion}
                      setObsModificacion={setObsModificacion}
                      guardando={guardando}
                      iniciarEdicion={iniciarEdicion}
                      guardarCambios={guardarCambios}
                      cancelarEdicion={cancelarEdicion}
                      proveedoresMeta={proveedoresMeta}
                      onPDFError={function(msg){ setErr(msg); }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Leyenda */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700">
        <p className="font-bold mb-1">Acerca de este modulo</p>
        <p>Aqui se muestran todos los pedidos <strong>sin factura registrada</strong>. Puedes editar las cantidades antes de confirmar la recepcion. Los cambios quedan registrados en Drive con fecha, hora y nombre del responsable.</p>
      </div>
    </div>
  );
    }
