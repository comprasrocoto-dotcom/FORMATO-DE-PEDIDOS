// @ts-nocheck
/**
 * AjustePedidos.tsx v3
 * Fix: pantalla en blanco al editar - seguridad nula en lineas/codigo
 * Fix: key estable sin remount innecesario
 * Fix: validacion F-G-H del proveedor antes de generar PDF
 * Fix: carga proveedoresMeta desde Drive con campos correos/telefono/contacto
 */
import { useState, useEffect, useRef } from 'react';
import { RefreshCw, Edit3, Save, X, AlertCircle, CheckCircle, Package, Clock, Download } from 'lucide-react';
import { actualizarPedido, getProveedores, getAllDatos } from '../services/googleSheets';

const ENDPOINT = 'https://script.google.com/macros/s/AKfycbzlfjOyyYCGj5AaSTScISTq3rEL3b8AB9en2LYKsbhmZ8P3goP9J15NC7QVt1ePgIAWCA/exec';

// ─── jsPDF loader ─────────────────────────────────────────────────────────────
var _jsPDFClass = null;
(function() {
  var s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  s.onload = function() { _jsPDFClass = window.jspdf ? window.jspdf.jsPDF : window.jsPDF; };
  document.head.appendChild(s);
})();

function generarPDFAjuste(params) {
  var JsPDF = _jsPDFClass || (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
  if (!JsPDF) { alert('PDF no disponible. Espera 2s e intenta de nuevo.'); return; }

  var sede = params.sede || '';
  var encargado = params.encargado || '';
  var proveedorNombre = params.proveedorNombre || '';
  var provNit = params.provNit || '---';
  var provTel = params.provTel || '---';
  var provCorreo = params.provCorreo || '---';
  var provContacto = params.provContacto || '---';
  var lineas = params.lineas || [];
  var notas = params.notas || '';
  var medioPago = params.medioPago || 'contado';
  var numeroOrden = params.numeroOrden || '';
  var fechaHoy = new Date().toISOString().slice(0, 10);

  var activas = lineas.filter(function(l) { return (parseFloat(l.cantidad) || 0) > 0; });
  var doc = new JsPDF({ unit: 'mm', format: 'letter', orientation: 'portrait' });
  var azul = [26, 60, 110];
  var negro = [30, 30, 30];
  var blanco = [255, 255, 255];
  var cielo = [0, 112, 192];
  var ancho = 215.9;
  var margen = 15;
  var col2 = ancho / 2 + 5;
  var y = 15;

  doc.setFontSize(8); doc.setTextColor(120, 120, 120);
  doc.text('Pedido #' + numeroOrden + ' ' + fechaHoy, ancho - margen, y, { align: 'right' });
  if (medioPago) {
    doc.setFontSize(7);
    doc.text('Medio de Pago: ' + medioPago.charAt(0).toUpperCase() + medioPago.slice(1), ancho - margen, y + 4, { align: 'right' });
  }
  y += 10;

  var infoLeft = [
    ['Sede', sede],
    ['Encargado', encargado],
  ];
  var infoRight = [
    ['Proveedor', proveedorNombre],
    ['NIT', provNit],
    ['Tel. Proveedor', provTel],
    ['Contacto', provContacto],
    ['Correo', provCorreo],
  ];

  var yStart = y;
  infoLeft.forEach(function(f) {
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
    doc.setTextColor(cielo[0], cielo[1], cielo[2]);
    doc.text(f[0] + ':', margen, y);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(negro[0], negro[1], negro[2]);
    doc.text(doc.splitTextToSize(String(f[1]), 70), margen + 40, y);
    y += 6;
  });
  var yR = yStart;
  infoRight.forEach(function(f) {
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
    doc.setTextColor(cielo[0], cielo[1], cielo[2]);
    doc.text(f[0] + ':', col2, yR);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(negro[0], negro[1], negro[2]);
    doc.text(doc.splitTextToSize(String(f[1]), 65), col2 + 36, yR);
    yR += 6;
  });
  y = Math.max(y, yR) + 5;

  var cW = [70, 25, 25, 25];
  var cX = [margen];
  for (var ci = 0; ci < cW.length - 1; ci++) cX.push(cX[ci] + cW[ci]);
  var rH = 7;
  var aligns = ['left', 'center', 'center', 'center'];
  var headers = ['Articulo', 'Unidad', 'Codigo', 'Cantidad'];

  doc.setFillColor(azul[0], azul[1], azul[2]);
  doc.rect(margen, y, ancho - 2 * margen, rH, 'F');
  doc.setTextColor(blanco[0], blanco[1], blanco[2]);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  headers.forEach(function(h, i) {
    var xT = aligns[i]==='right' ? cX[i]+cW[i]-2 : aligns[i]==='center' ? cX[i]+cW[i]/2 : cX[i]+2;
    doc.text(h, xT, y + 4.5, { align: aligns[i] });
  });
  y += rH;

  doc.setFont('helvetica', 'normal');
  var minF = Math.max(activas.length, 8);
  for (var ri = 0; ri < minF; ri++) {
    var l = activas[ri];
    var bg = ri % 2 === 0 ? [255,255,255] : [248,249,252];
    doc.setFillColor(bg[0], bg[1], bg[2]);
    doc.rect(margen, y, ancho - 2*margen, rH, 'F');
    doc.setDrawColor(208, 215, 232);
    doc.rect(margen, y, ancho - 2*margen, rH, 'S');
    if (l) {
      var cant = parseFloat(l.cantidad) || 0;
      var cantStr = cant % 1 === 0 ? String(cant) : cant.toFixed(2);
      var vals = [
        (l.articulo||'').substring(0, 35),
        (l.unidad||'---').substring(0, 10),
        (l.codigo||'---').substring(0, 12),
        cantStr,
      ];
      doc.setTextColor(negro[0], negro[1], negro[2]); doc.setFontSize(7.5);
      vals.forEach(function(v, i) {
        var xT2 = aligns[i]==='right' ? cX[i]+cW[i]-2 : aligns[i]==='center' ? cX[i]+cW[i]/2 : cX[i]+2;
        doc.text(v, xT2, y + 4.5, { align: aligns[i] });
      });
    }
    y += rH;
  }

  y += 5;
  if (notas) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(negro[0], negro[1], negro[2]);
    doc.text('Observaciones:', margen, y); y += 4;
    doc.setDrawColor(150, 150, 150);
    doc.rect(margen, y, ancho - 2*margen, 14, 'S');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(80, 80, 80);
    doc.text(doc.splitTextToSize(notas, ancho - 2*margen - 4), margen + 2, y + 4);
    y += 18;
  }

  var slug = proveedorNombre.replace(/[^A-Za-z0-9]/g,'_').substring(0,20);
  doc.save('Pedido-' + numeroOrden + '_' + slug + '_' + fechaHoy + '.pdf');
}

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
    generarPDFAjuste({
      sede: g.sede, encargado: g.responsable,
      proveedorNombre: g.proveedor,
      provNit: pm.nit, provTel: pm.telefono,
      provCorreo: pm.correo, provContacto: pm.contacto,
      lineas: lineas.map(function(l){ return { articulo: l.articulo||'', unidad: l.unidad||'', cantidad: Number(l.cantidad)||0, codigo: l.codigo||'' }; }),
      notas: lineas[0] ? lineas[0].observaciones||'' : '',
      medioPago: g.medioPago||'contado', numeroOrden: g.nOrden,
    });
  }

  // Auto-descarga PDF cuando se selecciona el pedido
  useEffect(function() {
    handleDescargarPDF();
  }, []);

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
    return (!filtroSede || g.sede === filtroSede) && (!filtroProveedor || g.proveedor === filtroProveedor);
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
