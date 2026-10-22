import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const codigo = ts.transpileModule(
  fs.readFileSync(new URL("../src/lib/comercio/descuentos.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } },
).outputText;
const modulo = { exports: {} };
// Sin require, navegador o Supabase: el cálculo debe funcionar de forma independiente.
vm.runInNewContext(codigo, { exports: modulo.exports, module: modulo });
const { calcularDescuentoPorcentual } = modulo.exports;
const casos = JSON.parse(fs.readFileSync(new URL("./fixtures/descuentos-porcentuales.json", import.meta.url), "utf8"));
const base = { subtotal: 100, costoEnvio: 10, porcentaje: 10 };

for (const { caso, subtotal, costoEnvio, porcentaje, descuento, total } of casos) {
  test(`Descuento: ${caso}`, () => {
    const entrada = Object.freeze({ subtotal, costoEnvio, porcentaje });
    const resultado = calcularDescuentoPorcentual(entrada);
    assert.deepEqual({ ...resultado }, { subtotal, descuento, costoEnvio, total });
    assert.deepEqual({ ...calcularDescuentoPorcentual(entrada) }, { ...resultado });
  });
}

test("Rechaza porcentajes fraccionarios, fuera de rango, no finitos y tipos inválidos", () => {
  for (const porcentaje of [-1, 101, 0.1, 99.99, NaN, Infinity, -Infinity, "10", null, undefined, true]) {
    assert.throws(() => calcularDescuentoPorcentual({ ...base, porcentaje }), { name: "RangeError" });
  }
});

test("Rechaza importes negativos, fracciones de centésimo, no finitos y tipos inválidos", () => {
  for (const campo of ["subtotal", "costoEnvio"]) {
    for (const valor of [-0.01, 0.001, 1.005, 0.1 + 0.2, 1e-7, 10000000000, Number.MAX_VALUE, NaN, Infinity, -Infinity, "10", null, undefined, true]) {
      assert.throws(() => calcularDescuentoPorcentual({ ...base, [campo]: valor }), { name: "RangeError" });
    }
  }
});

test("Rechaza total fuera de numeric(12,2), incluso por un centésimo", () => {
  for (const costoEnvio of [0.01, 9999999999.99]) {
    assert.throws(
      () => calcularDescuentoPorcentual({ subtotal: 9999999999.99, costoEnvio, porcentaje: 0 }),
      { name: "RangeError" },
    );
  }
});

test("Todos los porcentajes conservan envío y respetan el redondeo entero", () => {
  for (let porcentaje = 0; porcentaje <= 100; porcentaje++) {
    for (const centimos of [0, 1, 5, 15, 29, 101, 12345, 999999999999]) {
      const resultado = calcularDescuentoPorcentual({ subtotal: centimos / 100, costoEnvio: 0, porcentaje });
      const descuento = (BigInt(centimos) * BigInt(porcentaje) + BigInt(50)) / BigInt(100);
      assert.equal(resultado.descuento, Number(descuento) / 100);
      assert.equal(resultado.total, Number(BigInt(centimos) - descuento) / 100);
      assert.ok(resultado.descuento >= 0 && resultado.descuento <= resultado.subtotal);
      const conEnvio = calcularDescuentoPorcentual({ subtotal: centimos / 100, costoEnvio: 0.01, porcentaje: 100 });
      assert.equal(conEnvio.descuento, centimos / 100);
      assert.equal(conEnvio.total, 0.01);
    }
  }
});
