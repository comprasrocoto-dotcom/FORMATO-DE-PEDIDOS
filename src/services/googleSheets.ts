// @ts-nocheck
// rebuild: v5-medioPago-factura
/**
 * googleSheets.ts
 * Servicio para leer y escribir datos de Google Sheets via Apps Script.
 *
 * ESTRUCTURA REAL DEL DRIVE (BASE DE COMPRAS):
 * - codigo      = codigo de barras del articulo
 * - articulo    = nombre del PROVEEDOR (campo mal nombrado en Sheets)
 * - subArticulo = nombre real del ARTICULO/INSUMO
 *
 * Columnas BASE DE PEDIDOS (objetivo):
 * A=nOrden, B=Fecha, C=Sede, D=Proveedor, E=Codigo, F=Articulo,
 * G=Unidad, H=Cantidad, I=Correo, J=Responsable, K=Observaciones,
 * L=MedioPago, M=Timestamp, N=NroFactura, O=TipoFactura, P=ObsFactura
 */

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbzlfjOyyYCGj5AaSTScISTq3rEL3b8AB9en2LYKsbhmZ8P3goP9J15NC7QVt1ePgIAWCA/exec';

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
  unidad: string;
  cantidad: number | string;
  responsable: string;
  correoResponsable: string;
  notas: string;
  medioPago: string;
  numeroOrden: number | string;
}

export interface FacturaRow {
  nOrden: string;
  nroFactura: string;
  tipoFactura: string;
  obsFactura: string;
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

export function invalidarCache() {
  cachedDatos = null;
  cacheTimestamp = 0;
}

function esFilaValida(row: any): boolean {
  var art = (row.articulo || '').trim();
  var sub = (row.subArticulo || '').trim();
  var cod = (row.codigo || '').trim().toLowerCase();
  if (!art && !sub && !cod) return false;
  if (cod === 'proveedor' || cod === 'codigo' || cod.indexOf('barras') !== -1) return false;
  if (art.toLowerCase() === 'proveedor' || art.toLowerCase() === 'articulo') return false;
  if (cod.indexOf('total') !== -1 || art.toLowerCase().indexOf('total') !== -1) return false;
  if (!art || !sub) return false;
  return true;
}

async function getAllArticulosNormalizados(): Promise<any[]> {
  const datos = await fetchAllDatos();
  const artPorHoja = datos.articulosPorProveedor || {};
  const todos: any[] = [];
  Object.keys(artPorHoja).forEach(function(hoja) {
    (artPorHoja[hoja] || []).forEach(function(row: any) {
      if (!esFilaValida(row)) return;
      todos.push({
        codigo: (row.codigo || '').trim(),
        proveedor: (row.articulo || '').trim(),
        articulo: (row.subArticulo || '').trim(),
        subfamilia: (row.subfamilia || '').trim(),
        unidad: (row.unidad || '').trim(),
      });
    });
  });
  return todos;
}

export async function getProveedorSheetNames(): Promise<string[]> {
  const articulos = await getAllArticulosNormalizados();
  const nombres = new Set<string>();
  articulos.forEach(function(a) { if (a.proveedor) nombres.add(a.proveedor); });
  return Array.from(nombres).sort();
}

export async function getProveedores(): Promise<ProveedorSheet[]> {
  const datos = await fetchAllDatos();
  const proveedoresMeta = datos.proveedores || [];
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
  const nombres = await getProveedorSheetNames();
  return nombres.map(function(n, idx) {
    return { id: 'prov-' + idx, nombre: n, telefono: '', correo: '', asesor: '', medioPago: '' };
  });
}

export async function getProductosByProveedor(proveedorNombre: string): Promise<ProductoSheet[]> {
  try {
    const todos = await getAllArticulosNormalizados();
    return todos
      .filter(function(a) { return a.proveedor === proveedorNombre; })
      .map(function(a) {
        return {
          codigo: a.codigo,
          articulo: a.articulo,
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

// Guarda pedido en Drive
// Columnas: A=nOrden, B=Fecha, C=Sede, D=Proveedor, E=Codigo, F=Articulo,
//           G=Unidad, H=Cantidad, I=Correo, J=Responsable, K=Observaciones,
//           L=MedioPago, M=Timestamp
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
    unidad: pedido.unidad || '',
    cantidad: pedido.cantidad ?? 0,
    correo: pedido.correoResponsable || '',
    responsable: pedido.responsable || '',
    observaciones: pedido.notas || '',
    medioPago: pedido.medioPago || 'contado',
  };

  console.log('[appendPedido] OC:', payload.nOrden, '| Art:', payload.insumo, '| MedioPago:', payload.medioPago);

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

// Actualiza datos de factura en una orden existente
export async function actualizarFactura(factura: FacturaRow): Promise<{ ok: boolean; error?: string }> {
  if (!APPS_SCRIPT_URL) {
    return { ok: false, error: 'URL no configurada' };
  }

  const payload = {
    action: 'actualizarFactura',
    nOrden: factura.nOrden || '',
    nroFactura: factura.nroFactura || '',
    tipoFactura: factura.tipoFactura || 'contado',
    obsFactura: factura.obsFactura || '',
  };

  console.log('[actualizarFactura] OC:', payload.nOrden, '| Factura:', payload.nroFactura);

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
    console.error('[actualizarFactura] Error:', err.message);
    return { ok: false, error: err.message };
  }
}
