// @ts-nocheck
/**
 * SheetsOrderForm.tsx v8 - SOLUCIÓN DEFINITIVA
 * ROOT CAUSE: cargarJsPDF() hacía document.head.appendChild() 
 * durante un callback de setState -> NotFoundError de React -> página en blanco
 * FIX: jsPDF se precarga al cargar el módulo (fuera del ciclo de React)
 * FIX: generarPDF es síncrono, sin operaciones DOM durante renders
 */
import { useState, useEffect, useRef } from 'react';
import { ShoppingCart, User, Truck, RefreshCw, Save, Download,
  AlertCircle, CheckCircle, Search, FileSpreadsheet, Filter } from 'lucide-react';
import {
  getProveedorSheetNames,
  getProductosByProveedor,
  getSubfamiliasByProveedor,
  getSedes,
  appendPedido,
  invalidarCache,
} from '../services/googleSheets';

const ENDPOINT = 'https://script.google.com/macros/s/AKfycbzlfjOyyYCGj5AaSTScISTq3rEL3b8AB9en2LYKsbhmZ8P3goP9J15NC7QVt1ePgIAWCA/exec';

// ─── Precarga de jsPDF al arrancar el módulo (FUERA de React) ────────────────
var _jsPDFClass = null;
(function() {
  var s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  s.onload = function() {
    _jsPDFClass = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
  };
  document.head.appendChild(s);
})();

// ─── PDF Generator — jsPDF puro, sin operaciones DOM ────────────────────────
function generarPDF(params) {
  var JsPDF = _jsPDFClass || (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
  if (!JsPDF) { alert('PDF no disponible aún. Espera 2 segundos y vuelve a intentarlo.'); return; }

  var sede = params.sede || '';
  var sedeDireccion = params.sedeDireccion || '';
  var sedeTelefono = params.sedeTelefono || '';
  var sedeHorario = params.sedeHorario || '';
  var encargado = params.encargado || '';
  var proveedorNombre = params.proveedorNombre || '';
  var lineas = params.lineas || [];
  var notas = params.notas || '';
  var medioPago = params.medioPago || 'contado';
  var numeroOrden = params.numeroOrden || '';
  var fechaHoy = new Date().toISOString().slice(0, 10);

  var activas = lineas.filter(function(l) { return (l.cantidad || 0) > 0; });
  var total = activas.reduce(function(s, l) {
    return s + ((l.valorUnitario || 0) * (l.cantidad || 0));
  }, 0);

  var doc = new JsPDF({ unit: 'mm', format: 'letter', orientation: 'portrait' });
  var azul = [26, 60, 110];
  var negro = [30, 30, 30];
  var blanco = [255, 255, 255];
  var cielo = [0, 112, 192];
  var ancho = 215.9;
  var margen = 15;
  var col2 = ancho / 2 + 5;
  var y = 15;

  // Número de pedido
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text('Pedido #' + numeroOrden + '   ' + fechaHoy, ancho - margen, y, { align: 'right' });
  y += 8;

  // Info grid
  var infoLeft = [
    ['Sede', sede],
    ['Direccion de entrega', sedeDireccion || '---'],
    ['Telefono', sedeTelefono || '---'],
    ['Horario de entrega', sedeHorario || '---'],
    ['Encargado', encargado || '---'],
  ];
  var infoRight = [
    ['Proveedor', proveedorNombre],
    ['Nit', '---'],
    ['Telefono', '---'],
    ['Medio de Pago', (medioPago||'contado').charAt(0).toUpperCase()+(medioPago||'contado').slice(1)],
  ];

  var yStart = y;
  infoLeft.forEach(function(f) {
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
    doc.setTextColor(cielo[0], cielo[1], cielo[2]);
    doc.text(f[0] + ':', margen, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(negro[0], negro[1], negro[2]);
    doc.text(doc.splitTextToSize(f[1], 75), margen + 42, y);
    y += 6;
  });
  var yR = yStart;
  infoRight.forEach(function(f) {
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
    doc.setTextColor(cielo[0], cielo[1], cielo[2]);
    doc.text(f[0] + ':', col2, yR);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(negro[0], negro[1], negro[2]);
    doc.text(doc.splitTextToSize(f[1], 70), col2 + 35, yR);
    yR += 6;
  });
  y = Math.max(y, yR) + 5;

  // Tabla
  var cW = [72, 38, 20, 28, 22];
  var cX = [margen];
  for (var ci = 0; ci < cW.length - 1; ci++) cX.push(cX[ci] + cW[ci]);
  var rH = 7;
  var aligns = ['left', 'left', 'center', 'right', 'right'];
  var headers = ['Articulo', 'Subarticulo', 'Cantidad', 'Valor Unitario', 'Total'];

  // Header
  doc.setFillColor(azul[0], azul[1], azul[2]);
  doc.rect(margen, y, ancho - 2 * margen, rH, 'F');
  doc.setTextColor(blanco[0], blanco[1], blanco[2]);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  headers.forEach(function(h, i) {
    var xT = aligns[i]==='right' ? cX[i]+cW[i]-2 : aligns[i]==='center' ? cX[i]+cW[i]/2 : cX[i]+2;
    doc.text(h, xT, y + 4.5, { align: aligns[i] });
  });
  y += rH;

  // Filas
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
      var t2 = (l.valorUnitario||0) * (l.cantidad||0);
      var vals = [
        (l.articulo||'').substring(0,28),
        (l.subArticulo||'').substring(0,20),
        String(l.cantidad||0),
        '$ ' + Number(l.valorUnitario||0).toLocaleString('es-CO'),
        '$ ' + Number(t2).toLocaleString('es-CO'),
      ];
      doc.setTextColor(negro[0], negro[1], negro[2]); doc.setFontSize(7.5);
      vals.forEach(function(v, i) {
        var xT2 = aligns[i]==='right' ? cX[i]+cW[i]-2 : aligns[i]==='center' ? cX[i]+cW[i]/2 : cX[i]+2;
        doc.text(v, xT2, y + 4.5, { align: aligns[i] });
      });
    }
    y += rH;
  }

  // Total
  y += 2;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.setTextColor(azul[0], azul[1], azul[2]);
  doc.text('Total:', cX[3], y + 4, { align: 'left' });
  doc.text('$ ' + Number(total).toLocaleString('es-CO') + ',00', cX[4]+cW[4]-2, y + 4, { align: 'right' });
  y += 10;

  // Observacion
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
  doc.setTextColor(negro[0], negro[1], negro[2]);
  doc.text('Observacion', margen, y); y += 4;
  doc.setDrawColor(150, 150, 150);
  doc.rect(margen, y, ancho - 2*margen, 25, 'S');
  if (notas) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(doc.splitTextToSize(notas, ancho - 2*margen - 4), margen + 2, y + 5);
  }

  var slug = proveedorNombre.replace(/[^A-Za-z0-9]/g,'_').substring(0,20);
  doc.save('Pedido-' + numeroOrden + '_' + slug + '_' + fechaHoy + '.pdf');
}

function HistorialPedidos() {
  var [sedeFiltro, setSedeFiltro] = useState('');
  var [articuloBusq, setArticuloBusq] = useState('');
  var [cargando, setCargando] = useState(false);
  var [pedidos, setPedidos] = useState([]);
  var [sedesDisp, setSedesDisp] = useState([]);
  var [err, setErr] = useState('');
  var [expandido, setExpandido] = useState(null);

  useEffect(function() { cargarHistorial(); }, []);

  async function cargarHistorial() {
    setCargando(true); setErr(''); setPedidos([]);
    try {
      var res = await fetch(ENDPOINT + '?action=getHistorial', { redirect: 'follow' });
      var data = await res.json();
      if (!data.ok) { setErr(data.error || 'Error cargando historial.'); return; }
      var rows = data.rows || [];
      var mapa = {};
      rows.forEach(function(r) {
        var nOrden = String(r[0] || '');
        if (!nOrden) return;
        if (!mapa[nOrden]) {
          mapa[nOrden] = {
            nOrden: nOrden,
            fecha: String(r[1] || '---').split('GMT')[0].trim().split('T')[0] || String(r[1] || '---'),
            sede: String(r[2] || '---'),
            proveedor: String(r[3] || '---'),
            responsable: String(r[9] || '---'),
            medioPago: String(r[11] || r[8] || 'contado'),
            articulos: []
          };
        }
        if (r[5] || r[4]) {
          mapa[nOrden].articulos.push({ codigo: String(r[4]||''), articulo: String(r[5]||''), subArticulo: String(r[6]||''), cantidad: String(r[7]||''), unidad: String(r[8]||'') });
        }
      });
      var lista = Object.values(mapa).reverse();
      var sds = [...new Set(lista.map(function(p){ return p.sede; }))].filter(Boolean).sort();
      setSedesDisp(sds);
      setPedidos(lista);
    } catch(e) { setErr('Error: ' + e.message); }
    finally { setCargando(false); }
  }

  var pedidosFiltrados = pedidos.filter(function(p) {
    var pasaSede = !sedeFiltro || p.sede === sedeFiltro;
    var pasaArt = !articuloBusq || p.articulos.some(function(a) {
      return (a.articulo||'').toLowerCase().includes(articuloBusq.toLowerCase()) || (a.codigo||'').toLowerCase().includes(articuloBusq.toLowerCase());
    });
    return pasaSede && pasaArt;
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4" style={{background:'#1a3c6e'}}>
        <div className="flex items-center gap-3">
          <Search className="w-5 h-5 text-blue-300"/>
          <div>
            <div className="text-white font-bold text-sm">Historial de Pedidos</div>
            <div className="text-blue-300 text-xs">{pedidos.length} ordenes registradas</div>
          </div>
        </div>
        <button onClick={cargarHistorial} disabled={cargando} className="flex items-center gap-1.5 text-xs text-blue-200 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 transition-all disabled:opacity-50">
          <Download className="w-3.5 h-3.5"/>{cargando ? 'Cargando...' : 'Actualizar'}
        </button>
      </div>
      <div className="p-4 border-b border-slate-100 space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <select value={sedeFiltro} onChange={function(e){setSedeFiltro(e.target.value);}}
            className="flex-1 py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500">
            <option value="">Todas las sedes</option>
            {sedesDisp.map(function(s){ return (<option key={s} value={s}>{s}</option>); })}
          </select>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"/>
            <input type="text" value={articuloBusq} onChange={function(e){setArticuloBusq(e.target.value);}}
              placeholder="Buscar por articulo o codigo..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"/>
          </div>
        </div>
        {(sedeFiltro || articuloBusq) && <div className="text-xs text-slate-500">{pedidosFiltrados.length} resultado(s)</div>}
      </div>
      {err && <div className="p-4"><div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm"><AlertCircle className="w-4 h-4 flex-shrink-0"/>{err}</div></div>}
      {cargando && <div className="p-8 text-center text-slate-400 text-sm">Cargando historial...</div>}
      {!cargando && pedidos.length === 0 && !err && <div className="p-8 text-center text-slate-400 text-sm">No hay pedidos registrados aun.</div>}
      {!cargando && pedidosFiltrados.length > 0 && (
        <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
          {pedidosFiltrados.map(function(p) {
            var isOpen = expandido === p.nOrden;
            var artsVis = articuloBusq ? p.articulos.filter(function(a){ return (a.articulo||'').toLowerCase().includes(articuloBusq.toLowerCase()) || (a.codigo||'').toLowerCase().includes(articuloBusq.toLowerCase()); }) : p.articulos;
            return (
              <div key={p.nOrden}>
                <button onClick={function(){ setExpandido(isOpen ? null : p.nOrden); }}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold" style={{background:'#1a3c6e'}}>
                      {(p.sede||'X').charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-800 truncate">{p.proveedor}</div>
                      <div className="text-xs text-slate-500">{p.sede} · {p.fecha} · {p.articulos.length} art.</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-slate-400 font-mono hidden sm:block">#{p.nOrden}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1a3c6e" strokeWidth="3" strokeLinecap="round" className={"transition-transform " + (isOpen?'rotate-180':'')}><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 bg-slate-50/50">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-xl bg-white border border-slate-100 text-xs flex-1">
                        {[{l:'Orden',v:'#'+p.nOrden},{l:'Fecha',v:p.fecha},{l:'Sede',v:p.sede},{l:'Responsable',v:p.responsable}].map(function(x){
                          return (<div key={x.l}><div className="font-bold uppercase tracking-wider text-slate-400 mb-0.5">{x.l}</div><div className="font-semibold text-slate-700">{x.v}</div></div>);
                        })}
                      </div>
                      <button onClick={function(e){ e.stopPropagation();
                        generarPDF({ sede:p.sede, sedeDireccion:'', sedeTelefono:'', sedeHorario:'', encargado:p.responsable, proveedorNombre:p.proveedor,
                          lineas:p.articulos.map(function(a){ return {articulo:a.articulo, subArticulo:a.subArticulo||'', cantidad:Number(a.cantidad)||1, unidad:a.unidad||'', valorUnitario:0}; }),
                          notas:'', medioPago:p.medioPago||'contado', numeroOrden:p.nOrden });
                      }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white shadow-sm flex-shrink-0 hover:opacity-90 transition-opacity" style={{background:'#1a3c6e'}}>
                        <Download className="w-3.5 h-3.5"/> PDF
                      </button>
                    </div>
                    <div className="rounded-xl overflow-hidden border border-slate-200">
                      <table className="w-full text-xs">
                        <thead><tr style={{background:'#1a3c6e'}}>
                          <th className="py-2 px-3 text-left text-white font-bold uppercase">Codigo</th>
                          <th className="py-2 px-3 text-left text-white font-bold uppercase">Articulo</th>
                          <th className="py-2 px-3 text-center text-white font-bold uppercase w-14">Cant.</th>
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

export default function SheetsOrderForm() {
  var [proveedoresNombres, setProveedoresNombres] = useState([]);
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
  var [valorUnitario, setValorUnitario] = useState({});
  var cancelRef = useRef(false);

  useEffect(function() {
    cancelRef.current = false;
    (async function() {
      try {
        setLoading(true);
        var res = await Promise.allSettled([getProveedorSheetNames(), getSedes()]);
        if (cancelRef.current) return;
        setProveedoresNombres(res[0].status==='fulfilled' ? res[0].value||[] : []);
        var sds = res[1].status==='fulfilled' ? res[1].value||[] : [];
        setSedes(sds.map(function(s){ return typeof s==='string' ? {nombre:s,direccion:'',horaEntrega:'',telefono:''} : {nombre:s.nombre||s,direccion:s.direccion||'',horaEntrega:s.horaEntrega||s.horario||'',telefono:s.telefono||''}; }));
        try {
          var ra = await fetch(ENDPOINT+'?action=getDatos',{redirect:'follow'});
          var da = await ra.json();
          if(da.articulosPorProveedor && !cancelRef.current){
            var arts=[];
            Object.values(da.articulosPorProveedor).forEach(function(rows){
              (rows||[]).forEach(function(row){ if(row.subArticulo&&row.articulo){ arts.push({articulo:String(row.subArticulo||''),proveedor:String(row.articulo||''),unidad:String(row.unidad||''),codigo:String(row.codigo||'')}); } });
            });
            setTodosArticulos(arts);
          }
        } catch(ea){ console.warn('arts load:',ea.message); }
      } catch(e) { if (!cancelRef.current) setErrorGlobal('Error Drive: ' + e.message); }
      finally { if (!cancelRef.current) setLoading(false); }
    })();
    return function() { cancelRef.current = true; };
  }, []);

  useEffect(function() {
    if (!selectedProveedor) {
      setProductos([]); setSubfamilias([]); setCantidades({}); setValorUnitario({});
      setSearchTerm(''); setSelectedSubfamilia(''); setProveedorTitulo(''); return;
    }
    var cancelled = false;
    (async function() {
      setLoadingProductos(true); setProductos([]); setCantidades({}); setValorUnitario({}); setSearchTerm(''); setSelectedSubfamilia('');
      try {
        var res = await Promise.allSettled([getProductosByProveedor(selectedProveedor), getSubfamiliasByProveedor(selectedProveedor)]);
        if (cancelled) return;
        setProductos(res[0].status==='fulfilled' ? res[0].value||[] : []);
        setSubfamilias(res[1].status==='fulfilled' ? res[1].value||[] : []);
        setProveedorTitulo(selectedProveedor);
      } catch(e) { if (!cancelled) setErrorGlobal('Error articulos: ' + e.message); }
      finally { if (!cancelled) setLoadingProductos(false); }
    })();
    return function() { cancelled = true; };
  }, [selectedProveedor]);

  function handleCantidad(codigo, val) { setCantidades(function(p){ return Object.assign({},p,{[codigo]:Math.max(0,parseInt(val)||0)}); }); }
  function handleValorUnitario(codigo, val) { setValorUnitario(function(p){ return Object.assign({},p,{[codigo]:Math.max(0,parseFloat(val)||0)}); }); }

  var productosFiltrados = productos.filter(function(p) {
    return (!searchTerm || (p.articulo||'').toLowerCase().includes(searchTerm.toLowerCase()) || (p.codigo||'').toLowerCase().includes(searchTerm.toLowerCase())) &&
           (!selectedSubfamilia || p.subfamilia === selectedSubfamilia);
  });

  var lineasSeleccionadas = productos.filter(function(p){ return (cantidades[p.codigo]||0)>0; }).map(function(p){
    return { codigo:p.codigo, articulo:p.articulo, subArticulo:p.subfamilia||'', unidad:p.unidad||'', cantidad:cantidades[p.codigo]||0, valorUnitario:valorUnitario[p.codigo]||0 };
  });

  var sedeObj = sedes.find(function(s){ return s.nombre===selectedSede; }) || null;

  async function handleGuardar() {
    if (!responsable.trim()) { alert('Ingresa tu nombre.'); return; }
    if (!selectedSede) { alert('Selecciona una sede.'); return; }
    if (!selectedProveedor) { alert('Selecciona un proveedor.'); return; }
    if (lineasSeleccionadas.length===0) { alert('Agrega al menos un articulo.'); return; }
    setSaving(true); setErrorGlobal(''); setSuccess(false);

    var snap = {
      lineas: lineasSeleccionadas.slice(), notas: notas,
      sede: selectedSede, prov: selectedProveedor, resp: responsable, correo: correo, medioPago: medioPago,
      dir: sedeObj ? sedeObj.direccion : '', hor: sedeObj ? sedeObj.horaEntrega : '', tel: sedeObj ? sedeObj.telefono : '',
      orden: Math.floor(Date.now()/1000), fecha: new Date().toISOString().split('T')[0]
    };

    try {
      localStorage.setItem('ped_responsable', snap.resp);
      if (snap.correo) localStorage.setItem('ped_correo', snap.correo);

      var errores = 0;
      for (var i=0; i<snap.lineas.length; i++) {
        try {
          await appendPedido({ fecha:snap.fecha, sede:snap.sede, proveedor:snap.prov, codigo:snap.lineas[i].codigo||'', articulo:snap.lineas[i].articulo||'', subArticulo:snap.lineas[i].subArticulo||'', cantidad:snap.lineas[i].cantidad||0, unidad:snap.lineas[i].unidad||'', responsable:snap.resp, correoResponsable:snap.correo, notas:snap.notas, medioPago:snap.medioPago||'contado', numeroOrden:String(snap.orden) });
        } catch(e2) { console.warn('[appendPedido]', e2.message); errores++; }
      }

      setCantidades({}); setValorUnitario({}); setNotas('');
      setSuccess(true);
      setTimeout(function(){ setSuccess(false); }, 8000);
      if (errores>0) setErrorGlobal(errores + ' linea(s) no guardadas en Drive.');

      // PDF fuera del ciclo de setState usando setTimeout 0
      var pdfParams = { sede:snap.sede, sedeDireccion:snap.dir, sedeTelefono:snap.tel, sedeHorario:snap.hor, encargado:snap.resp, proveedorNombre:snap.prov, lineas:snap.lineas, notas:snap.notas, numeroOrden:snap.orden };
      setTimeout(function() {
        try { generarPDF(pdfParams); }
        catch(e3) { console.error('[PDF]', e3); alert('Pedido guardado. Error PDF: ' + e3.message); }
      }, 0);

    } catch(e) { console.error('[handleGuardar]', e); setErrorGlobal('Error: ' + e.message); }
    finally { setSaving(false); }
  }

  function handleSoloPDF() {
    if (!selectedProveedor) { alert('Selecciona un proveedor.'); return; }
    if (lineasSeleccionadas.length===0) { alert('Agrega articulos primero.'); return; }
    try {
      generarPDF({ sede:selectedSede, sedeDireccion:sedeObj?sedeObj.direccion:'', sedeTelefono:sedeObj?sedeObj.telefono:'', sedeHorario:sedeObj?sedeObj.horaEntrega:'', encargado:responsable||'Sin especificar', proveedorNombre:selectedProveedor, lineas:lineasSeleccionadas, notas:notas, medioPago:medioPago||'contado', numeroOrden:Math.floor(Date.now()/1000) });
    } catch(e) { console.error('[SoloPDF]', e); alert('Error PDF: ' + e.message); }
  }

  if (loading) return (<div className="flex items-center justify-center min-h-64 gap-3 text-slate-500"><RefreshCw className="w-5 h-5 animate-spin"/><span className="text-sm font-medium">Cargando datos desde Drive...</span></div>);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-5">

      {errorGlobal && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5"/>
          <div className="flex-1"><p className="font-semibold text-sm">Error</p><p className="text-xs mt-0.5">{errorGlobal}</p></div>
          <button onClick={function(){ setErrorGlobal(''); }} className="text-xs underline">Cerrar</button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-700">
          <CheckCircle className="w-5 h-5 flex-shrink-0"/>
          <div><p className="font-semibold text-sm">Pedido guardado correctamente</p><p className="text-xs mt-0.5">El PDF se esta descargando.</p></div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-cyan-500"/> 1. Informacion del Pedido
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Sede *</label>
            <select value={selectedSede} onChange={function(e){setSelectedSede(e.target.value);}} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500">
              <option value="">Seleccionar sede...</option>
              {sedes.map(function(s){ return <option key={s.nombre} value={s.nombre}>{s.nombre}</option>; })}
            </select>
            {sedeObj && (sedeObj.direccion||sedeObj.horaEntrega) && (
              <div className="mt-1.5 text-xs text-slate-500 space-y-0.5 pl-1">
                {sedeObj.direccion && <p>{sedeObj.direccion}</p>}
                {sedeObj.horaEntrega && <p className="text-cyan-600 font-medium">Horario: {sedeObj.horaEntrega}</p>}
              </div>
            )}
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

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Truck className="w-4 h-4 text-cyan-500"/> 2. Seleccionar Proveedor ({proveedoresNombres.length} disponibles)
        </h2>
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Buscador/selector de proveedor con búsqueda */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10"/>
              <input type="text" value={provSearch || selectedProveedor}
                onChange={function(e){ setProvSearch(e.target.value); if(!e.target.value){ setSelectedProveedor(''); } }}
                onFocus={function(e){ setProvSearch(''); }}
                placeholder="Buscar proveedor..." 
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500"/>
              {provSearch.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                  {proveedoresNombres.filter(n=>n.toLowerCase().includes(provSearch.toLowerCase())).length === 0
                    ? <div className="px-4 py-3 text-sm text-slate-400">Sin resultados</div>
                    : proveedoresNombres.filter(n=>n.toLowerCase().includes(provSearch.toLowerCase())).map(function(n){
                        return (<button key={n} onMouseDown={function(e){e.preventDefault(); setSelectedProveedor(n); setProvSearch('');}}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-cyan-50 hover:text-cyan-700 border-b border-slate-100 last:border-0 transition-colors">
                          {n}
                        </button>);
                      })
                  }
                </div>
              )}
            </div>
            {selectedProveedor && <div className="mt-1.5 text-xs text-cyan-700 font-semibold px-1">✓ {selectedProveedor}</div>}
          </div>
          {/* Buscador de artículo → muestra proveedores */}
          <div className="flex-1 max-w-md">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Buscar artículo por proveedor</div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10"/>
              <input type="text" value={busqArticulo} onChange={function(e){setBusqArticulo(e.target.value);}}
                placeholder="Nombre del artículo..." 
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500"/>
            </div>
            {busqArticulo.length > 1 && (
              <div className="mt-2 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm max-h-48 overflow-y-auto">
                {(function(){
                  var q = busqArticulo.toLowerCase();
                  var resultados = [];
                  var seen = new Set();
                  todosArticulos.forEach(function(p){ if((p.articulo||'').toLowerCase().includes(q)){ var key=p.proveedor+'||'+p.articulo; if(!seen.has(key)){seen.add(key); resultados.push(p);} } });
                  if(resultados.length===0) return <div className="px-4 py-3 text-xs text-slate-400">{todosArticulos.length===0?'Cargando...':'Sin resultados'}</div>;
                  return resultados.slice(0,15).map(function(p,i){
                    return (<div key={i} className="px-3 py-2 border-b border-slate-100 last:border-0 flex items-center justify-between gap-2 hover:bg-slate-50 cursor-pointer"
                      onClick={function(){ setSelectedProveedor(p.proveedor); setBusqArticulo(''); setProvSearch(''); }}>
                      <div>
                        <div className="text-xs font-semibold text-slate-800">{p.articulo}</div>
                        <div className="text-[10px] text-slate-500">{p.proveedor}</div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 whitespace-nowrap">{p.unidad||'---'}</span>
                    </div>);
                  });
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedProveedor && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="w-4 h-4 text-cyan-500"/>
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex-1">
              3. Productos - {proveedorTitulo||selectedProveedor}
              {loadingProductos && <RefreshCw className="w-3 h-3 animate-spin text-slate-400 inline ml-2"/>}
            </h2>
            {lineasSeleccionadas.length>0 && (
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
                {lineasSeleccionadas.length} articulo(s) seleccionado(s)
              </span>
            )}
          </div>
          <div className="flex gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"/>
              <input type="text" value={searchTerm} onChange={function(e){setSearchTerm(e.target.value);}} placeholder="Buscar articulo..." className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500"/>
            </div>
            {subfamilias.length>0 && (
              <div className="relative min-w-48">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"/>
                <select value={selectedSubfamilia} onChange={function(e){setSelectedSubfamilia(e.target.value);}} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500 appearance-none">
                  <option value="">Todas las subfamilias</option>
                  {subfamilias.map(function(s){ return <option key={s} value={s}>{s}</option>; })}
                </select>
              </div>
            )}
          </div>
          {loadingProductos ? (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2"><RefreshCw className="w-4 h-4 animate-spin"/><span className="text-sm">Cargando articulos...</span></div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-900 text-white">
                  <th className="py-3 px-4 text-left text-[10px] uppercase tracking-wider font-bold w-24">Codigo</th>
                  <th className="py-3 px-4 text-left text-[10px] uppercase tracking-wider font-bold">Articulo</th>
                  <th className="py-3 px-4 text-center text-[10px] uppercase tracking-wider font-bold w-32 hidden md:table-cell">Unidad</th>
                  <th className="py-3 px-4 text-center text-[10px] uppercase tracking-wider font-bold w-36">Cantidad</th>
                </tr></thead>
                <tbody>
                  {productosFiltrados.map(function(p,idx){
                    var qty=cantidades[p.codigo]||0; var vu=valorUnitario[p.codigo]||0;
                    return (
                      <tr key={p.codigo||idx} className={'border-b border-slate-100 transition-colors '+(qty>0?'bg-emerald-50':idx%2===0?'bg-white':'bg-slate-50/50')}>
                        <td className="py-3 px-4 font-mono text-xs text-slate-500">{p.codigo}</td>
                        <td className="py-3 px-4 font-medium text-slate-800">{p.articulo}</td>
                        <td className="py-3 px-4 text-center text-slate-500 text-xs hidden md:table-cell">{p.unidad||'---'}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 justify-center">
                            <button onClick={function(){handleCantidad(p.codigo,qty-1);}} className="w-7 h-7 rounded-lg bg-slate-200 hover:bg-slate-300 font-bold flex items-center justify-center text-slate-600 text-base">-</button>
                            <input type="number" min="0" value={qty||''} onChange={function(e){handleCantidad(p.codigo,e.target.value);}} placeholder="0" className="w-14 text-center py-1.5 border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:border-cyan-500"/>
                            <button onClick={function(){handleCantidad(p.codigo,qty+1);}} className="w-7 h-7 rounded-lg bg-cyan-500 hover:bg-cyan-600 font-bold text-white flex items-center justify-center text-base">+</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {productosFiltrados.length===0 && <tr><td colSpan={4} className="py-12 text-center text-slate-400 text-sm">No hay articulos{searchTerm?' para "'+searchTerm+'"':''}.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          {lineasSeleccionadas.length>0 && (
            <div className="mt-4 flex justify-end">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 min-w-52">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Resumen</p>
                <div className="space-y-1 mb-3">
                  {lineasSeleccionadas.map(function(l){ return (<div key={l.codigo} className="flex justify-between text-xs text-slate-700"><span className="truncate max-w-36">{l.articulo}</span><span className="font-bold ml-2 text-cyan-700">x{l.cantidad}</span></div>); })}
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between text-xs font-bold text-slate-800">
                  <span>Total articulos</span>
                  <span className="text-cyan-600">{lineasSeleccionadas.reduce(function(s,l){return s+l.cantidad;},0)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Medio de Pago */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-cyan-500"/> 4. Medio de Pago
        </h2>
        <div className="flex gap-3">
          {['contado','credito'].map(function(mp){
            return (
              <button key={mp} onClick={function(){setMedioPago(mp);}}
                className={"flex-1 py-3 rounded-xl border-2 text-sm font-bold transition-all " + (medioPago===mp ? 'border-cyan-500 bg-cyan-50 text-cyan-700' : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300')}>
                {mp.charAt(0).toUpperCase()+mp.slice(1)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Save className="w-4 h-4 text-cyan-500"/> 5. Observaciones y Registro
        </h2>
        <textarea value={notas} onChange={function(e){setNotas(e.target.value);}} placeholder="Instrucciones especiales..." rows={3} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500 resize-none mb-4"/>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleGuardar} disabled={saving||lineasSeleccionadas.length===0}
            className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
            <Save className="w-4 h-4"/>
            {saving ? 'Guardando...' : 'Guardar y Descargar PDF'}
          </button>
          <button onClick={handleSoloPDF} disabled={lineasSeleccionadas.length===0}
            className="flex items-center gap-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
            <Download className="w-4 h-4"/> Solo Descargar PDF
          </button>
          <button onClick={function(){ invalidarCache(); if(selectedProveedor){var pv=selectedProveedor;setSelectedProveedor('');setTimeout(function(){setSelectedProveedor(pv);},150);} alert('Cache borrado.'); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-medium transition-all">
            <RefreshCw className="w-4 h-4"/> Actualizar Drive
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Search className="w-4 h-4 text-cyan-500"/> 6. Historial de Pedidos
        </h2>
        <HistorialPedidos/>
      </div>

    </div>
  );
}
