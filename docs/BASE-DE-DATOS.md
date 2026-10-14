# Base de datos (Supabase) y migraciones

La base de datos vive en un proyecto de Supabase. El esquema se versiona con la
Supabase CLI (devDependency fijada en `package.json`) en `supabase/migrations/`.
Nada se ejecuta contra Supabase desde la aplicación ni desde la CI: aplicar
migraciones es una acción manual y auditada.

## Estado actual: advertencia

1. **El esquema base no está versionado.** Ninguna migración crea `comercios`,
   `pedidos`, `pedido_items`, `productos`, `categorias`, `variantes_producto`,
   `admin_comercios` ni `pagos`. Las migraciones existentes son incrementales sobre un
   esquema que solo existe en el proyecto remoto.
2. **No se sabe con certeza qué está aplicado.** Los scripts se ejecutaban a mano en el
   SQL Editor sin registro. Hasta completar la reconciliación de abajo, la cadena de
   migraciones es documentación del historial, no una fuente reproducible.
3. `20261014100012_acceso_empleados.sql` declara depender de `empleados_etapa_1.sql`, que
   está en `supabase/pendientes/` como borrador. La aplicación usa el rol `empleado`,
   por lo que alguna versión de ese borrador probablemente se aplicó. Ver
   [`supabase/pendientes/README.md`](../supabase/pendientes/README.md).

## Orden de las migraciones

Los nombres llevan un timestamp artificial (`20261014…`) que fija el orden; el orden se
construyó a partir de las dependencias declaradas en la cabecera de cada script.

| # | Migración | Depende de |
| --- | --- | --- |
| 01 | `super_admin` | — (crea `super_admins`, `es_super_admin_activo`) |
| 02 | `registrar_pedido_desde_checkout` | esquema base |
| 03 | `gestion_catalogo_admin` | esquema base |
| 04 | `disponibilidad_productos` | esquema base, `admin_comercios` |
| 05 | `storage_imagenes_productos` | — |
| 06 | `notificaciones_pedidos_realtime` | `admin_comercios` (crea `es_admin_de_comercio`) |
| 07 | `administradores_super_admin` | `admin_comercios` |
| 08 | `auditoria_etapa_1` | 01, `admin_comercios` |
| 09 | `auditoria_etapa_2` | 08 |
| 10 | `baja_logica_catalogo_super_admin` | 08, 09 |
| 11 | `eliminacion_catalogo` | 08, 09, 10 ("último de la serie") |
| 12 | `acceso_empleados` | 06, 08, 09 y el borrador `empleados_etapa_1` (pendiente) |

## Reconciliación con el proyecto remoto (procedimiento)

Lo hace una persona con acceso al proyecto, nunca la CI. No destruye datos.

```bash
npx supabase login
npx supabase link --project-ref <ref-del-proyecto>

# 1. Capturar el esquema real como una migración "baseline".
npx supabase db pull --schema public,storage
#    Genera supabase/migrations/<timestamp>_remote_schema.sql con el esquema completo.

# 2. Comparar ese baseline con las migraciones 01–12 y con los borradores de pendientes/
#    para saber qué está aplicado y qué no (diff a mano o con `supabase db diff`).

# 3. Marcar como aplicadas en el historial remoto las migraciones que ya estén
#    reflejadas en el esquema, sin volver a ejecutarlas:
npx supabase migration repair --status applied 20261014100001 20261014100002 ...

# 4. Lo que falte se aplica con `npx supabase db push` desde una rama revisada.
npx supabase migration list   # verifica local vs remoto
```

Mientras la reconciliación no esté hecha, **no ejecutar `db push` ni `db reset`
contra el proyecto de producción**.

## Reglas

- **Ninguna migración ya mergeada en `develop` se edita ni se elimina.** Un cambio se
  expresa con una migración nueva. La CI (`ci / migraciones-inmutables`) falla si una
  PR modifica o borra un archivo existente en `supabase/migrations/`.
- Nombre: `YYYYMMDDHHMMSS_descripcion_en_snake_case.sql`, generado con
  `npx supabase migration new descripcion`.
- Cada migración empieza con un comentario que explica qué cambia, qué requiere y si
  es idempotente.
- Las migraciones no contienen credenciales ni datos de un comercio concreto.

## Nota sobre `metodo_pago`

El pago se realiza únicamente en el local; la aplicación ya no ofrece Mercado Pago.
Sin embargo, el contrato con la base **no cambió**: la RPC
`registrar_pedido_desde_checkout` sigue recibiendo `p_metodo_pago` y valida
`('efectivo', 'mercado_pago')`; la aplicación envía siempre `"efectivo"`
(`METODO_PAGO_PEDIDO` en `src/lib/pedidos/tipos.ts`). La migración 02 conserva la
cadena `'mercado_pago'` porque refleja la función desplegada.

Pendiente de evaluar en una migración futura: redefinir la RPC sin `p_metodo_pago` o
restringir la columna `pedidos.metodo_pago` a `'efectivo'`, y retirar `estado_pago` y
las tablas de intentos de pago si el script de preparación de Mercado Pago llegó a
aplicarse. Ese script ya no está en el repositorio; está en el tag
`mercado-pago-retirado`.
