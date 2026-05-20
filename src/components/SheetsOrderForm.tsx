// @ts-nocheck
/**
 * SheetsOrderForm.tsx - v4
 * Fixes:
 * - Mapeo correcto: proveedor=articulo(Drive), insumo=subArticulo(Drive)
 * - Selector de proveedor muestra solo proveedores únicos
 * - Filtro de Subfamilia dinámico por proveedor
 * - BuscadorPedidos con campos correctos
 * - Tabs Ventas/Cotizaciones eliminados del header
 */

import { useState, useEffect } from 'react';
import { ShoppingCart, Building2, User, Truck, RefreshCw, Save, Download,
  AlertCircle, CheckCircle, Search, X, FileSpreadsheet, Filter } from 'lucide-react';
import {
  getProveedores,
  getSedes,
  getProductosByProveedor,
  getProveedorSheetNames,
  getSubfamiliasByProveedor,
  appendPedido,
  invalidarCache,
  ProveedorSheet,
  ProductoSheet,
  SedeSheet,
} from '../services/googleSheets';
import { dbService } from '../services/db';
// @ts-ignore
import html2pdf from 'html2pdf.js';

const APPS_SCRIPT_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzlfjOyyYCGj5AaSTScISTq3rEL3b8AB9en2LYKsbhmZ8P3goP9J15NC7QVt1ePgIAWCA/exec';

interface LineItem {
  codigo: string;
  articulo: string;    // nombre real del artículo (subArticulo en Drive)
  subfamilia: string;
  unidad: string;
  cantidad: number;
}

// ─── PDF Generator ───────────────────────────────────────────────────────────
function generarPDF(params) {
  var { sede, proveedor, proveedorNombre, lineas, notas, responsable, correoResponsable, numeroOrden } = params;
  var fecha = new Date().toLocaleDateString('es-CO', { year:'numeric', month:'long', day:'numeric' });
  var fechaHoy = new Date().toISOString().slice(0, 10);
  var activeLineas = lineas.filter(function(l){ return l.cantidad > 0; });
  var provName = proveedor ? (proveedor.nombre || proveedorNombre) : proveedorNombre;
  var provTel = proveedor ? (proveedor.telefono || '—') : '—';
  var sedeName = sede ? (sede.nombre || '—') : '—';
  var sedeDir = sede ? (sede.direccion || '—') : '—';
  var sedeHora = sede ? (sede.horaEntrega || '—') : '—';

  var itemRowsArr = activeLineas.map(function(l, idx) {
    var bg = idx % 2 === 0 ? '#ffffff' : '#f4f7fc';
    return '<tr style="background:' + bg + ';">' +
      '<td style="border:1px solid #dde3ee;padding:10px;text-align:center;font-size:11px;color:#888;">' + (idx+1) + '</td>' +
      '<td style="border:1px solid #dde3ee;padding:10px 14px;font-size:11px;font-weight:600;color:#1a1a2e;">' +
        (l.articulo || '') +
        (l.subfamilia ? '<div style="color:#999;font-size:9.5px;margin-top:2px;">' + l.subfamilia + '</div>' : '') +
      '</td>' +
      '<td style="border:1px solid #dde3ee;padding:10px;text-align:center;font-size:12px;font-weight:800;color:#1a3c6e;">' + (l.cantidad||0) + '</td>' +
      '<td style="border:1px solid #dde3ee;padding:10px;text-align:center;font-size:11px;color:#888;">' + (l.unidad || '—') + '</td>' +
      '<td style="border:1px solid #dde3ee;padding:10px;text-align:right;font-size:11px;color:#aaa;">—</td>' +
    '</tr>';
  });
  var emptyCount = Math.max(0, 10 - activeLineas.length);
  var emptyRowsArr = [];
  for (var ei = 0; ei < emptyCount; ei++) {
    var bg2 = (activeLineas.length+ei) % 2 === 0 ? '#ffffff' : '#f4f7fc';
    emptyRowsArr.push('<tr style="background:' + bg2 + ';">' +
      '<td style="border:1px solid #dde3ee;padding:14px 10px;text-align:center;color:#ddd;font-size:11px;">' + (activeLineas.length+ei+1) + '</td>' +
      '<td style="border:1px solid #dde3ee;padding:14px;">&nbsp;</td>' +
      '<td style="border:1px solid #dde3ee;padding:14px;"></td>' +
      '<td style="border:1px solid #dde3ee;padding:14px;"></td>' +
      '<td style="border:1px solid #dde3ee;padding:14px;"></td>' +
    '</tr>');
  }

  var html = '<!DOCTYPE html><html><head><meta charset="utf-8"/><style>' +
    'body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#1a1a2e;margin:0;padding:0;}' +
    '.page{padding:30px 36px;}' +
    '.top-band{background:#1a3c6e;height:7px;margin:-30px -36px 26px -36px;}' +
    '.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:18px;border-bottom:2px solid #e8ecf4;}' +
    '.logo-box{width:50px;height:50px;background:#1a3c6e;border-radius:10px;display:flex;align-items:center;justify-content:center;color:white;font-size:22px;font-weight:900;float:left;margin-right:12px;}' +
    '.brand-name{font-size:20px;font-weight:900;color:#1a3c6e;}' +
    '.brand-sub{font-size:9px;color:#9baac5;text-transform:uppercase;letter-spacing:1.5px;margin-top:2px;}' +
    '.oc-badge{background:#1a3c6e;color:white;border-radius:10px;padding:10px 18px;text-align:right;}' +
    '.oc-title{font-size:8px;text-transform:uppercase;letter-spacing:2px;color:#a8c0e8;font-weight:700;}' +
    '.oc-num{font-size:20px;font-weight:900;margin-top:2px;}' +
    '.oc-date{font-size:9px;color:#a8c0e8;margin-top:2px;}' +
    '.info-band{background:#f0f4fb;border:1px solid #ccd6ed;border-radius:8px;padding:9px 16px;display:flex;gap:28px;margin-bottom:16px;}' +
    '.info-lbl{font-size:8px;text-transform:uppercase;letter-spacing:1px;color:#8899bb;font-weight:700;display:block;}' +
    '.info-val{font-size:11px;font-weight:800;color:#1a3c6e;display:block;margin-top:1px;}' +
    '.prov-box{border:1px solid #ccd6ed;border-radius:8px;overflow:hidden;margin-bottom:16px;max-width:400px;}' +
    '.prov-hdr{background:#1a3c6e;color:white;font-weight:700;font-size:9px;padding:6px 12px;text-transform:uppercase;letter-spacing:1px;}' +
    '.prov-body{padding:10px 12px;background:#fafbfd;}' +
    '.prov-name{font-weight:800;font-size:13px;color:#1a3c6e;margin-bottom:3px;}' +
    '.prod-hdr{background:#1a3c6e;color:white;padding:8px 12px;font-weight:700;font-size:9px;text-transform:uppercase;letter-spacing:1px;border-radius:6px 6px 0 0;}' +
    'table.pt{width:100%;border-collapse:collapse;border:1px solid #dde3ee;}' +
    'table.pt th{background:#e6ebf5;color:#1a3c6e;border:1px solid #dde3ee;padding:8px 10px;font-size:9px;font-weight:800;text-transform:uppercase;}' +
    '.totals-wrap{display:flex;justify-content:flex-end;margin-top:10px;}' +
    'table.tt{border-collapse:collapse;width:220px;border:1px solid #dde3ee;}' +
    'table.tt td{border:1px solid #dde3ee;padding:6px 12px;font-size:11px;}' +
    '.ttlbl{text-align:right;font-weight:700;background:#f0f4fb;color:#555;text-transform:uppercase;font-size:9px;}' +
    '.tval{text-align:right;font-weight:600;}' +
    '.grand td{background:#1a3c6e!important;color:white!important;font-weight:900;font-size:12px;}' +
    '.obs-box{border:1px solid #dde3ee;margin-top:16px;border-radius:6px;overflow:hidden;}' +
    '.obs-hdr{background:#f0f4fb;color:#1a3c6e;padding:6px 12px;font-weight:800;font-size:9px;text-transform:uppercase;border-bottom:1px solid #dde3ee;}' +
    '.obs-body{padding:12px;min-height:44px;font-size:11px;line-height:1.7;color:#444;}' +
    '.footer{margin-top:16px;padding-top:10px;border-top:1px solid #e8ecf4;display:flex;justify-content:space-between;}' +
    '.footer-l,.footer-r{font-size:8.5px;color:#bbb;}' +
    '</style></head><body><div class="page">' +
    '<div class="top-band"></div>' +
    '<div class="hdr"><div style="display:flex;align-items:center;"><div class="logo-box">R</div><div><div class="brand-name">Rocoto Restaurantes</div><div class="brand-sub">Sistema de Compras</div></div></div>' +
    '<div class="oc-badge"><div class="oc-title">Orden de Compra</div><div class="oc-num">OC-' + numeroOrden + '</div><div class="oc-date">' + fecha + '</div></div></div>' +
    '<div class="info-band">' +
      '<div><span class="info-lbl">N&deg; Orden</span><span class="info-val">OC-' + numeroOrden + '</span></div>' +
      '<div><span class="info-lbl">Sede</span><span class="info-val">' + sedeName + '</span></div>' +
      '<div><span class="info-lbl">Direcci&oacute;n</span><span class="info-val">' + sedeDir + '</span></div>' +
      '<div><span class="info-lbl">Horario</span><span class="info-val">' + sedeHora + '</span></div>' +
    '</div>' +
    '<div class="prov-box"><div class="prov-hdr">&#128666; Proveedor</div><div class="prov-body">' +
      '<div class="prov-name">' + provName + '</div>' +
      '<div style="font-size:10.5px;color:#555;">Tel: ' + provTel + '</div>' +
    '</div></div>' +
    '<div class="prod-hdr">&#128230; Art&iacute;culos Solicitados</div>' +
    '<table class="pt"><thead><tr>' +
      '<th style="width:5%;text-align:center;">N.</th>' +
      '<th style="width:48%;text-align:left;">Art&iacute;culo</th>' +
      '<th style="width:12%;text-align:center;">Cantidad</th>' +
      '<th style="width:12%;text-align:center;">Unidad</th>' +
      '<th style="width:23%;text-align:right;">Total</th>' +
    '</tr></thead><tbody>' + itemRowsArr.join('') + emptyRowsArr.join('') + '</tbody></table>' +
    '<div class="totals-wrap"><table class="tt">' +
      '<tr><td class="ttlbl">Subtotal</td><td class="tval">A convenir</td></tr>' +
      '<tr class="grand"><td class="ttlbl">TOTAL</td><td class="tval">Seg&uacute;n factura</td></tr>' +
    '</table></div>' +
    '<div class="obs-box"><div class="obs-hdr">&#128221; Observaciones</div>' +
      '<div class="obs-body">' + (notas || '&nbsp;') + (responsable ? '<br/><span style="font-size:9px;color:#aaa;">Solicitado por: ' + responsable + '</span>' : '') + '</div></div>' +
    '<div class="footer"><div class="footer-l">Rocoto Restaurantes &bull; comprasrocoto@gmail.com</div>' +
      '<div class="footer-r">OC-' + numeroOrden + ' &bull; P&aacute;g. 1</div></div>' +
    '</div></body></html>';

  var slug = provName.replace(/[^A-Za-z0-9]/g,'_').substring(0,18);
  var opt = {
    margin:[8,8,8,8], filename:'OC-'+numeroOrden+'_'+slug+'_'+fechaHoy+'.pdf',
    image:{type:'jpeg',quality:0.97},
    html2canvas:{scale:2,useCORS:true,logging:false,
      onclone:function(d){ var ss=d.getElementsByTagName('style'); for(var s=0;s<ss.length;s++){ if(ss[s].innerHTML.indexOf('oklch')!==-1) ss[s].innerHTML=ss[s].innerHTML.replace(/oklch\([^)]+\)/g,'#ccc'); }}},
    jsPDF:{unit:'mm',format:'letter',orientation:'portrait'}
  };
  var container = document.createElement('div');
  container.style.cssText='position:fixed;left:-9999px;top:-9999px;width:816px;z-index:-1;pointer-events:none;';
  container.innerHTML = html;
  document.body.appendChild(container);
  html2pdf().set(opt).from(container).save().finally(function(){ document.body.removeChild(container); });
}

// ─── BuscadorPedidos ─────────────────────────────────────────────────────────
// Mapeo correcto de campos desde Apps Script:
// l.nOrden, l.fecha, l.sede, l.proveedor, l.responsable
// l.lineas[]: { codigo, insumo (=artículo real), subArticulo (=subfamilia), cantidad, unidad }
function BuscadorPedidos() {
  var [busquedaId, setBusquedaId] = useState('');
  var [buscando, setBuscando] = useState(false);
  var [pedido, setPedido] = useState(null);
  var [errorBusq, setErrorBusq] = useState(null);
  var [exportando, setExportando] = useState(false);

  var buscarPedido = async function() {
    if (!busquedaId.trim()) { alert('Ingresa el ID del pedido.'); return; }
    setBuscando(true); setErrorBusq(null); setPedido(null);
    try {
      var url = APPS_SCRIPT_ENDPOINT + '?action=getPedidoByOrden&nOrden=' + encodeURIComponent(busquedaId.trim());
      var res = await fetch(url, { redirect: 'follow' });
      var data = await res.json();
      if (!data.ok) { setErrorBusq(data.error || 'Pedido no encontrado.'); return; }
      var p = data.pedido;
      if (p && p.lineas) {
        if (p.lineas.length === 0) { setErrorBusq('Pedido encontrado pero sin artículos.'); return; }
        var fechaStr = String(p.fecha || '').split('GMT')[0].trim() || '—';
        setPedido({
          nOrden: String(p.nOrden || busquedaId),
          fecha: fechaStr,
          sede: String(p.sede || '—'),
          proveedor: String(p.proveedor || '—'),
          responsable: String(p.responsable || '—'),
          articulos: p.lineas.map(function(l) {
            return {
              codigo: String(l.codigo || ''),
              // insumo = artículo real (nombre del producto)
              articulo: String(l.insumo || l.articulo || ''),
              // subArticulo = subfamilia
              subfamilia: String(l.subArticulo || ''),
              cantidad: String(l.cantidad || ''),
              // unidad de medida
              unidad: String(l.unidad || '—'),
            };
          }),
        });
      } else {
        // Fallback formato legacy rows[]
        var rows2 = data.rows || [];
        if (rows2.length === 0) { setErrorBusq('No se encontraron registros para ese ID.'); return; }
        var first2 = rows2[0];
        // Columnas Drive: [0]nOrden [1]fecha [2]sede [3]proveedor [4]codigo [5]insumo [6]subArticulo [7]cantidad [8]unidad [9]responsable
        setPedido({
          nOrden: String(first2[0] || busquedaId),
          fecha: String(first2[1] || '—'),
          sede: String(first2[2] || '—'),
          proveedor: String(first2[3] || '—'),
          responsable: String(first2[9] || '—'),
          articulos: rows2.map(function(r2) {
            return {
              codigo: String(r2[4] || ''),
              articulo: String(r2[5] || ''),     // insumo/artículo real
              subfamilia: String(r2[6] || ''),   // subArticulo/subfamilia
              cantidad: String(r2[7] || ''),
              unidad: String(r2[8] || '—'), // unidad de medida
            };
          }),
        });
      }
    } catch(e) {
      setErrorBusq('Error de red: ' + e.message);
    } finally {
      setBuscando(false);
    }
  };

  var exportarExcel = async function() {
    if (!pedido) return;
    setExportando(true);
    try {
      if (typeof window.XLSX === 'undefined') {
        await new Promise(function(resolve, reject) {
          var s = document.createElement('script');
          s.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
          s.onload = resolve;
          s.onerror = function(){ reject(new Error('No se pudo cargar XLSX')); };
          document.head.appendChild(s);
        });
      }
      var XLSX = window.XLSX;
      var wsData = [
        ['N° Orden','Fecha','Sede','Proveedor','Responsable'],
        [pedido.nOrden, pedido.fecha, pedido.sede, pedido.proveedor, pedido.responsable],
        [],
        ['Código','Artículo','Subfamilia','Cantidad','Unidad'],
      ].concat(pedido.articulos.map(function(a){
        return [a.codigo, a.articulo, a.subfamilia, a.cantidad, a.unidad];
      }));
      var ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{wch:14},{wch:38},{wch:22},{wch:12},{wch:14}];
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Pedido OC-' + pedido.nOrden);
      XLSX.writeFile(wb, 'Pedido_OC-' + pedido.nOrden + '.xlsx');
    } catch(e) {
      alert('Error exportando Excel: ' + e.message);
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4" style={{background:'#1a3c6e'}}>
        <Search className="w-5 h-5 text-blue-300"/>
        <div>
          <div className="text-white font-bold text-sm">Buscador de Pedidos</div>
          <div className="text-blue-300 text-xs">Consulta cualquier orden de compra registrada</div>
        </div>
      </div>
      <div className="p-5 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"/>
            <input type="text" value={busquedaId}
              onChange={function(e){ setBusquedaId(e.target.value); }}
              onKeyDown={function(e){ if(e.key==='Enter') buscarPedido(); }}
              placeholder="Ingresa el ID del pedido (ej: 1779218515)"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"/>
          </div>
          <button onClick={buscarPedido} disabled={buscando}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
            style={{background:'#1a3c6e',border:'none',cursor:'pointer',minWidth:'110px',justifyContent:'center'}}>
            <Search className="w-4 h-4"/>
            {buscando ? 'Buscando...' : 'Buscar'}
          </button>
        </div>

        {errorBusq && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0"/>{errorBusq}
          </div>
        )}

        {pedido && (
          <div className="space-y-3">
            <div className="rounded-xl p-4 space-y-3" style={{background:'#eef2fa',border:'1px solid #c8d5ed'}}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider" style={{color:'#7b8db0'}}>Orden encontrada</div>
                  <div className="text-2xl font-black" style={{color:'#1a3c6e'}}>OC-{pedido.nOrden}</div>
                </div>
                <button onClick={exportarExcel} disabled={exportando}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                  style={{background:'#1a7c3c',border:'none',cursor:'pointer'}}>
                  <FileSpreadsheet className="w-4 h-4"/>
                  {exportando ? 'Exportando...' : 'Descargar Excel'}
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[{lbl:'Fecha',val:pedido.fecha},{lbl:'Sede',val:pedido.sede},{lbl:'Proveedor',val:pedido.proveedor},{lbl:'Responsable',val:pedido.responsable}].map(function(item){
                  return (
                    <div key={item.lbl}>
                      <div className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{color:'#7b8db0'}}>{item.lbl}</div>
                      <div className="text-sm font-bold" style={{color:'#1a3c6e'}}>{item.val}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="text-xs font-bold uppercase tracking-wider" style={{color:'#1a3c6e'}}>
              {pedido.articulos.length} Artículo(s) en este pedido
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{background:'#1a3c6e'}}>
                    <th className="py-2.5 px-3 text-left text-white text-xs font-bold uppercase tracking-wider w-24">Código</th>
                    <th className="py-2.5 px-3 text-left text-white text-xs font-bold uppercase tracking-wider">Artículo</th>
                    <th className="py-2.5 px-3 text-left text-white text-xs font-bold uppercase tracking-wider hidden md:table-cell">Subfamilia</th>
                    <th className="py-2.5 px-3 text-center text-white text-xs font-bold uppercase tracking-wider w-20">Cantidad</th>
                    <th className="py-2.5 px-3 text-center text-white text-xs font-bold uppercase tracking-wider w-20">Unidad</th>
                  </tr>
                </thead>
                <tbody>
                  {pedido.articulos.map(function(a, idx){
                    return (
                      <tr key={idx} className={'border-b border-slate-100 ' + (idx%2===0?'bg-white':'bg-slate-50')}>
                        <td className="py-2 px-3 font-mono text-xs text-slate-500">{a.codigo}</td>
                        <td className="py-2 px-3 font-medium text-slate-800">{a.articulo}</td>
                        <td className="py-2 px-3 text-slate-500 text-xs hidden md:table-cell">{a.subfamilia}</td>
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

        {!pedido && !errorBusq && !buscando && (
          <div className="text-center py-6 text-slate-400">
            <Search className="w-8 h-8 mx-auto mb-2 text-slate-300"/>
            <div className="text-sm">Ingresa un ID de pedido para consultar su información</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SheetsOrderForm principal ───────────────────────────────────────────────
export default function SheetsOrderForm() {
  var [proveedoresNombres, setProveedoresNombres] = useState([]);  // lista de nombres únicos
  var [proveedoresMeta, setProveedoresMeta] = useState([]);        // metadata (tel, correo)
  var [sedes, setSedes] = useState([]);
  var [productos, setProductos] = useState([]);       // artículos del proveedor seleccionado
  var [subfamilias, setSubfamilias] = useState([]);   // subfamilias del proveedor

  var [loading, setLoading] = useState(true);
  var [loadingProductos, setLoadingProductos] = useState(false);
  var [error, setError] = useState(null);
  var [success, setSuccess] = useState(false);
  var [saving, setSaving] = useState(false);
  var [searchTerm, setSearchTerm] = useState('');
  var [selectedSubfamilia, setSelectedSubfamilia] = useState('');

  var [selectedSede, setSelectedSede] = useState('');
  var [selectedProveedor, setSelectedProveedor] = useState('');  // nombre del proveedor
  var [responsable, setResponsable] = useState(function(){ return localStorage.getItem('pedido_responsable') || ''; });
  var [correoResponsable, setCorreoResponsable] = useState(function(){ return localStorage.getItem('pedido_correo') || ''; });
  var [notas, setNotas] = useState('');
  var [cantidades, setCantidades] = useState({});

  // ── Carga inicial ──────────────────────────────────────────────────────────
  useEffect(function() {
    var cancelled = false;
    async function load() {
      try {
        setLoading(true);
        var [nombres, meta, sds] = await Promise.all([
          getProveedorSheetNames(),
          getProveedores(),
          getSedes(),
        ]);
        if (cancelled) return;
        setProveedoresNombres(nombres);
        setProveedoresMeta(meta);
        setSedes(sds);
        setError(null);
      } catch(e) {
        if (!cancelled) setError('No se pudo conectar con Google Sheets. ' + e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return function(){ cancelled = true; };
  }, []);

  // ── Carga artículos + subfamilias al cambiar proveedor ─────────────────────
  useEffect(function() {
    if (!selectedProveedor) { setProductos([]); setSubfamilias([]); setCantidades({}); setSelectedSubfamilia(''); return; }
    var cancelled = false;
    setLoadingProductos(true);
    Promise.all([
      getProductosByProveedor(selectedProveedor),
      getSubfamiliasByProveedor(selectedProveedor),
    ]).then(function(results) {
      if (cancelled) return;
      var prods = results[0];
      var subs = results[1];
      setProductos(prods);
      setSubfamilias(subs);
      setCantidades({});
      setSearchTerm('');
      setSelectedSubfamilia('');
    }).catch(function(e){
      if (!cancelled) setError('Error al cargar artículos: ' + e.message);
    }).finally(function(){
      if (!cancelled) setLoadingProductos(false);
    });
    return function(){ cancelled = true; };
  }, [selectedProveedor]);

  var handleCantidad = function(codigo, val) {
    setCantidades(function(prev){ return Object.assign({}, prev, { [codigo]: Math.max(0, val) }); });
  };

  // Productos filtrados por búsqueda + subfamilia
  var productosFiltrados = productos.filter(function(p) {
    var matchSearch = !searchTerm ||
      (p.articulo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.codigo || '').toLowerCase().includes(searchTerm.toLowerCase());
    var matchSub = !selectedSubfamilia || p.subfamilia === selectedSubfamilia;
    return matchSearch && matchSub;
  });

  var lineasSeleccionadas = productos
    .filter(function(p){ return (cantidades[p.codigo] || 0) > 0; })
    .map(function(p){
      return {
        codigo: p.codigo,
        articulo: p.articulo,      // nombre real del artículo
        subfamilia: p.subfamilia,
        unidad: p.unidad || '',
        cantidad: cantidades[p.codigo],
      };
    });

  var sedeSeleccionada = sedes.find(function(s){ return s.nombre === selectedSede; }) || null;
  var proveedorMeta = proveedoresMeta.find(function(p){ return p.nombre === selectedProveedor; }) || null;

  var handleGuardar = async function() {
    if (!responsable.trim()) { alert('Debes ingresar el nombre del responsable.'); return; }
    if (!selectedSede) { alert('Selecciona una sede.'); return; }
    if (!selectedProveedor) { alert('Selecciona un proveedor.'); return; }
    if (lineasSeleccionadas.length === 0) { alert('Agrega al menos un artículo con cantidad mayor a 0.'); return; }

    setSaving(true); setError(null); setSuccess(false);
    var lineasSnap = lineasSeleccionadas.slice();
    var notasSnap = notas;
    var sedeSnap = sedeSeleccionada;
    var provMetaSnap = proveedorMeta;

    try {
      localStorage.setItem('pedido_responsable', responsable);
      localStorage.setItem('pedido_correo', correoResponsable);

      var numeroOrden = Math.floor(Date.now() / 1000);
      try { var n2 = await dbService.getNextGlobalConsecutive(); if (n2) numeroOrden = n2; }
      catch(eN){ console.warn('[Firebase] fallback timestamp:', eN); }

      var fechaHoy = new Date().toISOString().split('T')[0];
      for (var linea of lineasSnap) {
        try {
          await appendPedido({
            fecha: fechaHoy,
            sede: selectedSede || '',
            proveedor: selectedProveedor || '',
            codigo: linea.codigo || '',
            articulo: linea.articulo || '',        // nombre real del artículo
            subArticulo: linea.subfamilia || '',   // subfamilia
            cantidad: linea.cantidad || 0,
            unidad: linea.unidad || '',
            responsable: responsable || '',
            correoResponsable: correoResponsable || '',
            notas: notasSnap || '',
            numeroOrden: String(numeroOrden),
          });
        } catch(errLinea){ console.error('[Sheets] Error línea:', errLinea); }
      }

      setSuccess(true);
      setCantidades({});
      setNotas('');
      setTimeout(function(){ setSuccess(false); }, 6000);

      setTimeout(function(){
        generarPDF({
          sede: sedeSnap,
          proveedor: provMetaSnap,
          proveedorNombre: selectedProveedor,
          lineas: lineasSnap,
          notas: notasSnap,
          responsable,
          correoResponsable,
          numeroOrden,
        });
      }, 500);

    } catch(e) {
      console.error('[handleGuardar]', e);
      setError('Error al guardar pedido: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  var handleDescargarPDF = async function() {
    if (!selectedProveedor) { alert('Selecciona un proveedor primero.'); return; }
    if (lineasSeleccionadas.length === 0) { alert('Agrega al menos un artículo con cantidad mayor a 0.'); return; }
    var n = Math.floor(Date.now() / 1000);
    try { var n2 = await dbService.getNextGlobalConsecutive(); if (n2) n = n2; } catch(e){ console.warn(e); }
    generarPDF({
      sede: sedeSeleccionada,
      proveedor: proveedorMeta,
      proveedorNombre: selectedProveedor,
      lineas: lineasSeleccionadas,
      notas,
      responsable: responsable || 'Sin especificar',
      correoResponsable,
      numeroOrden: n,
    });
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-64 gap-3 text-slate-500">
      <RefreshCw className="w-5 h-5 animate-spin"/>
      <span className="text-sm font-medium">Cargando datos desde Google Drive...</span>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-5">

      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5"/>
          <div>
            <p className="font-semibold text-sm">Error de conexión</p>
            <p className="text-xs mt-0.5">{error}</p>
            <button onClick={function(){ setError(null); }} className="text-xs underline mt-1">Cerrar</button>
          </div>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-700">
          <CheckCircle className="w-5 h-5 flex-shrink-0"/>
          <div>
            <p className="font-semibold text-sm">¡Pedido guardado exitosamente!</p>
            <p className="text-xs mt-0.5">El PDF se está descargando. Puedes continuar creando otro pedido.</p>
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
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500 transition-all">
              <option value="">Seleccionar sede...</option>
              {sedes.map(function(s){ return <option key={s.nombre} value={s.nombre}>{s.nombre}</option>; })}
            </select>
            {sedeSeleccionada && (sedeSeleccionada.direccion || sedeSeleccionada.horaEntrega) && (
              <div className="mt-1.5 text-xs text-slate-500 space-y-0.5 pl-1">
                {sedeSeleccionada.direccion && <p>{sedeSeleccionada.direccion}</p>}
                {sedeSeleccionada.horaEntrega && <p className="text-cyan-600 font-medium">Horario: {sedeSeleccionada.horaEntrega}</p>}
              </div>
            )}
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Responsable *</label>
            <input type="text" value={responsable} onChange={function(e){ setResponsable(e.target.value); }}
              placeholder="Tu nombre completo"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500 transition-all"/>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Correo</label>
            <input type="email" value={correoResponsable} onChange={function(e){ setCorreoResponsable(e.target.value); }}
              placeholder="correo@empresa.com"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500 transition-all"/>
          </div>
        </div>
      </div>

      {/* Paso 2: Proveedor */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Truck className="w-4 h-4 text-cyan-500"/> 2. Seleccionar Proveedor ({proveedoresNombres.length} disponibles)
        </h2>
        <select value={selectedProveedor} onChange={function(e){ setSelectedProveedor(e.target.value); }}
          className="w-full md:w-96 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500 transition-all">
          <option value="">Seleccionar proveedor...</option>
          {proveedoresNombres.map(function(nombre){
            return <option key={nombre} value={nombre}>{nombre}</option>;
          })}
        </select>
        {proveedorMeta && (
          <div className="mt-3 flex flex-wrap gap-2">
            {proveedorMeta.telefono && (
              <div className="bg-slate-50 rounded-lg px-3 py-2 text-xs border border-slate-100">
                <p className="text-slate-400 font-bold uppercase text-[9px] mb-0.5">Teléfono</p>
                <p className="text-slate-700 font-medium">{proveedorMeta.telefono}</p>
              </div>
            )}
            {proveedorMeta.correo && (
              <div className="bg-slate-50 rounded-lg px-3 py-2 text-xs border border-slate-100">
                <p className="text-slate-400 font-bold uppercase text-[9px] mb-0.5">Correo</p>
                <p className="text-slate-700 font-medium truncate max-w-48">{proveedorMeta.correo}</p>
              </div>
            )}
            {proveedorMeta.asesor && (
              <div className="bg-slate-50 rounded-lg px-3 py-2 text-xs border border-slate-100">
                <p className="text-slate-400 font-bold uppercase text-[9px] mb-0.5">Asesor</p>
                <p className="text-slate-700 font-medium">{proveedorMeta.asesor}</p>
              </div>
            )}
          </div>
        )}
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

          {/* Filtros: búsqueda + subfamilia */}
          <div className="flex gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"/>
              <input type="text" value={searchTerm}
                onChange={function(e){ setSearchTerm(e.target.value); }}
                placeholder="Buscar artículo por nombre o código..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500 transition-all"/>
            </div>
            {subfamilias.length > 0 && (
              <div className="relative min-w-48">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"/>
                <select value={selectedSubfamilia}
                  onChange={function(e){ setSelectedSubfamilia(e.target.value); }}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500 transition-all appearance-none">
                  <option value="">Todas las subfamilias</option>
                  {subfamilias.map(function(s){
                    return <option key={s} value={s}>{s}</option>;
                  })}
                </select>
              </div>
            )}
          </div>

          {loadingProductos ? (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
              <RefreshCw className="w-4 h-4 animate-spin"/>
              <span className="text-sm">Cargando artículos...</span>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="py-3 px-4 text-left text-[10px] uppercase tracking-wider font-bold w-24">Código</th>
                    <th className="py-3 px-4 text-left text-[10px] uppercase tracking-wider font-bold">Artículo</th>
                    <th className="py-3 px-4 text-left text-[10px] uppercase tracking-wider font-bold hidden md:table-cell w-32">Unidad</th>
                    <th className="py-3 px-4 text-center text-[10px] uppercase tracking-wider font-bold w-36">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {productosFiltrados.map(function(p, idx){
                    var qty = cantidades[p.codigo] || 0;
                    return (
                      <tr key={p.codigo || idx}
                        className={'border-b border-slate-100 transition-colors ' + (qty>0?'bg-emerald-50':idx%2===0?'bg-white':'bg-slate-50/50')}>
                        <td className="py-3 px-4 font-mono text-xs text-slate-500">{p.codigo}</td>
                        <td className="py-3 px-4 font-medium text-slate-800">{p.articulo}</td>
                        <td className="py-3 px-4 text-slate-500 hidden md:table-cell text-xs">{p.unidad || '—'}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 justify-center">
                            <button onClick={function(){ handleCantidad(p.codigo, qty-1); }}
                              className="w-7 h-7 rounded-lg bg-slate-200 hover:bg-slate-300 font-bold transition-colors flex items-center justify-center text-slate-600 text-base">-</button>
                            <input type="number" min={0} value={qty||''}
                              onChange={function(e){ handleCantidad(p.codigo, parseInt(e.target.value)||0); }}
                              placeholder="0"
                              className="w-14 text-center py-1.5 border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:border-cyan-500 transition-all"/>
                            <button onClick={function(){ handleCantidad(p.codigo, qty+1); }}
                              className="w-7 h-7 rounded-lg bg-cyan-500 hover:bg-cyan-600 font-bold text-white transition-colors flex items-center justify-center text-base">+</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {productosFiltrados.length === 0 && (
                    <tr><td colSpan={4} className="py-12 text-center text-slate-400 text-sm">
                      No se encontraron artículos{searchTerm?' para "'+searchTerm+'"':selectedSubfamilia?' en la subfamilia "'+selectedSubfamilia+'"':''}.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {lineasSeleccionadas.length > 0 && (
            <div className="mt-4 flex justify-end">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 min-w-52">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Resumen del Pedido</p>
                <div className="space-y-1 mb-3">
                  {lineasSeleccionadas.map(function(l){
                    return (
                      <div key={l.codigo} className="flex justify-between text-xs text-slate-700">
                        <span className="truncate max-w-36">{l.articulo}</span>
                        <span className="font-bold ml-2 text-cyan-700">× {l.cantidad}</span>
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

      {/* Paso 4: Observaciones */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-cyan-500"/> 4. Observaciones y Registro
        </h2>
        <textarea value={notas} onChange={function(e){ setNotas(e.target.value); }}
          placeholder="Instrucciones especiales, horario de entrega, observaciones..."
          rows={3}
          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500 transition-all resize-none mb-4"/>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleGuardar}
            disabled={saving || lineasSeleccionadas.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
            {saving ? 'Guardando...' : 'Guardar y Descargar PDF'}
          </button>
          <button onClick={handleDescargarPDF}
            disabled={lineasSeleccionadas.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
            <Download className="w-4 h-4"/> Solo Descargar PDF
          </button>
          <button onClick={function(){ invalidarCache(); alert('Caché borrado. Recarga la página para traer datos frescos del Drive.'); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-medium transition-all">
            <RefreshCw className="w-4 h-4"/> Actualizar desde Drive
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
