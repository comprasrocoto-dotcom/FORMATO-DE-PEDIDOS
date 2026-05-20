// @ts-nocheck
/**
 * SheetsOrderForm.tsx - v5
 * FIXES:
 * - PDF con mapa exacto del usuario (Sede, Proveedor, tabla Articulo/Subartículo/Cantidad/Valor/Total)
 * - Página NO se queda en blanco después de guardar
 * - Productos recargan siempre que cambia proveedor
 * - unidad leída como subArticulo (único campo disponible como clasificación)
 * - Mapeos correctos en BuscadorPedidos
 * - Firebase errors ignorados (solo Drive)
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
import { dbService } from '../services/db';
// @ts-ignore
import html2pdf from 'html2pdf.js';

const ENDPOINT = 'https://script.google.com/macros/s/AKfycbzlfjOyyYCGj5AaSTScISTq3rEL3b8AB9en2LYKsbhmZ8P3goP9J15NC7QVt1ePgIAWCA/exec';

// ─── PDF Generator — mapa exacto del usuario ─────────────────────────────────
// Layout:
// [HEADER INFO]  Sede | Proveedor
// Direccion      NIT
// Telefono       Telefono
// Horario        Asesor
// Encargado
// [TABLA] Artículo | Subartículo | Cantidad | Valor Unitario | Total
// [TOTAL]
// [OBSERVACION]
function generarPDF(params) {
  var sede = params.sede || '';
  var sedeDireccion = params.sedeDireccion || '';
  var sedeTelefono = params.sedeTelefono || '';
  var sedeHorario = params.sedeHorario || '';
  var encargado = params.encargado || '';
  var proveedorNombre = params.proveedorNombre || '';
  var proveedorNit = params.proveedorNit || '';
  var proveedorTelefono = params.proveedorTelefono || '';
  var proveedorAsesor = params.proveedorAsesor || '';
  var lineas = params.lineas || [];
  var notas = params.notas || '';
  var numeroOrden = params.numeroOrden || '';
  var fecha = new Date().toLocaleDateString('es-CO', { year:'numeric', month:'long', day:'numeric' });
  var fechaHoy = new Date().toISOString().slice(0, 10);

  // Solo líneas con cantidad > 0
  var activas = lineas.filter(function(l){ return (l.cantidad || 0) > 0; });
  var total = activas.reduce(function(s, l){ return s + ((l.valorUnitario || 0) * (l.cantidad || 0)); }, 0);

  // Filas de artículos
  var filas = activas.map(function(l, i) {
    var bg = i % 2 === 0 ? '#ffffff' : '#f8f9fc';
    var tot = (l.valorUnitario || 0) * (l.cantidad || 0);
    return '<tr style="background:' + bg + ';">' +
      '<td style="border:1px solid #d0d7e8;padding:7px 10px;font-size:11px;">' + (l.articulo || '') + '</td>' +
      '<td style="border:1px solid #d0d7e8;padding:7px 10px;font-size:11px;">' + (l.subArticulo || l.unidad || '') + '</td>' +
      '<td style="border:1px solid #d0d7e8;padding:7px 10px;text-align:center;font-size:11px;font-weight:700;">' + (l.cantidad || 0) + '</td>' +
      '<td style="border:1px solid #d0d7e8;padding:7px 10px;text-align:right;font-size:11px;">$ ' + Number(l.valorUnitario||0).toLocaleString('es-CO') + '</td>' +
      '<td style="border:1px solid #d0d7e8;padding:7px 10px;text-align:right;font-size:11px;font-weight:600;">$ ' + Number(tot).toLocaleString('es-CO') + '</td>' +
      '</tr>';
  });
  // Filas vacías hasta 8 mínimo
  var vacías = Math.max(0, 8 - activas.length);
  for (var ei = 0; ei < vacías; ei++) {
    var bg2 = (activas.length + ei) % 2 === 0 ? '#ffffff' : '#f8f9fc';
    filas.push('<tr style="background:' + bg2 + ';height:26px;">' +
      '<td style="border:1px solid #d0d7e8;padding:7px 10px;">&nbsp;</td>' +
      '<td style="border:1px solid #d0d7e8;"></td>' +
      '<td style="border:1px solid #d0d7e8;"></td>' +
      '<td style="border:1px solid #d0d7e8;"></td>' +
      '<td style="border:1px solid #d0d7e8;"></td>' +
      '</tr>');
  }

  var html = '<!DOCTYPE html><html><head><meta charset="utf-8"/>';
  html += '<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#222;background:#fff;}';
  html += '.page{padding:28px 32px;}';
  html += '.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 40px;margin-bottom:20px;}';
  html += '.info-row{display:flex;gap:8px;margin-bottom:5px;font-size:11.5px;}';
  html += '.info-lbl{color:#0070c0;font-weight:700;min-width:120px;white-space:nowrap;}';
  html += '.info-val{color:#222;}';
  html += 'table{width:100%;border-collapse:collapse;margin-bottom:8px;}';
  html += 'thead tr{background:#1a1a2e;color:#fff;}';
  html += 'thead th{padding:8px 10px;text-align:left;font-size:11px;font-weight:700;border:1px solid #1a1a2e;}';
  html += 'thead th.num{text-align:center;}thead th.right{text-align:right;}';
  html += '.total-row{display:flex;justify-content:flex-end;margin-bottom:20px;}';
  html += '.total-box{font-size:12px;font-weight:700;display:flex;gap:20px;padding:6px 0;}';
  html += '.obs-lbl{font-size:11px;font-weight:700;margin-bottom:6px;color:#222;}';
  html += '.obs-box{border:1px solid #999;min-height:60px;padding:8px;font-size:11px;}';
  html += '.doc-title{font-size:10px;color:#888;text-align:right;margin-bottom:12px;}';
  html += '</style></head><body><div class="page">';

  // Número de pedido arriba
  html += '<div class="doc-title">Pedido #' + numeroOrden + ' &bull; ' + fecha + '</div>';

  // Info grid izquierda / derecha
  html += '<div class="info-grid">';
  // Columna izquierda: Sede info
  html += '<div>';
  html += '<div class="info-row"><span class="info-lbl">Sede</span><span class="info-val">' + sede + '</span></div>';
  html += '<div class="info-row"><span class="info-lbl">Dirección de entrega</span><span class="info-val">' + (sedeDireccion || '—') + '</span></div>';
  html += '<div class="info-row"><span class="info-lbl">Teléfono</span><span class="info-val">' + (sedeTelefono || '—') + '</span></div>';
  html += '<div class="info-row"><span class="info-lbl">Horario de entrega</span><span class="info-val">' + (sedeHorario || '—') + '</span></div>';
  html += '<div class="info-row"><span class="info-lbl">Encargado</span><span class="info-val">' + (encargado || '—') + '</span></div>';
  html += '</div>';
  // Columna derecha: Proveedor info
  html += '<div>';
  html += '<div class="info-row"><span class="info-lbl">Proveedor</span><span class="info-val">' + proveedorNombre + '</span></div>';
  html += '<div class="info-row"><span class="info-lbl">Nit</span><span class="info-val">' + (proveedorNit || '—') + '</span></div>';
  html += '<div class="info-row"><span class="info-lbl">Teléfono</span><span class="info-val">' + (proveedorTelefono || '—') + '</span></div>';
  html += '<div class="info-row"><span class="info-lbl">Asesor</span><span class="info-val">' + (proveedorAsesor || '—') + '</span></div>';
  html += '</div>';
  html += '</div>';

  // Tabla de artículos
  html += '<table><thead><tr>';
  html += '<th style="width:28%;">Artículo</th>';
  html += '<th style="width:22%;">Subartículo</th>';
  html += '<th class="num" style="width:10%;">Cantidad</th>';
  html += '<th class="right" style="width:18%;">Valor Unitario</th>';
  html += '<th class="right" style="width:18%;">Total</th>';
  html += '</tr></thead><tbody>' + filas.join('') + '</tbody></table>';

  // Total
  html += '<div class="total-row"><div class="total-box">';
  html += '<span>Total</span><span>$ ' + Number(total).toLocaleString('es-CO') + ',00</span>';
  html += '</div></div>';

  // Observación
  html += '<div class="obs-lbl">Observación</div>';
  html += '<div class="obs-box">' + (notas || '') + '</div>';

  html += '</div></body></html>';

  var slug = proveedorNombre.replace(/[^A-Za-z0-9]/g,'_').substring(0,20);
  var opt = {
    margin: [10,10,10,10],
    filename: 'Pedido-' + numeroOrden + '_' + slug + '_' + fechaHoy + '.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false,
      onclone: function(d) {
        var ss = d.getElementsByTagName('style');
        for (var s = 0; s < ss.length; s++) {
          if (ss[s].innerHTML.indexOf('oklch') !== -1)
            ss[s].innerHTML = ss[s].innerHTML.replace(/oklch\([^)]+\)/g,'#ccc');
        }
      }
    },
    jsPDF: { unit:'mm', format:'letter', orientation:'portrait' }
  };
  var container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '816px';
  container.style.zIndex = '-9999';
  container.style.pointerEvents = 'none';
  container.innerHTML = html;
  document.body.appendChild(container);
  return html2pdf().set(opt).from(container).save().finally(function(){
    try { document.body.removeChild(container); } catch(e) {}
  });
}

// ─── BuscadorPedidos ──────────────────────────────────────────────────────────
// Campos del Apps Script getPedidoByOrden:
// p.nOrden, p.fecha, p.sede, p.proveedor, p.responsable
// p.lineas[]: { codigo, insumo (=artículo real), subArticulo (=subcat), cantidad, unidad }
function BuscadorPedidos() {
  var [busId, setBusId] = useState('');
  var [buscando, setBuscando] = useState(false);
  var [pedido, setPedido] = useState(null);
  var [err, setErr] = useState('');
  var [exportando, setExportando] = useState(false);

  async function buscar() {
    if (!busId.trim()) { alert('Ingresa el ID del pedido.'); return; }
    setBuscando(true); setErr(''); setPedido(null);
    try {
      var res = await fetch(ENDPOINT + '?action=getPedidoByOrden&nOrden=' + encodeURIComponent(busId.trim()), { redirect:'follow' });
      var data = await res.json();
      if (!data.ok) { setErr(data.error || 'No encontrado.'); return; }
      var p = data.pedido;
      if (!p) { setErr('Sin datos.'); return; }
      var articulos;
      if (p.lineas && p.lineas.length > 0) {
        articulos = p.lineas.map(function(l){
          return {
            codigo: String(l.codigo || ''),
            articulo: String(l.insumo || l.articulo || ''),   // artículo real
            subArticulo: String(l.subArticulo || ''),          // subcategoría
            cantidad: String(l.cantidad || ''),
            unidad: String(l.unidad || '—'),
          };
        });
      } else if (data.rows && data.rows.length > 0) {
        // formato legacy: [nOrden,fecha,sede,proveedor,codigo,insumo,subArticulo,cantidad,unidad,responsable]
        articulos = data.rows.map(function(r){
          return {
            codigo: String(r[4] || ''),
            articulo: String(r[5] || ''),    // insumo = artículo real
            subArticulo: String(r[6] || ''), // subArticulo
            cantidad: String(r[7] || ''),
            unidad: String(r[8] || '—'),
          };
        });
      } else { setErr('Pedido sin artículos.'); return; }
      var first = data.rows ? data.rows[0] : null;
      setPedido({
        nOrden: String(p.nOrden || busId),
        fecha: String(p.fecha || (first && first[1]) || '—').split('GMT')[0].trim(),
        sede: String(p.sede || (first && first[2]) || '—'),
        proveedor: String(p.proveedor || (first && first[3]) || '—'),
        responsable: String(p.responsable || (first && first[9]) || '—'),
        articulos: articulos,
      });
    } catch(e) { setErr('Error: ' + e.message); }
    finally { setBuscando(false); }
  }

  async function exportExcel() {
    if (!pedido) return;
    setExportando(true);
    try {
      if (typeof window.XLSX === 'undefined') {
        await new Promise(function(res2, rej){
          var s = document.createElement('script');
          s.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
          s.onload = res2; s.onerror = rej;
          document.head.appendChild(s);
        });
      }
      var XLSX = window.XLSX;
      var wsData = [
        ['N° Orden','Fecha','Sede','Proveedor','Responsable'],
        [pedido.nOrden, pedido.fecha, pedido.sede, pedido.proveedor, pedido.responsable],
        [],
        ['Código','Artículo','Subartículo','Cantidad','Unidad'],
      ].concat(pedido.articulos.map(function(a){ return [a.codigo, a.articulo, a.subArticulo, a.cantidad, a.unidad]; }));
      var ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{wch:14},{wch:38},{wch:22},{wch:12},{wch:14}];
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Pedido ' + pedido.nOrden);
      XLSX.writeFile(wb, 'Pedido_' + pedido.nOrden + '.xlsx');
    } catch(e) { alert('Error Excel: ' + e.message); }
    finally { setExportando(false); }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4" style={{background:'#1a3c6e'}}>
        <Search className="w-5 h-5 text-blue-300"/>
        <div>
          <div className="text-white font-bold text-sm">Buscador de Pedidos</div>
          <div className="text-blue-300 text-xs">Consulta cualquier orden registrada</div>
        </div>
      </div>
      <div className="p-5 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"/>
            <input type="text" value={busId}
              onChange={function(e){ setBusId(e.target.value); }}
              onKeyDown={function(e){ if(e.key==='Enter') buscar(); }}
              placeholder="Ingresa el ID del pedido (ej: 1779218515)"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"/>
          </div>
          <button onClick={buscar} disabled={buscando}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{background:'#1a3c6e',minWidth:'110px',justifyContent:'center'}}>
            <Search className="w-4 h-4"/>
            {buscando ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
        {err && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0"/>{err}
          </div>
        )}
        {pedido && (
          <div className="space-y-3">
            <div className="rounded-xl p-4 space-y-3" style={{background:'#eef2fa',border:'1px solid #c8d5ed'}}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Orden encontrada</div>
                  <div className="text-2xl font-black" style={{color:'#1a3c6e'}}>#{pedido.nOrden}</div>
                </div>
                <button onClick={exportExcel} disabled={exportando}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                  style={{background:'#1a7c3c'}}>
                  <FileSpreadsheet className="w-4 h-4"/>
                  {exportando ? 'Exportando...' : 'Excel'}
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[{l:'Fecha',v:pedido.fecha},{l:'Sede',v:pedido.sede},{l:'Proveedor',v:pedido.proveedor},{l:'Responsable',v:pedido.responsable}].map(function(x){
                  return (
                    <div key={x.l}>
                      <div className="text-xs font-bold uppercase tracking-wider mb-0.5 text-slate-400">{x.l}</div>
                      <div className="text-sm font-bold" style={{color:'#1a3c6e'}}>{x.v}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="text-xs font-bold uppercase tracking-wider" style={{color:'#1a3c6e'}}>
              {pedido.articulos.length} artículo(s)
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{background:'#1a3c6e'}}>
                    <th className="py-2.5 px-3 text-left text-white text-xs font-bold uppercase w-28">Código</th>
                    <th className="py-2.5 px-3 text-left text-white text-xs font-bold uppercase">Artículo</th>
                    <th className="py-2.5 px-3 text-left text-white text-xs font-bold uppercase hidden md:table-cell">Subartículo</th>
                    <th className="py-2.5 px-3 text-center text-white text-xs font-bold uppercase w-20">Cant.</th>
                    <th className="py-2.5 px-3 text-center text-white text-xs font-bold uppercase w-20">Unidad</th>
                  </tr>
                </thead>
                <tbody>
                  {pedido.articulos.map(function(a, i){
                    return (
                      <tr key={i} className={'border-b border-slate-100 ' + (i%2===0?'bg-white':'bg-slate-50')}>
                        <td className="py-2 px-3 font-mono text-xs text-slate-500">{a.codigo}</td>
                        <td className="py-2 px-3 font-medium text-slate-800">{a.articulo}</td>
                        <td className="py-2 px-3 text-slate-500 text-xs hidden md:table-cell">{a.subArticulo}</td>
                        <td className="py-2 px-3 text-center font-bold text-blue-800">{a.cantidad}</td>
                        <td className="py-2 px-3 text-center text-slate-500 text-xs">{a.unidad}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {!pedido && !err && !buscando && (
          <div className="text-center py-6 text-slate-400">
            <Search className="w-8 h-8 mx-auto mb-2 text-slate-300"/>
            <div className="text-sm">Ingresa un ID para consultar</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SheetsOrderForm principal ───────────────────────────────────────────────
export default function SheetsOrderForm() {
  // ── Estado ────────────────────────────────────────────────────────────────
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
  var [responsable, setResponsable] = useState(function(){ return localStorage.getItem('ped_responsable') || ''; });
  var [correo, setCorreo] = useState(function(){ return localStorage.getItem('ped_correo') || ''; });
  var [notas, setNotas] = useState('');
  var [cantidades, setCantidades] = useState({});
  var [valorUnitario, setValorUnitario] = useState({});

  // Ref para cancelar efectos
  var cancelRef = useRef(false);

  // ── Carga inicial: proveedores + sedes ────────────────────────────────────
  useEffect(function() {
    cancelRef.current = false;
    async function load() {
      try {
        setLoading(true);
        var [nombres, sds] = await Promise.all([
          getProveedorSheetNames(),
          getSedes(),
        ]);
        if (cancelRef.current) return;
        setProveedoresNombres(nombres || []);
        // Sedes pueden ser strings o objetos
        var sedesNorm = (sds || []).map(function(s) {
          if (typeof s === 'string') return { nombre: s, direccion: '', horaEntrega: '', telefono: '' };
          return { nombre: s.nombre || s, direccion: s.direccion || '', horaEntrega: s.horaEntrega || s.horario || '', telefono: s.telefono || '' };
        });
        setSedes(sedesNorm);
        setErrorGlobal('');
      } catch(e) {
        if (!cancelRef.current) setErrorGlobal('Error conectando con Drive: ' + e.message);
      } finally {
        if (!cancelRef.current) setLoading(false);
      }
    }
    load();
    return function() { cancelRef.current = true; };
  }, []);

  // ── Carga artículos al cambiar proveedor ──────────────────────────────────
  // FIX: useEffect con selectedProveedor como dependencia - siempre recarga
  useEffect(function() {
    if (!selectedProveedor) {
      setProductos([]);
      setSubfamilias([]);
      setCantidades({});
      setValorUnitario({});
      setSearchTerm('');
      setSelectedSubfamilia('');
      return;
    }
    var cancelled = false;
    async function cargar() {
      setLoadingProductos(true);
      setProductos([]);      // limpiar inmediatamente
      setCantidades({});
      setValorUnitario({});
      setSearchTerm('');
      setSelectedSubfamilia('');
      try {
        // Invalidar caché para asegurar datos frescos si hay problemas
        var [prods, subs] = await Promise.all([
          getProductosByProveedor(selectedProveedor),
          getSubfamiliasByProveedor(selectedProveedor),
        ]);
        if (cancelled) return;
        setProductos(prods || []);
        setSubfamilias(subs || []);
      } catch(e) {
        if (!cancelled) setErrorGlobal('Error cargando artículos: ' + e.message);
      } finally {
        if (!cancelled) setLoadingProductos(false);
      }
    }
    cargar();
    return function() { cancelled = true; };
  }, [selectedProveedor]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function handleCantidad(codigo, val) {
    var v = Math.max(0, parseInt(val) || 0);
    setCantidades(function(prev){ return Object.assign({}, prev, { [codigo]: v }); });
  }

  function handleValorUnitario(codigo, val) {
    var v = Math.max(0, parseFloat(val) || 0);
    setValorUnitario(function(prev){ return Object.assign({}, prev, { [codigo]: v }); });
  }

  // Filtrar productos por búsqueda y subfamilia
  var productosFiltrados = productos.filter(function(p) {
    var mSearch = !searchTerm ||
      (p.articulo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.codigo || '').toLowerCase().includes(searchTerm.toLowerCase());
    var mSub = !selectedSubfamilia || p.subfamilia === selectedSubfamilia;
    return mSearch && mSub;
  });

  // Líneas seleccionadas (cantidad > 0)
  var lineasSeleccionadas = productos
    .filter(function(p){ return (cantidades[p.codigo] || 0) > 0; })
    .map(function(p){
      return {
        codigo: p.codigo,
        articulo: p.articulo,          // nombre real del artículo
        subArticulo: p.subfamilia || '', // subfamilia como subartículo
        unidad: p.unidad || '',
        cantidad: cantidades[p.codigo] || 0,
        valorUnitario: valorUnitario[p.codigo] || 0,
      };
    });

  var sedeObj = sedes.find(function(s){ return s.nombre === selectedSede; }) || null;

  // ── Guardar pedido ────────────────────────────────────────────────────────
  // FIX: sin reload, sin reset de componente, manejo robusto de errores
  async function handleGuardar() {
    if (!responsable.trim()) { alert('Ingresa tu nombre.'); return; }
    if (!selectedSede) { alert('Selecciona una sede.'); return; }
    if (!selectedProveedor) { alert('Selecciona un proveedor.'); return; }
    if (lineasSeleccionadas.length === 0) { alert('Agrega al menos un artículo con cantidad > 0.'); return; }

    setSaving(true);
    setErrorGlobal('');
    setSuccess(false);

    // Capturar snapshots ANTES del async para evitar stale state
    var lineasSnap = lineasSeleccionadas.slice();
    var notasSnap = notas;
    var sedeSnap = selectedSede;
    var provSnap = selectedProveedor;
    var respSnap = responsable;
    var correoSnap = correo;
    var sedeDirSnap = sedeObj ? sedeObj.direccion : '';
    var sedeHorSnap = sedeObj ? sedeObj.horaEntrega : '';
    var sedeTelSnap = sedeObj ? sedeObj.telefono : '';

    try {
      localStorage.setItem('ped_responsable', respSnap);
      localStorage.setItem('ped_correo', correoSnap);

      // Número de orden
      var numeroOrden = Math.floor(Date.now() / 1000);
      try { var n2 = await dbService.getNextGlobalConsecutive(); if (n2) numeroOrden = n2; }
      catch(eN) { console.warn('[Firebase] fallback timestamp:', eN); }

      var fechaHoy = new Date().toISOString().split('T')[0];

      // Guardar cada línea en Drive — NO detener si una falla
      var errores = 0;
      for (var i = 0; i < lineasSnap.length; i++) {
        var linea = lineasSnap[i];
        try {
          await appendPedido({
            fecha: fechaHoy,
            sede: sedeSnap,
            proveedor: provSnap,
            codigo: linea.codigo || '',
            articulo: linea.articulo || '',       // artículo real → campo insumo
            subArticulo: linea.subArticulo || '',  // subfamilia
            cantidad: linea.cantidad || 0,
            unidad: linea.unidad || '',
            responsable: respSnap,
            correoResponsable: correoSnap,
            notas: notasSnap,
            numeroOrden: String(numeroOrden),
          });
        } catch(errLinea) {
          console.error('[appendPedido] error en línea ' + i + ':', errLinea);
          errores++;
        }
      }

      // Mostrar éxito aunque alguna línea haya fallado
      setSuccess(true);

      // IMPORTANTE: resetear solo cantidades y notas — NO el proveedor ni otros campos
      // Esto evita que la página quede en blanco
      setCantidades({});
      setValorUnitario({});
      setNotas('');
      setTimeout(function(){ setSuccess(false); }, 8000);

      // Generar PDF después de un pequeño delay (evita conflicto con re-render)
      setTimeout(function(){
        try {
          generarPDF({
            sede: sedeSnap,
            sedeDireccion: sedeDirSnap,
            sedeTelefono: sedeTelSnap,
            sedeHorario: sedeHorSnap,
            encargado: respSnap,
            proveedorNombre: provSnap,
            proveedorNit: '',
            proveedorTelefono: '',
            proveedorAsesor: '',
            lineas: lineasSnap,
            notas: notasSnap,
            numeroOrden: numeroOrden,
          });
        } catch(pdfErr) {
          console.error('[PDF]', pdfErr);
          alert('El pedido se guardó, pero hubo un error al generar el PDF: ' + pdfErr.message);
        }
      }, 600);

      if (errores > 0) {
        setErrorGlobal(errores + ' línea(s) no se guardaron en Drive. El PDF se descargó igual.');
      }

    } catch(e) {
      console.error('[handleGuardar]', e);
      setErrorGlobal('Error al guardar: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Solo descargar PDF ────────────────────────────────────────────────────
  async function handleSoloPDF() {
    if (!selectedProveedor) { alert('Selecciona un proveedor.'); return; }
    if (lineasSeleccionadas.length === 0) { alert('Agrega artículos primero.'); return; }
    var n = Math.floor(Date.now() / 1000);
    try { var n2 = await dbService.getNextGlobalConsecutive(); if (n2) n = n2; } catch(e) {}
    try {
      generarPDF({
        sede: selectedSede,
        sedeDireccion: sedeObj ? sedeObj.direccion : '',
        sedeTelefono: sedeObj ? sedeObj.telefono : '',
        sedeHorario: sedeObj ? sedeObj.horaEntrega : '',
        encargado: responsable || 'Sin especificar',
        proveedorNombre: selectedProveedor,
        proveedorNit: '',
        proveedorTelefono: '',
        proveedorAsesor: '',
        lineas: lineasSeleccionadas,
        notas: notas,
        numeroOrden: n,
      });
    } catch(e) {
      alert('Error generando PDF: ' + e.message);
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center min-h-64 gap-3 text-slate-500">
      <RefreshCw className="w-5 h-5 animate-spin"/>
      <span className="text-sm font-medium">Cargando datos desde Drive...</span>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-5">

      {/* Mensajes globales */}
      {errorGlobal && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5"/>
          <div className="flex-1">
            <p className="font-semibold text-sm">Error</p>
            <p className="text-xs mt-0.5">{errorGlobal}</p>
          </div>
          <button onClick={function(){ setErrorGlobal(''); }} className="text-xs underline">Cerrar</button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-700">
          <CheckCircle className="w-5 h-5 flex-shrink-0"/>
          <div>
            <p className="font-semibold text-sm">¡Pedido guardado!</p>
            <p className="text-xs mt-0.5">El PDF se está descargando. Puedes hacer otro pedido.</p>
          </div>
        </div>
      )}

      {/* Paso 1: Información */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-cyan-500"/> 1. Información del Pedido
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Sede *</label>
            <select value={selectedSede} onChange={function(e){ setSelectedSede(e.target.value); }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500">
              <option value="">Seleccionar sede...</option>
              {sedes.map(function(s){ return <option key={s.nombre} value={s.nombre}>{s.nombre}</option>; })}
            </select>
            {sedeObj && (sedeObj.direccion || sedeObj.horaEntrega) && (
              <div className="mt-1.5 text-xs text-slate-500 space-y-0.5 pl-1">
                {sedeObj.direccion && <p>{sedeObj.direccion}</p>}
                {sedeObj.horaEntrega && <p className="text-cyan-600 font-medium">Horario: {sedeObj.horaEntrega}</p>}
              </div>
            )}
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Responsable *</label>
            <input type="text" value={responsable} onChange={function(e){ setResponsable(e.target.value); }}
              placeholder="Tu nombre completo"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500"/>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Correo</label>
            <input type="email" value={correo} onChange={function(e){ setCorreo(e.target.value); }}
              placeholder="correo@empresa.com"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500"/>
          </div>
        </div>
      </div>

      {/* Paso 2: Proveedor */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Truck className="w-4 h-4 text-cyan-500"/> 2. Seleccionar Proveedor ({proveedoresNombres.length} disponibles)
        </h2>
        <select value={selectedProveedor} onChange={function(e){ setSelectedProveedor(e.target.value); }}
          className="w-full md:w-96 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500">
          <option value="">Seleccionar proveedor...</option>
          {proveedoresNombres.map(function(n){ return <option key={n} value={n}>{n}</option>; })}
        </select>
      </div>

      {/* Paso 3: Artículos */}
      {selectedProveedor && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="w-4 h-4 text-cyan-500"/>
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex-1">
              3. Artículos de {selectedProveedor}
              {loadingProductos && <RefreshCw className="w-3 h-3 animate-spin text-slate-400 inline ml-2"/>}
            </h2>
            {lineasSeleccionadas.length > 0 && (
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
                {lineasSeleccionadas.length} seleccionado(s)
              </span>
            )}
          </div>

          {/* Filtros */}
          <div className="flex gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"/>
              <input type="text" value={searchTerm}
                onChange={function(e){ setSearchTerm(e.target.value); }}
                placeholder="Buscar artículo por nombre o código..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500"/>
            </div>
            {subfamilias.length > 0 && (
              <div className="relative min-w-48">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"/>
                <select value={selectedSubfamilia} onChange={function(e){ setSelectedSubfamilia(e.target.value); }}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500 appearance-none">
                  <option value="">Todas las subfamilias</option>
                  {subfamilias.map(function(s){ return <option key={s} value={s}>{s}</option>; })}
                </select>
              </div>
            )}
          </div>

          {/* Tabla */}
          {loadingProductos ? (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
              <RefreshCw className="w-4 h-4 animate-spin"/>
              <span className="text-sm">Cargando artículos de {selectedProveedor}...</span>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="py-3 px-4 text-left text-[10px] uppercase tracking-wider font-bold w-24">Código</th>
                    <th className="py-3 px-4 text-left text-[10px] uppercase tracking-wider font-bold">Artículo</th>
                    <th className="py-3 px-4 text-right text-[10px] uppercase tracking-wider font-bold w-32 hidden md:table-cell">Valor Unit.</th>
                    <th className="py-3 px-4 text-center text-[10px] uppercase tracking-wider font-bold w-36">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {productosFiltrados.map(function(p, idx){
                    var qty = cantidades[p.codigo] || 0;
                    var vu = valorUnitario[p.codigo] || 0;
                    return (
                      <tr key={p.codigo || idx}
                        className={'border-b border-slate-100 transition-colors ' + (qty>0?'bg-emerald-50':idx%2===0?'bg-white':'bg-slate-50/50')}>
                        <td className="py-3 px-4 font-mono text-xs text-slate-500">{p.codigo}</td>
                        <td className="py-3 px-4 font-medium text-slate-800">{p.articulo}</td>
                        <td className="py-3 px-4 hidden md:table-cell">
                          <input type="number" min="0" value={vu || ''}
                            onChange={function(e){ handleValorUnitario(p.codigo, e.target.value); }}
                            placeholder="0"
                            className="w-28 text-right py-1.5 px-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-cyan-500 ml-auto block"/>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 justify-center">
                            <button onClick={function(){ handleCantidad(p.codigo, qty-1); }}
                              className="w-7 h-7 rounded-lg bg-slate-200 hover:bg-slate-300 font-bold flex items-center justify-center text-slate-600 text-base">-</button>
                            <input type="number" min="0" value={qty || ''}
                              onChange={function(e){ handleCantidad(p.codigo, e.target.value); }}
                              placeholder="0"
                              className="w-14 text-center py-1.5 border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:border-cyan-500"/>
                            <button onClick={function(){ handleCantidad(p.codigo, qty+1); }}
                              className="w-7 h-7 rounded-lg bg-cyan-500 hover:bg-cyan-600 font-bold text-white flex items-center justify-center text-base">+</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {productosFiltrados.length === 0 && (
                    <tr><td colSpan={4} className="py-12 text-center text-slate-400 text-sm">
                      No hay artículos{searchTerm ? ' para "'+searchTerm+'"' : ''}.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Resumen */}
          {lineasSeleccionadas.length > 0 && (
            <div className="mt-4 flex justify-end">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 min-w-52">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Resumen</p>
                <div className="space-y-1 mb-3">
                  {lineasSeleccionadas.map(function(l){
                    return (
                      <div key={l.codigo} className="flex justify-between text-xs text-slate-700">
                        <span className="truncate max-w-36">{l.articulo}</span>
                        <span className="font-bold ml-2 text-cyan-700">x{l.cantidad}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between text-xs font-bold text-slate-800">
                  <span>Total artículos</span>
                  <span className="text-cyan-600">{lineasSeleccionadas.reduce(function(s,l){ return s+l.cantidad; }, 0)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Paso 4: Observaciones y botones */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Save className="w-4 h-4 text-cyan-500"/> 4. Observaciones y Registro
        </h2>
        <textarea value={notas} onChange={function(e){ setNotas(e.target.value); }}
          placeholder="Instrucciones especiales, horario de entrega, observaciones..."
          rows={3}
          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500 resize-none mb-4"/>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleGuardar}
            disabled={saving || lineasSeleccionadas.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
            {saving ? 'Guardando...' : 'Guardar y Descargar PDF'}
          </button>
          <button onClick={handleSoloPDF}
            disabled={lineasSeleccionadas.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
            <Download className="w-4 h-4"/> Solo Descargar PDF
          </button>
          <button onClick={function(){
              invalidarCache();
              if (selectedProveedor) {
                // Forzar recarga de artículos invalidando y re-seteando proveedor
                var prov = selectedProveedor;
                setSelectedProveedor('');
                setTimeout(function(){ setSelectedProveedor(prov); }, 100);
              }
              alert('Caché borrado. Datos actualizados.');
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-medium transition-all">
            <RefreshCw className="w-4 h-4"/> Actualizar Drive
          </button>
        </div>
      </div>

      {/* Paso 5: Buscador */}
      <div>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Search className="w-4 h-4 text-cyan-500"/> 5. Consultar Pedido Existente
        </h2>
        <BuscadorPedidos/>
      </div>

    </div>
  );
}
