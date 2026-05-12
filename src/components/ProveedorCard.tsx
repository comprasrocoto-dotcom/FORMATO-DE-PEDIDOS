import { motion } from 'motion/react';
import { Proveedor, Insumo } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { Package, User, Mail, ChevronRight, Printer, Download } from 'lucide-react';
import { dbService } from '../services/db';
// @ts-ignore
import html2pdf from 'html2pdf.js';

interface ProveedorCardProps {
  key?: string;
  proveedor: Proveedor;
  insumos: Insumo[];
  quantities: Record<string, number>;
  onQuantityChange: (id: string, val: number) => void;
  sede?: string;
  direccionEntrega?: string;
  horarioRecepcion?: string;
  notas?: string;
  responsable?: string;
}

export default function ProveedorCard({ 
  proveedor, 
  insumos, 
  quantities, 
  onQuantityChange,
  sede,
  direccionEntrega,
  horarioRecepcion,
  notas,
  responsable 
}: ProveedorCardProps) {
  // Solo mostramos los insumos que pertenecen a este proveedor
  const proveedorInsumos = insumos.filter(i => i.proveedorId === proveedor.id);

  if (proveedorInsumos.length === 0) return null;

  const handlePrint = async () => {
    if (!responsable?.trim()) {
      alert("⚠ Debes ingresar el nombre de quien realiza el pedido.");
      return;
    }

    const activeInsumos = proveedorInsumos.filter(insumo => (quantities[insumo.id] || 0) > 0);
    
    if (activeInsumos.length === 0) {
      alert("No hay insumos con cantidades mayores a 0 para imprimir.");
      return;
    }

    // Get and increment consecutive number from Firebase
    const nextNumber = await dbService.getNextProviderConsecutive(proveedor.id);
    
    // Capture notes from props
    const documentNotas = notas || "";

    const rows = activeInsumos.map(insumo => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${insumo.nombre}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${insumo.unidad}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center; font-weight: bold;">${quantities[insumo.id] || 0}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-family: monospace;">${formatCurrency((quantities[insumo.id] || 0) * insumo.precio)}</td>
      </tr>
    `).join('');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700;900&display=swap');
    body { font-family: 'Roboto', sans-serif; color: #000; padding: 0; margin: 0; font-size: 11px; }
    .page { padding: 60px; }
    
    .title-centered { text-align: center; color: #002060; font-size: 32px; font-weight: 900; margin-bottom: 40px; letter-spacing: 1px; }
    
    .flex { display: flex; }
    .justify-between { justify-content: space-between; }
    .items-center { align-items: center; }
    .gap-20 { gap: 20px; }
    
    .section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; border-bottom: 2px solid #002060; padding-bottom: 5px; }
    .section-icon { width: 32px; height: 32px; background: #002060; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0; }
    .section-title { font-weight: 700; color: #002060; font-size: 13px; text-transform: uppercase; }
    
    .data-table { border: none; width: 100%; border-collapse: collapse; }
    .data-table td { padding: 4px 0; vertical-align: top; border: none; }
    .data-label { font-weight: 700; width: 110px; color: #000; padding-right: 15px; }
    .data-value { color: #333; }
    
    .order-info-row { display: flex; align-items: flex-end; gap: 40px; margin: 25px 0; padding: 10px 0; border-top: 1px solid #eee; border-bottom: 1px solid #eee; }
    .order-info-group { display: flex; align-items: baseline; gap: 8px; }
    .order-info-label { font-weight: 700; font-size: 11px; text-transform: uppercase; color: #002060; }
    .order-info-value { font-weight: 900; font-size: 16px; color: #000; }
    .order-info-value.date { font-weight: 400; font-size: 14px; }
    
    .logistics-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; border: 1px solid #ccc; }
    .logistics-table th { background-color: #002060; color: white; padding: 8px; font-size: 11px; font-weight: 700; text-align: center; border: 1px solid #002060; }
    .logistics-table td { border: 1px solid #ccc; padding: 15px 10px; text-align: center; width: 33.33%; vertical-align: middle; min-height: 50px; }
    
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; border: 1px solid #ccc; }
    .items-table th { background-color: #002060; color: white; padding: 10px; font-size: 11px; font-weight: 700; border: 1px solid #002060; text-transform: uppercase; text-align: center; }
    .items-table td { border: 1px solid #ccc; padding: 8px 10px; text-align: left; }
    .items-table .text-center { text-align: center; }
    .items-table .text-right { text-align: right; }
    
    .footer-flex { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; }
    .comments-wrap { width: 55%; border: 1px solid #ccc; border-radius: 0; overflow: hidden; }
    .comments-header { background: white; padding: 8px 12px; border-bottom: 1px solid #ccc; font-weight: 700; text-transform: uppercase; font-size: 11px; color: #002060; }
    .comments-body { padding: 12px; min-height: 80px; line-height: 1.4; color: #333; }
    
    .totals-wrap { width: 42%; }
    .totals-table { width: 100%; border-collapse: collapse; border: 1px solid #ccc; }
    .totals-table td { border: 1px solid #ccc; padding: 8px 12px; font-size: 11px; }
    .totals-table .label { background: white; font-weight: 700; text-transform: uppercase; width: 50%; color: #000; }
    .totals-table .value { text-align: right; font-weight: 500; color: #000; }
    .totals-table .total-row td { background: #002060; color: white; font-weight: 900; border: 1px solid #002060; }
    
    .signature-area { margin-top: 60px; }
    .signature-label { font-weight: 700; color: #002060; text-transform: uppercase; font-size: 11px; margin-bottom: 30px; }
    .signature-line { width: 400px; border-bottom: 2px solid #000; margin-bottom: 5px; }
    .signature-name { text-align: center; width: 400px; font-weight: 600; font-size: 13px; text-transform: lowercase; }
    
    .final-phrase { text-align: center; margin-top: 80px; color: #2e5a9e; font-style: italic; font-size: 16px; border-top: 1px solid #e2e8f0; padding-top: 30px; }
  </style>
</head>
<body>
  <div class="page">
    <h1 class="title-centered">ORDEN DE COMPRA</h1>

    <div class="flex justify-between" style="margin-bottom: 30px;">
      <div style="width: 48%;">
        <div class="section-header">
          <div class="section-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><path d="M9 22v-4h6v4"></path><path d="M8 6h.01"></path><path d="M16 6h.01"></path><path d="M12 6h.01"></path><path d="M12 10h.01"></path><path d="M12 14h.01"></path><path d="M16 10h.01"></path><path d="M16 14h.01"></path><path d="M8 10h.01"></path><path d="M8 14h.01"></path></svg>
          </div>
          <span class="section-title">Datos del Proveedor</span>
        </div>
        <table class="data-table">
          <tr><td class="data-label">Proveedor:</td><td class="data-value">${proveedor.nombre}</td></tr>
          <tr><td class="data-label">Contacto:</td><td class="data-value">${proveedor.contacto}</td></tr>
          <tr><td class="data-label">Teléfono:</td><td class="data-value">(604) 123 4567</td></tr>
          <tr><td class="data-label">Email:</td><td class="data-value">${proveedor.email}</td></tr>
          <tr><td class="data-label">Dirección:</td><td class="data-value">Cra 43A # 1-50, Medellín</td></tr>
        </table>
      </div>
      
      <div style="width: 48%;">
        <div class="section-header">
          <div class="section-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          </div>
          <span class="section-title">Datos de quien realiza el pedido</span>
        </div>
        <table class="data-table">
          <tr><td class="data-label">Solicitado por:</td><td class="data-value">${responsable}</td></tr>
          <tr><td class="data-label">ENVIAR A:</td><td class="data-value">${sede || 'Rocoto Laureles'}</td></tr>
          <tr><td class="data-label">Dirección:</td><td class="data-value"> Calle 45 #22-18, Laureles</td></tr>
          <tr><td class="data-label">Teléfono:</td><td class="data-value">(604) 987 6543</td></tr>
          <tr><td class="data-label">Email:</td><td class="data-value">mari@rocoto.co</td></tr>
        </table>
      </div>
    </div>

    <div class="order-info-row">
      <div class="order-info-group">
        <span class="order-info-label">N° ORDEN:</span>
        <span class="order-info-value">OC-${nextNumber}</span>
      </div>
      <div class="order-info-group">
        <span class="order-info-label">Fecha:</span>
        <span class="order-info-value date">${new Date().toLocaleDateString()}</span>
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 10%;">CANT</th>
          <th style="width: 45%;">DESCRIPCIÓN</th>
          <th style="width: 15%;">IMPUESTO</th>
          <th style="width: 15%;">PRECIO UNITARIO</th>
          <th style="width: 15%;">TOTAL</th>
        </tr>
      </thead>
      <tbody>
        ${activeInsumos.map((insumo) => `
          <tr>
            <td class="text-center">${quantities[insumo.id] || 0}</td>
            <td>${insumo.nombre} (${insumo.unidad})</td>
            <td class="text-center">0%</td>
            <td class="text-right">${formatCurrency(insumo.precio)}</td>
            <td class="text-right">${formatCurrency((quantities[insumo.id] || 0) * insumo.precio)}</td>
          </tr>
        `).join('')}
        ${Array(Math.max(0, 3 - activeInsumos.length)).fill(0).map(() => `
          <tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>
        `).join('')}
      </tbody>
    </table>

    <div class="footer-flex">
      <div class="comments-wrap">
        <div class="comments-header">Otros Comentarios o Instrucciones Especiales</div>
        <div class="comments-body">${documentNotas || 'Sin instrucciones adicionales.'}</div>
      </div>
      
      <div class="totals-wrap">
        <table class="totals-table">
          <tr><td class="label">SUBTOTAL</td><td class="value">${formatCurrency(calculateTotal())}</td></tr>
          <tr><td class="label">IMPONIBLE</td><td class="value">${formatCurrency(calculateTotal())}</td></tr>
          <tr><td class="label">IVA 0%</td><td class="value">$0.00</td></tr>
          <tr><td class="label">IMPUESTOS</td><td class="value">$0.00</td></tr>
          <tr class="total-row">
            <td class="label" style="background:transparent;color:white;font-size:14px;padding-top:12px;padding-bottom:12px;">TOTAL</td>
            <td class="value" style="font-size:20px;padding-top:12px;padding-bottom:12px;">${formatCurrency(calculateTotal()).replace('$', '$ ')}</td>
          </tr>
        </table>
      </div>
    </div>

  </div>
</body>
</html>
    `;

    const opt = {
      margin: 30,
      filename: `OrdenCompra_${proveedor.nombre}_${Date.now()}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { 
        scale: 3, 
        useCORS: true,
        onclone: (clonedDoc: Document) => {
          // Fix for oklch error in html2canvas (Tailwind 4)
          const styles = clonedDoc.getElementsByTagName('style');
          for (let i = 0; i < styles.length; i++) {
            const style = styles[i];
            if (style.innerHTML.includes('oklch')) {
              style.innerHTML = style.innerHTML.replace(/oklch\([^)]+\)/g, '#ccc');
            }
          }
        }
      },
      jsPDF: { unit: 'mm' as const, format: 'letter' as const, orientation: 'landscape' as const }
    };

    html2pdf().set(opt).from(htmlContent).save();
  };

  const handleDownloadPDF = () => {
    const activeInsumos = proveedorInsumos.filter(insumo => (quantities[insumo.id] || 0) > 0);
    
    if (activeInsumos.length === 0) {
      alert("No hay insumos con cantidades mayores a 0 para generar PDF.");
      return;
    }
    const element = document.getElementById(`pedido-${proveedor.id}`);
    if (!element) return;

    const opt = {
      margin: 10,
      filename: `Pedido-${proveedor.nombre}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'landscape' as const }
    };

    // Clonamos el elemento para manipularlo si es necesario (ej: forzar estilos de impresión)
    html2pdf().set(opt).from(element).save();
  };

  const calculateTotal = () => {
    return proveedorInsumos.reduce((acc, insumo) => {
      const qty = quantities[insumo.id] || 0;
      return acc + (insumo.precio * qty);
    }, 0);
  };

  return (
    <motion.div
      layout
      id={`pedido-${proveedor.id}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full card-hover print:border-none print:shadow-none print:h-auto"
    >
      {/* Header */}
      <div className="p-5 border-b border-slate-100 print:border-b-2 print:border-slate-900">
        <div className="flex items-start justify-between mb-3 print:hidden">
          <div className={`w-12 h-12 rounded-xl ${proveedor.logoColor} flex items-center justify-center text-white shadow-inner`}>
            {proveedor.nombre.charAt(0)}
          </div>
          <span className="px-3 py-1 rounded-full bg-brand-50 text-brand-600 text-[10px] font-bold uppercase border border-brand-100 flex items-center gap-1.5">
            <Package className="w-3 h-3" />
            {proveedorInsumos.length} Insumos
          </span>
        </div>
        
        {/* Visible only on print header */}
        <div className="hidden print:block mb-4">
          <h1 className="text-2xl font-black uppercase text-slate-900">Orden de Compra / Pedido</h1>
          <p className="text-slate-500 font-mono text-xs">Generado: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
        </div>

        <h3 className="text-lg font-bold text-slate-900 leading-tight mb-1 print:text-2xl">{proveedor.nombre}</h3>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-500 print:text-slate-700">
            <User className="w-3 h-3" />
            <span>{proveedor.contacto}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 print:text-slate-700">
            <Mail className="w-3 h-3" />
            <span className="truncate">{proveedor.email}</span>
          </div>
        </div>
      </div>

      {/* Supplies List */}
      <div className="flex-1 p-5 bg-slate-50/30 print:bg-white">
        <div className="space-y-3 print:space-y-0 print:border-t print:border-l print:border-r print:border-slate-200">
          {/* Print Table Header */}
          <div className="hidden print:grid grid-cols-5 gap-2 p-2 bg-slate-100 border-b border-slate-200 font-bold text-[10px] uppercase">
            <div className="col-span-2">Insumo</div>
            <div className="text-center">Unidad</div>
            <div className="text-center">Cant.</div>
            <div className="text-right">Subtotal</div>
          </div>
          
          {proveedorInsumos.map((insumo) => (
            <div 
              key={insumo.id} 
              className={cn(
                "flex flex-col p-3 rounded-lg bg-white border border-slate-100 shadow-sm group hover:border-brand-300 transition-colors print:grid print:grid-cols-5 print:rounded-none print:shadow-none print:border-b print:border-slate-200 print:p-2",
                (quantities[insumo.id] || 0) <= 0 && "print:hidden"
              )}
            >
              <div className="flex items-center justify-between mb-2 print:mb-0 print:col-span-2">
                <div className="flex flex-col min-w-0 pr-2">
                  <span className="text-sm font-semibold text-slate-800 truncate group-hover:text-brand-600 transition-colors print:text-slate-900">
                    {insumo.nombre}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono uppercase tracking-widest print:hidden">
                    {insumo.unidad} • {insumo.categoria}
                  </span>
                  <span className="hidden print:block text-[8px] text-slate-500 uppercase">{insumo.categoria}</span>
                </div>
                <div className="shrink-0 flex flex-col items-end print:hidden">
                  <span className="text-sm font-bold text-slate-900 font-mono tracking-tighter">
                    {formatCurrency(insumo.precio)}
                  </span>
                </div>
              </div>

              <div className="hidden print:block text-center text-xs text-slate-700 self-center">
                {insumo.unidad}
              </div>

              {/* Quantity Input Area */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-50 print:border-none print:pt-0 print:contents">
                <div className="flex items-center gap-2 print:col-span-1 print:justify-center">
                  <label className="text-[10px] font-bold text-slate-400 uppercase print:hidden">Cant:</label>
                  <input 
                    type="number"
                    min="0"
                    placeholder="0"
                    className="w-16 h-7 text-center bg-slate-50 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-brand-500 outline-none print:bg-transparent print:border-none print:text-sm print:font-bold"
                    value={quantities[insumo.id] || ''}
                    onChange={(e) => onQuantityChange(insumo.id, Number(e.target.value))}
                  />
                </div>
                <div className="hidden print:block text-right self-center text-sm font-bold font-mono">
                  {formatCurrency((quantities[insumo.id] || 0) * insumo.precio)}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Print Totals */}
        <div className="hidden print:block mt-6 border-t-2 border-slate-900 pt-4 text-right">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total del Pedido</p>
          <p className="text-xl font-black text-slate-900 font-mono tracking-tighter">
            {formatCurrency(calculateTotal())}
          </p>
        </div>
      </div>

      {/* Footer / Buttons */}
      <div className="border-t border-slate-100 print:hidden">
        <div className="p-4 bg-slate-50/50 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase">Subtotal:</span>
          <span className="text-lg font-bold text-slate-900 font-mono">{formatCurrency(calculateTotal())}</span>
        </div>
        <button 
          onClick={handlePrint}
          className="w-full py-3 px-5 text-sm font-semibold text-brand-600 hover:bg-brand-50 flex items-center justify-center gap-2 transition-all border-b border-t border-slate-100"
        >
          <Printer className="w-4 h-4" />
          Imprimir Pedido
        </button>
        <button 
          onClick={handleDownloadPDF}
          className="w-full py-3 px-5 text-sm font-semibold text-emerald-600 hover:bg-emerald-50 flex items-center justify-center gap-2 transition-all border-b border-slate-100"
        >
          <Download className="w-4 h-4" />
          Descargar PDF
        </button>
        <button className="w-full py-3 px-5 text-sm font-semibold text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2 transition-all">
          Ver detalles completos
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}
