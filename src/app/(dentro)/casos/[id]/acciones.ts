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
import type { Etapa } from "@/generated/prisma/enums";

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
  /**
   * Cuál diseño se está aprobando. Va desde la pantalla para que el servidor
   * pueda negarse si el laboratorio mandó otro mientras el doctor lo miraba:
   * sin esto se aprobaría un diseño que nunca vio, y la bitácora diría que sí.
   */
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

  // Si se mueve a esperando aprobación, tiene que haber diseño y se prepara su vista.
  if (nueva === "ESPERANDO_APROBACION") {
    return mandarDisenoAAprobacion(casoId);
  }

  // Bloqueo duro: nada se fabrica sin aprobación registrada del doctor.
  if (nueva === "EN_FABRICACION" && !sePuedeFabricar(caso)) {
    return {
      error:
        `El caso ${caso.folio} no tiene aprobación registrada del doctor. ` +
        "Mándele el diseño y espere su aprobación antes de fabricar.",
    };
  }

  // Segundo bloqueo duro (O-6): nada sale del laboratorio sin control de
  // calidad cerrado, con sus dos fotos y su kit. Ni por aquí ni por la API.
  if (nueva === "LISTO_Y_EN_CAMINO" && !caso.controlDeCalidad) {
    return {
      error:
        `El caso ${caso.folio} todavía no pasa control de calidad. ` +
        "Ciérrelo desde la pantalla de calidad: ahí van las dos fotos y el kit.",
    };
  }

  const datos: Record<string, unknown> = { etapa: nueva };

  // El reloj de la fecha de entrega arranca al aceptar, no al subir (O-3).
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

  // Un aviso por etapa, ni uno más (O-3). La cola se encarga de que no se
  // repita aunque esto se llame dos veces.
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

/**
 * El laboratorio manda el diseño a aprobación (O-4).
 * Si hay archivos STL (conjunto completo + las dos quijadas separadas),
 * aquí se deriva la malla ligera de cada uno; también permite mandar
 * imágenes del diseño o ambos.
 */
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

  // Derivamos la malla 3D ligera para cada archivo STL de diseño subido.
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
