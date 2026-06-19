# Sistema de Pedidos - Compras Rocoto (InsumoMaster)

Aplicacion web de gestion de pedidos de compra para Restaurantes Rocoto.
Los datos viven en Google Sheets y se acceden a traves de un backend en Google Apps Script.
La aplicacion se construye con Vite + React y se despliega en Vercel.

URL de produccion: https://formato-de-pedidos.vercel.app

## Arquitectura del Sistema

```
GitHub (codigo fuente)
   |
   v
Vercel (despliegue automatico en cada push a main, via integracion Git nativa)
   |
   |-- Lee y escribe datos --> Google Apps Script Web App (?action=getDatos, appendPedido, etc.)
   |                                   |
   |                                   v
   |                            Google Sheets (FORMATO DE PEDIDOS)
   |
   |-- Genera --------------> PDF descargable en el navegador (jsPDF via CDN)
```

NOTA IMPORTANTE: toda la lectura y escritura de datos pasa por el Apps Script Web App.
La aplicacion NO usa la Google Sheets API directa, ni Firebase en su flujo actual.

## Modulos (pestanas de la app)

- Pedido desde Drive: crea pedidos leyendo proveedores, sedes y productos desde el Sheet (via Apps Script). Genera un PDF de orden de compra y guarda el pedido en el Sheet.
- Historico de Pedidos: consulta los pedidos registrados, con filtros por sede y busqueda.
- Ajuste de Pedidos: edita cantidades y datos de pedidos existentes.

## Configuracion Inicial

### 1. Clonar el repositorio
```
git clone https://github.com/comprasrocoto-dotcom/FORMATO-DE-PEDIDOS.git
cd FORMATO-DE-PEDIDOS
npm install
```

### 2. Variables de entorno

Copia `.env.example` como `.env.local` y completa el valor:

```
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/TU_DESPLIEGUE/exec
```

Esta es la unica variable que la aplicacion necesita actualmente. Apunta al Web App de Apps Script desplegado que sirve y recibe los datos del Sheet.

### 3. Ejecutar localmente

```
npm run dev
```

Abre http://localhost:3000

## Despliegue en Vercel

El proyecto esta conectado a Vercel mediante la integracion Git nativa. Cada push a la rama `main` dispara un despliegue de produccion automatico. Los push a otras ramas generan un despliegue de Preview con su propia URL temporal.

Para configurar variables de entorno en Vercel: Settings > Environment Variables > agregar `VITE_APPS_SCRIPT_URL`.

## Estructura de Google Sheets

El spreadsheet "FORMATO DE PEDIDOS" contiene, entre otras, las siguientes hojas:

| Hoja | Descripcion |
| --- | --- |
| PROVEEDORES | Lista de proveedores y sus datos de contacto |
| ARTICULOS | Articulos / productos por proveedor |
| CATALOGO_COMPRAS | Catalogo de compras |
| MASTER_PEDIDO / DETALLE_PEDIDO | Estructura de pedidos |
| BASE DE PEDIDOS | Registro historico de pedidos (escritura) |
| BASE DE COMPRAS | Registro de compras |
| UNIDAD DE MEDIDA | Unidades y factores de conversion |
| SEDE | Sedes de entrega |
| MAXIMO Y MINIMOS | Minimos y maximos por sede/producto |

La forma exacta de leer cada hoja la define el backend de Apps Script (ver `apps-script-backend.js`).

## Estructura de Archivos (src/)

```
src/
  App.tsx              # Componente principal con las 3 pestanas
  main.tsx             # Punto de entrada
  index.css            # Estilos (Tailwind)
  types.ts             # Tipos TypeScript
  components/
    SheetsOrderForm.tsx  # Formulario de pedido + historial + PDF
    AjustePedidos.tsx    # Ajuste de pedidos existentes
  services/
    googleSheets.ts      # Cliente del backend Apps Script
  utils/
    pdfGenerator.ts      # Generacion de PDF con jsPDF

apps-script-backend.js   # Codigo del backend (Web App de Apps Script)
```

## Generacion de PDF

El PDF de la orden de compra se genera en el navegador con jsPDF (cargado por CDN). Incluye encabezado, datos de proveedor y sede, tabla de productos y totales.

## Codigo legacy (no usado actualmente)

El repositorio conserva archivos de una arquitectura anterior basada en Firebase (`firebase-*.json`, `firestore.rules`, `src/lib/firebase.ts`, `src/services/db.ts`, `src/components/InsumoTable.tsx`, `src/components/ProveedorCard.tsx`, `src/components/Filters.tsx`, `src/data/mockData.ts`). El flujo actual de la aplicacion NO los utiliza.

## Proximos pasos recomendados

- Reactivar el chequeo de tipos (quitar los @ts-nocheck).
- Dividir el componente SheetsOrderForm.tsx en piezas mas pequenas.
- Agregar autenticacion para controlar quien puede crear pedidos.
- Validar las entradas de texto libre en el formulario.
