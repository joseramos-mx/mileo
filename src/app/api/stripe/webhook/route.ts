import { NextResponse } from "next/server";
import { verificarFirmaWebhookStripe } from "@/lib/stripe";
import { confirmarPagoDesdeStripe } from "@/lib/pagos";
import type { ModalidadEnvio, TipoPago } from "@/generated/prisma/enums";

export async function POST(peticion: Request) {
  const secreto = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secreto) {
    return NextResponse.json(
      { error: "Falta STRIPE_WEBHOOK_SECRET." },
      { status: 500 },
    );
  }

  const cuerpoCrudo = await peticion.text();
  const firma = peticion.headers.get("stripe-signature");

  if (!verificarFirmaWebhookStripe(cuerpoCrudo, firma, secreto)) {
    return NextResponse.json(
      { error: "Firma de Stripe inválida." },
      { status: 400 },
    );
  }

  const evento = JSON.parse(cuerpoCrudo) as {
    type?: string;
    data?: {
      object?: {
        id?: string;
        payment_status?: string;
        payment_intent?: string | null;
        amount_total?: number | null;
        metadata?: Record<string, string>;
      };
    };
  };

  if (
    evento.type === "checkout.session.completed" ||
    evento.type === "checkout.session.async_payment_succeeded"
  ) {
    const sesion = evento.data?.object;
    const meta = sesion?.metadata ?? {};

    if (
      sesion?.id &&
      sesion.payment_status === "paid" &&
      meta.casoId &&
      (meta.tipo === "ANTICIPO" || meta.tipo === "LIQUIDACION")
    ) {
      const modalidad =
        meta.modalidadEnvio === "LOCAL" ||
        meta.modalidadEnvio === "NACIONAL" ||
        meta.modalidadEnvio === "RECOLECCION"
          ? (meta.modalidadEnvio as ModalidadEnvio)
          : null;

      await confirmarPagoDesdeStripe({
        sessionId: sesion.id,
        paymentIntentId: sesion.payment_intent ?? null,
        casoId: meta.casoId,
        tipo: meta.tipo as TipoPago,
        montoCentavos: Number(meta.montoCentavos || sesion.amount_total || 0),
        envioCentavos: Number(meta.envioCentavos || 0),
        modalidadEnvio: modalidad,
        enviaCarrier: meta.enviaCarrier || null,
        enviaServicio: meta.enviaServicio || null,
        enviaServicioNombre: meta.enviaServicioNombre || null,
      });
    }
  }

  return NextResponse.json({ recibido: true });
}

