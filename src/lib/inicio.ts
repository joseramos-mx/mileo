import "server-only";
import { prisma } from "@/lib/prisma";
import { filtroDeCasos } from "@/lib/autorizacion";
import type { UsuarioEnSesion } from "@/lib/sesion";
import type { Decision, Etapa } from "@/generated/prisma/enums";
import { paraTarjeta, seleccionDeTarjeta } from "@/lib/casos";

/**
 * Lo que enseña el inicio del doctor (SKILL.md §6.10).
 *
 * Sigue siendo una bandeja de pendientes: lo primero que se lee es cuántos
 * casos necesitan de él. Lo demás es el estado de sus casos, no métricas de
 * vanidad.
 */

// ------------------------------------------------------------ meta del mes

export async function metaDelMes(usuario: UsuarioEnSesion) {
  if (!usuario.clinicaId) return null;

  const clinica = await prisma.clinica.findUnique({
    where: { id: usuario.clinicaId },
    select: { metaMensual: true },
  });
  if (!clinica) return null;

  const ahora = new Date();
  const primero = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

  const hechos = await prisma.caso.count({
    where: {
      ...filtroDeCasos(usuario),
      esBorrador: false,
      entregadoEn: { gte: primero },
    },
  });

  return { hechos, objetivo: clinica.metaMensual };
}

// ---------------------------------------------------------------- escáner

export async function escanerDeLaClinica(usuario: UsuarioEnSesion) {
  if (!usuario.clinicaId) return null;
  return prisma.escaner.findUnique({ where: { clinicaId: usuario.clinicaId } });
}

// ------------------------------------------------------ diseños recientes

export type DisenoReciente = {
  casoId: string;
  folio: string;
  etapa: Etapa;
  /** Lo último que pasó con este diseño, contado al doctor. */
  titulo: string;
  detalle: string;
  /** "aprobado" pinta azul; "validacion", magenta. Así lo pide el diseño. */
  tono: "aprobado" | "validacion" | "ajuste";
  fechaEntregaComprometida: Date | null;
  vistaId: string | null;
  paciente: string;
};

export async function disenosRecientes(
  usuario: UsuarioEnSesion,
  limite = 4,
): Promise<DisenoReciente[]> {
  const casos = await prisma.caso.findMany({
    where: {
      ...filtroDeCasos(usuario),
      esBorrador: false,
      etapa: { notIn: ["ENTREGADO"] },
    },
    select: {
      id: true,
      folio: true,
      etapa: true,
      fechaEntregaComprometida: true,
      paciente: { select: { folio: true, iniciales: true } },
      archivos: {
        where: { tipo: "MALLA_LIGERA", estado: "COMPLETO" },
        select: { id: true },
        take: 1,
      },
      aprobaciones: {
        orderBy: { creadoEn: "desc" },
        take: 1,
        select: { decision: true },
      },
    },
    // Lo que requiere acción del doctor va arriba (§6.10): primero los que
    // esperan su aprobación, después los más recientes.
    orderBy: [{ etapa: "asc" }, { actualizadoEn: "desc" }],
    take: limite * 3,
  });

  const ordenados = [...casos].sort((a, b) => {
    const espera = (c: (typeof casos)[number]) =>
      c.etapa === "ESPERANDO_APROBACION" ? 0 : 1;
    return espera(a) - espera(b);
  });

  return ordenados.slice(0, limite).map((caso) => {
    const decision: Decision | null = caso.aprobaciones[0]?.decision ?? null;
    const contado = contarQuePaso(caso.etapa, decision);

    return {
      casoId: caso.id,
      folio: caso.folio,
      etapa: caso.etapa,
      ...contado,
      fechaEntregaComprometida: caso.fechaEntregaComprometida,
      vistaId: caso.archivos[0]?.id ?? null,
      paciente: `${caso.paciente.folio} · ${caso.paciente.iniciales}`,
    };
  });
}

/** Lo último que pasó, dicho como se lo diría una persona al doctor (§8). */
function contarQuePaso(
  etapa: Etapa,
  decision: Decision | null,
): { titulo: string; detalle: string; tono: DisenoReciente["tono"] } {
  if (etapa === "ESPERANDO_APROBACION") {
    return {
      titulo: "Le mandé este diseño",
      detalle: "Lo paso a fabricación en cuanto usted lo apruebe.",
      tono: "validacion",
    };
  }
  if (decision === "AJUSTE_SOLICITADO" && etapa === "EN_DISENO") {
    return {
      titulo: "Pidió un ajuste en este diseño",
      detalle: "Su técnico lo está atendiendo y se lo regreso.",
      tono: "ajuste",
    };
  }
  if (decision === "APROBADO") {
    return {
      titulo: "Aprobó este diseño",
      detalle: "Lo paso a fabricación de inmediato.",
      tono: "aprobado",
    };
  }
  if (etapa === "RECIBIDO" || etapa === "EN_REVISION") {
    return {
      titulo: "Me mandó este caso",
      detalle: "Lo estoy revisando y le confirmo la fecha de entrega.",
      tono: "validacion",
    };
  }
  return {
    titulo: "Su caso va en curso",
    detalle: "Le aviso en cuanto haya algo que necesite de usted.",
    tono: "aprobado",
  };
}

// ------------------------------------------------------ casos en la columna

/**
 * Los casos que siguen su curso, para la columna de la derecha del inicio.
 *
 * Devuelve la misma forma que come la tarjeta de caso en todas las demás
 * pantallas: aquí no hay una variante especial del inicio.
 */
export async function casosEnCurso(usuario: UsuarioEnSesion, limite = 6) {
  const casos = await prisma.caso.findMany({
    where: {
      ...filtroDeCasos(usuario),
      esBorrador: false,
      etapa: { notIn: ["ENTREGADO"] },
    },
    select: seleccionDeTarjeta,
    orderBy: [{ enRiesgo: "desc" }, { fechaEntregaComprometida: "asc" }],
    take: limite,
  });

  return casos.map(paraTarjeta);
}
