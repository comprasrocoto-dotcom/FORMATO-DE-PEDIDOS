// @ts-nocheck
/**
 * SheetsOrderForm.tsx
 * Formulario de pedido conectado a Google Sheets.
 * Lee proveedores y sedes desde Sheets y registra el pedido en Firebase + Sheets.
 */

import { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, Building2, User, Truck, RefreshCw, Save, Download, AlertCircle, CheckCircle, ChevronDown, ChevronUp, Search } from 'lucide-react';
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

// âââ Types âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
interface LineItem {
    codigo: string;
    articulo: string;
    subArticulo: string;
    cantidad: number;
}

// âââ PDF Generator âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
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
    const hora = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

  const filas = lineas
      .filter(l => l.cantidad > 0)
      .map(l => `
            <tr>
                    <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;">${l.codigo}</td>
                            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${l.articulo}</td>
                                    <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${l.subArticulo}</td>
                                            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:700;font-size:16px;">${l.cantidad}</td>
                                                  </tr>
                                                      `).join('');

  const html = `<!DOCTYPE html>
  <html lang="es">
  <head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Roboto', Arial, sans-serif; font-size: 11px; color: #1a202c; background: white; }
          .page { padding: 40px 50px; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #c53030; }
              .brand { display: flex; flex-direction: column; }
                .brand-name { font-size: 28px; font-weight: 900; color: #c53030; letter-spacing: -1px; }
                  .brand-sub { font-size: 10px; color: #718096; text-transform: uppercase; letter-spacing: 2px; font-weight: 500; }
                    .order-badge { background: #c53030; color: white; padding: 10px 20px; border-radius: 8px; text-align: right; }
                      .order-badge .label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8; }
                        .order-badge .number { font-size: 22px; font-weight: 900; letter-spacing: -1px; }
                          .order-badge .date { font-size: 10px; opacity: 0.9; margin-top: 2px; }
                            .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; }
                              .info-box { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
                                .info-box-header { background: #2d3748; color: white; padding: 8px 14px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; gap: 6px; }
                                  .info-box-body { padding: 14px; }
                                    .info-row { display: flex; gap: 8px; margin-bottom: 5px; }
                                      .info-label { font-weight: 700; color: #4a5568; min-width: 80px; font-size: 10px; text-transform: uppercase; }
                                        .info-value { color: #1a202c; font-size: 11px; }
                                          .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                                            .items-table thead tr { background: #2d3748; color: white; }
                                              .items-table th { padding: 10px 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }
                                                .items-table th:last-child { text-align: center; }
                                                  .items-table tbody tr:nth-child(even) { background: #f7fafc; }
                                                    .footer { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
                                                      .notes-box { flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
                                                        .notes-header { background: #f7fafc; padding: 8px 14px; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #4a5568; border-bottom: 1px solid #e2e8f0; }
                                                          .notes-body { padding: 12px 14px; min-height: 60px; font-size: 11px; color: #4a5568; line-height: 1.5; }
                                                            .signature-box { width: 220px; text-align: center; }
                                                              .signature-line { border-bottom: 2px solid #2d3748; margin-bottom: 6px; height: 40px; }
                                                                .signature-name { font-weight: 700; font-size: 12px; color: #1a202c; }
                                                                  .signature-role { font-size: 10px; color: #718096; text-transform: uppercase; letter-spacing: 0.5px; }
                                                                    .signature-email { font-size: 9px; color: #a0aec0; margin-top: 2px; }
                                                                      .count-badge { display: inline-block; background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 2px 8px; font-size: 10px; color: #4a5568; margin-left: 8px; }
                                                                      </style>
                                                                      </head>
                                                                      <body>
                                                                      <div class="page">
                                                                        <div class="header">
                                                                            <div class="brand">
                                                                                  <div class="brand-name">ROCOTO</div>
                                                                                        <div class="brand-sub">Orden de Compra</div>
                                                                                              <div style="margin-top:8px;font-size:10px;color:#718096;">Generado: ${fecha} ${hora}</div>
                                                                                                  </div>
                                                                                                      <div class="order-badge">
                                                                                                            <div class="label">NÂ° Orden</div>
                                                                                                                  <div class="number">OC-${numeroOrden}</div>
                                                                                                                        <div class="date">${fecha}</div>
                                                                                                                            </div>
                                                                                                                              </div>
                                                                                                                              
                                                                                                                                <div class="two-col">
                                                                                                                                    <div class="info-box">
                                                                                                                                          <div class="info-box-header">
                                                                                                                                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>
                                                                                                                                                          Datos del Proveedor
                                                                                                                                                                </div>
                                                                                                                                                                      <div class="info-box-body">
                                                                                                                                                                              <div class="info-row"><span class="info-label">Empresa:</span><span class="info-value">${proveedor?.nombre || proveedorSheetName}</span></div>
                                                                                                                                                                                      <div class="info-row"><span class="info-label">TelÃ©fono:</span><span class="info-value">${proveedor?.telefono || 'â'}</span></div>
                                                                                                                                                                                              <div class="info-row"><span class="info-label">Correo:</span><span class="info-value">${proveedor?.correo || 'â'}</span></div>
                                                                                                                                                                                                      <div class="info-row"><span class="info-label">Asesor:</span><span class="info-value">${proveedor?.asesor || 'â'}</span></div>
                                                                                                                                                                                                              <div class="info-row"><span class="info-label">Pago:</span><span class="info-value">${proveedor?.medioPago || 'â'}</span></div>
                                                                                                                                                                                                                    </div>
                                                                                                                                                                                                                        </div>
                                                                                                                                                                                                                            <div class="info-box">
                                                                                                                                                                                                                                  <div class="info-box-header">
                                                                                                                                                                                                                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                                                                                                                                                                                                                                  Sede de Entrega
                                                                                                                                                                                                                                                        </div>
                                                                                                                                                                                                                                                              <div class="info-box-body">
                                                                                                                                                                                                                                                                      <div class="info-row"><span class="info-label">Sede:</span><span class="info-value">${sede?.nombre || 'â'}</span></div>
                                                                                                                                                                                                                                                                              <div class="info-row"><span class="info-label">DirecciÃ³n:</span><span class="info-value">${sede?.direccion || 'â'}</span></div>
                                                                                                                                                                                                                                                                                      <div class="info-row"><span class="info-label">TelÃ©fono:</span><span class="info-value">${sede?.telefono || 'â'}</span></div>
                                                                                                                                                                                                                                                                                              <div class="info-row"><span class="info-label">Horario:</span><span class="info-value">${sede?.horaEntrega || 'â'}</span></div>
                                                                                                                                                                                                                                                                                                      <div class="info-row"><span class="info-label">Responsable:</span><span class="info-value">${responsable}</span></div>
                                                                                                                                                                                                                                                                                                            </div>
                                                                                                                                                                                                                                                                                                                </div>
                                                                                                                                                                                                                                                                                                                  </div>
                                                                                                                                                                                                                                                                                                                  
                                                                                                                                                                                                                                                                                                                    <table class="items-table">
                                                                                                                                                                                                                                                                                                                        <thead>
                                                                                                                                                                                                                                                                                                                              <tr>
                                                                                                                                                                                                                                                                                                                                      <th style="width:12%;">CÃ³digo</th>
                                                                                                                                                                                                                                                                                                                                              <th style="width:40%;">ArtÃ­culo</th>
                                                                                                                                                                                                                                                                                                                                                      <th style="width:30%;">SubArtÃ­culo / PresentaciÃ³n</th>
                                                                                                                                                                                                                                                                                                                                                              <th style="width:18%;text-align:center;">Cantidad<span class="count-badge">${lineas.filter(l => l.cantidad > 0).length} Ã­tem(s)</span></th>
                                                                                                                                                                                                                                                                                                                                                                    </tr>
                                                                                                                                                                                                                                                                                                                                                                        </thead>
                                                                                                                                                                                                                                                                                                                                                                            <tbody>
                                                                                                                                                                                                                                                                                                                                                                                  ${filas}
                                                                                                                                                                                                                                                                                                                                                                                        ${Array(Math.max(0, 3 - lineas.filter(l => l.cantidad > 0).length)).fill('<tr><td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">&nbsp;</td><td style="border-bottom:1px solid #e2e8f0;"></td><td style="border-bottom:1px solid #e2e8f0;"></td><td style="border-bottom:1px solid #e2e8f0;"></td></tr>').join('')}
                                                                                                                                                                                                                                                                                                                                                                                            </tbody>
                                                                                                                                                                                                                                                                                                                                                                                              </table>
                                                                                                                                                                                                                                                                                                                                                                                              
                                                                                                                                                                                                                                                                                                                                                                                                <div class="footer">
                                                                                                                                                                                                                                                                                                                                                                                                    <div class="notes-box">
                                                                                                                                                                                                                                                                                                                                                                                                          <div class="notes-header">Observaciones / Instrucciones Especiales</div>
                                                                                                                                                                                                                                                                                                                                                                                                                <div class="notes-body">${notas || 'Sin observaciones adicionales.'}</div>
                                                                                                                                                                                                                                                                                                                                                                                                                    </div>
                                                                                                                                                                                                                                                                                                                                                                                                                        <div class="signature-box">
                                                                                                                                                                                                                                                                                                                                                                                                                              <div class="signature-line"></div>
                                                                                                                                                                                                                                                                                                                                                                                                                                    <div class="signature-name">${responsable}</div>
                                                                                                                                                                                                                                                                                                                                                                                                                                          <div class="signature-role">ElaborÃ³ el Pedido</div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                <div class="signature-email">${correoResponsable}</div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                    </div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                      </div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                      </div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                      </body>
                                                                                                                                                                                                                                                                                                                                                                                                                                                      </html>`;

  html2pdf().set({
        margin: 15,
        filename: `OC-${numeroOrden}_${(proveedor?.nombre || proveedorSheetName).substring(0, 20)}_${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' },
  }).from(html).save();
}

// âââ Component âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
export default function SheetsOrderForm() {
    // Data from Google Sheets
  const [proveedores, setProveedores] = useState<ProveedorSheet[]>([]);
    const [sedes, setSedes] = useState<SedeSheet[]>([]);
    const [sheetNames, setSheetNames] = useState<string[]>([]);
    const [productos, setProductos] = useState<ProductoSheet[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
    const [loadingProductos, setLoadingProductos] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

  // Form values
  const [selectedSede, setSelectedSede] = useState('');
    const [selectedProveedorSheet, setSelectedProveedorSheet] = useState('');
    const [responsable, setResponsable] = useState(() => localStorage.getItem('pedido_responsable') || '');
    const [correoResponsable, setCorreoResponsable] = useState(() => localStorage.getItem('pedido_correo') || '');
    const [notas, setNotas] = useState('');
    const [cantidades, setCantidades] = useState<Record<string, number>>({});

  // Load master data on mount
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
                          setError('No se pudo conectar con Google Sheets. Verifica la API Key y el ID de la hoja. ' + e.message);
                } finally {
                          setLoading(false);
                }
        }
        load();
  }, []);

  // Load products when supplier changes
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
        try {
                localStorage.setItem('pedido_responsable', responsable);
                localStorage.setItem('pedido_correo', correoResponsable);

          const numeroOrden = await dbService.getNextGlobalConsecutive();

        // Guardar cada linea en Google Sheets via Apps Script
                    for (const linea of lineasSeleccionadas) {
                                    try {
                                                        await appendPedido({
                                                                                fecha: new Date().toISOString(),
                                                                                sede: selectedSede,
                                                                                proveedor: selectedProveedorSheet,
                                                                                articulo: linea.articulo,
                                                                                subArticulo: linea.subArticulo,
                                                                                cantidad: linea.cantidad,
                                                                                unidad: '',
                                                                                responsable,
                                                                                correoResponsable,
                                                                                notas,
                                                                                numeroOrden,
                                                        });
                                    } catch (sheetErr) {
                                                        console.warn('No se pudo guardar en Sheets:', sheetErr);
                                    }
                    }
            
            // Save to Firebase
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

          // Generate PDF
          generarPDF({
                    sede: sedeSeleccionada,
                    proveedor: proveedorSeleccionado,
                    proveedorSheetName: selectedProveedorSheet,
                    lineas: lineasSeleccionadas,
                    notas,
                    responsable,
                    correoResponsable,
                    numeroOrden,
          });

          setSuccess(true);
                setCantidades({});
                setNotas('');
                setTimeout(() => setSuccess(false), 5000);
        } catch (e: any) {
                setError('Error al guardar pedido: ' + e.message);
        } finally {
                setSaving(false);
        }
  };

  const handleDescargarPDF = async () => {
        if (!selectedProveedorSheet) { alert('Selecciona un proveedor primero.'); return; }
        if (lineasSeleccionadas.length === 0) { alert('Agrega al menos un producto con cantidad mayor a 0.'); return; }
        const n = await dbService.getNextGlobalConsecutive();
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
          
            {/* Error banner */}
            {error && (
                    <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
                              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                              <div>
                                          <p className="font-semibold text-sm">Error de conexiÃ³n</p>
                                          <p className="text-xs mt-0.5">{error}</p>
                                          <button onClick={() => setError(null)} className="text-xs underline mt-1">Cerrar</button>
                              </div>
                    </div>
                )}
          
            {/* Success banner */}
            {success && (
                    <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-700">
                              <CheckCircle className="w-5 h-5" />
                              <p className="text-sm font-semibold">Â¡Pedido guardado exitosamente! El PDF se estÃ¡ descargando.</p>
                    </div>
                )}
          
            {/* Step 1: Sede + Responsable */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                                  <User className="w-4 h-4 text-brand-500" />
                                  1. InformaciÃ³n del Pedido
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                  <div>
                                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Sede *</label>
                                              <select
                                                              value={selectedSede}
                                                              onChange={e => setSelectedSede(e.target.value)}
                                                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                                                            >
                                                            <option value="">Seleccionar sede...</option>option>
                                                {sedes.map(s => <option key={s.nombre} value={s.nombre}>{s.nombre}</option>option>)}
                                              </select>select>
                                  </div>
                          {sedeSeleccionada && (
                        <div className="col-span-1 bg-slate-50 rounded-lg p-3 text-xs space-y-0.5">
                                      <p className="font-bold text-slate-600">ð {sedeSeleccionada.direccion}</p>
                          {sedeSeleccionada.telefono && <p className="text-slate-500">ð {sedeSeleccionada.telefono}</p>}
                          {sedeSeleccionada.horaEntrega && <p className="text-slate-500">ð {sedeSeleccionada.horaEntrega}</p>}
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
          
            {/* Step 2: Proveedor */}
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
                                  <option value="">Seleccionar proveedor...</option>option>
                          {sheetNames.map(name => <option key={name} value={name}>{name}</option>option>)}
                        </select>select>
                  {proveedorSeleccionado && (
                      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                        {proveedorSeleccionado.telefono && (
                                      <div className="bg-slate-50 rounded-lg p-3 text-xs">
                                                      <p className="text-slate-400 font-bold uppercase mb-0.5">TelÃ©fono</p>
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
                                          3. Productos â {selectedProveedorSheet}
                                {loadingProductos && <RefreshCw className="w-3 h-3 animate-spin text-slate-400 ml-2" />}
                                          <span className="ml-auto text-xs font-normal text-slate-400 normal-case">{lineasSeleccionadas.length} Ã­tem(s) seleccionado(s)</span>
                              </h2>
                    
                      {/* Search */}
                              <div className="relative mb-4">
                                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                          <input
                                                          type="text"
                                                          value={searchTerm}
                                                          onChange={e => setSearchTerm(e.target.value)}
                                                          placeholder="Buscar artÃ­culo por nombre o cÃ³digo..."
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
                                                                                                      <th className="py-3 px-4 text-left text-[10px] uppercase tracking-wider font-bold w-24">CÃ³digo</th>
                                                                                                      <th className="py-3 px-4 text-left text-[10px] uppercase tracking-wider font-bold">ArtÃ­culo</th>
                                                                                                      <th className="py-3 px-4 text-left text-[10px] uppercase tracking-wider font-bold hidden md:table-cell">SubArtÃ­culo</th>
                                                                                                      <th className="py-3 px-4 text-center text-[10px] uppercase tracking-wider font-bold w-32">Cantidad</th>
                                                                                    </tr>
                                                                </thead>thead>
                                                                <tbody>
                                                                  {productosFiltrados.map((p, idx) => {
                                                        const qty = cantidades[p.codigo] || 0;
                                                        return (
                                                                                <tr
                                                                                                          key={p.codigo || idx}
                                                                                                          className={`border-b border-slate-100 transition-colors ${qty > 0 ? 'bg-emerald-50' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
                                                                                                        >
                                                                                                        <td className="py-2.5 px-4 font-mono text-xs text-slate-500">{p.codigo}</td>
                                                                                                        <td className="py-2.5 px-4 font-medium text-slate-800">{p.articulo}</td>
                                                                                                        <td className="py-2.5 px-4 text-slate-500 hidden md:table-cell text-xs">{p.subArticulo}</td>
                                                                                                        <td className="py-2.5 px-4">
                                                                                                                                  <div className="flex items-center gap-1.5 justify-center">
                                                                                                                                                              <button
                                                                                                                                                                                              onClick={() => handleCantidad(p.codigo, qty - 1)}
                                                                                                                                                                                              className="w-7 h-7 rounded-lg bg-slate-200 hover:bg-slate-300 font-bold transition-colors flex items-center justify-center text-slate-600"
                                                                                                                                                                                            >â</button>
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
                                                        <tr><td colSpan={4} className="py-12 text-center text-slate-400 text-sm">No se encontraron productos{searchTerm ? ` para "${searchTerm}"` : ''}.</td></tr>
                                                                                  )}
                                                                </tbody>tbody>
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
                
                  {/* Summary */}
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
</div>
