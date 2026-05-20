// @ts-nocheck
/**
 * SheetsOrderForm.tsx
 * Formulario de pedido conectado a Google Sheets.
 * PDF usando string concatenation (sin template literals) para evitar crash de html2canvas.
 * v2 - PDF profesional + Buscador de pedidos integrado
 */

import { useState, useEffect } from 'react';
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

// Types
interface LineItem {
  codigo: string;
  articulo: string;
  subArticulo: string;
  cantidad: number;
}

// ─────────────────────────────────────────────
// PDF Generator v2 - Diseño corporativo profesional
// ─────────────────────────────────────────────
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

  var provName = proveedor ? (proveedor.nombre || proveedorSheetName) : proveedorSheetName;
  var provTel  = proveedor ? (proveedor.telefono || '—') : '—';
  var provEmail= proveedor ? (proveedor.correo   || '—') : '—';
  var provAsesor=proveedor ? (proveedor.asesor   || '—') : '—';
  var sedeName = sede ? (sede.nombre      || '—') : '—';
  var sedeDir  = sede ? (sede.direccion   || '—') : '—';
  var sedeTel  = sede ? (sede.telefono    || '—') : '—';
  var sedeHora = sede ? (sede.horaEntrega || '—') : '—';

  // Build striped product rows
  var itemRowsArr = activeLineas.map(function(l, idx) {
    var bg = idx % 2 === 0 ? '#ffffff' : '#f5f7fb';
    return '<tr style="background:' + bg + ';">' +
      '<td style="border:1px solid #d0d7e3;padding:6px 8px;text-align:center;font-size:10px;color:#555;">' + (idx + 1) + '</td>' +
      '<td style="border:1px solid #d0d7e3;padding:6px 8px;font-size:10px;color:#1a1a2e;">' + (l.articulo || '') + (l.subArticulo ? '<br/><span style=\'color:#888;font-size:9px;\'>' + l.subArticulo + '</span>' : '') + '</td>' +
      '<td style="border:1px solid #d0d7e3;padding:6px 8px;text-align:center;font-size:10px;font-weight:bold;color:#1a3c6e;">' + (l.cantidad || 0) + '</td>' +
      '<td style="border:1px solid #d0d7e3;padding:6px 8px;text-align:right;font-size:10px;color:#555;">—</td>' +
      '<td style="border:1px solid #d0d7e3;padding:6px 8px;text-align:right;font-size:10px;color:#555;">—</td>' +
      '</tr>';
  });

  // Empty rows to fill to 12 min
  var emptyCount = Math.max(0, 12 - activeLineas.length);
  var emptyRowsArr = [];
  for (var ei = 0; ei < emptyCount; ei++) {
    var bg2 = (activeLineas.length + ei) % 2 === 0 ? '#ffffff' : '#f5f7fb';
    emptyRowsArr.push(
      '<tr style="background:' + bg2 + ';">' +
      '<td style="border:1px solid #d0d7e3;padding:6px 8px;text-align:center;font-size:10px;color:#ccc;">' + (activeLineas.length + ei + 1) + '</td>' +
      '<td style="border:1px solid #d0d7e3;padding:13px 8px;font-size:10px;">&nbsp;</td>' +
      '<td style="border:1px solid #d0d7e3;padding:6px 8px;"></td>' +
      '<td style="border:1px solid #d0d7e3;padding:6px 8px;"></td>' +
      '<td style="border:1px solid #d0d7e3;padding:6px 8px;"></td>' +
      '</tr>'
    );
  }

  var html = '<!DOCTYPE html><html><head><meta charset="utf-8"/><style>' +
    '@import url(\'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap\');' +
    'body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#1a1a2e;margin:0;padding:0;background:#fff;}' +
    '.page{padding:24px 28px;}' +
    /* Header band */
    '.top-band{background:#1a3c6e;height:6px;margin:-24px -28px 20px -28px;}' +
    '.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;padding-bottom:14px;border-bottom:2px solid #e8ecf4;}' +
    '.brand{display:flex;align-items:center;gap:12px;}' +
    '.logo-box{width:44px;height:44px;background:#1a3c6e;border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;font-size:18px;font-weight:900;letter-spacing:-1px;}' +
    '.brand-name{font-size:18px;font-weight:900;color:#1a3c6e;letter-spacing:-0.5px;}' +
    '.brand-sub{font-size:9px;color:#7b8db0;text-transform:uppercase;letter-spacing:1px;margin-top:1px;}' +
    '.oc-badge{background:#1a3c6e;color:white;border-radius:8px;padding:10px 16px;text-align:right;}' +
    '.oc-title{font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:#a8c0e8;font-weight:600;}' +
    '.oc-num{font-size:20px;font-weight:900;letter-spacing:-0.5px;}' +
    '.oc-date{font-size:9px;color:#a8c0e8;margin-top:2px;}' +
    /* Status band */
    '.status-band{background:#eef2fa;border:1px solid #c8d5ed;border-radius:6px;padding:8px 14px;display:flex;gap:32px;margin-bottom:14px;}' +
    '.status-item{display:flex;flex-direction:column;}' +
    '.status-lbl{font-size:8px;text-transform:uppercase;letter-spacing:1px;color:#7b8db0;font-weight:600;}' +
    '.status-val{font-size:10px;font-weight:700;color:#1a3c6e;margin-top:1px;}' +
    /* Party boxes */
    '.parties{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;}' +
    '.pbox{border:1px solid #d0d7e3;border-radius:6px;overflow:hidden;}' +
    '.pbox-hdr{background:#1a3c6e;color:white;font-weight:700;font-size:9px;padding:6px 10px;text-transform:uppercase;letter-spacing:1px;display:flex;align-items:center;gap:6px;}' +
    '.pbox-body{padding:8px 10px;line-height:1.8;font-size:9.5px;background:#fafbfd;}' +
    '.pbox-name{font-weight:700;font-size:10.5px;color:#1a3c6e;}' +
    /* Products table */
    '.sec-hdr{background:#1a3c6e;color:white;padding:7px 10px;font-weight:700;font-size:9px;text-transform:uppercase;letter-spacing:1px;border-radius:4px 4px 0 0;margin-bottom:0;}' +
    'table.pt{width:100%;border-collapse:collapse;border:1px solid #d0d7e3;}' +
    'table.pt th{background:#dde4f5;color:#1a3c6e;border:1px solid #d0d7e3;padding:7px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;}' +
    /* Totals */
    '.totals-row{display:flex;justify-content:flex-end;margin-top:10px;}' +
    'table.tt{border-collapse:collapse;width:220px;border:1px solid #d0d7e3;border-radius:4px;overflow:hidden;}' +
    'table.tt td{border:1px solid #d0d7e3;padding:5px 10px;font-size:10px;}' +
    '.ttlbl{text-align:right;font-weight:600;background:#f0f3fa;color:#444;text-transform:uppercase;font-size:9px;}' +
    '.tval{text-align:right;color:#1a1a2e;}' +
    '.grand td{background:#1a3c6e!important;color:white!important;font-weight:900;font-size:11px;}' +
    /* Signatures */
    '.sigs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:18px;}' +
    '.sig-box{border-top:2px solid #1a3c6e;padding-top:6px;text-align:center;}' +
    '.sig-lbl{font-size:9px;font-weight:700;color:#1a3c6e;text-transform:uppercase;letter-spacing:.5px;}' +
    '.sig-sub{font-size:8.5px;color:#888;margin-top:1px;}' +
    /* Comments */
    '.cmts{border:1px solid #d0d7e3;margin-top:14px;border-radius:4px;overflow:hidden;}' +
    '.cmts-hdr{background:#f0f3fa;color:#1a3c6e;padding:6px 10px;font-weight:700;font-size:9px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #d0d7e3;}' +
    '.cmts-body{padding:9px 10px;min-height:36px;font-size:9.5px;line-height:1.6;color:#444;}' +
    /* Footer */
    '.footer{margin-top:16px;padding-top:10px;border-top:1px solid #e8ecf4;display:flex;justify-content:space-between;align-items:center;}' +
    '.footer-left{font-size:8.5px;color:#aaa;}' +
    '.footer-right{font-size:8.5px;color:#aaa;text-align:right;}' +
    '.accent{color:#1a3c6e;font-weight:700;}' +
    '</style></head><body><div class="page">' +

    '<div class="top-band"></div>' +

    /* Header */
    '<div class="hdr">' +
    '<div class="brand">' +
    '<div class="logo-box">R</div>' +
    '<div>' +
    '<div class="brand-name">Rocoto Restaurantes</div>' +
    '<div class="brand-sub">Sistema de Compras &bull; ' + sedeDir + '</div>' +
    '</div>' +
    '</div>' +
    '<div class="oc-badge">' +
    '<div class="oc-title">Orden de Compra</div>' +
    '<div class="oc-num">OC-' + numeroOrden + '</div>' +
    '<div class="oc-date">' + fecha + '</div>' +
    '</div>' +
    '</div>' +

    /* Status band */
    '<div class="status-band">' +
    '<div class="status-item"><span class="status-lbl">N&deg; Orden</span><span class="status-val">OC-' + numeroOrden + '</span></div>' +
    '<div class="status-item"><span class="status-lbl">Sede</span><span class="status-val">' + sedeName + '</span></div>' +
    '<div class="status-item"><span class="status-lbl">Horario entrega</span><span class="status-val">' + sedeHora + '</span></div>' +
    '<div class="status-item"><span class="status-lbl">Responsable</span><span class="status-val">' + responsable + '</span></div>' +
    '<div class="status-item"><span class="status-lbl">Total items</span><span class="status-val">' + activeLineas.length + ' art&iacute;culo(s)</span></div>' +
    '</div>' +

    /* Parties */
    '<div class="parties">' +
    '<div class="pbox">' +
    '<div class="pbox-hdr">&#128666; Proveedor / Vendedor</div>' +
    '<div class="pbox-body">' +
    '<div class="pbox-name">' + provName + '</div>' +
    'Asesor: ' + provAsesor + '<br/>' +
    'Tel: ' + provTel + '<br/>' +
    'Email: ' + provEmail +
    '</div>' +
    '</div>' +
    '<div class="pbox">' +
    '<div class="pbox-hdr">&#127968; Cliente / Comprador</div>' +
    '<div class="pbox-body">' +
    '<div class="pbox-name">Rocoto Restaurantes</div>' +
    'Sede: ' + sedeName + '<br/>' +
    'Dir: ' + sedeDir + '<br/>' +
    'Horario: ' + sedeHora + '<br/>' +
    'Resp: ' + responsable +
    '</div>' +
    '</div>' +
    '</div>' +

    /* Products */
    '<div class="sec-hdr">&#128230; Productos / Servicios Solicitados</div>' +
    '<table class="pt"><thead><tr>' +
    '<th style="width:5%;text-align:center;">N.</th>' +
    '<th style="width:52%;text-align:left;">Descripci&oacute;n del Art&iacute;culo</th>' +
    '<th style="width:13%;text-align:center;">Cantidad</th>' +
    '<th style="width:15%;text-align:right;">Precio Unit.</th>' +
    '<th style="width:15%;text-align:right;">Total</th>' +
    '</tr></thead><tbody>' +
    itemRowsArr.join('') +
    emptyRowsArr.join('') +
    '</tbody></table>' +

    /* Totals */
    '<div class="totals-row"><table class="tt">' +
    '<tr><td class="ttlbl">Subtotal</td><td class="tval">A convenir</td></tr>' +
    '<tr><td class="ttlbl">IVA</td><td class="tval">Incluido</td></tr>' +
    '<tr><td class="ttlbl">Env&iacute;o</td><td class="tval">Incluido</td></tr>' +
    '<tr class="grand"><td class="ttlbl">TOTAL</td><td class="tval">Seg&uacute;n factura</td></tr>' +
    '</table></div>' +

    /* Comments */
    '<div class="cmts">' +
    '<div class="cmts-hdr">&#128221; Comentarios e Instrucciones Especiales</div>' +
    '<div class="cmts-body">' + (notas || 'Sin comentarios adicionales.') + '<br/>' +
    '<span style="color:#888;font-size:9px;">Solicitado por: <strong>' + responsable + '</strong> &bull; Sede: <strong>' + sedeName + '</strong> &bull; Horario recepci&oacute;n: <strong>' + sedeHora + '</strong></span>' +
    '</div>' +
    '</div>' +

    /* Signatures */
    '<div class="sigs">' +
    '<div class="sig-box"><div class="sig-lbl">Elaborado por</div><div class="sig-sub">' + responsable + '</div></div>' +
    '<div class="sig-box"><div class="sig-lbl">Aprobado por</div><div class="sig-sub">Gerencia</div></div>' +
    '<div class="sig-box"><div class="sig-lbl">Recibido por</div><div class="sig-sub">Proveedor</div></div>' +
    '</div>' +

    /* Footer */
    '<div class="footer">' +
    '<div class="footer-left">Rocoto Restaurantes &bull; comprasrocoto@gmail.com &bull; Tel: (604) 987 6543</div>' +
    '<div class="footer-right"><span class="accent">OC-' + numeroOrden + '</span> &bull; Generado el ' + fecha + ' &bull; P&aacute;g. 1</div>' +
    '</div>' +

    '</div></body></html>';

  var provSlug = provName.replace(/[^A-Za-z0-9]/g, '_').substring(0, 20);
  var opt = {
    margin: [6, 6, 6, 6],
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

  html2pdf().set(opt).from(html).save();
}

// ─────────────────────────────────────────────
// BuscadorPedidos - Panel de búsqueda integrado
// ─────────────────────────────────────────────
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
          nOrden:      String(p.nOrden || busquedaId),
          fecha:       fechaStr,
          sede:        String(p.sede || '—'),
          proveedor:   String(p.proveedor || '—'),
          responsable: String(p.responsable || '—'),
          articulos:   p.lineas.map(function(l) {
            return {
              codigo:     String(l.codigo || ''),
              articulo:   String(l.insumo || l.articulo || ''),
              subArticulo:String(l.subArticulo || ''),
              cantidad:   String(l.cantidad || ''),
              unidad:     String(l.unidad || ''),
            };
          }),
        });
      } else {
        var rows2 = data.rows || [];
        if (rows2.length === 0) { setErrorBusq('No se encontraron registros para ese ID.'); return; }
        var first2 = rows2[0];
        setPedido({
          nOrden:      String(first2[0] || busquedaId),
          fecha:       String(first2[1] || '—'),
          sede:        String(first2[2] || '—'),
          proveedor:   String(first2[3] || '—'),
          responsable: String(first2[9] || '—'),
          articulos:   rows2.map(function(r2) {
            return {
              codigo:     String(r2[4] || ''),
              articulo:   String(r2[5] || ''),
              subArticulo:String(r2[6] || ''),
              cantidad:   String(r2[7] || ''),
              unidad:     String(r2[8] || ''),
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
// ─────────────────────────────────────────────
// SheetsOrderForm - Componente principal
// ─────────────────────────────────────────────
export default function SheetsOrderForm() {
  const [proveedores, setProveedores] = useState<ProveedorSheet[]>([]);
  const [sedes, setSedes] = useState<SedeSheet[]>([]);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [productos, setProductos] = useState<ProductoSheet[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingProductos, setLoadingProductos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedSede, setSelectedSede] = useState('');
  const [selectedProveedorSheet, setSelectedProveedorSheet] = useState('');
  const [responsable, setResponsable] = useState(() => localStorage.getItem('pedido_responsable') || '');
  const [correoResponsable, setCorreoResponsable] = useState(() => localStorage.getItem('pedido_correo') || '');
  const [notas, setNotas] = useState('');
  const [cantidades, setCantidades] = useState<Record<string, number>>({});

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [provs, sds, names] = await Promise.all([
          getProveedores(),
          getSedes(),
          getProveedorSheetNames(),
        ]);
        setProveedores(provs);
        setSedes(sds);
        setSheetNames(names);
        setError(null);
      } catch (e: any) {
        setError('No se pudo conectar con Google Sheets. ' + e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!selectedProveedorSheet) {
      setProductos([]);
      setCantidades({});
      return;
    }
    setLoadingProductos(true);
    getProductosByProveedor(selectedProveedorSheet)
      .then(prods => {
        setProductos(prods);
        setCantidades({});
        setSearchTerm('');
      })
      .catch(e => setError('Error al cargar productos: ' + e.message))
      .finally(() => setLoadingProductos(false));
  }, [selectedProveedorSheet]);

  const handleCantidad = (codigo: string, val: number) => {
    setCantidades(prev => ({ ...prev, [codigo]: Math.max(0, val) }));
  };

  const lineasSeleccionadas: LineItem[] = productos
    .filter(p => (cantidades[p.codigo] || 0) > 0)
    .map(p => ({ codigo: p.codigo, articulo: p.articulo, subArticulo: p.subArticulo, cantidad: cantidades[p.codigo] }));

  const productosFiltrados = productos.filter(p =>
    !searchTerm ||
    p.articulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.subArticulo.toLowerCase().includes(searchTerm.toLowerCase())
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
      for (const linea of lineasSeleccionadas) {
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
            notas: notas || '',
            numeroOrden: String(numeroOrden),
          });
        } catch (errLinea) {
          console.error('[Sheets] Error guardando linea:', errLinea);
        }
      }
      console.log('[Drive] Pedido guardado:', lineasSeleccionadas.length, 'items');

      try {
        await (dbService as any).savePedido?.({
          numeroOrden,
          fecha: new Date().toISOString(),
          sede: selectedSede,
          proveedor: selectedProveedorSheet,
          productos: lineasSeleccionadas,
          notas,
          responsable,
          correoResponsable,
        });
      } catch(eFb) {
        console.warn('[Firebase] savePedido failed (non-critical):', eFb);
      }

      setSuccess(true);
      setCantidades({});
      setNotas('');
      setTimeout(() => setSuccess(false), 5000);

      const pdfParams = {
        sede: sedeSeleccionada,
        proveedor: proveedorSeleccionado,
        proveedorSheetName: selectedProveedorSheet,
        lineas: lineasSeleccionadas,
        notas,
        responsable,
        correoResponsable,
        numeroOrden,
      };
      setTimeout(() => { generarPDF(pdfParams); }, 400);
    } catch (e: any) {
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Error de conexion</p>
            <p className="text-xs mt-0.5">{error}</p>
            <button onClick={() => setError(null)} className="text-xs underline mt-1">Cerrar</button>
          </div>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-700">
          <CheckCircle className="w-5 h-5" />
          <p className="text-sm font-semibold">Pedido guardado exitosamente. El PDF se esta descargando.</p>
        </div>
      )}

      {/* Step 1 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-brand-500" />
          1. Informacion del Pedido
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Sede *</label>
            <select
              value={selectedSede}
              onChange={e => setSelectedSede(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
            >
              <option value="">Seleccionar sede...</option>
              {sedes.map(s => <option key={s.nombre} value={s.nombre}>{s.nombre}</option>)}
            </select>
          </div>
          {sedeSeleccionada && (
            <div className="col-span-1 bg-slate-50 rounded-lg p-3 text-xs space-y-0.5">
              <p className="font-bold text-slate-600">{sedeSeleccionada.direccion}</p>
              {sedeSeleccionada.telefono && <p className="text-slate-500">Tel: {sedeSeleccionada.telefono}</p>}
              {sedeSeleccionada.horaEntrega && <p className="text-slate-500">Horario: {sedeSeleccionada.horaEntrega}</p>}
            </div>
          )}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Responsable *</label>
            <input
              type="text"
              value={responsable}
              onChange={e => setResponsable(e.target.value)}
              placeholder="Tu nombre completo"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Correo</label>
            <input
              type="email"
              value={correoResponsable}
              onChange={e => setCorreoResponsable(e.target.value)}
              placeholder="correo@empresa.com"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Step 2 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Truck className="w-4 h-4 text-brand-500" />
          2. Seleccionar Proveedor ({sheetNames.length} disponibles)
        </h2>
        <select
          value={selectedProveedorSheet}
          onChange={e => setSelectedProveedorSheet(e.target.value)}
          className="w-full md:w-96 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
        >
          <option value="">Seleccionar proveedor...</option>
          {sheetNames.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
        {proveedorSeleccionado && (
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
            {proveedorSeleccionado.telefono && (
              <div className="bg-slate-50 rounded-lg p-3 text-xs">
                <p className="text-slate-400 font-bold uppercase mb-0.5">Telefono</p>
                <p className="text-slate-700 font-medium">{proveedorSeleccionado.telefono}</p>
              </div>
            )}
            {proveedorSeleccionado.correo && (
              <div className="bg-slate-50 rounded-lg p-3 text-xs">
                <p className="text-slate-400 font-bold uppercase mb-0.5">Correo</p>
                <p className="text-slate-700 font-medium truncate">{proveedorSeleccionado.correo}</p>
              </div>
            )}
            {proveedorSeleccionado.asesor && (
              <div className="bg-slate-50 rounded-lg p-3 text-xs">
                <p className="text-slate-400 font-bold uppercase mb-0.5">Asesor</p>
                <p className="text-slate-700 font-medium">{proveedorSeleccionado.asesor}</p>
              </div>
            )}
            {proveedorSeleccionado.medioPago && (
              <div className="bg-slate-50 rounded-lg p-3 text-xs">
                <p className="text-slate-400 font-bold uppercase mb-0.5">Medio de Pago</p>
                <p className="text-slate-700 font-medium">{proveedorSeleccionado.medioPago}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 3: Products */}
      {selectedProveedorSheet && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-4 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-brand-500" />
            3. Productos - {selectedProveedorSheet}
            {loadingProductos && <RefreshCw className="w-3 h-3 animate-spin text-slate-400 ml-2" />}
            <span className="ml-auto text-xs font-normal text-slate-400 normal-case">{lineasSeleccionadas.length} item(s) seleccionado(s)</span>
          </h2>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar articulo por nombre o codigo..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
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
                    <th className="py-3 px-4 text-left text-[10px] uppercase tracking-wider font-bold w-24">Codigo</th>
                    <th className="py-3 px-4 text-left text-[10px] uppercase tracking-wider font-bold">Articulo</th>
                    <th className="py-3 px-4 text-left text-[10px] uppercase tracking-wider font-bold hidden md:table-cell">SubArticulo</th>
                    <th className="py-3 px-4 text-center text-[10px] uppercase tracking-wider font-bold w-32">Cantidad</th>
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
                        <td className="py-2.5 px-4 font-mono text-xs text-slate-500">{p.codigo}</td>
                        <td className="py-2.5 px-4 font-medium text-slate-800">{p.articulo}</td>
                        <td className="py-2.5 px-4 text-slate-500 hidden md:table-cell text-xs">{p.subArticulo}</td>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-1.5 justify-center">
                            <button
                              onClick={() => handleCantidad(p.codigo, qty - 1)}
                              className="w-7 h-7 rounded-lg bg-slate-200 hover:bg-slate-300 font-bold transition-colors flex items-center justify-center text-slate-600"
                            >-</button>
                            <input
                              type="number"
                              min={0}
                              value={qty || ''}
                              onChange={e => handleCantidad(p.codigo, parseInt(e.target.value) || 0)}
                              placeholder="0"
                              className="w-14 text-center py-1 border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:border-brand-500 transition-all"
                            />
                            <button
                              onClick={() => handleCantidad(p.codigo, qty + 1)}
                              className="w-7 h-7 rounded-lg bg-brand-500 hover:bg-brand-600 font-bold text-white transition-colors flex items-center justify-center"
                            >+</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {productosFiltrados.length === 0 && (
                    <tr><td colSpan={4} className="py-12 text-center text-slate-400 text-sm">No se encontraron productos{searchTerm ? ' para "' + searchTerm + '"' : ''}.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Step 4: Notes + Actions */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-brand-500" />
          4. Observaciones y Registro
        </h2>
        <textarea
          value={notas}
          onChange={e => setNotas(e.target.value)}
          placeholder="Instrucciones especiales, horario de entrega, observaciones..."
          rows={3}
          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all resize-none mb-4"
        />

        {lineasSeleccionadas.length > 0 && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
            <p className="text-xs font-bold text-emerald-700 uppercase mb-1.5">Resumen del Pedido</p>
            <div className="space-y-0.5">
              {lineasSeleccionadas.map(l => (
                <div key={l.codigo} className="flex justify-between text-xs text-emerald-800">
                  <span>{l.articulo}</span>
                  <span className="font-bold">x{l.cantidad}</span>
                </div>
              ))}
            </div>
          </div>
        )}

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
            className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            <Download className="w-4 h-4" />
            Solo Descargar PDF
          </button>
        </div>
      </div>

      {/* Step 5: Buscador de Pedidos */}
      <div>
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Search className="w-4 h-4 text-brand-500" />
          5. Consultar Pedido Existente
        </h2>
        <BuscadorPedidos />
      </div>

    </div>
  );
}
