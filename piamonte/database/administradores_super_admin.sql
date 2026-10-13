-- Permisos de servidor para gestionar administradores por comercio.
-- Ejecutar manualmente en Supabase → SQL Editor → Run.
-- No modifica usuarios ni vínculos existentes.

begin;

do $$
begin
  if exists (
    select 1
    from public.admin_comercios
    group by user_id, comercio_id
    having count(*) > 1
  ) then
    raise exception
      'Existen asignaciones duplicadas en admin_comercios. Revisalas antes de continuar.';
  end if;
end
$$;

create unique index if not exists admin_comercios_usuario_comercio_uidx
  on public.admin_comercios (user_id, comercio_id);

grant select, insert, update on table public.admin_comercios to service_role;

commit;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'admin_comercios'
  and grantee = 'service_role'
order by privilege_type;
