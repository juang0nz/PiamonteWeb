"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { SelectorImagenAdmin } from "@/components/admin/SelectorImagenAdmin";

type VarianteAdmin = {
  id: string;
  nombre: string;
  precio: number;
  disponible: boolean;
  orden: number;
};

type ProductoAdmin = {
  id: string;
  categoria_id: string;
  nombre: string;
  descripcion: string | null;
  imagen_url: string | null;
  tipo: string;
  precio_base: number | null;
  activo: boolean;
  disponible: boolean;
  destacado: boolean;
  orden: number;
  variantes: VarianteAdmin[];
};

type CategoriaAdmin = {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  imagen_url: string | null;
  orden: number;
  activa: boolean;
  productos: ProductoAdmin[];
};

type RespuestaCatalogo = {
  categorias?: CategoriaAdmin[];
  categoria?: Omit<CategoriaAdmin, "productos">;
  error?: string;
};

type EditorCatalogo =
  | { tipo: "nuevo-producto" }
  | { tipo: "nueva-categoria" }
  | { tipo: "editar-producto"; producto: ProductoAdmin }
  | { tipo: "editar-categoria"; categoria: CategoriaAdmin };

function valorTexto(datos: FormData, campo: string) {
  return String(datos.get(campo) ?? "").trim();
}

function valorPrecio(datos: FormData, campo: string) {
  const valor = valorTexto(datos, campo);
  return valor === "" ? null : Number(valor);
}

const CLASE_CAMPO =
  "mt-1.5 w-full rounded-xl border border-negro/15 bg-white px-3 py-2 text-sm text-negro focus:border-rojo focus:outline-none focus:ring-2 focus:ring-rojo/20";

export function PanelCatalogoAdmin({
  esSuperAdmin: _esSuperAdmin,
}: {
  esSuperAdmin?: boolean;
}) {
  void _esSuperAdmin;
  const [categorias, setCategorias] = useState<CategoriaAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [vista, setVista] = useState<"productos" | "categorias">("productos");
  const [menuAgregarAbierto, setMenuAgregarAbierto] = useState(false);
  const [editor, setEditor] = useState<EditorCatalogo | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const respuesta = await fetch("/api/admin/catalogo", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const cuerpo = (await respuesta.json().catch(() => null)) as
        | RespuestaCatalogo
        | null;
      if (!respuesta.ok) {
        throw new Error(cuerpo?.error ?? "No pudimos cargar el catálogo.");
      }
      setCategorias(cuerpo?.categorias ?? []);
    } catch (errorDesconocido) {
      setError(
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : "No pudimos cargar el catálogo.",
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    const temporizador = window.setTimeout(() => void cargar(), 0);
    return () => window.clearTimeout(temporizador);
  }, [cargar]);

  async function guardar(
    metodo: "POST" | "PATCH",
    payload: Record<string, unknown>,
    confirmacion: string,
  ) {
    if (guardando) return false;
    setGuardando(true);
    setError(null);
    setMensaje(null);
    try {
      const respuesta = await fetch("/api/admin/catalogo", {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          ...payload,
          operacionId: crypto.randomUUID(),
        }),
      });
      const cuerpo = (await respuesta.json().catch(() => null)) as
        | RespuestaCatalogo
        | null;
      if (!respuesta.ok) {
        throw new Error(cuerpo?.error ?? "No pudimos guardar los cambios.");
      }

      await cargar();
      setMensaje(confirmacion);
      return true;
    } catch (errorDesconocido) {
      setError(
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : "No pudimos guardar los cambios.",
      );
      return false;
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(
    tipo: "categoria" | "producto",
    id: string,
    nombre: string,
    productosIncluidos = 0,
  ) {
    if (guardando) return;
    const etiqueta = tipo === "categoria" ? "la categoría" : "el producto";
    // Al eliminar una categoría se avisa que arrastra sus productos vigentes,
    // para que la única confirmación describa el alcance real de la acción.
    const alcance =
      tipo === "categoria" && productosIncluidos > 0
        ? `También se eliminarán sus ${productosIncluidos} ` +
          `${productosIncluidos === 1 ? "producto" : "productos"}. `
        : "";
    const confirmado = window.confirm(
      `¿Eliminar completamente ${etiqueta} "${nombre}"?\n\n` +
        alcance +
        "Dejará de aparecer en el panel y en el catálogo. " +
        "Los pedidos anteriores conservan su historial.",
    );
    if (!confirmado) return;

    setGuardando(true);
    setError(null);
    setMensaje(null);
    try {
      const respuesta = await fetch("/api/admin/catalogo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          tipo,
          id,
          operacionId: crypto.randomUUID(),
        }),
      });
      const cuerpo = (await respuesta.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!respuesta.ok) {
        throw new Error(cuerpo?.error ?? "No pudimos eliminar el registro.");
      }
      await cargar();
      setMensaje(
        `${nombre} se eliminó del panel y del catálogo. El historial de pedidos se conserva.`,
      );
    } catch (errorDesconocido) {
      setError(
        errorDesconocido instanceof Error
          ? errorDesconocido.message
          : "No pudimos eliminar el registro.",
      );
    } finally {
      setGuardando(false);
    }
  }

  const termino = busqueda.trim().toLocaleLowerCase("es");
  const categoriasActivas = categorias.filter((categoria) => categoria.activa);
  const categoriasVisibles = categorias;

  const productosVisibles = categorias
    .flatMap((categoria) =>
      categoria.productos.map((producto) => ({
        ...producto,
        categoriaNombre: categoria.nombre,
      })),
    )
    .filter((producto) => {
      if (!termino) return true;
      return (
        producto.nombre.toLocaleLowerCase("es").includes(termino) ||
        producto.categoriaNombre.toLocaleLowerCase("es").includes(termino) ||
        producto.variantes.some((variante) =>
          variante.nombre.toLocaleLowerCase("es").includes(termino),
        )
      );
    });
  // El selector ofrece categorías activas, pero conserva la categoría actual del
  // producto aunque esté inactiva para no reasignarlo sin querer al guardar.
  const categoriasParaEditar = (producto: ProductoAdmin) => {
    const actual = categorias.find(
      (categoria) => categoria.id === producto.categoria_id,
    );
    return actual && !actual.activa
      ? [...categoriasActivas, actual]
      : categoriasActivas;
  };

  const editorActual: EditorCatalogo | null =
    editor?.tipo === "editar-producto"
      ? {
          tipo: "editar-producto",
          producto:
            categorias
              .flatMap((categoria) => categoria.productos)
              .find((producto) => producto.id === editor.producto.id) ??
            editor.producto,
        }
      : editor?.tipo === "editar-categoria"
        ? {
            tipo: "editar-categoria",
            categoria:
              categorias.find(
                (categoria) => categoria.id === editor.categoria.id,
              ) ?? editor.categoria,
          }
        : editor;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-negro/10 bg-white p-5 shadow-[0_20px_45px_rgba(0,0,0,0.08)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-rojo">
              Administración
            </p>
            <h2 className="mt-1 font-titulos text-3xl uppercase tracking-wide text-negro">
              Catálogo
            </h2>
          </div>

          <div className="relative self-start md:self-auto">
            <button
              type="button"
              onClick={() => setMenuAgregarAbierto((actual) => !actual)}
              aria-expanded={menuAgregarAbierto}
              aria-haspopup="menu"
              className="rounded-full bg-rojo px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-rojo/20 transition hover:bg-negro"
            >
              + Agregar
            </button>
            {menuAgregarAbierto && (
              <div
                role="menu"
                className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-2xl border border-negro/10 bg-white shadow-xl"
              >
                <button
                  type="button"
                  onClick={() => {
                    setEditor({ tipo: "nuevo-producto" });
                    setMenuAgregarAbierto(false);
                  }}
                  className="block w-full border-b border-negro/10 px-4 py-3 text-left text-sm font-medium text-negro transition hover:bg-fondo"
                >
                  Nuevo producto
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditor({ tipo: "nueva-categoria" });
                    setMenuAgregarAbierto(false);
                  }}
                  className="block w-full px-4 py-3 text-left text-sm font-medium text-negro transition hover:bg-fondo"
                >
                  Nueva categoría
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 flex w-full rounded-full bg-fondo p-1">
          <button
            type="button"
            onClick={() => setVista("productos")}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
              vista === "productos"
                ? "bg-negro text-white shadow-sm"
                : "text-negro/70 hover:text-negro"
            }`}
          >
            Productos
          </button>
          <button
            type="button"
            onClick={() => setVista("categorias")}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition ${
              vista === "categorias"
                ? "bg-negro text-white shadow-sm"
                : "text-negro/70 hover:text-negro"
            }`}
          >
            Categorías
          </button>
        </div>

      </section>

      <section className="rounded-3xl border border-negro/10 bg-white p-5 shadow-[0_20px_45px_rgba(0,0,0,0.08)]">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-rojo">
              Gestión
            </p>
            <h2 className="mt-1 font-titulos text-2xl uppercase tracking-wide text-negro">
              {vista === "productos" ? "Productos" : "Categorías"}
            </h2>
          </div>
          <p className="text-sm text-negro/60">
            Los registros se desactivan sin borrar el historial de pedidos.
          </p>
        </div>

        {vista === "productos" && (
          <input
            type="search"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Buscar productos, categorías o variantes"
            aria-label="Buscar productos"
            className="mt-4 w-full rounded-2xl border border-negro/15 bg-fondo px-4 py-2.5 text-sm text-negro placeholder:text-negro/45 focus:border-rojo focus:outline-none focus:ring-2 focus:ring-rojo/20"
          />
        )}

        {mensaje && (
          <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {mensaje}
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-xl bg-rojo/10 px-4 py-3 text-sm text-rojo">
            {error}
          </p>
        )}

        {cargando ? (
          <p className="mt-5 text-sm text-negro/60">Cargando catálogo…</p>
        ) : vista === "productos" ? (
          productosVisibles.length === 0 ? (
            <p className="mt-5 rounded-xl bg-fondo px-4 py-3 text-sm text-negro/60">
              No se encontraron productos.
            </p>
          ) : (
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {productosVisibles.map((producto) => (
                <TarjetaProductoAdmin
                  key={producto.id}
                  producto={producto}
                  guardando={guardando}
                  editar={() =>
                    setEditor({ tipo: "editar-producto", producto })
                  }
                  eliminar={eliminar}
                />
              ))}
            </div>
          )
        ) : categoriasVisibles.length === 0 ? (
          <p className="mt-5 rounded-xl bg-fondo px-4 py-3 text-sm text-negro/60">
            No se encontraron categorías.
          </p>
        ) : (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {categoriasVisibles.map((categoria) => (
              <TarjetaCategoriaAdmin
                key={categoria.id}
                categoria={categoria}
                guardando={guardando}
                editar={() =>
                  setEditor({ tipo: "editar-categoria", categoria })
                }
                eliminar={eliminar}
              />
            ))}
          </div>
        )}
      </section>

      {editorActual && (
        <PanelLateralCatalogo
          titulo={
            editorActual.tipo === "nuevo-producto"
              ? "Nuevo producto"
              : editorActual.tipo === "nueva-categoria"
                ? "Nueva categoría"
                : editorActual.tipo === "editar-producto"
                  ? `Editar ${editorActual.producto.nombre}`
                  : `Editar ${editorActual.categoria.nombre}`
          }
          cerrar={() => setEditor(null)}
        >
          {editorActual.tipo === "nuevo-producto" ? (
            <FormularioNuevoProducto
              categorias={categoriasActivas}
              guardando={guardando}
              guardar={guardar}
              cerrar={() => setEditor(null)}
            />
          ) : editorActual.tipo === "nueva-categoria" ? (
            <FormularioNuevaCategoria
              guardando={guardando}
              guardar={guardar}
              cerrar={() => setEditor(null)}
            />
          ) : editorActual.tipo === "editar-producto" ? (
            <ProductoEditable
              key={`${editorActual.producto.id}:${editorActual.producto.imagen_url ?? ""}`}
              producto={editorActual.producto}
              categorias={categoriasParaEditar(editorActual.producto)}
              guardando={guardando}
              guardar={guardar}
              cerrar={() => setEditor(null)}
            />
          ) : (
            <CategoriaEditable
              key={`${editorActual.categoria.id}:${editorActual.categoria.imagen_url ?? ""}`}
              categoria={editorActual.categoria}
              guardando={guardando}
              guardar={guardar}
              cerrar={() => setEditor(null)}
            />
          )}
        </PanelLateralCatalogo>
      )}
    </div>
  );
}

function PanelLateralCatalogo({
  titulo,
  cerrar,
  children,
}: {
  titulo: string;
  cerrar: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const cerrarConEscape = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") cerrar();
    };
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", cerrarConEscape);
    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", cerrarConEscape);
    };
  }, [cerrar]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      className="fixed inset-0 z-50 flex justify-end bg-negro/55"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) cerrar();
      }}
    >
      <aside className="flex h-full w-full max-w-xl flex-col bg-fondo shadow-2xl">
        <header className="flex items-center justify-between gap-4 border-b border-negro/10 bg-white px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-rojo">
              Catálogo
            </p>
            <h3 className="font-titulos text-2xl uppercase tracking-wide text-negro">
              {titulo}
            </h3>
          </div>
          <button
            type="button"
            onClick={cerrar}
            className="flex size-10 items-center justify-center rounded-full border border-negro/15 text-xl text-negro transition hover:border-rojo hover:text-rojo"
            aria-label="Cerrar panel"
          >
            ×
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </div>
      </aside>
    </div>
  );
}

function MiniaturaCatalogo({
  imagenUrl,
  nombre,
}: {
  imagenUrl: string | null;
  nombre: string;
}) {
  return imagenUrl ? (
    // Las imágenes pueden provenir de Storage o de URLs existentes del catálogo.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imagenUrl}
      alt=""
      className="size-20 shrink-0 rounded-2xl border border-negro/10 object-cover"
    />
  ) : (
    <div
      aria-label={`${nombre} no tiene imagen`}
      className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-negro/5 text-2xl text-negro/30"
    >
      ◇
    </div>
  );
}

function TarjetaProductoAdmin({
  producto,
  guardando,
  editar,
  eliminar,
}: {
  producto: ProductoAdmin & { categoriaNombre: string };
  guardando: boolean;
  editar: () => void;
  eliminar: (
    tipo: "categoria" | "producto",
    id: string,
    nombre: string,
  ) => Promise<void>;
}) {
  return (
    <article className="flex min-w-0 gap-3 rounded-2xl border border-negro/10 bg-fondo/45 p-3">
      <MiniaturaCatalogo
        imagenUrl={producto.imagen_url}
        nombre={producto.nombre}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="truncate font-semibold text-negro">{producto.nombre}</p>
        <p className="truncate text-xs text-negro/55">
          {producto.categoriaNombre}
        </p>
        <p className="mt-1 text-sm font-semibold text-rojo">
          {producto.precio_base === null
            ? `${producto.variantes.length} variantes`
            : `$ ${producto.precio_base}`}
        </p>
        <span
          className={`mt-1 self-start rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
            producto.disponible
              ? "bg-emerald-100 text-emerald-700"
              : "bg-rojo/10 text-rojo"
          }`}
        >
          {producto.disponible ? "Disponible" : "Agotado"}
        </span>
        <div className="mt-auto flex flex-wrap gap-2 pt-3">
          <button
            type="button"
            onClick={editar}
            className="rounded-full bg-negro px-3 py-1.5 text-xs font-semibold text-white hover:bg-rojo"
          >
            Editar
          </button>
          <button
            type="button"
            disabled={guardando}
            onClick={() =>
              void eliminar("producto", producto.id, producto.nombre)
            }
            className="rounded-full border border-rojo px-3 py-1.5 text-xs font-semibold text-rojo hover:bg-rojo hover:text-white disabled:opacity-45"
          >
            Eliminar
          </button>
        </div>
      </div>
    </article>
  );
}

function TarjetaCategoriaAdmin({
  categoria,
  guardando,
  editar,
  eliminar,
}: {
  categoria: CategoriaAdmin;
  guardando: boolean;
  editar: () => void;
  eliminar: (
    tipo: "categoria" | "producto",
    id: string,
    nombre: string,
    productosIncluidos?: number,
  ) => Promise<void>;
}) {
  const productosEnCategoria = categoria.productos.length;

  return (
    <article className="flex min-w-0 gap-3 rounded-2xl border border-negro/10 bg-fondo/45 p-3">
      <MiniaturaCatalogo
        imagenUrl={categoria.imagen_url}
        nombre={categoria.nombre}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="truncate font-semibold text-negro">{categoria.nombre}</p>
        <p className="text-xs text-negro/55">
          {productosEnCategoria}{" "}
          {productosEnCategoria === 1 ? "producto" : "productos"}
        </p>
        <span
          className={`mt-1 self-start rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
            categoria.activa
              ? "bg-emerald-100 text-emerald-700"
              : "bg-rojo/10 text-rojo"
          }`}
        >
          {categoria.activa ? "Activa" : "Inactiva"}
        </span>
        <div className="mt-auto flex flex-wrap gap-2 pt-3">
          <button
            type="button"
            onClick={editar}
            className="rounded-full bg-negro px-3 py-1.5 text-xs font-semibold text-white hover:bg-rojo"
          >
            Editar
          </button>
          <button
            type="button"
            disabled={guardando}
            onClick={() =>
              void eliminar(
                "categoria",
                categoria.id,
                categoria.nombre,
                productosEnCategoria,
              )
            }
            className="rounded-full border border-rojo px-3 py-1.5 text-xs font-semibold text-rojo hover:bg-rojo hover:text-white disabled:opacity-45"
          >
            Eliminar
          </button>
        </div>
      </div>
    </article>
  );
}

function FormularioNuevaCategoria({
  guardando,
  guardar,
  cerrar,
}: {
  guardando: boolean;
  cerrar: () => void;
  guardar: (
    metodo: "POST",
    payload: Record<string, unknown>,
    confirmacion: string,
  ) => Promise<boolean>;
}) {
  const [imagenUrl, setImagenUrl] = useState("");
  const [subiendoImagen, setSubiendoImagen] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (subiendoImagen) return;
    const formulario = evento.currentTarget;
    const datos = new FormData(formulario);
    const ok = await guardar(
      "POST",
      {
        tipo: "categoria",
        nombre: valorTexto(datos, "nombre"),
        descripcion: valorTexto(datos, "descripcion"),
        imagenUrl,
      },
      "Categoría creada correctamente.",
    );
    if (ok) {
      formulario.reset();
      setImagenUrl("");
      cerrar();
    }
  }

  return (
    <form onSubmit={enviar} className="rounded-2xl border border-negro/10 bg-white p-4">
      <Campo nombre="nombre" etiqueta="Nombre" requerido />
      <Campo nombre="descripcion" etiqueta="Descripción" />
      <SelectorImagenAdmin
        value={imagenUrl}
        onChange={setImagenUrl}
        onUploadingChange={setSubiendoImagen}
        disabled={guardando}
        label="Imagen de la categoría"
        placeholder="URL o subir una imagen desde tu dispositivo"
        altText="Vista previa de la categoría"
        destino="categorias"
      />
      <BotonGuardar guardando={guardando} bloqueado={subiendoImagen}>
        {subiendoImagen ? "Subiendo imagen…" : "Crear categoría"}
      </BotonGuardar>
    </form>
  );
}

function FormularioNuevoProducto({
  categorias,
  guardando,
  guardar,
  cerrar,
}: {
  categorias: CategoriaAdmin[];
  guardando: boolean;
  cerrar: () => void;
  guardar: (
    metodo: "POST",
    payload: Record<string, unknown>,
    confirmacion: string,
  ) => Promise<boolean>;
}) {
  const [imagenUrl, setImagenUrl] = useState("");
  const [subiendoImagen, setSubiendoImagen] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (subiendoImagen) return;
    const formulario = evento.currentTarget;
    const datos = new FormData(formulario);
    const ok = await guardar(
      "POST",
      {
        tipo: "producto",
        categoriaId: valorTexto(datos, "categoriaId"),
        nombre: valorTexto(datos, "nombre"),
        descripcion: valorTexto(datos, "descripcion"),
        imagenUrl,
        precioBase: valorPrecio(datos, "precioBase"),
      },
      "Producto creado correctamente.",
    );
    if (ok) {
      formulario.reset();
      setImagenUrl("");
      cerrar();
    }
  }

  return (
    <form onSubmit={enviar} className="rounded-2xl border border-negro/10 bg-white p-4">
      <label className="mt-3 block text-sm font-semibold text-negro">
        Categoría
        <select name="categoriaId" required className={CLASE_CAMPO}>
          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nombre}
              {categoria.activa ? "" : " (inactiva)"}
            </option>
          ))}
        </select>
      </label>
      <Campo nombre="nombre" etiqueta="Nombre" requerido />
      <Campo nombre="descripcion" etiqueta="Descripción" />
      <SelectorImagenAdmin
        value={imagenUrl}
        onChange={setImagenUrl}
        onUploadingChange={setSubiendoImagen}
        disabled={guardando}
      />
      <Campo
        nombre="precioBase"
        etiqueta="Precio base"
        tipo="number"
        paso="0.01"
      />
      <BotonGuardar
        guardando={guardando}
        bloqueado={subiendoImagen || categorias.length === 0}
        textoBloqueado={
          subiendoImagen ? "Subiendo imagen…" : "No hay categorías activas"
        }
      >
        Crear producto
      </BotonGuardar>
    </form>
  );
}

function CategoriaEditable({
  categoria,
  guardando,
  guardar,
  cerrar,
}: {
  categoria: CategoriaAdmin;
  guardando: boolean;
  cerrar: () => void;
  guardar: (
    metodo: "PATCH" | "POST",
    payload: Record<string, unknown>,
    confirmacion: string,
  ) => Promise<boolean>;
}) {
  const [imagenUrl, setImagenUrl] = useState(categoria.imagen_url ?? "");
  const [subiendoImagen, setSubiendoImagen] = useState(false);

  async function guardarCategoria(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (subiendoImagen) return;
    const datos = new FormData(evento.currentTarget);
    const ok = await guardar(
      "PATCH",
      {
        tipo: "categoria",
        id: categoria.id,
        nombre: valorTexto(datos, "nombre"),
        descripcion: valorTexto(datos, "descripcion"),
        imagenUrl,
        activa: datos.get("activa") === "on",
      },
      "Categoría actualizada.",
    );
    if (ok) cerrar();
  }

  return (
    <form
      onSubmit={guardarCategoria}
      className="grid gap-3 rounded-2xl border border-negro/10 bg-white p-4"
    >
      <Campo
        nombre="nombre"
        etiqueta="Nombre de categoría"
        valor={categoria.nombre}
        requerido
      />
      <SelectorImagenAdmin
        value={imagenUrl}
        onChange={setImagenUrl}
        onUploadingChange={setSubiendoImagen}
        disabled={guardando}
        label="Imagen de la categoría"
        placeholder="URL o subir una imagen desde tu dispositivo"
        altText="Vista previa de la categoría"
        destino="categorias"
      />
      <label className="block text-sm font-semibold text-negro">
        Descripción
        <textarea
          name="descripcion"
          defaultValue={categoria.descripcion ?? ""}
          rows={3}
          className={CLASE_CAMPO}
        />
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold text-negro">
        <input
          type="checkbox"
          name="activa"
          defaultChecked={categoria.activa}
          className="size-4 accent-rojo"
        />
        Categoría activa
      </label>
      <button
        type="submit"
        disabled={guardando || subiendoImagen}
        className="rounded-full bg-negro px-4 py-2.5 text-sm font-semibold text-white hover:bg-rojo disabled:opacity-45"
      >
        {subiendoImagen ? "Subiendo imagen…" : "Guardar categoría"}
      </button>
    </form>
  );
}

function ProductoEditable({
  producto,
  categorias,
  guardando,
  guardar,
  cerrar,
}: {
  producto: ProductoAdmin;
  categorias: CategoriaAdmin[];
  guardando: boolean;
  cerrar: () => void;
  guardar: (
    metodo: "PATCH" | "POST",
    payload: Record<string, unknown>,
    confirmacion: string,
  ) => Promise<boolean>;
}) {
  const [imagenUrl, setImagenUrl] = useState(producto.imagen_url ?? "");
  const [subiendoImagen, setSubiendoImagen] = useState(false);

  async function guardarProducto(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (subiendoImagen) return;
    const datos = new FormData(evento.currentTarget);
    const ok = await guardar(
      "PATCH",
      {
        tipo: "producto",
        id: producto.id,
        categoriaId: valorTexto(datos, "categoriaId"),
        nombre: valorTexto(datos, "nombre"),
        descripcion: valorTexto(datos, "descripcion"),
        imagenUrl,
        precioBase: valorPrecio(datos, "precioBase"),
        disponible: datos.get("disponible") === "on",
        destacado: datos.get("destacado") === "on",
      },
      "Producto actualizado.",
    );
    if (ok) cerrar();
  }

  async function agregarVariante(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const datos = new FormData(formulario);
    const ok = await guardar(
      "POST",
      {
        tipo: "variante",
        productoId: producto.id,
        nombre: valorTexto(datos, "nombre"),
        precio: valorPrecio(datos, "precio"),
      },
      "Variante creada.",
    );
    if (ok) formulario.reset();
  }

  return (
    <div className="space-y-4">
        <form
          onSubmit={guardarProducto}
          className="grid gap-3 rounded-2xl border border-negro/10 bg-white p-4 sm:grid-cols-2"
        >
          <Campo
            nombre="nombre"
            etiqueta="Nombre"
            valor={producto.nombre}
            requerido
          />
          <label className="block text-sm font-semibold text-negro">
            Categoría
            <select
              name="categoriaId"
              defaultValue={producto.categoria_id}
              required
              className={CLASE_CAMPO}
            >
              {categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nombre}
                  {categoria.activa ? "" : " (inactiva)"}
                </option>
              ))}
            </select>
          </label>
          <SelectorImagenAdmin
            value={imagenUrl}
            onChange={setImagenUrl}
            onUploadingChange={setSubiendoImagen}
            disabled={guardando}
          />
          <Campo
            nombre="precioBase"
            etiqueta="Precio base (vacío si usa variantes)"
            tipo="number"
            paso="0.01"
            valor={producto.precio_base ?? ""}
          />
          <label className="block text-sm font-semibold text-negro md:col-span-2">
            Descripción
            <textarea
              name="descripcion"
              defaultValue={producto.descripcion ?? ""}
              rows={2}
              className={CLASE_CAMPO}
            />
          </label>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-negro">
              <input
                type="checkbox"
                name="disponible"
                defaultChecked={producto.disponible}
                className="size-4 accent-rojo"
              />
              Producto activo
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-negro">
              <input
                type="checkbox"
                name="destacado"
                defaultChecked={producto.destacado}
                className="size-4 accent-rojo"
              />
              Destacado
            </label>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="submit"
              disabled={guardando || subiendoImagen}
              className="rounded-full bg-negro px-4 py-2 text-sm font-semibold text-white hover:bg-rojo disabled:opacity-45"
            >
              {subiendoImagen ? "Subiendo imagen…" : "Guardar producto"}
            </button>
          </div>
        </form>

        <div className="border-t border-negro/10 pt-4">
          <h4 className="font-semibold text-negro">Variantes y precios</h4>
          {producto.variantes.length > 0 && (
            <div className="mt-3 space-y-2">
              {producto.variantes.map((variante) => (
                <VarianteEditable
                  key={variante.id}
                  variante={variante}
                  guardando={guardando}
                  guardar={guardar}
                />
              ))}
            </div>
          )}
          <form
            onSubmit={agregarVariante}
            className="mt-3 grid gap-2 rounded-xl bg-fondo p-3 sm:grid-cols-[1fr_10rem_auto]"
          >
            <input
              name="nombre"
              required
              maxLength={120}
              placeholder="Nueva variante"
              aria-label="Nombre de nueva variante"
              className="rounded-xl border border-negro/15 bg-white px-3 py-2 text-sm"
            />
            <input
              name="precio"
              type="number"
              min="0"
              max="10000000"
              step="0.01"
              required
              placeholder="Precio"
              aria-label="Precio de nueva variante"
              className="rounded-xl border border-negro/15 bg-white px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={guardando}
              className="rounded-full bg-rojo px-4 py-2 text-sm font-semibold text-white hover:bg-negro disabled:opacity-45"
            >
              Agregar
            </button>
          </form>
        </div>
    </div>
  );
}

function VarianteEditable({
  variante,
  guardando,
  guardar,
}: {
  variante: VarianteAdmin;
  guardando: boolean;
  guardar: (
    metodo: "PATCH",
    payload: Record<string, unknown>,
    confirmacion: string,
  ) => Promise<boolean>;
}) {
  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    await guardar(
      "PATCH",
      {
        tipo: "variante",
        id: variante.id,
        nombre: valorTexto(datos, "nombre"),
        precio: valorPrecio(datos, "precio"),
        disponible: datos.get("disponible") === "on",
      },
      "Variante actualizada.",
    );
  }

  return (
    <form
      onSubmit={enviar}
      className="grid gap-2 rounded-xl border border-negro/10 p-3 sm:grid-cols-[1fr_9rem_auto_auto] sm:items-end"
    >
      <Campo nombre="nombre" etiqueta="Nombre" valor={variante.nombre} requerido />
      <Campo
        nombre="precio"
        etiqueta="Precio"
        tipo="number"
        paso="0.01"
        valor={variante.precio}
        requerido
      />
      <label className="flex items-center gap-2 pb-2 text-sm font-semibold text-negro">
        <input
          type="checkbox"
          name="disponible"
          defaultChecked={variante.disponible}
          className="size-4 accent-rojo"
        />
        Disponible
      </label>
      <button
        type="submit"
        disabled={guardando}
        className="rounded-full bg-negro px-4 py-2 text-sm font-semibold text-white hover:bg-rojo disabled:opacity-45"
      >
        Guardar
      </button>
    </form>
  );
}

function Campo({
  nombre,
  etiqueta,
  tipo = "text",
  valor,
  requerido = false,
  paso,
}: {
  nombre: string;
  etiqueta: string;
  tipo?: "text" | "number";
  valor?: string | number;
  requerido?: boolean;
  paso?: string;
}) {
  return (
    <label className="mt-3 block text-sm font-semibold text-negro">
      {etiqueta}
      <input
        name={nombre}
        type={tipo}
        defaultValue={valor}
        required={requerido}
        step={paso}
        min={tipo === "number" ? 0 : undefined}
        max={tipo === "number" ? 10_000_000 : undefined}
        maxLength={tipo === "number" ? undefined : 2048}
        className={CLASE_CAMPO}
      />
    </label>
  );
}

function BotonGuardar({
  guardando,
  bloqueado = false,
  textoBloqueado = "No disponible",
  children,
}: {
  guardando: boolean;
  bloqueado?: boolean;
  textoBloqueado?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={guardando || bloqueado}
      className="mt-4 w-full rounded-full bg-rojo px-4 py-2.5 text-sm font-semibold text-white hover:bg-negro disabled:cursor-not-allowed disabled:opacity-45"
    >
      {guardando ? "Guardando…" : bloqueado ? textoBloqueado : children}
    </button>
  );
}
