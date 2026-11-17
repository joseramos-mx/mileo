import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { usuarioActual } from "@/lib/sesion";
import { filtroDeCasos } from "@/lib/autorizacion";
import { crearSesionCheckout, tieneStripe } from "@/lib/stripe";
import {
  calcularPartesDePago,
  costoPorModalidad,
  extraerTotalDeCotizacion,
  obtenerCostosEnvio,
} from "@/lib/pagos";

const esquema = z.object({
  casoId: z.string().min(1),
  tipo: z.enum(["ANTICIPO", "LIQUIDACION"]),
  modalidadEnvio: z.enum(["LOCAL", "NACIONAL", "RECOLECCION"]).optional(),
  enviaCarrier: z.string().trim().max(80).optional(),
  enviaServicio: z.string().trim().max(80).optional(),
  enviaServicioNombre: z.string().trim().max(160).optional(),
  enviaCostoCentavos: z.number().int().positive().optional(),
});

function urlBase(peticion: Request): string {
  const origen = new URL(peticion.url).origin;
  if (origen) return origen;
  if (process.env.MILEO_URL) return process.env.MILEO_URL.replace(/\/+$/, "");
  return "http://localhost:3000";
}

export async function POST(peticion: Request) {
  if (!tieneStripe()) {
    return NextResponse.json(
      { error: "Stripe no está configurado en el servidor." },
      { status: 503 },
    );
  }

  const usuario = await usuarioActual();
  if (!usuario) {
    return NextResponse.json(
      { error: "Necesita iniciar sesión en Mileo." },
      { status: 401 },
    );
  }

  const cuerpo = await peticion.json().catch(() => null);
  const leido = esquema.safeParse(cuerpo);
  if (!leido.success) {
    return NextResponse.json(
      { error: "Datos de pago inválidos." },
      { status: 400 },
    );
  }

  const {
    casoId,
    tipo,
    modalidadEnvio,
    enviaCarrier,
    enviaServicio,
    enviaServicioNombre,
    enviaCostoCentavos,
  } = leido.data;

  const caso = await prisma.caso.findFirst({
    where: { id: casoId, ...filtroDeCasos(usuario) },
    select: {
      id: true,
      folio: true,
      etapa: true,
      cotizacion: true,
      montoTotalCentavos: true,
      anticipoCentavos: true,
      anticipoPagadoEn: true,
      liquidacionPagadaEn: true,
    },
  });

  if (!caso) {
    return NextResponse.json(
      { error: "No encuentro ese caso." },
      { status: 404 },
    );
  }

  const totalCentavos =
    caso.montoTotalCentavos ?? extraerTotalDeCotizacion(caso.cotizacion);
  if (!totalCentavos || totalCentavos <= 0) {
    return NextResponse.json(
      { error: "Este caso todavía no tiene un precio asignado." },
      { status: 409 },
    );
  }

  const partes = calcularPartesDePago(totalCentavos);
  let montoACobrar = 0;
  let envioCentavos = 0;
  let nombreProducto = "";
  let descripcion = "";

  if (tipo === "ANTICIPO") {
    if (caso.anticipoPagadoEn) {
      return NextResponse.json(
        { error: "El anticipo de este caso ya fue pagado." },
        { status: 409 },
      );
    }
    if (caso.etapa !== "ESPERANDO_PAGO" && caso.etapa !== "EN_PAUSA") {
      return NextResponse.json(
        { error: "Este caso no está esperando anticipo." },
        { status: 409 },
      );
    }

    montoACobrar = partes.anticipoCentavos;
    nombreProducto = `Anticipo 50% · Caso ${caso.folio}`;
    descripcion = "Pago inicial del 50% para liberar el inicio de diseño 3D.";
  } else {
    if (caso.liquidacionPagadaEn) {
      return NextResponse.json(
        { error: "La liquidación de este caso ya fue pagada." },
        { status: 409 },
      );
    }
    if (caso.etapa !== "ESPERANDO_LIQUIDACION") {
      return NextResponse.json(
        { error: "Este caso todavía no está listo para liquidación." },
        { status: 409 },
      );
    }
    if (!modalidadEnvio) {
      return NextResponse.json(
        { error: "Seleccione la modalidad de envío." },
        { status: 400 },
      );
    }

    const costosEnvio = await obtenerCostosEnvio();
    const usaTarifaEnvia =
      modalidadEnvio !== "RECOLECCION" &&
      Boolean(enviaCarrier && enviaServicio && enviaCostoCentavos);

    envioCentavos = usaTarifaEnvia
      ? enviaCostoCentavos!
      : costoPorModalidad(modalidadEnvio, costosEnvio);

    const restante =
      totalCentavos - (caso.anticipoCentavos ?? partes.anticipoCentavos);
    montoACobrar = restante + envioCentavos;

    const textoEnvio = usaTarifaEnvia
      ? `Envío ${enviaServicioNombre || enviaCarrier!.toUpperCase()}`
      : modalidadEnvio === "LOCAL"
        ? "Envío local"
        : modalidadEnvio === "NACIONAL"
          ? "Envío nacional"
          : "Recolección en sucursal ($0)";

    nombreProducto = `Liquidación 50% + envío · Caso ${caso.folio}`;
    descripcion = `50% restante del trabajo + ${textoEnvio}.`;
  }

  const base = urlBase(peticion);
  const sesion = await crearSesionCheckout({
    nombreProducto,
    descripcion,
    montoCentavos: montoACobrar,
    correoCliente: usuario.correo,
    urlExito: `${base}/casos/${caso.id}?pago=exito&session_id={CHECKOUT_SESSION_ID}`,
    urlCancelacion: `${base}/casos/${caso.id}?pago=cancelado`,
    metadata: {
      casoId: caso.id,
      tipo,
      montoCentavos: String(montoACobrar),
      envioCentavos: String(envioCentavos),
      modalidadEnvio: modalidadEnvio ?? "",
      enviaCarrier: enviaCarrier ?? "",
      enviaServicio: enviaServicio ?? "",
      enviaServicioNombre: enviaServicioNombre ?? "",
    },
  });

  await prisma.pago.create({
    data: {
      casoId: caso.id,
      tipo,
      estado: "PENDIENTE",
      montoCentavos: montoACobrar,
      envioCentavos,
      modalidadEnvio: modalidadEnvio ?? null,
      stripeSessionId: sesion.id,
    },
  });

  return NextResponse.json({ url: sesion.url });
}

