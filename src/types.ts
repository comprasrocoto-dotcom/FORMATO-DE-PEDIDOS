export interface Insumo {
  id: string;
  nombre: string;
  categoria: string;
  unidad: string;
  precio: number;
  proveedorId: string;
  actualizadoAt: string;
}

export interface Proveedor {
  id: string;
  nombre: string;
  contacto: string;
  email: string;
  logoColor: string;
  insumosIds: string[];
}
