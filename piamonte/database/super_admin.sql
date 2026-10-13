-- Super Admin global para la plataforma Piamonte.
-- Ejecutar en Supabase → SQL Editor → Run.
-- No se ejecuta automáticamente y no crea usuarios de prueba.

create table if not exists public.super_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

comment on table public.super_admins is
  'Usuarios globales con permisos de Super Admin para la plataforma. No reemplaza admin_comercios.';

comment on column public.super_admins.user_id is
  'Usuario autenticado de Supabase Auth.';

comment on column public.super_admins.activo is
  'Indica si el usuario tiene el acceso global activo.';

create or replace function public.es_super_admin_activo()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.super_admins
    where user_id = auth.uid()
      and activo = true
  );
$$;

revoke all on function public.es_super_admin_activo() from public;
grant execute on function public.es_super_admin_activo() to authenticated;

alter table public.super_admins enable row level security;

grant select on table public.super_admins to authenticated;
grant select, insert, update, delete on table public.super_admins to service_role;

drop policy if exists "super_admin_self_read" on public.super_admins;
create policy "super_admin_self_read"
on public.super_admins
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "super_admin_no_user_writes" on public.super_admins;
create policy "super_admin_no_user_writes"
on public.super_admins
for all
to authenticated
using (false)
with check (false);

-- El servicio debe poder administrar la tabla para primeros registros manuales.
-- Los usuarios autenticados no pueden otorgarse permisos de Super Admin.
select
  tablename,
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename = 'super_admins'
order by policyname;
