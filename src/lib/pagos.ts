import "server-only";
import { prisma } from "@/lib/prisma";
import { registrarEvento } from "@/lib/bitacora";
import {
  construirDestinoDesdeClinica,
  generarGuiaEnvia,
  tieneEnvia,
} from "@/lib/envia";
import type { ModalidadEnvio, TipoPago } from "@/generated/prisma/enums";

export type CostosEnvio = {
  localCentavos: number;
  nacionalCentavos: number;
  recoleccionCentavos: number;
};

export async function obtenerCostosEnvio(): Promise<CostosEnvio> {
  const ajustes = await prisma.ajustesDeCotizacion.findUnique({
    where: { id: "unica" },
    select: {
      envioLocalCentavos: true,
      envioNacionalCentavos: true,
    },
  });

  return {
    localCentavos: ajustes?.envioLocalCentavos ?? 5000,
    nacionalCentavos: ajustes?.envioNacionalCentavos ?? 15000,
    recoleccionCentavos: 0,
  };
}

export function costoPorModalidad(
  modalidad: ModalidadEnvio,
  costos: CostosEnvio,
): number {
  if (modalidad === "LOCAL") return costos.localCentavos;
  if (modalidad === "NACIONAL") return costos.nacionalCentavos;
  return costos.recoleccionCentavos;
}

export function extraerTotalDeCotizacion(cotizacion: unknown): number | null {
  if (!cotizacion || typeof cotizacion !== "object") return null;
  const obj = cotizacion as Record<string, unknown>;
  if (typeof obj.sinPrecio === "number" && obj.sinPrecio > 0) return null;
  if (obj.recargoPorConfirmar === true) return null;
  if (typeof obj.totalCentavos === "number" && obj.totalCentavos > 0) {
    return obj.totalCentavos;
  }
  return null;
}

export function calcularPartesDePago(totalCentavos: number) {
  const anticipoCentavos = Math.round(totalCentavos / 2);
  const restanteCentavos = totalCentavos - anticipoCentavos;
  return { totalCentavos, anticipoCentavos, restanteCentavos };
}

export function formatoPesos(centavos: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: centavos % 100 === 0 ? 0 : 2,
  }).format(centavos / 100);
}

/**
 * Confirma de forma idempotente un pago de Stripe (anticipo 50% o liquidación
 * 50% + envío) tanto desde el Webhook como al regresar del Checkout.
 */
export async function confirmarPagoDesdeStripe({
  sessionId,
  paymentIntentId,
  casoId,
  tipo,
  montoCentavos,
  envioCentavos = 0,
  modalidadEnvio,
  enviaCarrier,
  enviaServicio,
  enviaServicioNombre,
}: {
  sessionId: string;
  paymentIntentId?: string | null;
  casoId: string;
  tipo: TipoPago;
  montoCentavos: number;
  envioCentavos?: number;
  modalidadEnvio?: ModalidadEnvio | null;
  enviaCarrier?: string | null;
  enviaServicio?: string | null;
  enviaServicioNombre?: string | null;
}): Promise<boolean> {
  const confirmado = await prisma.$transaction(async (bd) => {
    const pagoExistente = await bd.pago.findUnique({
      where: { stripeSessionId: sessionId },
    });

    if (pagoExistente?.estado === "PAGADO") {
      return false;
    }

    const caso = await bd.caso.findUnique({
      where: { id: casoId },
      select: {
        id: true,
        folio: true,
        etapa: true,
        montoTotalCentavos: true,
        anticipoPagadoEn: true,
        liquidacionPagadaEn: true,
      },
    });
    if (!caso) return false;

    const ahora = new Date();

    if (pagoExistente) {
      await bd.pago.update({
        where: { id: pagoExistente.id },
        data: {
          estado: "PAGADO",
          stripePaymentIntentId: paymentIntentId ?? null,
          pagadoEn: ahora,
        },
      });
    } else {
      await bd.pago.create({
        data: {
          casoId: caso.id,
          tipo,
          estado: "PAGADO",
          montoCentavos,
          envioCentavos,
          modalidadEnvio: modalidadEnvio ?? null,
          stripeSessionId: sessionId,
          stripePaymentIntentId: paymentIntentId ?? null,
          pagadoEn: ahora,
        },
      });
    }

    if (tipo === "ANTICIPO" && !caso.anticipoPagadoEn) {
      const nuevaEtapa =
        caso.etapa === "ESPERANDO_PAGO" || caso.etapa === "EN_PAUSA"
          ? "EN_DISENO"
          : caso.etapa;

      await bd.caso.update({
        where: { id: caso.id },
        data: {
          anticipoCentavos: montoCentavos,
          anticipoPagadoEn: ahora,
          etapa: nuevaEtapa,
          enRiesgo: false,
          motivoRiesgo: null,
        },
      });

      await registrarEvento(bd, {
        tipo: "PAGO_REGISTRADO",
        resumen: `Se confirmó el anticipo del 50% (${formatoPesos(montoCentavos)}) para el caso ${caso.folio}. El caso pasa a diseño.`,
        casoId: caso.id,
        etapaAnterior: caso.etapa,
        etapaNueva: nuevaEtapa,
        datos: { tipo, montoCentavos, sessionId },
      });
    } else if (tipo === "LIQUIDACION" && !caso.liquidacionPagadaEn) {
      const nuevaEtapa =
        caso.etapa === "ESPERANDO_LIQUIDACION"
          ? "LISTO_Y_EN_CAMINO"
          : caso.etapa;

      await bd.caso.update({
        where: { id: caso.id },
        data: {
          etapa: nuevaEtapa,
          liquidacionCentavos: montoCentavos,
          liquidacionPagadaEn: ahora,
          modalidadEnvio: modalidadEnvio ?? null,
          costoEnvioCentavos: envioCentavos,
          enviaCarrier: enviaCarrier ?? null,
          enviaServicio: enviaServicio ?? null,
          enviaServicioNombre: enviaServicioNombre ?? null,
          enRiesgo: false,
          motivoRiesgo: null,
        },
      });

      await registrarEvento(bd, {
        tipo: "PAGO_REGISTRADO",
        resumen: `Se confirmó la liquidación final (${formatoPesos(montoCentavos)}, incluye envío) para el caso ${caso.folio}. Listo para entrega/despacho.`,
        casoId: caso.id,
        etapaAnterior: caso.etapa,
        etapaNueva: nuevaEtapa,
        datos: {
          tipo,
          montoCentavos,
          envioCentavos,
          modalidadEnvio: modalidadEnvio ?? null,
          enviaCarrier: enviaCarrier ?? null,
          enviaServicio: enviaServicio ?? null,
          sessionId,
        },
      });
    }

    return true;
  });

  if (
    confirmado &&
    tipo === "LIQUIDACION" &&
    modalidadEnvio !== "RECOLECCION" &&
    enviaCarrier &&
    enviaServicio &&
    tieneEnvia()
  ) {
    try {
      const casoEnvio = await prisma.caso.findUnique({
        where: { id: casoId },
        select: {
          id: true,
          folio: true,
          numeroGuia: true,
          clinica: {
            select: {
              nombre: true,
              ciudad: true,
              codigoPostal: true,
              calle: true,
              numeroExterior: true,
              colonia: true,
              estadoEnvio: true,
              telefonoEnvio: true,
              correoEnvio: true,
            },
          },
          doctor: {
            select: {
              nombreCompleto: true,
              correo: true,
              telefono: true,
            },
          },
        },
      });

      if (casoEnvio && !casoEnvio.numeroGuia) {
        const destino = construirDestinoDesdeClinica(
          casoEnvio.clinica,
          casoEnvio.doctor,
        );
        if (destino) {
          const guia = await generarGuiaEnvia({
            destination: destino,
            carrier: enviaCarrier,
            service: enviaServicio,
            folioCaso: casoEnvio.folio,
          });

          await prisma.$transaction(async (bd) => {
            await bd.caso.update({
              where: { id: casoEnvio.id },
              data: {
                enviaShipmentId: guia.shipmentId,
                numeroGuia: guia.trackingNumber,
                urlEtiquetaPdf: guia.labelUrl,
                urlRastreo: guia.trackUrl,
              },
            });
            await registrarEvento(bd, {
              tipo: "CASO_ACTUALIZADO",
              resumen: `Guía de envío generada automáticamente en Envia.com (${guia.carrier.toUpperCase()} · ${guia.trackingNumber}).`,
              casoId: casoEnvio.id,
              datos: {
                carrier: guia.carrier,
                service: guia.service,
                trackingNumber: guia.trackingNumber,
                shipmentId: guia.shipmentId,
              },
            });
          });
        }
      }
    } catch {
      // Si Envia.com falla temporalmente, el pago ya quedó confirmado y el
      // laboratorio puede reintentar la generación de la guía desde el caso.
    }
  }

  return confirmado;
}
