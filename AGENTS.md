<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
# Proyecto Plataforma Gastronómica

## Idioma

- Todo comentario escrito en el código debe estar en español.
- Toda documentación del proyecto debe estar en español.
- Los textos visibles para usuarios y administradores deben estar en español.
- Las explicaciones relevantes dentro del código deben estar en español.
- Mantener en inglés únicamente nombres técnicos, APIs, librerías y convenciones donde traducirlos perjudique la claridad o las buenas prácticas.

## Objetivo del proyecto

Este proyecto es una plataforma de pedidos online para comercios gastronómicos.

Piamonte es el primer comercio que utilizará la plataforma, pero la arquitectura NO debe construirse exclusivamente para Piamonte.

El objetivo es poder reutilizar el mismo sistema en el futuro para:
- pizzerías
- cafeterías
- hamburgueserías
- restaurantes
- otros comercios gastronómicos

La lógica del negocio debe ser genérica y configurable.

## Principio fundamental

Separar siempre:

1. La plataforma y su lógica.
2. La configuración e identidad visual de cada comercio.

No hardcodear lógica de negocio específica de Piamonte cuando pueda resolverse mediante configuración.

Por ejemplo, evitar estructuras específicas como:
- pizzaSize
- pizzaToppings
- milanesaType
- piamonteProduct

Preferir conceptos genéricos como:
- category
- product
- variant
- optionGroup
- option
- cart
- order

## Experiencia de usuario

La aplicación debe ser mobile-first y sentirse similar a una aplicación móvil moderna.

Para la primera versión:

- Home visual.
- Categorías con imágenes.
- Productos mostrados principalmente en formato lista.
- La imagen individual del producto debe ser opcional.
- Personalización de productos mediante modal o bottom sheet.
- Carrito siempre accesible.
- Checkout simple.
- Delivery y retiro.
- Diseño responsive para móvil y escritorio.

En escritorio se podrá aprovechar una estructura de:
- navegación/categorías a la izquierda
- contenido principal en el centro
- carrito a la derecha

## Identidad inicial de Piamonte

Piamonte será la primera implementación.

Su identidad visual utiliza principalmente:
- negro
- rojo
- blanco o crema
- tipografía fuerte y condensada
- fotografías gastronómicas de alto impacto

La identidad de Piamonte debe implementarse como configuración visual y no mezclarse con la lógica central de la plataforma.

## Arquitectura

Tecnologías principales:

- Next.js
- TypeScript
- Tailwind CSS
- Supabase
- Mercado Pago
- Vercel

La aplicación debe prepararse para incorporar en etapas posteriores:
- múltiples comercios
- configuración visual por comercio
- panel administrativo
- Meta Pixel y eventos de conversión
- integraciones con sistemas externos
- diferentes modos de visualización de productos

No implementar funcionalidades futuras antes de necesitarlas, pero evitar decisiones que impidan agregarlas posteriormente.

## Calidad del código

- Priorizar componentes reutilizables.
- Evitar duplicación innecesaria.
- Mantener responsabilidades claras.
- No agregar dependencias sin necesidad.
- No modificar arquitectura o configuración importante sin justificarlo.
- No implementar funcionalidades que no fueron solicitadas.
- Mantener TypeScript correctamente tipado.
- Mantener el proyecto compatible con la versión actual instalada de Next.js.
- Antes de utilizar APIs de Next.js cuya implementación pueda haber cambiado, consultar la documentación disponible en node_modules/next/dist/docs/.

## Forma de trabajo

Trabajar de forma incremental.

Para cada tarea:
1. Analizar la estructura existente.
2. Implementar únicamente el alcance solicitado.
3. Mantener compatibilidad con lo ya construido.
4. Ejecutar las verificaciones disponibles.
5. Informar claramente qué archivos fueron modificados.
6. Explicar brevemente en español qué se hizo.
7. Informar cualquier error, advertencia o decisión técnica relevante.

No realizar refactorizaciones grandes ni cambios fuera del alcance solicitado sin autorización.