-- Notificaciones de pedidos nuevos en tiempo real para el panel administrativo.
-- Ejecutar en Supabase → SQL Editor → Run. El script es idempotente.

begin;

-- 1. Marca de revisión de la notificación.
--    Es independiente de "estado": no representa ni altera el estado comercial del pedido.
--    El historial se marca como revisado solamente al crear la columna por primera vez.
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pedidos'
      and column_name = 'revisado_en'
  ) then
    alter table public.pedidos add column revisado_en timestamptz;

    update public.pedidos
    set revisado_en = now();
  end if;
end
$$;

comment on column public.pedidos.revisado_en is
  'Momento en que un administrador marcó como vista la notificación del pedido. No afecta el estado comercial.';

-- 2. Índice parcial: la consulta del panel sólo busca los pedidos sin revisar de un comercio.
create index if not exists pedidos_sin_revisar_idx
  on public.pedidos (comercio_id, creado_en desc)
  where revisado_en is null;

-- 3. Autorización reutilizable para la política.
--    Es security definer para no exigirle al navegador permisos sobre admin_comercios
--    y para evitar recursión entre políticas.
create or replace function public.es_admin_de_comercio(p_comercio_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.admin_comercios
    where user_id = auth.uid()
      and comercio_id = p_comercio_id
      and activo = true
  );
$$;

revoke all on function public.es_admin_de_comercio(uuid) from public;
grant execute on function public.es_admin_de_comercio(uuid) to authenticated;

-- 4. Realtime entrega los eventos con los permisos del usuario del navegador.
--    Sin SELECT y sin política, el panel nunca recibiría los pedidos nuevos.
--    La política limita las filas a los administradores activos del propio comercio,
--    que es la misma regla que ya aplica la aplicación del lado del servidor.
alter table public.pedidos enable row level security;

grant select on table public.pedidos to authenticated;
-- Los endpoints administrativos usan la clave privada para leer y marcar avisos.
-- RLS no reemplaza los privilegios de tabla, por eso UPDATE debe otorgarse explícitamente.
grant select, update on table public.pedidos to service_role;

drop policy if exists "Admins leen pedidos de su comercio" on public.pedidos;
create policy "Admins leen pedidos de su comercio"
  on public.pedidos
  for select
  to authenticated
  using (public.es_admin_de_comercio(comercio_id));

-- 5. Alta de la tabla en la publicación que alimenta Realtime.
do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pedidos'
  ) then
    alter publication supabase_realtime add table public.pedidos;
  end if;
end
$$;

commit;

-- 6. Verificación: la única política de lectura para "authenticated" sobre pedidos
--    debe ser la creada arriba. Si aparece otra más permisiva, revisala antes de usar el panel.
select policyname, cmd, roles, qual
from pg_policies
where schemaname = 'public'
  and tablename = 'pedidos'
order by policyname;
