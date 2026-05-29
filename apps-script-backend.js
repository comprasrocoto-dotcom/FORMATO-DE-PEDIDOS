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
// Esto garantiza que r[16] (columna Q) siempre está presente en los rows.
// ============================================================


// ============================================================
// CAMBIO REQUERIDO v10: Corrección del minMaxMap en getDatos()
// ============================================================
//
// PROBLEMA DETECTADO (v9 → v10): La hoja de mínimos/máximos NO tiene
// código de producto en la columna A. Su estructura real es:
//   Col A (0) = AlmacéN (nombre de la sede, ej: "HOT WINGS", "MALANGA")
//   Col B (1) = Artículo (nombre del producto, ej: "TOCINETA PREMIUM X KILO")
//   Col C (2) = SubArtículo (unidad de medida, ej: "GRAMOS")
//   Col D (3) = Suma de Variación Stock
//   Col E (4) = Margen de Error
//   Col F (5) = Mínimo sugerido  <-- DATO REQUERIDO
//   Col G (6) = Máximo sugerido  <-- DATO REQUERIDO
//
// El mínimo y máximo DEPENDEN DE LA SEDE: Hotwings tiene 1.066 g,
// Malanga tiene 930 g para el mismo artículo. Por eso se requiere
// una clave compuesta: "SEDE|ARTICULO".
//
// NOMBRE REAL de la hoja: puede ser "MAXIMO Y MINIMOS" (sin tilde).
// Si en tu Apps Script usas un nombre diferente, ajústalo abajo.
//
// REEMPLAZA el bloque minMaxMap en getDatos() con este código:
//
//   // ── Leer hoja MAXIMO Y MINIMOS ─────────────────────────
//   var minMaxMap = {};
//   var mmSheet = null;
//   var allSheets = ss.getSheets();
//   for (var si = 0; si < allSheets.length; si++) {
//     var sn = allSheets[si].getName().toUpperCase()
//              .replace(/[ÁÀÂÃ]/g,'A').replace(/[áàâã]/g,'A')
//              .replace(/[ÉÈÊ]/g,'E').replace(/[éèê]/g,'E')
//              .replace(/[ÍÌÎ]/g,'I').replace(/[íìî]/g,'I')
//              .replace(/[ÓÒÔÕ]/g,'O').replace(/[óòôõ]/g,'O')
//              .replace(/[ÚÙÛ]/g,'U').replace(/[úùû]/g,'U');
//     if (sn === 'MAXIMO Y MINIMOS' || sn === 'MAXIMOS Y MINIMOS') {
//       mmSheet = allSheets[si]; break;
//     }
//   }
//   if (mmSheet) {
//     var mmData = mmSheet.getDataRange().getValues();
//     for (var r = 1; r < mmData.length; r++) {
//       var sede  = String(mmData[r][0] || '').trim().toUpperCase();
//       var art   = String(mmData[r][1] || '').trim().toUpperCase();
//       var minVal = mmData[r][5]; // Columna F = Mínimo
//       var maxVal = mmData[r][6]; // Columna G = Máximo
//       if (!sede || !art) continue;
//       // Clave compuesta: "HOT WINGS|TOCINETA PREMIUM X KILO"
//       var key = sede + '|' + art;
//       var subArt = String(mmData[r][2] || '').trim().toUpperCase(); // Col C = SubArtículo (unidad de inventario)
//       minMaxMap[key] = {
//         minimo: (minVal !== '' && minVal !== undefined && minVal !== null) ? minVal : '',
//         maximo: (maxVal !== '' && maxVal !== undefined && maxVal !== null) ? maxVal : '',
//         unidadInv: subArt // unidad de inventario para conversión en el cliente
//       };
//     }
//   }
//   result.minMaxMap = minMaxMap;
//   // ────────────────────────────────────────────────────────
//
// IMPORTANTE: Después de este cambio re-desplegar el Apps Script
// como nueva versión: Deploy → Manage deployments → New version.
// ============================================================
