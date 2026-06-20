// @ts-nocheck
// ============================================================================
//  src/components/AdminPanel.tsx
//  Vista de administración protegida por contraseña (CONFIG!B1).
//  Administra ARTICULOS, PROVEEDORES y CATALOGO_COMPRAS (crear / editar / eliminar).
//  Las llaves (Codigo_Barras, ID_Proveedor) relacionan las hojas; en el catálogo
//  se eligen mediante listas que muestran el nombre comercial / razón social.
// ============================================================================
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Lock, ShieldCheck, RefreshCw, Plus, Search, Edit3, Trash2, Save, X,
  Package, Truck, ClipboardList, AlertCircle, CheckCircle, LogOut, ChevronDown,
} from 'lucide-react';
import { adminGetData, adminUpsert, adminDelete } from '../services/adminApi';

// ── Configuración declarativa de cada hoja ───────────────────────────────────
// type: 'text' | 'number' | 'select' | 'ref'
//  - 'ref' = llave foránea: las opciones salen de otra hoja (refSheet).
const SHEETS: any = {
  ARTICULOS: {
    label: 'Artículos',
    icon: Package,
    keys: ['Codigo_Barras'],
    titulo: (r: any) => r.Articulo_Comercial || r.Articulo_HiOPOS || r.Codigo_Barras,
    campos: [
      { name: 'Codigo_Barras', label: 'Código de Barras', type: 'text', key: true, required: true },
      { name: 'Codigo_Referencia', label: 'Código Referencia', type: 'text' },
      { name: 'Subfamilia_Categoria', label: 'Subfamilia / Categoría', type: 'text' },
      { name: 'Articulo_HiOPOS', label: 'Artículo HiOPOS', type: 'text' },
      { name: 'UniMedida_Formato_HiOPOS', label: 'U. Medida HiOPOS', type: 'text' },
      { name: 'Articulo_Comercial', label: 'Artículo Comercial', type: 'text' },
      { name: 'UniMedida_Compra', label: 'U. Medida Compra', type: 'text' },
      { name: 'Minimo', label: 'Mínimo', type: 'number' },
      { name: 'Maximo', label: 'Máximo', type: 'number' },
    ],
  },
  PROVEEDORES: {
    label: 'Proveedores',
    icon: Truck,
    keys: ['ID_Proveedor'],
    titulo: (r: any) => r.Razon_Social || r.ID_Proveedor,
    campos: [
      { name: 'ID_Proveedor', label: 'ID Proveedor', type: 'text', key: true, required: true },
      { name: 'Razon_Social', label: 'Razón Social', type: 'text' },
      { name: 'Nombre_Comercial', label: 'Nombre Comercial', type: 'text' },
      { name: 'Telefono_Contacto1', label: 'Teléfono 1', type: 'text' },
      { name: 'Telefono_Contacto2', label: 'Teléfono 2', type: 'text' },
      { name: 'Correo_Contacto', label: 'Correo', type: 'text' },
      { name: 'Asesor_Contacto', label: 'Asesor', type: 'text' },
    ],
  },
  CATALOGO_COMPRAS: {
    label: 'Catálogo de Compras',
    icon: ClipboardList,
    keys: ['Codigo_Barras', 'ID_Proveedor'],
    titulo: (r: any) => r.Codigo_Barras + ' · ' + r.ID_Proveedor,
    campos: [
      { name: 'Codigo_Barras', label: 'Artículo', type: 'ref', refSheet: 'ARTICULOS', key: true, required: true },
      { name: 'ID_Proveedor', label: 'Proveedor', type: 'ref', refSheet: 'PROVEEDORES', key: true, required: true },
      { name: 'Prioridad', label: 'Prioridad', type: 'priority' },
      { name: 'Precio_Negociado', label: 'Precio Negociado', type: 'money' },
      { name: 'Estado_Aprobado_Suspendido', label: 'Estado', type: 'select', options: ['Aprobado', 'Suspendido'] },
    ],
  },
};

const SHEET_ORDER = ['ARTICULOS', 'PROVEEDORES', 'CATALOGO_COMPRAS'];

// Prioridad: 1 = más alta, 3 = más baja, con colores.
const PRIO: any = {
  '1': { label: 'Alta',  cls: 'bg-emerald-100 text-emerald-700 border border-emerald-300' },
  '2': { label: 'Media', cls: 'bg-amber-100 text-amber-700 border border-amber-300' },
  '3': { label: 'Baja',  cls: 'bg-rose-100 text-rose-700 border border-rose-300' },
};

// Formatea estilo Colombia: miles con punto, decimales con coma (2 dec).
function formatMoneyCO(v: any) {
  if (v === '' || v === null || v === undefined) return '—';
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/\./g, '').replace(',', '.'));
  if (isNaN(n)) return String(v);
  return n.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Convierte lo que el usuario escribe (con coma o punto) a Number para guardar.
function parseMoney(str: any) {
  if (str === '' || str === null || str === undefined) return '';
  let s = String(str).trim().replace(/[^0-9.,-]/g, '');
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.'); // coma = decimal
  const n = parseFloat(s);
  return isNaN(n) ? '' : n;
}

// Número almacenado -> texto editable con coma decimal (para el input de dinero).
function moneyToInput(v: any) {
  if (v === '' || v === null || v === undefined) return '';
  return String(v).replace('.', ',');
}

// Une partes no vacías con " - " (para etiquetas tipo "código - nombre - ...").
function joinDash(parts: any[]) {
  return parts.map((x) => String(x ?? '').trim()).filter(Boolean).join('  -  ');
}

// ── Buscador con selección (combobox) para llaves foráneas ───────────────────
function RefSelect({ value, options, disabled, onChange, placeholder }: any) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const wrapRef = useRef<any>(null);

  const selected = options.find((o: any) => String(o.value) === String(value)) || null;
  const selectedLabel = selected ? selected.label : '';

  // Texto visible: mientras está ABIERTO muestra lo que escribes (q);
  // cuando está CERRADO muestra la opción elegida. Sin efectos que reescriban.
  const display = open ? q : selectedLabel;

  const filtradas = useMemo(() => {
    const términos = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (términos.length === 0) return options.slice(0, 100);
    return options.filter((o: any) => {
      const texto = (o.label + ' ' + o.value).toLowerCase();
      return términos.every((w: string) => texto.includes(w)); // TODAS las palabras
    }).slice(0, 100);
  }, [q, options]);

  // Cerrar al hacer clic afuera (y limpiar el texto de búsqueda).
  useEffect(() => {
    function onDoc(e: any) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) { setOpen(false); setQ(''); }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  if (disabled) {
    return (
      <div className="w-full px-2.5 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-500 truncate">
        {selectedLabel || (String(value || '') || '—')}
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative w-full">
      <div className="relative flex items-center">
        <Search className="absolute left-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={display}
          onChange={(e) => { setQ(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => { setOpen(true); setQ(''); }}
          placeholder={placeholder || 'Escribe para buscar...'}
          className="w-full pl-8 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-cyan-500 hover:border-slate-300 text-slate-800 truncate"
        />
        <ChevronDown className={'absolute right-2.5 w-4 h-4 text-slate-400 pointer-events-none transition-transform ' + (open ? 'rotate-180' : '')} />
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-[60] mt-1 border border-slate-200 rounded-lg bg-white shadow-xl max-h-60 overflow-y-auto">
          {filtradas.length === 0 ? (
            <div className="px-3 py-3 text-slate-400 text-xs text-center">Sin resultados{q.trim() ? ' para "' + q.trim() + '"' : ''}</div>
          ) : (
            filtradas.map((o: any) => (
              <button
                type="button"
                key={o.value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(o.value); setQ(''); setOpen(false); }}
                className={'w-full text-left px-3 py-2 text-xs hover:bg-cyan-50 border-b border-slate-50 last:border-0 block truncate ' +
                  (String(o.value) === String(value) ? 'bg-cyan-50 font-semibold text-cyan-800' : 'text-slate-700')}
              >
                {o.label}
              </button>
            ))
          )}
          {options.length > 100 && q.trim() === '' && (
            <div className="sticky bottom-0 px-3 py-1.5 text-[10px] text-slate-400 bg-slate-50 border-t border-slate-100">
              Mostrando 100 de {options.length}. Escribe para filtrar.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminPanel() {
  // sesión
  const [pass, setPass] = useState(() => {
    try { return sessionStorage.getItem('admin_pass') || ''; } catch (_) { return ''; }
  });
  const [authed, setAuthed] = useState(false);
  const [passInput, setPassInput] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // datos
  const [data, setData] = useState<any>({ ARTICULOS: [], PROVEEDORES: [], CATALOGO_COMPRAS: [] });
  const [cargando, setCargando] = useState(false);
  const [err, setErr] = useState('');
  const [okMsg, setOkMsg] = useState('');

  // navegación / edición
  const [activeSheet, setActiveSheet] = useState('ARTICULOS');
  const [busq, setBusq] = useState('');
  const [form, setForm] = useState<any>(null);     // record en edición (o null)
  const [esNuevo, setEsNuevo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [confirmDel, setConfirmDel] = useState<any>(null);

  // Si ya había contraseña en sesión, intenta entrar automáticamente.
  useEffect(() => {
    if (pass && !authed) cargar(pass, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargar(password: string, silent = false) {
    if (!silent) setCargando(true);
    setErr('');
    const res = await adminGetData(password);
    if (!res || !res.ok) {
      if (!silent) setErr(res?.error || 'Error cargando datos.');
      setLoginLoading(false);
      setCargando(false);
      return false;
    }
    setData({
      ARTICULOS: (res.articulos && res.articulos.rows) || [],
      PROVEEDORES: (res.proveedores && res.proveedores.rows) || [],
      CATALOGO_COMPRAS: (res.catalogo && res.catalogo.rows) || [],
    });
    setAuthed(true);
    setLoginLoading(false);
    setCargando(false);
    return true;
  }

  async function intentarLogin() {
    const p = passInput.trim();
    if (!p) { setLoginErr('Ingresa la contraseña.'); return; }
    setLoginLoading(true); setLoginErr('');
    const ok = await cargar(p, false);
    if (ok) {
      setPass(p);
      try { sessionStorage.setItem('admin_pass', p); } catch (_) {}
      setPassInput('');
    } else {
      setLoginErr(err || 'Contraseña incorrecta.');
      setLoginLoading(false);
    }
  }

  function salir() {
    try { sessionStorage.removeItem('admin_pass'); } catch (_) {}
    setPass(''); setAuthed(false); setData({ ARTICULOS: [], PROVEEDORES: [], CATALOGO_COMPRAS: [] });
    setForm(null); setConfirmDel(null);
  }

  // Mapas de etiquetas para resolver llaves foráneas (Codigo_Barras -> nombre, etc.)
  const refLabels = useMemo(() => {
    const artMap: any = {};
    (data.ARTICULOS || []).forEach((a: any) => {
      artMap[String(a.Codigo_Barras || '').trim().toUpperCase()] = a.Articulo_Comercial || a.Articulo_HiOPOS || '';
    });
    const provMap: any = {};
    (data.PROVEEDORES || []).forEach((p: any) => {
      provMap[String(p.ID_Proveedor || '').trim().toUpperCase()] = p.Razon_Social || '';
    });
    return { ARTICULOS: artMap, PROVEEDORES: provMap };
  }, [data]);

  // Mapa de artículo COMPLETO por Codigo_Barras (para columnas resueltas del catálogo).
  const artByCode = useMemo(() => {
    const m: any = {};
    (data.ARTICULOS || []).forEach((a: any) => {
      m[String(a.Codigo_Barras || '').trim().toUpperCase()] = a;
    });
    return m;
  }, [data]);

  function articuloDe(codigo: any) {
    return artByCode[String(codigo || '').trim().toUpperCase()] || null;
  }

  // Mapa de proveedor COMPLETO por ID_Proveedor.
  const provById = useMemo(() => {
    const m: any = {};
    (data.PROVEEDORES || []).forEach((p: any) => {
      m[String(p.ID_Proveedor || '').trim().toUpperCase()] = p;
    });
    return m;
  }, [data]);

  function proveedorDe(id: any) {
    return provById[String(id || '').trim().toUpperCase()] || null;
  }

  // Nombre del proveedor: Razón Social + Nombre Comercial (sin ID).
  function proveedorNombre(id: any) {
    const p = proveedorDe(id);
    if (!p) return String(id || '') || '—';
    return joinDash([p.Razon_Social, p.Nombre_Comercial]) || (String(id || '') || '—');
  }

  function refLabel(refSheet: string, value: any) {
    const m = refLabels[refSheet] || {};
    return m[String(value || '').trim().toUpperCase()] || '';
  }

  function refOptions(refSheet: string) {
    if (refSheet === 'ARTICULOS') {
      return (data.ARTICULOS || []).map((a: any) => ({
        value: String(a.Codigo_Barras || ''),
        label: joinDash([a.Codigo_Barras, a.Articulo_HiOPOS, a.UniMedida_Formato_HiOPOS, a.Articulo_Comercial]),
      }));
    }
    if (refSheet === 'PROVEEDORES') {
      return (data.PROVEEDORES || []).map((p: any) => ({
        value: String(p.ID_Proveedor || ''),
        label: joinDash([p.ID_Proveedor, p.Razon_Social, p.Nombre_Comercial]),
      }));
    }
    return [];
  }

  // ── Formulario ──────────────────────────────────────────────────────────────
  function abrirNuevo() {
    const cfg = SHEETS[activeSheet];
    const base: any = {};
    cfg.campos.forEach((c: any) => { base[c.name] = ''; });
    setEsNuevo(true);
    setForm(base);
    setOkMsg('');
  }

  function abrirEditar(record: any) {
    const cfg = SHEETS[activeSheet];
    const copia: any = {};
    cfg.campos.forEach((c: any) => {
      let v = record[c.name] !== undefined ? record[c.name] : '';
      if (c.type === 'money') v = moneyToInput(v);          // a texto con coma para editar
      else if (c.type === 'priority') v = (v === '' ? '' : String(v));
      copia[c.name] = v;
    });
    setEsNuevo(false);
    setForm(copia);
    setOkMsg('');
  }

  function setCampo(name: string, value: any) {
    setForm((prev: any) => Object.assign({}, prev, { [name]: value }));
  }

  async function guardar() {
    const cfg = SHEETS[activeSheet];
    // Validar requeridos / llaves
    for (const c of cfg.campos) {
      if ((c.required || c.key) && String(form[c.name] || '').trim() === '') {
        setErr('El campo "' + c.label + '" es obligatorio.');
        return;
      }
    }
    // En catálogo, evitar duplicar la llave compuesta al CREAR.
    if (esNuevo) {
      const dup = (data[activeSheet] || []).some((r: any) =>
        cfg.keys.every((k: string) => String(r[k] || '').trim().toUpperCase() === String(form[k] || '').trim().toUpperCase())
      );
      if (dup) { setErr('Ya existe un registro con esa(s) llave(s).'); return; }
    }

    // Convertir números reales para que Sheets los guarde como número.
    const record: any = {};
    cfg.campos.forEach((c: any) => {
      let v = form[c.name];
      if (c.type === 'number') v = (v === '' || v === null || v === undefined) ? '' : Number(v);
      else if (c.type === 'money') v = parseMoney(v);
      else if (c.type === 'priority') v = (v === '' || v === null || v === undefined) ? '' : Number(v);
      record[c.name] = v;
    });

    setGuardando(true); setErr('');
    const res = await adminUpsert(activeSheet, record, pass);
    setGuardando(false);
    if (!res || !res.ok) { setErr(res?.error || 'Error al guardar.'); return; }
    setOkMsg(res.accion === 'creado' ? 'Registro creado.' : 'Registro actualizado.');
    setForm(null);
    await cargar(pass, true);
    setTimeout(() => setOkMsg(''), 4000);
  }

  async function eliminar(record: any) {
    const cfg = SHEETS[activeSheet];
    const llave: any = {};
    cfg.keys.forEach((k: string) => { llave[k] = record[k]; });
    setGuardando(true); setErr('');
    const res = await adminDelete(activeSheet, llave, pass);
    setGuardando(false); setConfirmDel(null);
    if (!res || !res.ok) { setErr(res?.error || 'Error al eliminar.'); return; }
    setOkMsg('Registro eliminado.');
    await cargar(pass, true);
    setTimeout(() => setOkMsg(''), 4000);
  }

  // ── Filtro de la tabla ───────────────────────────────────────────────────────
  const filas = useMemo(() => {
    const cfg = SHEETS[activeSheet];
    const términos = busq.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const rows = data[activeSheet] || [];
    if (términos.length === 0) return rows;
    return rows.filter((r: any) => {
      let texto = cfg.campos.map((c: any) => String(r[c.name] ?? '')).join(' ');
      if (activeSheet === 'CATALOGO_COMPRAS') {
        const art = articuloDe(r.Codigo_Barras);
        const prov = proveedorDe(r.ID_Proveedor);
        if (art) texto += ' ' + [art.Codigo_Referencia, art.Subfamilia_Categoria, art.Articulo_HiOPOS, art.UniMedida_Formato_HiOPOS, art.Articulo_Comercial, art.UniMedida_Compra].join(' ');
        if (prov) texto += ' ' + [prov.Razon_Social, prov.Nombre_Comercial].join(' ');
      }
      texto = texto.toLowerCase();
      return términos.every((t: string) => texto.includes(t)); // todas las palabras
    });
  }, [data, activeSheet, busq, refLabels]);

  // ───────────────────────────── LOGIN ─────────────────────────────────────────
  if (!authed) {
    return (
      <div className="max-w-md mx-auto mt-10">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 flex items-center gap-3" style={{ background: '#1a3c6e' }}>
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-white font-bold text-sm">Panel de Administración</div>
              <div className="text-blue-300 text-xs">Acceso restringido</div>
            </div>
          </div>
          <div className="p-6 space-y-3">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Contraseña</label>
            <input
              type="password"
              value={passInput}
              onChange={(e) => setPassInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') intentarLogin(); }}
              placeholder="••••••••"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-cyan-500"
              autoFocus
            />
            {loginErr && (
              <div className="flex items-center gap-2 text-red-600 text-xs">
                <AlertCircle className="w-4 h-4" /> {loginErr}
              </div>
            )}
            <button
              onClick={intentarLogin}
              disabled={loginLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: '#1a3c6e' }}
            >
              {loginLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              {loginLoading ? 'Verificando...' : 'Ingresar'}
            </button>
            <p className="text-[11px] text-slate-400 text-center">La contraseña se valida en el servidor (hoja CONFIG, celda B1).</p>
          </div>
        </div>
      </div>
    );
  }

  const cfg = SHEETS[activeSheet];

  // ───────────────────────────── PANEL ─────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4" style={{ background: '#1a3c6e' }}>
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-cyan-300" />
            <div>
              <div className="text-white font-bold text-sm">Panel de Administración</div>
              <div className="text-blue-300 text-xs">Artículos · Proveedores · Catálogo de Compras · buscador v2</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => cargar(pass, false)} disabled={cargando}
              className="flex items-center gap-1.5 text-xs text-blue-200 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 transition-all disabled:opacity-50">
              <RefreshCw className={'w-3.5 h-3.5 ' + (cargando ? 'animate-spin' : '')} /> Actualizar
            </button>
            <button onClick={salir}
              className="flex items-center gap-1.5 text-xs text-blue-200 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 transition-all">
              <LogOut className="w-3.5 h-3.5" /> Salir
            </button>
          </div>
        </div>

        {/* Sub-pestañas de hoja */}
        <div className="flex flex-wrap gap-2 p-3 border-b border-slate-100">
          {SHEET_ORDER.map((s) => {
            const Icon = SHEETS[s].icon;
            const activo = activeSheet === s;
            return (
              <button key={s}
                onClick={() => { setActiveSheet(s); setBusq(''); setForm(null); }}
                className={'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ' +
                  (activo ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400')}>
                <Icon className="w-3.5 h-3.5" /> {SHEETS[s].label}
                <span className={'ml-1 px-1.5 rounded-full text-[10px] ' + (activo ? 'bg-white/20' : 'bg-slate-100')}>
                  {(data[s] || []).length}
                </span>
              </button>
            );
          })}
        </div>

        {/* Barra de acciones */}
        <div className="flex flex-col sm:flex-row gap-2 p-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input type="text" value={busq} onChange={(e) => setBusq(e.target.value)}
              placeholder={'Buscar en ' + cfg.label + '...'}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-cyan-500" />
          </div>
          <button onClick={abrirNuevo}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: '#0f6b3a' }}>
            <Plus className="w-4 h-4" /> Nuevo
          </button>
        </div>

        {err && <div className="mx-3 mb-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm"><AlertCircle className="w-4 h-4 flex-shrink-0" />{err}<button onClick={() => setErr('')} className="ml-auto text-xs underline">cerrar</button></div>}
        {okMsg && <div className="mx-3 mb-3 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-700 text-sm"><CheckCircle className="w-4 h-4 flex-shrink-0" />{okMsg}</div>}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {cargando ? (
          <div className="p-10 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Cargando...
          </div>
        ) : filas.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">Sin registros{busq ? ' para "' + busq + '"' : ''}.</div>
        ) : (
          <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
            <table className="w-full text-xs whitespace-nowrap">
              <thead className="sticky top-0 z-10">
                <tr style={{ background: '#1a3c6e' }}>
                  {activeSheet === 'CATALOGO_COMPRAS' ? (
                    <>
                      <th className="py-2.5 px-3 text-left text-white font-bold uppercase tracking-wider">Código de Barras</th>
                      <th className="py-2.5 px-3 text-left text-white font-bold uppercase tracking-wider">Categoría</th>
                      <th className="py-2.5 px-3 text-left text-white font-bold uppercase tracking-wider">Referencia</th>
                      <th className="py-2.5 px-3 text-left text-white font-bold uppercase tracking-wider">Nombre y Unidad HiOPOS</th>
                      <th className="py-2.5 px-3 text-left text-white font-bold uppercase tracking-wider">Nombre y Unidad Comercial</th>
                      <th className="py-2.5 px-3 text-left text-white font-bold uppercase tracking-wider">Proveedor</th>
                      <th className="py-2.5 px-3 text-left text-white font-bold uppercase tracking-wider">Prioridad</th>
                      <th className="py-2.5 px-3 text-left text-white font-bold uppercase tracking-wider">Precio Negociado</th>
                      <th className="py-2.5 px-3 text-left text-white font-bold uppercase tracking-wider">Estado</th>
                    </>
                  ) : (
                    cfg.campos.map((c: any) => (
                      <th key={c.name} className="py-2.5 px-3 text-left text-white font-bold uppercase tracking-wider">{c.label}</th>
                    ))
                  )}
                  <th className="py-2.5 px-3 text-center text-white font-bold uppercase tracking-wider w-24">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((r: any, i: number) => {
                  const art = activeSheet === 'CATALOGO_COMPRAS' ? articuloDe(r.Codigo_Barras) : null;
                  return (
                  <tr key={i} className={'border-b border-slate-100 ' + (i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60')}>
                    {activeSheet === 'CATALOGO_COMPRAS' ? (
                      <>
                        {/* 1. Código de Barras */}
                        <td className="py-2 px-3"><span className="font-mono font-semibold text-slate-800">{r.Codigo_Barras || '---'}</span></td>
                        {/* 2. Categoría */}
                        <td className="py-2 px-3 text-slate-600">{art && String(art.Subfamilia_Categoria ?? '').trim() ? String(art.Subfamilia_Categoria) : '—'}</td>
                        {/* 3. Referencia */}
                        <td className="py-2 px-3 text-slate-600">{art && String(art.Codigo_Referencia ?? '').trim() ? String(art.Codigo_Referencia) : '—'}</td>
                        {/* 4. Nombre y Unidad HiOPOS */}
                        <td className="py-2 px-3">
                          <div className="text-slate-800 font-medium">{art && String(art.Articulo_HiOPOS ?? '').trim() ? String(art.Articulo_HiOPOS) : '—'}</div>
                          <div className="text-[11px] text-slate-500">{art && String(art.UniMedida_Formato_HiOPOS ?? '').trim() ? String(art.UniMedida_Formato_HiOPOS) : ''}</div>
                        </td>
                        {/* 5. Nombre y Unidad Comercial */}
                        <td className="py-2 px-3">
                          <div className="text-slate-800 font-medium">{art && String(art.Articulo_Comercial ?? '').trim() ? String(art.Articulo_Comercial) : '—'}</div>
                          <div className="text-[11px] text-slate-500">{art && String(art.UniMedida_Compra ?? '').trim() ? String(art.UniMedida_Compra) : ''}</div>
                        </td>
                        {/* 6. Proveedor (Razón Social + Nombre Comercial, sin ID) */}
                        <td className="py-2 px-3 text-slate-700">{proveedorNombre(r.ID_Proveedor)}</td>
                        {/* 7. Prioridad */}
                        <td className="py-2 px-3">
                          {(r.Prioridad !== '' && r.Prioridad != null) ? (
                            <span className={'px-2 py-0.5 rounded-full text-[10px] font-bold ' + ((PRIO[String(r.Prioridad)] || {}).cls || 'bg-slate-100 text-slate-500')}>
                              {String(r.Prioridad)}{PRIO[String(r.Prioridad)] ? ' · ' + PRIO[String(r.Prioridad)].label : ''}
                            </span>
                          ) : '—'}
                        </td>
                        {/* 8. Precio Negociado */}
                        <td className="py-2 px-3"><span className="font-medium text-slate-800">$ {formatMoneyCO(r.Precio_Negociado)}</span></td>
                        {/* 9. Estado */}
                        <td className="py-2 px-3">
                          <span className={'px-2 py-0.5 rounded-full text-[10px] font-semibold ' +
                            (String(r.Estado_Aprobado_Suspendido).toLowerCase().indexOf('suspend') >= 0
                              ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700')}>
                            {r.Estado_Aprobado_Suspendido || '---'}
                          </span>
                        </td>
                      </>
                    ) : (
                      cfg.campos.map((c: any) => (
                        <td key={c.name} className="py-2 px-3 text-slate-700">
                          {c.type === 'priority' ? (
                            (r[c.name] !== '' && r[c.name] != null) ? (
                              <span className={'px-2 py-0.5 rounded-full text-[10px] font-bold ' + ((PRIO[String(r[c.name])] || {}).cls || 'bg-slate-100 text-slate-500')}>
                                {String(r[c.name])}{PRIO[String(r[c.name])] ? ' · ' + PRIO[String(r[c.name])].label : ''}
                              </span>
                            ) : '—'
                          ) : c.type === 'money' ? (
                            <span className="font-medium text-slate-800">$ {formatMoneyCO(r[c.name])}</span>
                          ) : c.name === 'Estado_Aprobado_Suspendido' ? (
                            <span className={'px-2 py-0.5 rounded-full text-[10px] font-semibold ' +
                              (String(r[c.name]).toLowerCase().indexOf('suspend') >= 0
                                ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700')}>
                              {r[c.name] || '---'}
                            </span>
                          ) : c.key ? (
                            <span className="font-mono font-semibold text-slate-800">{r[c.name] || '---'}</span>
                          ) : (
                            String(r[c.name] ?? '') || '---'
                          )}
                        </td>
                      ))
                    )}
                    <td className="py-2 px-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => abrirEditar(r)} title="Editar"
                          className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 flex items-center justify-center">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setConfirmDel(r)} title="Eliminar"
                          className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de formulario (crear / editar) */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-8">
            <div className="flex items-center justify-between px-5 py-4 rounded-t-2xl" style={{ background: '#1a3c6e' }}>
              <div className="text-white font-bold text-sm flex items-center gap-2">
                {esNuevo ? <Plus className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                {esNuevo ? 'Nuevo en ' : 'Editar en '} {cfg.label}
              </div>
              <button onClick={() => setForm(null)} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {cfg.campos.map((c: any) => {
                const bloqueadoLlave = c.key && !esNuevo; // no se cambia la llave al editar
                return (
                  <div key={c.name} className={c.type === 'ref' || c.name === 'Articulo_Comercial' || c.name === 'Razon_Social' ? 'sm:col-span-2' : ''}>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      {c.label}{(c.required || c.key) && <span className="text-red-500"> *</span>}
                      {bloqueadoLlave && <span className="ml-1 text-[9px] text-slate-300 normal-case">(llave, no editable)</span>}
                    </label>

                    {c.type === 'ref' ? (
                      <RefSelect
                        value={form[c.name] || ''}
                        options={refOptions(c.refSheet)}
                        disabled={bloqueadoLlave}
                        onChange={(v: any) => setCampo(c.name, v)}
                        placeholder="Buscar y seleccionar..."
                      />
                    ) : c.type === 'select' ? (
                      <select
                        value={form[c.name] || ''}
                        onChange={(e) => setCampo(c.name, e.target.value)}
                        className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-cyan-500">
                        <option value="">Seleccionar...</option>
                        {c.options.map((o: string) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : c.type === 'priority' ? (
                      <select
                        value={form[c.name] || ''}
                        onChange={(e) => setCampo(c.name, e.target.value)}
                        className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-cyan-500">
                        <option value="">Seleccionar...</option>
                        <option value="1">1 — Alta</option>
                        <option value="2">2 — Media</option>
                        <option value="3">3 — Baja</option>
                      </select>
                    ) : c.type === 'money' ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={form[c.name] ?? ''}
                        onChange={(e) => setCampo(c.name, e.target.value)}
                        className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-cyan-500" />
                    ) : (
                      <input
                        type={c.type === 'number' ? 'number' : 'text'}
                        step={c.type === 'number' ? 'any' : undefined}
                        value={form[c.name] ?? ''}
                        disabled={bloqueadoLlave}
                        onChange={(e) => setCampo(c.name, e.target.value)}
                        className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-cyan-500 disabled:opacity-60" />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-slate-100">
              <button onClick={guardar} disabled={guardando}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: '#0f6b3a' }}>
                {guardando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={() => setForm(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmación de borrado */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-5">
              <div className="flex items-center gap-2 text-red-600 font-bold text-sm mb-2">
                <Trash2 className="w-4 h-4" /> Eliminar registro
              </div>
              <p className="text-sm text-slate-600">
                ¿Seguro que deseas eliminar <span className="font-semibold">{cfg.titulo(confirmDel)}</span> de {cfg.label}? Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="flex gap-2 px-5 py-4 border-t border-slate-100">
              <button onClick={() => eliminar(confirmDel)} disabled={guardando}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">
                {guardando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Eliminar
              </button>
              <button onClick={() => setConfirmDel(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
