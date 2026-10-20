# Base de datos (Supabase) y migraciones

La base de datos vive en proyectos de Supabase. El esquema se versiona con la Supabase
CLI (devDependency fijada en `package.json`) en `supabase/migrations/`. Nada se ejecuta
contra Supabase desde la aplicación ni desde la CI: aplicar migraciones es una acción
manual y auditada que hace una persona con acceso al proyecto.

## Proyectos

| Entorno | Nombre en Supabase | Ref | Región | Organización |
| --- | --- | --- | --- | --- |
| Producción | `Piamonte` | `czhbxmxhbyjpqhrpgihg` | Canada (Central) | la del dueño del repositorio |
| Desarrollo | `piamonte-dev` | `waezhdcznpzercgqyiaf` | West US (Oregon) | personal del colaborador (**provisorio**) |

- Para programar se usa siempre `piamonte-dev`: sus claves van en `.env.local` y es el
  único proyecto contra el que se ejecuta `db push` durante el desarrollo.
- Las claves de producción solo se usan para pruebas acordadas con el local.
- `piamonte-dev` es provisorio porque el colaborador no tiene permiso para crear proyectos
  en la organización del dueño. Cuando se otorgue, se recrea en esa organización y en la
  misma región que producción con el procedimiento de "Recrear el proyecto de desarrollo".

## Estado de la cadena de migraciones (tras PIA-1, 2026-10-17)

`supabase/migrations/` es reproducible desde cero:

| Migración | Qué es |
| --- | --- |
| `20261017134905_remote_schema.sql` | **Foto base**: esquema real de producción capturado con `supabase db pull` (esquema `public` completo: 18 tablas, 38 funciones, 26 políticas RLS, triggers, índices, grants, y la política de lectura sobre `storage.objects`). |
| `20261017134906_storage_bucket_imagenes.sql` | Fila del bucket `imagenes-productos` en `storage.buckets` (dato, no esquema; `db pull` no la captura). Escrita a mano a partir de la configuración observada en producción. |
| `20261017210509_limpiar_rpc_pedidos.sql` | **PIA-20.** Retira los objetos de Mercado Pago (`pagos`, `pagos_notificaciones`, `confirmar_pago_mercado_pago`, `reservar_preferencia_mercado_pago`); cambia el contrato de `metodo_pago` a `('efectivo', 'tarjeta_pos')` en la RPC `registrar_pedido_desde_checkout` (misma firma; `pago_id` del resultado queda siempre `null`) y en el check de `pedidos` (creado `NOT VALID` por si producción tiene filas históricas con `mercado_pago`); crea la función y el trigger `validar_disponibilidad_item_pedido` sobre `pedido_items` que el script histórico 04 nunca llegó a aplicar. Conserva `pedidos.estado_pago` y su check para PIA-3. La UI del POS (`tarjeta_pos`) es PIA-3; la aplicación sigue enviando `"efectivo"`. **Pendiente de aplicar en producción** en el próximo release: ver "Procedimiento para una migración nueva". |
| `20261018123209_demanda_tiempos_pausa.sql` | **PIA-2.** Tabla `comercio_configuracion` (1:1 con `comercios`: `demanda` normal/alta, ocho rangos de minutos retiro/envío × normal/alta con checks 0–240 y máximo ≥ mínimo, `pedidos_pausados`, `mensaje_pausa`, `actualizado_en` con el trigger existente `clientes_actualizar_actualizado_en`), con lectura pública de la fila del comercio activo, sin escritura directa para la API, fila inicial por comercio y publicada en Realtime. Columnas `pedidos.tiempo_estimado_min/max` (rango congelado al aceptar; null en pedidos previos). RPC auditada `admin_actualizar_configuracion_comercio(p_operacion_id, p_comercio_id, p_cambios jsonb)` (solo `authenticated`; exige owner/admin o super admin; claves permitidas fijas). Redefine con la misma firma y permisos `auditoria_iniciar_operacion` (entidad nueva `comercio_configuracion`, también agregada al check de `auditoria_eventos`) y `admin_actualizar_estado_pedido_auditado` (al pasar a `en_preparacion` guarda el rango vigente según modalidad y demanda). **Pendiente de aplicar en producción** junto con la de PIA-20. |

Las cuatro están aplicadas en `piamonte-dev`. En producción la foto base figura como aplicada
en `supabase_migrations.schema_migrations` (ver "Nota sobre el historial de producción");
la del bucket no hace falta aplicarla porque el bucket ya existe con esa configuración, y
`db push` contra producción la registrará sin efecto gracias al `on conflict`. Las de PIA-20 y
PIA-2 sí tienen efecto en producción y se aplican con el release que las incluya.

Los doce scripts que antes estaban en `supabase/migrations/` se movieron a
[`supabase/historial/`](../supabase/historial/README.md) como documentación. Los tres de
[`supabase/pendientes/`](../supabase/pendientes/README.md) siguen allí con su conclusión.

### PIA-3, etapa 1: contrato preparado, sin aplicar

La migración [`20261020145041_medios_pago_costo_envio.sql`](../supabase/migrations/20261020145041_medios_pago_costo_envio.sql)
está preparada para revisión; **no se aplicó en desarrollo ni producción**. Requiere
la cadena hasta PIA-2. No ejecutar el procedimiento de aplicación de abajo para esta
etapa: la aplicación sigue siendo una acción manual pendiente de revisión.
Las etapas 3 y 4 adaptan el servidor y el checkout al contrato nuevo.

- `comercio_configuracion.costo_envio`: `numeric(12,2) NOT NULL DEFAULT 0`, en UYU,
  con check no negativo que también excluye `NaN`. Las filas existentes y futuras
  comienzan con tarifa cero. No se recalculan pedidos anteriores.
- `admin_actualizar_configuracion_comercio(p_operacion_id, p_comercio_id, p_cambios)`
  admite la clave `costo_envio` además de las anteriores. Exige un número JSON entre
  0 y 9999999999.99, con hasta dos decimales; rechaza `null`, cadenas y negativos.
  Conserva autorización owner/admin o super admin, bloqueo de fila, idempotencia por
  operación y auditoría de los valores anteriores/nuevos (incluida la tarifa).
  No habilita escritura directa ni edición desde la UI de Operación en esta etapa.
- `pedidos.metodo_pago` admite `efectivo`, `tarjeta_pos` y `pago_en_local`.
  **No se consultaron datos remotos.** Al aplicarse, la migración bloquea brevemente
  `pedidos` y cuenta métodos incompatibles **antes** de sustituir el check.
  Si existen, emite un `WARNING` con la cantidad y deja el check `NOT VALID`,
  conservando esas filas sin cambios. Si no existen, valida el check.
  `NOT VALID` sigue controlando inserciones y actualizaciones: actualizar una fila
  histórica con un método incompatible puede fallar, como con el check de PIA-20.
  No se reescriben retiros históricos que se hayan registrado como `efectivo`.

**Nueva firma de checkout (12 parámetros, sin valores por defecto):**

```sql
public.registrar_pedido_desde_checkout(
  p_comercio_id uuid,
  p_modalidad_entrega text,
  p_cliente_nombre text,
  p_cliente_telefono text,
  p_direccion_calle text,
  p_direccion_numero text,
  p_direccion_apartamento text,
  p_direccion_referencias text,
  p_metodo_pago text,
  p_subtotal numeric,
  p_items jsonb,
  p_costo_envio numeric
) returns table (pedido_id uuid, pago_id uuid)
```

| Modalidad | Método permitido | Costo de envío |
| --- | --- | --- |
| `delivery` | `efectivo` o `tarjeta_pos` | Importe finito no negativo, hasta dos decimales |
| `retiro` | Solo `pago_en_local` | Exactamente `0` |

Los parámetros de modalidad, pago, subtotal y envío no admiten `NULL`.
El subtotal debe ser positivo y finito, con hasta dos decimales. Se guardan
`subtotal = p_subtotal`, `costo_envio = p_costo_envio` y
`total = p_subtotal + p_costo_envio`; el rango monetario y la igualdad también
quedan sujetos a los checks y tipos existentes de `pedidos`.
La tarifa recibida es una instantánea calculada por el servidor de confianza,
no se fuerza su igualdad con la configuración vigente en esta RPC. La integración
posterior debe obtenerla de la configuración para delivery y enviar cero para retiro.
Se mantienen el número automático del pedido, los estados iniciales pendientes,
`pago_id = NULL`, el registro atómico de ítems/opciones y el trigger de disponibilidad.

**Impacto de firma y permisos:** PostgreSQL no permite cambiar los argumentos con
`CREATE OR REPLACE`; agregar una función sin retirar la anterior dejaría una
sobrecarga que eludiría las nuevas validaciones. Se elimina explícitamente la firma
de 11 argumentos con `DROP FUNCTION ... RESTRICT`, sin `CASCADE`, dentro de la misma
transacción. La cadena versionada no registra funciones, vistas ni triggers que la
referencien. Si el entorno tiene dependencias SQL adicionales registradas, `RESTRICT`
aborta toda la migración sin eliminarlas: deben revisarse antes de reintentar.
Las referencias externas o dentro de cuerpos SQL no registradas como dependencias
requieren revisión manual.
La función nueva declara dueño `postgres`, `SECURITY DEFINER` y `search_path` fijo;
revoca acceso de `PUBLIC`, `anon` y `authenticated`, y restaura `EXECUTE` solo para
`postgres` y `service_role`. La RPC administrativa conserva su firma y permiso solo
para `authenticated` entre los roles de API, con autorización interna.

La etapa 3 adapta el servidor a esta firma: envía `p_costo_envio` y usa
`pago_en_local` para retiro. La etapa 4 agrega la elección de pago requerida
para delivery y muestra el total confirmado por ese servidor. **No desplegar
contra el esquema anterior**: coordinar migración, servidor y checkout.
No hay adaptador de compatibilidad con la RPC anterior.
La etapa 5 muestra «Llevar POS» en administración y notificaciones para
delivery con `tarjeta_pos`, sin agregar cambios SQL. Las APIs leen los importes
guardados en `pedidos` y el aviso sin revisar incorpora `metodo_pago`.
La UI de Operación y checkout se implementa en las etapas 2 y 4, respectivamente.

Pruebas enfocadas: `node --test tests/medios-pago-sql.test.mjs`. Verifican
estáticamente el contrato, permisos, preservación de auditoría, ítems, disponibilidad
y tratamiento de históricos; no ejecutan la migración ni sustituyen una prueba
transaccional de integración en PostgreSQL antes de su aplicación autorizada.

### Nota sobre el historial de producción

Al ejecutar `supabase db pull` en PIA-1, la CLI (v2.121.0) detectó que corría sin terminal
interactiva, ignoró la respuesta negativa canalizada por stdin y registró por su cuenta la
versión `20261017134905` en la tabla de historial de producción
(`"remoteHistoryUpdated": true`). Fue la única escritura en producción durante PIA-1: una
fila en `supabase_migrations.schema_migrations`, sin cambios de esquema ni de datos. Se
decidió conservarla porque es el estado final deseado: producción queda marcada con la foto
base aplicada y un `db push` futuro solo intentará aplicar migraciones posteriores.

Lección operativa: `db pull` **siempre** puede escribir en el historial del proyecto
enlazado. Ejecutarlo solo a sabiendas de eso y, ante la duda, enlazado a `piamonte-dev`.

## Historial de reconciliación (PIA-1)

Comparación de cada script con la foto base. "Aplicado" significa que todos los objetos
que crea o modifica están en producción; "parcial", algunos; "no aplicado", ninguno.

| Script | Resultado | Evidencia en la foto |
| --- | --- | --- |
| `historial/01_super_admin` | aplicado | `super_admins`, `es_super_admin_activo`, políticas `super_admin_self_read` y `super_admin_no_user_writes`. |
| `historial/02_registrar_pedido_desde_checkout` | aplicado | Función con la misma firma (11 parámetros). En la foto `p_metodo_pago` admitía `efectivo` y `mercado_pago`; PIA-20 la redefinió con `efectivo` y `tarjeta_pos`. |
| `historial/03_gestion_catalogo_admin` | parcial | `variantes_producto` tiene `insert/update` para `service_role`; `productos` solo `select/update`; `categorias` solo `select`. No afecta a la aplicación: las altas y ediciones pasan por las RPC auditadas (`security definer`). |
| `historial/04_disponibilidad_productos` | no aplicado (en la foto) | No existían `validar_disponibilidad_item_pedido` (función ni trigger) ni las políticas "Catalogo publico lee…". La función y el trigger los aplicó después PIA-20 (`20261017210509_limpiar_rpc_pedidos.sql`). Las políticas no se recrean: la lectura pública la dan las del esquema base ("Lectura publica de productos/variantes disponibles"). |
| `historial/05_storage_imagenes_productos` | parcial | El bucket `imagenes-productos` existe con la configuración del script (público, 5 MB, jpeg/png/webp), pero la política conserva el nombre viejo "Lectura pública de imágenes de productos" que el script debía renombrar. |
| `historial/06_notificaciones_pedidos_realtime` | aplicado | `pedidos.revisado_en`, índice `pedidos_sin_revisar_idx`, `es_admin_de_comercio`, `grant select` a `authenticated`. Su política "Admins leen pedidos de su comercio" fue reemplazada después por "Personal del comercio lee pedidos" (`empleados_etapa_1`). |
| `historial/07_administradores_super_admin` | aplicado | Índice `admin_comercios_usuario_comercio_uidx` y grants `insert/update` a `service_role`. |
| `historial/08_auditoria_etapa_1` | aplicado | `auditoria_eventos`, 5 índices, 4 funciones, 2 triggers de bloqueo, política "Super Admin consulta auditoría". |
| `historial/09_auditoria_etapa_2` | aplicado | `auditoria_invitaciones_admin` y las 16 funciones (`admin_*_auditad*`, `super_admin_*_auditad*`, `auditoria_iniciar/finalizar_operacion`). |
| `historial/10_baja_logica_catalogo_super_admin` | aplicado | `productos.activo`, índice `productos_comercio_activo_orden_idx`, `super_admin_eliminar_categoria_auditada` y `super_admin_eliminar_producto_auditado`. |
| `historial/11_eliminacion_catalogo` | no aplicado | No existen `categorias.eliminada`, `validar_categoria_no_eliminada`, el trigger `productos_categoria_no_eliminada` ni el índice `categorias_comercio_eliminada_orden_idx`; las dos funciones que redefinía están en la versión de 09/10. La aplicación consulta `eliminada` pero tolera su ausencia (reintenta sin la columna ante `42703`/`PGRST204` en `src/lib/catalogo/consultas.ts` y `src/lib/pedidos/registrar.ts`), por lo que hoy la baja lógica de categorías no está operativa en producción. |
| `historial/12_acceso_empleados` | aplicado | `admin_iniciar_acceso_empleado_auditado` y `admin_finalizar_acceso_empleado_auditado`. |
| `pendientes/empleados_etapa_1` | **aplicado** (pese a su cabecera "NO EJECUTAR") | `admin_comercios.rol` admite `empleado`; `auditoria_invitaciones_admin.rol` con check `admin/empleado`; `es_empleado_de_comercio`, `es_personal_de_comercio`; RPC `admin_asignar_empleado_auditado`, `admin_cambiar_estado_empleado_auditado`, `admin_iniciar/completar_invitacion_empleado_auditada`, `admin_marcar_invitacion_empleado_fallida`; política "Personal del comercio lee pedidos". Cierra la duda de la migración 12. |
| `pendientes/clientes_cuentas_etapa_1` | **aplicado** | `clientes_perfiles`, `clientes_direcciones` (con FK `clientes_direcciones_perfil_fk`), `pedidos.cliente_user_id` (FK `pedidos_cliente_user_fk`, índice `pedidos_cliente_historial_idx`), triggers `clientes_*_actualizad*_en`, y las 12 políticas "Cliente consulta/crea/actualiza/elimina sus perfiles/direcciones", "Cliente consulta sus pedidos", "Cliente consulta items/opciones de sus pedidos", "Personal consulta items/opciones de su comercio". Son la **base de PIA-19** (cuentas de clientes, decidido el 2026-10-17); no son objetos huérfanos y no se tocan. |
| `pendientes/configurar_promo_10_lehmeyun` | n/a | Ajuste de datos de un producto concreto; no aplica a la comparación de esquema. |

### Hallazgos adicionales de la foto

- **Mercado Pago sí se aplicó en la base**: la foto contiene `pagos`, `pagos_notificaciones`,
  `pedidos.estado_pago` y las funciones `reservar_preferencia_mercado_pago` y
  `confirmar_pago_mercado_pago`, aunque el código se retiró en PIA-0. PIA-20
  (`20261017210509_limpiar_rpc_pedidos.sql`) eliminó tablas y funciones; `estado_pago` se
  conserva para PIA-3. El script original de Mercado Pago está en el tag
  `mercado-pago-retirado`.
- El esquema base incluye `grupos_opciones`, `opciones` y `reglas_opciones_variante`
  (modelo genérico de opciones), que ningún script del repositorio creaba.
- Existe el event trigger `ensure_rls` con la función `public.rls_auto_enable()`, que
  habilita RLS automáticamente en cada tabla nueva de `public`.
- `imagen_url` es `null` en todas las categorías y productos de producción: las imágenes
  del catálogo se sirven hoy como archivos estáticos de la aplicación, no desde Storage.
  El seed por lo tanto no referencia Storage y no hace falta copiar archivos a dev.

## Datos de desarrollo (`supabase/seed.sql`)

Volcado de catálogo de producción (`db dump --data-only -s public -x <tablas excluidas>`,
en formato `INSERT`) **sin información personal ni transaccional**. Contiene solo `comercios`, `categorias`,
`productos`, `variantes_producto`, `grupos_opciones`, `opciones` y
`reglas_opciones_variante`. Quedaron excluidas: `pedidos`, `pedido_items`,
`pedido_item_opciones`, `pagos`, `pagos_notificaciones`, `auditoria_eventos`,
`auditoria_invitaciones_admin`, `admin_comercios`, `super_admins`, `clientes_perfiles`,
`clientes_direcciones`, y todo `auth.*` y `storage.*`.

Antes de versionar un seed nuevo, verificar que no trae teléfonos, correos ni claves:

```bash
grep -n -E '\+598|09[0-9]{7}|@' supabase/seed.sql                      # debe devolver vacío
grep -n -i -E 'token|secret|api[_-]?key|password' supabase/seed.sql    # debe devolver vacío
```

Importante: `db dump --data-only` sin `-s public` vuelca también `auth.*` (usuarios y
hashes de contraseña) y `storage.*`. Usar siempre `-s public`. Tampoco usar `--use-copy`: al sembrar,
la CLI no soporta `COPY ... FROM stdin` (`No source stream defined`, SQLSTATE 57014); el
seed debe ser `INSERT`.

`config.toml` ya declara `[db.seed] sql_paths = ["./seed.sql"]`; el seed se aplica con
`npx supabase db push --include-seed` (nunca contra producción).

## Procedimiento para una migración nueva

```bash
# 0. Estar enlazado a desarrollo (ver "Enlazar la CLI").
cat supabase/.temp/project-ref        # debe decir waezhdcznpzercgqyiaf

# 1. Crear el archivo y editarlo.
npx supabase migration new descripcion_en_snake_case
#    -> supabase/migrations/<timestamp>_descripcion_en_snake_case.sql

# 2. Aplicar en desarrollo y comprobar.
npx supabase db push
npx supabase migration list

# 3. PR a develop con la migración (y el código que la usa).
# 4. Tras el release a main, una persona aplica en producción:
#    npx supabase link --project-ref czhbxmxhbyjpqhrpgihg && npx supabase db push
#    Nunca desde la CI. Después, volver a enlazar dev.
```

Pendientes de aplicar en producción (próximo release): `20261017210509_limpiar_rpc_pedidos.sql`
(PIA-20) y `20261018123209_demanda_tiempos_pausa.sql` (PIA-2; no borra datos: crea la fila de
configuración del comercio con los valores iniciales y el administrador los ajusta desde
Operación). Antes del `db push` contra producción, comprobar en el SQL Editor cuántas filas
de Mercado Pago se van a perder; son de pruebas internas (el checkout de Mercado Pago nunca
se habilitó):

```sql
select count(*) from public.pagos;
select count(*) from public.pagos_notificaciones;
select count(*) from public.pedidos where metodo_pago = 'mercado_pago';
```

## Enlazar la CLI

La CLI toma la contraseña de la base de la variable de entorno `SUPABASE_DB_PASSWORD`
(en PowerShell, **con comillas simples**: `$env:SUPABASE_DB_PASSWORD = '<contraseña>'`).
Cada proyecto tiene su propia contraseña; cambiarla antes de cambiar de enlace.

```bash
npx supabase login
npx supabase link --project-ref waezhdcznpzercgqyiaf   # desarrollo
npx supabase link --project-ref czhbxmxhbyjpqhrpgihg   # producción (solo pull/dump/list o el push de un release)
cat supabase/.temp/project-ref                         # confirmar antes de cualquier comando que escriba
```

- `supabase/.temp/` guarda el enlace y **nunca se versiona** (está en `supabase/.gitignore`).
- Contra producción solo `db pull`, `db dump`, `migration list` y el `db push` de un
  release. Todo lo demás (`db reset`, `db query`, `migration repair`, pruebas) va a dev.
- `db pull` puede escribir en el historial del proyecto enlazado (ver la nota de arriba).

## Recrear el proyecto de desarrollo

Sirve tanto para mover `piamonte-dev` a la organización del dueño como para levantar un
entorno nuevo desde cero.

1. Crear el proyecto en Supabase (misma región que producción) y guardar su contraseña.
2. `$env:SUPABASE_DB_PASSWORD = '<contraseña del proyecto nuevo>'`
3. `npx supabase link --project-ref <ref-nuevo>` y confirmar con `cat supabase/.temp/project-ref`.
4. `npx supabase db push --include-seed` (aplica la foto, el bucket y el seed).
5. `npx supabase migration list`: todas las migraciones locales deben figurar como remotas.
6. Crear el usuario del panel en *Authentication → Users* y su fila en `admin_comercios`
   (`user_id`, `comercio_id` del seed, `rol` `owner`/`admin`).
7. Actualizar `.env.local` con la URL y las claves del proyecto nuevo y, si cambia el ref,
   esta tabla y `.env.example`.

## Reglas

- **Ninguna migración ya mergeada en `develop` se edita ni se elimina.** Un cambio se
  expresa con una migración nueva. El job `ci / migraciones-inmutables`
  (`scripts/verificar-migraciones.sh`) lo comprueba en cada PR; la única excepción es la
  rama `feature/PIA-1-*`, excluida en `.github/workflows/ci.yml` porque esa tarea
  reescribió la cadena. Desde la siguiente PR el check vuelve a bloquear.
- Nombre: `YYYYMMDDHHMMSS_descripcion_en_snake_case.sql`, generado con
  `npx supabase migration new descripcion`.
- Cada migración empieza con un comentario que explica qué cambia, qué requiere y si es
  idempotente.
- Las migraciones no contienen credenciales ni datos de un comercio concreto; el seed no
  contiene datos personales.
