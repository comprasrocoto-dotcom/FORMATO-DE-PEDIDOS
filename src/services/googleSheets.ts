/**
 * googleSheets.ts
 * Servicio para leer datos de Google Sheets (proveedores, productos, sedes)
 * y escribir pedidos via Google Apps Script Web App.
 *
 * Variables de entorno requeridas:
 *   VITE_SHEETS_API_KEY  — Google Sheets API key (lectura publica)
 *   VITE_SHEETS_ID       — ID del Google Spreadsheet
 *   VITE_APPS_SCRIPT_URL — URL del Web App de Google Apps Script (escritura)
 */

const SHEETS_ID = import.meta.env.VITE_SHEETS_ID || '1OxQGrFYOLyrai3PhxK-ZVmADzr56IssxuC2OWcc_aMM';
const API_KEY   = import.meta.env.VITE_SHEETS_API_KEY || '';
const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || '';

const BASE_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_ID}`;

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface ProveedorSheet {
   id: string;
   nombre: string;
   telefono: string;
   correo: string;
   asesor: string;
   medioPago: string;
}

export interface ProductoSheet {
   codigo: string;
   articulo: string;
   subArticulo: string;
   proveedorNombre: string;
   pedido: string;
}

export interface SedeSheet {
   nombre: string;
   direccion: string;
   horaEntrega: string;
   telefono: string;
}

export interface PedidoRow {
   fecha: string;
   sede: string;
   proveedor: string;
   articulo: string;
   subArticulo: string;
   cantidad: number | string;
   unidad: string;
   responsable: string;
   correoResponsable: string;
   notas: string;
   numeroOrden: number | string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchRange(range: string): Promise<string[][]> {
   const url = `${BASE_URL}/values/${encodeURIComponent(range)}?key=${API_KEY}`;
   const res = await fetch(url);
   if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Sheets API error [${res.status}]: ${JSON.stringify(err)}`);
   }
   const data = await res.json();
   return (data.values as string[][]) || [];
}

async function fetchSheetMetadata(): Promise<{ title: string; sheetId: number }[]> {
   const url = `${BASE_URL}?key=${API_KEY}&fields=sheets.properties`;
   const res = await fetch(url);
   if (!res.ok) throw new Error(`Sheets metadata error [${res.status}]`);
   const data = await res.json();
   return (data.sheets || []).map((s: any) => ({
        title: s.properties.title,
        sheetId: s.properties.sheetId,
   }));
}

// ─── Proveedores (hoja PRINCIPAL) ────────────────────────────────────────────

export async function getProveedores(): Promise<ProveedorSheet[]> {
   // Hoja PRINCIPAL: fila 2 = cabeceras, fila 3+ = datos
  // Columnas: A=Proveedor B=Telefono C=Correo D=Asesor E=MedioPago
  const rows = await fetchRange('PRINCIPAL!A3:E200');
   return rows
     .filter(r => r[0]?.trim())
     .map((r, idx) => ({
            id: `prov-sheet-${idx}`,
            nombre:    (r[0] || '').trim(),
            telefono:  (r[1] || '').trim(),
            correo:    (r[2] || '').trim(),
            asesor:    (r[3] || '').trim(),
            medioPago: (r[4] || '').trim(),
     }));
}

// ─── Productos por Proveedor ──────────────────────────────────────────────────

export async function getProductosByProveedor(sheetName: string): Promise<ProductoSheet[]> {
   try {
        const rows = await fetchRange(`'${sheetName}'!A5:D500`);
        return rows
          .filter(r => r[1]?.trim())
          .map(r => ({
                   codigo:          (r[0] || '').trim(),
                   articulo:        (r[1] || '').trim(),
                   subArticulo:     (r[2] || '').trim(),
                   proveedorNombre: sheetName,
                   pedido:          (r[3] || '').trim(),
          }));
   } catch {
        return [];
   }
}

// ─── Sedes ────────────────────────────────────────────────────────────────────

export async function getSedes(): Promise<SedeSheet[]> {
   // Hoja SEDE: fila 2 = cabeceras, fila 3+ = datos
  // Columnas: A=Sede B=Direccion C=HoraEntrega D=Telefono
  const rows = await fetchRange('SEDE!A3:D50');
   return rows
     .filter(r => r[0]?.trim())
     .map(r => ({
            nombre:      (r[0] || '').trim(),
            direccion:   (r[1] || '').trim(),
            horaEntrega: (r[2] || '').trim(),
            telefono:    (r[3] || '').trim(),
     }));
}

// ─── Lista de hojas de proveedor ─────────────────────────────────────────────

export async function getProveedorSheetNames(): Promise<string[]> {
   const sheets = await fetchSheetMetadata();
   const excluded = new Set([
        'PRINCIPAL', 'BASE DE PEDIDOS', 'BASE DE COMPRAS', 'SEDE',
      ]);
   return sheets
     .map(s => s.title.replace(/^0/, '').trim())
     .filter(t => !excluded.has(t) && t.length > 0);
}

// ─── Escribir Pedido en Google Sheets (via Apps Script) ──────────────────────

export async function appendPedido(pedido: PedidoRow): Promise<void> {
   if (!APPS_SCRIPT_URL) {
        console.warn('VITE_APPS_SCRIPT_URL no configurada. Pedido no guardado en Sheets.');
        return;
   }
   const res = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(pedido),
        redirect: 'follow',
   });
   if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Apps Script error [${res.status}]: ${text}`);
   }
}
