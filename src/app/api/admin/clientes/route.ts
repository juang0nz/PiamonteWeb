import { NextResponse } from "next/server";
import { obtenerEstadoAccesoAdmin } from "@/lib/admin/auth";
import { createPrivateClient } from "@/lib/supabase/private";
import { agruparClientes, type PedidoClienteFila } from "@/lib/admin/clientes";

const TAMANO_PAGINA = 500;

export async function GET() {
  const acceso = await obtenerEstadoAccesoAdmin();
  if (!acceso.autenticado) {
    return NextResponse.json({ error: "Iniciá sesión para consultar clientes." }, { status: 401 });
  }
  if (!acceso.autorizado || acceso.rol === "empleado") {
    return NextResponse.json({ error: "No tenés autorización para consultar clientes de este comercio." }, { status: 403 });
  }
  try {
    const supabase = createPrivateClient();
    const pedidos: PedidoClienteFila[] = [];
    // No limita el resumen a los últimos 200 pedidos del panel operativo.
    for (let desde = 0; ; desde += TAMANO_PAGINA) {
      const { data, error } = await supabase.from("pedidos")
        .select("id, numero, creado_en, cliente_nombre, cliente_telefono, modalidad, direccion_calle, direccion_numero, direccion_apartamento, direccion_referencias, estado, total")
        .eq("comercio_id", acceso.comercioId)
        .order("creado_en", { ascending: true }).order("id", { ascending: true })
        .range(desde, desde + TAMANO_PAGINA - 1)
        .returns<PedidoClienteFila[]>();
      if (error || !data) {
        console.error("No se pudieron consultar clientes del comercio:", error?.code);
        return NextResponse.json({ error: "No pudimos cargar los clientes. Intentá nuevamente." }, { status: 500 });
      }
      pedidos.push(...data);
      if (data.length < TAMANO_PAGINA) break;
    }
    return NextResponse.json(agruparClientes(pedidos), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Error al preparar clientes administrativos:", error instanceof Error ? error.message : "Error desconocido");
    return NextResponse.json({ error: "No pudimos preparar los datos de clientes." }, { status: 500 });
  }
}
