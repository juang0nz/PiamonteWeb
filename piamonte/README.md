# Plataforma de pedidos gastronómicos

Aplicación Next.js, TypeScript, Tailwind CSS y Supabase. Piamonte es el primer
comercio; los pedidos, productos, variantes y opciones mantienen su lógica existente.

## Compra sin registro

La web pública permite entrar a la carta y comprar directamente. No ofrece cuentas,
Google OAuth, SMS/OTP, perfiles, direcciones guardadas ni recuperación de contraseñas
para clientes. Las antiguas rutas `/mi-cuenta` y `/auth/callback` se retiraron.
No se modifican proveedores externos ni se eliminan usuarios de Supabase Auth.

El checkout solicita nombre, celular, delivery o retiro y método de pago. Calle,
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

## Desarrollo y verificación

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

## Fotos de las categorías

Las tarjetas de inicio usan fotos ilustrativas locales en `public/brand/categorias`.
Estas fotos son de ejemplo: no representan necesariamente los productos del local.

Para reemplazarlas por fotos reales:

- Cargar la ruta pública o URL de la foto en `categorias.imagen_url` en Supabase.
  Este valor tiene prioridad sobre la imagen de ejemplo.
- O agregar la foto a `public/brand/categorias` y cambiar la entrada correspondiente
  en `src/lib/comercio/imagenesCategorias.ts`, usando una ruta como
  `/brand/categorias/chivito-real.jpeg`. La clave de cada entrada es el slug de la categoría.
- El campo opcional `posicion` permite ajustar el encuadre de una imagen local,
  por ejemplo `"center 65%"`. Las tarjetas mantienen las proporciones sin deformar las fotos.

Las categorías nuevas sin fotos conservan un fondo decorativo. No se modifican
los productos ni la estructura de la base de datos.

### Créditos de las fotos ilustrativas

Las imágenes se descargaron en tamaño reducido; las tarjetas recortan su encuadre.
Las fotos de Wikimedia Commons mantienen la licencia indicada:

| Archivo | Autor y fuente | Licencia |
| --- | --- | --- |
| `calzone.jpeg` | [TELLURIDE 749](https://commons.wikimedia.org/wiki/File:Calzone_01.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `picada.jpeg` | [Joli Rumi](https://commons.wikimedia.org/wiki/File:A_charcuterie_board_with_cheese_and_crackers.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `milanesa.jpeg` | [Kritzolina](https://commons.wikimedia.org/wiki/File:Allg%C3%A4uer_Schnitzel_mit_Kr%C3%A4uterr%C3%B6sti.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `chivito.jpeg` | [Gnangcomapp](https://commons.wikimedia.org/wiki/File:Steak_Sanga_gn.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `fritas-salseadas.jpeg` | [Andy Li](https://commons.wikimedia.org/wiki/File:Vegan_BBQ_Boss_Loaded_Waffle_Fries_-_Brewhouse_%26_Kitchen,_Worthing_2026-06-08.jpg) | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |

Las demás imágenes de ejemplo provienen de Unsplash, bajo su
[licencia](https://unsplash.com/license):

- [Pizza](https://images.unsplash.com/photo-1513104890138-7c749659a591).
- [Pizzeta](https://images.unsplash.com/photo-1579751626657-72bc17010498).
- [Hamburguesa](https://images.unsplash.com/photo-1568901346375-23c9450c58cd).
- [Sándwich](https://images.unsplash.com/photo-1528735602780-2552fd46c7af).
- [Fritas](https://images.unsplash.com/photo-1573080496219-bb080dd4f877).
- [Especiales](https://images.unsplash.com/photo-1562967914-608f82629710).
- [Bebida](https://images.unsplash.com/photo-1622483767028-3f66f32aef97).
