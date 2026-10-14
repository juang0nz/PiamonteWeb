begin;

-- La clave privada usa el rol service_role, pero estas tablas solo le permiten leer.
-- Se habilitan únicamente las operaciones necesarias para administrar esta configuración.
grant update on table public.productos to service_role;
grant insert, update, delete on table public.variantes_producto to service_role;

do $$
declare
  producto_promo_id uuid := '4443f27d-ee24-4988-b5db-7990fab114ab';
begin
  if not exists (
    select 1
    from public.productos
    where id = producto_promo_id
      and nombre = 'PROMO 10 · LEHMEYUN 6x5'
  ) then
    raise exception 'No se encontró la promo 10 de lehmayun esperada.';
  end if;

  update public.productos
  set precio_base = null
  where id = producto_promo_id;

  update public.variantes_producto
  set precio = 650,
      disponible = true,
      orden = 1
  where producto_id = producto_promo_id
    and nombre = 'Común';

  if not found then
    insert into public.variantes_producto (
      producto_id,
      nombre,
      precio,
      disponible,
      orden
    )
    values (
      producto_promo_id,
      'Común',
      650,
      true,
      1
    );
  end if;

  update public.variantes_producto
  set precio = 800,
      disponible = true,
      orden = 2
  where producto_id = producto_promo_id
    and nombre = 'Con muzza';

  if not found then
    insert into public.variantes_producto (
      producto_id,
      nombre,
      precio,
      disponible,
      orden
    )
    values (
      producto_promo_id,
      'Con muzza',
      800,
      true,
      2
    );
  end if;
end
$$;

commit;
