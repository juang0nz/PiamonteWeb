# Historial de scripts anteriores a PIA-1

Estos doce archivos son los scripts SQL **tal como se ejecutaron a mano** en el SQL
Editor de Supabase antes de PIA-1 (2026-10-17). Se conservan solo como documentación:
**no forman parte de la cadena de migraciones** y `supabase db push` no los lee.

## Por qué salieron de `supabase/migrations/`

- Eran incrementales sobre un esquema base (`comercios`, `productos`, `pedidos`…) que
  nunca estuvo versionado, así que no podían reproducir una base desde cero.
- Ninguno estaba registrado en el historial de migraciones del proyecto remoto
  (`supabase migration list` mostraba 12 locales y 0 remotas), y no había certeza de
  cuáles se habían aplicado.

En PIA-1 se capturó el esquema real de producción con `supabase db pull` como migración
base (`supabase/migrations/20261017134905_remote_schema.sql`) y se comparó cada uno de
estos scripts con esa foto. El resultado, script por script, está en la sección
"Historial de reconciliación (PIA-1)" de [`docs/BASE-DE-DATOS.md`](../../docs/BASE-DE-DATOS.md).

## Orden original

Los nombres llevan un timestamp artificial (`20261014…`) que fijaba el orden según las
dependencias declaradas en la cabecera de cada script.

| # | Script | Dependía de |
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
| 11 | `eliminacion_catalogo` | 08, 09, 10 |
| 12 | `acceso_empleados` | 06, 08, 09 y `supabase/pendientes/empleados_etapa_1.sql` |

## Reglas

- No editar ni ejecutar estos archivos. Si algo de aquí hace falta en la base, se
  escribe una migración nueva en `supabase/migrations/` (`npx supabase migration new`).
- No borrar esta carpeta: es la única traza de cómo llegó producción a su estado actual.
