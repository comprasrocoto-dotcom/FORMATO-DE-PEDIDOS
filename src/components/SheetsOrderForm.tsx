// @ts-nocheck
/**
 * SheetsOrderForm.tsx
 * Formulario de pedido conectado a Google Sheets.
 * PDF usando string concatenation (sin template literals) para evitar crash de html2canvas.
 */

import { useState, useEffect } from 'react';
import { ShoppingCart, Building2, User, Truck, RefreshCw, Save, Download, AlertCircle, CheckCircle, Search } from 'lucide-react';
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

// Types
interface LineItem {
  codigo: string;
  articulo: string;
  subArticulo: string;
  cantidad: number;
}

// PDF Generator - uses string concatenation to avoid html2canvas crash with template literals
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
  const fmt = function(n) { return '$' + Number(n || 0).toLocaleString('es-CO'); };

  const activeLineas = lineas.filter(function(l) { return l.cantidad > 0; });

  // Build item rows using array join (no template literals)
  var itemRowsArr = activeLineas.map(function(l, idx) {
    return '<tr>' +
      '<td style="border:1px solid #bbb;padding:5px 7px;text-align:center;font-size:10px;">' + (idx + 1) + '</td>' +
      '<td style="border:1px solid #bbb;padding:5px 7px;font-size:10px;">' + (l.articulo || '') + (l.subArticulo ? ' - ' + l.subArticulo : '') + '</td>' +
      '<td style="border:1px solid #bbb;padding:5px 7px;text-align:center;font-size:10px;">' + (l.cantidad || 0) + '</td>' +
      '<td style="border:1px solid #bbb;padding:5px 7px;text-align:right;font-size:10px;">$0.00</td>' +
      '<td style="border:1px solid #bbb;padding:5px 7px;text-align:right;font-size:10px;">$0.00</td>' +
    '</tr>';
  });

  // Empty rows to fill up to 16
  var emptyCount = Math.max(0, 16 - activeLineas.length);
  var emptyRowsArr = [];
  for (var ei = 0; ei < emptyCount; ei++) {
    emptyRowsArr.push(
      '<tr>' +
        '<td style="border:1px solid #bbb;padding:5px 7px;text-align:center;font-size:10px;">' + (activeLineas.length + ei + 1) + '</td>' +
        '<td style="border:1px solid #bbb;padding:14px 7px;font-size:10px;">&nbsp;</td>' +
        '<td style="border:1px solid #bbb;padding:5px 7px;font-size:10px;">&nbsp;</td>' +
        '<td style="border:1px solid #bbb;padding:5px 7px;font-size:10px;">&nbsp;</td>' +
        '<td style="border:1px solid #bbb;padding:5px 7px;font-size:10px;">&nbsp;</td>' +
      '</tr>'
    );
  }

  var provName = proveedor ? (proveedor.nombre || proveedorSheetName) : proveedorSheetName;
  var provTel = proveedor ? (proveedor.telefono || '—') : '—';
  var provEmail = proveedor ? (proveedor.correo || '—') : '—';
  var provAsesor = proveedor ? (proveedor.asesor || '—') : '—';
  var sedeName = sede ? (sede.nombre || '—') : '—';
  var sedeDir = sede ? (sede.direccion || '—') : '—';
  var sedeTel = sede ? (sede.telefono || '—') : '—';
  var sedeHora = sede ? (sede.horaEntrega || '—') : '—';

  var html = '<!DOCTYPE html><html><head><meta charset="utf-8"/><style>' +
    'body{font-family:Arial,sans-serif;font-size:11px;color:#222;margin:0;padding:0;}' +
    '.page{padding:28px 32px;}' +
    '.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;}' +
    '.title{font-size:26px;font-weight:900;color:#111;margin:0;}' +
    '.co-info{text-align:right;font-size:9.5px;line-height:1.8;color:#555;}' +
    '.meta{display:flex;gap:36px;border-bottom:1px solid #ddd;padding-bottom:10px;margin-bottom:14px;}' +
    '.meta .lbl{font-weight:700;}' +
    '.parties{display:flex;gap:12px;margin-bottom:14px;}' +
    '.pbox{flex:1;border:1px solid #bbb;border-radius:1px;}' +
    '.pbox-hdr{background:#2d3f6b;color:white;font-weight:700;font-size:10px;padding:5px 9px;text-transform:uppercase;letter-spacing:.5px;}' +
    '.pbox-body{padding:7px 9px;line-height:1.9;font-size:9.5px;}' +
    '.sec-hdr{background:#2d3f6b;color:white;padding:6px 9px;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.5px;}' +
    'table.pt{width:100%;border-collapse:collapse;}' +
    'table.pt th{background:#dde4f0;color:#2d3f6b;border:1px solid #bbb;padding:6px 7px;font-size:9.5px;font-weight:700;text-transform:uppercase;text-align:center;}' +
    'table.pt th.tl{text-align:left;}' +
    '.totrow{display:flex;justify-content:flex-end;margin-top:2px;}' +
    'table.tt{border-collapse:collapse;width:240px;}' +
    'table.tt td{border:1px solid #bbb;padding:4px 9px;font-size:10px;}' +
    '.ttlbl{text-align:right;font-weight:700;text-transform:uppercase;background:#f0f0f0;}' +
    '.tval{text-align:right;}' +
    '.grand td{background:#2d3f6b;color:white;font-weight:900;font-size:12px;}' +
    '.cmts{border:1px solid #bbb;margin-top:10px;}' +
    '.cmts-hdr{background:#2d3f6b;color:white;padding:5px 9px;font-weight:700;font-size:10px;text-transform:uppercase;}' +
    '.cmts-body{padding:9px;min-height:44px;font-size:9.5px;line-height:1.5;}' +
    '</style></head><body><div class="page">' +

    '<div class="hdr">' +
    '<h1 class="title">Orden de compra</h1>' +
    '<div class="co-info">' +
    '<strong>Rocoto Restaurantes</strong><br/>' +
    'Dir: ' + sedeDir + '<br/>' +
    'Tel: (604) 987 6543<br/>' +
    'Email: comprasrocoto@gmail.com' +
    '</div>' +
    '</div>' +

    '<div class="meta">' +
    '<span><span class="lbl">N. de orden de compra: </span>OC-' + numeroOrden + '</span>' +
    '<span><span class="lbl">Fecha: </span>' + fecha + '</span>' +
    '</div>' +

    '<div class="parties">' +
    '<div class="pbox">' +
    '<div class="pbox-hdr">Vendedor</div>' +
    '<div class="pbox-body">' +
    '<strong>' + provName + '</strong><br/>' +
    'Asesor: ' + provAsesor + '<br/>' +
    'Tel: ' + provTel + '<br/>' +
    'Email: ' + provEmail +
    '</div>' +
    '</div>' +
    '<div class="pbox">' +
    '<div class="pbox-hdr">Cliente</div>' +
    '<div class="pbox-body">' +
    '<strong>Rocoto Restaurantes</strong><br/>' +
    'Sede: ' + sedeName + '<br/>' +
    'Dir: ' + sedeDir + '<br/>' +
    'Horario: ' + sedeHora + '<br/>' +
    'Responsable: ' + responsable +
    '</div>' +
    '</div>' +
    '</div>' +

    '<div class="sec-hdr">Producto o Servicio</div>' +
    '<table class="pt"><thead><tr>' +
    '<th style="width:5%;">N.</th>' +
    '<th class="tl" style="width:50%;">Descripcion</th>' +
    '<th style="width:15%;">Cantidad</th>' +
    '<th style="width:15%;">Precio unitario</th>' +
    '<th style="width:15%;">Total</th>' +
    '</tr></thead><tbody>' +
    itemRowsArr.join('') +
    emptyRowsArr.join('') +
    '</tbody></table>' +

    '<div class="totrow"><table class="tt">' +
    '<tr><td class="ttlbl">Subtotal</td><td class="tval">$0.00</td></tr>' +
    '<tr><td class="ttlbl">Impuesto</td><td class="tval">0 %</td></tr>' +
    '<tr><td class="ttlbl">Envio</td><td class="tval">$0.00</td></tr>' +
    '<tr class="grand"><td class="ttlbl" style="color:white;">Total</td><td class="tval">$0.00</td></tr>' +
    '</table></div>' +

    '<div class="cmts">' +
    '<div class="cmts-hdr">Comentarios o instrucciones especiales</div>' +
    '<div class="cmts-body">' + (notas || 'Sin comentarios.') + '<br/>' +
    'Solicitado por: ' + responsable + ' | Sede: ' + sedeName + ' | Horario: ' + sedeHora +
    '</div>' +
    '</div>' +

    '</div></body></html>';

  var opt = {
    margin: [8, 8, 8, 8],
    filename: 'OC-' + numeroOrden + '_' + provName.substring(0, 20) + '_' + fechaHoy + '.pdf',
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      onclone: function(clonedDoc) {
        var styles = clonedDoc.getElementsByTagName('style');
        for (var s = 0; s < styles.length; s++) {
          if (styles[s].innerHTML.includes('oklch')) {
            styles[s].innerHTML = styles[s].innerHTML.replace(/oklch\([^)]+\)/g, '#ccc');
          }
        }
      }
    },
    jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
  };

  html2pdf().set(opt).from(html).save();
}

// Component
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

      // Get order number with Firebase fallback
      var numeroOrden = Math.floor(Date.now() / 1000);
      try {
        var n2 = await dbService.getNextGlobalConsecutive();
        if (n2) numeroOrden = n2;
      } catch(eN) {
        console.warn('[Firebase] getNextGlobalConsecutive failed, using timestamp:', eN);
      }

      // Save to Google Sheets
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

      // Firebase save (optional, may fail)
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

      // Generate PDF after React finishes state updates (avoids DOM conflict)
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
    </div>
  );
}
