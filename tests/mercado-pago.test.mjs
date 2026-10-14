import assert from "node:assert/strict";
import { createHmac, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function cargarMercadoPago(env = {}, checkoutDisponible = true) {
  const codigo = ts.transpileModule(
    fs.readFileSync(
      path.join(raiz, "src/lib/pagos/mercadoPago.ts"),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    },
  ).outputText;
  const modulo = { exports: {} };
  vm.runInNewContext(codigo, {
    exports: modulo.exports,
    module: modulo,
    require(nombre) {
      if (nombre === "server-only") return {};
      if (nombre === "node:crypto") {
        return { createHmac, timingSafeEqual };
      }
      if (nombre === "./configuracion") {
        return {
          MERCADO_PAGO_DISPONIBLE_EN_CHECKOUT: checkoutDisponible,
        };
      }
      throw new Error(`Módulo no simulado: ${nombre}`);
    },
    process: { env },
    Buffer,
    URL,
    console,
    Response,
  });
  return modulo.exports;
}

const variablesPrueba = {
  MERCADO_PAGO_ENABLED: "true",
  MERCADO_PAGO_ACCESS_TOKEN: "TEST-token-no-real",
  MERCADO_PAGO_WEBHOOK_SECRET: "secreto-de-prueba-no-real",
  MERCADO_PAGO_PUBLIC_BASE_URL: "https://pedidos.example.test",
};

test("Mercado Pago queda bloqueado sin bandera y credenciales privadas", async () => {
  const mercadoPago = cargarMercadoPago(variablesPrueba, false);
  assert.equal(mercadoPago.validarMetodoPagoParaPedido("efectivo").valido, true);
  assert.equal(
    mercadoPago.validarMetodoPagoParaPedido("mercado_pago").valido,
    false,
  );
  assert.equal(mercadoPago.obtenerConfiguracionMercadoPago().habilitado, false);

  let consultado = false;
  await assert.rejects(
    mercadoPago.crearPreferenciaMercadoPago(
      {
        pagoId: "11111111-1111-4111-8111-111111111111",
        pedidoId: "22222222-2222-4222-8222-222222222222",
        numeroPedido: 12,
        monto: 650,
        moneda: "UYU",
      },
      async () => {
        consultado = true;
        return new Response();
      },
    ),
    /no está habilitado/i,
  );
  assert.equal(consultado, false);
});

test("La preferencia usa la referencia estable del intento persistido", async () => {
  const mercadoPago = cargarMercadoPago(variablesPrueba);
  let solicitud;
  const resultado = await mercadoPago.crearPreferenciaMercadoPago(
    {
      pagoId: "11111111-1111-4111-8111-111111111111",
      pedidoId: "22222222-2222-4222-8222-222222222222",
      numeroPedido: 12,
      monto: 650,
      moneda: "UYU",
    },
    async (url, init) => {
      solicitud = { url, init, body: JSON.parse(init.body) };
      return Response.json({
        id: "preferencia-prueba",
        init_point: "https://www.mercadopago.com.uy/checkout/prueba",
      });
    },
  );

  assert.equal(
    solicitud.url,
    "https://api.mercadopago.com/checkout/preferences",
  );
  assert.equal(solicitud.init.headers["X-Idempotency-Key"], undefined);
  assert.equal(
    solicitud.body.external_reference,
    "11111111-1111-4111-8111-111111111111",
  );
  assert.equal(
    solicitud.body.notification_url,
    "https://pedidos.example.test/api/pagos/mercado-pago/webhook",
  );
  assert.equal(solicitud.body.items[0].unit_price, 650);
  assert.equal(resultado.preferenciaId, "preferencia-prueba");
});

test("El webhook sólo acepta una firma HMAC válida", () => {
  const mercadoPago = cargarMercadoPago(variablesPrueba);
  const dataId = "PAY123ABC";
  const requestId = "request-prueba";
  const ts = "1770000000";
  const manifiesto = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const firma = createHmac(
    "sha256",
    variablesPrueba.MERCADO_PAGO_WEBHOOK_SECRET,
  )
    .update(manifiesto)
    .digest("hex");

  assert.equal(
    mercadoPago.verificarFirmaWebhookMercadoPago({
      dataId,
      requestId,
      signature: `ts=${ts},v1=${firma}`,
    }),
    true,
  );
  assert.equal(
    mercadoPago.verificarFirmaWebhookMercadoPago({
      dataId,
      requestId,
      signature: `ts=${ts},v1=${"0".repeat(64)}`,
    }),
    false,
  );
});

test("El pago se verifica en Mercado Pago y no desde el payload del webhook", async () => {
  const mercadoPago = cargarMercadoPago(variablesPrueba);
  let urlConsultada;
  const pago = await mercadoPago.consultarPagoMercadoPago(
    "987654321",
    async (url) => {
      urlConsultada = url;
      return Response.json({
        id: 987654321,
        status: "approved",
        external_reference: "11111111-1111-4111-8111-111111111111",
        transaction_amount: 650,
        currency_id: "UYU",
      });
    },
  );

  assert.equal(
    urlConsultada,
    "https://api.mercadopago.com/v1/payments/987654321",
  );
  assert.equal(pago.estado, "aprobado");
  assert.equal(pago.monto, 650);
});

test("El SQL asocia intentos, deduplica eventos y bloquea escrituras del cliente", () => {
  const sql = fs.readFileSync(
    path.join(raiz, "database/mercado_pago_preparacion.sql"),
    "utf8",
  );
  assert.match(sql, /insert into public\.pagos \(/i);
  assert.match(sql, /unique \(proveedor, evento_id\)/i);
  assert.match(sql, /on conflict \(proveedor, evento_id\) do nothing/i);
  assert.match(sql, /reservar_preferencia_mercado_pago/i);
  assert.match(sql, /revoke all on table public\.pagos from anon, authenticated/i);
  assert.match(sql, /revoke update on table public\.pedidos from anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.confirmar_pago_mercado_pago[\s\S]*to service_role/i);
});
