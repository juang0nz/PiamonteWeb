type ImagenCategoria = {
  url: string;
  posicion?: string;
};

// Fotos ilustrativas de Piamonte; imagen_url del catálogo tiene prioridad.
export const imagenesCategorias: Record<string, ImagenCategoria> = {
  promos: { url: "/brand/categorias/promos.jpeg" },
  pizzeria: { url: "/brand/categorias/pizza.jpeg" },
  pizzetas: { url: "/brand/categorias/pizza1.jpeg" },
  calzone: { url: "/brand/categorias/calzone.jpeg" },
  especiales: { url: "/brand/categorias/especiales.jpeg" },
  "smash-burger": { url: "/brand/categorias/hamburguesa.jpeg" },
  chivitos: { url: "/brand/categorias/chivito.jpeg", posicion: "center 70%" },
  porciones: { url: "/brand/categorias/porciones.jpeg" },
  "fritas-salseadas": { url: "/brand/categorias/fritas-salseadas.jpeg" },
  tostados: { url: "/brand/categorias/sandwich.jpeg" },
  "milanesas-gourmet": { url: "/brand/categorias/milanesa.jpeg" },
  milanesas: { url: "/brand/categorias/milanesas1.jpeg" },
  picadas: { url: "/brand/categorias/picada.jpeg" },
  bebidas: { url: "/brand/categorias/bebida.jpeg" },
};
