import { Insumo, Proveedor } from '../types';
import { formatCurrency } from '../lib/utils';
import { Clock, Tag, ExternalLink } from 'lucide-react';

interface InsumoTableProps {
  insumos: Insumo[];
  proveedores: Proveedor[];
  quantities: Record<string, number>;
  onQuantityChange: (id: string, val: number) => void;
}

export default function InsumoTable({ insumos, proveedores, quantities, onQuantityChange }: InsumoTableProps) {
  const getProveedorName = (id: string) => {
    return proveedores.find(p => p.id === id)?.nombre || 'Desconocido';
  };

  return (
    <div className="w-full overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-sm">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50/50 border-b border-slate-200">
            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Insumo</th>
            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Proveedor</th>
            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Categoría</th>
            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Unidad</th>
            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Precio</th>
            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Cantidad</th>
            <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actualizado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {insumos.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-sans italic">
                No se encontraron insumos que coincidan con los filtros.
              </td>
            </tr>
          ) : (
            insumos.map((insumo) => (
              <tr 
                key={insumo.id} 
                className="hover:bg-slate-50/80 transition-colors group"
              >
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-900 group-hover:text-brand-600 transition-colors">
                      {insumo.nombre}
                    </span>
                    <span className="text-xs text-slate-400 font-mono sm:hidden">
                      {insumo.id}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">
                      {getProveedorName(insumo.proveedorId)}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap">
                    <Tag className="w-3 h-3" />
                    {insumo.categoria}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-slate-500">{insumo.unidad}</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-sm font-bold text-slate-900 font-mono tracking-tighter">
                    {formatCurrency(insumo.precio)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-center">
                    <input 
                      type="number"
                      min="0"
                      className="w-16 h-8 text-center bg-slate-50 border border-slate-200 rounded text-sm focus:ring-1 focus:ring-brand-500 outline-none"
                      value={quantities[insumo.id] || ''}
                      onChange={(e) => onQuantityChange(insumo.id, Number(e.target.value))}
                      placeholder="0"
                    />
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Clock className="w-3 h-3" />
                    {insumo.actualizadoAt}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
