# Scripts SQL fuera de `migrations/`

Estos archivos **no** forman parte de la cadena de migraciones que aplica
`supabase db push`. Se conservan por su valor documental o porque todavía requieren
una decisión humana. Ninguno se ejecuta desde la aplicación.

| Archivo | Estado | Qué hacer |
| --- | --- | --- |
| `empleados_etapa_1.sql` | **Borrador v2, marcado "NO EJECUTAR SIN VALIDACION"** en su cabecera. Define el rol `empleado`, sus RLS y RPC auditadas. La aplicación ya usa el rol `empleado` (middleware, panel), lo que sugiere que alguna versión de este script **sí fue aplicada** en Supabase. | Reconciliar contra la base real (ver `docs/BASE-DE-DATOS.md`). Si el esquema remoto ya contiene estos objetos, capturarlos con `supabase db pull` como migración y eliminar este borrador. |
| `clientes_cuentas_etapa_1.sql` | Corresponde a las cuentas de clientes, funcionalidad **retirada** del código. Según la documentación operativa, no consta que se haya ejecutado. | No aplicar. Si en la reconciliación aparecen `clientes_perfiles`, `clientes_direcciones` o `pedidos.cliente_user_id`, decidir con el dueño si se eliminan con una migración nueva. |
| `configurar_promo_10_lehmeyun.sql` | Ajuste de **datos** puntual para Piamonte (UUID de producto fijo), no un cambio de esquema. Presumiblemente ya aplicado. | No convertir en migración. Los ajustes de datos de un comercio se hacen por el panel o por scripts puntuales documentados en el ticket correspondiente. |

Nota: `20261014100012_acceso_empleados.sql` (en `migrations/`) declara depender de
`empleados_etapa_1.sql`. Mientras ese borrador no esté reconciliado, la cadena de
migraciones no es reproducible desde cero; ver la advertencia en `docs/BASE-DE-DATOS.md`.
