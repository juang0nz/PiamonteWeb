# Backlog (numeración provisoria `PIA-n`)

Mientras no exista el proyecto en Jira, este archivo es la fuente de los números de
ticket que se usan en ramas, commits y PRs (`feature/PIA-3-costo-delivery`,
`PIA-3: ...`). Al crear el proyecto en Jira con clave `PIA`, importar estos tickets
conservando la numeración. Origen funcional: documento *Tareas_PIAMONTE* (2026-10-14);
ninguna de esas tareas tiene implementación en el código (verificado: solo existen
precursores fijos como el texto "radio de 3 km", `tiemposEntrega` estático, el enlace
manual `wa.me` y la categoría `promos`).

Estados: `hecho` · `pendiente` · `bloqueado (motivo)`.

## Hecho

| Ticket | Título | Estado |
| --- | --- | --- |
| PIA-0 | Saneamiento del repositorio, GitFlow, migraciones y pipeline DevSecOps (10 ramas `feature/PIA-0-*`, ver `docs/PIPELINE.md`) | hecho, pendiente de merge a `develop` |

## Prerequisito técnico

| Ticket | Título | Dependencias | Estado |
| --- | --- | --- | --- |
| PIA-1 | Reconciliar el esquema de Supabase y preparar entorno de desarrollo: `supabase link`, `db pull` del esquema base (hoy no versionado), `migration repair` de lo ya aplicado, resolver `supabase/pendientes/`, y crear un proyecto Supabase de desarrollo separado de producción con datos de prueba | Acceso al proyecto Supabase del comercio | pendiente |

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
