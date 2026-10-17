-- Bucket de Storage para las imágenes del catálogo (productos y categorías).
--
-- Complementa la foto base `20261017134905_remote_schema.sql`: `db pull` captura la
-- política RLS sobre `storage.objects` ("Lectura pública de imágenes de productos")
-- pero no la fila del bucket, porque `storage.buckets` es dato y no esquema.
-- Los valores reproducen la configuración observada en producción el 2026-10-17.
--
-- Requiere: esquema `storage` gestionado por Supabase (existe en todo proyecto).
-- Idempotente: si el bucket ya existe, solo alinea su configuración.
-- No crea políticas de INSERT, UPDATE ni DELETE: la aplicación sube archivos
-- únicamente desde el servidor con service_role.

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
