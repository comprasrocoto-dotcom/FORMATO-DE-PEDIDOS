# Panel de Administración — Guía de instalación

Vista nueva, protegida por contraseña, para administrar 3 hojas del mismo Google
Sheet: **ARTICULOS**, **PROVEEDORES** y **CATALOGO_COMPRAS** (crear, editar y eliminar).
La contraseña vive en la hoja **CONFIG**, celda **B1**, y se valida en el servidor.

## Archivos entregados

| Archivo | Dónde va | Qué es |
|---|---|---|
| `admin-backend.gs` | Tu proyecto de Apps Script (pegar al final) | 3 funciones + 3 case de `doPost` |
| `adminApi.ts` | `src/services/adminApi.ts` | Cliente HTTP del panel (mismo endpoint) |
| `AdminPanel.tsx` | `src/components/AdminPanel.tsx` | La vista Admin completa |
| `App.tsx` | `src/App.tsx` (reemplaza el actual) | Igual que el tuyo + pestaña "Admin" |

---

## Paso 1 — Preparar las hojas (una sola vez)

La FILA 1 de cada hoja debe tener los encabezados **exactamente** con estos nombres
(el backend mapea por nombre, así que el orden de columnas no importa, pero el texto sí):

- **CONFIG** → escribe la contraseña en la celda **B1**.
- **ARTICULOS** → `Codigo_Barras`, `Codigo_Referencia`, `Subfamilia_Categoria`, `Articulo_HiOPOS`, `UniMedida_Formato_HiOPOS`, `Articulo_Comercial`, `UniMedida_Compra`, `Minimo`, `Maximo`
- **PROVEEDORES** → `ID_Proveedor`, `Razon_Social`, `Telefono_Contacto`, `Correo_Contacto`, `Asesor_Contacto`
- **CATALOGO_COMPRAS** → `Codigo_Barras`, `ID_Proveedor`, `Prioridad`, `Precio_Negociado`, `Estado_Aprobado_Suspendido`

> Si un encabezado no coincide carácter por carácter (tildes, guiones bajos, mayúsculas),
> ese campo no se guardará. Cópialos tal cual de la lista de arriba.

## Paso 2 — Backend (Apps Script)

1. Abre tu proyecto de Apps Script (el del mismo ENDPOINT que ya usa la app).
2. Pega **todo** el contenido de `admin-backend.gs` al final del archivo.
3. Agrega estos 3 `case` dentro del `switch` de **`doPost`** (junto a los que ya tienes):
   ```js
   if (action === 'adminGetData') return adminGetData(body);
   if (action === 'adminUpsert')  return adminUpsert(body);
   if (action === 'adminDelete')  return adminDelete(body);
   ```
4. **Deploy → Manage deployments → New version.** (Sin esto, los cambios no se aplican.)

El backend reutiliza lo que ya existe en tu script: `ID_HOJA`, `corsOutput()` y `LockService`.

## Paso 3 — Frontend

1. Copia `adminApi.ts` a `src/services/adminApi.ts`.
2. Copia `AdminPanel.tsx` a `src/components/AdminPanel.tsx`.
3. Reemplaza `src/App.tsx` por el `App.tsx` entregado (es idéntico al tuyo, solo
   suma el import de `AdminPanel` y la pestaña **Admin**).
4. Deploy normal del frontend (Vercel).

---

## Cómo funciona

- **Login:** al entrar a la pestaña Admin se pide la contraseña; se compara contra
  `CONFIG!B1` en el servidor. Mientras dure la sesión del navegador no la vuelve a pedir
  (se guarda en `sessionStorage`; el botón **Salir** la borra).
- **Llaves:** `Codigo_Barras` une ARTICULOS ↔ CATALOGO_COMPRAS, e `ID_Proveedor` une
  PROVEEDORES ↔ CATALOGO_COMPRAS. En el catálogo, esos dos campos se eligen con listas
  que muestran el nombre comercial / razón social, no solo el código.
- **Crear vs editar:** el guardado es un *upsert* por llave. Al **editar**, los campos
  llave quedan bloqueados (cambiarlos crearía otro registro). Las columnas que no estén
  en el formulario se conservan intactas.
- **Catálogo:** clave compuesta (`Codigo_Barras` + `ID_Proveedor`), así un mismo artículo
  puede tener varios proveedores con distinta prioridad/precio/estado.
- **Concurrencia:** las escrituras usan `LockService`, igual que el resto del sistema.

## Seguridad (nota)

El Web App está como “Cualquiera con el enlace”, así que la contraseña viaja en el
cuerpo de cada petición y se valida server-side. Es razonable para una herramienta
interna, pero **no** es seguridad de nivel bancario: cualquiera con la URL + la
contraseña puede escribir. Si más adelante quieres endurecerlo, se puede pasar a tokens
o a control de acceso por cuenta de Google.
