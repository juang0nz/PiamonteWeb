// Tipos genéricos del catálogo, independientes del comercio.

export type Comercio = {
  id: string;
  nombre: string;
  slug: string;
};

export type VarianteProducto = {
  id: string;
  nombre: string;
  precio: number;
  disponible: boolean;
};

export type Producto = {
  id: string;
  categoria_id: string;
  nombre: string;
  descripcion: string | null;
  imagen_url: string | null;
  tipo: string | null;
  precio_base: number | null;
  destacado: boolean;
  disponible: boolean;
  variantes: VarianteProducto[];
};

export type Categoria = {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  imagen_url: string | null;
  productos: Producto[];
};

export type Catalogo = {
  comercio: Comercio;
  categorias: Categoria[];
};

// Opci�n elegible dentro de un grupo (solo se consultan las disponibles).
export type Opcion = {
  id: string;
  nombre: string;
  precio_adicional: number;
};

// Grupo de opciones de un producto con sus l�mites generales.
export type GrupoOpciones = {
  id: string;
  nombre: string;
  minimo: number;
  maximo: number;
  obligatorio: boolean;
  opciones: Opcion[];
};

// Regla que reemplaza los l�mites de un grupo para una variante concreta.
export type ReglaOpcionVariante = {
  variante_id: string;
  grupo_id: string;
  minimo: number;
  maximo: number;
};

// Todo lo necesario para configurar un producto antes de agregarlo al carrito.
export type ConfiguracionProducto = {
  variantes: VarianteProducto[];
  grupos: GrupoOpciones[];
  reglas: ReglaOpcionVariante[];
};
