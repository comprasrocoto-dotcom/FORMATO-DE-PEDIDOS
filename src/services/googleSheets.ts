/**
 * googleSheets.ts
  * Servicio para leer datos de Google Sheets (proveedores, productos, sedes)
   * y escribir pedidos en la hoja "BASE DE PEDIDOS".
    *
     * Requiere:
      *   VITE_SHEETS_API_KEY  — Google Sheets API key (solo lectura publica)
       *   VITE_SHEETS_ID       — ID del Google Spreadsheet
        *
         * La hoja debe estar publicada o el API key debe tener acceso al documento.
          */

const SHEETS_ID = import.meta.env.VITE_SHEETS_ID || '1Yhpeb3aOJiW05XIEWcMPIjLl_ibr9xVa';
const API_KEY   = import.meta.env.VITE_SHEETS_API_KEY || '';

const BASE_URL  = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_ID}`;

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
    // Hoja PRINCIPAL columnas: A=Proveedor B=Telefono C=Correo D=Asesor E=MedioPago
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

/**
 * Cada hoja de proveedor tiene:
  *   Row 2: B2 = Nombre del proveedor
   *   Row 4: headers (A=Código, B=Artículo, C=SubArtículo, D=Pedido)
    *   Row 5+: datos
     *
      * sheetName: nombre exacto de la hoja (e.g. "JUAN D HOYOS")
       */
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
    // Hoja SEDE columnas: A=Sede B=Direccion C=HoraEntrega D=Telefono
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

/**
 * Devuelve los nombres de las hojas que corresponden a proveedores
  * (excluyendo PRINCIPAL, BASE DE PEDIDOS, BASE DE COMPRAS, SEDE).
   */
export async function getProveedorSheetNames(): Promise<string[]> {
    const sheets = await fetchSheetMetadata();
    const excluded = new Set([
          'PRINCIPAL', 'BASE DE PEDIDOS', 'BASE DE COMPRAS', 'SEDE',
        ]);
    return sheets
      .map(s => s.title.replace(/^0/, '').trim())
      .filter(t => !excluded.has(t) && t.length > 0);
  }

// ─── Escribir Pedido en Google Sheets ────────────────────────────────────────
/**
 * Para ESCRIBIR en Sheets se necesita OAuth2 (el usuario debe autorizar).
  * Esta funcion usa la API REST con un access_token pasado como parametro.
   *
    * Alternativa recomendada: usar el servicio Firebase Cloud Function
     * que escribe usando una Service Account (ver instrucciones en README).
      */
export async function appendPedido(
    accessToken: string,
    row: (string | number)[]
  ): Promise<void> {
    const url = `${BASE_URL}/values/BASE%20DE%20PEDIDOS!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS&access_token=${accessToken}`;
    const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: [row] }),
        });
    if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(`Sheets write error [${res.status}]: ${JSON.stringify(err)}`);
        }
  }
