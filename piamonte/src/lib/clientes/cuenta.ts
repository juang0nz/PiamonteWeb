"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { asegurarPerfilCliente } from "@/lib/clientes/perfil";
import { obtenerComercioActual } from "@/lib/comercio/contexto";
import { createClient } from "@/lib/supabase/server";

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_VALIDO =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function texto(valor: FormDataEntryValue | null): string {
  return typeof valor === "string" ? valor.trim() : "";
}

async function obtenerOrigen(): Promise<string> {
  const configurado = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configurado) {
    return new URL(configurado).origin;
  }

  const encabezados = await headers();
  const origen = encabezados.get("origin");
  if (origen) {
    return new URL(origen).origin;
  }

  const host = encabezados.get("x-forwarded-host") ?? encabezados.get("host");
  if (!host) {
    throw new Error(
      "No se pudo resolver el origen público para confirmar la cuenta.",
    );
  }
  const protocolo = encabezados.get("x-forwarded-proto") ?? "http";
  return `${protocolo}://${host}`;
}

export async function registrarCliente(formData: FormData) {
  const nombre = texto(formData.get("nombre"));
  const telefono = texto(formData.get("telefono"));
  const email = texto(formData.get("email")).toLowerCase();
  const password =
    typeof formData.get("password") === "string"
      ? String(formData.get("password"))
      : "";
  const confirmarPassword =
    typeof formData.get("confirmarPassword") === "string"
      ? String(formData.get("confirmarPassword"))
      : "";

  if (nombre.length < 2 || nombre.length > 120) {
    redirect("/auth/registro?error=nombre_invalido");
  }
  if (telefono.length < 7 || telefono.length > 30) {
    redirect("/auth/registro?error=telefono_invalido");
  }
  if (!EMAIL_VALIDO.test(email) || email.length > 254) {
    redirect("/auth/registro?error=email_invalido");
  }
  if (password.length < 8 || password.length > 72) {
    redirect("/auth/registro?error=password_invalida");
  }
  if (password !== confirmarPassword) {
    redirect("/auth/registro?error=passwords_distintas");
  }

  const comercio = await obtenerComercioActual();
  if (!comercio) {
    redirect("/auth/registro?error=comercio_no_disponible");
  }

  let origen: string;
  try {
    origen = await obtenerOrigen();
  } catch (error) {
    console.error("Error al resolver origen para registro:", error);
    redirect("/auth/registro?error=configuracion");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origen}/auth/callback`,
      data: { nombre, telefono },
    },
  });

  if (error) {
    console.error("Error de Supabase Auth al registrar cliente:", {
      status: error.status,
      code: error.code,
      message: error.message,
    });
    redirect("/auth/registro?error=registro_fallido");
  }

  if (data.session && data.user) {
    const perfil = await asegurarPerfilCliente(supabase, data.user);
    if ("error" in perfil) {
      redirect(`/mi-cuenta?error=${perfil.error}`);
    }
    redirect("/mi-cuenta?mensaje=cuenta_creada");
  }

  redirect("/auth/registro?mensaje=revisar_correo");
}

export async function iniciarSesionCliente(formData: FormData) {
  const email = texto(formData.get("email")).toLowerCase();
  const password =
    typeof formData.get("password") === "string"
      ? String(formData.get("password"))
      : "";

  if (
    !EMAIL_VALIDO.test(email) ||
    email.length > 254 ||
    !password ||
    password.length > 72
  ) {
    redirect("/auth/login?error=credenciales_invalidas");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.user) {
    redirect("/auth/login?error=credenciales_invalidas");
  }

  const perfil = await asegurarPerfilCliente(supabase, data.user);
  if ("error" in perfil) {
    redirect(`/mi-cuenta?error=${perfil.error}`);
  }
  redirect("/mi-cuenta");
}

export async function cerrarSesionCliente() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Error al cerrar sesión de cliente:", {
      status: error.status,
      code: error.code,
      message: error.message,
    });
    redirect("/mi-cuenta?error=cierre_fallido");
  }
  redirect("/");
}

export async function actualizarPerfilCliente(formData: FormData) {
  const nombre = texto(formData.get("nombre"));
  const telefono = texto(formData.get("telefono"));
  if (
    nombre.length < 2 ||
    nombre.length > 120 ||
    telefono.length < 7 ||
    telefono.length > 30
  ) {
    redirect("/mi-cuenta?error=perfil_invalido");
  }

  const supabase = await createClient();
  const { data, error: usuarioError } = await supabase.auth.getUser();
  if (usuarioError || !data.user) redirect("/auth/login");

  const comercio = await obtenerComercioActual();
  if (!comercio) redirect("/mi-cuenta?error=comercio_no_disponible");

  const { error } = await supabase.from("clientes_perfiles").upsert(
    {
      user_id: data.user.id,
      comercio_id: comercio.id,
      nombre,
      telefono,
    },
    { onConflict: "user_id,comercio_id" },
  );
  if (error) {
    console.error("Error al actualizar perfil del cliente:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    redirect("/mi-cuenta?error=perfil_no_disponible");
  }

  revalidatePath("/mi-cuenta");
  redirect("/mi-cuenta?mensaje=perfil_actualizado");
}

export async function crearDireccionCliente(formData: FormData) {
  const etiqueta = texto(formData.get("etiqueta"));
  const calle = texto(formData.get("calle"));
  const numero = texto(formData.get("numero"));
  const apartamento = texto(formData.get("apartamento"));
  const referencias = texto(formData.get("referencias"));
  if (
    etiqueta.length > 40 ||
    !calle ||
    calle.length > 120 ||
    !numero ||
    numero.length > 20 ||
    apartamento.length > 20 ||
    referencias.length > 300
  ) {
    redirect("/mi-cuenta?error=direccion_invalida");
  }

  const supabase = await createClient();
  const { data, error: usuarioError } = await supabase.auth.getUser();
  if (usuarioError || !data.user) redirect("/auth/login");

  const perfil = await asegurarPerfilCliente(supabase, data.user);
  if ("error" in perfil) redirect(`/mi-cuenta?error=${perfil.error}`);

  const { error } = await supabase.from("clientes_direcciones").insert({
    user_id: data.user.id,
    comercio_id: perfil.comercio.id,
    etiqueta: etiqueta || null,
    calle,
    numero,
    apartamento: apartamento || null,
    referencias: referencias || null,
  });
  if (error) {
    console.error("Error al guardar dirección del cliente:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    redirect("/mi-cuenta?error=direccion_no_disponible");
  }

  revalidatePath("/mi-cuenta");
  redirect("/mi-cuenta?mensaje=direccion_guardada");
}

export async function eliminarDireccionCliente(formData: FormData) {
  const direccionId = texto(formData.get("direccionId"));
  if (!UUID_VALIDO.test(direccionId)) {
    redirect("/mi-cuenta?error=direccion_invalida");
  }

  const supabase = await createClient();
  const { data, error: usuarioError } = await supabase.auth.getUser();
  if (usuarioError || !data.user) redirect("/auth/login");

  const comercio = await obtenerComercioActual();
  if (!comercio) redirect("/mi-cuenta?error=comercio_no_disponible");

  const { data: eliminada, error } = await supabase
    .from("clientes_direcciones")
    .delete()
    .eq("id", direccionId)
    .eq("user_id", data.user.id)
    .eq("comercio_id", comercio.id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Error al eliminar dirección del cliente:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    redirect("/mi-cuenta?error=direccion_no_disponible");
  }
  if (!eliminada) {
    redirect("/mi-cuenta?error=direccion_no_encontrada");
  }

  revalidatePath("/mi-cuenta");
  redirect("/mi-cuenta?mensaje=direccion_eliminada");
}
