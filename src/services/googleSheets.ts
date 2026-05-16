// @ts-nocheck
/**
 * googleSheets.ts
 * Servicio para leer datos de Google Sheets (proveedores, productos, sedes)
 * y escribir pedidos via Google Apps Script Web App.
 *
 * NUEVO: Usa Apps Script doGet(?action=getDatos) para leer datos.
 * Ya no requiere VITE_SHEETS_API_KEY.
 *
 * Variables de entorno requeridas:
 *   VITE_APPS_SCRIPT_URL — URL del Web App de Google Apps Script
 *   VITE_SHEETS_ID       — ID del Google Spreadsheet (fallback)
 */

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || '';

// Cache en memoria para evitar multiples peticiones
let cachedDatos: any = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

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

// ─── Obtener todos los datos desde Apps Script ────────────────────────────────

async function fetchAllDatos(): Promise<any> {
  const now = Date.now();
  if (cachedDatos && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedDatos;
  }

  if (!APPS_SCRIPT_URL) {
    throw new Error('VITE_APPS_SCRIPT_URL no configurada');
  }

  const url = APPS_SCRIPT_URL + (APPS_SCRIPT_URL.includes('?') ? '&' : '?') + 'action=getDatos';
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`Apps Script error [${res.status}]`);
  }
  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.error || 'Error al obtener datos de Sheets');
  }

  cachedDatos = data;
  cacheTimestamp = now;
  return data;
}

// ─── Proveedores ─────────────────────────────────────────────────────────────

export async function getProveedores(): Promise<ProveedorSheet[]> {
  const datos = await fetchAllDatos();
  return (datos.proveedores || []).map((p: any, idx: number) => ({
    id: `prov-${idx}`,
    nombre: p.nombre || '',
    telefono: p.telefono || '',
    correo: p.correo || '',
    asesor: p.asesor || '',
    medioPago: '',
  }));
}

// ─── Productos por Proveedor ──────────────────────────────────────────────────

export async function getProductosByProveedor(sheetName: string): Promise<ProductoSheet[]> {
  try {
    const datos = await fetchAllDatos();
    const articulos = datos.articulosPorProveedor?.[sheetName] || [];
    return articulos.map((a: any) => ({
      codigo: a.codigo || '',
      articulo: a.articulo || '',
      subArticulo: a.subArticulo || '',
      proveedorNombre: sheetName,
      pedido: '',
    }));
  } catch {
    return [];
  }
}

// ─── Sedes ────────────────────────────────────────────────────────────────────

export async function getSedes(): Promise<SedeSheet[]> {
  const datos = await fetchAllDatos();
  return (datos.sedes || []).map((s: string) => ({
    nombre: s,
    direccion: '',
    horaEntrega: '',
    telefono: '',
  }));
}

// ─── Lista de hojas de proveedor ─────────────────────────────────────────────

export async function getProveedorSheetNames(): Promise<string[]> {
  const datos = await fetchAllDatos();
  return Object.keys(datos.articulosPorProveedor || {});
}


// ─── Obtener todos los datos de una vez ─────────────────────────────────────

export async function getAllDatos(): Promise<any> {
  return fetchAllDatos();
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
    body: JSON.stringify({
      fecha: pedido.fecha,
      sede: pedido.sede,
      proveedor: pedido.proveedor,
      insumo: pedido.articulo,
      subArticulo: pedido.subArticulo,
      cantidad: pedido.cantidad,
      unidad: pedido.unidad,
      responsable: pedido.responsable,
      correo: pedido.correoResponsable,
      observaciones: pedido.notas,
      nOrden: pedido.numeroOrden,
    }),
    redirect: 'follow',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Apps Script error [${res.status}]: ${text}`);
  }
}
