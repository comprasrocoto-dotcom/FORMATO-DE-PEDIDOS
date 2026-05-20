// @ts-nocheck
/**
 * SheetsOrderForm.tsx
 * Formulario de pedido conectado a Google Sheets.
 * v3 - PDF elegante + Buscador + Sin blank page + Caching + UI mejorada
 */

import { useState, useEffect, useRef } from 'react';
import { ShoppingCart, Building2, User, Truck, RefreshCw, Save, Download, AlertCircle, CheckCircle, Search, X, FileSpreadsheet } from 'lucide-react';
import {
  getProveedores,
  getSedes,
  getProductosByProveedor,
  getProveedorSheetNames,
  appendPedido,
  ProveedorSheet,
  ProductoSheet,
  SedeSheet,
} from '../services/googleSheets';
import { dbService } from '../services/db';
// @ts-ignore
import html2pdf from 'html2pdf.js';

const APPS_SCRIPT_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzlfjOyyYCGj5AaSTScISTq3rEL3b8AB9en2LYKsbhmZ8P3goP9J15NC7QVt1ePgIAWCA/exec';

// ─── Types ────────────────────────────────────
interface LineItem {
  codigo: string;
  articulo: string;
  subArticulo: string;
  cantidad: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF Generator v3 - Diseño elegante, limpio, alineado
// Sin sección de cliente/comprador, sin firmas, solo proveedor + observaciones
// ─────────────────────────────────────────────────────────────────────────────
function generarPDF(params: {
  sede: SedeSheet | null;
  proveedor: ProveedorSheet | null;
  proveedorSheetName: string;
  lineas: LineItem[];
  notas: string;
  responsable: string;
  correoResponsable: string;
  numeroOrden: number;
}) {
  const { sede, proveedor, proveedorSheetName, lineas, notas, responsable, correoResponsable, numeroOrden } = params;
  const fecha = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  const fechaHoy = new Date().toISOString().slice(0, 10);

  const activeLineas = lineas.filter(function(l) { return l.cantidad > 0; });

  var provName   = proveedor ? (proveedor.nombre || proveedorSheetName) : proveedorSheetName;
  var provTel    = proveedor ? (proveedor.telefono || '—') : '—';
  var sedeName   = sede ? (sede.nombre || '—') : '—';
  var sedeDir    = sede ? (sede.direccion || '—') : '—';
  var sedeHora   = sede ? (sede.horaEntrega || '—') : '—';

  // Product rows - striped, more spaced
  var itemRowsArr = activeLineas.map(function(l, idx) {
    var bg = idx % 2 === 0 ? '#ffffff' : '#f4f7fc';
    return '<tr style="background:' + bg + ';">' +
      '<td style="border:1px solid #dde3ee;padding:10px 10px;text-align:center;font-size:11px;color:#888;">' + (idx + 1) + '</td>' +
      '<td style="border:1px solid #dde3ee;padding:10px 14px;font-size:11px;color:#1a1a2e;font-weight:600;">' + (l.articulo || '') + (l.subArticulo ? '<div style="color:#999;font-size:9.5px;margin-top:2px;">' + l.subArticulo + '</div>' : '') + '</td>' +
      '<td style="border:1px solid #dde3ee;padding:10px 10px;text-align:center;font-size:12px;font-weight:800;color:#1a3c6e;">' + (l.cantidad || 0) + '</td>' +
      '<td style="border:1px solid #dde3ee;padding:10px 10px;text-align:right;font-size:11px;color:#aaa;">—</td>' +
      '<td style="border:1px solid #dde3ee;padding:10px 10px;text-align:right;font-size:11px;color:#aaa;">—</td>' +
    '</tr>';
  });

  // Empty rows
  var emptyCount = Math.max(0, 10 - activeLineas.length);
  var emptyRowsArr = [];
  for (var ei = 0; ei < emptyCount; ei++) {
    var bg2 = (activeLineas.length + ei) % 2 === 0 ? '#ffffff' : '#f4f7fc';
    emptyRowsArr.push(
      '<tr style="background:' + bg2 + ';">' +
      '<td style="border:1px solid #dde3ee;padding:14px 10px;text-align:center;font-size:11px;color:#ddd;">' + (activeLineas.length + ei + 1) + '</td>' +
      '<td style="border:1px solid #dde3ee;padding:14px 10px;">&nbsp;</td>' +
      '<td style="border:1px solid #dde3ee;padding:14px 10px;"></td>' +
      '<td style="border:1px solid #dde3ee;padding:14px 10px;"></td>' +
      '<td style="border:1px solid #dde3ee;padding:14px 10px;"></td>' +
      '</tr>'
    );
  }

  var html = '<!DOCTYPE html><html><head><meta charset="utf-8"/><style>' +
    'body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#1a1a2e;margin:0;padding:0;background:#fff;}' +
    '.page{padding:30px 36px;}' +
    '.top-band{background:#1a3c6e;height:7px;margin:-30px -36px 26px -36px;}' +
    /* Header */
    '.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:18px;border-bottom:2px solid #e8ecf4;}' +
    '.logo-box{width:52px;height:52px;background:#1a3c6e;border-radius:10px;display:flex;align-items:center;justify-content:center;color:white;font-size:22px;font-weight:900;letter-spacing:-1px;float:left;margin-right:14px;}' +
    '.brand-name{font-size:22px;font-weight:900;color:#1a3c6e;letter-spacing:-0.5px;line-height:1.2;}' +
    '.brand-sub{font-size:9px;color:#9baac5;text-transform:uppercase;letter-spacing:1.5px;margin-top:3px;}' +
    '.oc-badge{background:#1a3c6e;color:white;border-radius:10px;padding:12px 20px;text-align:right;min-width:180px;}' +
    '.oc-title{font-size:8.5px;text-transform:uppercase;letter-spacing:2px;color:#a8c0e8;font-weight:700;}' +
    '.oc-num{font-size:22px;font-weight:900;letter-spacing:-0.5px;margin-top:2px;}' +
    '.oc-date{font-size:9px;color:#a8c0e8;margin-top:3px;}' +
    /* Info band */
    '.info-band{background:#f0f4fb;border:1px solid #ccd6ed;border-radius:8px;padding:10px 18px;display:flex;gap:36px;margin-bottom:18px;}' +
    '.info-item{display:flex;flex-direction:column;gap:2px;}' +
    '.info-lbl{font-size:8px;text-transform:uppercase;letter-spacing:1.2px;color:#8899bb;font-weight:700;}' +
    '.info-val{font-size:11px;font-weight:800;color:#1a3c6e;}' +
    /* Proveedor box */
    '.prov-box{border:1px solid #ccd6ed;border-radius:8px;overflow:hidden;margin-bottom:18px;max-width:420px;}' +
    '.prov-hdr{background:#1a3c6e;color:white;font-weight:700;font-size:9px;padding:7px 14px;text-transform:uppercase;letter-spacing:1.2px;}' +
    '.prov-body{padding:12px 14px;background:#fafbfd;}' +
    '.prov-name{font-weight:800;font-size:13px;color:#1a3c6e;margin-bottom:4px;}' +
    '.prov-tel{font-size:10.5px;color:#555;}' +
    /* Products */
    '.prod-hdr{background:#1a3c6e;color:white;padding:9px 14px;font-weight:700;font-size:9px;text-transform:uppercase;letter-spacing:1.2px;border-radius:6px 6px 0 0;}' +
    'table.pt{width:100%;border-collapse:collapse;border:1px solid #dde3ee;}' +
    'table.pt th{background:#e6ebf5;color:#1a3c6e;border:1px solid #dde3ee;padding:9px 10px;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;}' +
    /* Totals - aligned right */
    '.totals-wrap{display:flex;justify-content:flex-end;margin-top:12px;}' +
    'table.tt{border-collapse:collapse;width:230px;border:1px solid #dde3ee;border-radius:6px;overflow:hidden;}' +
    'table.tt td{border:1px solid #dde3ee;padding:7px 14px;font-size:11px;}' +
    '.ttlbl{text-align:right;font-weight:700;background:#f0f4fb;color:#555;text-transform:uppercase;font-size:9px;letter-spacing:.5px;}' +
    '.tval{text-align:right;color:#1a1a2e;font-weight:600;}' +
    '.grand td{background:#1a3c6e!important;color:white!important;font-weight:900;font-size:12px;}' +
    /* Observaciones - only section at bottom */
    '.obs-box{border:1px solid #dde3ee;margin-top:18px;border-radius:6px;overflow:hidden;}' +
    '.obs-hdr{background:#f0f4fb;color:#1a3c6e;padding:7px 14px;font-weight:800;font-size:9px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #dde3ee;}' +
    '.obs-body{padding:14px;min-height:50px;font-size:11px;line-height:1.7;color:#444;}' +
    /* Footer */
    '.footer{margin-top:18px;padding-top:10px;border-top:1px solid #e8ecf4;display:flex;justify-content:space-between;align-items:center;}' +
    '.footer-l{font-size:8.5px;color:#bbb;}' +
    '.footer-r{font-size:8.5px;color:#bbb;text-align:right;}' +
    '</style></head><body><div class="page">' +

    '<div class="top-band"></div>' +

    /* Header */
    '<div class="hdr">' +
      '<div style="display:flex;align-items:center;">' +
        '<div class="logo-box">R</div>' +
        '<div>' +
          '<div class="brand-name">Rocoto Restaurantes</div>' +
          '<div class="brand-sub">Sistema de Compras</div>' +
        '</div>' +
      '</div>' +
      '<div class="oc-badge">' +
        '<div class="oc-title">Orden de Compra</div>' +
        '<div class="oc-num">OC-' + numeroOrden + '</div>' +
        '<div class="oc-date">' + fecha + '</div>' +
      '</div>' +
    '</div>' +

    /* Info band: N° Orden, Sede, Dirección, Horario */
    '<div class="info-band">' +
      '<div class="info-item"><span class="info-lbl">N&deg; Orden</span><span class="info-val">OC-' + numeroOrden + '</span></div>' +
      '<div class="info-item"><span class="info-lbl">Sede</span><span class="info-val">' + sedeName + '</span></div>' +
      '<div class="info-item"><span class="info-lbl">Direcci&oacute;n</span><span class="info-val">' + sedeDir + '</span></div>' +
      '<div class="info-item"><span class="info-lbl">Horario de entrega</span><span class="info-val">' + sedeHora + '</span></div>' +
    '</div>' +

    /* Proveedor box - only name and phone */
    '<div class="prov-box">' +
      '<div class="prov-hdr">&#128666; Proveedor</div>' +
      '<div class="prov-body">' +
        '<div class="prov-name">' + provName + '</div>' +
        '<div class="prov-tel">Tel: ' + provTel + '</div>' +
      '</div>' +
    '</div>' +

    /* Products */
    '<div class="prod-hdr">&#128230; Art&iacute;culos Solicitados</div>' +
    '<table class="pt"><thead><tr>' +
      '<th style="width:5%;text-align:center;">N.</th>' +
      '<th style="width:55%;text-align:left;">Descripci&oacute;n</th>' +
      '<th style="width:12%;text-align:center;">Cantidad</th>' +
      '<th style="width:14%;text-align:right;">Precio Unit.</th>' +
      '<th style="width:14%;text-align:right;">Total</th>' +
    '</tr></thead><tbody>' +
    itemRowsArr.join('') +
    emptyRowsArr.join('') +
    '</tbody></table>' +

    /* Totals - right aligned */
    '<div class="totals-wrap"><table class="tt">' +
      '<tr><td class="ttlbl">Subtotal</td><td class="tval">A convenir</td></tr>' +
      '<tr><td class="ttlbl">Total factura</td><td class="tval">Seg&uacute;n factura</td></tr>' +
    '</table></div>' +

    /* Observaciones - única sección inferior */
    '<div class="obs-box">' +
      '<div class="obs-hdr">&#128221; Observaciones</div>' +
      '<div class="obs-body">' + (notas || '&nbsp;') + '</div>' +
    '</div>' +

    /* Footer */
    '<div class="footer">' +
      '<div class="footer-l">Rocoto Restaurantes &bull; comprasrocoto@gmail.com</div>' +
      '<div class="footer-r">OC-' + numeroOrden + ' &bull; P&aacute;g. 1</div>' +
    '</div>' +

    '</div></body></html>';

  var provSlug = provName.replace(/[^A-Za-z0-9]/g, '_').substring(0, 20);
  var opt = {
    margin: [8, 8, 8, 8],
    filename: 'OC-' + numeroOrden + '_' + provSlug + '_' + fechaHoy + '.pdf',
    image: { type: 'jpeg', quality: 0.97 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      onclone: function(clonedDoc) {
        var styles = clonedDoc.getElementsByTagName('style');
        for (var s = 0; s < styles.length; s++) {
          if (styles[s].innerHTML.indexOf('oklch') !== -1) {
            styles[s].innerHTML = styles[s].innerHTML.replace(/oklch\([^)]+\)/g, '#ccc');
          }
        }
      }
    },
    jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
  };

  // Generate in a hidden off-screen element to avoid blank page crash
  var container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:816px;z-index:-1;pointer-events:none;';
  container.innerHTML = html;
  document.body.appendChild(container);
  html2pdf().set(opt).from(container).save().finally(function() {
    document.body.removeChild(container);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// BuscadorPedidos - Panel de búsqueda integrado
// ─────────────────────────────────────────────────────────────────────────────
interface ArticuloBuscado {
  articulo: string;
  subArticulo: string;
  cantidad: string;
  codigo: string;
  unidad: string;
}
interface PedidoEncontrado {
  nOrden: string;
  fecha: string;
  sede: string;
  proveedor: string;
  responsable: string;
  articulos: ArticuloBuscado[];
}

function BuscadorPedidos() {
  const [busquedaId, setBusquedaId] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [pedido, setPedido] = useState(null);
  const [errorBusq, setErrorBusq] = useState(null);
  const [exportando, setExportando] = useState(false);

  const buscarPedido = async () => {
    if (!busquedaId.trim()) { alert('Ingresa el ID del pedido.'); return; }
    setBuscando(true);
    setErrorBusq(null);
    setPedido(null);
    try {
      const url = APPS_SCRIPT_ENDPOINT + '?action=getPedidoByOrden&nOrden=' + encodeURIComponent(busquedaId.trim());
      const res = await fetch(url, { redirect: 'follow' });
      const data = await res.json();
      if (!data.ok) { setErrorBusq(data.error || 'Pedido no encontrado.'); return; }
      var p = data.pedido;
      if (p && p.lineas) {
        if (p.lineas.length === 0) { setErrorBusq('Pedido encontrado pero sin articulos.'); return; }
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
              articulo: String(l.insumo || l.articulo || ''),
              subArticulo: String(l.subArticulo || ''),
              cantidad: String(l.cantidad || ''),
              unidad: String(l.unidad || ''),
            };
          }),
        });
      } else {
        var rows2 = data.rows || [];
        if (rows2.length === 0) { setErrorBusq('No se encontraron registros para ese ID.'); return; }
        var first2 = rows2[0];
        setPedido({
          nOrden: String(first2[0] || busquedaId),
          fecha: String(first2[1] || '—'),
          sede: String(first2[2] || '—'),
          proveedor: String(first2[3] || '—'),
          responsable: String(first2[9] || '—'),
          articulos: rows2.map(function(r2) {
            return {
              codigo: String(r2[4] || ''),
              articulo: String(r2[5] || ''),
              subArticulo: String(r2[6] || ''),
              cantidad: String(r2[7] || ''),
              unidad: String(r2[8] || ''),
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

  const exportarExcel = async () => {
    if (!pedido) return;
    setExportando(true);
    try {
      if (typeof window.XLSX === 'undefined') {
        await new Promise(function(resolve, reject) {
          var s = document.createElement('script');
          s.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
          s.onload = resolve;
          s.onerror = function() { reject(new Error('No se pudo cargar XLSX')); };
          document.head.appendChild(s);
        });
      }
      var XLSX = window.XLSX;
      var wsData = [
        ['N° Orden', 'Fecha', 'Sede', 'Proveedor', 'Responsable'],
        [pedido.nOrden, pedido.fecha, pedido.sede, pedido.proveedor, pedido.responsable],
        [],
        ['Código', 'Artículo', 'Sub-Artículo', 'Cantidad', 'Unidad'],
      ].concat(pedido.articulos.map(function(a) {
        return [a.codigo, a.articulo, a.subArticulo, a.cantidad, a.unidad];
      }));
      var ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{ wch: 14 }, { wch: 35 }, { wch: 28 }, { wch: 12 }, { wch: 12 }];
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
        <Search className="w-5 h-5 text-blue-300" />
        <div>
          <div className="text-white font-bold text-sm">Buscador de Pedidos</div>
          <div className="text-blue-300 text-xs">Consulta cualquier orden de compra registrada</div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={busquedaId}
              onChange={function(e) { setBusquedaId(e.target.value); }}
              onKeyDown={function(e) { if (e.key === 'Enter') buscarPedido(); }}
              placeholder="Ingresa el ID del pedido (ej: 1779218515)"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
          <button
            onClick={buscarPedido}
            disabled={buscando}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
            style={{background:'#1a3c6e', border:'none', cursor:'pointer', minWidth:'110px', justifyContent:'center'}}
          >
            <Search className="w-4 h-4" />
            {buscando ? 'Buscando...' : 'Buscar'}
          </button>
        </div>

        {errorBusq && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {errorBusq}
          </div>
        )}

        {pedido && (
          <div className="space-y-3">
            <div className="rounded-xl p-4 space-y-3" style={{background:'#eef2fa', border:'1px solid #c8d5ed'}}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider" style={{color:'#7b8db0'}}>Orden encontrada</div>
                  <div className="text-2xl font-black" style={{color:'#1a3c6e'}}>OC-{pedido.nOrden}</div>
                </div>
                <button
                  onClick={exportarExcel}
                  disabled={exportando}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                  style={{background:'#1a7c3c', border:'none', cursor:'pointer'}}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  {exportando ? 'Exportando...' : 'Descargar Excel'}
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  {lbl:'Fecha', val: pedido.fecha},
                  {lbl:'Sede', val: pedido.sede},
                  {lbl:'Proveedor', val: pedido.proveedor},
                  {lbl:'Responsable', val: pedido.responsable},
                ].map(function(item) {
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
                    <th className="py-2.5 px-3 text-left text-white text-xs font-bold uppercase tracking-wider w-28">Código</th>
                    <th className="py-2.5 px-3 text-left text-white text-xs font-bold uppercase tracking-wider">Artículo</th>
                    <th className="py-2.5 px-3 text-left text-white text-xs font-bold uppercase tracking-wider hidden md:table-cell">Sub-Artículo</th>
                    <th className="py-2.5 px-3 text-center text-white text-xs font-bold uppercase tracking-wider w-24">Cantidad</th>
                    <th className="py-2.5 px-3 text-center text-white text-xs font-bold uppercase tracking-wider w-24">Unidad</th>
                  </tr>
                </thead>
                <tbody>
                  {pedido.articulos.map(function(a, idx) {
                    return (
                      <tr key={idx} className={'border-b border-slate-100 ' + (idx % 2 === 0 ? 'bg-white' : 'bg-slate-50')}>
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

        {!pedido && !errorBusq && !buscando && (
          <div className="text-center py-6 text-slate-400">
            <Search className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <div className="text-sm">Ingresa un ID de pedido para consultar su información</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SheetsOrderForm - Componente principal
// ─────────────────────────────────────────────────────────────────────────────
export default function SheetsOrderForm() {
  const [proveedores, setProveedores] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [sheetNames, setSheetNames] = useState([]);
  const [productos, setProductos] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingProductos, setLoadingProductos] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedSede, setSelectedSede] = useState('');
  const [selectedProveedorSheet, setSelectedProveedorSheet] = useState('');
  const [responsable, setResponsable] = useState(() => localStorage.getItem('pedido_responsable') || '');
  const [correoResponsable, setCorreoResponsable] = useState(() => localStorage.getItem('pedido_correo') || '');
  const [notas, setNotas] = useState('');
  const [cantidades, setCantidades] = useState({});

  // ── Carga inicial con caché en módulo (fetchAllDatos ya cachea 5 min) ──
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const [provs, sds, names] = await Promise.all([
          getProveedores(),
          getSedes(),
          getProveedorSheetNames(),
        ]);
        if (cancelled) return;
        setProveedores(provs);
        setSedes(sds);
        setSheetNames(names);
        setError(null);
      } catch (e) {
        if (!cancelled) setError('No se pudo conectar con Google Sheets. ' + e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // ── Carga productos del proveedor seleccionado ──
  useEffect(() => {
    if (!selectedProveedorSheet) { setProductos([]); setCantidades({}); return; }
    let cancelled = false;
    setLoadingProductos(true);
    getProductosByProveedor(selectedProveedorSheet)
      .then(prods => {
        if (cancelled) return;
        // Filtrar filas que no son artículos reales (cabeceras, totales, proveedor)
        var filtered = prods.filter(function(p) {
          var art = (p.articulo || '').toLowerCase().trim();
          var cod = (p.codigo || '').toLowerCase().trim();
          if (!art && !cod) return false;
          // Eliminar fila "Proveedor" (cabecera de hoja de Sheets)
          if (cod === 'proveedor') return false;
          // Eliminar fila "Cód. Barras" / "Cod. Barras" (segunda cabecera)
          if (cod.indexOf('barras') !== -1 || cod.indexOf('cód') !== -1 || cod === 'codigo') return false;
          // Eliminar filas de Total (al final de la hoja)
          if (cod.indexOf('total') !== -1 || art.indexOf('total') !== -1) return false;
          // Eliminar si el artículo dice "Artículo" (encabezado de columna)
          if (art === 'articulo' || art === 'artículo') return false;
          return true;
        });
        setProductos(filtered);
        setCantidades({});
        setSearchTerm('');
      })
      .catch(e => setError('Error al cargar productos: ' + e.message))
      .finally(() => { if (!cancelled) setLoadingProductos(false); });
    return () => { cancelled = true; };
  }, [selectedProveedorSheet]);

  const handleCantidad = (codigo, val) => {
    setCantidades(prev => ({ ...prev, [codigo]: Math.max(0, val) }));
  };

  const lineasSeleccionadas = productos
    .filter(p => (cantidades[p.codigo] || 0) > 0)
    .map(p => ({ codigo: p.codigo, articulo: p.articulo, subArticulo: p.subArticulo, cantidad: cantidades[p.codigo] }));

  const productosFiltrados = productos.filter(p =>
    !searchTerm ||
    (p.articulo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.codigo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.subArticulo || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sedeSeleccionada = sedes.find(s => s.nombre === selectedSede) || null;
  const proveedorSeleccionado = proveedores.find(p => p.nombre === selectedProveedorSheet) || null;

  const handleGuardar = async () => {
    if (!responsable.trim()) { alert('Debes ingresar el nombre del responsable.'); return; }
    if (!selectedSede) { alert('Selecciona una sede.'); return; }
    if (!selectedProveedorSheet) { alert('Selecciona un proveedor.'); return; }
    if (lineasSeleccionadas.length === 0) { alert('Agrega al menos un producto con cantidad mayor a 0.'); return; }

    setSaving(true);
    setError(null);
    setSuccess(false);
    // Snapshot de datos antes de limpiar
    var lineasSnap = lineasSeleccionadas.slice();
    var notasSnap = notas;
    var sedeSeleccionadaSnap = sedeSeleccionada;
    var proveedorSeleccionadoSnap = proveedorSeleccionado;

    try {
      localStorage.setItem('pedido_responsable', responsable);
      localStorage.setItem('pedido_correo', correoResponsable);

      var numeroOrden = Math.floor(Date.now() / 1000);
      try {
        var n2 = await dbService.getNextGlobalConsecutive();
        if (n2) numeroOrden = n2;
      } catch(eN) {
        console.warn('[Firebase] getNextGlobalConsecutive failed, using timestamp:', eN);
      }

      const fechaHoy = new Date().toISOString().split('T')[0];
      for (const linea of lineasSnap) {
        try {
          await appendPedido({
            fecha: fechaHoy,
            sede: selectedSede || '',
            proveedor: selectedProveedorSheet || '',
            codigo: linea.codigo || '',
            articulo: linea.articulo || '',
            subArticulo: linea.subArticulo || '',
            cantidad: linea.cantidad || 0,
            unidad: '',
            responsable: responsable || '',
            correoResponsable: correoResponsable || '',
            notas: notasSnap || '',
            numeroOrden: String(numeroOrden),
          });
        } catch (errLinea) {
          console.error('[Sheets] Error guardando linea:', errLinea);
        }
      }

      try {
        await (dbService).savePedido?.({
          numeroOrden,
          fecha: new Date().toISOString(),
          sede: selectedSede,
          proveedor: selectedProveedorSheet,
          productos: lineasSnap,
          notas: notasSnap,
          responsable,
          correoResponsable,
        });
      } catch(eFb) {
        console.warn('[Firebase] savePedido failed (non-critical):', eFb);
      }

      // Mostrar éxito SIN recargar ni navegar - solo limpiar cantidades y notas
      setSuccess(true);
      setCantidades({});
      setNotas('');
      setTimeout(() => setSuccess(false), 6000);

      // Generar PDF después de actualizar estado (fuera del ciclo de render)
      const pdfParams = {
        sede: sedeSeleccionadaSnap,
        proveedor: proveedorSeleccionadoSnap,
        proveedorSheetName: selectedProveedorSheet,
        lineas: lineasSnap,
        notas: notasSnap,
        responsable,
        correoResponsable,
        numeroOrden,
      };
      setTimeout(() => { generarPDF(pdfParams); }, 500);

    } catch (e) {
      console.error('[handleGuardar] error:', e);
      setError('Error al guardar pedido: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDescargarPDF = async () => {
    if (!selectedProveedorSheet) { alert('Selecciona un proveedor primero.'); return; }
    if (lineasSeleccionadas.length === 0) { alert('Agrega al menos un producto con cantidad mayor a 0.'); return; }
    var n = Math.floor(Date.now() / 1000);
    try { var n2 = await dbService.getNextGlobalConsecutive(); if (n2) n = n2; } catch(e) { console.warn('Firebase error:', e); }
    generarPDF({
      sede: sedeSeleccionada,
      proveedor: proveedorSeleccionado,
      proveedorSheetName: selectedProveedorSheet,
      lineas: lineasSeleccionadas,
      notas,
      responsable: responsable || 'Sin especificar',
      correoResponsable,
      numeroOrden: n,
    });
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-64 gap-3 text-slate-500">
      <RefreshCw className="w-5 h-5 animate-spin" />
      <span className="text-sm font-medium">Cargando datos desde Google Sheets...</span>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-5">

      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Error de conexión</p>
            <p className="text-xs mt-0.5">{error}</p>
            <button onClick={() => setError(null)} className="text-xs underline mt-1">Cerrar</button>
          </div>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-700">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-sm">¡Pedido guardado exitosamente!</p>
            <p className="text-xs mt-0.5">El PDF se está descargando. Puedes continuar creando otro pedido.</p>
          </div>
        </div>
      )}

      {/* Step 1: Información del pedido */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-cyan-500" />
          1. Información del Pedido
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Sede *</label>
            <select
              value={selectedSede}
              onChange={e => setSelectedSede(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
            >
              <option value="">Seleccionar sede...</option>
              {sedes.map(s => <option key={s.nombre} value={s.nombre}>{s.nombre}</option>)}
            </select>
            {sedeSeleccionada && (sedeSeleccionada.direccion || sedeSeleccionada.horaEntrega) && (
              <div className="mt-2 text-xs text-slate-500 space-y-0.5 pl-1">
                {sedeSeleccionada.direccion && <p>{sedeSeleccionada.direccion}</p>}
                {sedeSeleccionada.horaEntrega && <p className="text-cyan-600 font-medium">Horario: {sedeSeleccionada.horaEntrega}</p>}
              </div>
            )}
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Responsable *</label>
            <input
              type="text"
              value={responsable}
              onChange={e => setResponsable(e.target.value)}
              placeholder="Tu nombre completo"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Correo</label>
            <input
              type="email"
              value={correoResponsable}
              onChange={e => setCorreoResponsable(e.target.value)}
              placeholder="correo@empresa.com"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Step 2: Proveedor */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Truck className="w-4 h-4 text-cyan-500" />
          2. Seleccionar Proveedor ({sheetNames.length} disponibles)
        </h2>
        <select
          value={selectedProveedorSheet}
          onChange={e => setSelectedProveedorSheet(e.target.value)}
          className="w-full md:w-80 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
        >
          <option value="">Seleccionar proveedor...</option>
          {sheetNames.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
        {proveedorSeleccionado && (
          <div className="mt-3 flex flex-wrap gap-3">
            {proveedorSeleccionado.telefono && (
              <div className="bg-slate-50 rounded-lg px-3 py-2 text-xs border border-slate-100">
                <p className="text-slate-400 font-bold uppercase text-[9px] mb-0.5">Teléfono</p>
                <p className="text-slate-700 font-medium">{proveedorSeleccionado.telefono}</p>
              </div>
            )}
            {proveedorSeleccionado.correo && (
              <div className="bg-slate-50 rounded-lg px-3 py-2 text-xs border border-slate-100">
                <p className="text-slate-400 font-bold uppercase text-[9px] mb-0.5">Correo</p>
                <p className="text-slate-700 font-medium truncate max-w-48">{proveedorSeleccionado.correo}</p>
              </div>
            )}
            {proveedorSeleccionado.asesor && (
              <div className="bg-slate-50 rounded-lg px-3 py-2 text-xs border border-slate-100">
                <p className="text-slate-400 font-bold uppercase text-[9px] mb-0.5">Asesor</p>
                <p className="text-slate-700 font-medium">{proveedorSeleccionado.asesor}</p>
              </div>
            )}
            {proveedorSeleccionado.medioPago && (
              <div className="bg-slate-50 rounded-lg px-3 py-2 text-xs border border-slate-100">
                <p className="text-slate-400 font-bold uppercase text-[9px] mb-0.5">Medio de Pago</p>
                <p className="text-slate-700 font-medium">{proveedorSeleccionado.medioPago}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 3: Productos - solo artículos, sin nombre proveedor ni total en la tabla */}
      {selectedProveedorSheet && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="w-4 h-4 text-cyan-500" />
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex-1">
              3. Productos
              {loadingProductos && <RefreshCw className="w-3 h-3 animate-spin text-slate-400 inline ml-2" />}
            </h2>
            {lineasSeleccionadas.length > 0 && (
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
                {lineasSeleccionadas.length} seleccionado(s)
              </span>
            )}
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar artículo por nombre o código..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
            />
          </div>

          {loadingProductos ? (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-sm">Cargando productos...</span>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="py-3 px-4 text-left text-[10px] uppercase tracking-wider font-bold w-24">Código</th>
                    <th className="py-3 px-4 text-left text-[10px] uppercase tracking-wider font-bold">Artículo</th>
                    <th className="py-3 px-4 text-left text-[10px] uppercase tracking-wider font-bold hidden md:table-cell">Sub-Artículo</th>
                    <th className="py-3 px-4 text-center text-[10px] uppercase tracking-wider font-bold w-36">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {productosFiltrados.map((p, idx) => {
                    const qty = cantidades[p.codigo] || 0;
                    return (
                      <tr
                        key={p.codigo || idx}
                        className={'border-b border-slate-100 transition-colors ' + (qty > 0 ? 'bg-emerald-50' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50')}
                      >
                        <td className="py-3 px-4 font-mono text-xs text-slate-500">{p.codigo}</td>
                        <td className="py-3 px-4 font-medium text-slate-800">{p.articulo}</td>
                        <td className="py-3 px-4 text-slate-500 hidden md:table-cell text-xs">{p.subArticulo}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 justify-center">
                            <button
                              onClick={() => handleCantidad(p.codigo, qty - 1)}
                              className="w-7 h-7 rounded-lg bg-slate-200 hover:bg-slate-300 font-bold transition-colors flex items-center justify-center text-slate-600 text-base"
                            >-</button>
                            <input
                              type="number"
                              min={0}
                              value={qty || ''}
                              onChange={e => handleCantidad(p.codigo, parseInt(e.target.value) || 0)}
                              placeholder="0"
                              className="w-14 text-center py-1.5 border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:border-cyan-500 transition-all"
                            />
                            <button
                              onClick={() => handleCantidad(p.codigo, qty + 1)}
                              className="w-7 h-7 rounded-lg bg-cyan-500 hover:bg-cyan-600 font-bold text-white transition-colors flex items-center justify-center text-base"
                            >+</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {productosFiltrados.length === 0 && (
                    <tr><td colSpan={4} className="py-12 text-center text-slate-400 text-sm">
                      No se encontraron productos{searchTerm ? ' para "' + searchTerm + '"' : ''}.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Total del pedido - fuera de la tabla, bien alineado */}
          {lineasSeleccionadas.length > 0 && (
            <div className="mt-4 flex justify-end">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 min-w-52">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Resumen del Pedido</p>
                <div className="space-y-1 mb-3">
                  {lineasSeleccionadas.map(l => (
                    <div key={l.codigo} className="flex justify-between text-xs text-slate-700">
                      <span className="truncate max-w-36">{l.articulo}</span>
                      <span className="font-bold ml-2 text-cyan-700">× {l.cantidad}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between text-xs font-bold text-slate-800">
                  <span>Total artículos</span>
                  <span className="text-cyan-600">{lineasSeleccionadas.reduce((s, l) => s + l.cantidad, 0)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 4: Observaciones y botones */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-cyan-500" />
          4. Observaciones y Registro
        </h2>
        <textarea
          value={notas}
          onChange={e => setNotas(e.target.value)}
          placeholder="Instrucciones especiales, horario de entrega, observaciones..."
          rows={3}
          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all resize-none mb-4"
        />
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleGuardar}
            disabled={saving || lineasSeleccionadas.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Guardando...' : 'Guardar y Descargar PDF'}
          </button>
          <button
            onClick={handleDescargarPDF}
            disabled={lineasSeleccionadas.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            <Download className="w-4 h-4" />
            Solo Descargar PDF
          </button>
        </div>
      </div>

      {/* Step 5: Buscador de pedidos */}
      <div>
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Search className="w-4 h-4 text-cyan-500" />
          5. Consultar Pedido Existente
        </h2>
        <BuscadorPedidos />
      </div>

    </div>
  );
}
