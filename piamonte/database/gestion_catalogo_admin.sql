-- Gestión administrativa de categorías, productos y variantes.
-- Ejecutar manualmente en Supabase → SQL Editor → Run.
-- No modifica datos existentes ni permite borrados.

begin;

grant select, insert, update on table public.categorias to service_role;
grant select, insert, update on table public.productos to service_role;
grant select, insert, update on table public.variantes_producto to service_role;

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'categorias'
  ) then
    alter publication supabase_realtime add table public.categorias;
  end if;
end
$$;

commit;

select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('categorias', 'productos', 'variantes_producto')
  and grantee = 'service_role'
order by table_name, privilege_type;
