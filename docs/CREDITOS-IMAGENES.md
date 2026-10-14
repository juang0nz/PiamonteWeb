# Fotos de las categorías y créditos de imágenes


Las tarjetas de inicio usan fotos ilustrativas locales en `public/brand/categorias`.
Estas fotos son de ejemplo: no representan necesariamente los productos del local.

Para reemplazarlas por fotos reales:

- Cargar la ruta pública o URL de la foto en `categorias.imagen_url` en Supabase.
  Este valor tiene prioridad sobre la imagen de ejemplo.
- O agregar la foto a `public/brand/categorias` y cambiar la entrada correspondiente
  en `src/lib/comercio/imagenesCategorias.ts`, usando una ruta como
  `/brand/categorias/chivito-real.jpeg`. La clave de cada entrada es el slug de la categoría.
- El campo opcional `posicion` permite ajustar el encuadre de una imagen local,
  por ejemplo `"center 65%"`. Las tarjetas mantienen las proporciones sin deformar las fotos.

Las categorías nuevas sin fotos conservan un fondo decorativo. No se modifican
los productos ni la estructura de la base de datos.

### Créditos de las fotos ilustrativas

Las imágenes se descargaron en tamaño reducido; las tarjetas recortan su encuadre.
Las fotos de Wikimedia Commons mantienen la licencia indicada:

| Archivo | Autor y fuente | Licencia |
| --- | --- | --- |
| `calzone.jpeg` | [TELLURIDE 749](https://commons.wikimedia.org/wiki/File:Calzone_01.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `picada.jpeg` | [Joli Rumi](https://commons.wikimedia.org/wiki/File:A_charcuterie_board_with_cheese_and_crackers.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `milanesa.jpeg` | [Kritzolina](https://commons.wikimedia.org/wiki/File:Allg%C3%A4uer_Schnitzel_mit_Kr%C3%A4uterr%C3%B6sti.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `chivito.jpeg` | [Gnangcomapp](https://commons.wikimedia.org/wiki/File:Steak_Sanga_gn.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| `fritas-salseadas.jpeg` | [Andy Li](https://commons.wikimedia.org/wiki/File:Vegan_BBQ_Boss_Loaded_Waffle_Fries_-_Brewhouse_%26_Kitchen,_Worthing_2026-06-08.jpg) | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |

Las demás imágenes de ejemplo provienen de Unsplash, bajo su
[licencia](https://unsplash.com/license):

- [Pizza](https://images.unsplash.com/photo-1513104890138-7c749659a591).
- [Pizzeta](https://images.unsplash.com/photo-1579751626657-72bc17010498).
- [Hamburguesa](https://images.unsplash.com/photo-1568901346375-23c9450c58cd).
- [Sándwich](https://images.unsplash.com/photo-1528735602780-2552fd46c7af).
- [Fritas](https://images.unsplash.com/photo-1573080496219-bb080dd4f877).
- [Especiales](https://images.unsplash.com/photo-1562967914-608f82629710).
- [Bebida](https://images.unsplash.com/photo-1622483767028-3f66f32aef97).
