/**
 * apps-script-backend.js
 * 
 * INSTRUCCIONES PARA ACTUALIZAR EL APPS SCRIPT DE GOOGLE:
 * 
 * Ve a: https://script.google.com
 * Abre el proyecto que corresponde al ENDPOINT usado en la app.
 * Agrega las siguientes funciones/casos al switch principal de doPost().
 * 
 * ============================================================
 * ESTRUCTURA DE LA HOJA "BASE DE PEDIDOS":
 * ============================================================
 * Col A (0)  = nOrden (número de orden)
 * Col B (1)  = fecha
 * Col C (2)  = sede
 * Col D (3)  = proveedor
 * Col E (4)  = codigo
 * Col F (5)  = articulo/insumo
 * Col G (6)  = unidad
 * Col H (7)  = cantidad
 * Col I (8)  = correo
 * Col J (9)  = responsable
 * Col K (10) = observaciones
 * Col L (11) = medioPago
 * Col M (12) = (reservado)
 * Col N (13) = nroFactura
 * Col O (14) = tipoFactura
 * Col P (15) = obsFactura
 * Col Q (16) = numeroPedidoSistema  <-- NUEVO CAMPO
 * ============================================================
 */

// ============================================================
// AGREGAR ESTE CASE en la función doPost() dentro del switch(action):
// ============================================================

/*
  case 'actualizarNumeroPedidoSistema':
    return actualizarNumeroPedidoSistema(payload);
*/

// ============================================================
// AGREGAR ESTA FUNCIÓN al Apps Script:
// ============================================================

function actualizarNumeroPedidoSistema(payload) {
  try {
    var nOrden = String(payload.nOrden || '').trim();
    var numeroPedidoSistema = String(payload.numeroPedidoSistema || '').trim();
    
    if (!nOrden) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'nOrden es requerido' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (!numeroPedidoSistema) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'numeroPedidoSistema es requerido' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('BASE DE PEDIDOS');
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Hoja BASE DE PEDIDOS no encontrada' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = sheet.getDataRange().getValues();
    var updated = 0;
    
    // Buscar todas las filas con ese nOrden y actualizar columna Q (índice 16)
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0] || '').trim() === nOrden) {
        // Columna Q es la columna 17 (base 1)
        sheet.getRange(i + 1, 17).setValue(numeroPedidoSistema);
        updated++;
      }
    }
    
    if (updated === 0) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'No se encontró ninguna fila con nOrden: ' + nOrden }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ ok: true, updated: updated }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: e.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================
// TAMBIÉN VERIFICAR que getHistorial() incluya la columna Q:
// ============================================================
// En la función getHistorial(), asegúrate de que los rows se retornen
// con suficientes columnas. Si usas getDataRange().getValues(),
// automáticamente incluirá la columna Q si ya tiene datos.
// Si la columna Q está vacía para muchas filas, puede que necesites
// extender el rango explícitamente hasta la columna Q:
//
// var lastRow = sheet.getLastRow();
// var data = sheet.getRange(1, 1, lastRow, 17).getValues(); // 17 columnas = hasta Q
//
// Esto garantiza que r[16] (columna Q) siempre esté presente en los rows.
// ============================================================
