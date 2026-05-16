import { motion } from 'motion/react';
import { Search, Filter, LayoutGrid, List, ChevronDown, Package, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface FiltersProps {
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  selectedProveedorId: string;
  setSelectedProveedorId: (val: string) => void;
  selectedCategory: string;
  setSelectedCategory: (val: string) => void;
  viewMode: 'list' | 'grid';
  setViewMode: (val: 'list' | 'grid') => void;
  proveedores: { id: string; nombre: string }[];
  categories: string[];
}

export default function Filters({
  searchTerm,
  setSearchTerm,
  selectedProveedorId,
  setSelectedProveedorId,
  selectedCategory,
  setSelectedCategory,
  viewMode,
  setViewMode,
  proveedores,
  categories,
}: FiltersProps) {
  return (
    <div className="bg-white border-b sticky top-0 z-20 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Search Bar */}
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
            <input
              type="text"
              placeholder="Buscar insumo, categoría o proveedor..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-sans text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Proveedor Filter */}
            <div className="relative min-w-[200px] group">
              <select
                id="proveedor"
                className="w-full appearance-none pl-3 pr-10 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-sans text-sm cursor-pointer hover:border-slate-300"
                value={selectedProveedorId}
                onChange={(e) => setSelectedProveedorId(e.target.value)}
              >
                <option value="">🛒 Todos los Proveedores</option>
                {proveedores.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-hover:text-slate-600 transition-colors" />
            </div>

            {/* Category Filter */}
            <div className="relative min-w-[160px] group">
              <select
                className="w-full appearance-none pl-3 pr-10 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-sans text-sm cursor-pointer hover:border-slate-300"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="">📦 Artículo</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-hover:text-slate-600 transition-colors" />
            </div>

            {/* View Mode Toggle */}
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  "p-1.5 rounded-md transition-all flex items-center gap-2 text-xs font-medium",
                  viewMode === 'list' ? "bg-white shadow-sm text-brand-600" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <List className="w-4 h-4" />
                <span className="hidden sm:inline">Tabla</span>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  "p-1.5 rounded-md transition-all flex items-center gap-2 text-xs font-medium",
                  viewMode === 'grid' ? "bg-white shadow-sm text-brand-600" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline">Catálogo</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
