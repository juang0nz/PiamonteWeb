-- Storage para imágenes de productos y categorías del catálogo.
-- Ejecutar manualmente en Supabase -> SQL Editor -> Run.
-- La aplicación sube archivos únicamente desde el servidor con service_role.

begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'imagenes-productos',
  'imagenes-productos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Lectura pública de imágenes de productos"
  on storage.objects;
drop policy if exists "Lectura pública de imágenes del catálogo"
  on storage.objects;

create policy "Lectura pública de imágenes del catálogo"
on storage.objects
for select
to public
using (bucket_id = 'imagenes-productos');

commit;

-- No se crean políticas de INSERT, UPDATE ni DELETE para el navegador.
-- El backend utiliza service_role después de validar la autorización.
