# Sistema de Pedidos - Compras Rocoto

Aplicacion web de gestion de compras conectada a **Google Drive (Sheets)** y **Firebase**, desplegada automaticamente via **Vercel** desde **GitHub**.

**URL produccion:** https://formato-de-pedidos.vercel.app

---

## Arquitectura del Sistema

```
GitHub (codigo fuente)
    |
    v
Vercel (despliegue automatico en cada push)
    |
    |-- Lee datos de --> Google Sheets (Proveedores, Productos, Sedes)
    |-- Guarda en ----> Firebase Firestore (Pedidos, Consecutivos)
    |-- Genera -------> PDF descargable en el navegador
```

---

## Modulos

### Tab 1: Catalogo Firebase
- Lista de insumos y proveedores almacenados en Firestore
- - Filtros por proveedor, categoria, busqueda
  - - Vista lista o tarjetas por proveedor
    - - Generacion de PDF de orden de compra
     
      - ### Tab 2: Pedido desde Drive (NUEVO)
      - - Lee proveedores directamente de Google Sheets (hoja PRINCIPAL)
        - - Carga sedes desde la hoja SEDE
          - - Para cada proveedor carga sus productos desde su hoja individual
            - - Genera PDF profesional con encabezado, tabla de productos y firma
              - - Guarda el consecutivo en Firebase
               
                - ---

                ## Configuracion Inicial

                ### 1. Clonar el repositorio
                ```bash
                git clone https://github.com/comprasrocoto-dotcom/FORMATO-DE-PEDIDOS.git
                cd FORMATO-DE-PEDIDOS
                npm install
                ```

                ### 2. Variables de entorno
                Copia `.env.example` como `.env.local` y completa:

                ```env
                GEMINI_API_KEY=tu_clave_gemini
                VITE_SHEETS_ID=1Yhpeb3aOJiW05XIEWcMPIjLl_ibr9xVa
                VITE_SHEETS_API_KEY=tu_google_api_key
                ```

                ### 3. Obtener Google Sheets API Key
                1. Ve a https://console.cloud.google.com
                2. 2. Crea o selecciona un proyecto
                   3. 3. Busca **"Google Sheets API"** y habilitala
                      4. 4. Ve a **Credenciales** > **Crear credenciales** > **Clave de API**
                         5. 5. Restringe la clave a:
                            6.    - Aplicaciones HTTP/sitio web
                                  -    - Dominios: `localhost`, `*.vercel.app`, tu dominio custom
                                       - 6. Copia la clave en `VITE_SHEETS_API_KEY`
                                        
                                         7. > **IMPORTANTE:** El Google Spreadsheet debe tener acceso publico (compartir > cualquier persona con el enlace puede ver) O el API Key debe tener los permisos correctos.
                                            >
                                            > ### 4. Ejecutar localmente
                                            > ```bash
                                            > npm run dev
                                            > # Abre http://localhost:3000
                                            > ```
                                            >
                                            > ---
                                            >
                                            > ## Despliegue en Vercel (automatico desde GitHub)
                                            >
                                            > El proyecto ya esta conectado a Vercel. Cada push a `main` despliega automaticamente.
                                            >
                                            > Para configurar variables de entorno en Vercel:
                                            > 1. Ve a https://vercel.com/comprasrocoto-dotcom/formato-de-pedidos/settings/environment-variables
                                            > 2. 2. Agrega:
                                            >    3.    - `VITE_SHEETS_ID` = ID del spreadsheet
                                            >          -    - `VITE_SHEETS_API_KEY` = tu API key de Google
                                            >               -    - `GEMINI_API_KEY` = tu clave de Gemini
                                            >                
                                            >                    - ---
                                            >
                                            > ## Estructura de Google Sheets
                                            >
                                            > El spreadsheet `FORMATO DE PEDIDOS.xlsx` debe tener:
                                            >
                                            > | Hoja | Descripcion | Columnas |
                                            > |------|-------------|---------|
                                            > | `PRINCIPAL` | Lista de proveedores | A: Nombre, B: Telefono, C: Correo, D: Asesor, E: Medio Pago |
                                            > | `SEDE` | Sedes de entrega | A: Nombre, B: Direccion, C: Hora Entrega, D: Telefono |
                                            > | `BASE DE PEDIDOS` | Registro de pedidos (escritura) | Auto-generado |
                                            > | `[NOMBRE PROVEEDOR]` | Hoja individual por proveedor | A: Codigo, B: Articulo, C: SubArticulo, D: Pedido |
                                            >
                                            > ---
                                            >
                                            > ## Estructura de Archivos
                                            >
                                            > ```
                                            > src/
                                            >   components/
                                            >     SheetsOrderForm.tsx   # Formulario pedido conectado a Sheets (NUEVO)
                                            >     InsumoTable.tsx       # Tabla de insumos Firebase
                                            >     ProveedorCard.tsx     # Tarjeta por proveedor Firebase
                                            >     Filters.tsx           # Barra de filtros
                                            >   services/
                                            >     googleSheets.ts       # Servicio API Google Sheets (NUEVO)
                                            >     db.ts                 # Servicio Firebase Firestore
                                            >   data/
                                            >     mockData.ts           # Datos de respaldo Firebase
                                            >   lib/
                                            >     firebase.ts           # Configuracion Firebase
                                            >     utils.ts              # Utilidades
                                            >   App.tsx                 # Componente principal con tabs
                                            >   types.ts                # Tipos TypeScript
                                            > ```
                                            >
                                            > ---
                                            >
                                            > ## Generacion de PDF
                                            >
                                            > El sistema genera PDFs automaticamente usando `html2pdf.js` con:
                                            > - Encabezado con logo ROCOTO y numero de orden
                                            > - - Informacion del proveedor (izquierda)
                                            >   - - Sede de entrega (derecha)
                                            >     - - Tabla de productos con codigo, articulo, subArticulo y cantidad
                                            >       - - Observaciones y firma del responsable
                                            >         - - Formato carta, margenes amplios
                                            >          
                                            >           - ---
                                            >
                                            > ## Proximos pasos recomendados
                                            >
                                            > 1. **Escribir pedidos en Sheets:** Agrega un Cloud Function en Firebase para escribir en Google Sheets usando una Service Account (sin exponer credenciales en el frontend)
                                            > 2. 2. **Envio de correo:** Usa Firebase Extensions > Trigger Email para enviar el PDF al proveedor automaticamente
                                            >    3. 3. **Autenticacion:** Agrega Firebase Auth para controlar quien puede hacer pedidos
                                            >       4. 4. **Historial:** Conecta la hoja `BASE DE PEDIDOS` para mostrar pedidos anteriores en la web
                                            >          5. 

<!-- deploy trigger 1779494924608 -->
