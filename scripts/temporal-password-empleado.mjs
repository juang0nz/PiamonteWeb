import { readFileSync } from "node:fs";
import { parseArgs, parseEnv } from "node:util";
import { emitKeypressEvents } from "node:readline";
import { createClient } from "@supabase/supabase-js";

const ARCHIVO_ENTORNO = new URL("../.env.local", import.meta.url);

class ErrorOperacion extends Error {}

// Lee el correo del empleado desde la línea de comandos. Es obligatorio y nunca
// se versiona: `node scripts/temporal-password-empleado.mjs --correo persona@ejemplo.com`.
function leerCorreoDesdeArgumentos() {
  let valores;
  try {
    ({ values: valores } = parseArgs({
      options: { correo: { type: "string" } },
      strict: true,
    }));
  } catch {
    throw new ErrorOperacion(
      "Argumentos no reconocidos. Uso: node scripts/temporal-password-empleado.mjs --correo persona@ejemplo.com",
    );
  }
  const correo = valores.correo?.trim().toLowerCase();
  if (!correo) {
    throw new ErrorOperacion(
      "Falta el argumento obligatorio --correo. Uso: node scripts/temporal-password-empleado.mjs --correo persona@ejemplo.com",
    );
  }
  // Validación mínima: un solo "@", sin espacios y con un dominio con punto.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(correo) || correo.length > 254) {
    throw new ErrorOperacion("El valor de --correo no tiene formato de correo electrónico válido.");
  }
  return correo;
}

function leerPasswordOculta(pregunta) {
  const entrada = process.stdin;
  if (!entrada.isTTY || !process.stdout.isTTY) {
    throw new ErrorOperacion(
      "Ejecutá el script en una terminal interactiva. No admite archivos ni entrada redirigida.",
    );
  }

  return new Promise((resolve, reject) => {
    let caracteres = [];
    const rawAnterior = entrada.isRaw;
    const finalizar = (error) => {
      entrada.removeListener("keypress", alPresionar);
      entrada.setRawMode(rawAnterior);
      entrada.pause();
      process.stdout.write("\n");
      const valor = caracteres.join("");
      caracteres = [];
      if (error) reject(error);
      else resolve(valor);
    };
    const alPresionar = (texto, tecla = {}) => {
      if (tecla.ctrl && tecla.name === "c") {
        finalizar(new ErrorOperacion("Operación cancelada. No se solicitó ningún cambio."));
      } else if (tecla.name === "return" || tecla.name === "enter") {
        finalizar();
      } else if (tecla.name === "backspace") {
        caracteres.pop();
      } else if (tecla.ctrl && tecla.name === "u") {
        caracteres = [];
      } else if (!tecla.ctrl && !tecla.meta && texto && !/[\u0000-\u001f\u007f-\u009f]/u.test(texto)) {
        caracteres.push(...Array.from(texto));
      }
    };

    emitKeypressEvents(entrada);
    process.stdout.write(pregunta);
    entrada.setRawMode(true);
    entrada.on("keypress", alPresionar);
    entrada.resume();
  });
}

async function buscarUsuario(supabase, correo) {
  let encontrado = null;
  const porPagina = 200;
  for (let pagina = 1; pagina <= 100; pagina += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page: pagina,
      perPage: porPagina,
    });
    if (error || !data?.users) {
      throw new ErrorOperacion(
        "No se pudo consultar Supabase Auth. Verificá la URL, la credencial administrativa y la conexión.",
      );
    }
    for (const usuario of data.users) {
      if (usuario.email?.trim().toLowerCase() === correo) {
        if (encontrado) {
          throw new ErrorOperacion("Se encontró más de una coincidencia. Se canceló sin actualizar.");
        }
        encontrado = usuario;
      }
    }
    if (data.users.length < porPagina || pagina * porPagina >= data.total) {
      if (!encontrado) {
        throw new ErrorOperacion("El correo indicado no existe en Supabase Auth. No se creó ningún usuario.");
      }
      return encontrado;
    }
  }
  throw new ErrorOperacion("La búsqueda superó el límite de páginas. Se canceló sin actualizar.");
}

async function main() {
  const correo = leerCorreoDesdeArgumentos();
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new ErrorOperacion("Usá una terminal interactiva, sin redirecciones ni captura de sesión.");
  }
  let entorno;
  try {
    entorno = parseEnv(readFileSync(ARCHIVO_ENTORNO, "utf8"));
  } catch {
    throw new ErrorOperacion("No se pudo leer .env.local en la raíz del proyecto.");
  }
  const url = entorno.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const clave = entorno.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !clave) {
    throw new ErrorOperacion("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local.");
  }
  let destino;
  try {
    destino = new URL(url);
  } catch {
    throw new ErrorOperacion("NEXT_PUBLIC_SUPABASE_URL no es válida.");
  }
  if (destino.protocol !== "https:" || destino.username || destino.password) {
    throw new ErrorOperacion("La URL de Supabase debe usar HTTPS y no contener credenciales.");
  }

  const supabase = createClient(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const usuario = await buscarUsuario(supabase, correo);
  console.log(`Cuenta encontrada: ${correo}`);
  console.log(`ID: ${usuario.id}`);
  console.log("Solo se actualizará la contraseña. No se confirmará el correo ni se modificarán permisos.");
  if (!usuario.email_confirmed_at) {
    console.log("Advertencia: el correo no está confirmado; cambiar la contraseña puede no habilitar el ingreso.");
  }
  console.log("La contraseña no vencerá automáticamente ni exigirá cambio en el primer ingreso.");
  console.log("Ingresá la contraseña dos veces para autorizar la actualización. Ctrl+C cancela antes del envío.");

  let password = await leerPasswordOculta("Contraseña temporal (entrada oculta): ");
  if (password.length < 8 || password.length > 72) {
    password = "";
    throw new ErrorOperacion("La contraseña debe tener entre 8 y 72 caracteres. No se solicitó ningún cambio.");
  }
  let confirmacion = await leerPasswordOculta("Repetir contraseña (entrada oculta): ");
  if (password !== confirmacion) {
    password = "";
    confirmacion = "";
    throw new ErrorOperacion("Las contraseñas no coinciden. No se solicitó ningún cambio.");
  }
  confirmacion = "";

  const { data: actual, error: errorLectura } = await supabase.auth.admin.getUserById(usuario.id);
  if (errorLectura || actual.user?.email?.trim().toLowerCase() !== correo) {
    password = "";
    throw new ErrorOperacion("No se pudo reconfirmar la identidad de la cuenta. No se solicitó ningún cambio.");
  }

  // No agregar otros atributos: esta operación modifica exclusivamente la contraseña.
  let resultado;
  try {
    resultado = await supabase.auth.admin.updateUserById(usuario.id, { password });
  } catch {
    throw new ErrorOperacion(
      "Falló la comunicación durante la actualización. El resultado es incierto; verificá antes de reintentar.",
    );
  } finally {
    password = "";
  }
  if (resultado.error) {
    throw new ErrorOperacion(
      "Supabase rechazó la actualización. Revisá la política de contraseñas y la configuración de Auth.",
    );
  }
  if (resultado.data.user?.id !== usuario.id) {
    throw new ErrorOperacion("La respuesta no confirmó el usuario esperado. Verificá el resultado antes de reintentar.");
  }
  console.log("Supabase confirmó la actualización de la contraseña del usuario indicado.");
  console.log("Eliminá este script después de usarlo y entregá la contraseña por un canal privado verificado.");
}

main().catch((error) => {
  console.error(error instanceof ErrorOperacion
    ? error.message
    : "No se pudo completar la operación. No se muestran detalles internos para proteger las credenciales.");
  process.exitCode = 1;
});
