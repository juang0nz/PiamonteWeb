import { NextResponse } from "next/server";
import { obtenerEstadoAccesoAdmin } from "@/lib/admin/auth";
import { createPrivateClient } from "@/lib/supabase/private";

export const runtime = "nodejs";

const BUCKET_IMAGENES = "imagenes-productos";
const TAMANO_MAXIMO = 5 * 1024 * 1024;
const TIPOS_PERMITIDOS = new Set(["image/jpeg", "image/png", "image/webp"]);

type TipoImagen = {
  mime: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
};

function detectarTipo(bytes: Uint8Array): TipoImagen | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", extension: "jpg" };
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { mime: "image/png", extension: "png" };
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return { mime: "image/webp", extension: "webp" };
  }
  return null;
}

function respuestaError(mensaje: string, estado: number) {
  return NextResponse.json({ error: mensaje }, { status: estado });
}

export async function POST(request: Request) {
  const acceso = await obtenerEstadoAccesoAdmin();
  if (!acceso.autenticado) {
    return respuestaError("No autenticado para subir imágenes.", 401);
  }
  if (!acceso.autorizado || acceso.rol === "empleado") {
    return respuestaError("No autorizado para subir imágenes a este comercio.", 403);
  }

  let datos: FormData;
  try {
    datos = await request.formData();
  } catch {
    return respuestaError("El formulario de imagen no es válido.", 400);
  }

  const archivo = datos.get("imagen");
  const destino = datos.get("destino");
  if (!(archivo instanceof File)) {
    return respuestaError("Seleccioná una imagen para subir.", 400);
  }
  if (destino !== "productos" && destino !== "categorias") {
    return respuestaError("El destino de la imagen no es válido.", 400);
  }
  if (archivo.size === 0 || archivo.size > TAMANO_MAXIMO) {
    return respuestaError("La imagen debe pesar como máximo 5 MB.", 400);
  }
  if (!TIPOS_PERMITIDOS.has(archivo.type)) {
    return respuestaError("Solo se permiten imágenes JPG, PNG o WebP.", 400);
  }

  const contenido = new Uint8Array(await archivo.arrayBuffer());
  const tipo = detectarTipo(contenido);
  if (!tipo || tipo.mime !== archivo.type) {
    return respuestaError("El contenido de la imagen no coincide con su tipo.", 400);
  }

  const ruta = `${acceso.comercioId}/${destino}/${crypto.randomUUID()}.${tipo.extension}`;
  const supabase = createPrivateClient();
  const { error: subidaError } = await supabase.storage
    .from(BUCKET_IMAGENES)
    .upload(ruta, contenido, {
      contentType: tipo.mime,
      cacheControl: "31536000",
      upsert: false,
    });

  if (subidaError) {
    console.error("Error al subir imagen del catálogo:", {
      message: subidaError.message,
      name: subidaError.name,
    });
    return respuestaError(
      "No pudimos guardar la imagen. Verificá que Storage esté configurado.",
      503,
    );
  }

  const { data } = supabase.storage.from(BUCKET_IMAGENES).getPublicUrl(ruta);
  return NextResponse.json(
    { ok: true, url: data.publicUrl, ruta },
    { status: 201 },
  );
}
