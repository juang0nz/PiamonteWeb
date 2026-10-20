export function etiquetaMetodoPago(metodo: string): string {
  switch (metodo) {
    case "efectivo": return "Efectivo";
    case "tarjeta_pos": return "Tarjeta (POS)";
    case "pago_en_local": return "Pago en el local";
    default: return `Método histórico: ${metodo}`;
  }
}

export function requierePos(modalidad: string, metodo: string): boolean {
  return modalidad === "delivery" && metodo === "tarjeta_pos";
}
