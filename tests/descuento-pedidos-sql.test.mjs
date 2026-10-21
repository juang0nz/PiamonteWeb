import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { pathToFileURL } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const leer = nombre => fs.readFileSync(new URL(`../supabase/migrations/${nombre}`, import.meta.url), "utf8");
const sql = leer("20261021024000_descuento_pedidos.sql");
const previo = leer("20261020145041_medios_pago_costo_envio.sql");
const modelo = leer("20261020180500_promociones_automaticas.sql");
const base = leer("20261017134905_remote_schema.sql");
const compacto = sql.replace(/--[^\n]*/g, "").replace(/\s+/g, " ").trim();
const firma = "uuid, text, text, text, text, text, text, text, text, numeric, jsonb, numeric";
const extraerRpc = texto => texto.match(/create function public\.registrar_pedido_desde_checkout[\s\S]*?\$function\$;/i)[0];
const rpc = extraerRpc(sql);
const expresion = rpc.match(/v_descuento := ([^;]+);/)[1];
const casos = JSON.parse(fs.readFileSync(new URL("./fixtures/descuentos-porcentuales.json", import.meta.url), "utf8"));

test("PIA-4 registro: históricos con cero por defecto, sin reescribir ni eliminar datos", () => {
  assert.match(compacto, /^begin;/);
  assert.match(compacto, /commit;$/);
  assert.match(compacto, /add column descuento numeric\(12,2\) not null default 0/);
  assert.match(compacto, /add column promocion_id uuid, add column promocion_nombre text, add column promocion_porcentaje numeric/);
  assert.doesNotMatch(compacto, /\b(?:update public\.pedidos|delete from|truncate|cascade)\b/i);
  assert.match(compacto, /total = subtotal - descuento \+ costo_envio/);
  assert.match(compacto, /descuento >= 0 and descuento <= subtotal and descuento <> 'NaN'::numeric/);
  assert.match(compacto, /promocion_porcentaje between 0 and 100/);
  assert.match(compacto, /promocion_porcentaje = trunc\(promocion_porcentaje\)/);
  assert.match(compacto, /foreign key \(comercio_id, promocion_id\) references public\.promociones\(comercio_id, id\) on delete restrict/);
});

test("PIA-4 registro: conserva los 12 argumentos y recrea solo el resultado con RESTRICT", () => {
  const argumentos = texto => extraerRpc(texto).split("returns table")[0].replace(/\s+/g, " ").trim();
  assert.equal(argumentos(sql), argumentos(previo));
  assert.ok(compacto.includes(`drop function public.registrar_pedido_desde_checkout(${firma}) restrict;`));
  for (const campo of ["pedido_id uuid", "numero_pedido bigint", "subtotal numeric", "descuento numeric", "costo_envio numeric", "total numeric"]) {
    assert.ok(compacto.includes(campo));
  }
  assert.ok(compacto.includes(`alter function public.registrar_pedido_desde_checkout(${firma}) owner to postgres;`));
  assert.ok(compacto.includes(`revoke all on function public.registrar_pedido_desde_checkout(${firma}) from public, anon, authenticated, service_role;`));
  assert.ok(compacto.includes(`grant execute on function public.registrar_pedido_desde_checkout(${firma}) to postgres, service_role;`));
  assert.match(compacto, /security definer set search_path to 'pg_catalog', 'public'/);
});

test("PIA-4 registro: configuración transaccional bloqueada, cálculo exacto y retorno de fila guardada", () => {
  assert.match(compacto, /p\.comercio_id = p_comercio_id and p\.clave = 'descuento_web' for share of p/);
  assert.match(compacto, /c\.id = p\.comercio_id and c\.activo = true/);
  assert.match(compacto, /if not found then raise exception .* using errcode = 'P0002'/);
  assert.equal(expresion, "round(p_subtotal * v_porcentaje / 100, 2)");
  assert.match(compacto, /v_total := p_subtotal - v_descuento \+ p_costo_envio/);
  assert.match(compacto, /if v_total < 0 or v_total > 9999999999\.99/);
  assert.match(compacto, /returning \* into v_pedido/);
  assert.match(compacto, /return query select v_pedido\.id, null::uuid, v_pedido\.numero, v_pedido\.subtotal, v_pedido\.descuento, v_pedido\.costo_envio, v_pedido\.total/);
});

test("PIA-4 registro: conserva pago/modalidad, registro de ítems/opciones y disponibilidad", () => {
  const items = texto => extraerRpc(texto).split("for v_item in")[1].split("return query")[0].replace(/\s+/g, " ").trim();
  assert.equal(items(sql).replace("v_pedido.id", "v_pedido_id"), items(previo));
  const validaciones = texto => extraerRpc(texto).split("begin")[1].split("if p_subtotal")[0].replace(/\s+/g, " ").trim();
  assert.equal(validaciones(sql), validaciones(previo));
  assert.match(compacto, /p_modalidad_entrega = 'retiro' and p_costo_envio <> 0/);
  assert.doesNotMatch(compacto, /(?:alter|drop|disable) trigger|alter sequence|admin_actualizar/);
});

// Opcional: ruta a PGlite instalado fuera del repositorio. Nunca usa credenciales ni red.
test("PIA-4 registro en PostgreSQL embebido: migración, RPC y 15 casos SQL/TypeScript", {
  skip: !process.env.PIA_POSTGRES_TEST_MODULE && "Requiere PIA_POSTGRES_TEST_MODULE apuntando al módulo local de PGlite",
}, async t => {
  const { PGlite } = await import(pathToFileURL(process.env.PIA_POSTGRES_TEST_MODULE).href);
  const db = new PGlite();
  try {
    const tabla = nombre => base.match(new RegExp(`CREATE TABLE "public"\\."${nombre}" \\([\\s\\S]*?\\n\\);`))[0];
    const timestamp = base.match(/CREATE OR REPLACE FUNCTION public\.clientes_actualizar_actualizado_en\(\)[\s\S]*?\$function\$;/)[0];
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create function auth.uid() returns uuid language sql as 'select null::uuid';
      create table public.comercios (id uuid primary key, activo boolean not null default true);
      ${tabla("auditoria_eventos")}
      ${tabla("pedidos")}
      ${tabla("pedido_items")}
      ${tabla("pedido_item_opciones")}
      ${timestamp}
      alter table public.pedidos drop constraint pedidos_metodo_pago_check;
      alter table public.pedidos add constraint pedidos_metodo_pago_check
        check (metodo_pago in ('efectivo', 'tarjeta_pos', 'pago_en_local'));
      ${extraerRpc(previo)}
      insert into public.comercios(id) values ('00000000-0000-4000-8000-000000000001'),
        ('00000000-0000-4000-8000-000000000002');
      insert into public.pedidos(id, comercio_id, modalidad, cliente_nombre, cliente_telefono,
        metodo_pago, subtotal, costo_envio, total)
      values ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001',
        'retiro', 'Histórico', '099000000', 'efectivo', 100, 0, 100);
    `);
    await db.exec(modelo);
    const historicoAntes = (await db.query("select * from public.pedidos")).rows[0];
    await t.test("RESTRICT conserva dependencias y revierte la migración completa si existen", async () => {
      await db.exec(`create view dependencia_checkout_prueba as
        select * from public.registrar_pedido_desde_checkout(
          null::uuid, 'retiro', 'Cliente', '099000000', null, null, null, null,
          'pago_en_local', 100, '[]'::jsonb, 0)`);
      await assert.rejects(db.exec(sql), error => error.code === "2BP01");
      await db.exec("rollback");
      const { rows: columnas } = await db.query(
        "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'pedidos' and column_name = 'descuento'",
      );
      assert.equal(columnas.length, 0);
      const { rows: vistas } = await db.query(
        "select viewname from pg_views where viewname = 'dependencia_checkout_prueba'",
      );
      assert.equal(vistas.length, 1);
      await db.exec("drop view dependencia_checkout_prueba restrict");
    });
    await db.exec(sql);

    const comercio = "00000000-0000-4000-8000-000000000001";
    const consultaRpc = `select * from public.registrar_pedido_desde_checkout(
      $1::uuid, $2::text, 'Cliente', '099000000', 'Calle', '1', null, null,
      $3::text, $4::numeric, $5::jsonb, $6::numeric)`;
    const registrar = (subtotal, envio, modalidad = "delivery", pago = "efectivo", items = []) =>
      db.query(consultaRpc, [comercio, modalidad, pago, subtotal, JSON.stringify(items), envio]);
    const configurar = (porcentaje, activa = true) => db.query(
      "update public.promociones set activa = $1, valor = $2 where comercio_id = $3",
      [activa, porcentaje, comercio],
    );
    const modulo = { exports: {} };
    const codigo = ts.transpileModule(
      fs.readFileSync(new URL("../src/lib/comercio/descuentos.ts", import.meta.url), "utf8"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } },
    ).outputText;
    vm.runInNewContext(codigo, { module: modulo, exports: modulo.exports });

    await t.test("Los 15 vectores coinciden con numeric SQL y TypeScript", async () => {
      for (const caso of casos) {
        const calculoSql = await db.query(
          `select ${expresion.replaceAll("p_subtotal", "$1::numeric").replaceAll("v_porcentaje", "$2::numeric")} as descuento`,
          [String(caso.subtotal), String(caso.porcentaje)],
        );
        const descuento = Number(calculoSql.rows[0].descuento);
        assert.equal(descuento, caso.descuento, caso.caso);
        const totalSql = await db.query("select $1::numeric - $2::numeric + $3::numeric as total",
          [String(caso.subtotal), String(descuento), String(caso.costoEnvio)]);
        assert.equal(Number(totalSql.rows[0].total), caso.total, caso.caso);
        const calculado = modulo.exports.calcularDescuentoPorcentual(caso);
        assert.equal(calculado.descuento, descuento);
        assert.equal(calculado.total, Number(totalSql.rows[0].total));
        if (caso.subtotal > 0) {
          await configurar(caso.porcentaje);
          const { rows: [pedido] } = await registrar(caso.subtotal, caso.costoEnvio);
          assert.equal(Number(pedido.descuento), caso.descuento, caso.caso);
          assert.equal(Number(pedido.total), caso.total, caso.caso);
        }
      }
    });
    await t.test("Históricos intactos y promoción aplicada preservada tras cambios", async () => {
      const { rows: [historia] } = await db.query("select * from pedidos where id = $1", [historicoAntes.id]);
      for (const [campo, valor] of Object.entries(historicoAntes)) assert.deepEqual(historia[campo], valor);
      assert.equal(Number(historia.descuento), 0);
      assert.equal(historia.promocion_id, null);
      await configurar(10);
      const { rows: [pedido] } = await registrar(123.45, 25.15);
      await db.query("update promociones set nombre = 'Otro nombre', valor = 90, activa = false where comercio_id = $1", [comercio]);
      const { rows: [guardado] } = await db.query("select * from pedidos where id = $1", [pedido.pedido_id]);
      assert.equal(guardado.promocion_nombre, pedido.promocion_nombre);
      assert.equal(Number(guardado.promocion_porcentaje), 10);
      assert.equal(Number(guardado.descuento), 12.35);
      assert.equal(Number(guardado.total), 136.25);
      const { rows: [sinPromo] } = await registrar(123.45, 25.15);
      assert.equal(sinPromo.promocion_id, null);
      assert.equal(Number(sinPromo.descuento), 0);
      assert.equal(Number(sinPromo.total), 148.6);
    });
    await t.test("Retiro 100%, POS y efectivo conservan modalidad, envío y estados", async () => {
      await configurar(100);
      for (const [modalidad, pago, envio] of [["retiro", "pago_en_local", 0], ["delivery", "efectivo", 50], ["delivery", "tarjeta_pos", 50]]) {
        const { rows: [pedido] } = await registrar(100, envio, modalidad, pago);
        assert.equal(Number(pedido.total), envio);
        assert.equal(Number(pedido.descuento), 100);
        const { rows: [guardado] } = await db.query("select estado, estado_pago, metodo_pago from pedidos where id = $1", [pedido.pedido_id]);
        assert.deepEqual(guardado, { estado: "pendiente", estado_pago: "pendiente", metodo_pago: pago });
      }
    });
    await t.test("Contrato rechaza combinaciones e importes inválidos y conserva atomicidad", async () => {
      for (const [subtotal, envio, modalidad, pago] of [
        [100, 1, "retiro", "pago_en_local"], [100, 0, "delivery", "pago_en_local"],
        [100, 0, "retiro", "efectivo"], [100, 0, "delivery", null],
        [0, 0, "retiro", "pago_en_local"], [-1, 0, "delivery", "efectivo"],
        ["NaN", 0, "delivery", "efectivo"], [100, "Infinity", "delivery", "efectivo"],
        [1.001, 0, "delivery", "efectivo"], [100, -1, "delivery", "efectivo"],
        [10000000000, 0, "delivery", "efectivo"],
      ]) await assert.rejects(registrar(subtotal, envio, modalidad, pago));
      await configurar(0);
      await assert.rejects(registrar(9999999999.99, 0.01));
      const antes = (await db.query("select count(*) as cantidad from pedidos")).rows[0].cantidad;
      await assert.rejects(registrar(100, 0, "retiro", "pago_en_local", [{
        producto_id: "00000000-0000-4000-8000-000000000004", producto_nombre: "Producto",
        cantidad: -1, precio_unitario: 100, subtotal: 100,
      }]));
      assert.equal((await db.query("select count(*) as cantidad from pedidos")).rows[0].cantidad, antes);
    });
    await t.test("Restricciones de instantánea y aislamiento por comercio", async () => {
      await configurar(0, true);
      const { rows: [pedido] } = await registrar(100, 0);
      assert.ok(pedido.promocion_id);
      assert.equal(Number(pedido.descuento), 0);
      const { rows: [ajena] } = await db.query("select id from promociones where comercio_id <> $1", [comercio]);
      await assert.rejects(db.query("update pedidos set promocion_id = $1 where id = $2", [ajena.id, pedido.pedido_id]));
      await assert.rejects(db.query("update pedidos set promocion_porcentaje = 1.5 where id = $1", [pedido.pedido_id]));
      await assert.rejects(db.query("update pedidos set descuento = 101 where id = $1", [pedido.pedido_id]));
      await assert.rejects(db.query("delete from promociones where id = $1", [pedido.promocion_id]));
    });
    await t.test("Falta de configuración o comercio inactivo no se convierten en descuento cero", async () => {
      const ajeno = "00000000-0000-4000-8000-000000000002";
      await db.query("delete from promociones where comercio_id = $1", [ajeno]);
      await assert.rejects(db.query(consultaRpc, [ajeno, "retiro", "pago_en_local", 100, "[]", 0]),
        error => error.code === "P0002");
      await db.query("update comercios set activo = false where id = $1", [comercio]);
      await assert.rejects(registrar(100, 0), error => error.code === "P0002");
      await db.query("update comercios set activo = true where id = $1", [comercio]);
    });
    await t.test("Permisos reales de la RPC y firma única", async () => {
      for (const rol of ["anon", "authenticated", "service_role"]) {
        const { rows: [permiso] } = await db.query(
          "select has_function_privilege($1, $2, 'execute') as permitido",
          [rol, `public.registrar_pedido_desde_checkout(${firma})`],
        );
        assert.equal(permiso.permitido, rol === "service_role");
      }
      const { rows } = await db.query("select pronargs, prosecdef, proconfig from pg_proc where proname = 'registrar_pedido_desde_checkout'");
      assert.equal(rows.length, 1);
      assert.equal(rows[0].pronargs, 12);
      assert.equal(rows[0].prosecdef, true);
      assert.ok(rows[0].proconfig.includes("search_path=pg_catalog, public"));
    });
  } finally {
    await db.close();
  }
});
