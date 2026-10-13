-- Disponibilidad de productos y variantes.
-- Revisar y ejecutar manualmente en Supabase > SQL Editor.
-- No modifica precios ni datos actuales del catálogo.

begin;

-- El catálogo público debe poder leer también los registros agotados para
-- mostrarlos sin permitir su compra.
alter table public.productos enable row level security;
alter table public.variantes_producto enable row level security;

grant select on table public.productos to anon, authenticated;
grant select on table public.variantes_producto to anon, authenticated;

-- Las escrituras se realizan únicamente desde el backend, después de validar
-- la sesión y el vínculo activo en public.admin_comercios.
grant select, update on table public.productos to service_role;
grant select, update on table public.variantes_producto to service_role;

drop policy if exists "Catalogo publico lee productos del comercio activo"
  on public.productos;
create policy "Catalogo publico lee productos del comercio activo"
  on public.productos
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.comercios c
      where c.id = productos.comercio_id
        and c.activo = true
    )
  );

drop policy if exists "Catalogo publico lee variantes del comercio activo"
  on public.variantes_producto;
create policy "Catalogo publico lee variantes del comercio activo"
  on public.variantes_producto
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.productos p
      join public.comercios c on c.id = p.comercio_id
      where p.id = variantes_producto.producto_id
        and c.activo = true
    )
  );

-- La validación de Next.js ofrece mensajes tempranos; este trigger es la
-- garantía atómica frente a un agotado marcado mientras se confirma el pedido.
create or replace function public.validar_disponibilidad_item_pedido()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_producto_disponible boolean;
  v_variante_disponible boolean;
begin
  select p.disponible
  into v_producto_disponible
  from public.productos p
  where p.id = new.producto_id
  for share;

  if not found or v_producto_disponible is not true then
    raise exception 'El producto ya no está disponible';
  end if;

  if new.variante_id is not null then
    select v.disponible
    into v_variante_disponible
    from public.variantes_producto v
    where v.id = new.variante_id
      and v.producto_id = new.producto_id
    for share;

    if not found or v_variante_disponible is not true then
      raise exception 'La variante ya no está disponible';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validar_disponibilidad_item_pedido
  on public.pedido_items;
create trigger validar_disponibilidad_item_pedido
before insert or update of producto_id, variante_id
on public.pedido_items
for each row
execute function public.validar_disponibilidad_item_pedido();

-- Realtime notifica a los catálogos abiertos; la aplicación conserva además
-- una actualización periódica como respaldo ante bloqueos del WebSocket.
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
      and tablename = 'productos'
  ) then
    alter publication supabase_realtime add table public.productos;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'variantes_producto'
  ) then
    alter publication supabase_realtime add table public.variantes_producto;
  end if;
end
$$;

commit;

-- Verificación posterior.
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename in ('productos', 'variantes_producto')
order by tablename;

select policyname, tablename, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('productos', 'variantes_producto')
order by tablename, policyname;
