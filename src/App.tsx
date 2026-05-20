// @ts-nocheck
/**
 * App.tsx - InsumoMaster v4
 * Tabs: Pedido desde Drive | Catálogo Firebase
 * Ventas y Cotizaciones eliminados por instrucción del usuario
 */
import { useState, useMemo, useEffect } from 'react';
import { Database, FileSpreadsheet, Download, RefreshCw, BarChart3, List,
  LayoutGrid, ShoppingBag, Search } from 'lucide-react';
import { INSUMOS, PROVEEDORES, SEDES } from './data/mockData';
import { Insumo, Proveedor } from './types';
import Filters from './components/Filters';
import InsumoTable from './components/InsumoTable';
import ProveedorCard from './components/ProveedorCard';
import SheetsOrderForm from './components/SheetsOrderForm';
import { cn } from './lib/utils';
import { dbService, Sede } from './services/db';
import { getSedes as getSheetsSedesRaw, getProveedores as getSheetsProveedores,
  getAllDatos, appendPedido } from './services/googleSheets';
// @ts-ignore
import html2pdf from 'html2pdf.js';

function fmt(n) { return '$' + Number(n || 0).toLocaleString('es-CO'); }

function generarPDFOrdenCompra({ items, proveedor, sede, direccion, horario, responsable, notas, numeroOrden, proveedores }) {
  var fecha = new Date().toLocaleDateString('es-CO', { year:'numeric', month:'long', day:'numeric' });
  var fechaHoy = new Date().toISOString().slice(0, 10);
  var provObj = proveedores ? proveedores.find(function(p){ return p.id === (proveedor && proveedor.id) || p.nombre === proveedor; }) : null;
  var provNombre = (provObj && provObj.nombre) || (typeof proveedor === 'string' ? proveedor : 'Varios');
  var provTel = (provObj && provObj.telefono) || '—';
  var subtotal = items.reduce(function(a, i){ return a + ((i.precio || 0) * (i.cantidad || 0)); }, 0);
  var itemRowsArr = items.map(function(i, idx) {
    var bg = idx % 2 === 0 ? '#ffffff' : '#f4f7fc';
    var tot = (i.precio || 0) * (i.cantidad || 0);
    return '<tr style="background:' + bg + ';">' +
      '<td style="border:1px solid #dde3ee;padding:9px;text-align:center;font-size:10px;">' + (idx+1) + '</td>' +
      '<td style="border:1px solid #dde3ee;padding:9px 12px;font-size:11px;font-weight:600;">' + (i.nombre || i.articulo || '') + '</td>' +
      '<td style="border:1px solid #dde3ee;padding:9px;text-align:center;font-size:11px;font-weight:800;color:#1a3c6e;">' + (i.cantidad || 0) + ' ' + (i.unidad || '') + '</td>' +
      '<td style="border:1px solid #dde3ee;padding:9px;text-align:right;font-size:11px;">' + fmt(i.precio || 0) + '</td>' +
      '<td style="border:1px solid #dde3ee;padding:9px;text-align:right;font-size:11px;font-weight:700;color:#1a3c6e;">' + fmt(tot) + '</td>' +
      '</tr>';
  });
  var eCount = Math.max(0, 10 - items.length);
  var emptyRows = [];
  for (var ei = 0; ei < eCount; ei++) {
    var ebg = (items.length + ei) % 2 === 0 ? '#ffffff' : '#f4f7fc';
    emptyRows.push('<tr style="background:' + ebg + ';"><td style="border:1px solid #dde3ee;padding:13px;color:#ddd;text-align:center;">' + (items.length+ei+1) + '</td><td style="border:1px solid #dde3ee;padding:13px;">&nbsp;</td><td style="border:1px solid #dde3ee;padding:13px;"></td><td style="border:1px solid #dde3ee;padding:13px;"></td><td style="border:1px solid #dde3ee;padding:13px;"></td></tr>');
  }
  var css = 'body{font-family:Arial,sans-serif;font-size:12px;margin:0;padding:0;}' +
    '.page{padding:28px 32px;}.top-band{background:#1a3c6e;height:7px;margin:-28px -32px 22px -32px;}' +
    '.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;padding-bottom:14px;border-bottom:2px solid #e8ecf4;}' +
    '.logo-box{width:50px;height:50px;background:#1a3c6e;border-radius:10px;display:flex;align-items:center;justify-content:center;color:white;font-size:22px;font-weight:900;float:left;margin-right:12px;}' +
    '.brand-name{font-size:20px;font-weight:900;color:#1a3c6e;}' +
    '.oc-badge{background:#1a3c6e;color:white;border-radius:10px;padding:10px 18px;text-align:right;}' +
    '.info-band{background:#f0f4fb;border:1px solid #ccd6ed;border-radius:8px;padding:9px 16px;display:flex;gap:28px;margin-bottom:16px;}' +
    '.info-lbl{font-size:8px;text-transform:uppercase;letter-spacing:1px;color:#8899bb;font-weight:700;}' +
    '.info-val{font-size:11px;font-weight:800;color:#1a3c6e;margin-top:1px;}' +
    '.prov-box{border:1px solid #ccd6ed;border-radius:8px;overflow:hidden;margin-bottom:16px;max-width:380px;}' +
    '.prov-hdr{background:#1a3c6e;color:white;font-weight:700;font-size:9px;padding:6px 12px;text-transform:uppercase;}' +
    '.prov-body{padding:10px 12px;background:#fafbfd;}' +
    '.prov-name{font-weight:800;font-size:13px;color:#1a3c6e;}' +
    '.prod-hdr{background:#1a3c6e;color:white;padding:8px 12px;font-weight:700;font-size:9px;text-transform:uppercase;border-radius:6px 6px 0 0;}' +
    'table.pt{width:100%;border-collapse:collapse;border:1px solid #dde3ee;}' +
    'table.pt th{background:#e6ebf5;color:#1a3c6e;border:1px solid #dde3ee;padding:8px 10px;font-size:9px;font-weight:800;text-transform:uppercase;}' +
    '.totals-wrap{display:flex;justify-content:flex-end;margin-top:10px;}' +
    'table.tt{border-collapse:collapse;width:240px;border:1px solid #dde3ee;}' +
    'table.tt td{border:1px solid #dde3ee;padding:6px 12px;font-size:11px;}' +
    '.ttlbl{text-align:right;font-weight:700;background:#f0f4fb;color:#555;text-transform:uppercase;font-size:9px;}' +
    '.tval{text-align:right;font-weight:600;}' +
    '.grand td{background:#1a3c6e!important;color:white!important;font-weight:900;font-size:12px;}' +
    '.obs-box{border:1px solid #dde3ee;margin-top:16px;border-radius:6px;overflow:hidden;}' +
    '.obs-hdr{background:#f0f4fb;color:#1a3c6e;padding:6px 12px;font-weight:800;font-size:9px;text-transform:uppercase;border-bottom:1px solid #dde3ee;}' +
    '.obs-body{padding:12px;min-height:44px;font-size:11px;line-height:1.7;color:#444;}' +
    '.footer{margin-top:16px;padding-top:10px;border-top:1px solid #e8ecf4;display:flex;justify-content:space-between;}' +
    '.footer-l,.footer-r{font-size:8.5px;color:#bbb;}';
  var html = '<!DOCTYPE html><html><head><meta charset="utf-8"/><style>' + css + '</style></head><body><div class="page">';
  html += '<div class="top-band"></div>';
  html += '<div class="hdr"><div style="display:flex;align-items:center;"><div class="logo-box">R</div><div><div class="brand-name">Rocoto Restaurantes</div><div style="font-size:9px;color:#9baac5;text-transform:uppercase;letter-spacing:1.5px;">Sistema de Compras</div></div></div>';
  html += '<div class="oc-badge"><div style="font-size:8px;text-transform:uppercase;letter-spacing:2px;color:#a8c0e8;font-weight:700;">Orden de Compra</div><div style="font-size:20px;font-weight:900;">OC-' + numeroOrden + '</div><div style="font-size:9px;color:#a8c0e8;">' + fecha + '</div></div></div>';
  html += '<div class="info-band"><div><span class="info-lbl">N&deg; Orden</span><span class="info-val">OC-' + numeroOrden + '</span></div><div><span class="info-lbl">Sede</span><span class="info-val">' + (sede || '—') + '</span></div><div><span class="info-lbl">Direcci&oacute;n</span><span class="info-val">' + (direccion || '—') + '</span></div><div><span class="info-lbl">Horario</span><span class="info-val">' + (horario || '—') + '</span></div></div>';
  html += '<div class="prov-box"><div class="prov-hdr">&#128666; Proveedor</div><div class="prov-body"><div class="prov-name">' + provNombre + '</div><div style="font-size:10.5px;color:#555;">Tel: ' + provTel + '</div></div></div>';
  html += '<div class="prod-hdr">&#128230; Art&iacute;culos Solicitados</div>';
  html += '<table class="pt"><thead><tr><th style="width:5%;text-align:center;">N.</th><th style="width:50%;text-align:left;">Descripci&oacute;n</th><th style="width:15%;text-align:center;">Cantidad</th><th style="width:15%;text-align:right;">Precio</th><th style="width:15%;text-align:right;">Total</th></tr></thead><tbody>' + itemRowsArr.join('') + emptyRows.join('') + '</tbody></table>';
  html += '<div class="totals-wrap"><table class="tt"><tr><td class="ttlbl">Subtotal</td><td class="tval">' + fmt(subtotal) + '</td></tr><tr class="grand"><td class="ttlbl">TOTAL</td><td class="tval">' + fmt(subtotal) + '</td></tr></table></div>';
  html += '<div class="obs-box"><div class="obs-hdr">&#128221; Observaciones</div><div class="obs-body">' + (notas || 'Sin observaciones.') + (responsable ? '<br/><span style="font-size:9px;color:#aaa;">Solicitado por: ' + responsable + '</span>' : '') + '</div></div>';
  html += '<div class="footer"><div class="footer-l">Rocoto Restaurantes &bull; comprasrocoto@gmail.com</div><div class="footer-r">OC-' + numeroOrden + ' &bull; P&aacute;g. 1</div></div></div></body></html>';
  var slug = provNombre.replace(/[^A-Za-z0-9]/g, '_').substring(0, 18);
  var opt = {
    margin: [8,8,8,8], filename: 'OC-' + numeroOrden + '_' + slug + '_' + fechaHoy + '.pdf',
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
  container.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:816px;z-index:-1;pointer-events:none;';
  container.innerHTML = html;
  document.body.appendChild(container);
  html2pdf().set(opt).from(container).save().finally(function(){ document.body.removeChild(container); });
}

export default function App() {
  var [insumos, setInsumos] = useState([]);
  var [activeTab, setActiveTab] = useState('pedido-sheets');
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

  useEffect(function() { dbService.initializeIfEmpty(INSUMOS, PROVEEDORES, SEDES); }, []);

  useEffect(function() {
    var unsubInsumos = dbService.subscribeToInsumos(setInsumos);
    var unsubProveedores = dbService.subscribeToProveedores(setProveedores);
    var unsubSedes = dbService.subscribeToSedes(setSedes);
    getSheetsSedesRaw().then(function(ss) {
      if (ss && ss.length > 0) setSedes(ss.map(function(s, i){ return { id: 'ss-'+i, nombre: s.nombre, direccion: s.direccion||'', horario: s.horaEntrega||'' }; }));
    }).catch(function(e){ console.warn('sedes:', e); });
    getSheetsProveedores().then(function(sp) {
      if (sp && sp.length > 0) setProveedores(sp.map(function(p){ return { id: 'sp-'+p.nombre, nombre: p.nombre, contacto: p.asesor||'', email: p.correo||'', telefono: p.telefono||'', activo: true, categoria: '' }; }));
    }).catch(function(e){ console.warn('provs:', e); });
    return function() { unsubInsumos(); unsubProveedores(); unsubSedes(); };
  }, []);

  useEffect(function() {
    (async function() {
      try {
        var datos = await getAllDatos();
        var artPorProv = datos.articulosPorProveedor || {};
        var today = new Date().toISOString();
        var allInsumos = [];
        Object.keys(artPorProv).forEach(function(sheetName) {
          (artPorProv[sheetName] || []).forEach(function(p, idx) {
            var art = (p.articulo || '').toLowerCase().trim();
            var cod = (p.codigo || '').toLowerCase().trim();
            if (!art && !cod) return;
            if (cod === 'proveedor' || cod.indexOf('barras') !== -1 || cod.indexOf('total') !== -1) return;
            if (art === 'articulo' || art === 'art\u00edculo' || art.indexOf('total') !== -1) return;
            allInsumos.push({
              id: sheetName + '-' + idx,
              nombre: p.subArticulo || p.articulo || '',
              categoria: p.articulo || sheetName,
              codigo: p.codigo || '',
              unidad: 'UND',
              precio: 0,
              proveedorId: 'sp-' + (p.articulo || sheetName),
              actualizadoAt: today,
            });
          });
        });
        if (allInsumos.length > 0) setInsumos(allInsumos);
      } catch(err) { console.warn('insumos:', err); }
    })();
  }, []);

  var handleConfigChange = function(field, value) {
    if (field === 'sede') {
      setSede(value); localStorage.setItem('order_config_sede', value);
      var fs = sedes.find(function(s){ return s.nombre === value; });
      if (fs) {
        setDireccionEntrega(fs.direccion); localStorage.setItem('order_config_direccion', fs.direccion);
        setHorarioRecepcion(fs.horario); localStorage.setItem('order_config_horario', fs.horario);
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
      var prov = proveedores.find(function(p){ return p.id === insumo.proveedorId; });
      var mSearch = !searchTerm ||
        (insumo.nombre||'').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (insumo.categoria||'').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (prov && (prov.nombre||'').toLowerCase().includes(searchTerm.toLowerCase()));
      var mProv = !selectedProveedorId || insumo.proveedorId === selectedProveedorId;
      var mCat = !selectedCategory || insumo.categoria === selectedCategory;
      return mSearch && mProv && mCat;
    }).sort(function(a, b){ return (a.nombre||'').localeCompare(b.nombre||''); });
  }, [insumos, proveedores, searchTerm, selectedProveedorId, selectedCategory]);

  var TABS = [
    { id: 'pedido-sheets', label: 'Pedido desde Drive', icon: ShoppingBag },
    { id: 'catalogo', label: 'Cat\u00e1logo Firebase', icon: Database },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-slate-900 text-white shadow-lg z-30 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
                <Database className="w-5 h-5 text-white"/>
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight leading-none">InsumoMaster</h1>
                <span className="text-[9px] text-slate-400 font-medium uppercase tracking-[0.2em]">Restaurantes Rocoto</span>
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

      {activeTab === 'pedido-sheets' && (
        <div className="flex-1"><SheetsOrderForm/></div>
      )}

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
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <LayoutGrid className="w-4 h-4"/> Configuraci\u00f3n de Orden de Compra
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Sede</label>
                  <select value={sede} onChange={function(e){ handleConfigChange('sede', e.target.value); }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500">
                    <option value="">Seleccionar Sede...</option>
                    {sedes.map(function(s){ return <option key={s.id} value={s.nombre}>{s.nombre}</option>; })}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Direcci\u00f3n de Entrega</label>
                  <input type="text" value={direccionEntrega} onChange={function(e){ handleConfigChange('direccion', e.target.value); }}
                    placeholder="Ej: Calle 45 # 22-18" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"/>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Horario de Recepci\u00f3n</label>
                  <input type="text" value={horarioRecepcion} onChange={function(e){ handleConfigChange('horario', e.target.value); }}
                    placeholder="Ej: 7:00 AM - 11:00 AM" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"/>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Responsable *</label>
                  <input type="text" value={responsable} onChange={function(e){ setResponsable(e.target.value); }}
                    placeholder="Tu nombre completo" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"/>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Notas del pedido</label>
                  <textarea value={notas} onChange={function(e){ setNotas(e.target.value); }} rows={1}
                    placeholder="Observaciones adicionales..." className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm resize-none"/>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div><p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Proveedores</p>
                <h4 className="text-3xl font-bold text-slate-900">{proveedores.length}</h4></div>
                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center"><BarChart3 className="w-6 h-6 text-blue-500"/></div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div><p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Insumos</p>
                <h4 className="text-3xl font-bold text-slate-900">{filteredInsumos.length}</h4></div>
                <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center"><Database className="w-6 h-6 text-emerald-500"/></div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div><p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">\u00daltima Actualizaci\u00f3n</p>
                <h4 className="text-lg font-bold text-slate-900">Hoy</h4></div>
                <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center"><FileSpreadsheet className="w-6 h-6 text-amber-500"/></div>
              </div>
            </div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <List className="w-4 h-4"/> Lista Detallada
              </h2>
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
                    await appendPedido({fecha:fechaHoy,sede:sede||'',proveedor:pvNombre,articulo:itm.nombre,subArticulo:itm.categoria,cantidad:quantities[itm.id]||0,unidad:itm.unidad,responsable:responsable,correoResponsable:'',notas:notas||'',numeroOrden:nextNumber});
                  } catch(e) { console.warn(e); }
                }
                var items = active.map(function(i){ return { nombre: i.nombre, cantidad: quantities[i.id]||0, unidad: i.unidad, precio: i.precio || 0 }; });
                var provSel = selectedProveedorId ? proveedores.find(function(p){ return p.id === selectedProveedorId; }) : null;
                generarPDFOrdenCompra({ items: items, proveedor: provSel || 'Varios', sede: sede, direccion: direccionEntrega, horario: horarioRecepcion, responsable: responsable, notas: notas, numeroOrden: nextNumber, proveedores: proveedores });
              }}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5"/> Descargar PDF
              </button>
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
          </main>
        </>
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
