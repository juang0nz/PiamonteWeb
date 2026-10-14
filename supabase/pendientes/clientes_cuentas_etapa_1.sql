-- Cuentas de clientes: etapa 1 (estructura y RLS).
-- Revisar y ejecutar manualmente en Supabase -> SQL Editor -> Run.
--
-- Esta migración no crea usuarios de Auth, no modifica pedidos existentes
-- y no cambia la firma de registrar_pedido_desde_checkout.
-- El checkout invitado continúa registrando pedidos con service_role y deja
-- pedidos.cliente_user_id en null.
--
-- Ejecutar después de empleados_etapa_1. Ese script elimina todas las
-- políticas de pedidos; si se reejecuta más adelante, esta migración debe
-- reaplicarse para restaurar "Cliente consulta sus pedidos".
begin;

-- Precondiciones del esquema actual.
do $$ begin if to_regclass('public.comercios') is null then raise exception 'Falta la tabla public.comercios.';

end if;

if to_regclass('public.pedidos') is null then raise exception 'Falta la tabla public.pedidos.';

end if;

if to_regclass('public.pedido_items') is null then raise exception 'Falta la tabla public.pedido_items.';

end if;

if to_regclass('public.pedido_item_opciones') is null then raise exception 'Falta la tabla public.pedido_item_opciones.';

end if;

if to_regclass('auth.users') is null then raise exception 'Falta la tabla auth.users de Supabase Auth.';

end if;

if not exists (

  select

    1

  from

    information_schema.columns

  where

    table_schema = 'public'

    and table_name = 'pedidos'

    and column_name = 'comercio_id'

    and data_type = 'uuid'

) then raise exception 'public.pedidos.comercio_id no existe o no es uuid.';

end if;

end $$;

-- Un perfil pertenece al usuario de Auth y a un comercio. La clave compuesta
-- permite que una misma persona tenga datos distintos en varios comercios
-- sin mezclar su información entre ellos.
create table if not exists public.clientes_perfiles (

  user_id uuid not null references auth.users(id) on update restrict on delete cascade,

  comercio_id uuid not null references public.comercios(id) on update restrict on delete restrict,

  nombre text check (

    nombre is null

    or length(trim(nombre)) between 2

    and 120

  ),

  telefono text check (

    telefono is null

    or length(trim(telefono)) between 7

    and 30

  ),

  creado_en timestamptz not null default now(),

  actualizado_en timestamptz not null default now(),

  constraint clientes_perfiles_pk primary key (user_id, comercio_id)

);

comment on table public.clientes_perfiles is 'Perfil de un usuario de Supabase Auth dentro de un comercio.';

comment on column public.clientes_perfiles.user_id is 'Usuario propietario del perfil en auth.users.';

comment on column public.clientes_perfiles.comercio_id is 'Comercio al que pertenecen los datos del perfil.';

-- Las direcciones repiten user_id y comercio_id para que el aislamiento sea
-- verificable por RLS y por una FK compuesta, sin depender del frontend.
create table if not exists public.clientes_direcciones (

  id uuid primary key default gen_random_uuid(),

  user_id uuid not null,

  comercio_id uuid not null,

  etiqueta text check (

    etiqueta is null

    or length(trim(etiqueta)) between 1

    and 40

  ),

  calle text not null check (

    length(trim(calle)) between 1

    and 120

  ),

  numero text not null check (

    length(trim(numero)) between 1

    and 20

  ),

  apartamento text check (

    apartamento is null

    or length(trim(apartamento)) between 1

    and 20

  ),

  referencias text check (

    referencias is null

    or length(trim(referencias)) between 1

    and 300

  ),

  predeterminada boolean not null default false,

  creada_en timestamptz not null default now(),

  actualizada_en timestamptz not null default now(),

  constraint clientes_direcciones_perfil_fk foreign key (user_id, comercio_id) references public.clientes_perfiles(user_id, comercio_id) on update restrict on delete cascade

);

comment on table public.clientes_direcciones is 'Direcciones guardadas por un cliente para un comercio específico.';

create index if not exists clientes_perfiles_comercio_idx on public.clientes_perfiles (comercio_id, user_id);

create index if not exists clientes_direcciones_propietario_idx on public.clientes_direcciones (user_id, comercio_id, creada_en desc);

-- Como máximo una dirección predeterminada por usuario y comercio.
create unique index if not exists clientes_direcciones_predeterminada_uidx on public.clientes_direcciones (user_id, comercio_id)

where

  predeterminada = true;

-- Asociación opcional. Las filas históricas quedan en null y no se actualizan.
-- Al eliminar el usuario de Auth se anonimiza el vínculo, pero se conserva el
-- pedido y todos sus datos históricos.
alter table

  public.pedidos

add

  column if not exists cliente_user_id uuid;

do $$ begin if not exists (

  select

    1

  from

    information_schema.columns

  where

    table_schema = 'public'

    and table_name = 'pedidos'

    and column_name = 'cliente_user_id'

    and data_type = 'uuid'

) then raise exception 'public.pedidos.cliente_user_id existe pero no es uuid.';

end if;

if not exists (

  select

    1

  from

    pg_constraint

  where

    conrelid = 'public.pedidos' :: regclass

    and conname = 'pedidos_cliente_user_fk'

) then

alter table

  public.pedidos

add

  constraint pedidos_cliente_user_fk foreign key (cliente_user_id) references auth.users(id) on update restrict on delete

set

  null;

end if;

end $$;

comment on column public.pedidos.cliente_user_id is 'Usuario de Auth asociado al pedido; null identifica checkout invitado o cuenta eliminada.';

create index if not exists pedidos_cliente_historial_idx on public.pedidos (cliente_user_id, comercio_id, creado_en desc)

where

  cliente_user_id is not null;

-- Mantiene actualizado el timestamp sin confiar en valores enviados por el
-- navegador.
create

or replace function public.clientes_actualizar_actualizado_en() returns trigger language plpgsql

set

  search_path = pg_catalog,

  public as $$ begin if TG_TABLE_NAME = 'clientes_direcciones' then new.actualizada_en := now();

else new.actualizado_en := now();

end if;

return new;

end;

$$;

drop trigger if exists clientes_perfiles_actualizado_en on public.clientes_perfiles;

create trigger clientes_perfiles_actualizado_en before

update

  on public.clientes_perfiles for each row execute function public.clientes_actualizar_actualizado_en();

drop trigger if exists clientes_direcciones_actualizada_en on public.clientes_direcciones;

create trigger clientes_direcciones_actualizada_en before

update

  on public.clientes_direcciones for each row execute function public.clientes_actualizar_actualizado_en();

revoke all on function public.clientes_actualizar_actualizado_en()

from

  public,

  anon,

  authenticated;

-- RLS de perfiles.
alter table

  public.clientes_perfiles enable row level security;

drop policy if exists "Cliente consulta sus perfiles" on public.clientes_perfiles;

create policy "Cliente consulta sus perfiles" on public.clientes_perfiles for

select

  to authenticated using (

    user_id = (

      select

        auth.uid()

    )

  );

drop policy if exists "Cliente crea sus perfiles" on public.clientes_perfiles;

create policy "Cliente crea sus perfiles" on public.clientes_perfiles for

insert

  to authenticated with check (

    user_id = (

      select

        auth.uid()

    )

  );

drop policy if exists "Cliente actualiza sus perfiles" on public.clientes_perfiles;

create policy "Cliente actualiza sus perfiles" on public.clientes_perfiles for

update

  to authenticated using (

    user_id = (

      select

        auth.uid()

    )

  ) with check (

    user_id = (

      select

        auth.uid()

    )

  );

drop policy if exists "Cliente elimina sus perfiles" on public.clientes_perfiles;

create policy "Cliente elimina sus perfiles" on public.clientes_perfiles for delete to authenticated using (

  user_id = (

    select

      auth.uid()

  )

);

-- RLS de direcciones. La FK compuesta exige además que exista el perfil del
-- mismo usuario en el mismo comercio.
alter table

  public.clientes_direcciones enable row level security;

drop policy if exists "Cliente consulta sus direcciones" on public.clientes_direcciones;

create policy "Cliente consulta sus direcciones" on public.clientes_direcciones for

select

  to authenticated using (

    user_id = (

      select

        auth.uid()

    )

  );

drop policy if exists "Cliente crea sus direcciones" on public.clientes_direcciones;

create policy "Cliente crea sus direcciones" on public.clientes_direcciones for

insert

  to authenticated with check (

    user_id = (

      select

        auth.uid()

    )

  );

drop policy if exists "Cliente actualiza sus direcciones" on public.clientes_direcciones;

create policy "Cliente actualiza sus direcciones" on public.clientes_direcciones for

update

  to authenticated using (

    user_id = (

      select

        auth.uid()

    )

  ) with check (

    user_id = (

      select

        auth.uid()

    )

  );

drop policy if exists "Cliente elimina sus direcciones" on public.clientes_direcciones;

create policy "Cliente elimina sus direcciones" on public.clientes_direcciones for delete to authenticated using (

  user_id = (

    select

      auth.uid()

  )

);

-- La política existente de Admin/Empleado se conserva. Las políticas SELECT
-- permisivas se combinan con OR: el personal sigue viendo pedidos de su
-- comercio y el cliente sólo ve filas asociadas a su propio auth.uid().
alter table

  public.pedidos enable row level security;

drop policy if exists "Cliente consulta sus pedidos" on public.pedidos;

create policy "Cliente consulta sus pedidos" on public.pedidos for

select

  to authenticated using (

    cliente_user_id is not null

    and cliente_user_id = (

      select

        auth.uid()

    )

  );

-- El historial necesita el detalle del pedido. Cada política deriva la
-- propiedad desde pedidos y no permite consultar ítems de otros usuarios.
alter table

  public.pedido_items enable row level security;

drop policy if exists "Cliente consulta items de sus pedidos" on public.pedido_items;

create policy "Cliente consulta items de sus pedidos" on public.pedido_items for

select

  to authenticated using (

    exists (

      select

        1

      from

        public.pedidos p

      where

        p.id = pedido_items.pedido_id

        and p.cliente_user_id = (

          select

            auth.uid()

        )

    )

  );

drop policy if exists "Personal consulta items de su comercio" on public.pedido_items;

create policy "Personal consulta items de su comercio" on public.pedido_items for

select

  to authenticated using (

    exists (

      select

        1

      from

        public.pedidos p

      where

        p.id = pedido_items.pedido_id

        and public.es_personal_de_comercio(p.comercio_id)

    )

  );

alter table

  public.pedido_item_opciones enable row level security;

drop policy if exists "Cliente consulta opciones de sus pedidos" on public.pedido_item_opciones;

create policy "Cliente consulta opciones de sus pedidos" on public.pedido_item_opciones for

select

  to authenticated using (

    exists (

      select

        1

      from

        public.pedido_items pi

        join public.pedidos p on p.id = pi.pedido_id

      where

        pi.id = pedido_item_opciones.pedido_item_id

        and p.cliente_user_id = (

          select

            auth.uid()

        )

    )

  );

drop policy if exists "Personal consulta opciones de su comercio" on public.pedido_item_opciones;

create policy "Personal consulta opciones de su comercio" on public.pedido_item_opciones for

select

  to authenticated using (

    exists (

      select

        1

      from

        public.pedido_items pi

        join public.pedidos p on p.id = pi.pedido_id

      where

        pi.id = pedido_item_opciones.pedido_item_id

        and public.es_personal_de_comercio(p.comercio_id)

    )

  );

-- authenticated sólo administra sus perfiles/direcciones y consulta sus
-- pedidos. No se habilita INSERT/UPDATE/DELETE directo sobre pedidos.
revoke all on table public.clientes_perfiles

from

  public,

  anon,

  authenticated;

revoke all on table public.clientes_direcciones

from

  public,

  anon,

  authenticated;

grant

select

,

insert

,

update

,

  delete on table public.clientes_perfiles to authenticated;

grant

select

,

insert

,

update

,

  delete on table public.clientes_direcciones to authenticated;

grant

select

  on table public.pedidos to authenticated;

revoke

insert

,

update

,

  delete on table public.pedidos

from

  anon,

  authenticated;

grant

select

  on table public.pedido_items to authenticated;

revoke

insert

,

update

,

  delete on table public.pedido_items

from

  anon,

  authenticated;

grant

select

  on table public.pedido_item_opciones to authenticated;

revoke

insert

,

update

,

  delete on table public.pedido_item_opciones

from

  anon,

  authenticated;

commit;

-- Verificación manual posterior:
-- 1) Los pedidos existentes deben seguir sin asociación:
--    select count(*) from public.pedidos
--    where cliente_user_id is not null;
--    Debe devolver 0 inmediatamente después de esta migración.
-- 2) Confirmar las políticas sin eliminar la del personal:
--    select policyname, cmd, roles, qual, with_check
--    from pg_policies
--    where schemaname = 'public'
--      and tablename in (
--        'clientes_perfiles',
--        'clientes_direcciones',
--        'pedidos',
--        'pedido_items',
--        'pedido_item_opciones'
--      )
--    order by tablename, policyname;
-- 3) Confirmar que la RPC actual conserva su firma:
--    select to_regprocedure(
--      'public.registrar_pedido_desde_checkout(uuid,text,text,text,text,text,text,text,text,numeric,jsonb)'
--    );
-- 4) Probar con dos usuarios y dos comercios que cada usuario sólo pueda
--    consultar sus perfiles, direcciones y pedidos asociados.