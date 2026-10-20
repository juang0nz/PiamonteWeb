# Operación y verificación

Guía operativa de la plataforma: comportamiento del checkout, panel administrativo,
acceso de empleados y pruebas manuales. Para levantar el proyecto ver el
[README](../README.md); para la base de datos ver [BASE-DE-DATOS.md](BASE-DE-DATOS.md).

## Compra sin registro

La web pública permite entrar a la carta y comprar directamente. No ofrece cuentas,
Google OAuth, SMS/OTP, perfiles, direcciones guardadas ni recuperación de contraseñas
para clientes. Las antiguas rutas `/mi-cuenta` y `/auth/callback` se retiraron.
No se modifican proveedores externos ni se eliminan usuarios de Supabase Auth.

El checkout solicita nombre, celular y delivery o retiro; el pago se realiza en el
local al retirar (`pago_en_local`) o al recibir: en delivery se exige elegir
**Efectivo** o **Tarjeta (POS)**. Calle,
número, apartamento y referencias corresponden a la entrega. No exige sesión,
correo ni contraseña. El celular acepta formatos nacionales e internacionales de
Uruguay y se guarda en E.164, por ejemplo `+59899806731`. Es un dato de contacto,
no una identidad verificada. No se actualizan teléfonos históricos.

Se mantienen el cálculo de precios, las validaciones de productos/opciones y el
RPC atómico `registrar_pedido_desde_checkout`. No se vinculan nuevos pedidos a
cuentas de clientes. El número visible sigue siendo el correlativo del comercio.

## Administración y Clientes

Ingresar en `/admin/login` con la autenticación existente. El acceso sigue
requiriendo sesión y vínculo activo en `admin_comercios` para el comercio.
Desde el encabezado se puede alternar entre **Pedidos** y **Clientes**.

Al aceptar un pedido nuevo, el panel conserva la actualización de estado y, solo
si la API responde correctamente, intenta abrir WhatsApp con el celular registrado
y el mensaje de preparación configurado en `src/lib/comercio.ts`. Reutiliza la
normalización uruguaya existente y no envía mensajes automáticamente: el empleado
confirma el envío en WhatsApp. El aviso conserva un enlace **Avisar por WhatsApp**
por si el navegador bloquea la apertura, aunque el pedido ya no figure en Nuevos.
Si falta un celular uruguayo válido, se informa y el botón queda deshabilitado;
la aceptación del pedido no se revierte. No se guarda un estado de mensaje enviado.

`/admin/clientes` muestra contactos obtenidos exclusivamente de los pedidos
del comercio autorizado:

- Agrupa formatos válidos del mismo celular mediante la normalización uruguaya.
- Muestra el nombre del pedido más reciente, celular, cantidad de pedidos,
  fecha del último, importe acumulado y última dirección de delivery registrada.
- Permite buscar por nombre (sin distinguir tildes/mayúsculas), celular completo
  nacional/internacional o fragmentos del número.
- Al seleccionar un contacto muestra su historial con fecha, número, estado y total.
- Los cancelados figuran claramente y cuentan en la cantidad total de pedidos,
  pero **no suman al importe acumulado**. El importe de pedidos no cancelados no
  equivale a dinero cobrado: pueden existir pedidos todavía pendientes.
- Los registros históricos con teléfono inválido se muestran con advertencia.
  Los pedidos sin teléfono se contabilizan aparte y no se mezclan como un cliente.

No se crean cuentas ni una tabla duplicada de clientes. Un teléfono compartido por
varias personas se agrupa como un único contacto comercial; no demuestra identidad.
La dirección mostrada es la última registrada en un pedido de delivery, incluso si
un pedido posterior fue de retiro.

La API `/api/admin/clientes` verifica `admin_comercios` antes de usar el cliente
privado, toma `comercio_id` de esa autorización y filtra cada consulta por ese ID.
No acepta un comercio del navegador. Lee los pedidos por páginas de 500 para no
limitar estadísticas al listado operativo de 200 pedidos. El resultado no se
almacena en caché pública. La service role key permanece en el servidor.
No se modifican RLS, estados ni permisos administrativos.

### Funcionalidades pospuestas y base de datos

Se retiraron el código y los SQL locales de cuentas de clientes. **No se ejecutó
ninguna eliminación en Supabase**. Las propuestas anteriores contemplaban
`clientes_perfiles`, `clientes_direcciones`, `clientes_sms_controles` y una columna
`pedidos.cliente_user_id`; no fueron ejecutadas por el asistente.
Si se aplicaron manualmente, pueden seguir existiendo y la aplicación ya no las usa.
No borrar esas tablas, funciones, triggers o datos sin revisión y autorización.

La comprobación remota con la credencial privada actual devolvió HTTP 401
(`PGRST301`), por lo que no se pudo confirmar la existencia de esas tablas.
La consulta con clave pública devolvió 404 (`PGRST205`) para las tres tablas:
no están disponibles en ese esquema expuesto. Esto no reemplaza una revisión
con privilegios administrativos del esquema real.
Revisar la configuración privada del servidor en Supabase antes de la prueba real
de registro y consultas administrativas. No publicar ni compartir la clave.
Las variables anteriores `CLIENTES_*` ya no se utilizan y pueden retirarse de la
configuración del despliegue. No es necesario modificar Google ni Phone en Supabase.

## Operación: demanda, tiempos estimados y pausa (PIA-2)

En **Administración → Operación** (visible solo para `owner`, `admin` y super admin; el rol
`empleado` no ve el enlace y su API responde 403) se configura, sin tocar código, la
operación del día. Todo se guarda en la tabla `comercio_configuracion` (una fila por
comercio) mediante la RPC auditada `admin_actualizar_configuracion_comercio`, que registra
cada cambio en `auditoria_eventos` con los valores anteriores y nuevos (entidad
`comercio_configuracion`).

| Control | Qué hace | Qué ve el cliente |
| --- | --- | --- |
| **Demanda** (`normal` / `alta`) | Cambia de inmediato qué rango de minutos se informa. | La carta (barra de escritorio) y el checkout muestran el rango del nivel vigente para retiro y envío. |
| **Pedidos pausados** + mensaje | Deja de recibir pedidos. Se guarda con el botón de la sección. | Banner con el mensaje en la carta, botón "Pedidos en pausa" en el carrito y checkout bloqueado. `POST /api/pedidos/registrar` responde `409` con `code: "PEDIDOS_PAUSADOS"`: la UI informa, el servidor es la barrera. |
| **Tiempos estimados** (sección plegable) | Ocho campos en minutos: retiro y envío × demanda normal y alta, cada uno con mínimo y máximo (0 a 240, máximo ≥ mínimo). | El texto "15-30 min" se arma con `formatearRango` (`src/lib/comercio/tiempos.ts`). |

Los valores iniciales de la migración (retiro 15-30, envío 30-45; en demanda alta +15) son
provisorios y se ajustan desde el panel. La carta reacciona en menos de un minuto: escucha la
tabla por Realtime y, como respaldo, se actualiza cada 30 segundos.

**Tiempo congelado en el pedido.** Al aceptar un pedido ("Aceptar pedido", transición a *en
preparación*) la RPC `admin_actualizar_estado_pedido_auditado` guarda en
`pedidos.tiempo_estimado_min/max` el rango vigente para la modalidad del pedido. Cambiar la
demanda o los minutos después **no** modifica pedidos ya aceptados. El panel de pedidos
muestra "Estimado: 30-45 min" y el aviso de WhatsApp incluye ese rango
(`mensajePedidoAceptadoWhatsApp` en `src/lib/comercio.ts`; PIA-8 reutiliza esta función).
Los pedidos anteriores a esta versión quedan sin rango y el mensaje se envía sin él.

### Delivery: tarifa configurable (PIA-3, etapa 2)

La sección **Delivery** de Operación muestra la tarifa guardada en pesos uruguayos
(`UYU`) y permite editarla a los mismos roles autorizados: `owner`, `admin` y
super admin. El rol `empleado` sigue sin acceso.

- **Guardar delivery** envía únicamente `costo_envio` a la API existente, con un
  identificador de operación y el cliente de sesión. La RPC administrativa registra
  el cambio en la auditoría; no hay escritura directa en la tabla.
- Acepta cero e importes positivos hasta 9999999999,99 UYU, con máximo dos
  decimales. El campo acepta coma o punto; la API exige un número JSON válido.
  Vacíos, negativos, importes no finitos y decimales adicionales se rechazan.
- Durante el guardado se bloquean los controles; se informa el éxito o el error.
  Si falla el guardado, se conserva el borrador para corregirlo o reintentar.
- La tarifa inicial definida en la migración de etapa 1 es 0 UYU; el retiro
  no tiene costo de envío.

**Estado al cierre:** la migración de etapa 1 está aplicada únicamente en
`piamonte-dev`, según confirmación del responsable del 2026-10-20. En un entorno
sin esa migración, la API puede devolver 503 indicando que falta
PIA-3 y el panel muestra el error con la opción de reintentar. No simula una tarifa
guardada ni modifica Supabase para resolverlo. La consulta de Operación incluye la
nueva columna, por lo que su carga requiere esa migración.

La etapa 2 no cambió el registro de pedidos ni el checkout; las etapas 3 y 4
integran esos contratos. La etapa 5 agrega avisos POS; horarios y perímetros
siguen fuera de PIA-3.
La aplicación de la migración debe coordinarse con el despliegue por el cambio
de firma de la RPC de pedidos.

Verificación enfocada: `node --test tests/operacion.test.mjs`. Incluye validación
monetaria, roles, filtro por comercio, contrato auditado, errores de migración y
eventos del panel con dobles de hooks/fetch, sin conexiones remotas.

## Desarrollo y verificación

### Registro de pedidos y pagos en servidor (PIA-3, etapa 3)

`POST /api/pedidos/registrar` admite `metodoPago` en la raíz del JSON, junto con
`comercioSlug`, `checkout` e `items`:

- Delivery exige explícitamente `efectivo` o `tarjeta_pos`. Si falta el método,
  es inválido o se envía `pago_en_local`, responde 400 sin registrar el pedido.
- Retiro usa exclusivamente `pago_en_local`. Puede omitirse el campo porque no
  hay otra elección; cualquier valor explícito diferente se rechaza.
- El servidor lee pausa y tarifa de `comercio_configuracion` con el cliente
  existente, filtrando por el comercio activo resuelto. Delivery sin fila o
  con tarifa inválida se rechaza; no se reemplaza silenciosamente por cero.
  Retiro siempre usa envío cero, independientemente de la tarifa de delivery.
- Productos, variantes y opciones se recalculan desde el catálogo. Los importes
  del navegador no se usan. Las sumas y multiplicaciones monetarias se hacen en
  centésimos enteros y se validan antes de enviar a la RPC.
- Se mantiene la RPC atómica con el cliente privado, ahora enviando
  `p_metodo_pago` y `p_costo_envio` según el contrato de etapa 1. No se reintenta
  con la firma anterior si falta la migración.
- La respuesta 201 conserva `pedidoId`, `numeroPedido` y `subtotal`, y agrega
  `costoEnvio` y `total` como números en UYU. `total = subtotal + costoEnvio`
  calculado en centésimos, sin modificar pedidos anteriores.

Se conservan controles de horario, pausa, comercio activo, categorías,
productos, variantes, opciones y conflicto atómico de disponibilidad.
El registro continúa siendo para invitados, sin añadir sesión de cliente.

**Integración:** la etapa 4 incorpora el selector y envía `metodoPago`.
Las pruebas funcionales en `piamonte-dev` fueron correctas según confirmación del
responsable. En producción la migración sigue pendiente: no desplegar contra la
firma anterior sin coordinar aplicación de SQL y código.

Pruebas enfocadas: `node --test tests/registro-pagos.test.mjs tests/operacion.test.mjs tests/checkout-admin.test.mjs`.
Usan dobles locales de Supabase y verifican pagos, importes, rechazos y controles
existentes; no aplican SQL. La evidencia funcional en desarrollo se registra en el
cierre técnico de PIA-3, sin atribuirla a la suite local.

### Checkout y selección de pago (PIA-3, etapa 4)

- Delivery muestra **Efectivo** y **Tarjeta (POS)** sin selección automática.
  Al confirmar sin elegir se muestra un error y no se envía el pedido.
- Retiro muestra **Pagás en el local**, sin selector, y envía `pago_en_local`.
  Cambiar de delivery a retiro elimina la elección previa; volver a delivery
  exige elegir otra vez.
- El método se conserva en `sessionStorage` junto a los demás datos de checkout.
  Las sesiones anteriores sin método son compatibles: no se inventa un método
  para delivery. Los valores desconocidos o incompatibles se descartan.
- La página obtiene la tarifa desde `comercio_configuracion` con el cliente
  existente y la pasa al resumen. Si falla, muestra un error y bloquea delivery;
  no presenta una tarifa gratuita ficticia. Retiro muestra envío cero.
- El resumen incluye **Subtotal**, **Envío** y **Total estimado** en UYU, con dos
  decimales. Antes de seleccionar modalidad, envío y total quedan por confirmar.
  La tarifa es una instantánea al cargar la página: puede cambiar durante la compra.
- El navegador envía el método en la raíz del JSON y los datos e identificadores
  del pedido, **no envía subtotal, tarifa ni total para fijar el cobro**.
  El servidor vuelve a consultar el catálogo y la tarifa vigente.
- Después del registro se muestran los importes confirmados por el servidor,
  aunque difieran de la estimación. Solo entonces se vacía el carrito. Si el
  servidor rechaza, se conservan carrito y datos para corregir o reintentar.
  Si el pedido ya tiene identificador pero su respuesta monetaria es inválida,
  se informa que fue registrado sin mostrar un total estimado como confirmado
  ni ofrecer nuevamente el envío del mismo carrito.

La migración está **aplicada solo en desarrollo**. Un error de tarifa o RPC no se resuelve
automáticamente modificando Supabase. La etapa 5 incorpora la visualización
administrativa descrita a continuación.

Prueba enfocada: `node --test tests/checkout-pagos.test.mjs`. Cubre persistencia,
cambio de modalidad, radios y errores accesibles, payload sin importes,
confirmación con tarifa actualizada, pausa/cierre y fallos de integración mediante
dobles locales. Las pruebas funcionales con Supabase de desarrollo fueron
confirmadas por el responsable; no se informó una matriz de dispositivos.
No se requieren conexiones remotas para esta suite.

### Medios de pago y aviso POS en administración (PIA-3, etapa 5)

Las tarjetas y el detalle de pedidos muestran etiquetas legibles:

| Valor guardado | Etiqueta |
| --- | --- |
| `efectivo` | Efectivo |
| `tarjeta_pos` | Tarjeta (POS) |
| `pago_en_local` | Pago en el local |

Un método histórico diferente se identifica como **Método histórico: valor**,
sin cambiar el dato ni sustituirlo por uno de los métodos actuales.

Para un pedido **delivery con `tarjeta_pos`**, aparece **Llevar POS** con fondo
rojo, texto blanco y tamaño destacado en tres lugares: tarjeta, detalle y aviso
visual de pedido nuevo. No aparece para efectivo, pago en el local ni retiro,
incluso si un retiro histórico tuviera `tarjeta_pos`.

El detalle muestra **Subtotal / Envío / Total** con dos decimales y moneda UYU,
tomados del pedido guardado, no de la tarifa actual del comercio. La API
administrativa consulta `subtotal`, `costo_envio`, `total`, `metodo_pago` y
`modalidad`; conserva la respuesta camelCase (`costoEnvio`, `metodoPago`) y los
filtros y permisos existentes para administradores y empleados.

La API de pedidos sin revisar agrega `metodoPago` al aviso. Se reutilizan el
canal Realtime, el respaldo periódico y la sincronización existente: no hay
otro canal ni otra alarma. Se conservan el contador **Sin revisar**, la marca
**Visto** y el sonido único cuando aparece un pedido nuevo (sin sonar por la
primera carga o por resincronizaciones del mismo pedido). Marcar visto no
modifica el estado comercial ni elimina el aviso POS de tarjeta o detalle.

Esta etapa no cambia checkout, registro, transiciones de estados ni mensajes de
WhatsApp. No aplica SQL ni modifica vínculos. La migración de PIA-3 está aplicada
solo en desarrollo y sigue pendiente en producción; las columnas monetarias leídas
de `pedidos` ya existen en el esquema base.

Pruebas enfocadas:
`node --test tests/admin-pagos.test.mjs tests/whatsapp-pedidos.test.mjs`.
Cubren APIs y roles, etiquetas, aviso POS en las tres superficies, desglose,
sonido/Realtime y marca visto mediante dobles locales. El responsable confirmó
«Llevar POS» en desarrollo; no se informó una prueba específica de reconexión,
audio entre sesiones o una matriz de dispositivos.

### Cierre técnico de PIA-3 (2026-10-20)

Etapas 1–5 implementadas en `feature/PIA-3-medios-de-pago`, listas para revisión
mediante PR hacia `develop`; no implica que estén integradas ni desplegadas en
producción. La migración `20261020145041_medios_pago_costo_envio.sql` fue aplicada
**únicamente en `piamonte-dev`**, según confirmación del responsable.

| Criterio de aceptación | Implementación y evidencia |
| --- | --- |
| Delivery con efectivo | Selector obligatorio, validación de servidor/RPC; prueba funcional correcta en desarrollo informada por el responsable. |
| Delivery con tarjeta POS | Selector y método `tarjeta_pos`; prueba funcional correcta en desarrollo informada por el responsable. |
| Retiro con pago en local | Sin selector, `pago_en_local` y envío cero; prueba funcional correcta en desarrollo informada por el responsable. |
| Aviso «Llevar POS» | Tarjeta, detalle y notificación visual para delivery+POS; cobertura local de las tres superficies y prueba funcional correcta en desarrollo informada por el responsable. |
| Tarifa única administrable | Inicial 0 UYU, edición en Operación por RPC auditada; cambio funcional de tarifa confirmado en desarrollo. |
| Desglose e importes | Subtotal/envío/total guardados, cálculo de servidor en centésimos, resumen estimado y total confirmado; cobertura automatizada en las suites de registro, checkout y administración. |
| Permisos y controles existentes | Cobertura local de roles, auditoría SQL, disponibilidad, pausa, sonido y marca visto; no se presume una auditoría remota adicional durante el cierre. |

La evidencia manual anterior fue suministrada por el responsable el 2026-10-20;
no fue ejecutada nuevamente por el asistente durante este cierre. Las suites
automatizadas usan dobles locales y comprobaciones estáticas SQL, no una base
remota. Resultado de cierre: `npm.cmd run verificar` aprobado, salida 0; lint sin
errores, tipos correctos, 115 pruebas aprobadas (0 fallidas, 0 omitidas) y build
correcto. Persisten dos advertencias previas de ESLint por uso de `<img>` en
`MarcaPiamonte.tsx` y `ContenidoCarrito.tsx`, y el aviso de Next.js por ignorar un
lockfile fuera del repositorio. No se corrigieron por estar fuera de alcance.

**Antes de producción:** revisar el historial real de migraciones pendientes
(incluidas PIA-20 y PIA-2), respaldo y dependencias de la RPC; coordinar SQL y
despliegue porque cambia la firma; contemplar bloqueo de pedidos e históricos
incompatibles; verificar permisos/auditoría efectivos y repetir los tres flujos
de pago y el cambio de tarifa. Confirmar también notificaciones entre sesiones,
audio/reconexión y visualización móvil. No hay aprobación de producción implícita.

### Acceso de empleados por correo

En **Administración → Empleados**, cada empleado tiene una sección **Acceso**:

- Enviar o reenviar la invitación si el correo todavía no está confirmado.
  Se reutiliza el usuario de Auth; no se crea otra cuenta ni se cambia su rol.
- Solicitar un enlace de recuperación al correo registrado, sin aceptar un correo
  alternativo del navegador. El empleado establece su contraseña; el administrador
  nunca la recibe. Si el correo ya está confirmado, esta es la acción indicada.
- Consultar por separado el vínculo habilitado/deshabilitado, la existencia de la
  cuenta, el bloqueo en Auth, la confirmación del correo y el último ingreso a la
  cuenta. Un envío aceptado por Supabase no prueba entrega ni aceptación; tampoco
  un correo confirmado demuestra que exista una contraseña. El último ingreso
  corresponde a Auth, no necesariamente a una visita al panel.

Los enlaces abren `/admin/acceso`, fuera del layout administrativo protegido.
La pantalla recibe los secretos en el fragmento del enlace, lo retira del historial
y los conserva solo en memoria durante ese flujo. La confirmación se envía por POST
a `/admin/acceso/confirmar`; el servidor verifica el enlace con Supabase y los
permisos vigentes antes de cambiar la contraseña mediante el cliente público de
sesión, nunca mediante service_role. No reemplaza la sesión existente del navegador.
Después se ingresa normalmente por `/admin/login`. Si se recarga la pantalla tras
retirar el fragmento, hay que volver a abrir el correo o solicitar un enlace nuevo.

Las acciones administrativas validan sesión, origen, rol y vínculo en el servidor.
Solo gestionan empleados activos del comercio resuelto por la aplicación. No
gestionan owner/admin/operador, Super Admin ni cuentas vinculadas a otros comercios
(incluso si esos otros vínculos están inactivos), porque las credenciales de
Supabase son globales. El estado de un vínculo se sigue cambiando con la acción
existente; solicitar un correo nunca lo reactiva ni modifica sus permisos.

**Configuración necesaria antes de la prueba real:**

1. Revisar y ejecutar manualmente [el SQL de acceso](../supabase/migrations/20261014100012_acceso_empleados.sql)
   después de las migraciones existentes de empleados y auditoría. Solo agrega dos
   RPC; no modifica datos, roles ni tablas internas de Auth. No se ejecuta desde
   la aplicación. Si falta, las nuevas acciones no envían correos sin auditoría.
2. Configurar `NEXT_PUBLIC_SITE_URL` con el origen público correcto: HTTPS en
   producción o `http://localhost:3000` en desarrollo. La aplicación construye
   `/admin/acceso` desde esa configuración, no desde valores del navegador.
3. En Supabase Auth → URL Configuration, permitir la URL exacta
   `https://TU_DOMINIO/admin/acceso` y, si se prueba localmente,
   `http://localhost:3000/admin/acceso`. Revisar también Site URL.
4. Configurar/verificar SMTP, remitente, límites de envío y vencimiento de enlaces
   en Supabase. Mantener las plantillas Invite user y Reset password con
   `{{ .ConfirmationURL }}` para que Supabase valide el enlace y redirija con
   los tokens en el fragmento. No apuntarlas al callback de clientes ni a un
   callback PKCE: el administrador y el empleado pueden usar navegadores distintos.
   Si ya se usan plantillas personalizadas, revisar su compatibilidad sin alterar
   los flujos de clientes. También se admiten enlaces personalizados a
   `{{ .RedirectTo }}#token_hash={{ .TokenHash }}&type=invite` o `type=recovery`,
   únicamente para este flujo administrativo.
5. Mantener `SUPABASE_SERVICE_ROLE_KEY` exclusivamente en el entorno del servidor.
   Verificar que la credencial sea válida. No activar captura de cuerpos de estas
   solicitudes en herramientas de observabilidad: contienen credenciales del
   propio empleado y nunca deben registrarse.

Los envíos registran intención y resultado en `auditoria_eventos` usando el actor
de la sesión: `acceso_solicitado`, `acceso_correo_enviado` y
`acceso_correo_fallido`. Pueden filtrarse en la auditoría de Super Admin. No se
guardan enlaces, tokens ni contraseñas. Se limita a una nueva solicitud por cuenta
cada 60 segundos y se rechaza reutilizar la misma operación para enviar de nuevo.
La llamada a Auth y la auditoría no comparten transacción: si hay una interrupción,
puede quedar solo la intención; eso no demuestra que el correo no se haya enviado.
La actualización de contraseña del propio empleado queda en los registros de
auditoría de Supabase Auth, no como una acción atribuida al administrador.

**Prueba manual sin modificar pedidos ni cuentas de clientes:**

1. Con un administrador autorizado, invitar un correo de prueba nuevo. Comprobar
   vínculo habilitado, correo pendiente y ausencia de ingresos; reenviar sin que
   aparezca un segundo usuario en Supabase.
2. Abrir el correo en otra ventana privada, elegir la contraseña e ingresar por
   `/admin/login`. Actualizar Empleados y verificar correo confirmado e ingreso
   registrado, sin presentar el envío como aceptación.
3. Solicitar Restablecer contraseña, abrir el nuevo correo en otra ventana y
   establecer una contraseña diferente. Confirmar que permite ingresar y que la
   anterior deja de servir. Probar un enlace vencido/usado y contraseñas distintas.
4. Deshabilitar el vínculo y comprobar que no admite nuevos envíos ni guardar una
   contraseña desde este flujo. Con sesión de empleado, sin sesión y con cuentas
   de otro comercio o de owner, comprobar el rechazo de las acciones.
5. Revisar auditoría, el intervalo de 60 segundos y que no haya secretos en la
   interfaz, respuestas administrativas ni logs. Las pruebas automatizadas usan
   dobles: no envían correos ni ejecutan el SQL en Supabase.

**Contraseña temporal manual — solo propuesta, no implementada:**

Verificar primero la identidad del empleado por un procedimiento humano acordado
con el comercio; una invitación previa no demuestra identidad. La acción requeriría
reautenticación reciente del administrador, los mismos controles de alcance y una
auditoría sin secretos. Supabase guardaría el hash, nunca texto plano. Haría falta
un estado privado de acceso con vencimiento y cambio obligatorio, mantenido por el
servidor (no metadatos editables por el usuario), y una barrera en todas las páginas
y API administrativas que, tras iniciar sesión, solo permita cambiar la contraseña
o salir hasta completar el cambio. Se necesitaría también un cierre seguro de
sesiones y una política de caducidad; asignar una contraseña con Auth Admin API
por sí solo no implementa ninguno de esos requisitos.

```bash
npm run dev
node --test tests/checkout-admin.test.mjs
npm run lint
npm run build
```

Abrir `http://localhost:3000`. Las pruebas automatizadas usan dobles de Supabase,
no envían SMS ni generan pedidos reales.

Pruebas manuales:

1. En una ventana privada, agregar productos y completar retiro y delivery.
   Probar nombre vacío, celular inválido y delivery sin calle/número.
2. Acordar con el local un pedido real de prueba. Verificar el número correlativo,
   el teléfono normalizado, items, opciones y total en el panel.
3. Ingresar con el administrador actual; comprobar listado y cambios de estado.
4. Abrir Clientes, buscar con nombre/celular, seleccionar un contacto y comparar
   cantidades, fecha, dirección y total con sus pedidos. Comprobar que un cancelado
   está señalado y no suma al importe.
5. Con un usuario sin vínculo administrativo, comprobar el rechazo del panel y
   HTTP 403 en su API; sin sesión debe responder 401.
6. Con dos comercios autorizados por separado, comprobar que cada sesión solo
   consulta el comercio resuelto por el servidor, aunque se envíe otro ID en la URL.
7. Revisar móvil y escritorio: carta/carrito/checkout sin enlaces de cuentas y
   Clientes responsive. Las rutas retiradas devuelven 404 y no tienen enlaces internos.
8. Operación: pasar a demanda alta y comprobar que la carta muestra los rangos de ese nivel
   sin recargar a mano; editar un rango y verificar la fila en `auditoria_eventos`; activar la
   pausa y comprobar banner, checkout bloqueado y `409 PEDIDOS_PAUSADOS` en un `POST` directo;
   con la pausa desactivada, hacer un pedido, aceptarlo y verificar `tiempo_estimado_min/max`
   en `pedidos`, que no cambia al cambiar la demanda y que el aviso de WhatsApp incluye el
   rango; con un usuario `empleado`, Operación no aparece y `PATCH /api/admin/operacion` da 403.
