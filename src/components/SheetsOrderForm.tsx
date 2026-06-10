// @ts-nocheck
/**
 * SheetsOrderForm.tsx v35 - fix: semaforo Completado = hasFact && hasNPS (sin requerir obsFactura)
 * - Metadata (factura, NPS) se lee de TODAS las filas, no solo la primera
 * - key estables en lista y contenido expandido eliminan error insertBefore
 */
import { useState, useEffect, useRef } from 'react';
import { ShoppingCart, User, Truck, RefreshCw, Save, Download, AlertCircle, CheckCircle, Search, Filter, FileText, Edit3, Archive } from 'lucide-react';
import { getProveedorSheetNames,  getProveedores,  getProductosByProveedor, getProductosConMinMax,  getSubfamiliasByProveedor,  getSedes,  appendPedido, invalidarCache, actualizarFactura, actualizarNumeroPedidoSistema, getAllDatos} from '../services/googleSheets';
import { generarPDF } from '../utils/pdfGenerator';

const ENDPOINT = 'https://script.google.com/macros/s/AKfycbzlfjOyyYCGj5AaSTScISTq3rEL3b8AB9en2LYKsbhmZ8P3goP9J15NC7QVt1ePgIAWCA/exec';

function validarProveedorFGH(provMeta) {
  if (!provMeta) return false;
  var tel = (provMeta.telefono || '').trim().replace(/^-+$/, '');
  var cor = (provMeta.correo || '').trim().replace(/^-+$/, '');
  var con = ((provMeta.contacto || provMeta.asesor || '')).trim().replace(/^-+$/, '');
  return !!(tel || cor || con);
}

function generarCSV(pedido) {
  var arts = (pedido.articulos || []).filter(function(a) { return a.codigo && (parseFloat(a.cantidad) || 0) > 0; });
  if (arts.length === 0) { alert('Este pedido no tiene informacion para exportar.'); return; }
  var lines = ['sep=;','codigo;cantidad'];
  arts.forEach(function(a) { lines.push(String(a.codigo) + ';' + String(parseFloat(a.cantidad) || 0)); });
  var csv = lines.join('\n');
  var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var link = document.createElement('a');
  link.href = url;
  link.download = 'pedido_' + pedido.nOrden + '.csv';
  link.click();
  setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
}

// Semáforo para HistorialPedidos
function getSemaforoHP(p) {
  var hasFact = !!(p.nroFactura && String(p.nroFactura).trim() && p.nroFactura !== '---');
  var hasDoc = !!(p.obsFactura && String(p.obsFactura).trim() && p.obsFactura !== '---');
  var hasNPS = !!(p.numeroPedidoSistema && String(p.numeroPedidoSistema).trim() && p.numeroPedidoSistema !== '---');
  if (hasFact && hasNPS) return '🟢';
  if (hasFact || hasNPS) return '🟡';
  return '🔴';
}

// ─── HistorialPedidos ─────────────────────────────────────────────────────────
function HistorialPedidos({ proveedoresMeta }) {
  var [sedeFiltro, setSedeFiltro] = useState('');
  var [articuloBusq, setArticuloBusq] = useState('');
  var [cargando, setCargando] = useState(false);
  var [pedidos, setPedidos] = useState([]);
  var [sedesDisp, setSedesDisp] = useState([]);
  var [err, setErr] = useState('');
  var [expandido, setExpandido] = useState(null);
  var [editandoDoc, setEditandoDoc] = useState(null);
  var [editDataDoc, setEditDataDoc] = useState({});
  var [guardandoDoc, setGuardandoDoc] = useState(false);
  var [filtroEstadoDoc, setFiltroEstadoDoc] = useState('todos');
  var [editandoFactura, setEditandoFactura] = useState(null);
  var [facturaData, setFacturaData] = useState({});
  var [idBusq, setIdBusq] = useState('');
  var [idResultado, setIdResultado] = useState(null);
  var [idBuscando, setIdBuscando] = useState(false);
  var [idErr, setIdErr] = useState('');
  var [editandoNPS, setEditandoNPS] = useState(null);
  var [npsData, setNpsData] = useState({});
  var [guardandoNPS, setGuardandoNPS] = useState(false);
  var [busqHP, setBusqHP] = useState('');
  var [fechaDesdeHP, setFechaDesdeHP] = useState('');
  var [fechaHastaHP, setFechaHastaHP] = useState('');

  useEffect(function() { cargarHistorial(); }, []);

  useEffect(function() {
    if (!idBusq.trim()) { setIdResultado(null); setIdErr(''); return; }
    var id = idBusq.trim();
    setIdBuscando(true); setIdResultado(null); setIdErr('');
    (async function() {
      try {
        var res = await fetch(ENDPOINT + '?action=getHistorial', { redirect: 'follow' });
        if (!res.ok) { setIdErr('Error HTTP ' + res.status); return; }
        var data = await res.json();
        if (!data.ok) { setIdErr(data.error || 'Error consultando historial.'); return; }
        var rows = (data.rows || []).filter(function(r) { return Array.isArray(r) && String(r[0]||'') === id; });
        if (rows.length === 0) { setIdResultado([]); return; }
        setIdResultado(rows);
      } catch(e) { setIdErr('Error: ' + (e.message||'Error de red')); }
      finally { setIdBuscando(false); }
    })();
  }, [idBusq]);

  async function cargarHistorial() {
    setCargando(true); setErr('');
    try {
      var res = await fetch(ENDPOINT + '?action=getHistorial', { redirect: 'follow' });
      if (!res.ok) { setErr('Error HTTP ' + res.status); return; }
      var data = await res.json();
      if (!data.ok) { setErr(data.error || 'Error cargando historial.'); return; }
      var rows = data.rows || [];
      var mapa = {};
      rows.forEach(function(r) {
        if (!Array.isArray(r)) return;
        var nOrden = String(r[0] || '');
        if (!nOrden) return;
        if (!mapa[nOrden]) {
          mapa[nOrden] = {
            nOrden, fecha: String(r[1]||'---').split('GMT')[0].trim().split('T')[0]||String(r[1]||'---'),
            sede: String(r[2]||'---'), proveedor: String(r[3]||'---'),
            responsable: String(r[9]||'---'), medioPago: String(r[11]||'contado'),
            observaciones: String(r[10]||''),
            nroFactura: String(r[13]||''), tipoFactura: String(r[14]||''), obsFactura: String(r[15]||''),
            numeroPedidoSistema: String(r[16]||''),
            notaCredito: String(r[17]||''),
            fechaEntrega: String(r[12]||''),
            articulos: []
          };
        }
        if (r[5] || r[4]) {
          mapa[nOrden].articulos.push({
            codigo: String(r[4]||''), articulo: String(r[5]||''),
            unidad: String(r[6]||''), cantidad: String(r[7]||''),
          });
        }
        // update metadata from any row
        if (r[13] && String(r[13]).trim() && String(r[13]).trim() !== '---') mapa[nOrden].nroFactura = String(r[13]).trim();
        if (r[14] && String(r[14]).trim() && String(r[14]).trim() !== '---') mapa[nOrden].tipoFactura = String(r[14]).trim();
        if (r[15] && String(r[15]).trim() && String(r[15]).trim() !== '---') mapa[nOrden].obsFactura = String(r[15]).trim();
        if (r[16] && String(r[16]).trim() && String(r[16]).trim() !== '---') mapa[nOrden].numeroPedidoSistema = String(r[16]).trim();
        if (r[17] && String(r[17]).trim() && String(r[17]).trim() !== '---') mapa[nOrden].notaCredito = String(r[17]).trim();
        if (r[12] && String(r[12]).trim() && String(r[12]).trim() !== '---') mapa[nOrden].fechaEntrega = String(r[12]).trim();
      });
      var lista = Object.values(mapa).reverse();
      var sds = [...new Set(lista.map(function(p){ return p.sede; }))].filter(Boolean).sort();
      setSedesDisp(sds);
      // Solo pedidos SIN número de pedido sistema asignado
      setPedidos(lista.filter(function(p) { return !p.numeroPedidoSistema || p.numeroPedidoSistema.trim() === '' || p.numeroPedidoSistema === '---'; }));
    } catch(e) { setErr('Error: ' + (e.message||'Error de red')); }
    finally { setCargando(false); }
  }


  async function guardarFactura(nOrden) {
    var fd = facturaData[nOrden] || {};
    try {
      await actualizarFactura({ nOrden, nroFactura: fd.nroFactura||'', tipoFactura: fd.tipoFactura||'contado', obsFactura: fd.obsFactura||'', notaCredito: fd.notaCredito||'', fechaEntrega: fd.fechaEntrega||'' });
      setEditandoFactura(null);
      await cargarHistorial();
    } catch(e) { alert('Error guardando factura: ' + (e.message||'Error')); }
  }

  async function guardarNumeroPedidoSistema(nOrden) {
    var nps = (npsData[nOrden] || '').trim();
    if (!nps) { alert('Ingresa el Número de Pedido (Sistema) para continuar.'); return; }
    setGuardandoNPS(true);
    try {
      var result = await actualizarNumeroPedidoSistema({ nOrden, numeroPedidoSistema: nps });
      if (!result.ok) {
        alert('Error guardando: ' + (result.error || 'Error desconocido'));
        return;
      }
            setEditandoNPS(null);
            await cargarHistorial();
    } catch(e) { alert('Error: ' + (e.message||'Error de red')); }
    finally { setGuardandoNPS(false); }
  }

  function getProvMeta(nombre) {
    if (!proveedoresMeta || !nombre) return { nit:'---', telefono:'---', correo:'---', contacto:'---' };
    var found = proveedoresMeta.find(function(p){ return p.nombre === nombre; });
    if (!found) return { nit:'---', telefono:'---', correo:'---', contacto:'---' };
    return { nit: found.nit||'---', telefono: found.telefono||'---', correo: found.correo||'---', contacto: found.contacto||found.asesor||'---' };
  }

  var pedidosFiltrados = pedidos.filter(function(p) {
    var pasaSede = !sedeFiltro || p.sede === sedeFiltro;
    var q = busqHP.trim().toLowerCase();
    var pasaBusq = !q || (
      (p.proveedor||'').toLowerCase().includes(q) ||
      p.articulos.some(function(a){ return (a.articulo||'').toLowerCase().includes(q)||(a.codigo||'').toLowerCase().includes(q); }) ||
      (p.nroFactura||'').toLowerCase().includes(q) ||
      (p.numeroPedidoSistema||'').toLowerCase().includes(q)
    );
    var pasaFecha = (!fechaDesdeHP || p.fecha >= fechaDesdeHP) && (!fechaHastaHP || p.fecha <= fechaHastaHP);
    var sem = getSemaforoHP(p);
    var pasaEstado = filtroEstadoDoc === 'todos' || (filtroEstadoDoc === 'pendientes' && (sem === '🔴' || sem === '🟡')) || (filtroEstadoDoc === 'completados' && sem === '🟢');
    return pasaSede && pasaBusq && pasaFecha && pasaEstado;
  });;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4" style={{background:'#1a3c6e'}}>
        <div className="flex items-center gap-3">
          <Search className="w-5 h-5 text-blue-300"/>
          <div>
            <div className="text-white font-bold text-sm">Historial de Pedidos</div>
            <div className="text-blue-300 text-xs">{cargando ? 'Cargando...' : pedidos.length + ' ordenes pendientes de documentar'}</div>
          </div>
        </div>
        <button onClick={cargarHistorial} disabled={cargando}
          className="flex items-center gap-1.5 text-xs text-blue-200 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 transition-all disabled:opacity-50">
          <RefreshCw className={"w-3.5 h-3.5 " + (cargando?'animate-spin':'')}/>{cargando?'Cargando...':'Actualizar'}
        </button>
      </div>
      <div className="p-4 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row gap-2 mb-2">
          <select value={sedeFiltro} onChange={function(e){setSedeFiltro(e.target.value);}}
            className="flex-1 py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500">
            <option value="">Todas las sedes</option>
            {sedesDisp.map(function(s){ return (<option key={s} value={s}>{s}</option>); })}
          </select>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"/>
            <input type="text" value={busqHP} onChange={function(e){setBusqHP(e.target.value);}}
              placeholder="Buscar por proveedor, artículo, factura o N° sistema..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"/>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mb-2">
          <div className="flex items-center gap-2 flex-1">
            <label className="text-xs text-slate-500 whitespace-nowrap">Desde:</label>
            <input type="date" value={fechaDesdeHP} onChange={function(e){setFechaDesdeHP(e.target.value);}}
              className="flex-1 py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"/>
          </div>
          <div className="flex items-center gap-2 flex-1">
            <label className="text-xs text-slate-500 whitespace-nowrap">Hasta:</label>
            <input type="date" value={fechaHastaHP} onChange={function(e){setFechaHastaHP(e.target.value);}}
              className="flex-1 py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"/>
          </div>
          {(fechaDesdeHP || fechaHastaHP) && <button onClick={function(){ setFechaDesdeHP(''); setFechaHastaHP(''); }} className="px-3 py-1.5 text-xs text-slate-500 hover:text-red-500 border border-slate-200 rounded-xl bg-white">✕ Limpiar</button>}
        </div>
        <div className="flex gap-2">
          <button onClick={function(){ setFiltroEstadoDoc('todos'); }} className={"px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all " + (filtroEstadoDoc==='todos'?'bg-slate-700 text-white border-slate-700':'bg-white text-slate-600 border-slate-200 hover:border-slate-400')}>Todos</button>
          <button onClick={function(){ setFiltroEstadoDoc('pendientes'); }} className={"px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all " + (filtroEstadoDoc==='pendientes'?'bg-red-600 text-white border-red-600':'bg-white text-slate-600 border-slate-200 hover:border-red-400')}>🔴 Pendientes</button>
          <button onClick={function(){ setFiltroEstadoDoc('completados'); }} className={"px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all " + (filtroEstadoDoc==='completados'?'bg-green-600 text-white border-green-600':'bg-white text-slate-600 border-slate-200 hover:border-green-400')}>🟢 Completados</button>
          {(sedeFiltro || busqHP || fechaDesdeHP || fechaHastaHP || filtroEstadoDoc !== 'todos') && <span className="ml-auto text-xs text-slate-500 self-center">{pedidosFiltrados.length} resultado(s)</span>}
        </div>
      </div>

            {err && <div className="p-4"><div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm"><AlertCircle className="w-4 h-4 flex-shrink-0"/>{err}</div></div>}
      {cargando && <div className="p-8 text-center text-slate-400 text-sm">Cargando historial...</div>}
      {!cargando && pedidos.length === 0 && !err && <div className="p-8 text-center text-slate-400 text-sm">No hay pedidos pendientes. Todos los pedidos han sido documentados.</div>}
      {!cargando && pedidosFiltrados.length > 0 && (
        <div key='historial-list' className="divide-y divide-slate-100 max-h-[700px] overflow-y-auto">
          {pedidosFiltrados.map(function(p) {
            var isOpen = expandido === p.nOrden;
            var isEditFac = editandoFactura === p.nOrden;
            var isEditNPS = editandoNPS === p.nOrden;
            var fd = facturaData[p.nOrden] || { nroFactura: p.nroFactura, tipoFactura: p.tipoFactura||'contado', obsFactura: p.obsFactura, notaCredito: p.notaCredito||'' };
            var artsVis = articuloBusq ? p.articulos.filter(function(a){ return (a.articulo||'').toLowerCase().includes(articuloBusq.toLowerCase())||(a.codigo||'').toLowerCase().includes(articuloBusq.toLowerCase()); }) : p.articulos;
            var pm = getProvMeta(p.proveedor);
            return (
              <div key={p.nOrden}>
                <button onClick={function(){ setExpandido(isOpen?null:p.nOrden); }}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold" style={{background:'#1a3c6e'}}>
                      {(p.sede||'X').charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-800 truncate">{p.proveedor}</div>
                      <div className="text-xs text-slate-500">{p.sede} · {p.fecha} · {p.articulos.length} art.
                        {p.medioPago && <span className={"ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold "+(p.medioPago==='credito'?'bg-amber-100 text-amber-700':'bg-emerald-100 text-emerald-700')}>{p.medioPago}</span>}
                        {p.nroFactura && <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">Fact: {p.nroFactura}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-slate-400 font-mono hidden sm:block">#{p.nOrden}</span>
                      <span title={getSemaforoHP(p)} style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:'22px',height:'22px',borderRadius:'50%',fontWeight:700,fontSize:'14px',background:getColorSemaforo(getSemaforoHP(p)),boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}}>{getSemaforoHP(p)}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1a3c6e" strokeWidth="3" strokeLinecap="round" className={"transition-transform "+(isOpen?'rotate-180':'')}><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 bg-slate-50/50">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-xl bg-white border border-slate-100 text-xs flex-1">
                        {[{l:'Orden',v:'#'+p.nOrden},{l:'Fecha',v:p.fecha},{l:'Sede',v:p.sede},{l:'Responsable',v:p.responsable},{l:'Medio Pago',v:p.medioPago||'---'}].map(function(x){
                          return (<div key={x.l}><div className="font-bold uppercase tracking-wider text-slate-400 mb-0.5">{x.l}</div><div className="font-semibold text-slate-700">{x.v}</div></div>);
                        })}
                      </div>
                      <button onClick={function(e){ e.stopPropagation();
                        generarPDF({ sede:p.sede, sedeDireccion:'---', sedeTelefono:'---', sedeHorario:'---', encargado:p.responsable,
                          proveedorNombre:p.proveedor, provNit:pm.nit, provTel:pm.telefono, provCorreo:pm.correo, provContacto:pm.contacto,
                          lineas:p.articulos.map(function(a){ return {articulo:a.articulo,unidad:a.unidad||'',cantidad:Number(a.cantidad)||0,valorUnitario:0,codigo:a.codigo||''}; }),
                          notas:p.observaciones||'', medioPago:p.medioPago||'contado', numeroOrden:p.nOrden,
                          nroFactura:p.nroFactura||'', tipoFactura:p.tipoFactura||'', obsFactura:p.obsFactura||'',
                          numeroPedidoSistema:p.numeroPedidoSistema||'', notaCredito:p.notaCredito||'' });
                      }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white shadow-sm flex-shrink-0 hover:opacity-90 transition-opacity" style={{background:'#1a3c6e'}}>
                        <Download className="w-3.5 h-3.5"/> PDF
                      </button>
                      <button onClick={function(e){ e.stopPropagation(); generarCSV(p); }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white shadow-sm flex-shrink-0 hover:opacity-90 transition-opacity" style={{background:'#0f6b3a'}}>
                        <Download className="w-3.5 h-3.5"/> CSV
                      </button>
                    </div>
                    <div className="rounded-xl overflow-hidden border border-slate-200 mb-3">
                      <table className="w-full text-xs">
                        <thead><tr style={{background:'#1a3c6e'}}>
                          <th className="py-2 px-3 text-left text-white font-bold uppercase">Codigo</th>
                          <th className="py-2 px-3 text-left text-white font-bold uppercase">Articulo</th>
                          <th className="py-2 px-3 text-center text-white font-bold uppercase w-16">Cant.</th>
                          <th className="py-2 px-3 text-center text-white font-bold uppercase w-20">Unidad</th>
                        </tr></thead>
                        <tbody>
                          {artsVis.map(function(a,i){
                            return (<tr key={i} className={'border-b border-slate-100 '+(i%2===0?'bg-white':'bg-slate-50')}>
                              <td className="py-1.5 px-3 font-mono text-slate-500">{a.codigo}</td>
                              <td className="py-1.5 px-3 font-medium text-slate-800">{a.articulo}</td>
                              <td className="py-1.5 px-3 text-center font-bold text-blue-800">{a.cantidad}</td>
                              <td className="py-1.5 px-3 text-center text-slate-500">{a.unidad||'---'}</td>
                            </tr>);
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Datos de Factura */}
                    <div className="rounded-xl border border-slate-200 bg-white p-3 mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-600"/>
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Datos de Factura</span>
                        </div>
                        {!isEditFac && (
                          <button onClick={function(){
                            setFacturaData(function(prev){ var n=Object.assign({},prev); n[p.nOrden]={nroFactura:p.nroFactura||'',tipoFactura:p.tipoFactura||'contado',obsFactura:p.obsFactura||'',notaCredito:p.notaCredito||'',fechaEntrega:p.fechaEntrega||''}; return n; });
                            setEditandoFactura(p.nOrden);
                          }} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold">
                            <Edit3 className="w-3 h-3"/> Editar
                          </button>
                        )}
                      </div>
                      {!isEditFac ? (
                        <div className="grid grid-cols-3 gap-3 text-xs">
                          <div><div className="font-bold text-slate-400 uppercase mb-0.5">N. Factura</div><div className="text-slate-700">{p.nroFactura||'---'}</div></div>
                          <div><div className="font-bold text-slate-400 uppercase mb-0.5">Tipo</div><div className="text-slate-700">{p.tipoFactura||'---'}</div></div>
                          <div><div className="font-bold text-slate-400 uppercase mb-0.5">Observacion</div><div className="text-slate-700">{p.obsFactura||'---'}</div></div>
                          <div className="col-span-3"><div className="font-bold text-slate-400 uppercase mb-0.5">Nota de crédito</div><div className="text-slate-700">{p.notaCredito||'---'}</div></div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">N. Factura</label>
                              <input type="text" value={fd.nroFactura||''} onChange={function(e){ setFacturaData(function(prev){ var n=Object.assign({},prev); n[p.nOrden]=Object.assign({},n[p.nOrden]||{},{nroFactura:e.target.value}); return n; }); }}
                                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-500" placeholder="Ej: FAC-001"/>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Tipo</label>
                              <select value={fd.tipoFactura||'contado'} onChange={function(e){ setFacturaData(function(prev){ var n=Object.assign({},prev); n[p.nOrden]=Object.assign({},n[p.nOrden]||{},{tipoFactura:e.target.value}); return n; }); }}
                                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-500">
                                <option value="contado">Contado</option>
                                <option value="credito">Credito</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Observacion de Factura</label>
                            <input type="text" value={fd.obsFactura||''} onChange={function(e){ setFacturaData(function(prev){ var n=Object.assign({},prev); n[p.nOrden]=Object.assign({},n[p.nOrden]||{},{obsFactura:e.target.value}); return n; }); }}
                              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-500"
                              placeholder="Ej: Pedido incompleto, diferencia en cantidades..."/>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">Nota de crédito</label>
                            <input type="text" value={fd.notaCredito||''} onChange={function(e){ setFacturaData(function(prev){ var n=Object.assign({},prev); n[p.nOrden]=Object.assign({},n[p.nOrden]||{},{notaCredito:e.target.value}); return n; }); }} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-400" placeholder="Ej: NC-001..."/>
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button onClick={function(){ guardarFactura(p.nOrden); }}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{background:'#1a3c6e'}}>Guardar</button>
                            <button onClick={function(){ setEditandoFactura(null); }}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200">Cancelar</button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Número de Pedido Sistema - NUEVO CAMPO */}
                    <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Archive className="w-4 h-4 text-amber-600"/>
                          <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Número de Pedido (Sistema)</span>
                          <span className="text-[10px] text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">Al asignar, pasa a Histórico de Pedidos</span>
                        </div>
                        {!isEditNPS && !p.numeroPedidoSistema && (
                          <button onClick={function(){
                            setNpsData(function(prev){ var n=Object.assign({},prev); n[p.nOrden]=''; return n; });
                            setEditandoNPS(p.nOrden);
                          }} className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 font-semibold border border-amber-300 rounded-lg px-2 py-1">
                            <Edit3 className="w-3 h-3"/> Asignar
                          </button>
                        )}
                      </div>
                      {!isEditNPS ? (
                        <div className="text-xs text-amber-700">
                          {p.numeroPedidoSistema && p.numeroPedidoSistema !== '---'
                            ? <span className="font-bold text-green-700">✅ {p.numeroPedidoSistema}</span>
                            : <span className="text-amber-600 italic">Sin asignar — Este pedido aún no ha sido documentado</span>}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div>
                            <label className="text-[10px] font-bold text-amber-700 uppercase block mb-1">Número de Pedido en el Sistema *</label>
                            <input type="text" value={npsData[p.nOrden]||''} onChange={function(e){ setNpsData(function(prev){ var n=Object.assign({},prev); n[p.nOrden]=e.target.value; return n; }); }}
                              className="w-full px-2 py-1.5 bg-white border-2 border-amber-300 rounded-lg text-xs focus:outline-none focus:border-amber-500 font-mono"
                              placeholder="Ej: PED-2024-001, ORD-123, etc."
                              disabled={guardandoNPS}
                              onKeyDown={function(e){ if(e.key==='Enter') guardarNumeroPedidoSistema(p.nOrden); }}
                            />
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button onClick={function(){ guardarNumeroPedidoSistema(p.nOrden); }}
                              disabled={guardandoNPS || !(npsData[p.nOrden]||'').trim()}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50" style={{background:'#92400e'}}>
                              {guardandoNPS ? <RefreshCw className="w-3 h-3 animate-spin"/> : <Archive className="w-3 h-3"/>}
                              {guardandoNPS ? 'Guardando...' : 'Guardar y Documentar'}
                            </button>
                            <button onClick={function(){ setEditandoNPS(null); }}
                              disabled={guardandoNPS}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 disabled:opacity-50">Cancelar</button>
                          </div>
                        </div>
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
  );
}

// ─── HistorialDocumentado ─────────────────────────────────────────────────────
// Semaforo para HistorialDocumentado
function getSemaforoHD(p) {
  var hasFact = !!(p.nroFactura && String(p.nroFactura).trim() && p.nroFactura !== '---');
  var hasDoc = !!(p.obsFactura && String(p.obsFactura).trim() && p.obsFactura !== '---');
  var hasNPS = !!(p.numeroPedidoSistema && String(p.numeroPedidoSistema).trim() && p.numeroPedidoSistema !== '---');
  if (hasFact && hasNPS) return '🟢';
  if (hasFact || hasNPS) return '🟡';
  return '🔴';
}

// Helper: color de fondo para semaforo visual
function getColorSemaforo(em) {
  if (em === '🟢') return '#00c853';
  if (em === '🟡') return '#ffea00';
  return '#ff4d4d';
}

export function HistorialDocumentado({ proveedoresMeta }) {
  var [sedeFiltro, setSedeFiltro] = useState('');
  var [articuloBusq, setArticuloBusq] = useState('');
  var [cargando, setCargando] = useState(false);
  var [pedidos, setPedidos] = useState([]);
  var [sedesDisp, setSedesDisp] = useState([]);
  var [err, setErr] = useState('');
  var [expandido, setExpandido] = useState(null);
  var [editandoDoc, setEditandoDoc] = useState(null);
  var [editDataDoc, setEditDataDoc] = useState({});
  var [guardandoDoc, setGuardandoDoc] = useState(false);
  var [filtroEstadoDoc, setFiltroEstadoDoc] = useState('todos');
  var [busqHD, setBusqHD] = useState('');
  var [fechaDesdeHD, setFechaDesdeHD] = useState('');
  var [fechaHastaHD, setFechaHastaHD] = useState('');

  useEffect(function() { cargarDocumentados(); }, []);

  async function cargarDocumentados() {
    setCargando(true); setErr(''); setPedidos([]);
    try {
      var res = await fetch(ENDPOINT + '?action=getHistorial', { redirect: 'follow' });
      if (!res.ok) { setErr('Error HTTP ' + res.status); return; }
      var data = await res.json();
      if (!data.ok) { setErr(data.error || 'Error cargando historial.'); return; }
      var rows = data.rows || [];
      var mapa = {};
      rows.forEach(function(r) {
        if (!Array.isArray(r)) return;
        var nOrden = String(r[0] || '');
        if (!nOrden) return;
        if (!mapa[nOrden]) {
          mapa[nOrden] = {
            nOrden, fecha: String(r[1]||'---').split('GMT')[0].trim().split('T')[0]||String(r[1]||'---'),
            sede: String(r[2]||'---'), proveedor: String(r[3]||'---'),
            responsable: String(r[9]||'---'), medioPago: String(r[11]||'contado'),
            observaciones: String(r[10]||''),
            nroFactura: String(r[13]||''), tipoFactura: String(r[14]||''), obsFactura: String(r[15]||''),
            numeroPedidoSistema: String(r[16]||''),
            notaCredito: String(r[17]||''),
            articulos: []
          };
        }
        if (r[5] || r[4]) {
          mapa[nOrden].articulos.push({
            codigo: String(r[4]||''), articulo: String(r[5]||''),
            unidad: String(r[6]||''), cantidad: String(r[7]||''),
          });
        }
        // update metadata from any row
        if (r[13] && String(r[13]).trim() && String(r[13]).trim() !== '---') mapa[nOrden].nroFactura = String(r[13]).trim();
        if (r[14] && String(r[14]).trim() && String(r[14]).trim() !== '---') mapa[nOrden].tipoFactura = String(r[14]).trim();
        if (r[15] && String(r[15]).trim() && String(r[15]).trim() !== '---') mapa[nOrden].obsFactura = String(r[15]).trim();
        if (r[16] && String(r[16]).trim() && String(r[16]).trim() !== '---') mapa[nOrden].numeroPedidoSistema = String(r[16]).trim();
        if (r[17] && String(r[17]).trim() && String(r[17]).trim() !== '---') mapa[nOrden].notaCredito = String(r[17]).trim();
        if (r[12] && String(r[12]).trim() && String(r[12]).trim() !== '---') mapa[nOrden].fechaEntrega = String(r[12]).trim();
      });
      var lista = Object.values(mapa).reverse();
      // Solo pedidos CON número de pedido sistema asignado
      var documentados = lista.filter(function(p) { return p.numeroPedidoSistema && p.numeroPedidoSistema.trim() !== '' && p.numeroPedidoSistema !== '---'; });
      var sds = [...new Set(documentados.map(function(p){ return p.sede; }))].filter(Boolean).sort();
      setSedesDisp(sds);
      setPedidos(documentados);
    } catch(e) { setErr('Error: ' + (e.message||'Error de red')); }
    finally { setCargando(false); }
  }

  async function guardarEdicionDoc(nOrden) {
    var d = editDataDoc[nOrden] || {};
    if (Object.keys(d).length === 0) { alert('No hay cambios que guardar.'); return; }
    setGuardandoDoc(true);
    try {
      var r = await actualizarFactura({ nOrden: nOrden, nroFactura: d.nroFactura||'', tipoFactura: d.tipoFactura||'contado', obsFactura: d.obsFactura||'', notaCredito: d.notaCredito||'', fechaEntrega: d.fechaEntrega||'' });
      if (!r.ok) { alert('Error guardando factura: ' + (r.error||'')); return; }
      if (d.numeroPedidoSistema !== undefined) {
        var r2 = await actualizarNumeroPedidoSistema({ nOrden: nOrden, numeroPedidoSistema: d.numeroPedidoSistema });
        if (!r2.ok) { alert('Error guardando N° Documento: ' + (r2.error||'')); return; }
      }
      setEditandoDoc(null);
      invalidarCache();
      await cargarDocumentados();
    } catch(e) { alert('Error: ' + e.message); }
    finally { setGuardandoDoc(false); }
  }

  function getProvMeta(nombre) {
    if (!proveedoresMeta || !nombre) return { nit:'---', telefono:'---', correo:'---', contacto:'---' };
    var found = proveedoresMeta.find(function(p){ return p.nombre === nombre; });
    if (!found) return { nit:'---', telefono:'---', correo:'---', contacto:'---' };
    return { nit: found.nit||'---', telefono: found.telefono||'---', correo: found.correo||'---', contacto: found.contacto||found.asesor||'---' };
  }

  var pedidosFiltrados = pedidos.filter(function(p) {
    var pasaSede = !sedeFiltro || p.sede === sedeFiltro;
    var q = busqHD.trim().toLowerCase();
    var pasaBusq = !q || (
      (p.proveedor||'').toLowerCase().includes(q) ||
      p.articulos.some(function(a){ return (a.articulo||'').toLowerCase().includes(q)||(a.codigo||'').toLowerCase().includes(q); }) ||
      (p.nroFactura||'').toLowerCase().includes(q) ||
      (p.numeroPedidoSistema||'').toLowerCase().includes(q)
    );
    var pasaFecha = (!fechaDesdeHD || p.fecha >= fechaDesdeHD) && (!fechaHastaHD || p.fecha <= fechaHastaHD);
    var sem = getSemaforoHD(p);
    var pasaEstado = filtroEstadoDoc === 'todos' || (filtroEstadoDoc === 'pendientes' && (sem === '🔴' || sem === '🟡')) || (filtroEstadoDoc === 'completados' && sem === '🟢');
    return pasaSede && pasaBusq && pasaFecha && pasaEstado;
  });;

  // PDF de Facturas - genera reporte tabular listo para impresion
  function descargarPDFFacturas(pedidos, sede) {
    var ahora = new Date();
    var fechaGen = ahora.toLocaleDateString('es-CO', {day:'2-digit',month:'2-digit',year:'numeric'}) + ' ' + ahora.toLocaleTimeString('es-CO', {hour:'2-digit',minute:'2-digit'});
    var filas = pedidos.map(function(p) {
      var fechaRec = p.fechaEntrega || '';
      if (fechaRec && fechaRec.includes('-') && fechaRec.length === 10) {
        var partes = fechaRec.split('-');
        fechaRec = partes[2] + '/' + partes[1] + '/' + partes[0];
      }
      return '<tr><td>' + (p.proveedor || '') + '</td><td>' + fechaRec + '</td><td>' + (p.nroFactura || '') + '</td><td>' + (p.medioPago || '') + '</td></tr>';
    }).join('');
    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Reporte de Facturas</title>' +
      '<style>body{font-family:Arial,sans-serif;margin:20px;color:#222;}' +
      'h2{color:#1e40af;margin-bottom:4px;}' +
      '.subtitulo{color:#6b7280;font-size:12px;margin-bottom:20px;}' +
      'table{width:100%;border-collapse:collapse;font-size:13px;}' +
      'thead{background:#1e40af;color:#fff;}' +
      'th{padding:8px 12px;text-align:left;font-weight:600;}' +
      'td{padding:7px 12px;border-bottom:1px solid #e5e7eb;}' +
      'tr:nth-child(even) td{background:#f9fafb;}' +
      '.footer{margin-top:16px;font-size:11px;color:#9ca3af;text-align:right;}' +
      '.sede-label{font-size:13px;color:#374151;margin-bottom:4px;font-weight:600;}' +
      '@media print{button{display:none!important;}body{margin:0;}}' +
      '</style></head><body>' +
      '<h2>Reporte de Facturas</h2>' +
      '<p class="sede-label">Sede: ' + (sede ? sede : 'Todas las sedes') + '</p>' +
      '<div class="subtitulo">Generado: ' + fechaGen + ' &nbsp;|&nbsp; Total registros: ' + pedidos.length + '</div>' +
      '<table><thead><tr><th>Proveedor</th><th>Fecha de Recepci\u00f3n</th><th>N\u00b0 Factura</th><th>M\u00e9todo de Pago</th></tr></thead>' +
      '<tbody>' + filas + '</tbody></table>' +
      '<div class="footer">InsumoMaster &ndash; RESTAURANTES ROCOTO</div>' +
      '<script>window.onload=function(){window.print();}<\/script>' +
      '</body></html>';
    var win = window.open('', '_blank', 'width=900,height=600');
    if (win) { win.document.write(html); win.document.close(); }
  }


  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4" style={{background:'#0f6b3a'}}>
        <div className="flex items-center gap-3">
          <Archive className="w-5 h-5 text-green-300"/>
          <div>
            <div className="text-white font-bold text-sm">Histórico de Pedidos</div>
            <div className="text-green-300 text-xs">{cargando ? 'Cargando...' : pedidos.length + ' pedidos con número de sistema asignado'}</div>
          </div>
        </div>
        <button onClick={cargarDocumentados} disabled={cargando}
          className="flex items-center gap-1.5 text-xs text-green-200 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 transition-all disabled:opacity-50">
          <RefreshCw className={"w-3.5 h-3.5 " + (cargando?'animate-spin':'')}/>{cargando?'Cargando...':'Actualizar'}
        </button>
      </div>
      <div className="p-4 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row gap-2 mb-2">
          <select value={sedeFiltro} onChange={function(e){setSedeFiltro(e.target.value);}}
            className="flex-1 py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-green-500">
            <option value="">Todas las sedes</option>
            {sedesDisp.map(function(s){ return (<option key={s} value={s}>{s}</option>); })}
          </select>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"/>
            <input type="text" value={busqHD} onChange={function(e){setBusqHD(e.target.value);}}
              placeholder="Buscar por proveedor, artículo, factura o N° sistema..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-green-500"/>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mb-2">
          <div className="flex items-center gap-2 flex-1">
            <label className="text-xs text-slate-500 whitespace-nowrap">Desde:</label>
            <input type="date" value={fechaDesdeHD} onChange={function(e){setFechaDesdeHD(e.target.value);}}
              className="flex-1 py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-green-500"/>
          </div>
          <div className="flex items-center gap-2 flex-1">
            <label className="text-xs text-slate-500 whitespace-nowrap">Hasta:</label>
            <input type="date" value={fechaHastaHD} onChange={function(e){setFechaHastaHD(e.target.value);}}
              className="flex-1 py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-green-500"/>
          </div>
          {(fechaDesdeHD || fechaHastaHD) && <button onClick={function(){ setFechaDesdeHD(''); setFechaHastaHD(''); }} className="px-3 py-1.5 text-xs text-slate-500 hover:text-red-500 border border-slate-200 rounded-xl bg-white">✕ Limpiar</button>}
        </div>
        <div className="flex gap-2">
          <button onClick={function(){ setFiltroEstadoDoc('todos'); }} className={"px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all " + (filtroEstadoDoc==='todos'?'bg-slate-700 text-white border-slate-700':'bg-white text-slate-600 border-slate-200 hover:border-slate-400')}>Todos</button>
          <button onClick={function(){ setFiltroEstadoDoc('pendientes'); }} className={"px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all " + (filtroEstadoDoc==='pendientes'?'bg-red-600 text-white border-red-600':'bg-white text-slate-600 border-slate-200 hover:border-red-400')}>🔴 Pendientes</button>
          <button onClick={function(){ setFiltroEstadoDoc('completados'); }} className={"px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all " + (filtroEstadoDoc==='completados'?'bg-green-600 text-white border-green-600':'bg-white text-slate-600 border-slate-200 hover:border-green-400')}>🟢 Completados</button>
          {(sedeFiltro || busqHD || fechaDesdeHD || fechaHastaHD || filtroEstadoDoc !== 'todos') && <span className="ml-auto text-xs text-slate-500 self-center">{pedidosFiltrados.length} resultado(s)</span>}

                <button
                  onClick={function(e) { e.stopPropagation(); descargarPDFFacturas(pedidosFiltrados, sedeFiltro); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors"
                  title="Descargar PDF con Proveedor, Fecha de Recepci\u00f3n y N\u00b0 Factura"
                >
                  <Download className="w-3.5 h-3.5" /> Descargar PDF Facturas
                </button>
        </div>
      </div>

            {err && <div className="p-4"><div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm"><AlertCircle className="w-4 h-4 flex-shrink-0"/>{err}</div></div>}
      {cargando && <div className="p-8 text-center text-slate-400 text-sm">Cargando histórico de pedidos...</div>}
      {!cargando && pedidos.length === 0 && !err && (
        <div className="p-8 text-center text-slate-400 text-sm">
          <Archive className="w-8 h-8 mx-auto mb-2 text-slate-300"/>
          No hay pedidos documentados aun. Asigna un Número de Pedido (Sistema) en el Historial de Pedidos para que aparezcan aquí.
        </div>
      )}
      {!cargando && pedidosFiltrados.length > 0 && (
        <div key='documentado-list' className="divide-y divide-slate-100 max-h-[700px] overflow-y-auto">
          <div className="flex gap-2 mb-3 px-1">
          {['todos','pendientes','completados'].map(function(f) {
            return (<button key={f} onClick={function(){ setFiltroEstadoDoc(f); }}
              className={"px-3 py-1 rounded-full text-xs font-semibold border transition " + (filtroEstadoDoc===f ? 'bg-green-700 text-white border-green-700' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100')}>
              {f==='todos'?'Todos':f==='pendientes'?'🔴 Pendientes':'🟢 Completados'}
            </button>);
          })}
        </div>
        {pedidosFiltrados.map(function(p) {
            var isOpen = expandido === p.nOrden;
            var artsVis = articuloBusq ? p.articulos.filter(function(a){ return (a.articulo||'').toLowerCase().includes(articuloBusq.toLowerCase())||(a.codigo||'').toLowerCase().includes(articuloBusq.toLowerCase()); }) : p.articulos;
            var pm = getProvMeta(p.proveedor);
            return (
              <div key={p.nOrden}>
                <button onClick={function(){ setExpandido(isOpen?null:p.nOrden); }}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold" style={{background:'#0f6b3a'}}>
                      {(p.sede||'X').charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-800 truncate">{p.proveedor}</div>
                      <div className="text-xs text-slate-500">{p.sede} · {p.fecha} · {p.articulos.length} art.
                        {p.medioPago && <span className={"ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold "+(p.medioPago==='credito'?'bg-amber-100 text-amber-700':'bg-emerald-100 text-emerald-700')}>{p.medioPago}</span>}
                        {p.nroFactura && <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">Fact: {p.nroFactura}</span>}
                        {p.numeroPedidoSistema && <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-800 border border-green-300">📄 {p.numeroPedidoSistema}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-slate-400 font-mono hidden sm:block">#{p.nOrden}</span> <span title={getSemaforoHD(p)} style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:'22px',height:'22px',borderRadius:'50%',fontWeight:700,fontSize:'14px',background:getColorSemaforo(getSemaforoHD(p)),boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}}>{getSemaforoHD(p)}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0f6b3a" strokeWidth="3" strokeLinecap="round" className={"transition-transform "+(isOpen?'rotate-180':'')}><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                </button>
                {isOpen && (
                  <div key={"expanded-"+p.nOrden} className="px-4 pb-4 bg-slate-50/50">
                    {/* Número de Pedido Sistema - Destacado */}
                    <div className="rounded-xl border-2 border-green-300 bg-green-50 p-3 mb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Archive className="w-4 h-4 text-green-700"/>
                        <span className="text-xs font-bold text-green-800 uppercase tracking-wider">Número de Pedido (Sistema)</span>
                      </div>
                      <div className="text-lg font-bold text-green-800 font-mono">{p.numeroPedidoSistema}</div>
                    </div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-xl bg-white border border-slate-100 text-xs flex-1">
                        {[{l:'Orden',v:'#'+p.nOrden},{l:'Fecha',v:p.fecha},{l:'Sede',v:p.sede},{l:'Responsable',v:p.responsable},{l:'Medio Pago',v:p.medioPago||'---'}].map(function(x){
                          return (<div key={x.l}><div className="font-bold uppercase tracking-wider text-slate-400 mb-0.5">{x.l}</div><div className="font-semibold text-slate-700">{x.v}</div></div>);
                        })}
                      </div>
                      <button onClick={function(e){ 
                        e.stopPropagation();
                        
                        // Buscamos los metadatos en la lista global que recibe el componente
                        var pmHistorial = (proveedoresMeta || []).find(function(prov) {
                          return String(prov.nombre || '').trim().toLowerCase() === String(p.proveedor || '').trim().toLowerCase();
                        }) || {};

                        generarPDF({ 
                          sede: p.sede || '---', 
                          sedeDireccion: p.sedeDireccion || '---', 
                          sedeTelefono: p.sedeTelefono || '---', 
                          sedeHorario: p.sedeHorario || '---', 
                          encargado: p.responsable || '---',
                          proveedorNombre: p.proveedor || '', 
                          provNit: pmHistorial.nit || '---', 
                          provTel: pmHistorial.telefono || pmHistorial.tel || '---', 
                          provCorreo: pmHistorial.correo || pmHistorial.email || '---', 
                          provContacto: pmHistorial.contacto || pmHistorial.asesor || '---',
                          lineas: p.articulos.map(function(a){ 
                            return {
                              articulo: a.articulo || '',
                              unidad: a.unidad || '', 
                              cantidad: parseFloat(String(a.cantidad||'').replace(/,/g,'')) || 0, 
                              valorUnitario: parseFloat(a.valorUnitario || 0), 
                              codigo: a.codigo || ''
                            }; 
                          }),
                          notas: p.observaciones || '', 
                          medioPago: p.medioPago || 'contado', 
                          numeroOrden: p.nOrden,
                          nroFactura: p.nroFactura || '', 
                          tipoFactura: p.tipoFactura || '', 
                          obsFactura: p.obsFactura || '',
                          numeroPedidoSistema: p.numeroPedidoSistema || '' 
                        });
                      }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white shadow-sm flex-shrink-0 hover:opacity-90 transition-opacity" style={{background:'#1a3c6e'}}>
                        <Download className="w-3.5 h-3.5"/> PDF
                      </button>
                      <button onClick={function(e){ e.stopPropagation(); generarCSV(p); }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white shadow-sm flex-shrink-0 hover:opacity-90 transition-opacity" style={{background:'#1a3c6e'}}>
                        <Download className="w-3.5 h-3.5"/> CSV
                      </button>
              <button onClick={function(e){ e.stopPropagation(); setEditandoDoc(p.nOrden); setEditDataDoc(function(prev){ var n=Object.assign({},prev); n[p.nOrden]={nroFactura:p.nroFactura||'',tipoFactura:p.tipoFactura||'contado',obsFactura:p.obsFactura||''}; return n; }); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm hover:opacity-90" style={{background:'#4f46e5'}}>
                <Edit3 className="w-3 h-3"/> Editar
              </button>
                    </div>
              <div key={"editform-"+p.nOrden}>{editandoDoc === p.nOrden && (
                <div className="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl space-y-2">
                  <div className="font-semibold text-xs text-indigo-700 uppercase tracking-wider mb-2">✏️ Editar Pedido #{p.nOrden}</div>
                   <div className="grid grid-cols-2 gap-2">
                     <div><label className="text-xs font-semibold text-slate-600 block mb-0.5">N° Factura</label>
                       <input type="text" value={editDataDoc[p.nOrden]?.nroFactura!==undefined?editDataDoc[p.nOrden].nroFactura:p.nroFactura||''} onChange={function(e){ setEditDataDoc(function(prev){ var n=Object.assign({},prev); n[p.nOrden]=Object.assign({},n[p.nOrden]||{},{nroFactura:e.target.value}); return n; }); }} className="w-full px-2 py-1 text-xs border border-indigo-300 rounded-lg focus:outline-none focus:border-indigo-500" placeholder="Ej: F-001"/>
                     </div>
                     <div><label className="text-xs font-semibold text-slate-600 block mb-0.5">Tipo Factura</label>
                       <select value={editDataDoc[p.nOrden]?.tipoFactura||p.tipoFactura||'contado'} onChange={function(e){ setEditDataDoc(function(prev){ var n=Object.assign({},prev); n[p.nOrden]=Object.assign({},n[p.nOrden]||{},{tipoFactura:e.target.value}); return n; }); }} className="w-full px-2 py-1 text-xs border border-indigo-300 rounded-lg">
                         <option value="contado">Contado</option><option value="credito">Credito</option><option value="consignacion">Consignacion</option>
                       </select>
                     </div>
                     <div><label className="text-xs font-semibold text-slate-600 block mb-0.5">N° Doc. Ingreso</label>
                       <input type="text" value={editDataDoc[p.nOrden]?.numeroPedidoSistema!==undefined?editDataDoc[p.nOrden].numeroPedidoSistema:p.numeroPedidoSistema||''} onChange={function(e){ setEditDataDoc(function(prev){ var n=Object.assign({},prev); n[p.nOrden]=Object.assign({},n[p.nOrden]||{},{numeroPedidoSistema:e.target.value}); return n; }); }} className="w-full px-2 py-1 text-xs border border-indigo-300 rounded-lg focus:outline-none focus:border-indigo-500" placeholder="Ej: 2024-001"/>
                     </div>
                     <div><label className="text-xs font-semibold text-slate-600 block mb-0.5">Obs. Factura</label>
                       <input type="text" value={editDataDoc[p.nOrden]?.obsFactura!==undefined?editDataDoc[p.nOrden].obsFactura:p.obsFactura||''} onChange={function(e){ setEditDataDoc(function(prev){ var n=Object.assign({},prev); n[p.nOrden]=Object.assign({},n[p.nOrden]||{},{obsFactura:e.target.value}); return n; }); }} className="w-full px-2 py-1 text-xs border border-indigo-300 rounded-lg focus:outline-none focus:border-indigo-500" placeholder="Observaciones"/>
                     </div>
                     <div className="col-span-2"><label className="text-xs font-semibold text-slate-600 block mb-0.5">Nota de crédito</label>
                       <input type="text" value={editDataDoc[p.nOrden]?.notaCredito!==undefined?editDataDoc[p.nOrden].notaCredito:p.notaCredito||''} onChange={function(e){ setEditDataDoc(function(prev){ return Object.assign({},prev,{[p.nOrden]:Object.assign({},prev[p.nOrden]||{},{notaCredito:e.target.value})}); });}} className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-500" placeholder="Ej: NC-001..."/>
                     </div>
                     <div className="col-span-2"><label className="text-xs font-semibold text-slate-600 block mb-0.5">Fecha de Entrega</label>
                       <input type="date" value={editDataDoc[p.nOrden]?.fechaEntrega!==undefined?editDataDoc[p.nOrden].fechaEntrega:p.fechaEntrega||''} onChange={function(e){ setEditDataDoc(function(prev){ return Object.assign({},prev,{[p.nOrden]:Object.assign({},prev[p.nOrden]||{},{fechaEntrega:e.target.value})}); }); }} className="w-full border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-blue-500" />
                     </div>
                   </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={function(){ guardarEdicionDoc(p.nOrden); }} disabled={guardandoDoc} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{background:'#4f46e5',opacity:guardandoDoc?0.6:1}}>
                      <Save className="w-3 h-3 inline mr-1"/>{guardandoDoc?'Guardando...':"Guardar Cambios"}
                    </button>
                    <button onClick={function(){ setEditandoDoc(null); }} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-white border border-slate-300">Cancelar</button>
                  </div>
                </div>
              )}</div>
                    <div className="rounded-xl overflow-hidden border border-slate-200 mb-3">
                      <table className="w-full text-xs">
                        <thead><tr style={{background:'#0f6b3a'}}>
                          <th className="py-2 px-3 text-left text-white font-bold uppercase">Codigo</th>
                          <th className="py-2 px-3 text-left text-white font-bold uppercase">Articulo</th>
                          <th className="py-2 px-3 text-center text-white font-bold uppercase w-16">Cant.</th>
                          <th className="py-2 px-3 text-center text-white font-bold uppercase w-20">Unidad</th>
                        </tr></thead>
                        <tbody>
                          {artsVis.map(function(a,i){
                            return (<tr key={i} className={'border-b border-slate-100 '+(i%2===0?'bg-white':'bg-slate-50')}>
                              <td className="py-1.5 px-3 font-mono text-slate-500">{a.codigo}</td>
                              <td className="py-1.5 px-3 font-medium text-slate-800">{a.articulo}</td>
                              <td className="py-1.5 px-3 text-center font-bold text-green-800">{a.cantidad}</td>
                              <td className="py-1.5 px-3 text-center text-slate-500">{a.unidad||'---'}</td>
                            </tr>);
                          })}
                        </tbody>
                      </table>
                    </div>
                    {(p.nroFactura || p.tipoFactura || p.obsFactura || p.notaCredito) && (
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-4 h-4 text-blue-600"/>
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Datos de Factura</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-xs">
                          <div><div className="font-bold text-slate-400 uppercase mb-0.5">N. Factura</div><div className="text-slate-700">{p.nroFactura||'---'}</div></div>
                          <div><div className="font-bold text-slate-400 uppercase mb-0.5">Tipo</div><div className="text-slate-700">{p.tipoFactura||'---'}</div></div>
                          <div><div className="font-bold text-slate-400 uppercase mb-0.5">Observacion</div><div className="text-slate-700">{p.obsFactura||'---'}</div></div>
                          <div className="col-span-3"><div className="font-bold text-slate-400 uppercase mb-0.5">Nota de crédito</div><div className="text-slate-700">{p.notaCredito||'---'}</div></div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── SheetsOrderForm ──────────────────────────────────────────────────────────
export default function SheetsOrderForm() {
  var [proveedoresNombres, setProveedoresNombres] = useState([]);
  var [proveedoresMeta, setProveedoresMeta] = useState([]);
  var [sedes, setSedes] = useState([]);
  var [productos, setProductos] = useState([]);
  var [subfamilias, setSubfamilias] = useState([]);
  var [loading, setLoading] = useState(true);
  var [loadingProductos, setLoadingProductos] = useState(false);
  var [errorGlobal, setErrorGlobal] = useState('');
  var [success, setSuccess] = useState(false);
  var [saving, setSaving] = useState(false);
  var [searchTerm, setSearchTerm] = useState('');
  var [selectedSubfamilia, setSelectedSubfamilia] = useState('');
  var [selectedSede, setSelectedSede] = useState('');
  var [selectedProveedor, setSelectedProveedor] = useState('');
  var [proveedorTitulo, setProveedorTitulo] = useState('');
  var [responsable, setResponsable] = useState(function(){ return localStorage.getItem('ped_responsable') || ''; });
  var [correo, setCorreo] = useState(function(){ return localStorage.getItem('ped_correo') || ''; });
  var [notas, setNotas] = useState('');
  var [medioPago, setMedioPago] = useState('contado');
  var [busqArticulo, setBusqArticulo] = useState('');
  var [provSearch, setProvSearch] = useState('');
  var [todosArticulos, setTodosArticulos] = useState([]);
  var [cantidades, setCantidades] = useState({});
  var cancelRef = useRef(false);

  useEffect(function() {
    cancelRef.current = false;
    (async function() {
      try {
        setLoading(true);
        var res = await Promise.allSettled([
          getProveedorSheetNames(), getSedes(), getProveedores(), getAllDatos()
        ]);
        if (cancelRef.current) return;
        setProveedoresNombres(res[0].status==='fulfilled' ? res[0].value||[] : []);
        var sds = res[1].status==='fulfilled' ? res[1].value||[] : [];
        setSedes(sds.map(function(s){
          return typeof s==='string'
            ? {nombre:s,direccion:'',horaEntrega:'',telefono:''}
            : {nombre:s.nombre||s,direccion:s.direccion||'',horaEntrega:s.horaEntrega||s.horario||'',telefono:s.telefono||''};
        }));
        var allDatos = res[3].status==='fulfilled' ? res[3].value : null;
        if (allDatos && allDatos.proveedores && allDatos.proveedores.length > 0) {
          setProveedoresMeta(allDatos.proveedores.map(function(p,idx){
            return {id:'prov-'+idx,nombre:p.nombre||'',nit:p.nit||'',telefono:p.telefono||'',correo:p.correo||'',asesor:p.asesor||'',contacto:p.contacto||p.asesor||'',medioPago:''};
          }));
        } else if (res[2].status==='fulfilled') {
          setProveedoresMeta(res[2].value||[]);
        }
        if (allDatos && allDatos.articulosPorProveedor && !cancelRef.current) {
          var arts = [];
          Object.values(allDatos.articulosPorProveedor).forEach(function(rows){
            (rows||[]).forEach(function(row){
              if(row.subArticulo&&row.articulo) arts.push({articulo:String(row.subArticulo||''),proveedor:String(row.articulo||''),unidad:String(row.unidad||''),codigo:String(row.codigo||'')});
            });
          });
          setTodosArticulos(arts);
        }
      } catch(e) { if (!cancelRef.current) setErrorGlobal('Error Drive: '+(e.message||'Error de conexion')); }
      finally { if (!cancelRef.current) setLoading(false); }
    })();
    return function() { cancelRef.current = true; };
  }, []);

  useEffect(function() {
    if (!selectedProveedor) { setProductos([]); setSubfamilias([]); setCantidades({}); setSearchTerm(''); setSelectedSubfamilia(''); setProveedorTitulo(''); return; }
    var cancelled = false;
    (async function() {
      setLoadingProductos(true); setProductos([]); setCantidades({}); setSearchTerm(''); setSelectedSubfamilia('');
      try {
        var res = await Promise.allSettled([getProductosConMinMax(selectedProveedor, selectedSede), getSubfamiliasByProveedor(selectedProveedor)]);
        if (cancelled) return;
        setProductos(res[0].status==='fulfilled' ? res[0].value||[] : []);
        setSubfamilias(res[1].status==='fulfilled' ? res[1].value||[] : []);
        setProveedorTitulo(selectedProveedor);
      } catch(e) { if (!cancelled) setErrorGlobal('Error articulos: '+(e.message||'Error')); }
      finally { if (!cancelled) setLoadingProductos(false); }
    })();
    return function() { cancelled = true; };
  }, [selectedProveedor, selectedSede]);

  // Función auxiliar para convertir el texto "1,250.005" al número real 1250.005
  function parsearTextoANumero(val) {
  if (val === undefined || val === null || val === '') return 0;
  // Eliminamos las comas de miles para que parseFloat entienda el string
  var numeroLimpio = String(val).replace(/,/g, '');
  var parsed = parseFloat(numeroLimpio);
  return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  }

  function handleCantidad(codigo, val) {
    // 1. Permite solo números, puntos y comas iniciales
    var strVal = String(val).replace(/[^0-9.,]/g, '');

    // 2. Asegurar que haya máximo UN solo punto decimal
    var partes = strVal.split('.');
    if (partes.length > 2) {
      // Si escriben "0.01.01", conservamos el primer punto y unimos el resto de números sin puntos
      strVal = partes[0] + '.' + partes.slice(1).join('').replace(/\./g, '');
    }

    // 3. Asegurar que NO existan comas de miles después del punto decimal
    if (strVal.includes('.')) {
      var partesPunto = strVal.split('.');
      // Limpiamos cualquier coma que el usuario intente poner en los decimales
      partesPunto[1] = partesPunto[1].replace(/,/g, ''); 
      strVal = partesPunto.join('.');
    }

    // Guardamos el valor estrictamente validado
    setCantidades(function(p){ 
      return Object.assign({}, p, {
        [codigo]: strVal 
      }); 
    });
  }

  var productosFiltrados = productos.filter(function(p) {
    return (!searchTerm||(p.articulo||'').toLowerCase().includes(searchTerm.toLowerCase())||(p.codigo||'').toLowerCase().includes(searchTerm.toLowerCase())) &&
           (!selectedSubfamilia||p.subfamilia===selectedSubfamilia);
  });

  var lineasSeleccionadas = productos
  .filter(function(p){return parsearTextoANumero(cantidades[p.codigo]) > 0;})
  .map(function(p){ return {codigo: p.codigo, articulo: p.articulo, unidad: p.unidad || '', cantidad: parsearTextoANumero(cantidades[p.codigo]), valorUnitario: 0, minimo: p.minimo || '', maximo: p.maximo || ''};});

  var sedeObj = sedes.find(function(s){ return s.nombre===selectedSede; }) || null;
  var provMeta = proveedoresMeta.find(function(p){ return p.nombre===selectedProveedor; }) || null;

  async function handleGuardar(descargarPDF) {
    if (!responsable.trim()) { alert('Ingresa tu nombre.'); return; }
    if (!selectedSede) { alert('Selecciona una sede.'); return; }
    if (!selectedProveedor) { alert('Selecciona un proveedor.'); return; }
    if (lineasSeleccionadas.length===0) { alert('Agrega al menos un articulo.'); return; }
    setSaving(true); setErrorGlobal(''); setSuccess(false);
    var snap = {
      lineas:lineasSeleccionadas.slice(),notas,sede:selectedSede,prov:selectedProveedor,
      resp:responsable,correo,medioPago,
      dir:sedeObj?sedeObj.direccion:'',hor:sedeObj?sedeObj.horaEntrega:'',tel:sedeObj?sedeObj.telefono:'',
      provNit:provMeta?provMeta.nit||'---':'---',
      provTel:provMeta?provMeta.telefono||'---':'---',
      provCorreo:provMeta?provMeta.correo||'---':'---',
      provContacto:provMeta?(provMeta.contacto||provMeta.asesor||'---'):'---',
      orden:Math.floor(Date.now()/1000),fecha:new Date().toISOString().split('T')[0]
    };
    try {
      localStorage.setItem('ped_responsable',snap.resp);
      if(snap.correo) localStorage.setItem('ped_correo',snap.correo);
      var errores=0;
      for(var i=0;i<snap.lineas.length;i++){
        try {
          await appendPedido({fecha:snap.fecha,sede:snap.sede,proveedor:snap.prov,codigo:snap.lineas[i].codigo||'',articulo:snap.lineas[i].articulo||'',unidad:snap.lineas[i].unidad||'',cantidad:snap.lineas[i].cantidad||0,responsable:snap.resp,correoResponsable:snap.correo,notas:snap.notas,medioPago:snap.medioPago||'contado',numeroOrden:String(snap.orden)});
        } catch(e2){console.warn('[appendPedido]',e2.message);errores++;}
      }
      setCantidades({}); setNotas(''); setSuccess(true);
      setTimeout(function(){ setSuccess(false); },8000);
      if(errores>0) setErrorGlobal(errores+' linea(s) no guardadas en Drive.');
      if(descargarPDF!==false){
        setTimeout(function(){
          try{ 
            generarPDF({
              sede: snap.sede,
              sedeDireccion: snap.dir || '---',
              sedeTelefono: snap.tel || '---',
              sedeHorario: snap.hor || '---',
              encargado: snap.resp,
              proveedorNombre: snap.prov,
              provNit: snap.provNit,
              provTel: snap.provTel,
              provCorreo: snap.provCorreo,
              provContacto: snap.provContacto,
              lineas: snap.lineas,
              notas: snap.notas,
              medioPago: snap.medioPago,
              numeroOrden: snap.orden,
              nroFactura: '',
              tipoFactura: '',
              obsFactura: '',
              numeroPedidoSistema: ''
            }); 
          }
          catch(e3){console.error('[PDF]',e3);alert('Pedido guardado. Error PDF: '+e3.message);}
        },0);
      }
    } catch(e){console.error('[handleGuardar]',e);setErrorGlobal('Error: '+e.message);}
    finally{setSaving(false);}
  }

  function handleSoloPDF() {
    if(!selectedProveedor){alert('Selecciona un proveedor.');return;}
    if(lineasSeleccionadas.length===0){alert('Agrega articulos primero.');return;}
    try{
      generarPDF({
        sede: selectedSede,
        sedeDireccion: sedeObj ? sedeObj.direccion : '---',
        sedeTelefono: sedeObj ? sedeObj.telefono : '---',
        sedeHorario: sedeObj ? sedeObj.horaEntrega : '---',
        encargado: responsable || 'Sin especificar',
        proveedorNombre: selectedProveedor,
        provNit: provMeta ? provMeta.nit || '---' : '---',
        provTel: provMeta ? provMeta.telefono || '---' : '---',
        provCorreo: provMeta ? provMeta.correo || '---' : '---',
        provContacto: provMeta ? (provMeta.contacto || provMeta.asesor || '---') : '---',
        lineas: lineasSeleccionadas,
        notas: notas,
        medioPago: medioPago || 'contado',
        numeroOrden: Math.floor(Date.now()/1000),
        nroFactura: '',
        tipoFactura: '',
        obsFactura: '',
        numeroPedidoSistema: ''
      });
    }catch(e){console.error('[SoloPDF]',e);alert('Error PDF: '+e.message);}
  }

  if(loading) return (<div className="flex items-center justify-center min-h-64 gap-3 text-slate-500"><RefreshCw className="w-5 h-5 animate-spin"/><span className="text-sm font-medium">Cargando datos desde Drive...</span></div>);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-5">
      {errorGlobal && (<div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700"><AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5"/><div className="flex-1"><p className="font-semibold text-sm">Error</p><p className="text-xs mt-0.5">{errorGlobal}</p></div><button onClick={function(){setErrorGlobal('');}} className="text-xs underline">Cerrar</button></div>)}
      {success && (<div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-700"><CheckCircle className="w-5 h-5 flex-shrink-0"/><div><p className="font-semibold text-sm">Pedido guardado correctamente</p><p className="text-xs mt-0.5">El PDF se esta descargando.</p></div></div>)}

      {/* 1. Informacion */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><User className="w-4 h-4 text-cyan-500"/> 1. Informacion del Pedido</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Sede *</label>
            <select value={selectedSede} onChange={function(e){setSelectedSede(e.target.value);}} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500">
              <option value="">Seleccionar sede...</option>
              {sedes.map(function(s){ return <option key={s.nombre} value={s.nombre}>{s.nombre}</option>; })}
            </select>
            {sedeObj&&(sedeObj.direccion||sedeObj.horaEntrega)&&(<div className="mt-1.5 text-xs text-slate-500 space-y-0.5 pl-1">{sedeObj.direccion&&<p>{sedeObj.direccion}</p>}{sedeObj.horaEntrega&&<p className="text-cyan-600 font-medium">Horario: {sedeObj.horaEntrega}</p>}</div>)}
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Responsable *</label>
            <input type="text" value={responsable} onChange={function(e){setResponsable(e.target.value);}} placeholder="Tu nombre completo" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500"/>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Correo</label>
            <input type="email" value={correo} onChange={function(e){setCorreo(e.target.value);}} placeholder="correo@empresa.com" className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500"/>
          </div>
        </div>
      </div>

      {/* 2. Proveedor */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Truck className="w-4 h-4 text-cyan-500"/> 2. Seleccionar Proveedor ({proveedoresNombres.length} disponibles)</h2>
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10"/>
              <input type="text" value={provSearch||selectedProveedor} onChange={function(e){setProvSearch(e.target.value);if(!e.target.value)setSelectedProveedor('');}} onFocus={function(){setProvSearch('');}} placeholder="Buscar proveedor..." className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500"/>
              {provSearch.length>0&&(<div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                {proveedoresNombres.filter(function(n){return n.toLowerCase().includes(provSearch.toLowerCase());}).length===0
                  ?<div className="px-4 py-3 text-sm text-slate-400">Sin resultados</div>
                  :proveedoresNombres.filter(function(n){return n.toLowerCase().includes(provSearch.toLowerCase());}).map(function(n){return(<button key={n} onMouseDown={function(e){e.preventDefault();setSelectedProveedor(n);setProvSearch('');}} className="w-full text-left px-4 py-2.5 text-sm hover:bg-cyan-50 hover:text-cyan-700 border-b border-slate-100 last:border-0 transition-colors">{n}</button>);})
                }
              </div>)}
            </div>
            {selectedProveedor&&<div className="mt-1.5 text-xs text-cyan-700 font-semibold px-1">&#10003; {selectedProveedor}</div>}
            {provMeta&&(provMeta.nit||provMeta.telefono||provMeta.correo)&&(
              <div className="mt-2 text-xs text-slate-500 space-y-0.5 pl-1 bg-slate-50 rounded-lg p-2 border border-slate-100">
                {provMeta.nit&&<p><span className="font-semibold text-slate-600">NIT:</span> {provMeta.nit}</p>}
                {provMeta.telefono&&<p><span className="font-semibold text-slate-600">Tel:</span> {provMeta.telefono}</p>}
                {provMeta.correo&&<p><span className="font-semibold text-slate-600">Correo:</span> {provMeta.correo}</p>}
                {(provMeta.contacto||provMeta.asesor)&&<p><span className="font-semibold text-slate-600">Contacto:</span> {provMeta.contacto||provMeta.asesor}</p>}
              </div>
            )}
          </div>
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10"/>
              <input type="text" value={busqArticulo} onChange={function(e){setBusqArticulo(e.target.value);}} placeholder="Nombre del articulo..." className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500"/>
            </div>
            {busqArticulo.length>1&&(<div className="mt-2 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm max-h-48 overflow-y-auto">
              {(function(){
                var q=busqArticulo.toLowerCase();var resultados=[];var seen=new Set();
                todosArticulos.forEach(function(p){if((p.articulo||'').toLowerCase().includes(q)){var key=p.proveedor+'||'+p.articulo;if(!seen.has(key)){seen.add(key);resultados.push(p);}}});
                if(resultados.length===0) return <div className="px-4 py-3 text-xs text-slate-400">{todosArticulos.length===0?'Cargando...':'Sin resultados'}</div>;
                return resultados.slice(0,15).map(function(p,i){return(<div key={i} className="px-3 py-2 border-b border-slate-100 last:border-0 flex items-center justify-between gap-2 hover:bg-slate-50 cursor-pointer" onClick={function(){setSelectedProveedor(p.proveedor);setBusqArticulo('');setProvSearch('');}}>
                  <div><div className="text-xs font-semibold text-slate-800">{p.articulo}</div><div className="text-[10px] text-slate-500">{p.proveedor}</div></div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 whitespace-nowrap">{p.unidad||'---'}</span>
                </div>);});
              })()}
            </div>)}
          </div>
        </div>
      </div>

      {/* 3. Productos */}
      {selectedProveedor&&(
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="w-4 h-4 text-cyan-500"/>
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex-1">
              3. Productos - {proveedorTitulo||selectedProveedor}
              {loadingProductos&&<RefreshCw className="w-3 h-3 animate-spin text-slate-400 inline ml-2"/>}
            </h2>
            {lineasSeleccionadas.length>0&&(<span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">{lineasSeleccionadas.length} art. seleccionado(s)</span>)}
          </div>
          <div className="flex gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"/>
              <input type="text" value={searchTerm} onChange={function(e){setSearchTerm(e.target.value);}} placeholder="Buscar articulo..." className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500"/>
            </div>
            {subfamilias.length>0&&(<div className="relative min-w-48">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"/>
              <select value={selectedSubfamilia} onChange={function(e){setSelectedSubfamilia(e.target.value);}} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500 appearance-none">
                <option value="">Todas las subfamilias</option>
                {subfamilias.map(function(s){return <option key={s} value={s}>{s}</option>;})}
              </select>
            </div>)}
          </div>
          {loadingProductos?(
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2"><RefreshCw className="w-4 h-4 animate-spin"/><span className="text-sm">Cargando articulos...</span></div>
          ):(
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-900 text-white">
                  <th className="py-3 px-4 text-left text-[10px] uppercase tracking-wider font-bold w-24">Codigo</th>
                  <th className="py-3 px-4 text-left text-[10px] uppercase tracking-wider font-bold">Articulo</th>
                  <th className="py-3 px-4 text-center text-[10px] uppercase tracking-wider font-bold w-20 hidden md:table-cell">Unidad</th>
                  <th className="py-3 px-4 text-center text-[10px] uppercase tracking-wider font-bold w-16 hidden lg:table-cell">Min.</th>
                  <th className="py-3 px-4 text-center text-[10px] uppercase tracking-wider font-bold w-16 hidden lg:table-cell">Max.</th>
                  <th className="py-3 px-4 text-center text-[10px] uppercase tracking-wider font-bold w-36">Cantidad</th>
                </tr></thead>
                <tbody>
                  {productosFiltrados.map(function(p,idx){
                  // Conservamos el texto tal cual lo escribe el usuario (ej: "1,200.")
                  var textoCantidad = cantidades[p.codigo] !== undefined ? cantidades[p.codigo] : '';
                  // Convertimos temporalmente a número matemático sólo para aplicar los estilos de fila activa (verde)
                  var qtyParsed = parsearTextoANumero(textoCantidad);
              
                  return(
                    <tr key={p.codigo||idx} className={'border-b border-slate-100 transition-colors '+(qtyParsed>0?'bg-emerald-50':idx%2===0?'bg-white':'bg-slate-50/50')}>
                        <td className="py-3 px-4 font-mono text-xs text-slate-500">{p.codigo}</td>
                        <td className="py-3 px-4 font-medium text-slate-800">{p.articulo}</td>
                        <td className="py-3 px-4 text-center text-slate-500 text-xs hidden md:table-cell">{p.unidad||'---'}</td>
                        <td className="py-3 px-4 text-center text-xs text-slate-500 hidden lg:table-cell">{p.minimo||'---'}</td>
                        <td className="py-3 px-4 text-center text-xs text-slate-500 hidden lg:table-cell">{p.maximo||'---'}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 justify-center">
                            {/* El botón "-" resta 1 al valor numérico parseado y lo devuelve como string */}
                            <button type="button" onClick={function(){handleCantidad(p.codigo, String(Math.max(0, qtyParsed - 1)));}} className="w-7 h-7 rounded-lg bg-slate-200 hover:bg-slate-300 font-bold flex items-center justify-center text-slate-600 text-base">-</button>
                            <input 
                            type="text" 
                            inputMode="decimal" // Fuerza la aparición del teclado numérico con punto/coma en dispositivos móviles
                            value={textoCantidad} 
                            onChange={function(e){ handleCantidad(p.codigo, e.target.value); }} 
                            placeholder="0" 
                            className="w-20 text-center py-1.5 border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:border-cyan-500" 
                            />
                            {/* El botón "+" suma 1 al valor numérico parseado y lo devuelve como string */}
                            <button type="button" onClick={function(){handleCantidad(p.codigo, String(qtyParsed + 1));}} className="w-7 h-7 rounded-lg bg-cyan-500 hover:bg-cyan-600 font-bold text-white flex items-center justify-center text-base">+</button>
                            </div>
                        </td>
                      </tr>
                    );
                  })}
                  {productosFiltrados.length===0&&<tr><td colSpan={4} className="py-12 text-center text-slate-400 text-sm">No hay articulos{searchTerm?' para "'+searchTerm+'"':''}.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          {lineasSeleccionadas.length>0&&(
            <div className="mt-4 flex justify-end">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 min-w-52">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Resumen</p>
                <div className="space-y-1 mb-3">
                  {lineasSeleccionadas.map(function(l){
                    return(
                    <div key={l.codigo} className="flex justify-between text-xs text-slate-700">
                      <span className="truncate max-w-36">{l.articulo}</span>
                      {/* Muestra la cantidad respetando el formato decimal con hasta 3 decimales si existen */}
                      <span className="font-bold ml-2 text-cyan-700">x{l.cantidad.toLocaleString('es-CO', { maximumFractionDigits: 3 })}</span>
                    </div>
                    );
                  })}
                </div>
<div className="border-t border-slate-200 pt-2 flex justify-between text-xs font-bold text-slate-800">
  <span>Total art.</span>
  <span className="text-cyan-600">
    {lineasSeleccionadas.reduce(function(s, l){ 
      return s + l.cantidad; 
    }, 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}
  </span>
</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Observaciones y Registro */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Save className="w-4 h-4 text-cyan-500"/> 5. Observaciones y Registro</h2>
        <textarea value={notas} onChange={function(e){setNotas(e.target.value);}} placeholder="Instrucciones especiales..." rows={3} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500 resize-none mb-4"/>
        <div className="flex flex-wrap gap-3">
          <button onClick={function(){handleGuardar(true);}} disabled={saving||lineasSeleccionadas.length===0} className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
            <Save className="w-4 h-4"/>{saving?'Guardando...':'Guardar y Descargar PDF'}
          </button>
          <button onClick={function(){handleGuardar(false);}} disabled={saving||lineasSeleccionadas.length===0} className="flex items-center gap-2 px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
            <Save className="w-4 h-4"/> Solo Guardar
          </button>
          <button onClick={handleSoloPDF} disabled={lineasSeleccionadas.length===0} className="flex items-center gap-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
            <Download className="w-4 h-4"/> Solo Descargar PDF
          </button>
          <button onClick={function(){invalidarCache();if(selectedProveedor){var pv=selectedProveedor;setSelectedProveedor('');setTimeout(function(){setSelectedProveedor(pv);},150);}alert('Cache borrado.');}} className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-medium transition-all">
            <RefreshCw className="w-4 h-4"/> Actualizar Drive
          </button>
        </div>
      </div>

      {/* 6. Historial de Pedidos */}
      <div>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2"><Search className="w-4 h-4 text-cyan-500"/> 6. Historial de Pedidos</h2>
        <HistorialPedidos proveedoresMeta={proveedoresMeta}/>
      </div>
    </div>
  );
}

 
 
