// ============================================================
// sheetsService.ts
// Lee datos en tiempo real desde Google Sheets (BASE DE COMPRAS)
// SpreadsheetId: 1Yhpeb3aOJiW05XIEWcMPIjLl_ibr9xVa
// ============================================================

import { Insumo, Proveedor } from '../types';

const SPREADSHEET_ID = '1Yhpeb3aOJiW05XIEWcMPIjLl_ibr9xVa';
const SHEET_NAME = 'BASE DE COMPRAS';
const API_KEY = import.meta.env.VITE_SHEETS_API_KEY || '';

const COLORS = [
  'bg-orange-500', 'bg-red-600', 'bg-blue-600', 'bg-green-600',
    'bg-purple-600', 'bg-yellow-500', 'bg-pink-600', 'bg-teal-600',
      'bg-indigo-600', 'bg-rose-600',
      ];

      export interface SheetRow {
        codBarras: string;
          proveedor: string;
            articulo: string;
              subArticulo: string;
                subfamilia: string;
                }

                // ---------- Fetch raw rows from Google Sheets ----------
                export async function fetchSheetRows(): Promise<SheetRow[]> {
                  const range = encodeURIComponent(SHEET_NAME);
                    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${API_KEY}`;

                      const res = await fetch(url);
                        if (!res.ok) {
                            throw new Error(`Google Sheets API error: ${res.status} ${res.statusText}`);
                              }
                                const data = await res.json();
                                  const rows: string[][] = data.values ?? [];

                                    // Skip header row (row[0])
                                      return rows.slice(1).map((row) => ({
                                          codBarras:   row[0] ?? '',
                                              proveedor:   row[1] ?? '',
                                                  articulo:    row[2] ?? '',
                                                      subArticulo: row[3] ?? '',
                                                          subfamilia:  row[4] ?? '',
                                                            })).filter(r => r.proveedor && r.articulo);
                                                            }

                                                            // ---------- Build Proveedores list ----------
                                                            export async function fetchProveedores(): Promise<Proveedor[]> {
                                                              const rows = await fetchSheetRows();

                                                                const map = new Map<string, Proveedor>();
                                                                  let colorIndex = 0;

                                                                    rows.forEach((row) => {
                                                                        const key = row.proveedor.trim();
                                                                            if (!map.has(key)) {
                                                                                  const id = 'prov-' + key.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 30);
                                                                                        map.set(key, {
                                                                                                id,
                                                                                                        nombre: key,
                                                                                                                contacto: '',
                                                                                                                        email: '',
                                                                                                                                logoColor: COLORS[colorIndex % COLORS.length],
                                                                                                                                        insumosIds: [],
                                                                                                                                              });
                                                                                                                                                    colorIndex++;
                                                                                                                                                        }
                                                                                                                                                            const prov = map.get(key)!;
                                                                                                                                                                const insumoId = 'ins-' + (row.codBarras || (key + row.articulo)).replace(/\s+/g, '-').toLowerCase().slice(0, 40);
                                                                                                                                                                    if (!prov.insumosIds.includes(insumoId)) {
                                                                                                                                                                          prov.insumosIds.push(insumoId);
                                                                                                                                                                              }
                                                                                                                                                                                });
                                                                                                                                                                                
                                                                                                                                                                                  return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
                                                                                                                                                                                  }
                                                                                                                                                                                  
                                                                                                                                                                                  // ---------- Build Insumos list ----------
                                                                                                                                                                                  export async function fetchInsumos(): Promise<Insumo[]> {
                                                                                                                                                                                    const rows = await fetchSheetRows();
                                                                                                                                                                                    
                                                                                                                                                                                      return rows.map((row) => {
                                                                                                                                                                                          const provId = 'prov-' + row.proveedor.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 30);
                                                                                                                                                                                              const insumoId = 'ins-' + (row.codBarras || (row.proveedor + row.articulo)).replace(/\s+/g, '-').toLowerCase().slice(0, 40);
                                                                                                                                                                                                  return {
                                                                                                                                                                                                        id:          insumoId,
                                                                                                                                                                                                              nombre:      row.articulo.trim(),
                                                                                                                                                                                                                    categoria:   row.subfamilia.trim() || 'General',
                                                                                                                                                                                                                          unidad:      row.subArticulo.trim() || 'UND',
                                                                                                                                                                                                                                precio:      0,
                                                                                                                                                                                                                                      proveedorId: provId,
                                                                                                                                                                                                                                            actualizadoAt: new Date().toISOString().split('T')[0],
                                                                                                                                                                                                                                                  codBarras:   row.codBarras,
                                                                                                                                                                                                                                                      } as Insumo;
                                                                                                                                                                                                                                                        });
                                                                                                                                                                                                                                                        }
                                                                                                                                                                                                                                                        
                                                                                                                                                                                                                                                        // ---------- Fetch both in parallel ----------
                                                                                                                                                                                                                                                        export async function fetchCatalogo(): Promise<{ proveedores: Proveedor[]; insumos: Insumo[] }> {
                                                                                                                                                                                                                                                          const [proveedores, insumos] = await Promise.all([fetchProveedores(), fetchInsumos()]);
                                                                                                                                                                                                                                                            return { proveedores, insumos };
                                                                                                                                                                                                                                                            }
