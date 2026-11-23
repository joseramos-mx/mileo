import "server-only";
import crypto from "node:crypto";

/**
 * Cliente ligero para Stripe Checkout y Webhooks usando `fetch` y `node:crypto`
 * nativos (sin dependencias externas).
 */

export type SesionCheckoutCreada = {
  id: string;
  url: string;
};

export type SesionCheckoutLeida = {
  id: string;
  payment_status: string;
  status: string;
  payment_intent: string | null;
  amount_total: number | null;
  metadata: Record<string, string>;
};

function claveSecreta(): string {
  const clave = process.env.STRIPE_SECRET_KEY?.trim();
  if (!clave) {
    throw new Error("Falta configurar STRIPE_SECRET_KEY en el entorno.");
  }
  return clave;
}

export function tieneStripe(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export async function crearSesionCheckout({
  nombreProducto,
  descripcion,
  montoCentavos,
  correoCliente,
  urlExito,
  urlCancelacion,
  metadata,
}: {
  nombreProducto: string;
  descripcion: string;
  montoCentavos: number;
  correoCliente?: string | null;
  urlExito: string;
  urlCancelacion: string;
  metadata: Record<string, string>;
}): Promise<SesionCheckoutCreada> {
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("allow_promotion_codes", "true");
  params.set("success_url", urlExito);
  params.set("cancel_url", urlCancelacion);
  params.set("line_items[0][price_data][currency]", "mxn");
  params.set("line_items[0][price_data][unit_amount]", String(montoCentavos));
  params.set("line_items[0][price_data][product_data][name]", nombreProducto);
  params.set("line_items[0][price_data][product_data][description]", descripcion);
  params.set("line_items[0][quantity]", "1");

  if (correoCliente) {
    params.set("customer_email", correoCliente);
  }

  for (const [k, v] of Object.entries(metadata)) {
    params.set(`metadata[${k}]`, v);
  }

  const respuesta = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${claveSecreta()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
    cache: "no-store",
  });

  const datos = (await respuesta.json()) as {
    id?: string;
    url?: string;
    error?: { message?: string };
  };

  if (!respuesta.ok || !datos.id || !datos.url) {
    throw new Error(
      datos.error?.message ?? "No pude iniciar la sesión de pago en Stripe.",
    );
  }

  return { id: datos.id, url: datos.url };
}

export async function obtenerSesionCheckout(
  sessionId: string,
): Promise<SesionCheckoutLeida> {
  const respuesta = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${claveSecreta()}`,
      },
      cache: "no-store",
    },
  );

  const datos = (await respuesta.json()) as SesionCheckoutLeida & {
    error?: { message?: string };
  };

  if (!respuesta.ok) {
    throw new Error(
      datos.error?.message ?? "No pude consultar el estado del pago en Stripe.",
    );
  }

  return datos;
}

/**
 * Verifica la cabecera `Stripe-Signature` (`t=...,v1=...`) con HMAC-SHA256.
 */
export function verificarFirmaWebhookStripe(
  cuerpoCrudo: string,
  cabeceraFirma: string | null,
  secreto: string,
): boolean {
  if (!cabeceraFirma || !secreto) return false;

  const partes = cabeceraFirma.split(",");
  let timestamp = "";
  const firmasV1: string[] = [];

  for (const parte of partes) {
    const [clave, valor] = parte.split("=", 2);
    if (clave === "t" && valor) timestamp = valor;
    if (clave === "v1" && valor) firmasV1.push(valor);
  }

  if (!timestamp || firmasV1.length === 0) return false;

  // Tolerancia de 5 minutos para evitar ataques de repetición.
  const ahoraSeg = Math.floor(Date.now() / 1000);
  const tsNum = Number(timestamp);
  if (!Number.isFinite(tsNum) || Math.abs(ahoraSeg - tsNum) > 300) {
    return false;
  }

  const cargaFirmada = `${timestamp}.${cuerpoCrudo}`;
  const esperada = crypto
    .createHmac("sha256", secreto)
    .update(cargaFirmada, "utf8")
    .digest("hex");

  const bufEsperada = Buffer.from(esperada, "hex");

  return firmasV1.some((firma) => {
    try {
      const bufFirma = Buffer.from(firma, "hex");
      return (
        bufFirma.length === bufEsperada.length &&
        crypto.timingSafeEqual(bufFirma, bufEsperada)
      );
    } catch {
      return false;
    }
  });
}

