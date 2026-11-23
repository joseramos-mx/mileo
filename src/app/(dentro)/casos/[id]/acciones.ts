"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  exigirUsuario,
  filtroDeCasos,
  puedeAprobarDisenos,
  puedeMoverEtapas,
} from "@/lib/autorizacion";
import { registrarEvento } from "@/lib/bitacora";
import { calcularFechaDeEntrega, sePuedeFabricar } from "@/lib/etapas";
import { derivarMallaLigera, type ResumenDeMalla } from "@/lib/malla";
import { avisarA, avisoDeCambioDeEtapa } from "@/lib/avisos";
import { empujarTicketARaspberry } from "@/lib/ticket";
import {
  calcularPartesDePago,
  confirmarPagoDesdeStripe,
  extraerTotalDeCotizacion,
  formatoPesos,
} from "@/lib/pagos";
import { obtenerSesionCheckout } from "@/lib/stripe";
import type { Etapa, ModalidadEnvio, TipoPago } from "@/generated/prisma/enums";

export type Resultado = { error?: string; listo?: boolean };

async function casoDelUsuario(casoId: string) {
  const usuario = await exigirUsuario();
  const caso = await prisma.caso.findFirst({
    where: { id: casoId, ...filtroDeCasos(usuario) },
    include: {
      aprobaciones: { orderBy: { creadoEn: "desc" } },
      archivos: { orderBy: { creadoEn: "desc" } },
      doctor: { select: { nombreCompleto: true } },
      paciente: { select: { folio: true, iniciales: true } },
      controlDeCalidad: { select: { id: true } },
    },
  });
  return { usuario, caso };
}

// ------------------------------------------------------- aprobar / ajustar

const esquemaAjuste = z.object({
  comentario: z
    .string()
    .trim()
    .min(
      10,
      "Cuénteme qué hay que ajustar. Con dos renglones su técnico ya sabe qué hacer.",
    )
    .max(2000),
});

/**
 * El doctor aprueba el diseño (SKILL.md O-4).
 * Es la única puerta hacia fabricación: sin este registro no se fabrica nada.
 */
export async function aprobarDiseno(
  casoId: string,
  archivoDisenoId?: string,
): Promise<Resultado> {
  const { usuario, caso } = await casoDelUsuario(casoId);
  if (!caso) return { error: "No encuentro ese caso." };

  if (!puedeAprobarDisenos(usuario)) {
    return {
      error:
        "La aprobación del diseño la hace el doctor. Avísele y él la registra.",
    };
  }
  if (caso.etapa !== "ESPERANDO_APROBACION") {
    return { error: "Este caso no está esperando aprobación ahora mismo." };
  }

  const disenosCompletos = caso.archivos.filter(
    (a) => a.tipo === "DISENO" && a.estado === "COMPLETO",
  );
  if (disenosCompletos.length === 0) {
    return { error: "Todavía no hay un diseño que aprobar." };
  }
  const diseno = archivoDisenoId
    ? disenosCompletos.find((a) => a.id === archivoDisenoId)
    : disenosCompletos[0];
  if (!diseno) {
    return {
      error:
        "Su técnico mandó un diseño nuevo mientras usted miraba el anterior. " +
        "Vuelva a abrir el caso para verlo antes de aprobarlo.",
    };
  }

  await prisma.$transaction(async (bd) => {
    await bd.aprobacion.create({
      data: {
        casoId: caso.id,
        archivoDisenoId: diseno.id,
        decision: "APROBADO",
        usuarioId: usuario.id,
      },
    });

    await bd.caso.update({
      where: { id: caso.id },
      data: { etapa: "EN_FABRICACION", enRiesgo: false, motivoRiesgo: null },
    });

    await registrarEvento(bd, {
      tipo: "DISENO_APROBADO",
      resumen: `${usuario.nombreCompleto} aprobó el diseño del caso ${caso.folio}.`,
      casoId: caso.id,
      usuarioId: usuario.id,
      etapaAnterior: "ESPERANDO_APROBACION",
      etapaNueva: "EN_FABRICACION",
      datos: { archivoDisenoId: diseno.id },
    });
  });

  revalidatePath(`/casos/${caso.id}`);
  revalidatePath("/");
  return { listo: true };
}

export async function solicitarAjuste(
  casoId: string,
  comentario: string,
): Promise<Resultado> {
  const { usuario, caso } = await casoDelUsuario(casoId);
  if (!caso) return { error: "No encuentro ese caso." };

  if (!puedeAprobarDisenos(usuario)) {
    return {
      error:
        "Solicitar un ajuste lo hace el doctor. Avísele y él lo registra.",
    };
  }
  if (caso.etapa !== "ESPERANDO_APROBACION") {
    return { error: "Este caso no está esperando aprobación ahora mismo." };
  }

  const leido = esquemaAjuste.safeParse({ comentario });
  if (!leido.success) {
    return { error: leido.error.issues[0].message };
  }

  const diseno = caso.archivos.find((a) => a.tipo === "DISENO");
  if (!diseno) return { error: "Todavía no hay un diseño que ajustar." };

  await prisma.$transaction(async (bd) => {
    await bd.aprobacion.create({
      data: {
        casoId: caso.id,
        archivoDisenoId: diseno.id,
        decision: "AJUSTE_SOLICITADO",
        comentario: leido.data.comentario,
        usuarioId: usuario.id,
      },
    });

    await bd.mensaje.create({
      data: {
        casoId: caso.id,
        autorId: usuario.id,
        texto: leido.data.comentario,
      },
    });

    await bd.caso.update({
      where: { id: caso.id },
      data: { etapa: "EN_DISENO" },
    });

    await registrarEvento(bd, {
      tipo: "AJUSTE_SOLICITADO",
      resumen: `${usuario.nombreCompleto} solicitó un ajuste en el caso ${caso.folio}.`,
      casoId: caso.id,
      usuarioId: usuario.id,
      etapaAnterior: "ESPERANDO_APROBACION",
      etapaNueva: "EN_DISENO",
      datos: { comentario: leido.data.comentario },
    });
  });

  revalidatePath(`/casos/${caso.id}`);
  revalidatePath("/");
  return { listo: true };
}

// -------------------------------------------------------------------- chat

export async function enviarMensaje(
  casoId: string,
  texto: string,
): Promise<Resultado> {
  const { usuario, caso } = await casoDelUsuario(casoId);
  if (!caso) return { error: "No encuentro ese caso." };

  const limpio = texto.trim();
  if (limpio.length === 0) return { error: "Escriba su mensaje." };
  if (limpio.length > 2000) return { error: "El mensaje es demasiado largo." };

  await prisma.$transaction(async (bd) => {
    await bd.mensaje.create({
      data: { casoId: caso.id, autorId: usuario.id, texto: limpio },
    });
    await registrarEvento(bd, {
      tipo: "MENSAJE_ENVIADO",
      resumen: `${usuario.nombreCompleto} escribió en el caso ${caso.folio}.`,
      casoId: caso.id,
      usuarioId: usuario.id,
    });
  });

  revalidatePath(`/casos/${caso.id}`);
  return { listo: true };
}

// ----------------------------------------------------- etapas del laboratorio

export async function cambiarEtapa(
  casoId: string,
  nueva: Etapa,
): Promise<Resultado> {
  const { usuario, caso } = await casoDelUsuario(casoId);
  if (!caso) return { error: "No encuentro ese caso." };
  if (!puedeMoverEtapas(usuario)) {
    return { error: "Sólo el laboratorio mueve las etapas de un caso." };
  }

  if (nueva === "ESPERANDO_APROBACION") {
    return mandarDisenoAAprobacion(casoId);
  }

  if (nueva === "EN_FABRICACION" && !sePuedeFabricar(caso)) {
    return {
      error:
        `El caso ${caso.folio} no tiene aprobación registrada del doctor. ` +
        "Mándele el diseño y espere su aprobación antes de fabricar.",
    };
  }

  if (
    nueva === "LISTO_Y_EN_CAMINO" &&
    !caso.controlDeCalidad &&
    !caso.liquidacionPagadaEn
  ) {
    return {
      error:
        `El caso ${caso.folio} todavía no pasa control de calidad. ` +
        "Ciérrelo desde la pantalla de calidad: ahí van las dos fotos y el kit.",
    };
  }

  if (
    nueva === "EN_DISENO" &&
    caso.montoTotalCentavos &&
    !caso.anticipoPagadoEn
  ) {
    return {
      error:
        "No se puede iniciar el diseño hasta confirmar el pago del anticipo (50%).",
    };
  }

  if (
    (nueva === "LISTO_Y_EN_CAMINO" || nueva === "ENTREGADO") &&
    caso.montoTotalCentavos &&
    !caso.liquidacionPagadaEn
  ) {
    return {
      error:
        "No se puede despachar o entregar el caso hasta confirmar la liquidación total (50% restante + envío).",
    };
  }

  const datos: Record<string, unknown> = { etapa: nueva };

  if (nueva === "ACEPTADO" && !caso.aceptadoEn) {
    const aceptadoEn = new Date();
    datos.aceptadoEn = aceptadoEn;
    datos.fechaEntregaComprometida = calcularFechaDeEntrega(
      caso.indicacion,
      aceptadoEn,
    );
  }
  if (nueva === "ENTREGADO") datos.entregadoEn = new Date();
  if (nueva !== "EN_PAUSA") {
    datos.enRiesgo = false;
    datos.motivoRiesgo = null;
  }

  const actualizado = await prisma.$transaction(async (bd) => {
    const resultado = await bd.caso.update({
      where: { id: caso.id },
      data: datos,
    });
    await registrarEvento(bd, {
      tipo: "ETAPA_CAMBIADA",
      resumen: `${usuario.nombreCompleto} movió el caso ${caso.folio} a ${nueva.toLowerCase().replaceAll("_", " ")}.`,
      casoId: caso.id,
      usuarioId: usuario.id,
      etapaAnterior: caso.etapa,
      etapaNueva: nueva,
    });
    return resultado;
  });

  await avisarA(
    prisma,
    caso.doctorId,
    avisoDeCambioDeEtapa({
      id: caso.id,
      folio: caso.folio,
      etapa: nueva,
      fechaEntregaComprometida: actualizado.fechaEntregaComprometida,
      paciente: caso.paciente,
    }),
  );

  revalidatePath(`/casos/${caso.id}`);
  revalidatePath("/");
  revalidatePath("/tablero");
  return { listo: true };
}

export async function mandarDisenoAAprobacion(
  casoId: string,
): Promise<Resultado> {
  const { usuario, caso } = await casoDelUsuario(casoId);
  if (!caso) return { error: "No encuentro ese caso." };
  if (!puedeMoverEtapas(usuario)) {
    return { error: "Sólo el laboratorio manda diseños a aprobación." };
  }

  const disenosCompletos = caso.archivos.filter(
    (a) => a.tipo === "DISENO" && a.estado === "COMPLETO",
  );
  if (disenosCompletos.length === 0) {
    return {
      error:
        "Suba primero los archivos 3D o las imágenes del diseño antes de mandarlo a aprobación.",
    };
  }

  const disenosStl = disenosCompletos.filter(
    (a) => a.extension.toLowerCase() === "stl",
  );

  const mallasDerivadas: {
    originalId: string;
    nombreOriginal: string;
    resumen: ResumenDeMalla;
  }[] = [];

  for (const stl of disenosStl) {
    try {
      const resumen = await derivarMallaLigera({
        rutaDelOriginal: stl.rutaRelativa,
        casoId: caso.id,
        archivoId: stl.id,
      });
      mallasDerivadas.push({
        originalId: stl.id,
        nombreOriginal: stl.nombre,
        resumen,
      });
    } catch (falla) {
      return {
        error:
          falla instanceof Error
            ? falla.message
            : `No pude preparar la vista de ${stl.nombre}.`,
      };
    }
  }

  const primera = mallasDerivadas[0]?.resumen ?? null;

  await prisma.$transaction(async (bd) => {
    await bd.archivo.deleteMany({
      where: { casoId: caso.id, tipo: "MALLA_LIGERA" },
    });

    for (const item of mallasDerivadas) {
      await bd.archivo.create({
        data: {
          casoId: caso.id,
          nombre: `Vista de ${item.nombreOriginal}`,
          tipo: "MALLA_LIGERA",
          extension: "malla",
          bytesTotales: BigInt(item.resumen.bytes),
          bytesRecibidos: BigInt(item.resumen.bytes),
          estado: "COMPLETO",
          rutaRelativa: item.resumen.rutaRelativa,
          subidoPorId: usuario.id,
        },
      });
    }

    await bd.caso.update({
      where: { id: caso.id },
      data: { etapa: "ESPERANDO_APROBACION", tecnicoId: usuario.id },
    });

    await registrarEvento(bd, {
      tipo: "ETAPA_CAMBIADA",
      resumen: `${usuario.nombreCompleto} mandó el diseño del caso ${caso.folio} a aprobación del doctor.`,
      casoId: caso.id,
      usuarioId: usuario.id,
      etapaAnterior: caso.etapa,
      etapaNueva: "ESPERANDO_APROBACION",
      datos: primera
        ? {
          triangulos: primera.triangulos,
          bytesDeLaVista: primera.bytes,
          reducida: primera.reducida,
          mallasGeneradas: mallasDerivadas.length,
        }
        : { archivosDeDiseno: disenosCompletos.length },
    });
  });

  await avisarA(
    prisma,
    caso.doctorId,
    avisoDeCambioDeEtapa({
      id: caso.id,
      folio: caso.folio,
      etapa: "ESPERANDO_APROBACION",
      fechaEntregaComprometida: caso.fechaEntregaComprometida,
      paciente: caso.paciente,
    }),
  );

  revalidatePath(`/casos/${caso.id}`);
  revalidatePath("/");
  return { listo: true };
}

export async function solicitarImpresionDeTicket(
  casoId: string,
): Promise<Resultado> {
  const { usuario, caso } = await casoDelUsuario(casoId);
  if (!caso) return { error: "No encuentro ese caso." };
  if (!puedeMoverEtapas(usuario)) {
    return { error: "Sólo el laboratorio puede imprimir el ticket del caso." };
  }

  await prisma.$transaction(async (bd) => {
    await bd.caso.update({
      where: { id: caso.id },
      data: { actualizadoEn: new Date() },
    });

    await registrarEvento(bd, {
      tipo: "CASO_ACTUALIZADO",
      resumen: `${usuario.nombreCompleto} mandó a imprimir el ticket del caso ${caso.folio}.`,
      casoId: caso.id,
      usuarioId: usuario.id,
      datos: { solicitarImpresion: true },
    });
  });

  await empujarTicketARaspberry(caso.id);
  revalidatePath(`/casos/${caso.id}`);
  return { listo: true };
}

// -------------------------------------- evaluación, cotización y pagos Stripe

const esquemaEvaluacion = z.object({
  decision: z.enum(["ACEPTAR", "CORRECCION", "DECLINAR"]),
  montoTotalPesos: z.number().nonnegative().optional(),
  motivo: z.string().trim().max(1000).optional(),
  motivoCambioPrecio: z.string().trim().max(1000).optional(),
});

export async function evaluarCasoLaboratorio(
  casoId: string,
  entrada: z.infer<typeof esquemaEvaluacion>,
): Promise<Resultado> {
  const { usuario, caso } = await casoDelUsuario(casoId);
  if (!caso) return { error: "No encuentro ese caso." };
  if (!puedeMoverEtapas(usuario)) {
    return { error: "Sólo el laboratorio puede evaluar o cotizar casos." };
  }

  const leido = esquemaEvaluacion.safeParse(entrada);
  if (!leido.success) return { error: "Revise los datos de evaluación." };
  const { decision, montoTotalPesos, motivo, motivoCambioPrecio } = leido.data;

  if (decision === "DECLINAR") {
    if (!motivo || motivo.length < 5) {
      return { error: "Indique el motivo por el cual se declina el caso." };
    }
    await prisma.$transaction(async (bd) => {
      await bd.caso.update({
        where: { id: caso.id },
        data: { etapa: "DECLINADO", motivoCierre: motivo },
      });
      await registrarEvento(bd, {
        tipo: "CASO_DECLINADO",
        resumen: `${usuario.nombreCompleto} declinó el caso ${caso.folio}: ${motivo}`,
        casoId: caso.id,
        usuarioId: usuario.id,
        etapaAnterior: caso.etapa,
        etapaNueva: "DECLINADO",
        datos: { motivo },
      });
    });
    revalidatePath(`/casos/${caso.id}`);
    revalidatePath("/tablero");
    return { listo: true };
  }

  if (decision === "CORRECCION") {
    if (!motivo || motivo.length < 5) {
      return { error: "Explique qué archivos faltan o requieren corrección." };
    }
    await prisma.$transaction(async (bd) => {
      await bd.caso.update({
        where: { id: caso.id },
        data: {
          esBorrador: true,
          requiereCorreccion: true,
          motivoCierre: motivo,
        },
      });
      await registrarEvento(bd, {
        tipo: "CORRECCION_SOLICITADA",
        resumen: `${usuario.nombreCompleto} regresó el caso ${caso.folio} a la clínica para corrección de archivos: ${motivo}`,
        casoId: caso.id,
        usuarioId: usuario.id,
        datos: { motivo },
      });
    });
    revalidatePath(`/casos/${caso.id}`);
    revalidatePath(`/casos/${caso.id}/archivos`);
    revalidatePath("/tablero");
    return { listo: true };
  }

  // ACEPTAR -> asignar precio (si requería cotización o viene definido) y pedir 50%
  const precioOriginalCentavos =
    caso.montoTotalCentavos ?? extraerTotalDeCotizacion(caso.cotizacion);
  const centavosManual =
    typeof montoTotalPesos === "number" && montoTotalPesos > 0
      ? Math.round(montoTotalPesos * 100)
      : null;
  const totalCentavos = centavosManual ?? precioOriginalCentavos;

  if (!totalCentavos || totalCentavos <= 0) {
    return {
      error:
        "Este caso requiere cotización manual. Escriba el costo total en pesos antes de aceptar.",
    };
  }

  const precioFueCambiado =
    precioOriginalCentavos !== null &&
    precioOriginalCentavos > 0 &&
    totalCentavos !== precioOriginalCentavos;

  if (precioFueCambiado && (!motivoCambioPrecio || motivoCambioPrecio.length < 5)) {
    return {
      error:
        "Indique el motivo por el cual cambió el precio antes de aceptar el caso.",
    };
  }

  const { anticipoCentavos, restanteCentavos } =
    calcularPartesDePago(totalCentavos);
  const aceptadoEn = caso.aceptadoEn ?? new Date();
  const fechaEntrega =
    caso.fechaEntregaComprometida ??
    calcularFechaDeEntrega(caso.indicacion, aceptadoEn);

  await prisma.$transaction(async (bd) => {
    await bd.caso.update({
      where: { id: caso.id },
      data: {
        etapa: "ESPERANDO_PAGO",
        aceptadoEn,
        fechaEntregaComprometida: fechaEntrega,
        montoTotalCentavos: totalCentavos,
        montoOriginalCentavos: precioFueCambiado ? precioOriginalCentavos : null,
        motivoCambioPrecio: precioFueCambiado ? motivoCambioPrecio : null,
        anticipoCentavos,
        liquidacionCentavos: restanteCentavos,
        requiereCorreccion: false,
        motivoCierre: null,
      },
    });
    await registrarEvento(bd, {
      tipo: "COTIZACION_ENVIADA",
      resumen:
        `${usuario.nombreCompleto} aceptó el caso ${caso.folio} con total ${formatoPesos(totalCentavos)} y solicitó anticipo del 50% (${formatoPesos(anticipoCentavos)}).` +
        (precioFueCambiado
          ? ` Precio ajustado desde ${formatoPesos(precioOriginalCentavos)}: ${motivoCambioPrecio}`
          : ""),
      casoId: caso.id,
      usuarioId: usuario.id,
      etapaAnterior: caso.etapa,
      etapaNueva: "ESPERANDO_PAGO",
      datos: {
        totalCentavos,
        anticipoCentavos,
        ...(precioFueCambiado
          ? {
              montoOriginalCentavos: precioOriginalCentavos,
              motivoCambioPrecio,
            }
          : {}),
      },
    });
  });

  revalidatePath(`/casos/${caso.id}`);
  revalidatePath("/tablero");
  revalidatePath("/");
  return { listo: true };
}

export async function rechazarCotizacionClinica(
  casoId: string,
  motivo?: string,
): Promise<Resultado> {
  const { usuario, caso } = await casoDelUsuario(casoId);
  if (!caso) return { error: "No encuentro ese caso." };
  if (caso.etapa !== "ESPERANDO_PAGO" && caso.etapa !== "EN_PAUSA") {
    return { error: "Este caso no está en etapa de autorización de pago." };
  }

  const razon = motivo?.trim() || "La clínica rechazó el costo del caso.";

  await prisma.$transaction(async (bd) => {
    await bd.caso.update({
      where: { id: caso.id },
      data: { etapa: "CANCELADO", motivoCierre: razon },
    });
    await registrarEvento(bd, {
      tipo: "CASO_CANCELADO",
      resumen: `${usuario.nombreCompleto} rechazó el pago y canceló el caso ${caso.folio}.`,
      casoId: caso.id,
      usuarioId: usuario.id,
      etapaAnterior: caso.etapa,
      etapaNueva: "CANCELADO",
      datos: { motivo: razon },
    });
  });

  revalidatePath(`/casos/${caso.id}`);
  revalidatePath("/");
  return { listo: true };
}

export async function dejarPagoPendienteClinica(
  casoId: string,
): Promise<Resultado> {
  const { usuario, caso } = await casoDelUsuario(casoId);
  if (!caso) return { error: "No encuentro ese caso." };
  if (caso.etapa !== "ESPERANDO_PAGO") {
    return { error: "El pago solo puede pausarse cuando espera anticipo." };
  }

  await prisma.$transaction(async (bd) => {
    await bd.caso.update({
      where: { id: caso.id },
      data: { etapa: "EN_PAUSA" },
    });
    await registrarEvento(bd, {
      tipo: "ETAPA_CAMBIADA",
      resumen: `${usuario.nombreCompleto} dejó pendiente el pago del anticipo en el caso ${caso.folio}. El caso queda en pausa.`,
      casoId: caso.id,
      usuarioId: usuario.id,
      etapaAnterior: caso.etapa,
      etapaNueva: "EN_PAUSA",
    });
  });

  revalidatePath(`/casos/${caso.id}`);
  revalidatePath("/");
  return { listo: true };
}

export async function solicitarLiquidacion(casoId: string): Promise<Resultado> {
  const { usuario, caso } = await casoDelUsuario(casoId);
  if (!caso) return { error: "No encuentro ese caso." };
  if (!puedeMoverEtapas(usuario)) {
    return { error: "Sólo el laboratorio puede solicitar la liquidación." };
  }
  if (
    caso.etapa !== "EN_FABRICACION" &&
    caso.etapa !== "EN_CONTROL_DE_CALIDAD"
  ) {
    return {
      error:
        "El caso debe estar en fabricación o control de calidad para solicitar liquidación.",
    };
  }

  await prisma.$transaction(async (bd) => {
    await bd.caso.update({
      where: { id: caso.id },
      data: { etapa: "ESPERANDO_LIQUIDACION" },
    });
    await registrarEvento(bd, {
      tipo: "ETAPA_CAMBIADA",
      resumen: `${usuario.nombreCompleto} notificó que el caso ${caso.folio} está terminado y solicitó la liquidación (50% restante + envío).`,
      casoId: caso.id,
      usuarioId: usuario.id,
      etapaAnterior: caso.etapa,
      etapaNueva: "ESPERANDO_LIQUIDACION",
    });
  });

  revalidatePath(`/casos/${caso.id}`);
  revalidatePath("/tablero");
  revalidatePath("/");
  return { listo: true };
}

export async function verificarPagoStripeAlRegresar(
  casoId: string,
  sessionId: string,
): Promise<void> {
  try {
    const sesion = await obtenerSesionCheckout(sessionId);
    const meta = sesion.metadata ?? {};
    if (
      (sesion.payment_status === "paid" ||
        sesion.payment_status === "no_payment_required") &&
      meta.casoId === casoId &&
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
        casoId,
        tipo: meta.tipo as TipoPago,
        montoCentavos: Number(meta.montoCentavos || sesion.amount_total || 0),
        envioCentavos: Number(meta.envioCentavos || 0),
        modalidadEnvio: modalidad,
        enviaCarrier: meta.enviaCarrier || null,
        enviaServicio: meta.enviaServicio || null,
        enviaServicioNombre: meta.enviaServicioNombre || null,
      });
    }
  } catch {
    // Si Stripe no responde o aún no confirma, el webhook lo procesará.
  }
}
