import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
function cargar(archivo, modulos, globales = {}) {
  const codigo = ts.transpileModule(fs.readFileSync(path.join(raiz, archivo), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const modulo = { exports: {} };
  vm.runInNewContext(codigo, {
    exports: modulo.exports, module: modulo,
    require: nombre => {
      if (!(nombre in modulos)) throw new Error(`Módulo no simulado: ${nombre}`);
      return modulos[nombre];
    },
    URL, TextEncoder, console: { error() {}, info() {}, warn() {} },
    process: { env: {} }, ...globales,
  });
  return modulo.exports;
}
const accesoEmpleados = cargar("src/lib/admin/accesoEmpleados.ts", { "server-only": {} }, {
  process: { env: { NEXT_PUBLIC_SITE_URL: "http://localhost:3000" } },
});
const celular = cargar("src/lib/checkout/celular.ts", {});
const checkout = cargar("src/lib/checkout/tipos.ts", {
  "./celular": celular,
});
const clientes = cargar("src/lib/admin/clientes.ts", { "@/lib/checkout/celular": celular });
const NextResponse = {
  json: (body, opciones = {}) => ({ body, status: opciones.status ?? 200, headers: opciones.headers }),
  next: ({ request }) => ({ request, cookies: { set() {} } }),
};

const ID_EMPLEADO = "00000000-0000-4000-8000-000000000002";
const ID_COMERCIO = "00000000-0000-4000-8000-000000000001";
const ID_OPERACION = "00000000-0000-4000-8000-000000000003";

function clienteCuentaEmpleado({ vinculos, superAdmin = null, fallo = false } = {}) {
  return {
    from: tabla => {
      const resultado = {
        data: tabla === "super_admins" ? superAdmin
          : tabla === "comercios" ? { id: ID_COMERCIO }
          : vinculos ?? [{ comercio_id: ID_COMERCIO, rol: "empleado", activo: true }],
        error: fallo ? { code: "42501" } : null,
      };
      const consulta = {
        select: () => consulta, eq: () => consulta,
        maybeSingle: async () => resultado,
        then: (resolver, rechazar) => Promise.resolve(resultado).then(resolver, rechazar),
      };
      return consulta;
    },
  };
}

function escenarioCorreoEmpleado(opciones = {}) {
  const llamadas = [];
  const privado = clienteCuentaEmpleado(opciones);
  privado.auth = {
    admin: {
      getUserById: async id => {
        llamadas.push(["usuario", id]);
        return { data: { user: {
          id, email: "registrado@ejemplo.test",
          email_confirmed_at: opciones.confirmado ? "2026-10-01" : undefined,
          banned_until: opciones.bloqueado ? "2099-01-01" : undefined,
        } }, error: null };
      },
      inviteUserByEmail: async (email, configuracion) => {
        llamadas.push(["invitacion", email, configuracion]);
        return { data: { user: { id: ID_EMPLEADO } }, error: opciones.errorEnvio ?? null };
      },
    },
    resetPasswordForEmail: async (email, configuracion) => {
      llamadas.push(["recuperacion", email, configuracion]);
      if (opciones.excepcionEnvio) throw new Error("No registrar el contenido de esta excepción");
      return { error: opciones.errorEnvio ?? null };
    },
  };
  const ruta = cargar("src/app/api/admin/empleados/acceso/route.ts", {
    "next/server": { NextResponse },
    "@/lib/admin/auth": { obtenerEstadoAccesoAdmin: async () => opciones.acceso ?? ({
      autenticado: true, autorizado: true, rol: "admin", comercioId: ID_COMERCIO,
    }) },
    "@/lib/admin/accesoEmpleados": accesoEmpleados,
    "@/lib/supabase/private": { createPrivateClient: () => privado },
    "@/lib/supabase/server": { createClient: async () => ({
      rpc: async (nombre, parametros) => {
        llamadas.push([nombre, parametros]);
        return nombre === "admin_iniciar_acceso_empleado_auditado"
          ? { data: opciones.repetida ? false : true, error: opciones.errorAuditoria ?? null }
          : { data: true, error: opciones.errorCierre ?? null };
      },
    }) },
  });
  const solicitar = (datos = {}, origin = "http://localhost:3000") => ruta.POST(new Request(
    "http://localhost:3000/api/admin/empleados/acceso", {
      method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: ID_EMPLEADO, tipo: "recuperacion", operacionId: ID_OPERACION, ...datos,
      }),
    },
  ));
  return { llamadas, solicitar };
}

test("Acceso por correo exige sesión, administrador y origen del panel", async () => {
  for (const [acceso, status] of [
    [{ autenticado: false }, 401],
    [{ autenticado: true, autorizado: false }, 403],
    [{ autenticado: true, autorizado: true, rol: "empleado" }, 403],
  ]) {
    const escenario = escenarioCorreoEmpleado({ acceso });
    assert.equal((await escenario.solicitar()).status, status);
    assert.equal(escenario.llamadas.length, 0);
  }
  const escenario = escenarioCorreoEmpleado();
  assert.equal((await escenario.solicitar({}, "https://otro.test")).status, 403);
  assert.equal((await escenario.solicitar({ userId: "inválido" })).status, 400);
  assert.equal(escenario.llamadas.length, 0);
});

test("Acceso bloquea owner, admin, operador, Super Admin, inactivos y cuentas de otros comercios", async () => {
  for (const opciones of [
    ...["owner", "admin", "operador"].map(rol => ({
      vinculos: [{ comercio_id: ID_COMERCIO, rol, activo: true }],
    })),
    { superAdmin: { user_id: ID_EMPLEADO } },
    { vinculos: [{ comercio_id: "otro", rol: "empleado", activo: true }] },
    { vinculos: [{ comercio_id: ID_COMERCIO, rol: "empleado", activo: false }] },
    { vinculos: [
      { comercio_id: ID_COMERCIO, rol: "empleado", activo: true },
      { comercio_id: "otro", rol: "empleado", activo: true },
    ] },
  ]) {
    const escenario = escenarioCorreoEmpleado(opciones);
    assert.equal((await escenario.solicitar()).status, 403);
    assert.equal(escenario.llamadas.length, 0);
  }
  const escenario = escenarioCorreoEmpleado({ fallo: true });
  assert.equal((await escenario.solicitar()).status, 503);
  assert.equal(escenario.llamadas.length, 0);
});

test("Recuperación usa solo correo registrado, URL confiable y auditoría antes y después del envío", async () => {
  const escenario = escenarioCorreoEmpleado({ confirmado: true });
  const resultado = await escenario.solicitar({ email: "ignorado@otro.test", comercioId: "otro" });
  assert.equal(resultado.status, 200);
  assert.deepEqual(escenario.llamadas.map(llamada => llamada[0]), [
    "usuario", "admin_iniciar_acceso_empleado_auditado", "recuperacion",
    "admin_finalizar_acceso_empleado_auditado",
  ]);
  const inicio = escenario.llamadas[1][1];
  assert.equal(inicio.p_comercio_id, ID_COMERCIO);
  assert.equal(inicio.p_user_id, ID_EMPLEADO);
  assert.equal(escenario.llamadas[2][1], "registrado@ejemplo.test");
  assert.equal(escenario.llamadas[2][2].redirectTo, "http://localhost:3000/admin/acceso");
  assert.equal(escenario.llamadas[3][1].p_enviado, true);
  assert.equal(JSON.stringify(resultado).includes("password"), false);
});

test("Reinvita una cuenta pendiente sin crear ni asignar usuarios y rechaza correo ya confirmado", async () => {
  const escenario = escenarioCorreoEmpleado();
  assert.equal((await escenario.solicitar({ tipo: "invitacion" })).status, 200);
  assert.equal(escenario.llamadas[2][0], "invitacion");
  assert.equal(escenario.llamadas[2][1], "registrado@ejemplo.test");
  assert.equal((await escenarioCorreoEmpleado({ confirmado: true })
    .solicitar({ tipo: "invitacion" })).status, 409);
  assert.equal((await escenarioCorreoEmpleado({ bloqueado: true }).solicitar()).status, 409);
});

test("No envía sin auditoría, ante repetición o antes del intervalo permitido", async () => {
  for (const [opciones, status] of [
    [{ errorAuditoria: { code: "PGRST202" } }, 503],
    [{ errorAuditoria: { code: "54000" } }, 429],
    [{ repetida: true }, 409],
  ]) {
    const escenario = escenarioCorreoEmpleado(opciones);
    assert.equal((await escenario.solicitar()).status, status);
    assert.equal(escenario.llamadas.some(llamada => llamada[0] === "recuperacion"), false);
  }
});

test("Fallos de envío se auditan y fallos del cierre no se presentan como éxito", async () => {
  for (const opciones of [{ errorEnvio: { code: "over_email_send_rate_limit" } }, { excepcionEnvio: true }]) {
    const escenario = escenarioCorreoEmpleado(opciones);
    assert.equal((await escenario.solicitar()).status, 502);
    assert.equal(escenario.llamadas.at(-1)[1].p_enviado, false);
  }
  const escenario = escenarioCorreoEmpleado({ errorCierre: { code: "42501" } });
  const resultado = await escenario.solicitar();
  assert.equal(resultado.status, 503);
  assert.match(resultado.body.error, /aceptó el envío/);
});

test("Estado de acceso separa correo, invitación, bloqueo e ingreso sin exponer secretos", () => {
  const estado = accesoEmpleados.estadoAccesoEmpleado({
    invited_at: "2026-10-01", email_confirmed_at: undefined, last_sign_in_at: undefined,
    recovery_sent_at: "2026-10-02", banned_until: "2099-01-01",
    password: "no-exponer", access_token: "no-exponer",
  });
  assert.equal(estado.cuentaExiste, true);
  assert.equal(estado.correoConfirmado, false);
  assert.equal(estado.ultimoIngresoEn, null);
  assert.equal(estado.bloqueado, true);
  assert.equal(JSON.stringify(estado).includes("no-exponer"), false);
  assert.equal(accesoEmpleados.estadoAccesoEmpleado().cuentaExiste, false);
});

test("La URL de acceso usa configuración explícita, HTTPS y nunca un destino del navegador", () => {
  for (const valor of [undefined, "no-es-url", "http://produccion.test", "https://usuario:clave@ejemplo.test"]) {
    const modulo = cargar("src/lib/admin/accesoEmpleados.ts", { "server-only": {} }, {
      process: { env: { NEXT_PUBLIC_SITE_URL: valor } },
    });
    assert.throws(() => modulo.urlAccesoEmpleado());
  }
  const modulo = cargar("src/lib/admin/accesoEmpleados.ts", { "server-only": {} }, {
    process: { env: { NEXT_PUBLIC_SITE_URL: "https://ejemplo.test/ruta?ignorar=1" } },
  });
  assert.equal(modulo.urlAccesoEmpleado(), "https://ejemplo.test/admin/acceso");
});

test("SQL de acceso audita intención y resultado, restringe al empleado y no escribe Auth ni roles", () => {
  const sql = fs.readFileSync(path.join(raiz, "supabase/historial/20261014100012_acceso_empleados.sql"), "utf8");
  assert.match(sql, /auth\.uid\(\) is null/);
  assert.match(sql, /rol = 'empleado' and activo/);
  assert.match(sql, /comercio_id <> p_comercio_id or rol <> 'empleado'/);
  assert.match(sql, /from public\.super_admins where user_id = p_user_id/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /interval '60 seconds'/);
  assert.match(sql, /'acceso_solicitado'/);
  assert.match(sql, /'acceso_correo_enviado'.*'acceso_correo_fallido'/);
  assert.match(sql, /from public, anon, authenticated, service_role/);
  assert.doesNotMatch(sql, /(?:update|delete from|insert into)\s+(?:auth\.|public\.admin_comercios)/i);
});

function escenarioConfirmacionEmpleado(opciones = {}) {
  const llamadas = [];
  const logs = [];
  const privado = clienteCuentaEmpleado(opciones);
  const sesion = {
    verifyOtp: async datos => {
      llamadas.push(["verificar", datos.type]);
      return { data: { user: { id: ID_EMPLEADO } }, error: opciones.errorEnlace ?? null };
    },
    setSession: async () => {
      llamadas.push(["sesion"]);
      return { data: { user: { id: ID_EMPLEADO } }, error: opciones.errorEnlace ?? null };
    },
    getUser: async () => ({ data: { user: { id: ID_EMPLEADO } }, error: opciones.errorIdentidad ?? null }),
    updateUser: async datos => {
      llamadas.push(["password", datos]);
      return { error: opciones.errorPassword ?? null };
    },
    signOut: async datos => {
      llamadas.push(["salir", datos]);
      return { error: null };
    },
  };
  const ruta = cargar("src/app/admin/acceso/confirmar/route.ts", {
    "next/server": { NextResponse },
    "@/lib/comercio": { SLUG_COMERCIO: "piamonte" },
    "@supabase/supabase-js": { createClient: (_url, clave, configuracion) => {
      assert.equal(clave, "clave-publica");
      assert.equal(configuracion.auth.persistSession, false);
      return { auth: sesion };
    } },
    "@/lib/admin/accesoEmpleados": accesoEmpleados,
    "@/lib/supabase/private": { createPrivateClient: () => privado },
  }, {
    process: { env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://ejemplo.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "clave-publica",
    } },
    console: { error: (...datos) => logs.push(datos) },
  });
  const solicitar = (datos = {}) => ruta.POST(new Request("http://localhost:3000/admin/acceso/confirmar", {
    method: "POST", headers: { Origin: "http://localhost:3000", "Content-Type": "application/json" },
    body: JSON.stringify({
      tokenHash: "secreto-enlace", tipo: "recovery",
      password: "secreto-personal", confirmacion: "secreto-personal", ...datos,
    }),
  }));
  return { llamadas, logs, solicitar };
}

test("Empleado establece su contraseña con el enlace y cliente público aislado, sin cookies administrativas", async () => {
  for (const datos of [
    {},
    { tipo: "invite" },
    { tokenHash: null, accessToken: "secreto-acceso", refreshToken: "secreto-renovacion" },
  ]) {
    const escenario = escenarioConfirmacionEmpleado();
    const resultado = await escenario.solicitar(datos);
    assert.equal(resultado.status, 200);
    assert.equal(escenario.llamadas.at(-2)[0], "password");
    assert.deepEqual(Object.keys(escenario.llamadas.at(-2)[1]), ["password"]);
    assert.equal(escenario.llamadas.at(-1)[0], "salir");
    assert.equal(JSON.stringify(resultado).includes("secreto"), false);
    assert.equal(JSON.stringify(escenario.logs).includes("secreto"), false);
  }
});

test("Confirmación rechaza contraseñas inválidas y enlaces ausentes antes de consumirlos", async () => {
  for (const datos of [
    { password: "corta" }, { confirmacion: "distinta" },
    { password: "x".repeat(73), confirmacion: "x".repeat(73) },
    { tokenHash: null }, { tipo: "signup" },
  ]) {
    const escenario = escenarioConfirmacionEmpleado();
    assert.equal((await escenario.solicitar(datos)).status, 400);
    assert.equal(escenario.llamadas.length, 0);
  }
});

test("Confirmación no cambia contraseñas ante enlaces vencidos, identidad no válida o cuentas ajenas", async () => {
  for (const [opciones, status] of [
    [{ errorEnlace: { code: "otp_expired" } }, 401],
    [{ errorIdentidad: { code: "bad_jwt" } }, 401],
    [{ vinculos: [{ comercio_id: ID_COMERCIO, rol: "owner", activo: true }] }, 403],
    [{ vinculos: [{ comercio_id: "otro", rol: "empleado", activo: true }] }, 403],
    [{ vinculos: [{ comercio_id: ID_COMERCIO, rol: "empleado", activo: false }] }, 403],
    [{ superAdmin: { user_id: ID_EMPLEADO } }, 403],
  ]) {
    const escenario = escenarioConfirmacionEmpleado(opciones);
    assert.equal((await escenario.solicitar()).status, status);
    assert.equal(escenario.llamadas.some(llamada => llamada[0] === "password"), false);
    assert.equal(JSON.stringify(escenario.logs).includes("secreto"), false);
  }
});
function pedido(cambios = {}) {
  return {
    id: "pedido", numero: 1, creado_en: "2026-10-01T10:00:00Z",
    cliente_nombre: "Ana", cliente_telefono: "099 806 731", modalidad: "delivery",
    direccion_calle: "Calle antigua", direccion_numero: "123", direccion_apartamento: "2",
    direccion_referencias: "Timbre", estado: "entregado", total: "100.50", ...cambios,
  };
}

test("Normaliza celulares nacionales e internacionales sin admitir fijos o extranjeros", () => {
  for (const valor of ["099806731", "099 806 731", "(099) 806-731", "99806731", "+59899806731", "59899806731"]) {
    assert.equal(celular.normalizarCelularUruguayo(valor), "+59899806731");
  }
  for (const valor of ["", "24001234", "+54999806731", "09980673", "0998067312"]) {
    assert.equal(celular.normalizarCelularUruguayo(valor), null);
  }
});
test("Checkout de invitado no exige sesión, correo ni dirección para retiro", () => {
  const datos = { ...checkout.DATOS_INICIALES, tipoEntrega: "retiro", nombre: "Ana", telefono: "099806731" };
  assert.equal(Object.keys(checkout.validarDatosCheckout(datos)).length, 0);
  assert.ok(checkout.validarDatosCheckout({ ...datos, nombre: " " }).nombre);
  assert.ok(checkout.validarDatosCheckout({ ...datos, telefono: "24001234" }).telefono);
  const errores = checkout.validarDatosCheckout({ ...datos, tipoEntrega: "delivery" });
  assert.ok(errores.calle);
  assert.ok(errores.numero);
});
test("Agrupa formatos del mismo celular y toma nombre y dirección más recientes", () => {
  const resultado = clientes.agruparClientes([
    pedido(),
    pedido({ id: "nuevo", numero: 2, creado_en: "2026-10-02T10:00:00Z", cliente_nombre: "Ana Pérez", cliente_telefono: "+59899806731", modalidad: "retiro", direccion_calle: null }),
    pedido({ id: "direccion", numero: 3, creado_en: "2026-10-01T12:00:00Z", cliente_telefono: "99806731", direccion_calle: "Calle nueva", total: 200 }),
    pedido({ id: "otro", cliente_telefono: "091111111", cliente_nombre: "Bruno" }),
  ]);
  assert.equal(resultado.clientes.length, 2);
  const ana = resultado.clientes[0];
  assert.equal(ana.nombre, "Ana Pérez");
  assert.equal(ana.telefono, "+59899806731");
  assert.equal(ana.cantidadPedidos, 3);
  assert.equal(ana.importeAcumulado, 401);
  assert.equal(ana.direccion.calle, "Calle nueva");
  assert.equal(ana.pedidos[0].numero, 2);
});
test("Pedidos cancelados figuran en historial/cantidad pero no suman ventas", () => {
  const cliente = clientes.agruparClientes([
    pedido({ estado: "cancelado", total: 500 }),
    pedido({ id: "valido", numero: 2, total: 10.10 }),
    pedido({ id: "valido2", numero: 3, total: 20.20 }),
  ]).clientes[0];
  assert.equal(cliente.cantidadPedidos, 3);
  assert.equal(cliente.pedidosNoCancelados, 2);
  assert.equal(cliente.importeAcumulado, 30.30);
  assert.equal(cliente.pedidos.find(p => p.estado === "cancelado").cancelado, true);
  assert.equal(clientes.agruparClientes([pedido({ estado: "cancelado" })]).clientes[0].importeAcumulado, 0);
});
test("Orden cronológico respeta zonas horarias y desempata por número", () => {
  const cliente = clientes.agruparClientes([
    pedido({ id: "anterior", creado_en: "2026-10-01T12:00:00+03:00" }),
    pedido({ id: "nuevo", numero: 2, creado_en: "2026-10-01T10:00:00Z", cliente_nombre: "Último" }),
  ]).clientes[0];
  assert.equal(cliente.nombre, "Último");
});
test("Buscar admite nombres sin tildes y celulares nacionales, internacionales y parciales", () => {
  const lista = clientes.agruparClientes([pedido({ cliente_nombre: "María Pérez" })]).clientes;
  for (const busqueda of ["maria", "PEREZ", "099 806 731", "0998", "+598 99 806 731", "806731"]) {
    assert.equal(clientes.filtrarClientes(lista, busqueda).length, 1, busqueda);
  }
  assert.equal(clientes.filtrarClientes(lista, "Bruno").length, 0);
});
test("Pedidos sin teléfono no se mezclan; formatos históricos inválidos se señalan", () => {
  const resultado = clientes.agruparClientes([
    pedido({ cliente_telefono: null }),
    pedido({ id: "vacio", cliente_telefono: " " }),
    pedido({ id: "legado", cliente_telefono: "24001234" }),
  ]);
  assert.equal(resultado.pedidosSinTelefono, 2);
  assert.equal(resultado.clientes.length, 1);
  assert.equal(resultado.clientes[0].telefonoValido, false);
  assert.equal(resultado.clientes[0].telefono, "24001234");
});
test("Importes inválidos no producen resúmenes de ventas falsos", () => {
  assert.throws(() => clientes.agruparClientes([pedido({ total: "inválido" })]), /importe inválido/);
});

for (const autorizado of [false, true]) {
  test(`Auth administrativo mantiene verificación de admin_comercios: ${autorizado}`, async () => {
    const filtros = [];
    const auth = cargar("src/lib/admin/auth.ts", {
      "server-only": {}, "next/navigation": { redirect() {} },
      "@/lib/supabase/server": { createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: "usuario" } }, error: null }) },
        rpc: async () => ({ data: false, error: null }),
        from: tabla => {
          const consulta = {
            select: () => consulta,
            eq: (campo, valor) => { filtros.push([tabla, campo, valor]); return consulta; },
            maybeSingle: async () => ({ data: tabla === "comercios" ? { id: "comercio" } : autorizado ? { rol: "admin" } : null, error: null }),
          };
          return consulta;
        },
      }) },
    });
    const estado = await auth.obtenerEstadoAccesoAdmin();
    assert.equal(estado.autorizado, autorizado);
    assert.ok(filtros.some(([tabla, campo, valor]) => tabla === "admin_comercios" && campo === "user_id" && valor === "usuario"));
    assert.ok(filtros.some(([tabla, campo, valor]) => tabla === "admin_comercios" && campo === "activo" && valor === true));
  });
}
test("Auth mantiene acceso administrativo para el rol owner existente", async () => {
  const auth = cargar("src/lib/admin/auth.ts", {
    "server-only": {},
    "next/navigation": { redirect() {} },
    "@/lib/supabase/server": {
      createClient: async () => ({
        auth: {
          getUser: async () => ({
            data: { user: { id: "owner", email: "owner@piamonte.test" } },
            error: null,
          }),
        },
        rpc: async () => ({ data: false, error: null }),
        from: tabla => {
          const consulta = {
            select: () => consulta,
            eq: () => consulta,
            maybeSingle: async () => ({
              data:
                tabla === "comercios"
                  ? { id: "comercio" }
                  : { rol: "owner" },
              error: null,
            }),
          };
          return consulta;
        },
      }),
    },
  });

  const estado = await auth.obtenerEstadoAccesoAdmin();
  assert.equal(estado.autorizado, true);
  assert.equal(estado.rol, "owner");
});
test("Super Admin accede al comercio sin vínculo en admin_comercios", async () => {
  let consultoVinculo = false;
  const auth = cargar("src/lib/admin/auth.ts", {
    "server-only": {}, "next/navigation": { redirect() {} },
    "@/lib/supabase/server": { createClient: async () => ({
      auth: {
        getUser: async () => ({
          data: { user: { id: "super-admin", email: "super@admin.test" } },
          error: null,
        }),
      },
      rpc: async nombre => {
        assert.equal(nombre, "es_super_admin_activo");
        return { data: true, error: null };
      },
      from: tabla => {
        if (tabla === "admin_comercios") consultoVinculo = true;
        const consulta = {
          select: () => consulta,
          eq: () => consulta,
          maybeSingle: async () => ({
            data: tabla === "comercios" ? { id: "comercio" } : null,
            error: null,
          }),
        };
        return consulta;
      },
    }) },
  });

  const estado = await auth.obtenerEstadoAccesoAdmin();
  assert.equal(estado.autorizado, true);
  assert.equal(estado.rol, "super_admin");
  assert.equal(estado.esSuperAdmin, true);
  assert.equal(estado.comercioId, "comercio");
  assert.equal(consultoVinculo, false);
});
test("Middleware permite APIs admin al Super Admin sin vínculo comercial", async () => {
  let consultoVinculo = false;
  const cliente = {
    auth: {
      getUser: async () => ({
        data: { user: { id: "super-admin" } },
        error: null,
      }),
    },
    rpc: async nombre => {
      assert.equal(nombre, "es_super_admin_activo");
      return { data: true, error: null };
    },
    from: tabla => {
      if (tabla === "admin_comercios") consultoVinculo = true;
      const consulta = {
        select: () => consulta,
        eq: () => consulta,
        maybeSingle: async () => ({
          data: tabla === "comercios" ? { id: "comercio" } : null,
          error: null,
        }),
      };
      return consulta;
    },
  };
  const proxy = cargar("middleware.ts", {
    "next/server": { NextResponse },
    "@supabase/ssr": { createServerClient: () => cliente },
    "@/lib/comercio": { SLUG_COMERCIO: "piamonte" },
  });
  const request = {
    method: "GET",
    nextUrl: { pathname: "/api/admin/clientes" },
    cookies: { getAll: () => [], set() {} },
  };

  const respuesta = await proxy.middleware(request);
  assert.equal(respuesta.request, request);
  assert.equal(consultoVinculo, false);
});
test("Middleware mantiene admin_comercios obligatorio para Admin común", async () => {
  let consultoVinculo = false;
  const cliente = {
    auth: {
      getUser: async () => ({
        data: { user: { id: "admin-comun" } },
        error: null,
      }),
    },
    rpc: async () => ({ data: false, error: null }),
    from: tabla => {
      if (tabla === "admin_comercios") consultoVinculo = true;
      const consulta = {
        select: () => consulta,
        eq: () => consulta,
        maybeSingle: async () => ({
          data: tabla === "comercios" ? { id: "comercio" } : null,
          error: null,
        }),
      };
      return consulta;
    },
  };
  const proxy = cargar("middleware.ts", {
    "next/server": { NextResponse },
    "@supabase/ssr": { createServerClient: () => cliente },
    "@/lib/comercio": { SLUG_COMERCIO: "piamonte" },
  });
  const request = {
    method: "GET",
    nextUrl: { pathname: "/api/admin/clientes" },
    cookies: { getAll: () => [], set() {} },
  };

  const respuesta = await proxy.middleware(request);
  assert.equal(respuesta.status, 403);
  assert.equal(consultoVinculo, true);
});
test("Middleware limita al Empleado a las APIs operativas de pedidos", async () => {
  const crearCliente = () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: "empleado" } },
        error: null,
      }),
    },
    rpc: async () => ({ data: false, error: null }),
    from: tabla => {
      const consulta = {
        select: () => consulta,
        eq: () => consulta,
        maybeSingle: async () => ({
          data:
            tabla === "comercios"
              ? { id: "comercio" }
              : { rol: "empleado" },
          error: null,
        }),
      };
      return consulta;
    },
  });
  const proxy = cargar("middleware.ts", {
    "next/server": { NextResponse },
    "@supabase/ssr": { createServerClient: crearCliente },
    "@/lib/comercio": { SLUG_COMERCIO: "piamonte" },
  });
  const crearRequest = pathname => ({
    method: "GET",
    nextUrl: { pathname },
    cookies: { getAll: () => [], set() {} },
  });

  const pedidos = crearRequest("/api/admin/pedidos");
  assert.equal((await proxy.middleware(pedidos)).request, pedidos);

  const catalogo = crearRequest("/api/admin/catalogo");
  assert.equal((await proxy.middleware(catalogo)).status, 403);
});
test("Empleado no puede cancelar pedidos antes de invocar la RPC", async () => {
  let creoClienteSesion = false;
  const ruta = cargar("src/app/api/admin/pedidos/estado/route.ts", {
    "next/server": { NextResponse },
    "@/lib/admin/auth": {
      obtenerEstadoAccesoAdmin: async () => ({
        autenticado: true,
        autorizado: true,
        rol: "empleado",
        comercioId: "00000000-0000-4000-8000-000000000001",
        email: "empleado@piamonte.test",
        esSuperAdmin: false,
      }),
    },
    "@/lib/supabase/private": {
      createPrivateClient() {
        throw new Error("No debe crear el cliente privado");
      },
    },
    "@/lib/supabase/server": {
      async createClient() {
        creoClienteSesion = true;
        throw new Error("No debe invocar la RPC");
      },
    },
  });
  const request = {
    json: async () => ({
      pedidoId: "00000000-0000-4000-8000-000000000002",
      operacionId: "00000000-0000-4000-8000-000000000003",
      estadoActualEsperado: "pendiente",
      nuevoEstado: "cancelado",
    }),
  };

  const respuesta = await ruta.PATCH(request);
  assert.equal(respuesta.status, 403);
  assert.equal(creoClienteSesion, false);
});
test("API Empleados rechaza al rol Empleado antes de usar service_role", async () => {
  const ruta = cargar("src/app/api/admin/empleados/route.ts", {
    "@/lib/admin/accesoEmpleados": accesoEmpleados,
    "next/server": { NextResponse },
    "@/lib/admin/auth": {
      obtenerEstadoAccesoAdmin: async () => ({
        autenticado: true,
        autorizado: true,
        rol: "empleado",
        comercioId: "comercio",
        email: "empleado@piamonte.test",
        esSuperAdmin: false,
      }),
    },
    "@/lib/supabase/private": {
      createPrivateClient() {
        throw new Error("No debe crear el cliente privado");
      },
    },
    "@/lib/supabase/server": {
      createClient() {
        throw new Error("No debe crear el cliente de sesión");
      },
    },
    "@/lib/super-admin/usuarios": {
      listarUsuariosAuth() {
        throw new Error("No debe consultar usuarios");
      },
    },
  });

  assert.equal((await ruta.GET()).status, 403);
});
test("API Empleados lista sólo vínculos del comercio y rol Empleado", async () => {
  const filtros = [];
  const consulta = {
    select: () => consulta,
    eq: (campo, valor) => {
      filtros.push([campo, valor]);
      return consulta;
    },
    order: async () => ({
      data: [{ user_id: "usuario-empleado", activo: true }],
      error: null,
    }),
  };
  const privado = { from: () => consulta };
  const ruta = cargar("src/app/api/admin/empleados/route.ts", {
    "@/lib/admin/accesoEmpleados": accesoEmpleados,
    "next/server": { NextResponse },
    "@/lib/admin/auth": {
      obtenerEstadoAccesoAdmin: async () => ({
        autenticado: true,
        autorizado: true,
        rol: "admin",
        comercioId: "comercio-autorizado",
        email: "admin@piamonte.test",
        esSuperAdmin: false,
      }),
    },
    "@/lib/supabase/private": { createPrivateClient: () => privado },
    "@/lib/supabase/server": {
      createClient() {
        throw new Error("GET no debe crear cliente de sesión");
      },
    },
    "@/lib/super-admin/usuarios": {
      listarUsuariosAuth: async cliente => {
        assert.equal(cliente, privado);
        return [{ id: "usuario-empleado", email: "empleado@piamonte.test" }];
      },
    },
  });

  const respuesta = await ruta.GET();
  assert.equal(respuesta.status, 200);
  assert.equal(respuesta.body.empleados[0].email, "empleado@piamonte.test");
  assert.ok(
    filtros.some(
      ([campo, valor]) =>
        campo === "comercio_id" && valor === "comercio-autorizado",
    ),
  );
  assert.ok(
    filtros.some(([campo, valor]) => campo === "rol" && valor === "empleado"),
  );
});
test("API Empleados asigna usuarios existentes mediante RPC auditada", async () => {
  let llamadaRpc;
  const consulta = {
    select: () => consulta,
    eq: () => consulta,
    maybeSingle: async () => ({ data: null, error: null }),
  };
  const privado = {
    from: () => consulta,
    auth: {
      admin: {
        inviteUserByEmail() {
          throw new Error("No debe enviar una invitación real");
        },
      },
    },
  };
  const ruta = cargar("src/app/api/admin/empleados/route.ts", {
    "@/lib/admin/accesoEmpleados": accesoEmpleados,
    "next/server": { NextResponse },
    "@/lib/admin/auth": {
      obtenerEstadoAccesoAdmin: async () => ({
        autenticado: true,
        autorizado: true,
        rol: "owner",
        comercioId: "00000000-0000-4000-8000-000000000001",
        email: "owner@piamonte.test",
        esSuperAdmin: false,
      }),
    },
    "@/lib/supabase/private": { createPrivateClient: () => privado },
    "@/lib/supabase/server": {
      createClient: async () => ({
        rpc: async (nombre, parametros) => {
          llamadaRpc = { nombre, parametros };
          return { error: null };
        },
      }),
    },
    "@/lib/super-admin/usuarios": {
      listarUsuariosAuth: async () => [
        {
          id: "00000000-0000-4000-8000-000000000002",
          email: "nuevo@piamonte.test",
        },
      ],
    },
  });
  const request = {
    json: async () => ({
      email: "nuevo@piamonte.test",
      operacionId: "00000000-0000-4000-8000-000000000003",
    }),
  };

  const respuesta = await ruta.POST(request);
  assert.equal(respuesta.status, 201);
  assert.equal(llamadaRpc.nombre, "admin_asignar_empleado_auditado");
  assert.equal(
    llamadaRpc.parametros.p_comercio_id,
    "00000000-0000-4000-8000-000000000001",
  );
  assert.equal(
    llamadaRpc.parametros.p_user_id,
    "00000000-0000-4000-8000-000000000002",
  );
  assert.equal("rol" in llamadaRpc.parametros, false);
});
test("API Empleados completa invitaciones nuevas con Auth y RPC auditadas", async () => {
  const llamadasRpc = [];
  let correoInvitado;
  let destinoInvitacion;
  const privado = {
    auth: {
      admin: {
        inviteUserByEmail: async (email, configuracion) => {
          correoInvitado = email;
          destinoInvitacion = configuracion.redirectTo;
          return {
            data: {
              user: {
                id: "00000000-0000-4000-8000-000000000002",
                email,
              },
            },
            error: null,
          };
        },
      },
    },
  };
  const ruta = cargar("src/app/api/admin/empleados/route.ts", {
    "@/lib/admin/accesoEmpleados": accesoEmpleados,
    "next/server": { NextResponse },
    "@/lib/admin/auth": {
      obtenerEstadoAccesoAdmin: async () => ({
        autenticado: true,
        autorizado: true,
        rol: "admin",
        comercioId: "00000000-0000-4000-8000-000000000001",
        email: "admin@piamonte.test",
        esSuperAdmin: false,
      }),
    },
    "@/lib/supabase/private": { createPrivateClient: () => privado },
    "@/lib/supabase/server": {
      createClient: async () => ({
        rpc: async (nombre, parametros) => {
          llamadasRpc.push({ nombre, parametros });
          return { error: null };
        },
      }),
    },
    "@/lib/super-admin/usuarios": {
      listarUsuariosAuth: async () => [],
    },
  });
  const request = {
    json: async () => ({
      email: "invitado@piamonte.test",
      operacionId: "00000000-0000-4000-8000-000000000003",
    }),
  };

  const respuesta = await ruta.POST(request);
  assert.equal(respuesta.status, 201);
  assert.equal(correoInvitado, "invitado@piamonte.test");
  assert.equal(destinoInvitacion, "http://localhost:3000/admin/acceso");
  assert.deepEqual(
    llamadasRpc.map(({ nombre }) => nombre),
    [
      "admin_iniciar_invitacion_empleado_auditada",
      "admin_completar_invitacion_empleado_auditada",
    ],
  );
  assert.equal(
    llamadasRpc[0].parametros.p_comercio_id,
    "00000000-0000-4000-8000-000000000001",
  );
});
test("API Empleados cambia estados mediante la RPC del comercio autorizado", async () => {
  let llamadaRpc;
  const ruta = cargar("src/app/api/admin/empleados/route.ts", {
    "@/lib/admin/accesoEmpleados": accesoEmpleados,
    "next/server": { NextResponse },
    "@/lib/admin/auth": {
      obtenerEstadoAccesoAdmin: async () => ({
        autenticado: true,
        autorizado: true,
        rol: "admin",
        comercioId: "00000000-0000-4000-8000-000000000001",
        email: "admin@piamonte.test",
        esSuperAdmin: false,
      }),
    },
    "@/lib/supabase/private": {
      createPrivateClient() {
        throw new Error("PATCH no debe usar service_role");
      },
    },
    "@/lib/supabase/server": {
      createClient: async () => ({
        rpc: async (nombre, parametros) => {
          llamadaRpc = { nombre, parametros };
          return { error: null };
        },
      }),
    },
    "@/lib/super-admin/usuarios": {
      listarUsuariosAuth() {
        throw new Error("PATCH no debe listar usuarios");
      },
    },
  });
  const request = {
    json: async () => ({
      userId: "00000000-0000-4000-8000-000000000002",
      activo: false,
      operacionId: "00000000-0000-4000-8000-000000000003",
    }),
  };

  const respuesta = await ruta.PATCH(request);
  assert.equal(respuesta.status, 200);
  assert.equal(
    llamadaRpc.nombre,
    "admin_cambiar_estado_empleado_auditado",
  );
  assert.equal(llamadaRpc.parametros.p_activo, false);
  assert.equal(
    llamadaRpc.parametros.p_comercio_id,
    "00000000-0000-4000-8000-000000000001",
  );
});
for (const acceso of [{ autenticado: false }, { autenticado: true, autorizado: false }]) {
  test(`API Clientes rechaza acceso antes de crear cliente privilegiado: ${JSON.stringify(acceso)}`, async () => {
    const ruta = cargar("src/app/api/admin/clientes/route.ts", {
      "next/server": { NextResponse },
      "@/lib/admin/auth": { obtenerEstadoAccesoAdmin: async () => acceso },
      "@/lib/supabase/private": { createPrivateClient() { throw new Error("No debe consultar la base"); } },
      "@/lib/admin/clientes": clientes,
    });
    const resultado = await ruta.GET();
    assert.equal(resultado.status, acceso.autenticado ? 403 : 401);
  });
}
for (const acceso of [{ autenticado: false }, { autenticado: true, autorizado: false }]) {
  test(`API Catálogo rechaza acceso antes de crear cliente privilegiado: ${JSON.stringify(acceso)}`, async () => {
    const ruta = cargar("src/app/api/admin/catalogo/route.ts", {
      "next/cache": { revalidatePath() {} },
      "next/server": { NextResponse },
      "@/lib/admin/auth": { obtenerEstadoAccesoAdmin: async () => acceso },
      "@/lib/supabase/private": {
        createPrivateClient() {
          throw new Error("No debe consultar la base");
        },
      },
      "@/lib/supabase/server": {
        createClient() {
          throw new Error("No debe crear el cliente de sesión");
        },
      },
    });
    const resultado = await ruta.GET();
    assert.equal(resultado.status, acceso.autenticado ? 403 : 401);
  });
}
test("API Catálogo edita mediante RPC auditada y limita al comercio autorizado", async () => {
  let llamadaRpc;
  const ruta = cargar("src/app/api/admin/catalogo/route.ts", {
    "next/cache": { revalidatePath() {} },
    "next/server": { NextResponse },
    "@/lib/admin/auth": {
      obtenerEstadoAccesoAdmin: async () => ({
        autenticado: true,
        autorizado: true,
        comercioId: "comercio-autorizado",
      }),
    },
    "@/lib/supabase/private": {
      createPrivateClient() {
        throw new Error("No debe escribir con service_role");
      },
    },
    "@/lib/supabase/server": {
      createClient: async () => ({
        rpc: async (nombre, parametros) => {
          llamadaRpc = { nombre, parametros };
          return { data: true, error: null };
        },
      }),
    },
  });
  const resultado = await ruta.PATCH({
    json: async () => ({
      operacionId: "33333333-3333-4333-8333-333333333333",
      tipo: "producto",
      id: "11111111-1111-4111-8111-111111111111",
      categoriaId: "22222222-2222-4222-8222-222222222222",
      nombre: "Producto editado",
      descripcion: "Descripción",
      imagenUrl: "/producto.jpg",
      precioBase: 250,
      disponible: true,
      destacado: false,
    }),
  });

  assert.equal(resultado.status, 200);
  assert.equal(llamadaRpc.nombre, "admin_actualizar_producto_auditado");
  assert.equal(llamadaRpc.parametros.p_comercio_id, "comercio-autorizado");
  assert.equal(
    llamadaRpc.parametros.p_operacion_id,
    "33333333-3333-4333-8333-333333333333",
  );
  assert.equal(llamadaRpc.parametros.p_precio_base, 250);
});
test("API Catálogo devuelve inmediatamente la categoría creada por RPC", async () => {
  const categoriaId = "44444444-4444-4444-8444-444444444444";
  const supabaseLectura = {
    from: tabla => {
      assert.equal(tabla, "categorias");
      const consulta = {
        select: () => consulta,
        eq: () => consulta,
        order: () => consulta,
        like: async () => ({ data: [], error: null }),
        limit: () => consulta,
        then: resolve => resolve({ data: [{ orden: 15 }], error: null }),
      };
      return consulta;
    },
  };
  const ruta = cargar("src/app/api/admin/catalogo/route.ts", {
    "next/cache": { revalidatePath() {} },
    "next/server": { NextResponse },
    "@/lib/admin/auth": {
      obtenerEstadoAccesoAdmin: async () => ({
        autenticado: true,
        autorizado: true,
        comercioId: "comercio-autorizado",
      }),
    },
    "@/lib/supabase/private": {
      createPrivateClient: () => supabaseLectura,
    },
    "@/lib/supabase/server": {
      createClient: async () => ({
        rpc: async (nombre, parametros) => {
          assert.equal(nombre, "admin_crear_categoria_auditada");
          assert.equal(parametros.p_comercio_id, "comercio-autorizado");
          return { data: categoriaId, error: null };
        },
      }),
    },
  });
  const resultado = await ruta.POST({
    json: async () => ({
      tipo: "categoria",
      nombre: "Prueba 1",
      descripcion: "",
      imagenUrl: "",
      operacionId: "33333333-3333-4333-8333-333333333333",
    }),
  });

  assert.equal(resultado.status, 201);
  assert.equal(resultado.body.categoria.id, categoriaId);
  assert.equal(resultado.body.categoria.nombre, "Prueba 1");
  assert.equal(resultado.body.categoria.activa, true);
});
test("Admin y Super Admin eliminan productos mediante RPC auditada", async () => {
  let llamadaRpc;
  const modulos = esSuperAdmin => ({
    "next/cache": { revalidatePath() {} },
    "next/server": { NextResponse },
    "@/lib/admin/auth": {
      obtenerEstadoAccesoAdmin: async () => ({
        autenticado: true,
        autorizado: true,
        comercioId: "comercio-autorizado",
        esSuperAdmin,
      }),
    },
    "@/lib/supabase/private": {
      createPrivateClient() {
        throw new Error("No debe escribir con service_role");
      },
    },
    "@/lib/supabase/server": {
      createClient: async () => ({
        rpc: async (nombre, parametros) => {
          llamadaRpc = { nombre, parametros };
          return { data: true, error: null };
        },
      }),
    },
  });
  const solicitud = {
    json: async () => ({
      tipo: "producto",
      id: "11111111-1111-4111-8111-111111111111",
      operacionId: "33333333-3333-4333-8333-333333333333",
    }),
  };

  const rutaAdmin = cargar(
    "src/app/api/admin/catalogo/route.ts",
    modulos(false),
  );
  assert.equal((await rutaAdmin.DELETE(solicitud)).status, 200);
  assert.equal(
    llamadaRpc.nombre,
    "super_admin_eliminar_producto_auditado",
  );

  llamadaRpc = undefined;
  const rutaSuperAdmin = cargar(
    "src/app/api/admin/catalogo/route.ts",
    modulos(true),
  );
  assert.equal((await rutaSuperAdmin.DELETE(solicitud)).status, 200);
  assert.equal(
    llamadaRpc.nombre,
    "super_admin_eliminar_producto_auditado",
  );
  assert.equal(llamadaRpc.parametros.p_comercio_id, "comercio-autorizado");
});
test("Selectores de productos usan categorías activas y las RPC castean secuencias", () => {
  const panel = fs.readFileSync(
    path.join(raiz, "src/components/admin/PanelCatalogoAdmin.tsx"),
    "utf8",
  );
  assert.match(
    panel,
    /categoriasActivas = categorias\.filter\(\(categoria\) => categoria\.activa\)/,
  );
  assert.match(panel, /categorias=\{categoriasActivas\}/);

  const sql = fs.readFileSync(
    path.join(raiz, "supabase/historial/20261014100009_auditoria_etapa_2.sql"),
    "utf8",
  );
  assert.match(sql, /p_secuencia::smallint/);
  assert.match(sql, /1::smallint/);
  assert.match(sql, /2::smallint/);
});
test("Catálogo muestra imágenes y filtra productos con baja lógica", () => {
  const tarjeta = fs.readFileSync(
    path.join(raiz, "src/components/catalogo/TarjetaProducto.tsx"),
    "utf8",
  );
  assert.match(tarjeta, /src=\{producto\.imagen_url\}/);
  const tarjetaCategoria = fs.readFileSync(
    path.join(raiz, "src/components/catalogo/TarjetaCategoria.tsx"),
    "utf8",
  );
  assert.match(tarjetaCategoria, /categoria\.imagen_url/);

  const consultas = fs.readFileSync(
    path.join(raiz, "src/lib/catalogo/consultas.ts"),
    "utf8",
  );
  assert.match(consultas, /\.eq\("activo", true\)/);
  assert.match(consultas, /\.eq\("eliminada", false\)/);

  const pedidos = fs.readFileSync(
    path.join(raiz, "src/lib/pedidos/registrar.ts"),
    "utf8",
  );
  assert.match(pedidos, /\.eq\("activo", true\)/);
  assert.match(pedidos, /categoria\.eliminada === true/);

  const sql = fs.readFileSync(
    path.join(raiz, "supabase/historial/20261014100010_baja_logica_catalogo_super_admin.sql"),
    "utf8",
  );
  assert.match(sql, /add column if not exists activo boolean/);
  assert.match(sql, /super_admin_eliminar_producto_auditado/);
  assert.match(sql, /super_admin_eliminar_categoria_auditada/);
});
test("Eliminar es un nivel distinto de activar o desactivar", () => {
  // El panel deja de listar lo eliminado, pero conserva activos e inactivos.
  const ruta = fs.readFileSync(
    path.join(raiz, "src/app/api/admin/catalogo/route.ts"),
    "utf8",
  );
  assert.match(ruta, /consulta\.eq\("activo", true\)/);
  assert.match(ruta, /consulta\.eq\("eliminada", false\)/);

  const panel = fs.readFileSync(
    path.join(raiz, "src/components/admin/PanelCatalogoAdmin.tsx"),
    "utf8",
  );
  assert.match(panel, /¿Eliminar completamente/);
  // Una sola confirmación por eliminación.
  assert.equal((panel.match(/window\.confirm\(/g) ?? []).length, 1);
  // El estado "Eliminado" ya no se muestra porque esos registros no se listan.
  assert.doesNotMatch(panel, /"Eliminado"/);

  const sql = fs.readFileSync(
    path.join(raiz, "supabase/historial/20261014100011_eliminacion_catalogo.sql"),
    "utf8",
  );
  assert.match(sql, /add column if not exists eliminada boolean/);
  // La eliminación de categoría no debe alterar el estado "activa".
  assert.match(sql, /set eliminada = true/);
  assert.doesNotMatch(sql, /set activa = false/);
  // Eliminar una categoría no se bloquea por tener productos: los arrastra.
  assert.doesNotMatch(sql, /La categoría contiene productos activos/);
  assert.match(sql, /set activo = false/);
  assert.match(sql, /motivo', 'categoria_eliminada/);
  // El 23503 queda sólo para impedir asignar productos a categorías eliminadas.
  assert.match(sql, /errcode = '23503'/);

  const bajaLogica = fs.readFileSync(
    path.join(raiz, "supabase/historial/20261014100010_baja_logica_catalogo_super_admin.sql"),
    "utf8",
  );
  assert.doesNotMatch(bajaLogica, /La categoría contiene productos activos/);
});
test("Auditoría tiene navegación real y rechaza usuarios sin permiso", async () => {
  const encabezado = fs.readFileSync(
    path.join(
      raiz,
      "src/components/super-admin/EncabezadoSuperAdmin.tsx",
    ),
    "utf8",
  );
  assert.match(encabezado, /href="\/super-admin\/auditoria"/);

  const ruta = cargar("src/app/api/super-admin/auditoria/route.ts", {
    "next/server": { NextResponse },
    "@/lib/admin/auth": { esSuperAdminActivo: async () => false },
    "@/lib/supabase/private": {
      createPrivateClient() {
        throw new Error("No debe crear cliente privado");
      },
    },
    "@/lib/supabase/server": {
      createClient() {
        throw new Error("No debe consultar auditoría");
      },
    },
    "@/lib/super-admin/usuarios": {
      listarUsuariosAuth() {
        throw new Error("No debe listar usuarios");
      },
    },
  });
  const resultado = await ruta.GET(
    new Request("http://localhost/api/super-admin/auditoria"),
  );
  assert.equal(resultado.status, 403);
});
test("La carga de imágenes bloquea creación y edición hasta recibir la URL", () => {
  const selector = fs.readFileSync(
    path.join(raiz, "src/components/admin/SelectorImagenAdmin.tsx"),
    "utf8",
  );
  assert.match(selector, /onUploadingChange\?\.\(true\)/);
  assert.match(selector, /onUploadingChange\?\.\(false\)/);

  const panel = fs.readFileSync(
    path.join(raiz, "src/components/admin/PanelCatalogoAdmin.tsx"),
    "utf8",
  );
  assert.equal(
    (panel.match(/if \(subiendoImagen\) return;/g) ?? []).length,
    4,
  );
  assert.equal(
    (panel.match(/onUploadingChange=\{setSubiendoImagen\}/g) ?? []).length,
    4,
  );
  assert.match(panel, /disabled=\{guardando \|\| subiendoImagen\}/);
  assert.match(
    panel,
    /bloqueado=\{subiendoImagen \|\| categorias\.length === 0\}/,
  );
  assert.equal(
    (panel.match(/destino="categorias"/g) ?? []).length,
    2,
  );
});
test("Catálogo administrativo usa listados visuales y panel lateral", () => {
  const panel = fs.readFileSync(
    path.join(raiz, "src/components/admin/PanelCatalogoAdmin.tsx"),
    "utf8",
  );
  assert.match(panel, /Productos/);
  assert.match(panel, /Categorías/);
  assert.match(panel, /\+ Agregar/);
  assert.match(panel, /role="dialog"/);
  assert.match(panel, /TarjetaProductoAdmin/);
  assert.match(panel, /TarjetaCategoriaAdmin/);
  assert.match(panel, /MiniaturaCatalogo/);
  assert.match(panel, />\s*Editar\s*</);
  assert.match(panel, />\s*Eliminar\s*</);
});
test("API Disponibilidad cambia productos mediante RPC auditada", async () => {
  let llamadaRpc;
  const ruta = cargar("src/app/api/admin/disponibilidad/route.ts", {
    "next/cache": { revalidatePath() {} },
    "next/server": { NextResponse },
    "@/lib/admin/auth": {
      obtenerEstadoAccesoAdmin: async () => ({
        autenticado: true,
        autorizado: true,
        comercioId: "comercio-autorizado",
      }),
    },
    "@/lib/supabase/private": {
      createPrivateClient() {
        throw new Error("No debe escribir con service_role");
      },
    },
    "@/lib/supabase/server": {
      createClient: async () => ({
        rpc: async (nombre, parametros) => {
          llamadaRpc = { nombre, parametros };
          return { data: true, error: null };
        },
      }),
    },
  });
  const resultado = await ruta.PATCH({
    json: async () => ({
      tipo: "producto",
      id: "11111111-1111-4111-8111-111111111111",
      disponible: false,
      operacionId: "33333333-3333-4333-8333-333333333333",
    }),
  });

  assert.equal(resultado.status, 200);
  assert.equal(
    llamadaRpc.nombre,
    "admin_cambiar_disponibilidad_producto_auditada",
  );
  assert.equal(llamadaRpc.parametros.p_comercio_id, "comercio-autorizado");
  assert.equal(llamadaRpc.parametros.p_disponible, false);
});
test("API Pedidos cambia estados mediante RPC auditada", async () => {
  let llamadaRpc;
  const ruta = cargar("src/app/api/admin/pedidos/estado/route.ts", {
    "next/server": { NextResponse },
    "@/lib/admin/auth": {
      obtenerEstadoAccesoAdmin: async () => ({
        autenticado: true,
        autorizado: true,
        comercioId: "comercio-autorizado",
      }),
    },
    "@/lib/supabase/private": {
      createPrivateClient() {
        throw new Error("No debe escribir con service_role");
      },
    },
    "@/lib/supabase/server": {
      createClient: async () => ({
        rpc: async (nombre, parametros) => {
          llamadaRpc = { nombre, parametros };
          return { data: true, error: null };
        },
      }),
    },
  });
  const resultado = await ruta.PATCH({
    json: async () => ({
      pedidoId: "11111111-1111-4111-8111-111111111111",
      estadoActualEsperado: "pendiente",
      nuevoEstado: "en_preparacion",
      operacionId: "33333333-3333-4333-8333-333333333333",
    }),
  });

  assert.equal(resultado.status, 200);
  assert.equal(
    llamadaRpc.nombre,
    "admin_actualizar_estado_pedido_auditado",
  );
  assert.equal(llamadaRpc.parametros.p_comercio_id, "comercio-autorizado");
  assert.equal(llamadaRpc.parametros.p_nuevo_estado, "en_preparacion");
});
test("API Super Admin cambia accesos mediante RPC auditada", async () => {
  let llamadaRpc;
  const ruta = cargar("src/app/api/super-admin/administradores/route.ts", {
    "next/server": { NextResponse },
    "@/lib/admin/auth": { esSuperAdminActivo: async () => true },
    "@/lib/super-admin/usuarios": {
      listarUsuariosAuth: async () => [],
    },
    "@/lib/supabase/private": {
      createPrivateClient() {
        throw new Error("No debe escribir con service_role");
      },
    },
    "@/lib/supabase/server": {
      createClient: async () => ({
        rpc: async (nombre, parametros) => {
          llamadaRpc = { nombre, parametros };
          return { data: true, error: null };
        },
      }),
    },
  });
  const resultado = await ruta.PATCH({
    json: async () => ({
      userId: "11111111-1111-4111-8111-111111111111",
      comercioId: "22222222-2222-4222-8222-222222222222",
      activo: false,
      operacionId: "33333333-3333-4333-8333-333333333333",
    }),
  });

  assert.equal(resultado.status, 200);
  assert.equal(
    llamadaRpc.nombre,
    "super_admin_cambiar_estado_administrador_auditado",
  );
  assert.equal(
    llamadaRpc.parametros.p_comercio_id,
    "22222222-2222-4222-8222-222222222222",
  );
  assert.equal(llamadaRpc.parametros.p_activo, false);
});
test("API Clientes pagina todos los pedidos y filtra siempre por el comercio autorizado", async () => {
  const consultas = [];
  let numeroPagina = 0;
  const ruta = cargar("src/app/api/admin/clientes/route.ts", {
    "next/server": { NextResponse },
    "@/lib/admin/auth": { obtenerEstadoAccesoAdmin: async () => ({ autenticado: true, autorizado: true, comercioId: "comercio-autorizado" }) },
    "@/lib/supabase/private": { createPrivateClient: () => ({
      from: tabla => {
        assert.equal(tabla, "pedidos");
        const filtros = [];
        const consulta = {
          select: () => consulta,
          eq: (campo, valor) => { filtros.push([campo, valor]); return consulta; },
          order: () => consulta,
          range: (desde, hasta) => { consultas.push({ desde, hasta, filtros }); return consulta; },
          returns: async () => ({ data: numeroPagina++ === 0 ?
            Array.from({ length: 500 }, (_, i) => pedido({ id: String(i), numero: i + 1, total: 1 })) :
            [pedido({ id: "501", numero: 501, total: 1 })], error: null }),
        };
        return consulta;
      },
    }) },
    "@/lib/admin/clientes": clientes,
  });
  const resultado = await ruta.GET(new Request("http://localhost/api/admin/clientes?comercio_id=ajeno"));
  assert.equal(resultado.status, 200);
  assert.equal(resultado.body.clientes[0].cantidadPedidos, 501);
  assert.equal(resultado.body.clientes[0].importeAcumulado, 501);
  assert.equal(consultas.length, 2);
  assert.equal(consultas[1].desde, 500);
  for (const consulta of consultas) assert.equal(consulta.filtros[0][1], "comercio-autorizado");
  assert.equal(resultado.headers["Cache-Control"], "private, no-store");
});
test("API Clientes no entrega un resumen parcial cuando falla una consulta", async () => {
  const consulta = { select: () => consulta, eq: () => consulta, order: () => consulta, range: () => consulta,
    returns: async () => ({ data: null, error: { code: "error" } }) };
  const ruta = cargar("src/app/api/admin/clientes/route.ts", {
    "next/server": { NextResponse },
    "@/lib/admin/auth": { obtenerEstadoAccesoAdmin: async () => ({ autenticado: true, autorizado: true, comercioId: "comercio" }) },
    "@/lib/supabase/private": { createPrivateClient: () => ({ from: () => consulta }) },
    "@/lib/admin/clientes": clientes,
  });
  const resultado = await ruta.GET();
  assert.equal(resultado.status, 500);
  assert.ok(resultado.body.error);
  assert.equal(resultado.body.clientes, undefined);
});
test("Registro de invitado mantiene RPC, precios calculados, celular normalizado y número", async () => {
  let parametros;
  const operacionesPrivadas = [];
  const tablas = {
    comercios: [{ id: "comercio", slug: "piamonte", activo: true }],
    comercio_configuracion: [{ pedidos_pausados: false, mensaje_pausa: "", costo_envio: 0 }],
    categorias: [{ id: "categoria", comercio_id: "comercio", activa: true }],
    productos: [{ id: "producto", comercio_id: "comercio", categoria_id: "categoria", nombre: "Producto", precio_base: 100, disponible: true }],
    grupos_opciones: [], reglas_opciones_variante: [],
  };
  const supabase = {
    from: tabla => {
      const consulta = {
        select: () => consulta, eq: () => consulta, in: () => consulta,
        maybeSingle: async () => ({ data: tablas[tabla][0], error: null }),
        then: resolver => Promise.resolve({ data: tablas[tabla], error: null }).then(resolver),
      };
      return consulta;
    },
  };
  const privado = {
    from: tabla => {
      assert.equal(tabla, "pedidos");
      operacionesPrivadas.push(tabla);
      const consulta = {
        select: columnas => { assert.equal(columnas, "numero"); return consulta; },
        eq: (columna, valor) => {
          assert.equal(columna, "id");
          assert.equal(valor, "pedido-prueba");
          return consulta;
        },
        maybeSingle: async () => ({ data: { numero: 42 }, error: null }),
      };
      return consulta;
    },
    rpc: async (nombre, args) => {
      assert.equal(nombre, "registrar_pedido_desde_checkout");
      operacionesPrivadas.push(nombre);
      parametros = args;
      return { data: [{
        pedido_id: "pedido-prueba", numero_pedido: 42, subtotal: args.p_subtotal,
        descuento: 0, costo_envio: args.p_costo_envio,
        total: args.p_subtotal + args.p_costo_envio,
        promocion_id: null, promocion_nombre: null, promocion_porcentaje: null,
      }], error: null };
    },
  };
  const registrar = cargar("src/lib/pedidos/registrar.ts", {
    "@/lib/catalogo/configurador": { limitesGrupo() { throw new Error("No hay grupos"); } },
    "@/lib/comercio/horarios": { obtenerEstadoApertura: () => ({ abierto: true }) },
    "@/lib/comercio/tiempos": cargar("src/lib/comercio/tiempos.ts"),
    "@/lib/comercio/descuentos": cargar("src/lib/comercio/descuentos.ts", {}),
    "@/lib/supabase/server": { createClient: async () => supabase },
    "@/lib/supabase/private": { createPrivateClient: () => privado },
    "@/lib/checkout/tipos": checkout, "@/lib/checkout/celular": celular,
  });
  const input = {
    comercioSlug: "piamonte", cliente_user_id: "ignorado",
    checkout: { ...checkout.DATOS_INICIALES, tipoEntrega: "retiro", nombre: " Ana ", telefono: "099 806 731" },
    items: [{ productoId: "producto", varianteId: null, cantidad: 2, aclaraciones: "", opciones: [] }],
  };
  const resultado = await registrar.validarYRegistrarPedido(input);
  assert.equal(parametros.p_cliente_nombre, "Ana");
  assert.equal(parametros.p_cliente_telefono, "+59899806731");
  assert.equal(parametros.p_cliente_user_id, undefined);
  assert.equal(parametros.p_subtotal, 200);
  assert.equal(parametros.p_metodo_pago, "pago_en_local");
  assert.equal(parametros.p_costo_envio, 0);
  assert.equal(resultado.subtotal, 200);
  assert.equal(resultado.costoEnvio, 0);
  assert.equal(resultado.total, 200);
  assert.equal(parametros.p_direccion_calle, null);
  assert.equal(resultado.numeroPedido, 42);
  assert.equal(resultado.pedidoId, "pedido-prueba");
  assert.deepEqual(operacionesPrivadas, ["registrar_pedido_desde_checkout"]);
  await assert.rejects(registrar.validarYRegistrarPedido({ ...input, checkout: { ...input.checkout, telefono: "24001234" } }), /datos del checkout/);
  assert.equal(operacionesPrivadas.length, 1);
});
test("Endpoint público registra sin consultar sesión", async () => {
  let recibido;
  const ruta = cargar("src/app/api/pedidos/registrar/route.ts", {
    "next/server": { NextResponse },
    "@/lib/pedidos/registrar": {
      PedidoError: class extends Error {},
      validarYRegistrarPedido: async input => {
        recibido = input;
        return { numeroPedido: 42, subtotal: 200, costoEnvio: 25.5, total: 225.5 };
      },
    },
  });
  const resultado = await ruta.POST({
    method: "POST", headers: { get: nombre => nombre === "content-type" ? "application/json" : null },
    text: async () => JSON.stringify({ comercioSlug: "piamonte", checkout: {} }),
  });
  assert.equal(resultado.status, 201);
  assert.equal(resultado.body.numeroPedido, 42);
  assert.equal(resultado.body.subtotal, 200);
  assert.equal(resultado.body.costoEnvio, 25.5);
  assert.equal(resultado.body.total, 225.5);
  assert.equal(recibido.comercioSlug, "piamonte");
});
test("Las cuentas de clientes fueron retiradas y el checkout invitado no depende de ellas", () => {
  // Rutas y módulos de cuentas de clientes: no deben volver a existir.
  for (const ruta of [
    "src/app/mi-cuenta",
    "src/app/auth",
    "src/lib/clientes",
    "src/components/clientes",
  ]) {
    assert.equal(fs.existsSync(path.join(raiz, ruta)), false, ruta);
  }
  // El checkout y el registro de pedidos no consultan perfiles ni sesión de cliente.
  for (const archivo of [
    "src/app/api/pedidos/registrar/route.ts",
    "src/lib/pedidos/registrar.ts",
    "src/components/checkout/PantallaCheckout.tsx",
  ]) {
    const fuente = fs.readFileSync(path.join(raiz, archivo), "utf8");
    assert.ok(
      !/clientes_perfiles|clientes_direcciones|cliente_user_id|auth\.getUser/.test(
        fuente,
      ),
      archivo,
    );
  }
  // La navegación pública no enlaza a rutas de cuentas.
  const navegacion = fs.readFileSync(
    path.join(raiz, "src/components/catalogo/NavegacionPiamonte.tsx"),
    "utf8",
  );
  assert.ok(!/\/mi-cuenta|\/auth\//.test(navegacion));

  for (const cliente of ["client", "server", "private"]) {
    assert.equal(fs.existsSync(path.join(raiz, `src/lib/supabase/${cliente}.ts`)), true);
  }
  // El middleware cubre solo las rutas administrativas y toma el slug de la configuración del comercio.
  const middleware = fs.readFileSync(path.join(raiz, "middleware.ts"), "utf8");
  for (const matcher of [
    "/admin/:path*",
    "/super-admin/:path*",
    "/api/admin/:path*",
    "/api/super-admin/:path*",
  ]) {
    assert.ok(middleware.includes(`"${matcher}"`));
  }
  assert.ok(!/\/auth\/:path\*|\/mi-cuenta\/:path\*/.test(middleware));
  assert.match(middleware, /import \{ SLUG_COMERCIO \} from "@\/lib\/comercio"/);
  assert.ok(!/"piamonte"/.test(middleware));
});
