# Scripts SQL fuera de `migrations/`

Estos archivos **no** forman parte de la cadena de migraciones que aplica
`supabase db push`. Se conservan por su valor documental. Ninguno se ejecuta desde la
aplicación y **ninguno debe ejecutarse a mano**: lo que contienen ya está en producción (y
por lo tanto en la foto base `supabase/migrations/20261017134905_remote_schema.sql`) o es
un ajuste de datos puntual.

Conclusiones de la reconciliación de PIA-1 (2026-10-17), detalle en
[`docs/BASE-DE-DATOS.md`](../../docs/BASE-DE-DATOS.md), sección "Historial de reconciliación":

| Archivo | Conclusión | Qué hacer |
| --- | --- | --- |
| `empleados_etapa_1.sql` | **Aplicado en producción** a pesar de su cabecera "NO EJECUTAR SIN VALIDACION": `admin_comercios.rol` admite `empleado`, existen `es_empleado_de_comercio`, `es_personal_de_comercio`, las RPC `admin_*_empleado_*` y la política "Personal del comercio lee pedidos". Todo está en la foto base. | Nada. Queda como documento de diseño del rol `empleado`. Cualquier cambio futuro se hace con una migración nueva. |
| `clientes_cuentas_etapa_1.sql` | **Aplicado en producción**: `clientes_perfiles`, `clientes_direcciones`, `pedidos.cliente_user_id` y las 12 políticas de clientes están en la foto base. El cliente decidió el 2026-10-17 que el sitio **sí** tendrá cuentas de clientes (ticket PIA-19): estos objetos son su base, no están huérfanos. | No borrar ni modificar. PIA-19 parte de la foto base y del código retirado en `34f588e`. |
| `configurar_promo_10_lehmeyun.sql` | Ajuste de **datos** puntual para Piamonte (UUID de producto fijo), no un cambio de esquema. No aplica a la comparación de esquema. | No convertir en migración. Los ajustes de datos de un comercio se hacen por el panel o por scripts puntuales documentados en el ticket correspondiente. |

Los doce scripts que antes estaban en `migrations/` están ahora en
[`supabase/historial/`](../historial/README.md).
