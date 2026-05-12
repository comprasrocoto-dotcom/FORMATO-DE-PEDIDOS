export interface Insumo {
    id: string;
    nombre: string;
    categoria: string;
    unidad: string;
    precio: number;
    proveedorId: string;
    actualizadoAt: string;
    codBarras?: string;
}

export interface Proveedor {
    id: string;
    nombre: string;
    contacto: string;
    email: string;
    logoColor: string;
    insumosIds: string[];
}

export interface Pedido {
    id?: string;
    proveedor: string;
    proveedorEmail: string;
    puntoDeVenta: string;
    direccionEntrega: string;
    horarioRecepcion: string;
    responsable: string;
    correoResponsable: string;
    notas: string;
    fecha: string;
    numeroPedido: string;
    items: ItemPedido[];
    total: number;
    creadoEn?: string;
}

export interface ItemPedido {
    insumoId: string;
    nombre: string;
    categoria: string;
    unidad: string;
    precio: number;
    cantidad: number;
    subtotal: number;
}
