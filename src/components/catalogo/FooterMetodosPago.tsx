import Image from "next/image";
import { MERCADO_PAGO_DISPONIBLE_EN_CHECKOUT } from "@/lib/pagos/configuracion";

export function FooterMetodosPago() {
  return (
    <footer className="mt-8 border-t border-crema/15 py-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-crema/55">
        Métodos de pago
      </p>
      {MERCADO_PAGO_DISPONIBLE_EN_CHECKOUT && (
        <Image
          src="/brand/mercado-pago.svg"
          alt="Mercado Pago"
          width={32}
          height={32}
          className="mx-auto mt-3 h-8 w-8 object-contain"
        />
      )}
    </footer>
  );
}
