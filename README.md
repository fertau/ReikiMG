# ReikiMG

Aplicación web interna para relevamientos de obra y órdenes de producción en
vidrios, cerramientos, mamparas, barandas, frentes y sistemas de cristal templado.

Está pensada para usarse desde el celular, parada en la obra: cargar medidas,
sacar fotos, grabar una nota de voz y cargar el despiece sin volver a la oficina
ni pasar nada por WhatsApp.

```
Obra → Relevamiento → Unidad → Ambiente → Ítem → Medidas → Despiece
     → Fotos / Notas / Audios → Revisión → Orden de producción → PDF
```

## Stack

| Capa | Tecnología |
|---|---|
| Front y back | Next.js 16 (App Router, Server Actions) · React 19 · TypeScript |
| Estilos | Tailwind CSS 4 |
| Base de datos | PostgreSQL (Supabase) con Row Level Security |
| Autenticación | Supabase Auth (email + contraseña) |
| Archivos | Supabase Storage, buckets privados con URLs firmadas |
| Validación | Zod en cada Server Action |
| PDF | jsPDF + AutoTable en el navegador, más una vista de impresión A4 |
| Móvil | PWA instalable (manifest + service worker) |

## Puesta en marcha

### 1. Proyecto de Supabase

Crear un proyecto en [supabase.com](https://supabase.com) y pegar
`supabase/migraciones-completas.sql` en el SQL Editor. Es el concatenado de las
cuatro primeras migraciones y **se puede ejecutar las veces que haga falta**:
todo va con guardas de existencia, así que una corrida interrumpida se arregla
volviendo a ejecutarlo.

Después, editar el email en `0005_bootstrap_admin.sql` y correrlo aparte.

Los archivos individuales, en `supabase/migrations/`:

| Archivo | Qué hace |
|---|---|
| `0001_schema.sql` | Tablas, enums, índices, triggers y numeración de documentos |
| `0002_rls.sql` | Políticas RLS y máquina de estados del relevamiento |
| `0003_storage.sql` | Buckets privados de fotos y audios con sus políticas |
| `0004_seed.sql` | Catálogos iniciales, familias, productos y campos dinámicos |
| `0005_bootstrap_admin.sql` | Primer administrador (editar el email antes de correrlo) |

Con la [CLI de Supabase](https://supabase.com/docs/guides/cli) alcanza con
`supabase db push`.

`supabase/reset.sql` borra todo lo que crean las migraciones. No hace falta para
la instalación —las migraciones son reejecutables— pero sirve para vaciar un
proyecto de prueba. Borra los datos.

### 2. Primer usuario

1. **Authentication → Users → Add user**: email, contraseña y *Auto Confirm User*.
2. Editar el email en `0005_bootstrap_admin.sql` y ejecutarlo.

Ese usuario ya puede dar de alta al resto desde **Administración → Usuarios**.

### 3. Variables de entorno

```bash
cp .env.example .env.local
```

| Variable | De dónde sale | Para qué |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API | Conexión |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API | Sesión del usuario (siempre bajo RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API | Sólo alta de usuarios desde el panel. Nunca en el cliente |

Sin `SUPABASE_SERVICE_ROLE_KEY` la aplicación funciona igual: el alta de usuarios
se hace desde el panel de Supabase y en la aplicación se asignan los roles.

### 4. Levantar el proyecto

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # build de producción
npm run typecheck
```

## Roles

| Rol | Qué puede hacer |
|---|---|
| **Administrador** | Todo, más usuarios, productos, campos y catálogos |
| **Medidor** | Ve sus obras asignadas, crea relevamientos, carga medidas, ítems, fotos, audios, notas y despiece, y envía a revisión |
| **Supervisor** | Crea obras, revisa relevamientos, devuelve con motivo, aprueba y genera órdenes |
| **Producción** | Consulta órdenes aprobadas con despiece, medidas y fotos, e imprime |
| **Administración** | Consulta obras, relevamientos y órdenes. Sólo lectura |

Un usuario puede acumular roles. Quien no tiene rol asignado entra y no ve nada,
que es el estado seguro por defecto.

## Cómo está resuelto

**La autoridad de permisos es la base, no la interfaz.** Cada tabla tiene RLS y
las transiciones de estado las valida un trigger (`measurements_guard_transition`).
La aplicación repite esas reglas sólo para decidir qué botones muestra: si algo se
escapara del front, la base lo rechaza igual.

**Campos dinámicos por producto.** Cantidad, ancho, alto, profundidad y
observaciones son columnas del ítem porque se usan en todos los productos y en los
informes. El resto se define en `product_fields` y se guarda en
`item_field_values`. Agregar un producto nuevo con sus campos es carga de datos
desde Administración, no un cambio de código.

**La orden de producción es un snapshot.** Al emitirla, cada ítem se congela en
`production_order_items.snapshot`. Si después un supervisor autoriza editar el
relevamiento, lo que está en el taller no cambia solo.

**Los estados del flujo son enums; sus etiquetas son datos.** Los estados
gobiernan permisos, así que agregar uno es una migración deliberada. Los nombres
visibles y colores se editan en `workflow_statuses` sin tocar código.

**Devolver exige motivo.** Está impuesto en el trigger, no sólo en el formulario:
un relevamiento no puede quedar en `corregir` con el campo vacío.

**Aprobado queda congelado.** El medidor deja de poder editar. Un supervisor puede
habilitarlo puntualmente (`unlocked_for_edit`) y esa autorización queda registrada
en el historial.

**Las fotos se reducen antes de subirse.** 1600 px y JPEG al 82 % en el navegador:
en obra se trabaja con datos móviles y una foto de 4 MB tarda o directamente falla.

**Los archivos son privados.** Buckets sin acceso público y URLs firmadas por
hora. Las políticas de Storage resuelven el permiso leyendo el ID del relevamiento
del primer segmento de la ruta: `{measurement_id}/{item_id}/{archivo}`.

## Estructura

```
src/
  app/
    (app)/                    Aplicación con shell y barra inferior
      page.tsx                Dashboard
      obras/                  Alta, búsqueda, detalle y estructura de la obra
      relevamientos/          Relevamiento, ítems, revisión y generación de orden
      items/[id]/             Medidas, fotos, notas, audios y despiece
      ordenes/                Listado y detalle de órdenes
      admin/                  Usuarios, productos, campos y catálogos
      mas/                    Perfil, instalación y cierre de sesión
    login/                    Autenticación
    ordenes/[id]/imprimir/    Vista A4 para imprimir o guardar como PDF
  components/                 UI, formularios, campos dinámicos, íconos
  lib/                        Supabase, auth, tipos, catálogos, historial, PDF
supabase/migrations/          Esquema, RLS, storage, catálogos y bootstrap
```

## Verificación

- `npm run build` y `npm run typecheck` pasan sin errores ni warnings.
- Las migraciones se aplicaron contra PostgreSQL 16 sobre base virgen, sobre base
  ya migrada y sobre base a medias, con el mismo resultado en los tres casos, y se
  corrió una batería funcional sobre RLS y el flujo de aprobación: el medidor no
  crea obras ni se
  autoaprueba, el relevamiento queda bloqueado durante la revisión, la devolución
  exige motivo, lo aprobado se congela salvo autorización explícita, producción lee
  pero no escribe, administración es sólo lectura y un medidor ajeno a la obra no
  ve nada. También se verificaron las políticas de Storage.
- Lo que no está probado contra un Supabase real: el alta de usuarios con service
  role y la subida de archivos desde el navegador, que dependen de credenciales del
  proyecto.

## Fuera del alcance de esta versión

No están implementados —y así fue pedido— costos, cotizaciones, stock, compras,
lectura de planos, despiece automático ni reconocimiento de imágenes. La estructura
los contempla:

- **Transcripción de audios**: `item_audio` ya tiene `transcript` y
  `transcript_status`; falta el proceso que los complete.
- **Costos y cotizaciones**: `materials.attrs` es un `jsonb` libre donde entran
  precios y rendimientos sin migrar nada.
- **Despiece automático**: `item_parts` es la salida esperada; el cálculo puede
  generarlas a partir de `item_field_values` sin cambiar el modelo.
- **Trazabilidad**: `workflow_history` ya registra cada acción relevante con
  usuario, fecha y hora.
