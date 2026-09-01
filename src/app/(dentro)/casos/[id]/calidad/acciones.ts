"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirUsuario, esDelLaboratorio } from "@/lib/autorizacion";
import { registrarEvento } from "@/lib/bitacora";
import { avisarA, avisoDeCambioDeEtapa } from "@/lib/avisos";
import {
  KIT_POR_INDICACION,
  loQueFaltaParaEnviar,
  mismaPersonaEnDisenoYCalidad,
  sePuedeEnviar,
} from "@/lib/calidad";

export type ResultadoDeCalidad = {
  error?: string;
  /** Cuando falla por la separación de funciones, hay que pedir autorización. */
  necesitaAutorizacion?: boolean;
  /** A dónde ir cuando salió bien. */
  listo?: string;
};

/**
 * Lo que manda la pantalla. Se recibe como datos y no como FormData a
 * propósito: si algo falla, quien está revisando no pierde lo que ya marcó
 * (§6.6, nunca perder trabajo).
 */
const esquema = z.object({
  casoId: z.string().min(1),
  kit: z.array(z.string().max(40)).max(20),
  numeroDeGuia: z.string().trim().max(80),
  enlaceDeRastreo: z.string().trim().max(500),
  /** Correo de dirección, si hay que saltarse la separación de funciones. */
  autorizaCorreo: z.string().trim().toLowerCase().max(120),
  motivo: z.string().trim().max(500),
});

export type DatosDeCalidad = z.infer<typeof esquema>;

/**
 * Cierra el control de calidad y manda el caso (SKILL.md O-6).
 *
 * Tres candados, los tres del lado del servidor. Apagar el botón en el
 * navegador no sirve de nada: esta función vuelve a comprobarlo todo.
 *
 *   1. Sin las dos fotos, no se manda.
 *   2. Sin el kit completo, no se manda.
 *   3. Quien cerró el diseño no cierra la calidad del mismo caso. Saltárselo
 *      requiere autorización de dirección, y queda escrito.
 */
export async function cerrarControlDeCalidad(
  entrada: DatosDeCalidad,
): Promise<ResultadoDeCalidad> {
  const usuario = await exigirUsuario();
  if (!esDelLaboratorio(usuario)) {
    return { error: "El control de calidad lo cierra el laboratorio." };
  }

  const leido = esquema.safeParse(entrada);
  if (!leido.success) return { error: "Revise los datos del envío." };

  const { casoId, kit, numeroDeGuia, enlaceDeRastreo } = leido.data;

  if (enlaceDeRastreo && !/^https?:\/\//i.test(enlaceDeRastreo)) {
    return {
      error: "El enlace de rastreo va completo, empezando con https://",
    };
  }

  const caso = await prisma.caso.findUnique({
    where: { id: casoId },
    include: {
      paciente: { select: { folio: true, iniciales: true } },
      archivos: { select: { tipo: true, estado: true } },
      controlDeCalidad: { select: { id: true } },
    },
  });

  if (!caso) return { error: "No encuentro ese caso." };
  if (caso.controlDeCalidad) {
    return { error: "Este caso ya pasó por control de calidad." };
  }

  // --- 1 y 2. Fotos y kit ---------------------------------------------------
  if (!sePuedeEnviar(caso, kit)) {
    const falta = loQueFaltaParaEnviar(caso, kit)
      .map((p) => p.titulo.toLowerCase())
      .join(", ");
    return { error: `Todavía falta: ${falta}.` };
  }

  // --- 3. Separación de funciones -------------------------------------------
  let autorizadoPorId: string | null = null;

  if (mismaPersonaEnDisenoYCalidad(caso.tecnicoId, usuario.id)) {
    if (!leido.data.autorizaCorreo) {
      return {
        necesitaAutorizacion: true,
        error:
          "Usted diseñó este caso, así que no puede cerrar también su control " +
          "de calidad. Que lo revise alguien más, o que dirección lo autorice " +
          "aquí mismo.",
      };
    }

    const direccion = await prisma.usuario.findUnique({
      where: { correo: leido.data.autorizaCorreo },
      select: { id: true, rol: true, activo: true },
    });

    if (!direccion?.activo || direccion.rol !== "DIRECCION") {
      return {
        necesitaAutorizacion: true,
        error: "Ese correo no es de dirección.",
      };
    }
    if (leido.data.motivo.length < 10) {
      return {
        necesitaAutorizacion: true,
        error: "Escriba por qué se autoriza. Queda en la bitácora del caso.",
      };
    }

    autorizadoPorId = direccion.id;
  }

  // --- Cerrar ---------------------------------------------------------------
  const nombresDelKit = KIT_POR_INDICACION[caso.indicacion]
    .filter((pieza) => kit.includes(pieza.clave))
    .map((pieza) => pieza.nombre);

  await prisma.$transaction(async (bd) => {
    await bd.controlDeCalidad.create({
      data: {
        casoId: caso.id,
        revisadoPorId: usuario.id,
        kit,
        numeroDeGuia: numeroDeGuia || null,
        enlaceDeRastreo: enlaceDeRastreo || null,
        autorizadoPorId,
        motivoDeAutorizacion: autorizadoPorId ? leido.data.motivo : null,
      },
    });

    await bd.caso.update({
      where: { id: caso.id },
      data: { etapa: "LISTO_Y_EN_CAMINO", enRiesgo: false, motivoRiesgo: null },
    });

    await registrarEvento(bd, {
      tipo: "ETAPA_CAMBIADA",
      resumen:
        `${usuario.nombreCompleto} cerró el control de calidad del caso ` +
        `${caso.folio} y lo mandó${numeroDeGuia ? `, con guía ${numeroDeGuia}` : ""}.`,
      casoId: caso.id,
      usuarioId: usuario.id,
      etapaAnterior: caso.etapa,
      etapaNueva: "LISTO_Y_EN_CAMINO",
      datos: {
        kit: nombresDelKit,
        numeroDeGuia: numeroDeGuia || null,
        autorizadoPorId,
      },
    });

    if (autorizadoPorId) {
      // Saltarse la separación de funciones nunca pasa en silencio.
      await registrarEvento(bd, {
        tipo: "CASO_ACTUALIZADO",
        resumen:
          `Dirección autorizó que ${usuario.nombreCompleto} cerrara diseño y ` +
          `control de calidad del mismo caso ${caso.folio}. ` +
          `Motivo: ${leido.data.motivo}`,
        casoId: caso.id,
        usuarioId: autorizadoPorId,
        datos: { motivo: leido.data.motivo },
      });
    }
  });

  await avisarA(
    prisma,
    caso.doctorId,
    avisoDeCambioDeEtapa({
      id: caso.id,
      folio: caso.folio,
      etapa: "LISTO_Y_EN_CAMINO",
      fechaEntregaComprometida: caso.fechaEntregaComprometida,
      paciente: caso.paciente,
    }),
  );

  revalidatePath(`/casos/${caso.id}`);
  revalidatePath("/");
  return { listo: `/casos/${caso.id}?enviado=1` };
}
