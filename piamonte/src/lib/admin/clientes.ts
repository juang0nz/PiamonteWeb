import { normalizarCelularUruguayo } from "@/lib/checkout/celular";

export type PedidoClienteFila = {
  id: string;
  numero: number;
  creado_en: string;
  cliente_nombre: string;
  cliente_telefono: string | null;
  modalidad: string;
  direccion_calle: string | null;
  direccion_numero: string | null;
  direccion_apartamento: string | null;
  direccion_referencias: string | null;
  estado: string;
  total: number | string;
};

export type ClienteAdmin = {
  nombre: string;
  telefono: string;
  telefonoValido: boolean;
  cantidadPedidos: number;
  pedidosNoCancelados: number;
  ultimoPedido: string;
  importeAcumulado: number;
  direccion: {
    calle: string;
    numero: string | null;
    apartamento: string | null;
    referencias: string | null;
  } | null;
  pedidos: Array<{
    id: string;
    numero: number;
    fecha: string;
    estado: string;
    total: number;
    cancelado: boolean;
  }>;
};

export function agruparClientes(pedidos: PedidoClienteFila[]): {
  clientes: ClienteAdmin[]; pedidosSinTelefono: number;
} {
  const grupos = new Map<string, ClienteAdmin>();
  let pedidosSinTelefono = 0;
  const ordenados = [...pedidos].sort((a, b) =>
    Date.parse(b.creado_en) - Date.parse(a.creado_en) || b.numero - a.numero || b.id.localeCompare(a.id),
  );
  for (const pedido of ordenados) {
    const crudo = pedido.cliente_telefono?.trim();
    if (!crudo) { pedidosSinTelefono++; continue; }
    const normalizado = normalizarCelularUruguayo(crudo);
    const telefono = normalizado ?? crudo;
    let cliente = grupos.get(telefono);
    if (!cliente) {
      cliente = {
        nombre: pedido.cliente_nombre, telefono, telefonoValido: normalizado !== null,
        cantidadPedidos: 0, pedidosNoCancelados: 0, ultimoPedido: pedido.creado_en,
        importeAcumulado: 0, direccion: null, pedidos: [],
      };
      grupos.set(telefono, cliente);
    }
    if (!cliente.direccion && pedido.modalidad === "delivery" && pedido.direccion_calle?.trim()) {
      cliente.direccion = {
        calle: pedido.direccion_calle, numero: pedido.direccion_numero,
        apartamento: pedido.direccion_apartamento, referencias: pedido.direccion_referencias,
      };
    }
    const cancelado = ["cancelado", "cancelados"].includes(pedido.estado.trim().toLowerCase());
    const total = Number(pedido.total);
    if (!Number.isFinite(total) || total < 0) throw new Error("Un pedido contiene un importe inválido.");
    cliente.cantidadPedidos++;
    if (!cancelado) {
      cliente.pedidosNoCancelados++;
      cliente.importeAcumulado = Math.round((cliente.importeAcumulado + total) * 100) / 100;
    }
    cliente.pedidos.push({
      id: pedido.id, numero: pedido.numero, fecha: pedido.creado_en,
      estado: pedido.estado, total, cancelado,
    });
  }
  return { clientes: [...grupos.values()], pedidosSinTelefono };
}

export function filtrarClientes(clientes: ClienteAdmin[], busqueda: string): ClienteAdmin[] {
  const normalizarTexto = (valor: string) => valor.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
  const termino = normalizarTexto(busqueda);
  const telefono = normalizarCelularUruguayo(busqueda);
  let digitos = termino.replace(/[\s()+-]/g, "");
  if (/^09\d*$/.test(digitos)) digitos = digitos.slice(1);
  return clientes.filter(cliente =>
    normalizarTexto(cliente.nombre).includes(termino) ||
    (telefono !== null && cliente.telefono === telefono) ||
    (!!digitos && cliente.telefono.replace(/[\s()+-]/g, "").includes(digitos)),
  );
}
