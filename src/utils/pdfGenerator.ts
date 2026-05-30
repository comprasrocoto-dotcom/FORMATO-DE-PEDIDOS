// @ts-nocheck
/**
  * Utility para generacion unificada de PDFs de Pedidos v12
  * - Columnas: Codigo, Articulo, Unidad, Cantidad, Total.
 * v11: agrega columna CODIGO en tabla de productos
 * - Se elimino columna Total (no aplica en pedidos de compra)
  * v12: columna Obs. renombrada a TOTAL (muestra cantidad por linea)
 */

let _jsPDFClass: any = null;

const loadJsPDF = () => {
  return new Promise((resolve) => {
    if (window.jspdf || window.jsPDF || _jsPDFClass) {
      if (!_jsPDFClass) _jsPDFClass = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
      resolve(_jsPDFClass);
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = () => {
      _jsPDFClass = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
      resolve(_jsPDFClass);
    };
    document.head.appendChild(s);
  });
};

export async function generarPDF(params) {
  const JsPDF: any = await loadJsPDF();
  if (!JsPDF) {
    alert('PDF no disponible. Intenta de nuevo en un segundo.');
    return;
  }

  const {
    sede = '', sedeDireccion = '---', sedeTelefono = '---', sedeHorario = '---',
    encargado = '---', proveedorNombre = '', provNit = '---', provTel = '---',
    provCorreo = '---', provContacto = '---', lineas = [], notas = '',
    medioPago = 'contado', numeroOrden = '', nroFactura = '', tipoFactura = '',
    obsFactura = '', numeroPedidoSistema = ''
  } = params;

  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const ancho = doc.internal.pageSize.getWidth();
  const margen = 14;
  let y = 14;
  const azul = [30, 64, 175];
  const cielo = [14, 116, 144];
  const negro = [30, 30, 30];
  const blanco = [255, 255, 255];
  const gris = [240, 242, 248];
  const fechaHoy = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const slug = (proveedorNombre || 'pedido').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);

  // Titulo
  doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(...azul);
  doc.text('ORDEN DE COMPRA', margen, y);
  y += 6;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...cielo);
  doc.text(proveedorNombre || '---', margen, y);
  y += 5;

  // Encabezado derecho
  doc.setFontSize(8); doc.setTextColor(120, 120, 120);
  doc.text('Pedido #' + numeroOrden + ' ' + fechaHoy, ancho - margen, y - 11, { align: 'right' });
  if (medioPago) {
    doc.setFontSize(7);
    doc.text('Medio de Pago: ' + medioPago.charAt(0).toUpperCase() + medioPago.slice(1), ancho - margen, y - 7, { align: 'right' });
  }
  if (numeroPedidoSistema) {
    doc.setFontSize(7);
    doc.text('N. Pedido Sistema: ' + numeroPedidoSistema, ancho - margen, y - 3, { align: 'right' });
  }

  doc.setDrawColor(200, 210, 230); doc.line(margen, y, ancho - margen, y);
  y += 6;

  // Info bloques izquierda / derecha
  const col2 = ancho / 2 + 4;
  const yR_start = y;
  const infoLeft = [['Sede', sede], ['Direccion', sedeDireccion], ['Telefono', sedeTelefono], ['Horario', sedeHorario], ['Encargado', encargado]];
  const infoRight = [['Proveedor', proveedorNombre], ['NIT', provNit], ['Tel. Proveedor', provTel], ['Contacto', provContacto], ['Correo', provCorreo]];
  let yR = yR_start;

  infoLeft.forEach(f => {
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...cielo);
    doc.text(f[0] + ':', margen, y);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...negro);
    doc.text(doc.splitTextToSize(String(f[1]), 70), margen + 40, y);
    y += 5;
  });

  infoRight.forEach(f => {
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...cielo);
    doc.text(f[0] + ':', col2, yR);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...negro);
    doc.text(doc.splitTextToSize(String(f[1]), 65), col2 + 36, yR);
    yR += 5;
  });

  y = Math.max(y, yR) + 4;
  doc.setDrawColor(200, 210, 230); doc.line(margen, y - 2, ancho - margen, y - 2);

  // Tabla de productos
    // Columnas: Codigo(22) | Articulo(63) | Unidad(22) | Cant.(20) | Total(55) = 182
    const cW = [22, 63, 22, 20, 55];
  const cX = [margen];
  for (let ci = 0; ci < cW.length - 1; ci++) cX.push(cX[ci] + cW[ci]);
  const rH = 7;
    const headers = ['CÓDIGO', 'Articulo', 'Unidad', 'Cant.', 'TOTAL'];
     const aligns  = ['left', 'left', 'center', 'center', 'left'];

  doc.setFillColor(...azul); doc.rect(margen, y, ancho - 2 * margen, rH, 'F');
  doc.setTextColor(...blanco); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  headers.forEach((h, i) => {
    const xT = aligns[i] === 'right' ? cX[i] + cW[i] - 2 : aligns[i] === 'center' ? cX[i] + cW[i] / 2 : cX[i] + 2;
    doc.text(h, xT, y + 4.5, { align: aligns[i] });
  });
  y += rH;

  doc.setFont('helvetica', 'normal');
  lineas.forEach(function(l: any, idx: number) {
    const bg = idx % 2 === 0 ? blanco : gris;
    doc.setFillColor(...bg); doc.rect(margen, y, ancho - 2 * margen, rH, 'F');
    doc.setDrawColor(208, 215, 232); doc.rect(margen, y, ancho - 2 * margen, rH, 'S');
    if (l) {
      const cant = parseFloat(String(l.cantidad || '0').replace(/,/g, '')) || 0;
      const cantStr = cant > 0 ? cant.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 3 }) : '---';
      const obsStr = String(l.observaciones || l.obs || '').substring(0, 18);

      const vals = [
        String(l.codigo || '---').substring(0, 8),
        String(l.articulo || '').substring(0, 34),
        String(l.unidad || '---').substring(0, 10),
        cantStr,
        cantStr
      ];
      doc.setTextColor(...negro); doc.setFontSize(7.5);
      vals.forEach((v, i) => {
        const xT2 = aligns[i] === 'right' ? cX[i] + cW[i] - 2 : aligns[i] === 'center' ? cX[i] + cW[i] / 2 : cX[i] + 2;
        doc.text(String(v), xT2, y + 4.5, { align: aligns[i] });
      });
    }
    y += rH;
  });

  // Total articulos
  y += 2;
  const totalArticulos = lineas.reduce(function(s: number, l: any) {
    return s + (parseFloat(String((l && l.cantidad) || '0').replace(/,/g, '')) || 0);
  }, 0);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...azul);
  doc.text('Total art.:', cX[1], y + 4);
  doc.text(
    totalArticulos.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 3 }),
    cX[2] + cW[2] - 2, y + 4, { align: 'right' }
  );
  y += 10;

  if (notas) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...negro);
    doc.text('Notas / Observaciones:', margen, y);
    y += 4;
    doc.setDrawColor(150, 150, 150); doc.rect(margen, y, ancho - 2 * margen, 18, 'S');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(80, 80, 80);
    doc.text(doc.splitTextToSize(notas, ancho - 2 * margen - 4), margen + 2, y + 4);
    y += 22;
  }

  // Seccion Factura / Documento
  if (nroFactura || tipoFactura || obsFactura || numeroPedidoSistema) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...azul);
    doc.text('Informacion de Factura / Documento', margen, y); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...negro);
    if (nroFactura)           { doc.text('N Factura: ' + nroFactura, margen, y); y += 4; }
    if (tipoFactura)          { doc.text('Tipo: ' + tipoFactura, margen, y); y += 4; }
    if (obsFactura)           { doc.text('Doc. Ingreso: ' + obsFactura, margen, y); y += 4; }
    if (numeroPedidoSistema)  { doc.text('N Pedido Sistema: ' + numeroPedidoSistema, margen, y); y += 4; }
  }

  doc.save('Pedido-' + numeroOrden + '_' + slug + '_' + fechaHoy + '.pdf');
}
