SET local check_function_bodies = off;

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "service_role";

CREATE TABLE "public"."admin_comercios" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"     uuid                     NOT NULL,
  "comercio_id" uuid                     NOT NULL,
  "rol"         text                     NOT NULL,
  "activo"      boolean                  NOT NULL DEFAULT true,
  "creado_en"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "admin_comercios_pkey" PRIMARY KEY (id),
  CONSTRAINT "admin_comercios_rol_check" CHECK ((rol = ANY (ARRAY['owner'::text, 'admin'::text, 'operador'::text, 'empleado'::text]))),
  CONSTRAINT "admin_comercios_user_id_comercio_id_key" UNIQUE (user_id, comercio_id)
);

ALTER TABLE "public"."admin_comercios"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."auditoria_eventos" (
  "id"                 uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "operacion_id"       uuid                     NOT NULL,
  "secuencia"          smallint                 NOT NULL DEFAULT 1,
  "creado_en"          timestamp with time zone NOT NULL DEFAULT now(),
  "actor_user_id"      uuid                     NOT NULL,
  "comercio_id"        uuid                     NOT NULL,
  "accion"             text                     NOT NULL,
  "entidad"            text                     NOT NULL,
  "registro_id"        uuid                     NOT NULL,
  "valores_anteriores" jsonb,
  "valores_nuevos"     jsonb,
  CONSTRAINT "auditoria_eventos_accion_check" CHECK ((accion ~ '^[a-z][a-z0-9_]{1,63}$'::text)),
  CONSTRAINT "auditoria_eventos_entidad_check"
    CHECK ((entidad = ANY (ARRAY['categoria'::text, 'producto'::text, 'variante'::text, 'pedido'::text, 'admin_comercio'::text, 'admin_invitacion'::text, 'horario'::text]))),
  CONSTRAINT "auditoria_eventos_pkey" PRIMARY KEY (id),
  CONSTRAINT "auditoria_eventos_secuencia_check" CHECK ((secuencia > 0)),
  CONSTRAINT "auditoria_operacion_secuencia_unique" UNIQUE (operacion_id, secuencia),
  CONSTRAINT "auditoria_valores_objeto_check"
    CHECK
    ((((valores_anteriores IS NULL) OR (jsonb_typeof(valores_anteriores) = 'object'::text)) AND ((valores_nuevos IS NULL) OR (jsonb_typeof(valores_nuevos) = 'object'::text)) AND
    ((valores_anteriores IS NOT NULL) OR (valores_nuevos IS NOT NULL))))
);

ALTER TABLE "public"."auditoria_eventos"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."auditoria_eventos" FROM "anon", "service_role";

CREATE TABLE "public"."auditoria_invitaciones_admin" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "operacion_id"      uuid                     NOT NULL,
  "comercio_id"       uuid                     NOT NULL,
  "actor_user_id"     uuid                     NOT NULL,
  "email_normalizado" text                     NOT NULL,
  "usuario_auth_id"   uuid,
  "estado"            text                     NOT NULL DEFAULT 'iniciada'::text,
  "motivo_fallo"      text,
  "iniciada_en"       timestamp with time zone NOT NULL DEFAULT now(),
  "actualizada_en"    timestamp with time zone NOT NULL DEFAULT now(),
  "rol"               text                     NOT NULL DEFAULT 'admin'::text,
  CONSTRAINT "auditoria_invitaciones_admin_email_normalizado_check" CHECK (((length(email_normalizado) >= 3) AND (length(email_normalizado) <= 320))),
  CONSTRAINT "auditoria_invitaciones_admin_estado_check" CHECK ((estado = ANY (ARRAY['iniciada'::text, 'completada'::text, 'fallida'::text]))),
  CONSTRAINT "auditoria_invitaciones_admin_operacion_id_key" UNIQUE (operacion_id),
  CONSTRAINT "auditoria_invitaciones_admin_pkey" PRIMARY KEY (id),
  CONSTRAINT "auditoria_invitaciones_admin_rol_check" CHECK ((rol = ANY (ARRAY['admin'::text, 'empleado'::text])))
);

ALTER TABLE "public"."auditoria_invitaciones_admin"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."auditoria_invitaciones_admin" FROM "anon", "authenticated", "service_role";

CREATE TABLE "public"."categorias" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "comercio_id" uuid                     NOT NULL,
  "nombre"      text                     NOT NULL,
  "slug"        text                     NOT NULL,
  "descripcion" text,
  "imagen_url"  text,
  "orden"       integer                  NOT NULL DEFAULT 0,
  "activa"      boolean                  NOT NULL DEFAULT true,
  "creado_en"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "categorias_comercio_id_slug_key" UNIQUE (comercio_id, slug),
  CONSTRAINT "categorias_id_comercio_unico" UNIQUE (id, comercio_id),
  CONSTRAINT "categorias_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."categorias"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."clientes_direcciones" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"        uuid                     NOT NULL,
  "comercio_id"    uuid                     NOT NULL,
  "etiqueta"       text,
  "calle"          text                     NOT NULL,
  "numero"         text                     NOT NULL,
  "apartamento"    text,
  "referencias"    text,
  "predeterminada" boolean                  NOT NULL DEFAULT false,
  "creada_en"      timestamp with time zone NOT NULL DEFAULT now(),
  "actualizada_en" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "clientes_direcciones_apartamento_check"
    CHECK (((apartamento IS NULL) OR ((length(TRIM(BOTH FROM apartamento)) >= 1) AND (length(TRIM(BOTH FROM apartamento)) <= 20)))),
  CONSTRAINT "clientes_direcciones_calle_check" CHECK (((length(TRIM(BOTH FROM calle)) >= 1) AND (length(TRIM(BOTH FROM calle)) <= 120))),
  CONSTRAINT "clientes_direcciones_etiqueta_check" CHECK (((etiqueta IS NULL) OR ((length(TRIM(BOTH FROM etiqueta)) >= 1) AND (length(TRIM(BOTH FROM etiqueta)) <= 40)))),
  CONSTRAINT "clientes_direcciones_numero_check" CHECK (((length(TRIM(BOTH FROM numero)) >= 1) AND (length(TRIM(BOTH FROM numero)) <= 20))),
  CONSTRAINT "clientes_direcciones_pkey" PRIMARY KEY (id),
  CONSTRAINT "clientes_direcciones_referencias_check"
    CHECK (((referencias IS NULL) OR ((length(TRIM(BOTH FROM referencias)) >= 1) AND (length(TRIM(BOTH FROM referencias)) <= 300))))
);

ALTER TABLE "public"."clientes_direcciones"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."clientes_direcciones" FROM "anon";

CREATE TABLE "public"."clientes_perfiles" (
  "user_id"        uuid                     NOT NULL,
  "comercio_id"    uuid                     NOT NULL,
  "nombre"         text,
  "telefono"       text,
  "creado_en"      timestamp with time zone NOT NULL DEFAULT now(),
  "actualizado_en" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "clientes_perfiles_nombre_check" CHECK (((nombre IS NULL) OR ((length(TRIM(BOTH FROM nombre)) >= 2) AND (length(TRIM(BOTH FROM nombre)) <= 120)))),
  CONSTRAINT "clientes_perfiles_pk" PRIMARY KEY (user_id, comercio_id),
  CONSTRAINT "clientes_perfiles_telefono_check" CHECK (((telefono IS NULL) OR ((length(TRIM(BOTH FROM telefono)) >= 7) AND (length(TRIM(BOTH FROM telefono)) <= 30))))
);

ALTER TABLE "public"."clientes_perfiles"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."clientes_perfiles" FROM "anon";

CREATE TABLE "public"."comercios" (
  "id"        uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "nombre"    text                     NOT NULL,
  "slug"      text                     NOT NULL,
  "activo"    boolean                  NOT NULL DEFAULT true,
  "creado_en" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "comercios_pkey" PRIMARY KEY (id),
  CONSTRAINT "comercios_slug_key" UNIQUE (slug)
);

ALTER TABLE "public"."comercios"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."grupos_opciones" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "producto_id" uuid                     NOT NULL,
  "nombre"      text                     NOT NULL,
  "minimo"      integer                  NOT NULL DEFAULT 0,
  "maximo"      integer                  NOT NULL DEFAULT 1,
  "obligatorio" boolean                  NOT NULL DEFAULT false,
  "activo"      boolean                  NOT NULL DEFAULT true,
  "orden"       integer                  NOT NULL DEFAULT 0,
  "creado_en"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "grupos_id_producto_unico" UNIQUE (id, producto_id),
  CONSTRAINT "grupos_opciones_limites_validos" CHECK (((minimo >= 0) AND (maximo >= minimo))),
  CONSTRAINT "grupos_opciones_obligatorio_valido" CHECK (((NOT obligatorio) OR (minimo >= 1))),
  CONSTRAINT "grupos_opciones_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."grupos_opciones"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."opciones" (
  "id"               uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "grupo_id"         uuid                     NOT NULL,
  "nombre"           text                     NOT NULL,
  "precio_adicional" numeric(12,2)            NOT NULL DEFAULT 0,
  "disponible"       boolean                  NOT NULL DEFAULT true,
  "orden"            integer                  NOT NULL DEFAULT 0,
  "creado_en"        timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "opciones_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."opciones"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."pagos_notificaciones" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "pago_id"         uuid                     NOT NULL,
  "proveedor"       text                     NOT NULL,
  "evento_id"       text                     NOT NULL,
  "pago_externo_id" text                     NOT NULL,
  "recibido_en"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "pagos_notificaciones_evento_unique" UNIQUE (proveedor, evento_id),
  CONSTRAINT "pagos_notificaciones_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."pagos_notificaciones"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."pagos_notificaciones" FROM "anon", "authenticated";

CREATE TABLE "public"."pagos" (
  "id"                       uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "pedido_id"                uuid                     NOT NULL,
  "proveedor"                text                     NOT NULL,
  "estado"                   text                     NOT NULL DEFAULT 'pendiente'::text,
  "monto"                    numeric(12,2)            NOT NULL,
  "moneda"                   text                     NOT NULL DEFAULT 'UYU'::text,
  "referencia_externa"       text,
  "creado_en"                timestamp with time zone NOT NULL DEFAULT now(),
  "actualizado_en"           timestamp with time zone NOT NULL DEFAULT now(),
  "preferencia_id"           text,
  "url_checkout"             text,
  "preferencia_reservada_en" timestamp with time zone,
  "pago_externo_id"          text,
  CONSTRAINT "pagos_estado_check" CHECK ((estado = ANY (ARRAY['pendiente'::text, 'aprobado'::text, 'rechazado'::text]))),
  CONSTRAINT "pagos_monto_check" CHECK ((monto >= (0)::numeric)),
  CONSTRAINT "pagos_pkey" PRIMARY KEY (id),
  CONSTRAINT "pagos_proveedor_check" CHECK ((proveedor = ANY (ARRAY['efectivo'::text, 'mercado_pago'::text])))
);

ALTER TABLE "public"."pagos"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."pagos" FROM "anon", "authenticated";

CREATE TABLE "public"."pedido_item_opciones" (
  "id"               uuid          NOT NULL DEFAULT gen_random_uuid(),
  "pedido_item_id"   uuid          NOT NULL,
  "opcion_id"        uuid          NOT NULL,
  "nombre_opcion"    text          NOT NULL,
  "precio_adicional" numeric(12,2) NOT NULL DEFAULT 0,
  CONSTRAINT "pedido_item_opciones_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."pedido_item_opciones"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."pedido_items" (
  "id"              uuid          NOT NULL DEFAULT gen_random_uuid(),
  "pedido_id"       uuid          NOT NULL,
  "producto_id"     uuid          NOT NULL,
  "variante_id"     uuid,
  "nombre_producto" text          NOT NULL,
  "nombre_variante" text,
  "cantidad"        integer       NOT NULL,
  "precio_unitario" numeric(12,2) NOT NULL,
  "total"           numeric(12,2) NOT NULL,
  "aclaraciones"    text,
  CONSTRAINT "pedido_items_cantidad_check" CHECK ((cantidad > 0)),
  CONSTRAINT "pedido_items_pkey" PRIMARY KEY (id),
  CONSTRAINT "pedido_items_precio_unitario_check" CHECK ((precio_unitario >= (0)::numeric)),
  CONSTRAINT "pedido_items_total_check" CHECK ((total >= (0)::numeric))
);

ALTER TABLE "public"."pedido_items"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."pedidos" (
  "id"                    uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "comercio_id"           uuid                     NOT NULL,
  "numero"                bigint                   GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  "cliente_nombre"        text                     NOT NULL,
  "cliente_telefono"      text                     NOT NULL,
  "modalidad"             text                     NOT NULL,
  "direccion_calle"       text,
  "direccion_numero"      text,
  "direccion_apartamento" text,
  "direccion_referencias" text,
  "estado"                text                     NOT NULL DEFAULT 'pendiente'::text,
  "metodo_pago"           text                     NOT NULL,
  "estado_pago"           text                     NOT NULL DEFAULT 'pendiente'::text,
  "subtotal"              numeric(12,2)            NOT NULL,
  "costo_envio"           numeric(12,2)            NOT NULL DEFAULT 0,
  "total"                 numeric(12,2)            NOT NULL,
  "moneda"                text                     NOT NULL DEFAULT 'UYU'::text,
  "creado_en"             timestamp with time zone NOT NULL DEFAULT now(),
  "actualizado_en"        timestamp with time zone NOT NULL DEFAULT now(),
  "revisado_en"           timestamp with time zone,
  "cliente_user_id"       uuid,
  CONSTRAINT "pedidos_check1" CHECK ((total = (subtotal + costo_envio))),
  CONSTRAINT "pedidos_check" CHECK (((modalidad = 'retiro'::text) OR ((NULLIF(TRIM(BOTH FROM direccion_calle), ''::text) IS
    NOT NULL) AND (NULLIF(TRIM(BOTH FROM direccion_numero), ''::text) IS NOT NULL)))),
  CONSTRAINT "pedidos_costo_envio_check" CHECK ((costo_envio >= (0)::numeric)),
  CONSTRAINT "pedidos_estado_check"
    CHECK ((estado = ANY (ARRAY['pendiente'::text, 'confirmado'::text, 'en_preparacion'::text, 'listo'::text, 'entregado'::text, 'cancelado'::text]))),
  CONSTRAINT "pedidos_estado_pago_check" CHECK ((estado_pago = ANY (ARRAY['pendiente'::text, 'aprobado'::text, 'rechazado'::text]))),
  CONSTRAINT "pedidos_metodo_pago_check" CHECK ((metodo_pago = ANY (ARRAY['efectivo'::text, 'mercado_pago'::text]))),
  CONSTRAINT "pedidos_modalidad_check" CHECK ((modalidad = ANY (ARRAY['delivery'::text, 'retiro'::text]))),
  CONSTRAINT "pedidos_numero_key" UNIQUE (numero),
  CONSTRAINT "pedidos_pkey" PRIMARY KEY (id),
  CONSTRAINT "pedidos_subtotal_check" CHECK ((subtotal >= (0)::numeric)),
  CONSTRAINT "pedidos_total_check" CHECK ((total >= (0)::numeric))
);

ALTER TABLE "public"."pedidos"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."productos" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "comercio_id"  uuid                     NOT NULL,
  "categoria_id" uuid                     NOT NULL,
  "nombre"       text                     NOT NULL,
  "descripcion"  text,
  "imagen_url"   text,
  "tipo"         text                     NOT NULL DEFAULT 'simple'::text,
  "precio_base"  numeric(12,2)            NOT NULL DEFAULT 0,
  "disponible"   boolean                  NOT NULL DEFAULT true,
  "destacado"    boolean                  NOT NULL DEFAULT false,
  "orden"        integer                  NOT NULL DEFAULT 0,
  "creado_en"    timestamp with time zone NOT NULL DEFAULT now(),
  "activo"       boolean                  NOT NULL DEFAULT true,
  CONSTRAINT "productos_pkey" PRIMARY KEY (id),
  CONSTRAINT "productos_precio_base_check" CHECK ((precio_base >= (0)::numeric)),
  CONSTRAINT "productos_tipo_check" CHECK ((tipo = ANY (ARRAY['simple'::text, 'combo'::text])))
);

ALTER TABLE "public"."productos"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."reglas_opciones_variante" (
  "id"          uuid    NOT NULL DEFAULT gen_random_uuid(),
  "variante_id" uuid    NOT NULL,
  "grupo_id"    uuid    NOT NULL,
  "minimo"      integer NOT NULL DEFAULT 0,
  "maximo"      integer NOT NULL DEFAULT 1,
  "activo"      boolean NOT NULL DEFAULT true,
  "producto_id" uuid    NOT NULL,
  CONSTRAINT "reglas_limites_validos" CHECK (((minimo >= 0) AND (maximo >= minimo))),
  CONSTRAINT "reglas_opciones_variante_pkey" PRIMARY KEY (id),
  CONSTRAINT "reglas_variante_grupo_unicos" UNIQUE (variante_id, grupo_id)
);

ALTER TABLE "public"."reglas_opciones_variante"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."super_admins" (
  "id"        uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"   uuid                     NOT NULL,
  "activo"    boolean                  NOT NULL DEFAULT true,
  "creado_en" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "super_admins_pkey" PRIMARY KEY (id),
  CONSTRAINT "super_admins_user_id_key" UNIQUE (user_id)
);

ALTER TABLE "public"."super_admins"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."variantes_producto" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "producto_id" uuid                     NOT NULL,
  "nombre"      text                     NOT NULL,
  "precio"      numeric(12,2)            NOT NULL,
  "disponible"  boolean                  NOT NULL DEFAULT true,
  "orden"       integer                  NOT NULL DEFAULT 0,
  "creado_en"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "variantes_id_producto_unico" UNIQUE (id, producto_id),
  CONSTRAINT "variantes_producto_pkey" PRIMARY KEY (id),
  CONSTRAINT "variantes_producto_precio_check" CHECK ((precio >= (0)::numeric))
);

ALTER TABLE "public"."variantes_producto"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON SEQUENCE "public"."pedidos_numero_seq" FROM "anon";

REVOKE ALL ON SEQUENCE "public"."pedidos_numero_seq" FROM "authenticated";

REVOKE ALL ON SEQUENCE "public"."pedidos_numero_seq" FROM "service_role";

CREATE OR REPLACE FUNCTION public.admin_actualizar_categoria_auditada (
  p_operacion_id uuid,
  p_comercio_id  uuid,
  p_categoria_id uuid,
  p_nombre       text,
  p_descripcion  text,
  p_imagen_url   text,
  p_activa       boolean
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public', 'auth'
  AS $function$
declare
  v_anterior jsonb;
  v_nuevo jsonb;
  v_continuar boolean;
begin
  v_continuar := public.auditoria_iniciar_operacion(
    p_operacion_id, p_comercio_id, 'categoria', p_categoria_id
  );
  if not v_continuar then return true; end if;

  select jsonb_build_object(
    'nombre', nombre,
    'descripcion', descripcion,
    'imagen_url', imagen_url,
    'activa', activa
  )
  into v_anterior
  from public.categorias
  where id = p_categoria_id
    and comercio_id = p_comercio_id
  for update;

  if v_anterior is null then
    raise exception 'La categoría no pertenece al comercio autorizado.'
      using errcode = 'P0002';
  end if;

  update public.categorias
  set nombre = p_nombre,
      descripcion = p_descripcion,
      imagen_url = p_imagen_url,
      activa = p_activa
  where id = p_categoria_id
    and comercio_id = p_comercio_id;

  v_nuevo := jsonb_build_object(
    'nombre', p_nombre,
    'descripcion', p_descripcion,
    'imagen_url', p_imagen_url,
    'activa', p_activa
  );
  perform public.auditoria_finalizar_operacion(
    p_operacion_id, 1, p_comercio_id, 'actualizar', 'categoria',
    p_categoria_id, v_anterior, v_nuevo
  );
  return true;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."admin_actualizar_categoria_auditada"(uuid, uuid, uuid, text, text, text, boolean) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.admin_actualizar_estado_pedido_auditado (
  p_operacion_id    uuid,
  p_comercio_id     uuid,
  p_pedido_id       uuid,
  p_estado_esperado text,
  p_nuevo_estado    text
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public', 'auth'
  AS $function$ declare v_anterior jsonb;

v_continuar boolean;

v_es_empleado boolean;

begin if p_estado_esperado is null

or p_nuevo_estado is null

or p_estado_esperado not in (

  'pendiente',

  'confirmado',

  'en_preparacion',

  'listo',

  'entregado',

  'cancelado'

)

or p_nuevo_estado not in (

  'pendiente',

  'confirmado',

  'en_preparacion',

  'listo',

  'entregado',

  'cancelado'

) then raise exception 'Estado de pedido inválido.' using errcode = '22023';

end if;

if not (

  (

    p_estado_esperado = 'pendiente'

    and p_nuevo_estado in ('en_preparacion', 'cancelado')

  )

  or (

    p_estado_esperado = 'confirmado'

    and p_nuevo_estado in ('listo', 'cancelado')

  )

  or (

    p_estado_esperado = 'en_preparacion'

    and p_nuevo_estado = 'listo'

  )

  or (

    p_estado_esperado = 'listo'

    and p_nuevo_estado = 'entregado'

  )

) then raise exception 'La transición de estado no está permitida.' using errcode = '40001';

end if;

-- Un Empleado puro (sin Super Admin ni rol admin en el comercio) sólo

-- avanza el flujo: recibir, preparar, marcar listo y entregar.

v_es_empleado := public.es_empleado_de_comercio(p_comercio_id)

and not public.es_super_admin_activo()

and not public.es_admin_de_comercio(p_comercio_id);

if v_es_empleado

and p_nuevo_estado = 'cancelado' then raise exception 'Un Empleado no puede cancelar pedidos.' using errcode = '42501';

end if;

v_continuar := public.auditoria_iniciar_operacion(

  p_operacion_id,

  p_comercio_id,

  'pedido',

  p_pedido_id

);

if not v_continuar then return true;

end if;

select

  jsonb_build_object('estado', estado) into v_anterior

from

  public.pedidos

where

  id = p_pedido_id

  and comercio_id = p_comercio_id

  and estado = p_estado_esperado for

update

;

if v_anterior is null then raise exception 'El pedido no existe o cambió de estado.' using errcode = '40001';

end if;

update

  public.pedidos

set

  estado = p_nuevo_estado,

  actualizado_en = now()

where

  id = p_pedido_id

  and comercio_id = p_comercio_id

  and estado = p_estado_esperado;

perform public.auditoria_finalizar_operacion(

  p_operacion_id,

  1,

  p_comercio_id,

  'cambiar_estado',

  'pedido',

  p_pedido_id,

  v_anterior,

  jsonb_build_object('estado', p_nuevo_estado)

);

return true;

end;

$function$;

REVOKE ALL ON FUNCTION "public"."admin_actualizar_estado_pedido_auditado"(uuid, uuid, uuid, text, text) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.admin_actualizar_producto_auditado (
  p_operacion_id uuid,
  p_comercio_id  uuid,
  p_producto_id  uuid,
  p_categoria_id uuid,
  p_nombre       text,
  p_descripcion  text,
  p_imagen_url   text,
  p_precio_base  numeric,
  p_disponible   boolean,
  p_destacado    boolean
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public', 'auth'
  AS $function$
declare
  v_anterior jsonb;
  v_nuevo jsonb;
  v_continuar boolean;
begin
  v_continuar := public.auditoria_iniciar_operacion(
    p_operacion_id, p_comercio_id, 'producto', p_producto_id
  );
  if not v_continuar then return true; end if;

  if not exists (
    select 1 from public.categorias
    where id = p_categoria_id
      and comercio_id = p_comercio_id
      and activa = true
  ) then
    raise exception 'La categoría no pertenece al comercio o está inactiva.'
      using errcode = 'P0002';
  end if;

  select jsonb_build_object(
    'categoria_id', categoria_id,
    'nombre', nombre,
    'descripcion', descripcion,
    'imagen_url', imagen_url,
    'precio_base', precio_base,
    'disponible', disponible,
    'destacado', destacado
  )
  into v_anterior
  from public.productos
  where id = p_producto_id
    and comercio_id = p_comercio_id
  for update;

  if v_anterior is null then
    raise exception 'El producto no pertenece al comercio autorizado.'
      using errcode = 'P0002';
  end if;

  update public.productos
  set categoria_id = p_categoria_id,
      nombre = p_nombre,
      descripcion = p_descripcion,
      imagen_url = p_imagen_url,
      precio_base = p_precio_base,
      disponible = p_disponible,
      destacado = p_destacado
  where id = p_producto_id
    and comercio_id = p_comercio_id;

  v_nuevo := jsonb_build_object(
    'categoria_id', p_categoria_id,
    'nombre', p_nombre,
    'descripcion', p_descripcion,
    'imagen_url', p_imagen_url,
    'precio_base', p_precio_base,
    'disponible', p_disponible,
    'destacado', p_destacado
  );
  perform public.auditoria_finalizar_operacion(
    p_operacion_id, 1, p_comercio_id, 'actualizar', 'producto',
    p_producto_id, v_anterior, v_nuevo
  );
  return true;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."admin_actualizar_producto_auditado"(uuid, uuid, uuid, uuid, text, text, text, numeric, boolean, boolean) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.admin_actualizar_variante_auditada (
  p_operacion_id uuid,
  p_comercio_id  uuid,
  p_variante_id  uuid,
  p_nombre       text,
  p_precio       numeric,
  p_disponible   boolean
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public', 'auth'
  AS $function$
declare
  v_producto_id uuid;
  v_anterior jsonb;
  v_nuevo jsonb;
  v_continuar boolean;
begin
  select producto_id into v_producto_id
  from public.variantes_producto
  where id = p_variante_id
  for update;

  if v_producto_id is null
     or not exists (
       select 1 from public.productos
       where id = v_producto_id and comercio_id = p_comercio_id
     ) then
    raise exception 'La variante no pertenece al comercio autorizado.'
      using errcode = 'P0002';
  end if;

  v_continuar := public.auditoria_iniciar_operacion(
    p_operacion_id, p_comercio_id, 'variante', p_variante_id
  );
  if not v_continuar then return true; end if;

  select jsonb_build_object(
    'nombre', nombre, 'precio', precio, 'disponible', disponible
  )
  into v_anterior
  from public.variantes_producto
  where id = p_variante_id
  for update;

  update public.variantes_producto
  set nombre = p_nombre,
      precio = p_precio,
      disponible = p_disponible
  where id = p_variante_id
    and producto_id = v_producto_id;

  v_nuevo := jsonb_build_object(
    'nombre', p_nombre, 'precio', p_precio, 'disponible', p_disponible
  );
  perform public.auditoria_finalizar_operacion(
    p_operacion_id, 1, p_comercio_id, 'actualizar', 'variante',
    p_variante_id, v_anterior, v_nuevo
  );
  return true;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."admin_actualizar_variante_auditada"(uuid, uuid, uuid, text, numeric, boolean) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.admin_asignar_empleado_auditado (
  p_operacion_id uuid,
  p_comercio_id  uuid,
  p_user_id      uuid
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public', 'auth'
  AS $function$ declare v_anterior jsonb;

begin if not (

  public.es_super_admin_activo()

  or public.es_admin_de_comercio(p_comercio_id)

) then raise exception 'No tenés permisos para asignar empleados.' using errcode = '42501';

end if;

if p_user_id = auth.uid() then raise exception 'Un Admin no puede modificar su propio rol.' using errcode = '42501';

end if;

if not exists (

  select

    1

  from

    auth.users

  where

    id = p_user_id

) then raise exception 'El usuario objetivo no existe.' using errcode = 'P0002';

end if;

if not exists (

  select

    1

  from

    public.comercios

  where

    id = p_comercio_id

    and activo = true

) then raise exception 'El comercio no existe o está inactivo.' using errcode = 'P0002';

end if;

if not public.auditoria_iniciar_operacion(

  p_operacion_id,

  p_comercio_id,

  'admin_comercio',

  p_user_id

) then return true;

end if;

select

  jsonb_build_object(

    'user_id',

    user_id,

    'comercio_id',

    comercio_id,

    'rol',

    rol,

    'activo',

    activo

  ) into v_anterior

from

  public.admin_comercios

where

  user_id = p_user_id

  and comercio_id = p_comercio_id for

update

;

if v_anterior is not null then raise exception 'El usuario ya está asignado al comercio.' using errcode = '23505';

end if;

insert into

  public.admin_comercios (

    user_id,

    comercio_id,

    rol,

    activo

  )

values

  (

    p_user_id,

    p_comercio_id,

    'empleado',

    true

  );

perform public.auditoria_finalizar_operacion(

  p_operacion_id,

  1,

  p_comercio_id,

  'asignar',

  'admin_comercio',

  p_user_id,

  null,

  jsonb_build_object(

    'user_id',

    p_user_id,

    'comercio_id',

    p_comercio_id,

    'rol',

    'empleado',

    'activo',

    true

  )

);

return true;

end;

$function$;

REVOKE ALL ON FUNCTION "public"."admin_asignar_empleado_auditado"(uuid, uuid, uuid) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.admin_cambiar_disponibilidad_producto_auditada (
  p_operacion_id uuid,
  p_comercio_id  uuid,
  p_producto_id  uuid,
  p_disponible   boolean
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public', 'auth'
  AS $function$
declare
  v_anterior jsonb;
  v_continuar boolean;
begin
  v_continuar := public.auditoria_iniciar_operacion(
    p_operacion_id, p_comercio_id, 'producto', p_producto_id
  );
  if not v_continuar then return true; end if;

  select jsonb_build_object('disponible', disponible)
  into v_anterior
  from public.productos
  where id = p_producto_id
    and comercio_id = p_comercio_id
  for update;

  if v_anterior is null then
    raise exception 'El producto no pertenece al comercio autorizado.'
      using errcode = 'P0002';
  end if;

  update public.productos
  set disponible = p_disponible
  where id = p_producto_id
    and comercio_id = p_comercio_id;

  perform public.auditoria_finalizar_operacion(
    p_operacion_id, 1, p_comercio_id, 'cambiar_disponibilidad',
    'producto', p_producto_id, v_anterior,
    jsonb_build_object('disponible', p_disponible)
  );
  return true;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."admin_cambiar_disponibilidad_producto_auditada"(uuid, uuid, uuid, boolean) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.admin_cambiar_disponibilidad_variante_auditada (
  p_operacion_id uuid,
  p_comercio_id  uuid,
  p_variante_id  uuid,
  p_disponible   boolean
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public', 'auth'
  AS $function$
declare
  v_producto_id uuid;
  v_anterior jsonb;
  v_continuar boolean;
begin
  select vp.producto_id
    into v_producto_id
  from public.variantes_producto vp
  join public.productos p on p.id = vp.producto_id
  where vp.id = p_variante_id
    and p.comercio_id = p_comercio_id
  for update of vp;

  if v_producto_id is null then
    raise exception 'La variante no pertenece al comercio autorizado.'
      using errcode = 'P0002';
  end if;

  v_continuar := public.auditoria_iniciar_operacion(
    p_operacion_id, p_comercio_id, 'variante', p_variante_id
  );
  if not v_continuar then return true; end if;

  select jsonb_build_object('disponible', disponible)
  into v_anterior
  from public.variantes_producto
  where id = p_variante_id
  for update;

  update public.variantes_producto
  set disponible = p_disponible
  where id = p_variante_id
    and producto_id = v_producto_id;

  perform public.auditoria_finalizar_operacion(
    p_operacion_id, 1, p_comercio_id, 'cambiar_disponibilidad',
    'variante', p_variante_id, v_anterior,
    jsonb_build_object('disponible', p_disponible)
  );
  return true;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."admin_cambiar_disponibilidad_variante_auditada"(uuid, uuid, uuid, boolean) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.admin_cambiar_estado_empleado_auditado (
  p_operacion_id uuid,
  p_comercio_id  uuid,
  p_user_id      uuid,
  p_activo       boolean
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public', 'auth'
  AS $function$ declare v_anterior jsonb;

begin if not (

  public.es_super_admin_activo()

  or public.es_admin_de_comercio(p_comercio_id)

) then raise exception 'No tenés permisos para administrar empleados.' using errcode = '42501';

end if;

if p_user_id = auth.uid() then raise exception 'Un Admin no puede cambiar su propio acceso.' using errcode = '42501';

end if;

if not public.auditoria_iniciar_operacion(

  p_operacion_id,

  p_comercio_id,

  'admin_comercio',

  p_user_id

) then return true;

end if;

select

  jsonb_build_object(

    'user_id',

    user_id,

    'comercio_id',

    comercio_id,

    'rol',

    rol,

    'activo',

    activo

  ) into v_anterior

from

  public.admin_comercios

where

  user_id = p_user_id

  and comercio_id = p_comercio_id

  and rol = 'empleado' for

update

;

if v_anterior is null then raise exception 'El Empleado no existe en este comercio.' using errcode = 'P0002';

end if;

update

  public.admin_comercios

set

  activo = p_activo

where

  user_id = p_user_id

  and comercio_id = p_comercio_id

  and rol = 'empleado';

perform public.auditoria_finalizar_operacion(

  p_operacion_id,

  1,

  p_comercio_id,

  'cambiar_estado',

  'admin_comercio',

  p_user_id,

  v_anterior,

  jsonb_build_object(

    'user_id',

    p_user_id,

    'comercio_id',

    p_comercio_id,

    'rol',

    'empleado',

    'activo',

    p_activo

  )

);

return true;

end;

$function$;

REVOKE ALL ON FUNCTION "public"."admin_cambiar_estado_empleado_auditado"(uuid, uuid, uuid, boolean) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.admin_completar_invitacion_empleado_auditada (
  p_operacion_id uuid,
  p_user_id      uuid
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public', 'auth'
  AS $function$ declare v_invitacion public.auditoria_invitaciones_admin % rowtype;

begin

select

  * into v_invitacion

from

  public.auditoria_invitaciones_admin

where

  operacion_id = p_operacion_id for

update

;

if v_invitacion.id is null

or v_invitacion.actor_user_id <> auth.uid()

or v_invitacion.rol <> 'empleado' then raise exception 'La invitación no existe o no pertenece al actor.' using errcode = '42501';

end if;

if not (

  public.es_super_admin_activo()

  or public.es_admin_de_comercio(v_invitacion.comercio_id)

) then raise exception 'No tenés permisos para completar la invitación.' using errcode = '42501';

end if;

if v_invitacion.estado = 'completada' then return true;

end if;

if v_invitacion.estado <> 'iniciada'

or p_user_id is null then raise exception 'La invitación no puede completarse.' using errcode = '40001';

end if;

if not exists (

  select

    1

  from

    auth.users

  where

    id = p_user_id

) then raise exception 'El usuario de Auth no existe.' using errcode = 'P0002';

end if;

-- El usuario de Auth debe ser exactamente el correo invitado. Sin esta

-- comprobación, un p_user_id equivocado asignaría el rol a otra persona

-- reutilizando una invitación legítima.

if not exists (

  select

    1

  from

    auth.users u

  where

    u.id = p_user_id

    and lower(trim(u.email)) = v_invitacion.email_normalizado

) then raise exception 'El usuario de Auth no corresponde al correo invitado.' using errcode = '42501';

end if;

if p_user_id = auth.uid() then raise exception 'Un Admin no puede modificar su propio rol.' using errcode = '42501';

end if;

insert into

  public.admin_comercios (

    user_id,

    comercio_id,

    rol,

    activo

  )

values

  (

    p_user_id,

    v_invitacion.comercio_id,

    'empleado',

    true

  );

update

  public.auditoria_invitaciones_admin

set

  usuario_auth_id = p_user_id,

  estado = 'completada',

  actualizada_en = now()

where

  id = v_invitacion.id;

perform public.auditoria_registrar_evento_interno(

  p_operacion_id,

  2 :: smallint,

  v_invitacion.comercio_id,

  'asignar',

  'admin_comercio',

  p_user_id,

  null,

  jsonb_build_object(

    'user_id',

    p_user_id,

    'comercio_id',

    v_invitacion.comercio_id,

    'rol',

    'empleado',

    'activo',

    true

  )

);

return true;

end;

$function$;

REVOKE ALL ON FUNCTION "public"."admin_completar_invitacion_empleado_auditada"(uuid, uuid) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.admin_crear_categoria_auditada (
  p_operacion_id uuid,
  p_comercio_id  uuid,
  p_nombre       text,
  p_slug         text,
  p_descripcion  text,
  p_imagen_url   text,
  p_orden        integer
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public', 'auth'
  AS $function$
declare
  v_id uuid;
  v_continuar boolean;
begin
  v_continuar := public.auditoria_iniciar_operacion(
    p_operacion_id, p_comercio_id, 'categoria', gen_random_uuid()
  );

  if not v_continuar then
    select registro_id into v_id
    from public.auditoria_eventos
    where operacion_id = p_operacion_id
    order by secuencia
    limit 1;
    return v_id;
  end if;

  insert into public.categorias (
    comercio_id, nombre, slug, descripcion, imagen_url, orden, activa
  )
  values (
    p_comercio_id, p_nombre, p_slug, p_descripcion, p_imagen_url,
    coalesce(p_orden, 0), true
  )
  returning id into v_id;

  perform public.auditoria_finalizar_operacion(
    p_operacion_id, 1, p_comercio_id, 'crear', 'categoria', v_id,
    null,
    jsonb_build_object(
      'nombre', p_nombre,
      'slug', p_slug,
      'descripcion', p_descripcion,
      'imagen_url', p_imagen_url,
      'orden', coalesce(p_orden, 0),
      'activa', true
    )
  );
  return v_id;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."admin_crear_categoria_auditada"(uuid, uuid, text, text, text, text, integer) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.admin_crear_producto_auditado (
  p_operacion_id uuid,
  p_comercio_id  uuid,
  p_categoria_id uuid,
  p_nombre       text,
  p_descripcion  text,
  p_imagen_url   text,
  p_tipo         text,
  p_precio_base  numeric,
  p_orden        integer
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public', 'auth'
  AS $function$
declare
  v_id uuid;
  v_continuar boolean;
begin
  v_continuar := public.auditoria_iniciar_operacion(
    p_operacion_id, p_comercio_id, 'producto', gen_random_uuid()
  );
  if not v_continuar then
    select registro_id into v_id
    from public.auditoria_eventos
    where operacion_id = p_operacion_id
    order by secuencia
    limit 1;
    return v_id;
  end if;

  if not exists (
    select 1 from public.categorias
    where id = p_categoria_id
      and comercio_id = p_comercio_id
      and activa = true
  ) then
    raise exception 'La categoría no pertenece al comercio o está inactiva.'
      using errcode = 'P0002';
  end if;

  insert into public.productos (
    comercio_id, categoria_id, nombre, descripcion, imagen_url, tipo,
    precio_base, disponible, destacado, orden
  )
  values (
    p_comercio_id, p_categoria_id, p_nombre, p_descripcion, p_imagen_url,
    coalesce(p_tipo, 'simple'), p_precio_base, true, false,
    coalesce(p_orden, 0)
  )
  returning id into v_id;

  perform public.auditoria_finalizar_operacion(
    p_operacion_id, 1, p_comercio_id, 'crear', 'producto', v_id,
    null,
    jsonb_build_object(
      'categoria_id', p_categoria_id,
      'nombre', p_nombre,
      'descripcion', p_descripcion,
      'imagen_url', p_imagen_url,
      'tipo', coalesce(p_tipo, 'simple'),
      'precio_base', p_precio_base,
      'disponible', true,
      'destacado', false,
      'orden', coalesce(p_orden, 0)
    )
  );
  return v_id;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."admin_crear_producto_auditado"(uuid, uuid, uuid, text, text, text, text, numeric, integer) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.admin_crear_variante_auditada (
  p_operacion_id uuid,
  p_comercio_id  uuid,
  p_producto_id  uuid,
  p_nombre       text,
  p_precio       numeric,
  p_orden        integer
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public', 'auth'
  AS $function$
declare
  v_id uuid;
  v_continuar boolean;
begin
  v_continuar := public.auditoria_iniciar_operacion(
    p_operacion_id, p_comercio_id, 'variante', gen_random_uuid()
  );
  if not v_continuar then
    select registro_id into v_id
    from public.auditoria_eventos
    where operacion_id = p_operacion_id
    order by secuencia
    limit 1;
    return v_id;
  end if;

  if not exists (
    select 1 from public.productos
    where id = p_producto_id and comercio_id = p_comercio_id
  ) then
    raise exception 'El producto no pertenece al comercio autorizado.'
      using errcode = 'P0002';
  end if;

  insert into public.variantes_producto (
    producto_id, nombre, precio, disponible, orden
  )
  values (
    p_producto_id, p_nombre, p_precio, true, coalesce(p_orden, 0)
  )
  returning id into v_id;

  perform public.auditoria_finalizar_operacion(
    p_operacion_id, 1, p_comercio_id, 'crear', 'variante', v_id,
    null,
    jsonb_build_object(
      'producto_id', p_producto_id,
      'nombre', p_nombre,
      'precio', p_precio,
      'disponible', true,
      'orden', coalesce(p_orden, 0)
    )
  );
  return v_id;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."admin_crear_variante_auditada"(uuid, uuid, uuid, text, numeric, integer) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.admin_finalizar_acceso_empleado_auditado (
  p_operacion_id uuid,
  p_enviado      boolean
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public', 'auth'
  AS $function$
declare
  v_inicio public.auditoria_eventos%rowtype;
begin
  if p_operacion_id is null or p_enviado is null then
    raise exception 'Faltan datos de la operación.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operacion_id::text, 0));
  select * into v_inicio from public.auditoria_eventos
    where operacion_id = p_operacion_id and secuencia = 1;
  if not found or auth.uid() is null or v_inicio.actor_user_id is distinct from auth.uid()
     or v_inicio.accion <> 'acceso_solicitado'
     or not (public.es_super_admin_activo() or public.es_admin_de_comercio(v_inicio.comercio_id)) then
    raise exception 'No tenés autorización para finalizar esta operación.' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.auditoria_eventos where operacion_id = p_operacion_id and secuencia = 2
  ) then
    return false;
  end if;
  perform public.auditoria_registrar_evento_interno(
    p_operacion_id, 2::smallint, v_inicio.comercio_id,
    case when p_enviado then 'acceso_correo_enviado' else 'acceso_correo_fallido' end,
    'admin_comercio', v_inicio.registro_id, null,
    jsonb_build_object(
      'tipo', v_inicio.valores_nuevos->>'tipo',
      'estado', case when p_enviado then 'enviado' else 'fallido' end
    )
  );
  return true;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."admin_finalizar_acceso_empleado_auditado"(uuid, boolean) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.admin_iniciar_acceso_empleado_auditado (
  p_operacion_id uuid,
  p_comercio_id  uuid,
  p_user_id      uuid,
  p_tipo         text
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public', 'auth'
  AS $function$
declare
  v_existente public.auditoria_eventos%rowtype;
begin
  if auth.uid() is null or not (
    public.es_super_admin_activo() or public.es_admin_de_comercio(p_comercio_id)
  ) then
    raise exception 'No tenés autorización para administrar empleados.' using errcode = '42501';
  end if;
  if p_operacion_id is null or p_user_id is null or p_comercio_id is null
     or p_tipo is null or p_tipo not in ('invitacion', 'recuperacion') then
    raise exception 'Operación de acceso inválida.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.comercios where id = p_comercio_id and activo
  ) or not exists (
    select 1 from public.admin_comercios
    where comercio_id = p_comercio_id and user_id = p_user_id and rol = 'empleado' and activo
  ) or exists (
    select 1 from public.admin_comercios
    where user_id = p_user_id and (comercio_id <> p_comercio_id or rol <> 'empleado')
  ) or exists (
    select 1 from public.super_admins where user_id = p_user_id
  ) then
    raise exception 'La cuenta no es un empleado exclusivo y activo del comercio.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from auth.users
    where id = p_user_id and email is not null
      and (banned_until is null or banned_until <= now())
      and (p_tipo <> 'invitacion' or email_confirmed_at is null)
  ) then
    raise exception 'La cuenta no admite esta acción de acceso.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_operacion_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('acceso_empleado:' || p_user_id::text, 0));
  select * into v_existente from public.auditoria_eventos
    where operacion_id = p_operacion_id order by secuencia limit 1;
  if found then
    if v_existente.actor_user_id <> auth.uid()
       or v_existente.comercio_id <> p_comercio_id
       or v_existente.registro_id <> p_user_id
       or v_existente.accion <> 'acceso_solicitado'
       or v_existente.valores_nuevos->>'tipo' is distinct from p_tipo then
      raise exception 'La operación ya existe con otros parámetros.' using errcode = '42501';
    end if;
    return false;
  end if;
  if exists (
    select 1 from public.auditoria_eventos
    where registro_id = p_user_id and accion = 'acceso_solicitado'
      and creado_en > now() - interval '60 seconds'
  ) then
    raise exception 'Esperá un minuto antes de enviar otro correo de acceso.' using errcode = '54000';
  end if;

  perform public.auditoria_registrar_evento_interno(
    p_operacion_id, 1::smallint, p_comercio_id, 'acceso_solicitado',
    'admin_comercio', p_user_id, null,
    jsonb_build_object('tipo', p_tipo, 'estado', 'solicitado')
  );
  return true;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."admin_iniciar_acceso_empleado_auditado"(uuid, uuid, uuid, text) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.admin_iniciar_invitacion_empleado_auditada (
  p_operacion_id uuid,
  p_comercio_id  uuid,
  p_email        text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public', 'auth'
  AS $function$ declare v_actor uuid := auth.uid();

v_email text := lower(trim(p_email));

v_invitacion public.auditoria_invitaciones_admin % rowtype;

begin if not (

  public.es_super_admin_activo()

  or public.es_admin_de_comercio(p_comercio_id)

) then raise exception 'No tenés permisos para invitar empleados.' using errcode = '42501';

end if;

if p_operacion_id is null

or p_comercio_id is null

or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'

or length(v_email) > 320 then raise exception 'Los datos de la invitación no son válidos.' using errcode = '22023';

end if;

if not exists (

  select

    1

  from

    public.comercios

  where

    id = p_comercio_id

    and activo = true

) then raise exception 'El comercio no existe o está inactivo.' using errcode = 'P0002';

end if;

perform pg_advisory_xact_lock(

  hashtextextended(p_operacion_id :: text, 0)

);

select

  * into v_invitacion

from

  public.auditoria_invitaciones_admin

where

  operacion_id = p_operacion_id for

update

;

if v_invitacion.id is not null then if v_invitacion.actor_user_id <> v_actor

or v_invitacion.comercio_id <> p_comercio_id

or v_invitacion.email_normalizado <> v_email

or v_invitacion.rol <> 'empleado' then raise exception 'La operación pertenece a otra invitación.' using errcode = '42501';

end if;

if v_invitacion.estado <> 'iniciada' then raise exception 'La invitación ya fue finalizada.' using errcode = '40001';

end if;

return v_invitacion.id;

end if;

insert into

  public.auditoria_invitaciones_admin (

    operacion_id,

    comercio_id,

    actor_user_id,

    email_normalizado,

    rol

  )

values

  (

    p_operacion_id,

    p_comercio_id,

    v_actor,

    v_email,

    'empleado'

  ) returning * into v_invitacion;

perform public.auditoria_registrar_evento_interno(

  p_operacion_id,

  1 :: smallint,

  p_comercio_id,

  'invitacion_iniciada',

  'admin_invitacion',

  p_operacion_id,

  null,

  jsonb_build_object(

    'email',

    v_email,

    'rol',

    'empleado',

    'estado',

    'iniciada'

  )

);

return v_invitacion.id;

end;

$function$;

REVOKE ALL ON FUNCTION "public"."admin_iniciar_invitacion_empleado_auditada"(uuid, uuid, text) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.admin_marcar_invitacion_empleado_fallida (
  p_operacion_id uuid,
  p_motivo       text,
  p_user_id      uuid DEFAULT NULL::uuid
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public', 'auth'
  AS $function$ declare v_invitacion public.auditoria_invitaciones_admin % rowtype;

v_motivo text := coalesce(nullif(trim(p_motivo), ''), 'error_externo');

begin

select

  * into v_invitacion

from

  public.auditoria_invitaciones_admin

where

  operacion_id = p_operacion_id for

update

;

if v_invitacion.id is null

or v_invitacion.actor_user_id <> auth.uid()

or v_invitacion.rol <> 'empleado' then raise exception 'La invitación no existe o no pertenece al actor.' using errcode = '42501';

end if;

if not (

  public.es_super_admin_activo()

  or public.es_admin_de_comercio(v_invitacion.comercio_id)

) then raise exception 'No tenés permisos para cerrar la invitación.' using errcode = '42501';

end if;

if v_motivo not in (

  'error_externo',

  'usuario_ya_existia',

  'asignacion_fallida',

  'correo_invalido',

  'reintento_manual'

) then raise exception 'Motivo de fallo no permitido.' using errcode = '22023';

end if;

if v_invitacion.estado = 'fallida' then return true;

end if;

if v_invitacion.estado <> 'iniciada' then raise exception 'La invitación ya fue completada.' using errcode = '40001';

end if;

update

  public.auditoria_invitaciones_admin

set

  estado = 'fallida',

  usuario_auth_id = p_user_id,

  motivo_fallo = v_motivo,

  actualizada_en = now()

where

  id = v_invitacion.id;

perform public.auditoria_registrar_evento_interno(

  p_operacion_id,

  2 :: smallint,

  v_invitacion.comercio_id,

  'invitacion_fallida',

  'admin_invitacion',

  p_operacion_id,

  jsonb_build_object(

    'rol',

    'empleado',

    'estado',

    'iniciada'

  ),

  jsonb_strip_nulls(

    jsonb_build_object(

      'rol',

      'empleado',

      'estado',

      'fallida',

      'motivo',

      v_motivo,

      'usuario_auth_id',

      p_user_id

    )

  )

);

return true;

end;

$function$;

REVOKE ALL ON FUNCTION "public"."admin_marcar_invitacion_empleado_fallida"(uuid, text, uuid) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.auditoria_actor_autorizado (
  p_comercio_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public', 'auth'
  AS $function$
  select
    auth.uid() is not null
    and
    exists (
      select 1
      from auth.users u
      where u.id = auth.uid()
    )
    and
    (
      exists (
        select 1
        from public.super_admins sa
        where sa.user_id = auth.uid()
          and sa.activo = true
      )
      or
      exists (
        select 1
        from public.admin_comercios ac
        where ac.user_id = auth.uid()
          and ac.comercio_id = p_comercio_id
          and ac.activo = true
      )
    );
$function$;

REVOKE ALL ON FUNCTION "public"."auditoria_actor_autorizado"(uuid) FROM PUBLIC, "anon", "authenticated", "service_role";

CREATE OR REPLACE FUNCTION public.auditoria_bloquear_mutacion()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public'
  AS $function$
begin
  if TG_OP = 'DELETE'
     and current_setting(
       'app.auditoria_retencion_autorizada',
       true
     ) = 'true' then
    return old;
  end if;

  raise exception 'Los registros de auditoría son inmutables.'
    using errcode = '42501';
end;
$function$;

REVOKE ALL ON FUNCTION "public"."auditoria_bloquear_mutacion"() FROM PUBLIC, "anon", "authenticated", "service_role";

CREATE OR REPLACE FUNCTION public.auditoria_contiene_clave_sensible (
  p_valor jsonb
)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  STRICT
  SET search_path TO 'pg_catalog', 'public'
  AS $function$
  select p_valor ?| array[
    'password',
    'contrasena',
    'token',
    'access_token',
    'refresh_token',
    'authorization',
    'secret',
    'service_role'
  ];
$function$;

REVOKE ALL ON FUNCTION "public"."auditoria_contiene_clave_sensible"(jsonb) FROM PUBLIC, "anon", "authenticated", "service_role";

CREATE OR REPLACE FUNCTION public.auditoria_finalizar_operacion (
  p_operacion_id       uuid,
  p_secuencia          integer,
  p_comercio_id        uuid,
  p_accion             text,
  p_entidad            text,
  p_registro_id        uuid,
  p_valores_anteriores jsonb,
  p_valores_nuevos     jsonb
)
  RETURNS uuid
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public', 'auth'
  AS $function$
  select public.auditoria_registrar_evento_interno(
    p_operacion_id,
    p_secuencia::smallint,
    p_comercio_id,
    p_accion,
    p_entidad,
    p_registro_id,
    p_valores_anteriores,
    p_valores_nuevos
  );
$function$;

REVOKE ALL ON FUNCTION "public"."auditoria_finalizar_operacion"(uuid, integer, uuid, text, text, uuid, jsonb, jsonb) FROM PUBLIC, "anon", "authenticated", "service_role";

CREATE OR REPLACE FUNCTION public.auditoria_iniciar_operacion (
  p_operacion_id uuid,
  p_comercio_id  uuid,
  p_entidad      text,
  p_registro_id  uuid
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public', 'auth'
  AS $function$ declare v_actor uuid := auth.uid();

v_existente record;

v_autorizado boolean;

begin if p_operacion_id is null

or p_comercio_id is null

or p_registro_id is null

or p_entidad not in (

  'categoria',

  'producto',

  'variante',

  'pedido',

  'admin_comercio'

) then raise exception 'Datos inválidos para iniciar la operación.' using errcode = '22023';

end if;

v_autorizado := case

  when p_entidad = 'pedido' then public.es_personal_de_comercio(p_comercio_id)

  else public.es_super_admin_activo()

  or public.es_admin_de_comercio(p_comercio_id)

end;

if not coalesce(v_autorizado, false) then raise exception 'El actor no está autorizado para esta operación.' using errcode = '42501';

end if;

-- El actor también debe poder escribir el evento más adelante.

-- Se valida acá para no abortar a mitad de la operación.

if not public.auditoria_actor_autorizado(p_comercio_id) then raise exception 'El actor no está autorizado para el comercio.' using errcode = '42501';

end if;

perform pg_advisory_xact_lock(

  hashtextextended(p_operacion_id :: text, 0)

);

-- Idempotencia por operación completa: una operacion_id reutilizada debe

-- corresponder al mismo actor, comercio, entidad y registro. De lo

-- contrario un reintento podría devolver "ya aplicada" para otra

-- operación distinta y omitir su auditoría.

select

  min(actor_user_id :: text) as actor,

  count(distinct actor_user_id) as actores,

  min(comercio_id :: text) as comercio,

  count(distinct comercio_id) as comercios,

  min(entidad) as entidad,

  count(distinct entidad) as entidades,

  min(registro_id :: text) as registro,

  count(distinct registro_id) as registros into v_existente

from

  public.auditoria_eventos

where

  operacion_id = p_operacion_id;

if v_existente.actor is not null then if v_existente.actores > 1

or v_existente.actor is distinct

from

  v_actor :: text then raise exception 'La operación pertenece a otro actor.' using errcode = '42501';

end if;

if v_existente.comercios > 1

or v_existente.comercio is distinct

from

  p_comercio_id :: text

  or v_existente.entidades > 1

  or v_existente.entidad is distinct

from

  p_entidad then raise exception 'La operación ya se registró con otros parámetros.' using errcode = '22023';

end if;

-- Una misma operación puede abarcar varios registros de la misma

-- entidad (por ejemplo, los productos arrastrados al eliminar una

-- categoría). Sólo se exige coincidencia cuando hubo un único registro.

if v_existente.registros = 1

and v_existente.registro is distinct

from

  p_registro_id :: text then raise exception 'La operación ya se registró con otros parámetros.' using errcode = '22023';

end if;

return false;

end if;

return true;

end;

$function$;

REVOKE ALL ON FUNCTION "public"."auditoria_iniciar_operacion"(uuid, uuid, text, uuid) FROM PUBLIC, "anon", "authenticated", "service_role";

CREATE OR REPLACE FUNCTION public.auditoria_registrar_evento_interno (
  p_operacion_id       uuid,
  p_secuencia          smallint,
  p_comercio_id        uuid,
  p_accion             text,
  p_entidad            text,
  p_registro_id        uuid,
  p_valores_anteriores jsonb,
  p_valores_nuevos     jsonb
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public', 'auth'
  AS $function$
declare
  v_evento_id uuid;
  v_actor_user_id uuid := auth.uid();
begin
  if p_operacion_id is null
     or v_actor_user_id is null
     or p_comercio_id is null
     or p_registro_id is null then
    raise exception 'Faltan datos obligatorios para registrar la auditoría.'
      using errcode = '22023';
  end if;

  if not public.auditoria_actor_autorizado(p_comercio_id) then
    raise exception 'El actor no está autorizado para el comercio.'
      using errcode = '42501';
  end if;

  if public.auditoria_contiene_clave_sensible(p_valores_anteriores)
     or public.auditoria_contiene_clave_sensible(p_valores_nuevos) then
    raise exception 'Los valores de auditoría contienen claves sensibles.'
      using errcode = '22023';
  end if;

  insert into public.auditoria_eventos (
    operacion_id,
    secuencia,
    actor_user_id,
    comercio_id,
    accion,
    entidad,
    registro_id,
    valores_anteriores,
    valores_nuevos
  )
  values (
    p_operacion_id,
    p_secuencia,
    v_actor_user_id,
    p_comercio_id,
    p_accion,
    p_entidad,
    p_registro_id,
    p_valores_anteriores,
    p_valores_nuevos
  )
  returning id into v_evento_id;

  return v_evento_id;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."auditoria_registrar_evento_interno"(uuid, smallint, uuid, text, text, uuid, jsonb, jsonb) FROM PUBLIC, "anon", "authenticated", "service_role";

CREATE OR REPLACE FUNCTION public.clientes_actualizar_actualizado_en()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'pg_catalog', 'public'
  AS $function$ begin if TG_TABLE_NAME = 'clientes_direcciones' then new.actualizada_en := now();

else new.actualizado_en := now();

end if;

return new;

end;

$function$;

REVOKE ALL ON FUNCTION "public"."clientes_actualizar_actualizado_en"() FROM PUBLIC, "anon", "authenticated", "service_role";

CREATE OR REPLACE FUNCTION public.confirmar_pago_mercado_pago (
  p_evento_id       text,
  p_pago_id         uuid,
  p_pago_externo_id text,
  p_estado          text,
  p_monto           numeric,
  p_moneda          text
)
  RETURNS TABLE (
    procesado boolean,
    duplicado boolean
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public'
  AS $function$
declare
  v_pedido_id uuid;
  v_monto numeric;
  v_moneda text;
  v_estado_actual text;
  v_pago_externo_actual text;
  v_notificacion_id uuid;
begin
  if p_evento_id is null or btrim(p_evento_id) = '' then
    raise exception 'El evento de pago es obligatorio';
  end if;
  if p_pago_externo_id is null or btrim(p_pago_externo_id) = '' then
    raise exception 'El identificador externo del pago es obligatorio';
  end if;
  if p_estado not in ('pendiente', 'aprobado', 'rechazado') then
    raise exception 'Estado de pago inválido';
  end if;

  select pedido_id, monto, moneda, estado, pago_externo_id
  into v_pedido_id, v_monto, v_moneda, v_estado_actual, v_pago_externo_actual
  from public.pagos
  where id = p_pago_id
    and proveedor = 'mercado_pago'
    and referencia_externa = p_pago_id::text
  for update;

  if not found then
    raise exception 'No existe el intento de pago asociado';
  end if;
  if v_monto <> p_monto or v_moneda <> p_moneda then
    raise exception 'El importe o la moneda no coinciden con el intento';
  end if;
  if v_pago_externo_actual is not null
     and v_pago_externo_actual <> p_pago_externo_id then
    raise exception 'El intento ya está asociado a otro pago externo';
  end if;

  insert into public.pagos_notificaciones (
    pago_id,
    proveedor,
    evento_id,
    pago_externo_id
  ) values (
    p_pago_id,
    'mercado_pago',
    p_evento_id,
    p_pago_externo_id
  )
  on conflict (proveedor, evento_id) do nothing
  returning id into v_notificacion_id;

  if v_notificacion_id is null then
    return query select false, true;
    return;
  end if;

  update public.pagos
  set pago_externo_id = p_pago_externo_id,
      -- Un evento posterior nunca puede degradar un pago ya aprobado.
      estado = case
        when v_estado_actual = 'aprobado' then 'aprobado'
        else p_estado
      end,
      actualizado_en = now()
  where id = p_pago_id;

  update public.pedidos
  set estado_pago = case
        when exists (
          select 1 from public.pagos
          where pedido_id = v_pedido_id and estado = 'aprobado'
        ) then 'aprobado'
        when exists (
          select 1 from public.pagos
          where pedido_id = v_pedido_id and estado = 'pendiente'
        ) then 'pendiente'
        else 'rechazado'
      end,
      actualizado_en = now()
  where id = v_pedido_id;

  return query select true, false;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."confirmar_pago_mercado_pago"(text, uuid, text, text, numeric, text) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.es_admin_de_comercio (
  p_comercio_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public', 'auth'
  AS $function$

select

  auth.uid() is not null

  and exists (

    select

      1

    from

      public.admin_comercios

    where

      user_id = auth.uid()

      and comercio_id = p_comercio_id

      and rol in ('owner', 'admin')

      and activo = true

  );

$function$;

REVOKE ALL ON FUNCTION "public"."es_admin_de_comercio"(uuid) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.es_empleado_de_comercio (
  p_comercio_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public', 'auth'
  AS $function$

select

  auth.uid() is not null

  and exists (

    select

      1

    from

      public.admin_comercios

    where

      user_id = auth.uid()

      and comercio_id = p_comercio_id

      and rol = 'empleado'

      and activo = true

  );

$function$;

REVOKE ALL ON FUNCTION "public"."es_empleado_de_comercio"(uuid) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.es_personal_de_comercio (
  p_comercio_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public', 'auth'
  AS $function$

select

  public.es_super_admin_activo()

  or public.es_admin_de_comercio(p_comercio_id)

  or public.es_empleado_de_comercio(p_comercio_id);

$function$;

REVOKE ALL ON FUNCTION "public"."es_personal_de_comercio"(uuid) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.es_super_admin_activo()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public'
  AS $function$
  select exists (
    select 1
    from public.super_admins
    where user_id = auth.uid()
      and activo = true
  );
$function$;

REVOKE ALL ON FUNCTION "public"."es_super_admin_activo"() FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.registrar_pedido_desde_checkout (
  p_comercio_id           uuid,
  p_modalidad_entrega     text,
  p_cliente_nombre        text,
  p_cliente_telefono      text,
  p_direccion_calle       text,
  p_direccion_numero      text,
  p_direccion_apartamento text,
  p_direccion_referencias text,
  p_metodo_pago           text,
  p_subtotal              numeric,
  p_items                 jsonb
)
  RETURNS TABLE (
    pedido_id uuid,
    pago_id   uuid
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public'
  AS $function$
declare
  v_pedido_id uuid;
  v_pago_id uuid;
  v_item jsonb;
  v_opcion jsonb;
  v_item_id uuid;
begin
  if p_modalidad_entrega not in ('delivery', 'retiro') then
    raise exception 'Modalidad de entrega inválida';
  end if;
  if p_metodo_pago not in ('efectivo', 'mercado_pago') then
    raise exception 'Método de pago inválido';
  end if;
  if p_subtotal <= 0 then
    raise exception 'El subtotal debe ser mayor a cero';
  end if;

  insert into public.pedidos (
    comercio_id,
    estado,
    estado_pago,
    modalidad,
    cliente_nombre,
    cliente_telefono,
    direccion_calle,
    direccion_numero,
    direccion_apartamento,
    direccion_referencias,
    metodo_pago,
    subtotal,
    total
  ) values (
    p_comercio_id,
    'pendiente',
    'pendiente',
    p_modalidad_entrega,
    p_cliente_nombre,
    p_cliente_telefono,
    p_direccion_calle,
    p_direccion_numero,
    p_direccion_apartamento,
    p_direccion_referencias,
    p_metodo_pago,
    p_subtotal,
    p_subtotal
  )
  returning id into v_pedido_id;

  if p_metodo_pago = 'mercado_pago' then
    v_pago_id := gen_random_uuid();
    insert into public.pagos (
      id,
      pedido_id,
      proveedor,
      estado,
      monto,
      moneda,
      referencia_externa
    ) values (
      v_pago_id,
      v_pedido_id,
      'mercado_pago',
      'pendiente',
      p_subtotal,
      'UYU',
      v_pago_id::text
    );
  end if;

  for v_item in
    select *
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    insert into public.pedido_items (
      pedido_id,
      producto_id,
      variante_id,
      nombre_producto,
      nombre_variante,
      cantidad,
      aclaraciones,
      precio_unitario,
      total
    ) values (
      v_pedido_id,
      (v_item->>'producto_id')::uuid,
      nullif(v_item->>'variante_id', '')::uuid,
      v_item->>'producto_nombre',
      v_item->>'variante_nombre',
      (v_item->>'cantidad')::int,
      v_item->>'aclaraciones',
      (v_item->>'precio_unitario')::numeric,
      (v_item->>'subtotal')::numeric
    )
    returning id into v_item_id;

    for v_opcion in
      select *
      from jsonb_array_elements(coalesce(v_item->'opciones', '[]'::jsonb))
    loop
      insert into public.pedido_item_opciones (
        pedido_item_id,
        opcion_id,
        nombre_opcion,
        precio_adicional
      ) values (
        v_item_id,
        (v_opcion->>'opcion_id')::uuid,
        v_opcion->>'opcion_nombre',
        (v_opcion->>'precio_adicional')::numeric
      );
    end loop;
  end loop;

  return query select v_pedido_id, v_pago_id;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."registrar_pedido_desde_checkout"(uuid, text, text, text, text, text, text, text, text, numeric, jsonb) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.reservar_preferencia_mercado_pago (
  p_pago_id uuid
)
  RETURNS TABLE (
    reservada      boolean,
    preferencia_id text,
    url_checkout   text
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public'
  AS $function$
declare
  v_preferencia_id text;
  v_url_checkout text;
  v_reservada_en timestamptz;
begin
  select p.preferencia_id, p.url_checkout, p.preferencia_reservada_en
  into v_preferencia_id, v_url_checkout, v_reservada_en
  from public.pagos p
  where p.id = p_pago_id
    and p.proveedor = 'mercado_pago'
    and p.estado = 'pendiente'
    and p.referencia_externa = p.id::text
  for update;

  if not found then
    raise exception 'No existe un intento pendiente de Mercado Pago';
  end if;

  if v_preferencia_id is not null and v_url_checkout is not null then
    return query select false, v_preferencia_id, v_url_checkout;
    return;
  end if;

  if v_reservada_en is not null
     and v_reservada_en > now() - interval '2 minutes' then
    return query select false, null::text, null::text;
    return;
  end if;

  update public.pagos
  set preferencia_reservada_en = now(),
      actualizado_en = now()
  where id = p_pago_id;

  return query select true, null::text, null::text;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."reservar_preferencia_mercado_pago"(uuid) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
  RETURNS event_trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog'
  AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM "anon", "authenticated", "service_role";

CREATE OR REPLACE FUNCTION public.super_admin_asignar_administrador_auditado (
  p_operacion_id uuid,
  p_comercio_id  uuid,
  p_user_id      uuid,
  p_rol          text DEFAULT 'admin'::text
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public', 'auth'
  AS $function$ declare v_anterior jsonb;

begin if not public.es_super_admin_activo() then raise exception 'Solo un Super Admin activo puede administrar permisos.' using errcode = '42501';

end if;

if p_rol is null

or p_rol not in ('owner', 'admin', 'operador', 'empleado') then raise exception 'El rol solicitado no es válido.' using errcode = '22023';

end if;

if not exists (

  select

    1

  from

    auth.users

  where

    id = p_user_id

) then raise exception 'El usuario objetivo no existe.' using errcode = 'P0002';

end if;

if not exists (

  select

    1

  from

    public.comercios

  where

    id = p_comercio_id

    and activo = true

) then raise exception 'El comercio no existe o está inactivo.' using errcode = 'P0002';

end if;

if not public.auditoria_iniciar_operacion(

  p_operacion_id,

  p_comercio_id,

  'admin_comercio',

  p_user_id

) then return true;

end if;

select

  jsonb_build_object(

    'user_id',

    user_id,

    'comercio_id',

    comercio_id,

    'rol',

    rol,

    'activo',

    activo

  ) into v_anterior

from

  public.admin_comercios

where

  user_id = p_user_id

  and comercio_id = p_comercio_id for

update

;

if v_anterior is not null then raise exception 'El usuario ya está asignado al comercio.' using errcode = '23505';

end if;

insert into

  public.admin_comercios (

    user_id,

    comercio_id,

    rol,

    activo

  )

values

  (

    p_user_id,

    p_comercio_id,

    p_rol,

    true

  );

perform public.auditoria_finalizar_operacion(

  p_operacion_id,

  1,

  p_comercio_id,

  'asignar',

  'admin_comercio',

  p_user_id,

  null,

  jsonb_build_object(

    'user_id',

    p_user_id,

    'comercio_id',

    p_comercio_id,

    'rol',

    p_rol,

    'activo',

    true

  )

);

return true;

end;

$function$;

REVOKE ALL ON FUNCTION "public"."super_admin_asignar_administrador_auditado"(uuid, uuid, uuid, text) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.super_admin_cambiar_estado_administrador_auditado (
  p_operacion_id uuid,
  p_comercio_id  uuid,
  p_user_id      uuid,
  p_activo       boolean
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public', 'auth'
  AS $function$ declare v_anterior jsonb;

v_rol text;

begin if not public.es_super_admin_activo() then raise exception 'Solo un Super Admin activo puede administrar permisos.' using errcode = '42501';

end if;

if not public.auditoria_iniciar_operacion(

  p_operacion_id,

  p_comercio_id,

  'admin_comercio',

  p_user_id

) then return true;

end if;

select

  jsonb_build_object(

    'user_id',

    user_id,

    'comercio_id',

    comercio_id,

    'rol',

    rol,

    'activo',

    activo

  ),

  rol into v_anterior,

  v_rol

from

  public.admin_comercios

where

  user_id = p_user_id

  and comercio_id = p_comercio_id for

update

;

if v_anterior is null then raise exception 'La asignación administrativa no existe.' using errcode = 'P0002';

end if;

update

  public.admin_comercios

set

  activo = p_activo

where

  user_id = p_user_id

  and comercio_id = p_comercio_id;

perform public.auditoria_finalizar_operacion(

  p_operacion_id,

  1,

  p_comercio_id,

  'cambiar_estado',

  'admin_comercio',

  p_user_id,

  v_anterior,

  jsonb_build_object(

    'user_id',

    p_user_id,

    'comercio_id',

    p_comercio_id,

    'rol',

    v_rol,

    'activo',

    p_activo

  )

);

return true;

end;

$function$;

REVOKE ALL ON FUNCTION "public"."super_admin_cambiar_estado_administrador_auditado"(uuid, uuid, uuid, boolean) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.super_admin_completar_invitacion_auditada (
  p_operacion_id uuid,
  p_user_id      uuid
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public', 'auth'
  AS $function$ declare v_invitacion public.auditoria_invitaciones_admin % rowtype;

v_rol text;

begin if not exists (

  select

    1

  from

    public.super_admins

  where

    user_id = auth.uid()

    and activo = true

) then raise exception 'Solo un Super Admin activo puede completar invitaciones.' using errcode = '42501';

end if;

select

  * into v_invitacion

from

  public.auditoria_invitaciones_admin

where

  operacion_id = p_operacion_id for

update

;

if v_invitacion.id is null

or v_invitacion.actor_user_id <> auth.uid() then raise exception 'La invitación no existe o no pertenece al actor.' using errcode = '42501';

end if;

if v_invitacion.estado = 'completada' then return true;

end if;

if v_invitacion.estado <> 'iniciada'

or p_user_id is null then raise exception 'La invitación no puede completarse.' using errcode = '40001';

end if;

if not exists (

  select

    1

  from

    auth.users

  where

    id = p_user_id

) then raise exception 'El usuario de Auth no existe.' using errcode = 'P0002';

end if;

-- El usuario de Auth debe ser exactamente el correo invitado.

if not exists (

  select

    1

  from

    auth.users u

  where

    u.id = p_user_id

    and lower(trim(u.email)) = v_invitacion.email_normalizado

) then raise exception 'El usuario de Auth no corresponde al correo invitado.' using errcode = '42501';

end if;

-- La outbox ya guarda el rol (default 'admin' para filas anteriores). El

-- coalesce es defensivo: si la columna faltara, se preserva el

-- comportamiento original de esta RPC.

v_rol := coalesce(v_invitacion.rol, 'admin');

insert into

  public.admin_comercios (user_id, comercio_id, rol, activo)

values

  (p_user_id, v_invitacion.comercio_id, v_rol, true);

update

  public.auditoria_invitaciones_admin

set

  usuario_auth_id = p_user_id,

  estado = 'completada',

  actualizada_en = now()

where

  id = v_invitacion.id;

perform public.auditoria_registrar_evento_interno(

  p_operacion_id,

  2 :: smallint,

  v_invitacion.comercio_id,

  'asignar',

  'admin_comercio',

  p_user_id,

  null,

  jsonb_build_object(

    'user_id',

    p_user_id,

    'comercio_id',

    v_invitacion.comercio_id,

    'rol',

    v_rol,

    'activo',

    true

  )

);

return true;

end;

$function$;

REVOKE ALL ON FUNCTION "public"."super_admin_completar_invitacion_auditada"(uuid, uuid) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.super_admin_eliminar_categoria_auditada (
  p_operacion_id uuid,
  p_comercio_id  uuid,
  p_categoria_id uuid
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public', 'auth'
  AS $function$
declare
  v_anterior jsonb;
begin
  if not exists (
    select 1
    from public.super_admins
    where user_id = auth.uid()
      and activo = true
  ) then
    raise exception 'Solo un Super Admin activo puede eliminar categorías.'
      using errcode = '42501';
  end if;

  if not public.auditoria_iniciar_operacion(
    p_operacion_id,
    p_comercio_id,
    'categoria',
    p_categoria_id
  ) then
    return true;
  end if;

  select jsonb_build_object(
    'nombre', nombre,
    'activa', activa
  )
  into v_anterior
  from public.categorias
  where id = p_categoria_id
    and comercio_id = p_comercio_id
  for update;

  if v_anterior is null then
    raise exception 'La categoría no pertenece al comercio autorizado.'
      using errcode = 'P0002';
  end if;

  update public.categorias
  set activa = false
  where id = p_categoria_id
    and comercio_id = p_comercio_id;

  perform public.auditoria_finalizar_operacion(
    p_operacion_id,
    1,
    p_comercio_id,
    'eliminar',
    'categoria',
    p_categoria_id,
    v_anterior,
    jsonb_build_object(
      'nombre', v_anterior ->> 'nombre',
      'activa', false
    )
  );

  return true;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."super_admin_eliminar_categoria_auditada"(uuid, uuid, uuid) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.super_admin_eliminar_producto_auditado (
  p_operacion_id uuid,
  p_comercio_id  uuid,
  p_producto_id  uuid
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public', 'auth'
  AS $function$
declare
  v_anterior jsonb;
begin
  if not exists (
    select 1
    from public.super_admins
    where user_id = auth.uid()
      and activo = true
  ) then
    raise exception 'Solo un Super Admin activo puede eliminar productos.'
      using errcode = '42501';
  end if;

  if not public.auditoria_iniciar_operacion(
    p_operacion_id,
    p_comercio_id,
    'producto',
    p_producto_id
  ) then
    return true;
  end if;

  select jsonb_build_object(
    'nombre', nombre,
    'activo', activo
  )
  into v_anterior
  from public.productos
  where id = p_producto_id
    and comercio_id = p_comercio_id
  for update;

  if v_anterior is null then
    raise exception 'El producto no pertenece al comercio autorizado.'
      using errcode = 'P0002';
  end if;

  update public.productos
  set activo = false
  where id = p_producto_id
    and comercio_id = p_comercio_id;

  perform public.auditoria_finalizar_operacion(
    p_operacion_id,
    1,
    p_comercio_id,
    'eliminar',
    'producto',
    p_producto_id,
    v_anterior,
    jsonb_build_object(
      'nombre', v_anterior ->> 'nombre',
      'activo', false
    )
  );

  return true;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."super_admin_eliminar_producto_auditado"(uuid, uuid, uuid) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.super_admin_iniciar_invitacion_auditada (
  p_operacion_id uuid,
  p_comercio_id  uuid,
  p_email        text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public', 'auth'
  AS $function$
declare
  v_actor uuid := auth.uid();
  v_email text := lower(trim(p_email));
  v_invitacion public.auditoria_invitaciones_admin%rowtype;
begin
  if v_actor is null
     or not exists (
       select 1 from public.super_admins
       where user_id = v_actor and activo = true
     ) then
    raise exception 'Solo un Super Admin activo puede invitar administradores.'
      using errcode = '42501';
  end if;

  if p_operacion_id is null
     or p_comercio_id is null
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or length(v_email) > 320 then
    raise exception 'Los datos de la invitación no son válidos.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.comercios
    where id = p_comercio_id and activo = true
  ) then
    raise exception 'El comercio no existe o está inactivo.'
      using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_operacion_id::text, 0)
  );

  select * into v_invitacion
  from public.auditoria_invitaciones_admin
  where operacion_id = p_operacion_id
  for update;

  if v_invitacion.id is not null then
    if v_invitacion.actor_user_id <> v_actor
       or v_invitacion.comercio_id <> p_comercio_id
       or v_invitacion.email_normalizado <> v_email then
      raise exception 'La operación pertenece a otra invitación.'
        using errcode = '42501';
    end if;
    if v_invitacion.estado <> 'iniciada' then
      raise exception 'La invitación ya fue finalizada.'
        using errcode = '40001';
    end if;
    return v_invitacion.id;
  end if;

  insert into public.auditoria_invitaciones_admin (
    operacion_id, comercio_id, actor_user_id, email_normalizado
  )
  values (p_operacion_id, p_comercio_id, v_actor, v_email)
  returning * into v_invitacion;

  perform public.auditoria_registrar_evento_interno(
    p_operacion_id,
    1::smallint,
    p_comercio_id,
    'invitacion_iniciada',
    'admin_invitacion',
    p_operacion_id,
    null,
    jsonb_build_object(
      'email', v_email,
      'estado', 'iniciada'
    )
  );

  return v_invitacion.id;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."super_admin_iniciar_invitacion_auditada"(uuid, uuid, text) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.super_admin_marcar_invitacion_fallida (
  p_operacion_id uuid,
  p_motivo       text,
  p_user_id      uuid DEFAULT NULL::uuid
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog', 'public', 'auth'
  AS $function$
declare
  v_invitacion public.auditoria_invitaciones_admin%rowtype;
  v_motivo text := coalesce(nullif(trim(p_motivo), ''), 'error_externo');
begin
  if not exists (
    select 1 from public.super_admins
    where user_id = auth.uid() and activo = true
  ) then
    raise exception 'Solo un Super Admin activo puede cerrar invitaciones.'
      using errcode = '42501';
  end if;
  if v_motivo not in (
    'error_externo', 'usuario_ya_existia', 'asignacion_fallida',
    'correo_invalido', 'reintento_manual'
  ) then
    raise exception 'Motivo de fallo no permitido.' using errcode = '22023';
  end if;

  select * into v_invitacion
  from public.auditoria_invitaciones_admin
  where operacion_id = p_operacion_id
  for update;

  if v_invitacion.id is null or v_invitacion.actor_user_id <> auth.uid() then
    raise exception 'La invitación no existe o no pertenece al actor.'
      using errcode = '42501';
  end if;
  if v_invitacion.estado = 'fallida' then
    return true;
  end if;
  if v_invitacion.estado <> 'iniciada' then
    raise exception 'La invitación ya fue completada.'
      using errcode = '40001';
  end if;

  update public.auditoria_invitaciones_admin
  set estado = 'fallida',
      usuario_auth_id = p_user_id,
      motivo_fallo = v_motivo,
      actualizada_en = now()
  where id = v_invitacion.id;

  perform public.auditoria_registrar_evento_interno(
    p_operacion_id,
    2::smallint,
    v_invitacion.comercio_id,
    'invitacion_fallida',
    'admin_invitacion',
    p_operacion_id,
    jsonb_build_object('estado', 'iniciada'),
    jsonb_strip_nulls(jsonb_build_object(
      'estado', 'fallida',
      'motivo', v_motivo,
      'usuario_auth_id', p_user_id
    ))
  );
  return true;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."super_admin_marcar_invitacion_fallida"(uuid, text, uuid) FROM PUBLIC, "anon", "service_role";

ALTER TABLE "public"."admin_comercios"
  ADD CONSTRAINT "admin_comercios_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."clientes_direcciones"
  ADD CONSTRAINT "clientes_direcciones_perfil_fk" FOREIGN KEY (user_id, comercio_id) REFERENCES public.clientes_perfiles(user_id, comercio_id) ON UPDATE RESTRICT ON DELETE CASCADE;

ALTER TABLE "public"."clientes_perfiles"
  ADD CONSTRAINT "clientes_perfiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE RESTRICT ON DELETE CASCADE;

ALTER TABLE "public"."admin_comercios"
  ADD CONSTRAINT "admin_comercios_comercio_id_fkey" FOREIGN KEY (comercio_id) REFERENCES public.comercios(id) ON DELETE CASCADE;

ALTER TABLE "public"."auditoria_eventos"
  ADD CONSTRAINT "auditoria_eventos_comercio_id_fkey" FOREIGN KEY (comercio_id) REFERENCES public.comercios(id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE "public"."auditoria_invitaciones_admin"
  ADD CONSTRAINT "auditoria_invitaciones_admin_comercio_id_fkey" FOREIGN KEY (comercio_id) REFERENCES public.comercios(id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE "public"."categorias"
  ADD CONSTRAINT "categorias_comercio_id_fkey" FOREIGN KEY (comercio_id) REFERENCES public.comercios(id) ON DELETE CASCADE;

ALTER TABLE "public"."clientes_perfiles"
  ADD CONSTRAINT "clientes_perfiles_comercio_id_fkey" FOREIGN KEY (comercio_id) REFERENCES public.comercios(id) ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE "public"."opciones"
  ADD CONSTRAINT "opciones_grupo_id_fkey" FOREIGN KEY (grupo_id) REFERENCES public.grupos_opciones(id) ON DELETE CASCADE;

ALTER TABLE "public"."pagos_notificaciones"
  ADD CONSTRAINT "pagos_notificaciones_pago_id_fkey" FOREIGN KEY (pago_id) REFERENCES public.pagos(id) ON DELETE CASCADE;

ALTER TABLE "public"."pedido_item_opciones"
  ADD CONSTRAINT "pedido_item_opciones_opcion_id_fkey" FOREIGN KEY (opcion_id) REFERENCES public.opciones(id);

ALTER TABLE "public"."pedido_item_opciones"
  ADD CONSTRAINT "pedido_item_opciones_pedido_item_id_fkey" FOREIGN KEY (pedido_item_id) REFERENCES public.pedido_items(id) ON DELETE CASCADE;

ALTER TABLE "public"."pedidos"
  ADD CONSTRAINT "pedidos_cliente_user_fk" FOREIGN KEY (cliente_user_id) REFERENCES auth.users(id) ON UPDATE RESTRICT ON DELETE SET NULL;

ALTER TABLE "public"."pedidos"
  ADD CONSTRAINT "pedidos_comercio_id_fkey" FOREIGN KEY (comercio_id) REFERENCES public.comercios(id);

ALTER TABLE "public"."pagos"
  ADD CONSTRAINT "pagos_pedido_id_fkey" FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id);

ALTER TABLE "public"."pedido_items"
  ADD CONSTRAINT "pedido_items_pedido_id_fkey" FOREIGN KEY (pedido_id) REFERENCES public.pedidos(id) ON DELETE CASCADE;

ALTER TABLE "public"."productos"
  ADD CONSTRAINT "productos_categoria_comercio_fk" FOREIGN KEY (categoria_id, comercio_id) REFERENCES public.categorias(id, comercio_id);

ALTER TABLE "public"."productos"
  ADD CONSTRAINT "productos_comercio_id_fkey" FOREIGN KEY (comercio_id) REFERENCES public.comercios(id);

ALTER TABLE "public"."grupos_opciones"
  ADD CONSTRAINT "grupos_opciones_producto_id_fkey" FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE CASCADE;

ALTER TABLE "public"."pedido_items"
  ADD CONSTRAINT "pedido_items_producto_id_fkey" FOREIGN KEY (producto_id) REFERENCES public.productos(id);

ALTER TABLE "public"."reglas_opciones_variante"
  ADD CONSTRAINT "reglas_grupo_producto_fk" FOREIGN KEY (grupo_id, producto_id) REFERENCES public.grupos_opciones(id, producto_id);

ALTER TABLE "public"."reglas_opciones_variante"
  ADD CONSTRAINT "reglas_opciones_variante_grupo_id_fkey" FOREIGN KEY (grupo_id) REFERENCES public.grupos_opciones(id) ON DELETE CASCADE;

ALTER TABLE "public"."super_admins"
  ADD CONSTRAINT "super_admins_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."reglas_opciones_variante"
  ADD CONSTRAINT "reglas_variante_producto_fk" FOREIGN KEY (variante_id, producto_id) REFERENCES public.variantes_producto(id, producto_id);

ALTER TABLE "public"."pedido_items"
  ADD CONSTRAINT "pedido_items_variante_id_fkey" FOREIGN KEY (variante_id) REFERENCES public.variantes_producto(id);

ALTER TABLE "public"."reglas_opciones_variante"
  ADD CONSTRAINT "reglas_opciones_variante_variante_id_fkey" FOREIGN KEY (variante_id) REFERENCES public.variantes_producto(id) ON DELETE CASCADE;

ALTER TABLE "public"."variantes_producto"
  ADD CONSTRAINT "variantes_producto_producto_id_fkey" FOREIGN KEY (producto_id) REFERENCES public.productos(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX admin_comercios_usuario_comercio_uidx ON public.admin_comercios USING btree (user_id, comercio_id);

CREATE INDEX auditoria_eventos_accion_fecha_idx ON public.auditoria_eventos USING btree (accion, creado_en DESC);

CREATE INDEX auditoria_eventos_actor_fecha_idx ON public.auditoria_eventos USING btree (actor_user_id, creado_en DESC);

CREATE INDEX auditoria_eventos_comercio_fecha_idx ON public.auditoria_eventos USING btree (comercio_id, creado_en DESC);

CREATE INDEX auditoria_eventos_entidad_registro_idx ON public.auditoria_eventos USING btree (entidad, registro_id, creado_en DESC);

CREATE INDEX auditoria_eventos_fecha_idx ON public.auditoria_eventos USING btree (creado_en DESC);

CREATE INDEX auditoria_invitaciones_admin_comercio_idx ON public.auditoria_invitaciones_admin USING btree (comercio_id, iniciada_en DESC);

CREATE UNIQUE INDEX clientes_direcciones_predeterminada_uidx ON public.clientes_direcciones USING btree (user_id, comercio_id)
  WHERE (predeterminada = true);

CREATE INDEX clientes_direcciones_propietario_idx ON public.clientes_direcciones USING btree (user_id, comercio_id, creada_en DESC);

CREATE INDEX clientes_perfiles_comercio_idx ON public.clientes_perfiles USING btree (comercio_id, user_id);

CREATE INDEX idx_categorias_comercio ON public.categorias USING btree (comercio_id);

CREATE INDEX idx_grupos_opciones_producto ON public.grupos_opciones USING btree (producto_id);

CREATE INDEX idx_opciones_grupo ON public.opciones USING btree (grupo_id);

CREATE INDEX idx_pagos_pedido ON public.pagos USING btree (pedido_id);

CREATE INDEX idx_pedido_items_pedido ON public.pedido_items USING btree (pedido_id);

CREATE INDEX idx_pedidos_comercio_estado ON public.pedidos USING btree (comercio_id, estado, creado_en DESC);

CREATE INDEX idx_productos_categoria ON public.productos USING btree (categoria_id);

CREATE INDEX idx_reglas_variante ON public.reglas_opciones_variante USING btree (variante_id);

CREATE INDEX idx_variantes_producto ON public.variantes_producto USING btree (producto_id);

CREATE UNIQUE INDEX pagos_preferencia_uidx ON public.pagos USING btree (preferencia_id)
  WHERE (preferencia_id IS NOT NULL);

CREATE UNIQUE INDEX pagos_proveedor_pago_externo_uidx ON public.pagos USING btree (proveedor, pago_externo_id)
  WHERE (pago_externo_id IS NOT NULL);

CREATE UNIQUE INDEX pagos_proveedor_referencia_uidx ON public.pagos USING btree (proveedor, referencia_externa)
  WHERE (referencia_externa IS NOT NULL);

CREATE INDEX pedidos_cliente_historial_idx ON public.pedidos USING btree (cliente_user_id, comercio_id, creado_en DESC)
  WHERE (cliente_user_id IS NOT NULL);

CREATE INDEX pedidos_sin_revisar_idx ON public.pedidos USING btree (comercio_id, creado_en DESC)
  WHERE (revisado_en IS NULL);

CREATE INDEX productos_comercio_activo_orden_idx ON public.productos USING btree (comercio_id, activo, orden);

CREATE TRIGGER auditoria_eventos_bloquear_delete
  BEFORE DELETE ON public.auditoria_eventos
  FOR EACH ROW
  EXECUTE FUNCTION public.auditoria_bloquear_mutacion();

CREATE TRIGGER auditoria_eventos_bloquear_update
  BEFORE UPDATE ON public.auditoria_eventos
  FOR EACH ROW
  EXECUTE FUNCTION public.auditoria_bloquear_mutacion();

CREATE TRIGGER clientes_direcciones_actualizada_en
  BEFORE UPDATE ON public.clientes_direcciones
  FOR EACH ROW
  EXECUTE FUNCTION public.clientes_actualizar_actualizado_en();

CREATE TRIGGER clientes_perfiles_actualizado_en
  BEFORE UPDATE ON public.clientes_perfiles
  FOR EACH ROW
  EXECUTE FUNCTION public.clientes_actualizar_actualizado_en();

CREATE POLICY "admin_comercios_select_own" ON "public"."admin_comercios"
  FOR SELECT
  TO "authenticated"
  USING ((auth.uid() = user_id));

CREATE POLICY "Super Admin consulta auditoría" ON "public"."auditoria_eventos"
  FOR SELECT
  TO "authenticated"
  USING (public.es_super_admin_activo());

CREATE POLICY "Lectura publica de categorias activas" ON "public"."categorias"
  FOR SELECT
  TO "anon", "authenticated"
  USING (((activa = true) AND (EXISTS ( SELECT 1
   FROM public.comercios c
  WHERE ((c.id = categorias.comercio_id) AND (c.activo = true))))));

CREATE POLICY "Cliente actualiza sus direcciones" ON "public"."clientes_direcciones"
  FOR UPDATE
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)))
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Cliente consulta sus direcciones" ON "public"."clientes_direcciones"
  FOR SELECT
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Cliente crea sus direcciones" ON "public"."clientes_direcciones"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Cliente elimina sus direcciones" ON "public"."clientes_direcciones"
  FOR DELETE
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Cliente actualiza sus perfiles" ON "public"."clientes_perfiles"
  FOR UPDATE
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)))
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Cliente consulta sus perfiles" ON "public"."clientes_perfiles"
  FOR SELECT
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Cliente crea sus perfiles" ON "public"."clientes_perfiles"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Cliente elimina sus perfiles" ON "public"."clientes_perfiles"
  FOR DELETE
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Lectura publica de comercios activos" ON "public"."comercios"
  FOR SELECT
  TO "anon", "authenticated"
  USING ((activo = true));

CREATE POLICY "Lectura publica de grupos activos" ON "public"."grupos_opciones"
  FOR SELECT
  TO "anon", "authenticated"
  USING (((activo = true) AND (EXISTS ( SELECT 1
   FROM public.productos p
  WHERE ((p.id = grupos_opciones.producto_id) AND (p.disponible = true))))));

CREATE POLICY "Lectura publica de opciones disponibles" ON "public"."opciones"
  FOR SELECT
  TO "anon", "authenticated"
  USING (((disponible = true) AND (EXISTS ( SELECT 1
   FROM public.grupos_opciones g
  WHERE ((g.id = opciones.grupo_id) AND (g.activo = true))))));

CREATE POLICY "Cliente consulta opciones de sus pedidos" ON "public"."pedido_item_opciones"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM (public.pedido_items pi
     JOIN public.pedidos p ON ((p.id = pi.pedido_id)))
  WHERE ((pi.id = pedido_item_opciones.pedido_item_id) AND (p.cliente_user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "Personal consulta opciones de su comercio" ON "public"."pedido_item_opciones"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM (public.pedido_items pi
     JOIN public.pedidos p ON ((p.id = pi.pedido_id)))
  WHERE ((pi.id = pedido_item_opciones.pedido_item_id) AND public.es_personal_de_comercio(p.comercio_id)))));

CREATE POLICY "Cliente consulta items de sus pedidos" ON "public"."pedido_items"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.pedidos p
  WHERE ((p.id = pedido_items.pedido_id) AND (p.cliente_user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "Personal consulta items de su comercio" ON "public"."pedido_items"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.pedidos p
  WHERE ((p.id = pedido_items.pedido_id) AND public.es_personal_de_comercio(p.comercio_id)))));

CREATE POLICY "Cliente consulta sus pedidos" ON "public"."pedidos"
  FOR SELECT
  TO "authenticated"
  USING (((cliente_user_id IS NOT NULL) AND (cliente_user_id = ( SELECT auth.uid() AS uid))));

CREATE POLICY "Personal del comercio lee pedidos" ON "public"."pedidos"
  FOR SELECT
  TO "authenticated"
  USING (public.es_personal_de_comercio(comercio_id));

CREATE POLICY "Lectura publica de productos disponibles" ON "public"."productos"
  FOR SELECT
  TO "anon", "authenticated"
  USING (((disponible = true) AND (EXISTS ( SELECT 1
   FROM (public.categorias cat
     JOIN public.comercios c ON ((c.id = cat.comercio_id)))
  WHERE ((cat.id = productos.categoria_id) AND (cat.activa = true) AND (c.activo = true))))));

CREATE POLICY "Lectura publica de reglas activas" ON "public"."reglas_opciones_variante"
  FOR SELECT
  TO "anon", "authenticated"
  USING (((activo = true) AND (EXISTS ( SELECT 1
   FROM public.variantes_producto v
  WHERE ((v.id = reglas_opciones_variante.variante_id) AND (v.disponible = true))))));

CREATE POLICY "super_admin_no_user_writes" ON "public"."super_admins"
  FOR ALL
  TO "authenticated"
  USING (false)
  WITH CHECK (false);

CREATE POLICY "super_admin_self_read" ON "public"."super_admins"
  FOR SELECT
  TO "authenticated"
  USING ((user_id = auth.uid()));

CREATE POLICY "Lectura publica de variantes disponibles" ON "public"."variantes_producto"
  FOR SELECT
  TO "anon", "authenticated"
  USING (((disponible = true) AND (EXISTS ( SELECT 1
   FROM public.productos p
  WHERE ((p.id = variantes_producto.producto_id) AND (p.disponible = true))))));

CREATE POLICY "Lectura pública de imágenes de productos" ON "storage"."objects"
  FOR SELECT
  TO PUBLIC
  USING ((bucket_id = 'imagenes-productos'::text));

CREATE EVENT TRIGGER "ensure_rls"
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION "public"."rls_auto_enable"();

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."pedidos";

COMMENT ON COLUMN "public"."auditoria_eventos"."actor_user_id" IS 'UUID del usuario de Supabase Auth validado por el servidor. Se conserva aunque el usuario sea eliminado.';

COMMENT ON COLUMN "public"."auditoria_eventos"."operacion_id" IS 'Clave de idempotencia de una operación administrativa completa.';

COMMENT ON COLUMN "public"."auditoria_eventos"."registro_id" IS 'UUID del registro afectado. Para admin_comercios se utiliza el user_id asignado.';

COMMENT ON COLUMN "public"."auditoria_eventos"."secuencia" IS 'Orden determinista cuando una misma operación genera más de un evento.';

COMMENT ON COLUMN "public"."clientes_perfiles"."comercio_id" IS 'Comercio al que pertenecen los datos del perfil.';

COMMENT ON COLUMN "public"."clientes_perfiles"."user_id" IS 'Usuario propietario del perfil en auth.users.';

COMMENT ON COLUMN "public"."pedidos"."cliente_user_id" IS 'Usuario de Auth asociado al pedido; null identifica checkout invitado o cuenta eliminada.';

COMMENT ON COLUMN "public"."pedidos"."revisado_en" IS 'Momento en que un administrador marcó como vista la notificación del pedido. No afecta el estado comercial.';

COMMENT ON COLUMN "public"."super_admins"."activo" IS 'Indica si el usuario tiene el acceso global activo.';

COMMENT ON COLUMN "public"."super_admins"."user_id" IS 'Usuario autenticado de Supabase Auth.';

COMMENT ON TABLE "public"."auditoria_eventos" IS 'Registro inmutable de operaciones administrativas. Solo los Super Admin activos pueden consultarlo.';

COMMENT ON TABLE "public"."auditoria_invitaciones_admin" IS 'Outbox auditable para invitaciones externas de Supabase Auth. No contiene tokens.';

COMMENT ON TABLE "public"."clientes_direcciones" IS 'Direcciones guardadas por un cliente para un comercio específico.';

COMMENT ON TABLE "public"."clientes_perfiles" IS 'Perfil de un usuario de Supabase Auth dentro de un comercio.';

COMMENT ON TABLE "public"."super_admins" IS 'Usuarios globales con permisos de Super Admin para la plataforma. No reemplaza admin_comercios.';

GRANT EXECUTE ON FUNCTION "public"."admin_actualizar_categoria_auditada"(uuid, uuid, uuid, text, text, text, boolean) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."admin_actualizar_categoria_auditada"(uuid, uuid, uuid, text, text, text, boolean) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_actualizar_categoria_auditada"(uuid, uuid, uuid, text, text, text, boolean) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_actualizar_estado_pedido_auditado"(uuid, uuid, uuid, text, text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."admin_actualizar_estado_pedido_auditado"(uuid, uuid, uuid, text, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_actualizar_estado_pedido_auditado"(uuid, uuid, uuid, text, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_actualizar_producto_auditado"(uuid, uuid, uuid, uuid, text, text, text, numeric, boolean, boolean) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."admin_actualizar_producto_auditado"(uuid, uuid, uuid, uuid, text, text, text, numeric, boolean, boolean) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_actualizar_producto_auditado"(uuid, uuid, uuid, uuid, text, text, text, numeric, boolean, boolean) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_actualizar_variante_auditada"(uuid, uuid, uuid, text, numeric, boolean) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."admin_actualizar_variante_auditada"(uuid, uuid, uuid, text, numeric, boolean) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_actualizar_variante_auditada"(uuid, uuid, uuid, text, numeric, boolean) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_asignar_empleado_auditado"(uuid, uuid, uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."admin_asignar_empleado_auditado"(uuid, uuid, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_asignar_empleado_auditado"(uuid, uuid, uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_cambiar_disponibilidad_producto_auditada"(uuid, uuid, uuid, boolean) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."admin_cambiar_disponibilidad_producto_auditada"(uuid, uuid, uuid, boolean) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_cambiar_disponibilidad_producto_auditada"(uuid, uuid, uuid, boolean) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_cambiar_disponibilidad_variante_auditada"(uuid, uuid, uuid, boolean) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."admin_cambiar_disponibilidad_variante_auditada"(uuid, uuid, uuid, boolean) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_cambiar_disponibilidad_variante_auditada"(uuid, uuid, uuid, boolean) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_cambiar_estado_empleado_auditado"(uuid, uuid, uuid, boolean) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."admin_cambiar_estado_empleado_auditado"(uuid, uuid, uuid, boolean) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_cambiar_estado_empleado_auditado"(uuid, uuid, uuid, boolean) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_completar_invitacion_empleado_auditada"(uuid, uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."admin_completar_invitacion_empleado_auditada"(uuid, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_completar_invitacion_empleado_auditada"(uuid, uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_crear_categoria_auditada"(uuid, uuid, text, text, text, text, integer) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."admin_crear_categoria_auditada"(uuid, uuid, text, text, text, text, integer) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_crear_categoria_auditada"(uuid, uuid, text, text, text, text, integer) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_crear_producto_auditado"(uuid, uuid, uuid, text, text, text, text, numeric, integer) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."admin_crear_producto_auditado"(uuid, uuid, uuid, text, text, text, text, numeric, integer) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_crear_producto_auditado"(uuid, uuid, uuid, text, text, text, text, numeric, integer) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_crear_variante_auditada"(uuid, uuid, uuid, text, numeric, integer) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."admin_crear_variante_auditada"(uuid, uuid, uuid, text, numeric, integer) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_crear_variante_auditada"(uuid, uuid, uuid, text, numeric, integer) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_finalizar_acceso_empleado_auditado"(uuid, boolean) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."admin_finalizar_acceso_empleado_auditado"(uuid, boolean) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_finalizar_acceso_empleado_auditado"(uuid, boolean) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_iniciar_acceso_empleado_auditado"(uuid, uuid, uuid, text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."admin_iniciar_acceso_empleado_auditado"(uuid, uuid, uuid, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_iniciar_acceso_empleado_auditado"(uuid, uuid, uuid, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_iniciar_invitacion_empleado_auditada"(uuid, uuid, text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."admin_iniciar_invitacion_empleado_auditada"(uuid, uuid, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_iniciar_invitacion_empleado_auditada"(uuid, uuid, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_marcar_invitacion_empleado_fallida"(uuid, text, uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."admin_marcar_invitacion_empleado_fallida"(uuid, text, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_marcar_invitacion_empleado_fallida"(uuid, text, uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."auditoria_actor_autorizado"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."auditoria_actor_autorizado"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."auditoria_bloquear_mutacion"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."auditoria_bloquear_mutacion"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."auditoria_contiene_clave_sensible"(jsonb) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."auditoria_contiene_clave_sensible"(jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "public"."auditoria_finalizar_operacion"(uuid, integer, uuid, text, text, uuid, jsonb, jsonb) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."auditoria_finalizar_operacion"(uuid, integer, uuid, text, text, uuid, jsonb, jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "public"."auditoria_iniciar_operacion"(uuid, uuid, text, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."auditoria_iniciar_operacion"(uuid, uuid, text, uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."auditoria_registrar_evento_interno"(uuid, smallint, uuid, text, text, uuid, jsonb, jsonb) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."auditoria_registrar_evento_interno"(uuid, smallint, uuid, text, text, uuid, jsonb, jsonb) TO "postgres";

REVOKE ALL ON FUNCTION "public"."clientes_actualizar_actualizado_en"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."clientes_actualizar_actualizado_en"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."confirmar_pago_mercado_pago"(text, uuid, text, text, numeric, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."confirmar_pago_mercado_pago"(text, uuid, text, text, numeric, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."confirmar_pago_mercado_pago"(text, uuid, text, text, numeric, text) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."es_admin_de_comercio"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."es_admin_de_comercio"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."es_admin_de_comercio"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."es_empleado_de_comercio"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."es_empleado_de_comercio"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."es_empleado_de_comercio"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."es_personal_de_comercio"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."es_personal_de_comercio"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."es_personal_de_comercio"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."es_super_admin_activo"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."es_super_admin_activo"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."es_super_admin_activo"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."registrar_pedido_desde_checkout"(uuid, text, text, text, text, text, text, text, text, numeric, jsonb) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."registrar_pedido_desde_checkout"(uuid, text, text, text, text, text, text, text, text, numeric, jsonb) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."registrar_pedido_desde_checkout"(uuid, text, text, text, text, text, text, text, text, numeric, jsonb) TO "service_role";

REVOKE ALL ON FUNCTION "public"."reservar_preferencia_mercado_pago"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."reservar_preferencia_mercado_pago"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."reservar_preferencia_mercado_pago"(uuid) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."rls_auto_enable"() TO PUBLIC;

REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."rls_auto_enable"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."super_admin_asignar_administrador_auditado"(uuid, uuid, uuid, text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."super_admin_asignar_administrador_auditado"(uuid, uuid, uuid, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."super_admin_asignar_administrador_auditado"(uuid, uuid, uuid, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."super_admin_cambiar_estado_administrador_auditado"(uuid, uuid, uuid, boolean) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."super_admin_cambiar_estado_administrador_auditado"(uuid, uuid, uuid, boolean) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."super_admin_cambiar_estado_administrador_auditado"(uuid, uuid, uuid, boolean) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."super_admin_completar_invitacion_auditada"(uuid, uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."super_admin_completar_invitacion_auditada"(uuid, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."super_admin_completar_invitacion_auditada"(uuid, uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."super_admin_eliminar_categoria_auditada"(uuid, uuid, uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."super_admin_eliminar_categoria_auditada"(uuid, uuid, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."super_admin_eliminar_categoria_auditada"(uuid, uuid, uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."super_admin_eliminar_producto_auditado"(uuid, uuid, uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."super_admin_eliminar_producto_auditado"(uuid, uuid, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."super_admin_eliminar_producto_auditado"(uuid, uuid, uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."super_admin_iniciar_invitacion_auditada"(uuid, uuid, text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."super_admin_iniciar_invitacion_auditada"(uuid, uuid, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."super_admin_iniciar_invitacion_auditada"(uuid, uuid, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."super_admin_marcar_invitacion_fallida"(uuid, text, uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."super_admin_marcar_invitacion_fallida"(uuid, text, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."super_admin_marcar_invitacion_fallida"(uuid, text, uuid) TO "postgres";

REVOKE ALL ON TABLE "public"."admin_comercios" FROM "anon";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."admin_comercios" TO "anon";

REVOKE ALL ON TABLE "public"."admin_comercios" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."admin_comercios" TO "authenticated";

REVOKE ALL ON TABLE "public"."admin_comercios" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."admin_comercios" TO "postgres";

REVOKE ALL ON TABLE "public"."admin_comercios" FROM "service_role";

GRANT INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."admin_comercios" TO "service_role";

REVOKE ALL ON TABLE "public"."auditoria_eventos" FROM "authenticated";

GRANT SELECT ON TABLE "public"."auditoria_eventos" TO "authenticated";

REVOKE ALL ON TABLE "public"."auditoria_eventos" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."auditoria_eventos" TO "postgres";

REVOKE ALL ON TABLE "public"."auditoria_invitaciones_admin" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."auditoria_invitaciones_admin" TO "postgres";

REVOKE ALL ON TABLE "public"."categorias" FROM "anon";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."categorias" TO "anon";

REVOKE ALL ON TABLE "public"."categorias" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."categorias" TO "authenticated";

REVOKE ALL ON TABLE "public"."categorias" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."categorias" TO "postgres";

REVOKE ALL ON TABLE "public"."categorias" FROM "service_role";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."categorias" TO "service_role";

REVOKE ALL ON TABLE "public"."clientes_direcciones" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."clientes_direcciones" TO "authenticated";

REVOKE ALL ON TABLE "public"."clientes_direcciones" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."clientes_direcciones" TO "postgres";

REVOKE ALL ON TABLE "public"."clientes_direcciones" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."clientes_direcciones" TO "service_role";

REVOKE ALL ON TABLE "public"."clientes_perfiles" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."clientes_perfiles" TO "authenticated";

REVOKE ALL ON TABLE "public"."clientes_perfiles" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."clientes_perfiles" TO "postgres";

REVOKE ALL ON TABLE "public"."clientes_perfiles" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."clientes_perfiles" TO "service_role";

REVOKE ALL ON TABLE "public"."comercios" FROM "anon";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."comercios" TO "anon";

REVOKE ALL ON TABLE "public"."comercios" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."comercios" TO "authenticated";

REVOKE ALL ON TABLE "public"."comercios" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."comercios" TO "postgres";

REVOKE ALL ON TABLE "public"."comercios" FROM "service_role";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."comercios" TO "service_role";

REVOKE ALL ON TABLE "public"."grupos_opciones" FROM "anon";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."grupos_opciones" TO "anon";

REVOKE ALL ON TABLE "public"."grupos_opciones" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."grupos_opciones" TO "authenticated";

REVOKE ALL ON TABLE "public"."grupos_opciones" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."grupos_opciones" TO "postgres";

REVOKE ALL ON TABLE "public"."grupos_opciones" FROM "service_role";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."grupos_opciones" TO "service_role";

REVOKE ALL ON TABLE "public"."opciones" FROM "anon";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."opciones" TO "anon";

REVOKE ALL ON TABLE "public"."opciones" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."opciones" TO "authenticated";

REVOKE ALL ON TABLE "public"."opciones" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."opciones" TO "postgres";

REVOKE ALL ON TABLE "public"."opciones" FROM "service_role";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."opciones" TO "service_role";

REVOKE ALL ON TABLE "public"."pagos" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."pagos" TO "postgres";

REVOKE ALL ON TABLE "public"."pagos" FROM "service_role";

GRANT INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."pagos" TO "service_role";

REVOKE ALL ON TABLE "public"."pagos_notificaciones" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."pagos_notificaciones" TO "postgres";

REVOKE ALL ON TABLE "public"."pagos_notificaciones" FROM "service_role";

GRANT INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."pagos_notificaciones" TO "service_role";

REVOKE ALL ON TABLE "public"."pedido_item_opciones" FROM "anon";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."pedido_item_opciones" TO "anon";

REVOKE ALL ON TABLE "public"."pedido_item_opciones" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."pedido_item_opciones" TO "authenticated";

REVOKE ALL ON TABLE "public"."pedido_item_opciones" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."pedido_item_opciones" TO "postgres";

REVOKE ALL ON TABLE "public"."pedido_item_opciones" FROM "service_role";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."pedido_item_opciones" TO "service_role";

REVOKE ALL ON TABLE "public"."pedido_items" FROM "anon";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."pedido_items" TO "anon";

REVOKE ALL ON TABLE "public"."pedido_items" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."pedido_items" TO "authenticated";

REVOKE ALL ON TABLE "public"."pedido_items" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."pedido_items" TO "postgres";

REVOKE ALL ON TABLE "public"."pedido_items" FROM "service_role";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."pedido_items" TO "service_role";

REVOKE ALL ON TABLE "public"."pedidos" FROM "anon";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."pedidos" TO "anon";

REVOKE ALL ON TABLE "public"."pedidos" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."pedidos" TO "authenticated";

REVOKE ALL ON TABLE "public"."pedidos" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."pedidos" TO "postgres";

REVOKE ALL ON TABLE "public"."pedidos" FROM "service_role";

REVOKE ALL ("actualizado_en") ON TABLE "public"."pedidos" FROM "service_role";

GRANT UPDATE ("actualizado_en") ON TABLE "public"."pedidos" TO "service_role";

REVOKE ALL ("estado") ON TABLE "public"."pedidos" FROM "service_role";

GRANT UPDATE ("estado") ON TABLE "public"."pedidos" TO "service_role";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."pedidos" TO "service_role";

REVOKE ALL ON TABLE "public"."productos" FROM "anon";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."productos" TO "anon";

REVOKE ALL ON TABLE "public"."productos" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."productos" TO "authenticated";

REVOKE ALL ON TABLE "public"."productos" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."productos" TO "postgres";

REVOKE ALL ON TABLE "public"."productos" FROM "service_role";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."productos" TO "service_role";

REVOKE ALL ON TABLE "public"."reglas_opciones_variante" FROM "anon";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."reglas_opciones_variante" TO "anon";

REVOKE ALL ON TABLE "public"."reglas_opciones_variante" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."reglas_opciones_variante" TO "authenticated";

REVOKE ALL ON TABLE "public"."reglas_opciones_variante" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."reglas_opciones_variante" TO "postgres";

REVOKE ALL ON TABLE "public"."reglas_opciones_variante" FROM "service_role";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."reglas_opciones_variante" TO "service_role";

REVOKE ALL ON TABLE "public"."super_admins" FROM "anon";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."super_admins" TO "anon";

REVOKE ALL ON TABLE "public"."super_admins" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."super_admins" TO "authenticated";

REVOKE ALL ON TABLE "public"."super_admins" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."super_admins" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."super_admins" TO "service_role";

REVOKE ALL ON TABLE "public"."variantes_producto" FROM "anon";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."variantes_producto" TO "anon";

REVOKE ALL ON TABLE "public"."variantes_producto" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."variantes_producto" TO "authenticated";

REVOKE ALL ON TABLE "public"."variantes_producto" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."variantes_producto" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."variantes_producto" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLES TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLES TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLES TO "service_role";

ALTER TABLE "public"."auditoria_eventos"
  ADD CONSTRAINT "auditoria_sin_secretos_check"
    CHECK
    (((NOT COALESCE(public.auditoria_contiene_clave_sensible(valores_anteriores), false)) AND (NOT COALESCE(public.auditoria_contiene_clave_sensible(valores_nuevos), false))));

