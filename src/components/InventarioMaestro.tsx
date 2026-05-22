// @ts-nocheck
/**
 * InventarioMaestro.tsx
 * Muestra la base maestra de inventario procesada desde Drive
 * Clasificacion: subcv.* = SUBRECETA, resto = INSUMO
 * Columnas: Consumo Real, Promedio Diario, Inventario Sugerido, Tipo
 */
import { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, Search, Package, BarChart2 } from 'lucide-react';
import { getInventarioMaestro } from '../services/googleSheets';

export default function InventarioMaestro() {
  var [data, setData] = useState([]);
  var [loading, setLoading] = useState(true);
  var [error, setError] = useState('');
  var [busqueda, setBusqueda] = useState('');
  var [tipoFiltro, setTipoFiltro] = useState('TODOS');
  var [ordenCol, setOrdenCol] = useState('consumoReal');
  var [ordenDesc, setOrdenDesc] = useState(true);
  var [ultimaAct, setUltimaAct] = useState('');

  useEffect(function() { cargar(); }, []);

  async function cargar() {
    setLoading(true); setError('');
    try {
      var res = await getInventarioMaestro();
      setData(res);
      if (res.length > 0) setUltimaAct(res[0].fechaActualizacion || '');
    } catch(e) { setError('Error cargando inventario: ' + e.message); }
    finally { setLoading(false); }
  }

  var filtrado = data.filter(function(r) {
    var pasaTipo = tipoFiltro === 'TODOS' || r.tipo === tipoFiltro;
    var pasaBusq = !busqueda || r.nombre.toLowerCase().includes(busqueda.toLowerCase());
    return pasaTipo && pasaBusq;
  });

  // Ordenar
  filtrado = filtrado.slice().sort(function(a, b) {
    var va = a[ordenCol] || 0;
    var vb = b[ordenCol] || 0;
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return ordenDesc ? 1 : -1;
    if (va > vb) return ordenDesc ? -1 : 1;
    return 0;
  });

  var totalInsumos = data.filter(function(r){ return r.tipo === 'INSUMO'; }).length;
  var totalSubrecetas = data.filter(function(r){ return r.tipo === 'SUBRECETA'; }).length;

  function thClick(col) {
    if (ordenCol === col) setOrdenDesc(!ordenDesc);
    else { setOrdenCol(col); setOrdenDesc(true); }
  }

  function ThBtn({ col, label }) {
    var active = ordenCol === col;
    return (
      <th onClick={function(){ thClick(col); }}
        className={"py-3 px-3 text-[10px] uppercase tracking-wider font-bold cursor-pointer select-none whitespace-nowrap " + (active ? 'text-cyan-300' : 'text-white')}>
        {label} {active ? (ordenDesc ? '↓' : '↑') : ''}
      </th>
    );
  }

  function fmt(n) {
    if (n === 0 || n === undefined || n === null) return '—';
    return Number(n).toLocaleString('es-CO', { maximumFractionDigits: 3 });
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-64 gap-3 text-slate-500">
      <RefreshCw className="w-5 h-5 animate-spin"/>
      <span className="text-sm font-medium">Cargando inventario maestro...</span>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-5">

      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5"/>
          <div><p className="font-semibold text-sm">Error</p><p className="text-xs mt-0.5">{error}</p></div>
          <button onClick={function(){ setError(''); }} className="text-xs underline ml-auto">Cerrar</button>
        </div>
      )}

      {/* Cabecera y estadísticas */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-5">
          <div>
            <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-cyan-500"/> Inventario Maestro
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Base procesada desde Drive · {data.length} productos{ultimaAct ? ' · Actualizado: ' + ultimaAct : ''}</p>
          </div>
          <button onClick={cargar} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-40">
            <RefreshCw className={"w-4 h-4 " + (loading?'animate-spin':'')}/> Actualizar
          </button>
        </div>

        {/* Tarjetas resumen */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Total Productos', val: data.length, color: 'bg-slate-50 border-slate-200', txt: 'text-slate-800' },
            { label: 'Insumos', val: totalInsumos, color: 'bg-emerald-50 border-emerald-200', txt: 'text-emerald-700' },
            { label: 'Subrecetas', val: totalSubrecetas, color: 'bg-blue-50 border-blue-200', txt: 'text-blue-700' },
            { label: 'Mostrando', val: filtrado.length, color: 'bg-amber-50 border-amber-200', txt: 'text-amber-700' },
          ].map(function(c) {
            return (
              <div key={c.label} className={"rounded-xl border p-3 " + c.color}>
                <div className={"text-2xl font-bold " + c.txt}>{c.val}</div>
                <div className="text-xs text-slate-500 mt-0.5">{c.label}</div>
              </div>
            );
          })}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"/>
            <input type="text" value={busqueda} onChange={function(e){setBusqueda(e.target.value);}}
              placeholder="Buscar producto..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500"/>
          </div>
          <div className="flex gap-2">
            {['TODOS','INSUMO','SUBRECETA'].map(function(t) {
              return (
                <button key={t} onClick={function(){ setTipoFiltro(t); }}
                  className={"px-4 py-2.5 rounded-lg text-xs font-semibold transition-all border " +
                    (tipoFiltro===t ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-400')}>
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{background:'#1a3c6e'}}>
                <ThBtn col="nombre" label="Producto"/>
                <th className="py-3 px-3 text-[10px] uppercase tracking-wider font-bold text-white text-center w-24">Tipo</th>
                <ThBtn col="consumoReal" label="Consumo Real"/>
                <ThBtn col="promDiario" label="Prom. Diario"/>
                <ThBtn col="inventarioSugerido" label="Inv. Sugerido (3d)"/>
                <ThBtn col="vendidoTotal" label="Vendido"/>
                <ThBtn col="trasladoTotal" label="Trasladado"/>
                <ThBtn col="fabricadoTotal" label="Fabricado"/>
              </tr>
            </thead>
            <tbody>
              {filtrado.length === 0 && (
                <tr><td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                  {loading ? 'Cargando...' : 'No hay productos que coincidan con el filtro.'}
                </td></tr>
              )}
              {filtrado.map(function(r, idx) {
                var esSubreceta = r.tipo === 'SUBRECETA';
                var rowBg = idx % 2 === 0 ? (esSubreceta ? 'bg-blue-50/40' : 'bg-white') : (esSubreceta ? 'bg-blue-50/70' : 'bg-slate-50/50');
                return (
                  <tr key={r.nombre + idx} className={"border-b border-slate-100 hover:bg-cyan-50/30 transition-colors " + rowBg}>
                    <td className="py-2.5 px-3 font-medium text-slate-800 max-w-xs">
                      <div className="truncate" title={r.nombre}>{r.nombre}</div>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={"px-2 py-0.5 rounded-full text-[10px] font-bold border " +
                        (esSubreceta ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200')}>
                        {r.tipo}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-700">{fmt(r.consumoReal)}</td>
                    <td className="py-2.5 px-3 text-right text-slate-600">{fmt(r.promDiario)}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={"font-semibold " + (r.inventarioSugerido > 0 ? 'text-cyan-700' : 'text-slate-400')}>{fmt(r.inventarioSugerido)}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-500 text-xs">{fmt(r.vendidoTotal)}</td>
                    <td className="py-2.5 px-3 text-right text-slate-500 text-xs">{fmt(r.trasladoTotal)}</td>
                    <td className="py-2.5 px-3 text-right text-slate-500 text-xs">{fmt(r.fabricadoTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtrado.length > 0 && (
          <div className="px-4 py-2 text-xs text-slate-400 border-t border-slate-100">
            Mostrando {filtrado.length} de {data.length} productos · Ordenado por {ordenCol} {ordenDesc ? '↓' : '↑'}
          </div>
        )}
      </div>
    </div>
  );
}
