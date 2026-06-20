// @ts-nocheck
// ============================================================================
//  src/services/adminApi.ts
//  Cliente del panel Admin. Usa el MISMO endpoint del Apps Script.
//  Todos los métodos van por POST con Content-Type text/plain (evita preflight CORS),
//  igual que el resto del proyecto.
// ============================================================================

// IMPORTANTE: si re-despliegas el Apps Script con otra URL, actualízala aquí
// (es la misma que usan SheetsOrderForm.tsx y googleSheets.ts).
import { APPS_SCRIPT_URL as ADMIN_ENDPOINT } from '../config';

async function postAdmin(payload: any): Promise<any> {
  try {
    const res = await fetch(ADMIN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });
    const text = await res.text().catch(() => '');
    if (!res.ok) return { ok: false, error: 'HTTP ' + res.status };
    try {
      return JSON.parse(text);
    } catch (_) {
      return { ok: false, error: 'Respuesta no válida del servidor' };
    }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Error de red' };
  }
}

// Login + carga de las 3 hojas en una sola llamada.
export async function adminGetData(password: string) {
  return postAdmin({ action: 'adminGetData', password });
}

// Crea o actualiza un registro por su llave.
export async function adminUpsert(sheet: string, record: Record<string, any>, password: string) {
  return postAdmin({ action: 'adminUpsert', sheet, record, password });
}

// Elimina un registro por su llave.
export async function adminDelete(sheet: string, record: Record<string, any>, password: string) {
  return postAdmin({ action: 'adminDelete', sheet, record, password });
}
