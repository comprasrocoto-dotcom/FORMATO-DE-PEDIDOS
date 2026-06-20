// @ts-nocheck
// ============================================================================
//  src/config.ts  ·  ÚNICA fuente de verdad para la URL del Apps Script.
// ============================================================================
//  Cambia la URL SOLO aquí. Todos los archivos la importan, así nunca se
//  vuelven a desincronizar dos endpoints distintos.
//
//  ⚠️ VERIFICA esta URL en: Apps Script → Deploy → Manage deployments.
//     Debe ser el MISMO despliegue al que subes cada "New version"
//     (el que ya procesa tus escrituras: crear pedido, factura, ajuste).
//     Si tienes dos despliegues, deja UNO solo y usa su /exec aquí.
//
//  En Vercel puedes definir la variable VITE_APPS_SCRIPT_URL y este archivo
//  la tomará automáticamente (tiene prioridad sobre el valor por defecto).
// ============================================================================

export const APPS_SCRIPT_URL =
  (import.meta as any).env?.VITE_APPS_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbzlfjOyyYCGj5AaSTSclSTq3rEL3b8AB9en2LYKsbhmZ8P3goP9J15NC7QVt1ePgIAWCA/exec';
