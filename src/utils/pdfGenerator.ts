// @ts-nocheck
/**
 * Utility para generación unificada de PDFs de Pedidos
 */

let _jsPDFClass = null;

// Carga dinámica de la librería si no existe
const loadJsPDF = () => {
  return new Promise((resolve) => {
    if (window.jspdf || window.jsPDF || _jsPDFClass) {
      _jsPDFClass = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
      resolve(_jsPDFClass);
      return;
    }
    const s = document.createElement('script');
    s.src = '[link removed]
```df/2.5.1/jspdf.umd.min.js';
    s.onload = () => {
      _jsPDFClass = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
      resolve(_jsPDFClass);
    };
    document.head.appendChild(s);
  });
};

export async function generarPDF(params) {
  const JsPDF = await loadJsPDF();
  if (!JsPDF) { 
    alert('PDF no disponible. Intenta de nuevo en un segundo.'); 
    return; 
  }

  // Desestructuración de parámetros con valores por defecto
  const {
    sede = '', sedeDireccion = '---', sedeTelefono = '---', sedeHorario = '---',
    encargado = '---', proveedorNombre = '', provNit = '---', provTel = '---',
    provCorreo = '---', provContacto = '---', lineas = [], notas = '',
    medioPago = 'contado', numeroOrden = '', nroFactura = '', tipoFactura = '',
    obsFactura = '', numeroPedidoSistema = ''
  } = params;

  const fechaHoy = new Date().toISOString().slice(0, 10);
  const activas = lineas.filter(l => (parseFloat(l.cantidad) || 0) > 0);
  const total = activas.reduce((s, l) => s + ((l.valorUnitario || 0) * (parseFloat(l.cantidad) || 0)), 0);

  const doc = new JsPDF({ unit: 'mm', format: 'letter', orientation: 'portrait' });
  const azul = [26, 60, 110], negro = [30, 30, 30], blanco = [255, 255, 255], cielo = [0, 112, 192];
  const ancho = 215.9, margen = 15, col2 = ancho / 2 + 5;
  let y = 15;

  // Encabezado Derecho
  doc.setFontSize(8); doc.setTextColor(120, 120, 120);
  doc.text(`Pedido #${numeroOrden} ${fechaHoy}`, ancho - margen, y, { align: 'right' });
  if (medioPago) {
    doc.setFontSize(7);
    doc.text(`Medio de Pago: ${medioPago.charAt(0).toUpperCase() + medioPago.slice(1)}`, ancho - margen, y + 4, { align: 'right' });
  }
  if (numeroPedidoSistema) {
    doc.setFontSize(7);
    doc.text(`N. Pedido Sistema: ${numeroPedidoSistema}`, ancho - margen, y + 8, { align: 'right' });
  }
  y += 10;

  // Bloques de Información (Izquierda y Derecha)
  const infoLeft = [['Sede', sede], ['Direccion', sedeDireccion], ['Telefono Sede', sedeTelefono], ['Horario', sedeHorario], ['Encargado', encargado]];
  const infoRight = [['Proveedor', proveedorNombre], ['NIT', provNit], ['Tel. Proveedor', provTel], ['Contacto', provContacto], ['Correo', provCorreo]];

  const yStart = y;
  infoLeft.forEach(f => {
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...cielo);
    doc.text(`${f[0]}:`, margen, y);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...negro);
    doc.text(doc.splitTextToSize(String(f[1]), 70), margen + 40, y);
    y += 6;
  });

  let yR = yStart;
  infoRight.forEach(f => {
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...cielo);
    doc.text(`${f[0]}:`, col2, yR);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...negro);
    doc.text(doc.splitTextToSize(String(f[1]), 65), col2 + 36, yR);
    yR += 6;
  });
  y = Math.max(y, yR) + 5;

  // Tabla de Productos
  const cW = [70, 25, 25, 30], cX = [margen];
  for (let ci = 0; ci < cW.length - 1; ci++) cX.push(cX[ci] + cW[ci]);
  const rH = 7, headers = ['Articulo', 'Unidad', 'Cantidad', 'Total'], aligns = ['left', 'center', 'center', 'right'];

  doc.setFillColor(...azul); doc.rect(margen, y, ancho - 2 * margen, rH, 'F');
  doc.setTextColor(...blanco); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  headers.forEach((h, i) => {
    const xT = aligns[i] === 'right' ? cX[i] + cW[i] - 2 : aligns[i] === 'center' ? cX[i] + cW[i] / 2 : cX[i] + 2;
    doc.text(h, xT, y + 4.5, { align: aligns[i] });
  });
  y += rH;

  // Filas
  doc.setFont('helvetica', 'normal');
  const minF = Math.max(activas.length, 8);
  for (let ri = 0; ri < minF; ri++) {
    const l = activas[ri];
    const bg = ri % 2 === 0 ? [255, 255, 255] : [248, 249, 252];
    doc.setFillColor(...bg); doc.rect(margen, y, ancho - 2 * margen, rH, 'F');
    doc.setDrawColor(208, 215, 232); doc.rect(margen, y, ancho - 2 * margen, rH, 'S');
    if (l) {
      const cant = parseFloat(l.cantidad) || 0;
      // Formateamos la cantidad con formato local colombiano (comas y puntos bien puestos)
      const cantStr = cant.toLocaleString('es-CO', { maximumFractionDigits: 3 });
      const tienePrecio = (l.valorUnitario || 0) > 0;
  
      const vals = [
        (l.articulo || '').substring(0, 35),
        (l.unidad || '---').substring(0, 10),
        cantStr,
        tienePrecio ? `$ ${Number(l.valorUnitario * cant).toLocaleString('es-CO')}` : '---' // Evita llenar el PDF de ceros falsos
        ];
      doc.setTextColor(...negro); doc.setFontSize(7.5);
      vals.forEach((v, i) => {
        const xT2 = aligns[i] === 'right' ? cX[i] + cW[i] - 2 : aligns[i] === 'center' ? cX[i] + cW[i] / 2 : cX[i] + 2;
        doc.text(v, xT2, y + 4.5, { align: aligns[i] });
      });
    }
    y += rH;
  }

  // Totales y Notas
  y += 2;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...azul);
  doc.text('Total:', cX[2], y + 4);
  doc.text(`$ ${Number(total).toLocaleString('es-CO')},00`, cX[3] + cW[3] - 2, y + 4, { align: 'right' });
  y += 10;

  if (notas) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...negro);
    doc.text('Observacion del Pedido:', margen, y); y += 4;
    doc.setDrawColor(150, 150, 150); doc.rect(margen, y, ancho - 2 * margen, 18, 'S');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(80, 80, 80);
    doc.text(doc.splitTextToSize(notas, ancho - 2 * margen - 4), margen + 2, y + 4);
    y += 22;
  }

  // Sección de Factura y NPS
  if (nroFactura || tipoFactura || obsFactura || numeroPedidoSistema) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...azul);
    doc.text('Informacion de Factura y Documento:', margen, y); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...negro);
    if (nroFactura) { doc.text(`N. Factura: ${nroFactura}`, margen, y); y += 5; }
    if (tipoFactura) { doc.text(`Tipo: ${tipoFactura}`, margen, y); y += 5; }
    if (obsFactura) { doc.text(`Obs. Factura: ${obsFactura}`, margen, y); y += 5; }
    if (numeroPedidoSistema) { doc.text(`N. Pedido Sistema: ${numeroPedidoSistema}`, margen, y); y += 5; }
  }

  const slug = proveedorNombre.replace(/[^A-Za-z0-9]/g, '_').substring(0, 20);
  doc.save(`Pedido-${numeroOrden}_${slug}_${fechaHoy}.pdf`);
}
