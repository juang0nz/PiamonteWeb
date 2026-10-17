# Backlog

**Fuente de verdad: Jira, proyecto `PIA`** — https://correo-team-mnj7mx3n.atlassian.net/jira/software/projects/PIA

Los tickets `PIA-1` a `PIA-19` fueron creados el 2026-10-17 con la numeración de esta tabla,
que se conserva aquí solo como índice de lectura rápida. El estado vigente, las decisiones y
los comentarios viven en Jira; este archivo no se actualiza por cada cambio de estado.

El saneamiento inicial del repositorio (GitFlow, migraciones, pipeline DevSecOps) se hizo
antes de existir Jira bajo la etiqueta `PIA-0` (once ramas `feature/PIA-0-*`, ya integradas
en `develop`). No tiene ticket: Jira numera desde 1.

Origen funcional: documento *Tareas_PIAMONTE* (2026-10-14).

Estados: `hecho` · `pendiente` · `bloqueado (motivo)`.

## Hecho

| Ticket | Título | Estado |
| --- | --- | --- |
| PIA-0 | Saneamiento del repositorio, GitFlow, migraciones y pipeline DevSecOps (ver `docs/PIPELINE.md`) | hecho, en `develop` |

## Prerequisito técnico

| Ticket | Título | Dependencias | Estado |
| --- | --- | --- | --- |
| PIA-1 | Reconciliar el esquema de Supabase y preparar entorno de desarrollo: `supabase link`, `db pull` del esquema base (hoy no versionado), `migration repair` de lo ya aplicado, resolver `supabase/pendientes/`, y crear un proyecto Supabase de desarrollo separado de producción con datos de prueba | Acceso al proyecto Supabase del comercio | hecho (2026-10-17; `piamonte-dev` provisorio en organización personal) |

## Funcional (orden de implementación recomendado por el cliente)

| Ticket | Título (origen) | Prioridad | Dependencias | Estado |
| --- | --- | --- | --- | --- |
| PIA-2 | Gestión de demanda (normal/alta), tiempos estimados configurables por nivel y modalidad, tiempo congelado en cada pedido, y pausa de pedidos desde el panel (PIAM-02) | alta | PIA-1 | pendiente — definir minutos de cada nivel y si delivery suma traslado |
| PIA-3 | Modalidades de entrega y medios de pago reales: delivery+efectivo, delivery+tarjeta POS («Llevar POS»), retiro+pago en local; tarifa única de delivery administrable y desglosada en el total (PIAM-05) | alta | PIA-2 (configuración operativa del comercio) | pendiente |
| PIA-4 | Descuento automático para pedidos web, porcentual, configurable y activable desde el panel; se calcula sobre productos, no sobre envío; se conserva en el pedido (PIAM-08) | alta | PIA-3 (cálculo de totales) | pendiente — definir porcentaje inicial |
| PIA-5 | Zona de cobertura de delivery por perímetro: editor de polígono en el panel, geocodificación de la dirección, validación punto-en-polígono en el servidor (PostGIS), fallback para direcciones no localizables (PIAM-01) | alta | Perímetro definido por Fede; elección de proveedor de geocodificación y su costo | bloqueado (definición del cliente) |
| PIA-6 | Normalización de nombres y estructura del catálogo mediante migración de datos revisada en PR, sin alterar precios ni relaciones (PIAM-07) | media | PIA-1 | pendiente |
| PIA-7 | Productos fraccionables con toppings por porción (pizza de un metro en 4 porciones), cálculo de precio y detalle por porción en carrito, pedido y panel (PIAM-04) | media | Catálogo y variantes | pendiente — definir regla de cobro de adicionales |
| PIA-8 | Notificación automática por WhatsApp (Meta Cloud API) al aceptar un pedido, con tiempo estimado, estado por notificación, reintentos e idempotencia; token solo en servidor (PIAM-03) | alta | PIA-2; cuenta Meta Business, compatibilidad del número (Coexistence), plantilla aprobada, consentimiento del cliente | bloqueado (Meta) |
| PIA-9 | Promociones, descuentos y cupones administrables: porcentaje o monto fijo, alcance tienda/categoría/producto, vigencia, límite de usos, mínimos, prioridades y auditoría (PIAM-09) | media | PIA-4 (modelar el descuento web como caso particular de este modelo) | pendiente |
| PIA-10 | Relevamiento de DELYSOFT: funciones que conserva, datos a sincronizar, mecanismo de integración, documento de propuesta antes de desarrollar conectores (PIAM-06) | relevamiento | Conversación con el proveedor | bloqueado (proveedor) |
| PIA-19 | Cuentas de clientes: registro y acceso con email, "Mi cuenta" con pedidos en curso (tiempo real) e historial, direcciones guardadas; la compra sin cuenta sigue permitida. Recuperar como base el código retirado en `34f588e` y el SQL de `supabase/pendientes/` | alta | PIA-1, PIA-2; antes de PIA-4 | pendiente |

## Infraestructura y seguridad (derivados de PIA-0)

| Ticket | Título | Dependencias | Estado |
| --- | --- | --- | --- |
| PIA-11 | Activar protección de ramas `develop` y `main` según `docs/FLUJO-GIT.md` | Primera ejecución de los workflows | pendiente |
| PIA-12 | Configurar Vercel: Root Directory vacío, variables por entorno, alias estable de `develop`; retirar variables `MERCADO_PAGO_*` | Acceso a Vercel | pendiente |
| PIA-13 | Rate limiting en `/api/pedidos/registrar` (Vercel WAF o `@upstash/ratelimit`) | PIA-12 | pendiente |
| PIA-14 | DAST con OWASP ZAP baseline contra la URL de Preview, job no bloqueante | PIA-12 | pendiente |
| PIA-15 | Pasar la CSP de `Report-Only` a bloqueante tras validar en Preview | PIA-12, PIA-8 (si WhatsApp agrega orígenes) | pendiente |
| PIA-16 | Migrar los tests al runner nativo (`tsx`/`vitest`) y retirar el loader basado en `vm` | — | pendiente |
| PIA-17 | Observabilidad: logs estructurados JSON en route handlers y endpoint `/api/salud` | — | pendiente |
| PIA-18 | Dockerfile multi-stage + `release.yml` con `trivy image` y Cosign — **solo si el proyecto deja Vercel** | Decisión de hosting | pendiente (condicional) |

## Reglas transversales (del documento del cliente)

Multi-comercio por configuración; precios, descuentos, envío y permisos validados en el
servidor; los pedidos conservan los importes y condiciones con que se confirmaron; la
configuración comercial queda restringida a roles autorizados; no romper checkout,
registro de pedidos ni panel; inspeccionar y reutilizar lo existente antes de crear
estructuras nuevas; probar casos normales, de error y límite antes de avanzar.
