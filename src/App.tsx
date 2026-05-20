// @ts-nocheck
/**
 * App.tsx - InsumoMaster v4
 * Tabs: Catálogo Firebase | Pedido desde Drive | Ventas | Cotizaciones
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import { Database, Plus, FileSpreadsheet, Download, RefreshCw, BarChart3, List, LayoutGrid, ShoppingBag } from 'lucide-react';
import { INSUMOS, PROVEEDORES, SEDES } from './data/mockData';
import { Insumo, Proveedor } from './types';
import Filters from './components/Filters';
import InsumoTable from './components/InsumoTable';
import ProveedorCard from './components/ProveedorCard';
import SheetsOrderForm from './components/SheetsOrderForm';
import { cn } from './lib/utils';
import { dbService, Sede } from './services/db';
import { getSedes as getSheetsSedesRaw, getProveedores as getSheetsProveedores,
  getProveedorSheetNames, getAllDatos, appendPedido } from './services/googleSheets';
// @ts-ignore
import html2pdf from 'html2pdf.js';

// ─── PDF helpers (sin template literals) ────────────────────────────────────
function fmt(n) { return '$' + Number(n || 0).toLocaleString('es-CO'); }

function generarPDFOrdenCompra({ items, proveedor, sede, direccion, horario, responsable, notas, numeroOrden, proveedores }) {
  var fecha = new Date().toLocaleDateString('es-CO', { year:'numeric', month:'long', day:'numeric' });
  var fechaHoy = new Date().toISOString().slice(0, 10);
  var provObj = proveedores ? proveedores.find(function(p){ return p.id === (proveedor && proveedor.id) || p.nombre === proveedor; }) : null;
  var provNombre = (provObj && provObj.nombre) || (typeof proveedor === 'string' ? proveedor : 'Varios');
  var provTel = (provObj && provObj.telefono) || '—';
  var provEmail = (provObj && provObj.email) || '—';
  var subtotal = items.reduce(function(a, i){ return a + ((i.precio || 0) * (i.cantidad || 0)); }, 0);

  var itemRowsArr = items.map(function(i, idx) {
    var bg = idx % 2 === 0 ? '#ffffff' : '#f4f7fc';
    var total = (i.precio || 0) * (i.cantidad || 0);
    return '<tr style="background:' + bg + ';">' +
      '<td style="border:1px solid #dde3ee;padding:9px 10px;text-align:center;font-size:10px;color:#888;">' + (idx+1) + '</td>' +
      '<td style="border:1px solid #dde3ee;padding:9px 12px;font-size:11px;font-weight:600;color:#1a1a2e;">' + (i.nombre || i.articulo || '') + (i.categoria ? '<div style="color:#999;font-size:9px;">' + i.categoria + '</div>' : '') + '</td>' +
      '<td style="border:1px solid #dde3ee;padding:9px 10px;text-align:center;font-size:11px;font-weight:800;color:#1a3c6e;">' + (i.cantidad || 0) + ' ' + (i.unidad || '') + '</td>' +
      '<td style="border:1px solid #dde3ee;padding:9px 10px;text-align:right;font-size:11px;">' + fmt(i.precio || 0) + '</td>' +
      '<td style="border:1px solid #dde3ee;padding:9px 10px;text-align:right;font-size:11px;font-weight:700;color:#1a3c6e;">' + fmt(total) + '</td>' +
    '</tr>';
  });
  var emptyCount = Math.max(0, 10 - items.length);
  var emptyRowsArr = [];
  for (var ei = 0; ei < emptyCount; ei++) {
    var bg2 = (items.length + ei) % 2 === 0 ? '#ffffff' : '#f4f7fc';
    emptyRowsArr.push('<tr style="background:' + bg2 + ';">' +
      '<td style="border:1px solid #dde3ee;padding:13px 10px;font-size:10px;color:#ddd;text-align:center;">' + (items.length+ei+1) + '</td>' +
      '<td style="border:1px solid #dde3ee;padding:13px 10px;">&nbsp;</td>' +
      '<td style="border:1px solid #dde3ee;padding:13px 10px;"></td>' +
      '<td style="border:1px solid #dde3ee;padding:13px 10px;"></td>' +
      '<td style="border:1px solid #dde3ee;padding:13px 10px;"></td>' +
    '</tr>');
  }

  var html = '<!DOCTYPE html><html><head><meta charset="utf-8"/><style>' +
    'body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#1a1a2e;margin:0;padding:0;background:#fff;}' +
    '.page{padding:28px 32px;}' +
    '.top-band{background:#1a3c6e;height:7px;margin:-28px -32px 22px -32px;}' +
    '.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;padding-bottom:14px;border-bottom:2px solid #e8ecf4;}' +
    '.logo-box{width:50px;height:50px;background:#1a3c6e;border-radius:10px;display:flex;align-items:center;justify-content:center;color:white;font-size:22px;font-weight:900;float:left;margin-right:12px;}' +
    '.brand-name{font-size:20px;font-weight:900;color:#1a3c6e;}' +
    '.brand-sub{font-size:9px;color:#9baac5;text-transform:uppercase;letter-spacing:1.5px;margin-top:2px;}' +
    '.oc-badge{background:#1a3c6e;color:white;border-radius:10px;padding:10px 18px;text-align:right;}' +
    '.oc-title{font-size:8px;text-transform:uppercase;letter-spacing:2px;color:#a8c0e8;font-weight:700;}' +
    '.oc-num{font-size:20px;font-weight:900;}' +
    '.oc-date{font-size:9px;color:#a8c0e8;margin-top:2px;}' +
    '.info-band{background:#f0f4fb;border:1px solid #ccd6ed;border-radius:8px;padding:9px 16px;display:flex;gap:28px;margin-bottom:16px;}' +
    '.info-item{display:flex;flex-direction:column;}' +
    '.info-lbl{font-size:8px;text-transform:uppercase;letter-spacing:1px;color:#8899bb;font-weight:700;}' +
    '.info-val{font-size:11px;font-weight:800;color:#1a3c6e;margin-top:1px;}' +
    '.prov-box{border:1px solid #ccd6ed;border-radius:8px;overflow:hidden;margin-bottom:16px;max-width:380px;}' +
    '.prov-hdr{background:#1a3c6e;color:white;font-weight:700;font-size:9px;padding:6px 12px;text-transform:uppercase;letter-spacing:1px;}' +
    '.prov-body{padding:10px 12px;background:#fafbfd;}' +
    '.prov-name{font-weight:800;font-size:13px;color:#1a3c6e;margin-bottom:3px;}' +
    '.prod-hdr{background:#1a3c6e;color:white;padding:8px 12px;font-weight:700;font-size:9px;text-transform:uppercase;letter-spacing:1px;border-radius:6px 6px 0 0;}' +
    'table.pt{width:100%;border-collapse:collapse;border:1px solid #dde3ee;}' +
    'table.pt th{background:#e6ebf5;color:#1a3c6e;border:1px solid #dde3ee;padding:8px 10px;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;}' +
    '.totals-wrap{display:flex;justify-content:flex-end;margin-top:10px;}' +
    'table.tt{border-collapse:collapse;width:240px;border:1px solid #dde3ee;border-radius:6px;overflow:hidden;}' +
    'table.tt td{border:1px solid #dde3ee;padding:6px 12px;font-size:11px;}' +
    '.ttlbl{text-align:right;font-weight:700;background:#f0f4fb;color:#555;text-transform:uppercase;font-size:9px;}' +
    '.tval{text-align:right;font-weight:600;color:#1a1a2e;}' +
    '.grand td{background:#1a3c6e!important;color:white!important;font-weight:900;font-size:12px;}' +
    '.obs-box{border:1px solid #dde3ee;margin-top:16px;border-radius:6px;overflow:hidden;}' +
    '.obs-hdr{background:#f0f4fb;color:#1a3c6e;padding:6px 12px;font-weight:800;font-size:9px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #dde3ee;}' +
    '.obs-body{padding:12px;min-height:44px;font-size:11px;line-height:1.7;color:#444;}' +
    '.footer{margin-top:16px;padding-top:10px;border-top:1px solid #e8ecf4;display:flex;justify-content:space-between;}' +
    '.footer-l{font-size:8.5px;color:#bbb;}' +
    '.footer-r{font-size:8.5px;color:#bbb;text-align:right;}' +
    '</style></head><body><div class="page">' +
    '<div class="top-band"></div>' +
    '<div class="hdr">' +
      '<div style="display:flex;align-items:center;">' +
        '<div class="logo-box">R</div>' +
        '<div><div class="brand-name">Rocoto Restaurantes</div><div class="brand-sub">Sistema de Compras</div></div>' +
      '</div>' +
      '<div class="oc-badge"><div class="oc-title">Orden de Compra</div><div class="oc-num">OC-' + numeroOrden + '</div><div class="oc-date">' + fecha + '</div></div>' +
    '</div>' +
    '<div class="info-band">' +
      '<div class="info-item"><span class="info-lbl">N&deg; Orden</span><span class="info-val">OC-' + numeroOrden + '</span></div>' +
      '<div class="info-item"><span class="info-lbl">Sede</span><span class="info-val">' + (sede || '—') + '</span></div>' +
      '<div class="info-item"><span class="info-lbl">Direcci&oacute;n</span><span class="info-val">' + (direccion || '—') + '</span></div>' +
      '<div class="info-item"><span class="info-lbl">Horario entrega</span><span class="info-val">' + (horario || '—') + '</span></div>' +
    '</div>' +
    '<div class="prov-box">' +
      '<div class="prov-hdr">&#128666; Proveedor</div>' +
      '<div class="prov-body">' +
        '<div class="prov-name">' + provNombre + '</div>' +
        '<div style="font-size:10.5px;color:#555;">Tel: ' + provTel + ' &nbsp;&bull;&nbsp; Email: ' + provEmail + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="prod-hdr">&#128230; Art&iacute;culos Solicitados</div>' +
    '<table class="pt"><thead><tr>' +
      '<th style="width:5%;text-align:center;">N.</th>' +
      '<th style="width:48%;text-align:left;">Descripci&oacute;n</th>' +
      '<th style="width:13%;text-align:center;">Cantidad</th>' +
      '<th style="width:17%;text-align:right;">Precio Unit.</th>' +
      '<th style="width:17%;text-align:right;">Total</th>' +
    '</tr></thead><tbody>' + itemRowsArr.join('') + emptyRowsArr.join('') + '</tbody></table>' +
    '<div class="totals-wrap"><table class="tt">' +
      '<tr><td class="ttlbl">Subtotal</td><td class="tval">' + fmt(subtotal) + '</td></tr>' +
      '<tr><td class="ttlbl">IVA</td><td class="tval">Incluido</td></tr>' +
      '<tr class="grand"><td class="ttlbl">TOTAL</td><td class="tval">' + fmt(subtotal) + '</td></tr>' +
    '</table></div>' +
    '<div class="obs-box">' +
      '<div class="obs-hdr">&#128221; Observaciones</div>' +
      '<div class="obs-body">' + (notas || 'Sin observaciones.') + (responsable ? '<br/><span style="font-size:9px;color:#aaa;">Solicitado por: ' + responsable + '</span>' : '') + '</div>' +
    '</div>' +
    '<div class="footer">' +
      '<div class="footer-l">Rocoto Restaurantes &bull; comprasrocoto@gmail.com</div>' +
      '<div class="footer-r">OC-' + numeroOrden + ' &bull; P&aacute;g. 1</div>' +
    '</div></div></body></html>';

  var slug = provNombre.replace(/[^A-Za-z0-9]/g, '_').substring(0, 18);
  var opt = {
    margin: [8, 8, 8, 8],
    filename: 'OC-' + numeroOrden + '_' + slug + '_' + fechaHoy + '.pdf',
    image: { type: 'jpeg', quality: 0.97 },
    html2canvas: { scale: 2, useCORS: true, logging: false,
      onclone: function(d) {
        var ss = d.getElementsByTagName('style');
        for (var s = 0; s < ss.length; s++) {
          if (ss[s].innerHTML.indexOf('oklch') !== -1)
            ss[s].innerHTML = ss[s].innerHTML.replace(/oklch\([^)]+\)/g,'#ccc');
        }
      }
    },
    jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
  };
  var container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:816px;z-index:-1;';
  container.innerHTML = html;
  document.body.appendChild(container);
  html2pdf().set(opt).from(container).save().finally(function(){ document.body.removeChild(container); });
}

// ─── PDF Cotización ──────────────────────────────────────────────────────────
function generarPDFCotizacion({ items, cliente, responsable, notas, numeroCot, validez }) {
  var fecha = new Date().toLocaleDateString('es-CO', { year:'numeric', month:'long', day:'numeric' });
  var fechaHoy = new Date().toISOString().slice(0, 10);
  var subtotal = items.reduce(function(a, i){ return a + ((i.unitPrice || i.precio || 0) * (i.quantity || i.cantidad || 0)); }, 0);
  var iva = subtotal * 0.19;
  var total = subtotal + iva;

  var rowsArr = items.map(function(i, idx) {
    var bg = idx % 2 === 0 ? '#ffffff' : '#f4f7fc';
    var qty = i.quantity || i.cantidad || 0;
    var price = i.unitPrice || i.precio || 0;
    var tot = qty * price;
    return '<tr style="background:' + bg + ';">' +
      '<td style="border:1px solid #dde3ee;padding:9px 10px;text-align:center;font-size:10px;color:#888;">' + (idx+1) + '</td>' +
      '<td style="border:1px solid #dde3ee;padding:9px 12px;font-size:11px;font-weight:600;">' + (i.articulo || i.nombre || '') + (i.descripcion ? '<div style="color:#999;font-size:9px;">' + i.descripcion + '</div>' : '') + '</td>' +
      '<td style="border:1px solid #dde3ee;padding:9px 10px;text-align:center;font-size:11px;font-weight:700;color:#1a3c6e;">' + qty + '</td>' +
      '<td style="border:1px solid #dde3ee;padding:9px 10px;text-align:right;font-size:11px;">' + fmt(price) + '</td>' +
      '<td style="border:1px solid #dde3ee;padding:9px 10px;text-align:right;font-size:11px;font-weight:700;color:#1a3c6e;">' + fmt(tot) + '</td>' +
    '</tr>';
  });
  var emptyCount = Math.max(0, 8 - items.length);
  var emptyRowsArr = [];
  for (var ei = 0; ei < emptyCount; ei++) {
    var bg2 = (items.length + ei) % 2 === 0 ? '#ffffff' : '#f4f7fc';
    emptyRowsArr.push('<tr style="background:' + bg2 + ';">' +
      '<td style="border:1px solid #dde3ee;padding:13px 10px;color:#ddd;text-align:center;">' + (items.length+ei+1) + '</td>' +
      '<td style="border:1px solid #dde3ee;padding:13px 10px;">&nbsp;</td>' +
      '<td style="border:1px solid #dde3ee;padding:13px 10px;"></td>' +
      '<td style="border:1px solid #dde3ee;padding:13px 10px;"></td>' +
      '<td style="border:1px solid #dde3ee;padding:13px 10px;"></td>' +
    '</tr>');
  }

  var html = '<!DOCTYPE html><html><head><meta charset="utf-8"/><style>' +
    'body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#1a1a2e;margin:0;padding:0;}' +
    '.page{padding:28px 32px;}' +
    '.top-band{background:#0f7c4a;height:7px;margin:-28px -32px 22px -32px;}' +
    '.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;padding-bottom:14px;border-bottom:2px solid #e0f0ea;}' +
    '.logo-box{width:50px;height:50px;background:#0f7c4a;border-radius:10px;display:flex;align-items:center;justify-content:center;color:white;font-size:22px;font-weight:900;float:left;margin-right:12px;}' +
    '.brand-name{font-size:20px;font-weight:900;color:#0f7c4a;}' +
    '.brand-sub{font-size:9px;color:#6aaa8e;text-transform:uppercase;letter-spacing:1.5px;margin-top:2px;}' +
    '.cot-badge{background:#0f7c4a;color:white;border-radius:10px;padding:10px 18px;text-align:right;}' +
    '.cot-title{font-size:8px;text-transform:uppercase;letter-spacing:2px;color:#7dd4ae;font-weight:700;}' +
    '.cot-num{font-size:20px;font-weight:900;}' +
    '.cot-date{font-size:9px;color:#7dd4ae;margin-top:2px;}' +
    '.info-band{background:#f0fbf5;border:1px solid #b8e0cc;border-radius:8px;padding:9px 16px;display:flex;gap:28px;margin-bottom:16px;}' +
    '.info-lbl{font-size:8px;text-transform:uppercase;letter-spacing:1px;color:#5aaa7a;font-weight:700;}' +
    '.info-val{font-size:11px;font-weight:800;color:#0f7c4a;margin-top:1px;}' +
    '.cli-box{border:1px solid #b8e0cc;border-radius:8px;overflow:hidden;margin-bottom:16px;}' +
    '.cli-hdr{background:#0f7c4a;color:white;font-weight:700;font-size:9px;padding:6px 12px;text-transform:uppercase;letter-spacing:1px;}' +
    '.cli-body{padding:10px 12px;background:#f8fdfb;}' +
    '.cli-name{font-weight:800;font-size:13px;color:#0f7c4a;margin-bottom:3px;}' +
    '.prod-hdr{background:#0f7c4a;color:white;padding:8px 12px;font-weight:700;font-size:9px;text-transform:uppercase;letter-spacing:1px;border-radius:6px 6px 0 0;}' +
    'table.pt{width:100%;border-collapse:collapse;border:1px solid #dde3ee;}' +
    'table.pt th{background:#e0f5ea;color:#0f7c4a;border:1px solid #dde3ee;padding:8px 10px;font-size:9px;font-weight:800;text-transform:uppercase;}' +
    '.totals-wrap{display:flex;justify-content:flex-end;margin-top:10px;}' +
    'table.tt{border-collapse:collapse;width:240px;border:1px solid #dde3ee;}' +
    'table.tt td{border:1px solid #dde3ee;padding:6px 12px;font-size:11px;}' +
    '.ttlbl{text-align:right;font-weight:700;background:#f0fbf5;color:#555;text-transform:uppercase;font-size:9px;}' +
    '.tval{text-align:right;font-weight:600;}' +
    '.grand td{background:#0f7c4a!important;color:white!important;font-weight:900;font-size:12px;}' +
    '.validez{background:#fff8e1;border:1px solid #ffe082;border-radius:6px;padding:10px 14px;margin-top:14px;font-size:10px;color:#7a5c00;}' +
    '.footer{margin-top:14px;padding-top:10px;border-top:1px solid #e0f0ea;display:flex;justify-content:space-between;}' +
    '.footer-l,.footer-r{font-size:8.5px;color:#bbb;}' +
    '</style></head><body><div class="page">' +
    '<div class="top-band"></div>' +
    '<div class="hdr">' +
      '<div style="display:flex;align-items:center;">' +
        '<div class="logo-box">R</div>' +
        '<div><div class="brand-name">Rocoto Restaurantes</div><div class="brand-sub">Cotizaci&oacute;n Comercial</div></div>' +
      '</div>' +
      '<div class="cot-badge"><div class="cot-title">Cotizaci&oacute;n</div><div class="cot-num">COT-' + numeroCot + '</div><div class="cot-date">' + fecha + '</div></div>' +
    '</div>' +
    '<div class="info-band">' +
      '<div><span class="info-lbl" style="display:block;">N&deg; Cotizaci&oacute;n</span><span class="info-val">COT-' + numeroCot + '</span></div>' +
      '<div><span class="info-lbl" style="display:block;">Fecha</span><span class="info-val">' + fecha + '</span></div>' +
      '<div><span class="info-lbl" style="display:block;">V&aacute;lida hasta</span><span class="info-val">' + (validez || '30 d&iacute;as') + '</span></div>' +
      '<div><span class="info-lbl" style="display:block;">Elaborado por</span><span class="info-val">' + (responsable || 'Rocoto') + '</span></div>' +
    '</div>' +
    '<div class="cli-box"><div class="cli-hdr">&#128100; Cliente</div>' +
      '<div class="cli-body"><div class="cli-name">' + (cliente || 'Cliente General') + '</div></div>' +
    '</div>' +
    '<div class="prod-hdr">&#128722; Productos / Servicios Cotizados</div>' +
    '<table class="pt"><thead><tr>' +
      '<th style="width:5%;text-align:center;">N.</th>' +
      '<th style="width:48%;text-align:left;">Descripci&oacute;n</th>' +
      '<th style="width:10%;text-align:center;">Cant.</th>' +
      '<th style="width:17%;text-align:right;">Valor Unit.</th>' +
      '<th style="width:20%;text-align:right;">Total</th>' +
    '</tr></thead><tbody>' + rowsArr.join('') + emptyRowsArr.join('') + '</tbody></table>' +
    '<div class="totals-wrap"><table class="tt">' +
      '<tr><td class="ttlbl">Subtotal</td><td class="tval">' + fmt(subtotal) + '</td></tr>' +
      '<tr><td class="ttlbl">IVA (19%)</td><td class="tval">' + fmt(iva) + '</td></tr>' +
      '<tr class="grand"><td class="ttlbl">TOTAL</td><td class="tval">' + fmt(total) + '</td></tr>' +
    '</table></div>' +
    '<div class="validez">&#9432; Esta cotizaci&oacute;n es v&aacute;lida por ' + (validez || '30 d&iacute;as') + ' a partir de la fecha de emisi&oacute;n. Precios sujetos a cambio sin previo aviso.</div>' +
    '<div class="footer"><div class="footer-l">Rocoto Restaurantes &bull; comprasrocoto@gmail.com</div><div class="footer-r">COT-' + numeroCot + ' &bull; P&aacute;g. 1</div></div>' +
    '</div></body></html>';

  var opt = {
    margin: [8, 8, 8, 8],
    filename: 'Cotizacion_COT-' + numeroCot + '_' + fechaHoy + '.pdf',
    image: { type: 'jpeg', quality: 0.97 },
    html2canvas: { scale: 2, useCORS: true, logging: false,
      onclone: function(d) {
        var ss = d.getElementsByTagName('style');
        for (var s = 0; s < ss.length; s++) {
          if (ss[s].innerHTML.indexOf('oklch') !== -1)
            ss[s].innerHTML = ss[s].innerHTML.replace(/oklch\([^)]+\)/g,'#ccc');
        }
      }
    },
    jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
  };
  var container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:816px;z-index:-1;';
  container.innerHTML = html;
  document.body.appendChild(container);
  html2pdf().set(opt).from(container).save().finally(function(){ document.body.removeChild(container); });
}

// ─── App principal ───────────────────────────────────────────────────────────
export default function App() {
  var [insumos, setInsumos] = useState([]);
  var [activeTab, setActiveTab] = useState('catalogo');
  var [proveedores, setProveedores] = useState([]);
  var [sedes, setSedes] = useState([]);
  var [searchTerm, setSearchTerm] = useState('');
  var [selectedProveedorId, setSelectedProveedorId] = useState('');
  var [selectedCategory, setSelectedCategory] = useState('');
  var [viewMode, setViewMode] = useState('list');
  var [isUpdating, setIsUpdating] = useState(false);
  var [quantities, setQuantities] = useState({});
  var [sede, setSede] = useState(function(){ return localStorage.getItem('order_config_sede') || ''; });
  var [direccionEntrega, setDireccionEntrega] = useState(function(){ return localStorage.getItem('order_config_direccion') || ''; });
  var [horarioRecepcion, setHorarioRecepcion] = useState(function(){ return localStorage.getItem('order_config_horario') || ''; });
  var [notas, setNotas] = useState('');
  var [responsable, setResponsable] = useState('');

  useEffect(function() {
    dbService.initializeIfEmpty(INSUMOS, PROVEEDORES, SEDES);
  }, []);

  useEffect(function() {
    var unsubInsumos = dbService.subscribeToInsumos(setInsumos);
    var unsubProveedores = dbService.subscribeToProveedores(setProveedores);
    var unsubSedes = dbService.subscribeToSedes(setSedes);

    getSheetsSedesRaw().then(function(sheetsSedes) {
      if (sheetsSedes && sheetsSedes.length > 0) {
        setSedes(sheetsSedes.map(function(s, i) {
          return { id: 'sheets-sede-' + i, nombre: s.nombre, direccion: s.direccion || '', horario: s.horaEntrega || '' };
        }));
      }
    }).catch(function(err){ console.warn('Sheets sedes fallback:', err); });

    getSheetsProveedores().then(function(sheetProvs) {
      if (sheetProvs && sheetProvs.length > 0) {
        setProveedores(sheetProvs.map(function(p) {
          return { id: 'sheets-prov-' + p.nombre, nombre: p.nombre, contacto: p.asesor || '', email: p.correo || '', telefono: p.telefono || '', activo: true, categoria: '' };
        }));
      }
    }).catch(function(err){ console.warn('Sheets proveedores fallback:', err); });

    return function() { unsubInsumos(); unsubProveedores(); unsubSedes(); };
  }, []);

  // Carga insumos desde Sheets (cache 5 min en googleSheets.ts)
  useEffect(function() {
    (async function() {
      try {
        var datos = await getAllDatos();
        var artPorProv = datos.articulosPorProveedor || {};
        var today = new Date().toISOString();
        var allInsumos = [];
        Object.keys(artPorProv).forEach(function(sheetName) {
          (artPorProv[sheetName] || []).forEach(function(p, idx) {
            // Filtrar cabeceras y totales
            var art = (p.articulo || '').toLowerCase().trim();
            var cod = (p.codigo || '').toLowerCase().trim();
            if (!art && !cod) return;
            if (cod === 'proveedor' || cod.indexOf('barras') !== -1 || cod.indexOf('total') !== -1) return;
            if (art === 'articulo' || art === 'artículo' || art.indexOf('total') !== -1) return;
            allInsumos.push({
              id: sheetName + '-' + idx,
              nombre: p.articulo || '',
              categoria: p.subArticulo || sheetName,
              codigo: p.codigo || '',
              unidad: 'UND',
              precio: 0,
              proveedorId: 'sheets-prov-' + sheetName,
              actualizadoAt: today,
            });
          });
        });
        if (allInsumos.length > 0) setInsumos(allInsumos);
      } catch(err) { console.warn('Sheets insumos load:', err); }
    })();
  }, []);

  var handleConfigChange = function(field, value) {
    if (field === 'sede') {
      setSede(value);
      localStorage.setItem('order_config_sede', value);
      var foundSede = sedes.find(function(s){ return s.nombre === value; });
      if (foundSede) {
        setDireccionEntrega(foundSede.direccion);
        localStorage.setItem('order_config_direccion', foundSede.direccion);
        setHorarioRecepcion(foundSede.horario);
        localStorage.setItem('order_config_horario', foundSede.horario);
      }
    } else if (field === 'direccion') {
      setDireccionEntrega(value); localStorage.setItem('order_config_direccion', value);
    } else if (field === 'horario') {
      setHorarioRecepcion(value); localStorage.setItem('order_config_horario', value);
    }
  };

  var handleQuantityChange = function(id, value) {
    setQuantities(function(prev){ return Object.assign({}, prev, { [id]: Math.max(0, value) }); });
  };

  var categories = useMemo(function() {
    var cats = new Set(insumos.map(function(i){ return i.categoria; }));
    return Array.from(cats).sort();
  }, [insumos]);

  var filteredInsumos = useMemo(function() {
    return insumos.filter(function(insumo) {
      var proveedor = proveedores.find(function(p){ return p.id === insumo.proveedorId; });
      var matchesSearch = !searchTerm ||
        (insumo.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (insumo.categoria || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (proveedor && (proveedor.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()));
      var matchesProveedor = !selectedProveedorId || insumo.proveedorId === selectedProveedorId;
      var matchesCategory = !selectedCategory || insumo.categoria === selectedCategory;
      return matchesSearch && matchesProveedor && matchesCategory;
    }).sort(function(a, b){ return (a.nombre||'').localeCompare(b.nombre||''); });
  }, [insumos, proveedores, searchTerm, selectedProveedorId, selectedCategory]);

  var TABS = [
    { id: 'catalogo', label: 'Catálogo Firebase', icon: Database },
    { id: 'pedido-sheets', label: 'Pedido desde Drive', icon: ShoppingBag },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white shadow-lg z-30 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
                <Database className="w-5 h-5 text-white"/>
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight leading-none">InsumoMaster</h1>
                <span className="text-[9px] text-slate-400 font-medium uppercase tracking-[0.2em]">Rocoto Restaurantes</span>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-3">
              <button onClick={function(){ setIsUpdating(true); setTimeout(function(){ setIsUpdating(false); }, 800); }}
                disabled={isUpdating}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-800 transition-all text-slate-300 disabled:opacity-50">
                <RefreshCw className={cn("w-3.5 h-3.5", isUpdating && "animate-spin")}/>
                Sincronizar
              </button>
            </div>
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 pb-0 overflow-x-auto">
            {TABS.map(function(tab) {
              var Icon = tab.icon;
              var isActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={function(){ setActiveTab(tab.id); }}
                  className={'flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-all whitespace-nowrap border-b-2 ' +
                    (isActive ? 'text-white border-cyan-400 bg-slate-800/50' : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/30')}>
                  <Icon className="w-3.5 h-3.5"/>
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Catálogo Firebase */}
      {activeTab === 'catalogo' && (
        <>
          <div className="filters-bar">
            <Filters searchTerm={searchTerm} setSearchTerm={setSearchTerm}
              selectedProveedorId={selectedProveedorId} setSelectedProveedorId={setSelectedProveedorId}
              selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory}
              viewMode={viewMode} setViewMode={setViewMode}
              proveedores={proveedores} categories={categories}/>
          </div>
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Config OC */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <LayoutGrid className="w-4 h-4"/> Configuración de Orden de Compra
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Sede</label>
                  <select value={sede} onChange={function(e){ handleConfigChange('sede', e.target.value); }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500 transition-all">
                    <option value="">Seleccionar Sede...</option>
                    {sedes.map(function(s){ return <option key={s.id} value={s.nombre}>{s.nombre}</option>; })}
                    <option value="Otra">Otra (Manual)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Dirección de Entrega</label>
                  <input type="text" value={direccionEntrega} onChange={function(e){ handleConfigChange('direccion', e.target.value); }}
                    placeholder="Ej: Calle 45 # 22 - 18" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500 transition-all"/>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Horario de Recepción</label>
                  <input type="text" value={horarioRecepcion} onChange={function(e){ handleConfigChange('horario', e.target.value); }}
                    placeholder="Ej: 7:00 AM - 11:00 AM" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500 transition-all"/>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Responsable *</label>
                  <input type="text" value={responsable} onChange={function(e){ setResponsable(e.target.value); }}
                    placeholder="Tu nombre completo" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500 transition-all"/>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Notas del pedido</label>
                  <textarea value={notas} onChange={function(e){ setNotas(e.target.value); }} rows={1}
                    placeholder="Observaciones adicionales..." className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500 transition-all resize-none"/>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-[9px] text-slate-400 uppercase font-bold">Consecutivo Global</span>
                  <button onClick={async function() {
                    var val = prompt("Nuevo consecutivo (ej: 13):");
                    if (val !== null && !isNaN(parseInt(val))) {
                      await dbService.setGlobalConsecutive(parseInt(val));
                      alert("Actualizado.");
                    }
                  }} className="text-[9px] text-cyan-600 hover:underline font-bold">Ajustar</button>
                </div>
                <p className="text-[9px] text-slate-400 italic">Sincronizado vía Firebase</p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div><p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Proveedores Activos</p>
                  <h4 className="text-3xl font-bold text-slate-900 font-mono">{proveedores.length}</h4></div>
                <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center"><BarChart3 className="w-6 h-6"/></div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div><p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Insumos Registrados</p>
                  <h4 className="text-3xl font-bold text-slate-900 font-mono">{filteredInsumos.length}</h4></div>
                <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center"><Database className="w-6 h-6"/></div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div><p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Última Actualización</p>
                  <h4 className="text-lg font-bold text-slate-900">Hoy, {new Date().toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'})}</h4></div>
                <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center"><FileSpreadsheet className="w-6 h-6"/></div>
              </div>
            </div>

            {/* Lista */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <List className="w-4 h-4"/> Lista Detallada
                </h2>
                <div className="flex items-center gap-3">
                  <button onClick={async function() {
                    if (!responsable.trim()) { alert('Ingresa el responsable.'); return; }
                    var active = filteredInsumos.filter(function(i){ return (quantities[i.id]||0) > 0; });
                    if (!active.length) { alert('Agrega cantidades primero.'); return; }
                    var nextNumber = Math.floor(Date.now() / 1000);
                    try { nextNumber = await dbService.getNextGlobalConsecutive(); } catch(eN) { console.warn(eN); }
                    var fechaHoy = new Date().toISOString().split('T')[0];
                    for (var itm of active) {
                      var pvN = proveedores.find(function(pp){ return pp.id === itm.proveedorId; });
                      var pvNombre = pvN ? pvN.nombre : 'Varios';
                      try {
                        await appendPedido({fecha:fechaHoy,sede:sede||'',proveedor:pvNombre,articulo:itm.nombre,subArticulo:itm.categoria,cantidad:quantities[itm.id]||0,unidad:itm.unidad,responsable,correoResponsable:'',notas:notas||'',numeroOrden:nextNumber});
                      } catch(e) { console.warn(e); }
                    }
                    var items = active.map(function(i){ return { nombre: i.nombre, categoria: i.categoria, cantidad: quantities[i.id]||0, unidad: i.unidad, precio: i.precio }; });
                    var provSel = selectedProveedorId ? proveedores.find(function(p){ return p.id === selectedProveedorId; }) : null;
                    generarPDFOrdenCompra({ items, proveedor: provSel || 'Varios', sede, direccion: direccionEntrega, horario: horarioRecepcion, responsable, notas, numeroOrden: nextNumber, proveedores });
                  }}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1.5 transition-colors">
                    <Download className="w-3.5 h-3.5"/> Descargar PDF
                  </button>
                  <button className="text-xs font-semibold text-cyan-600 hover:text-cyan-700 flex items-center gap-1.5 transition-colors">
                    <Download className="w-3.5 h-3.5"/> Exportar CSV
                  </button>
                </div>
              </div>
              <InsumoTable insumos={filteredInsumos} proveedores={proveedores} quantities={quantities} onQuantityChange={handleQuantityChange}/>
              {filteredInsumos.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6"><Database className="w-10 h-10 text-slate-300"/></div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">No se encontraron resultados</h3>
                  <p className="text-slate-500 max-w-sm">Intenta ajustar los filtros.</p>
                  <button onClick={function(){ setSearchTerm(''); setSelectedProveedorId(''); setSelectedCategory(''); }}
                    className="mt-6 px-6 py-2 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 transition-all">
                    Limpiar filtros
                  </button>
                </div>
              )}
            </div>
          </main>
        </>
      )}

      {activeTab === 'pedido-sheets' && (
        <div className="flex-1"><SheetsOrderForm/></div>
      )}

      <footer className="bg-white border-t border-slate-200 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-xs text-slate-400 font-medium tracking-wide uppercase">
            InsumoMaster &bull; Rocoto Restaurantes &bull; {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
