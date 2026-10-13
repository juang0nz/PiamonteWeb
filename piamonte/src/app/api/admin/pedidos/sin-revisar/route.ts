import { NextResponse } from "next/server";
import { obtenerEstadoAccesoAdmin } from "@/lib/admin/auth";
import { createPrivateClient } from "@/lib/supabase/private";

type PedidoSinRevisarRow = {
  id: string;
  numero: number;
  modalidad: string;
  creado_en: string;
};

// Cantidad máxima de avisos simultáneos; evita respuestas enormes si se acumulan pedidos.
const LIMITE_NOTIFICACIONES = 50;

// Lista los pedidos cuya notificación todavía no fue marcada como vista.
// Es la fuente de verdad del panel: se consulta al abrir y cada vez que Realtime avisa.
export async function GET() {
  const acceso = await obtenerEstadoAccesoAdmin();
  if (!acceso.autenticado) {
    return NextResponse.json(
      { error: "No autenticado para consultar pedidos administrativos." },
      { status: 401 },
    );
  }
  if (!acceso.autorizado) {
    return NextResponse.json(
      { error: "No autorizado para consultar pedidos de este comercio." },
      { status: 403 },
    );
  }

  const supabase = createPrivateClient();
  const { data, error } = await supabase
    .from("pedidos")
    .select("id, numero, modalidad, creado_en")
    .eq("comercio_id", acceso.comercioId)
    .is("revisado_en", null)
    .order("creado_en", { ascending: false })
    .limit(LIMITE_NOTIFICACIONES);

  if (error) {
    console.error("Error al consultar pedidos sin revisar:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    // 42703: la columna todavía no existe porque falta aplicar la migración.
    if (error.code === "42703") {
      return NextResponse.json(
        {
          error:
            "Falta aplicar en Supabase la migración de notificaciones de pedidos.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "No pudimos consultar los pedidos sin revisar." },
      { status: 500 },
    );
  }

  const pedidos = (data ?? []) as PedidoSinRevisarRow[];

  return NextResponse.json(
    {
      pedidos: pedidos.map((pedido) => ({
        id: pedido.id,
        numero: pedido.numero,
        modalidad: pedido.modalidad,
        creadoEn: pedido.creado_en,
      })),
    },
    { status: 200 },
  );
}
