## Resumen

<!-- Qué cambia y por qué, en dos o tres líneas. -->

## Ticket

PIA-

<!-- Si esta PR depende de otra todavía no mergeada, indicarlo: "Depende de #N". -->

## Cómo probar

1.
2.

## Checklist de seguridad

- [ ] ¿Toca autenticación, autorización, middleware o políticas RLS? Si sí, explicar qué y por qué.
- [ ] ¿Agrega o cambia variables de entorno? Si sí, están en `.env.example` y hay que cargarlas en Vercel.
- [ ] ¿Requiere ejecutar SQL en Supabase? Si sí, hay una migración nueva en `supabase/migrations/` (nunca se edita una existente).
- [ ] ¿Expone un endpoint nuevo o cambia uno existente? Si sí, valida sesión, origen y rol en el servidor.
- [ ] `npm run verificar` pasa en local.
