// @ts-nocheck
// rebuild: 1779027882423
/**
 * googleSheets.ts
 * Servicio para leer datos de Google Sheets y escribir pedidos via Apps Script.
 */

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || '';

let cachedDatos: any = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000;

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
  codigo: string;
  articulo: string;
  subArticulo: string;
  cantidad: number | string;
  unidad: string;
  responsable: string;
  correoResponsable: string;
  notas: string;
  numeroOrden: number | string;
}

async function fetchAllDatos(): Promise<any> {
  const now = Date.now();
  if (cachedDatos && (now - cacheTimestamp) < CACHE_TTL) return cachedDatos;
  if (!APPS_SCRIPT_URL) throw new Error('VITE_APPS_SCRIPT_URL no configurada');
  const url = APPS_SCRIPT_URL + (APPS_SCRIPT_URL.includes('?') ? '&' : '?') + 'action=getDatos';
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error('Apps Script error [' + res.status + ']');
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Error al obtener datos');
  cachedDatos = data;
  cacheTimestamp = now;
  return data;
}

export async function getProveedores(): Promise<ProveedorSheet[]> {
  const datos = await fetchAllDatos();
  return (datos.proveedores || []).map((p: any, idx: number) => ({
    id: 'prov-' + idx,
    nombre: p.nombre || '',
    telefono: p.telefono || '',
    correo: p.correo || '',
    asesor: p.asesor || '',
    medioPago: '',
  }));
}

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
  } catch { return []; }
}

export async function getSedes(): Promise<SedeSheet[]> {
  const datos = await fetchAllDatos();
  return (datos.sedes || []).map((s: string) => ({
    nombre: s, direccion: '', horaEntrega: '', telefono: '',
  }));
}

export async function getProveedorSheetNames(): Promise<string[]> {
  const datos = await fetchAllDatos();
  return Object.keys(datos.articulosPorProveedor || {});
}

export async function getAllDatos(): Promise<any> {
  return fetchAllDatos();
}

// Envia action:'appendPedido' al Apps Script para guardar en BASE DE PEDIDOS
// Columnas en Drive: N° Orden | Fecha | Sede | Proveedor | Cod. Barras | Articulo | SubArticulo | Cantidad | Unidad | Responsable | Correo | Observaciones | Timestamp
export async function appendPedido(pedido: PedidoRow): Promise<{ ok: boolean; error?: string }> {
  if (!APPS_SCRIPT_URL) {
    console.warn('[appendPedido] URL no configurada.');
    return { ok: false, error: 'URL no configurada' };
  }

  const payload = {
    action: 'appendPedido',
    nOrden: pedido.numeroOrden || '',
    fecha: pedido.fecha || '',
    sede: pedido.sede || '',
    proveedor: pedido.proveedor || '',
    codigo: pedido.codigo || '',
    insumo: pedido.articulo || '',
    subArticulo: pedido.subArticulo || '',
    cantidad: pedido.cantidad ?? 0,
    unidad: pedido.unidad || '',
    responsable: pedido.responsable || '',
    correo: pedido.correoResponsable || '',
    observaciones: pedido.notas || '',
  };

  console.log('[appendPedido] Enviando:', payload.nOrden, payload.insumo, 'cod:', payload.codigo);

  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });
    const text = await res.text().catch(() => '');
    console.log('[appendPedido] Respuesta:', res.status, text.substring(0, 150));
    if (!res.ok) return { ok: false, error: 'HTTP ' + res.status };
    try {
      const json = JSON.parse(text);
      if (json.ok === false) return { ok: false, error: json.error };
    } catch (_) {}
    return { ok: true };
  } catch (err: any) {
    console.error('[appendPedido] Error:', err.message);
    return { ok: false, error: err.message };
  }
}
