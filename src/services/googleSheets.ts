// @ts-nocheck
// rebuild: v4-fix-mapping
/**
 * googleSheets.ts
 * Servicio para leer datos de Google Sheets.
 *
 * ESTRUCTURA REAL DEL DRIVE (BASE DE COMPRAS):
 *   - codigo     = código de barras del artículo
 *   - articulo   = nombre del PROVEEDOR (campo mal nombrado en Sheets)
 *   - subArticulo = nombre real del ARTÍCULO/INSUMO
 *
 * Este servicio normaliza eso para que el frontend reciba datos correctos.
 */

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || '';

let cachedDatos: any = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

export interface ProveedorSheet {
  id: string;
  nombre: string;
  telefono: string;
  correo: string;
  asesor: string;
  medioPago: string;
}

// ProductoSheet normalizado:
// - codigo    = código de barras
// - articulo  = nombre del artículo/insumo (viene de subArticulo del Drive)
// - subfamilia = subfamilia (si existe en futuro; por ahora vacío)
// - unidad    = unidad de medida (no disponible en Drive aún, se deja vacío)
// - proveedor = nombre del proveedor (viene de articulo del Drive)
export interface ProductoSheet {
  codigo: string;
  articulo: string;
  subfamilia: string;
  unidad: string;
  proveedorNombre: string;
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

// Invalidar cache manualmente (para forzar recarga desde Drive)
export function invalidarCache() {
  cachedDatos = null;
  cacheTimestamp = 0;
}

// ─── Helpers internos ────────────────────────────────────────────────────────

// Filtra filas que son cabeceras o totales del Sheet
function esFilaValida(row: any): boolean {
  var art = (row.articulo || '').trim();
  var sub = (row.subArticulo || '').trim();
  var cod = (row.codigo || '').trim().toLowerCase();
  // Eliminar filas vacías
  if (!art && !sub && !cod) return false;
  // Eliminar cabeceras
  if (cod === 'proveedor' || cod === 'codigo' || cod.indexOf('barras') !== -1) return false;
  if (art.toLowerCase() === 'proveedor' || art.toLowerCase() === 'articulo') return false;
  // Eliminar totales
  if (cod.indexOf('total') !== -1 || art.toLowerCase().indexOf('total') !== -1) return false;
  // Debe tener al menos artículo (proveedor) y subArtículo (insumo)
  if (!art || !sub) return false;
  return true;
}

// Obtiene todos los artículos de la BASE DE COMPRAS ya normalizados
async function getAllArticulosNormalizados(): Promise<any[]> {
  const datos = await fetchAllDatos();
  const artPorHoja = datos.articulosPorProveedor || {};
  const todos: any[] = [];
  Object.keys(artPorHoja).forEach(function(hoja) {
    (artPorHoja[hoja] || []).forEach(function(row: any) {
      if (!esFilaValida(row)) return;
      todos.push({
        codigo: (row.codigo || '').trim(),
        // articulo en Drive = nombre del PROVEEDOR
        proveedor: (row.articulo || '').trim(),
        // subArticulo en Drive = nombre real del ARTÍCULO
        articulo: (row.subArticulo || '').trim(),
        subfamilia: '',   // no disponible en Drive aún
        unidad: (row.unidad || '').trim(), // vacío por ahora
      });
    });
  });
  return todos;
}

// ─── Exports públicos ────────────────────────────────────────────────────────

// Lista de proveedores únicos extraída del campo "articulo" del Drive
export async function getProveedorSheetNames(): Promise<string[]> {
  const articulos = await getAllArticulosNormalizados();
  const nombres = new Set<string>();
  articulos.forEach(function(a) { if (a.proveedor) nombres.add(a.proveedor); });
  return Array.from(nombres).sort();
}

// Proveedores con metadata (telefono, correo, etc.) — del endpoint proveedores
export async function getProveedores(): Promise<ProveedorSheet[]> {
  const datos = await fetchAllDatos();
  const proveedoresMeta = datos.proveedores || [];
  // Si hay metadata de proveedores en el endpoint, usarla
  if (proveedoresMeta.length > 0) {
    return proveedoresMeta.map((p: any, idx: number) => ({
      id: 'prov-' + idx,
      nombre: p.nombre || '',
      telefono: p.telefono || '',
      correo: p.correo || '',
      asesor: p.asesor || '',
      medioPago: '',
    }));
  }
  // Fallback: construir desde los artículos
  const nombres = await getProveedorSheetNames();
  return nombres.map(function(n, idx) {
    return { id: 'prov-' + idx, nombre: n, telefono: '', correo: '', asesor: '', medioPago: '' };
  });
}

// Artículos de un proveedor específico (mapeados correctamente)
export async function getProductosByProveedor(proveedorNombre: string): Promise<ProductoSheet[]> {
  try {
    const todos = await getAllArticulosNormalizados();
    return todos
      .filter(function(a) { return a.proveedor === proveedorNombre; })
      .map(function(a) {
        return {
          codigo: a.codigo,
          articulo: a.articulo,   // nombre real del artículo
          subfamilia: a.subfamilia,
          unidad: a.unidad,
          proveedorNombre: a.proveedor,
        };
      });
  } catch (e) {
    console.error('[getProductosByProveedor]', e);
    return [];
  }
}

// Subfamilias únicas de un proveedor
export async function getSubfamiliasByProveedor(proveedorNombre: string): Promise<string[]> {
  const productos = await getProductosByProveedor(proveedorNombre);
  const subs = new Set<string>();
  productos.forEach(function(p) { if (p.subfamilia) subs.add(p.subfamilia); });
  return Array.from(subs).sort();
}

export async function getSedes(): Promise<SedeSheet[]> {
  const datos = await fetchAllDatos();
  const sedes = datos.sedes || [];
  if (sedes.length === 0) return [];
  // sedes puede ser array de strings o array de objetos
  return sedes.map(function(s: any) {
    if (typeof s === 'string') {
      return { nombre: s, direccion: '', horaEntrega: '', telefono: '' };
    }
    return {
      nombre: s.nombre || s,
      direccion: s.direccion || '',
      horaEntrega: s.horaEntrega || s.horario || '',
      telefono: s.telefono || '',
    };
  });
}

export async function getAllDatos(): Promise<any> {
  return fetchAllDatos();
}

// Guarda pedido en Drive via Apps Script
// Columnas: N°Orden | Fecha | Sede | Proveedor | Cod.Barras | Insumo | SubArticulo | Cantidad | Unidad | Responsable | Correo | Observaciones | Timestamp
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
    insumo: pedido.articulo || '',        // nombre real del artículo
    subArticulo: pedido.subArticulo || '', // subfamilia
    cantidad: pedido.cantidad ?? 0,
    unidad: pedido.unidad || '',
    responsable: pedido.responsable || '',
    correo: pedido.correoResponsable || '',
    observaciones: pedido.notas || '',
  };

  console.log('[appendPedido] Enviando OC:', payload.nOrden, '| Insumo:', payload.insumo, '| Cod:', payload.codigo);

  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });
    const text = await res.text().catch(() => '');
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
