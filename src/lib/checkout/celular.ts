// Normaliza un dato de contacto; no verifica identidad ni inicia una sesión.
export function normalizarCelularUruguayo(valor: string): string | null {
  const texto = valor.trim();
  if (!/^\+?[\d\s()-]+$/.test(texto)) return null;
  const digitos = texto.replace(/[\s()-]/g, "");
  if (/^09\d{7}$/.test(digitos)) return `+598${digitos.slice(1)}`;
  if (/^9\d{7}$/.test(digitos)) return `+598${digitos}`;
  if (/^\+?5989\d{7}$/.test(digitos)) return `+${digitos.replace(/^\+/, "")}`;
  return null;
}
