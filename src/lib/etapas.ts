import type { Etapa } from "@/generated/prisma/enums";
import { ETAPAS_DEL_DOCTOR } from "@/lib/vocabulario";

/**
 * Tiempos y avance de las etapas (SKILL.md O-3).
 *
 * ⚠️ Pendiente del Product Owner (§12.5): estos son los tiempos estándar por
 * etapa con los que Mileo calcula la fecha de entrega y dispara el aviso de
 * riesgo. Están puestos con criterio de laboratorio digital chico, pero hay que
 * calibrarlos con los tiempos reales de RMS Zahnfacturing antes del piloto.
 * Se cambian aquí y en ningún otro lado.
 */

/** Horas hábiles que debería durar cada etapa antes de considerarse atorada. */
export const HORAS_ESTANDAR: Partial<Record<Etapa, number>> = {
  RECIBIDO: 4,
  EN_REVISION: 4,
  ACEPTADO: 8,
  EN_DISENO: 24,
  ESPERANDO_APROBACION: 48,
  EN_FABRICACION: 48,
  EN_CONTROL_DE_CALIDAD: 8,
  LISTO_Y_EN_CAMINO: 24,
};

/** Días hábiles de fabricación, desde que se acepta el caso. */
export const DIAS_POR_INDICACION: Record<string, number> = {
  CORONA_Y_PUENTE: 5,
  SOBRE_IMPLANTE: 7,
  INCRUSTACION_Y_CARILLA: 5,
  PROVISIONAL: 3,
  GUARDA_OCLUSAL: 4,
  MODELO_3D: 2,
};

/** El orden real en el que avanza un caso, sin las etapas de excepción. */
export const ORDEN_DE_ETAPAS = ETAPAS_DEL_DOCTOR;

export function siguienteEtapa(etapa: Etapa): Etapa | null {
  const posicion = ORDEN_DE_ETAPAS.indexOf(etapa);
  if (posicion === -1 || posicion === ORDEN_DE_ETAPAS.length - 1) return null;
  return ORDEN_DE_ETAPAS[posicion + 1];
}

/**
 * A qué etapas puede moverse un caso desde la actual.
 * No se puede saltar a fabricación sin pasar por la aprobación del doctor: ese
 * bloqueo vive en `sePuedeFabricar`.
 */
export function etapasPosiblesDesde(etapa: Etapa): Etapa[] {
  if (etapa === "ENTREGADO") return ["REHACER"];
  if (etapa === "EN_PAUSA" || etapa === "REHACER") return ORDEN_DE_ETAPAS;

  const siguiente = siguienteEtapa(etapa);
  return [...(siguiente ? [siguiente] : []), "EN_PAUSA", "REHACER"];
}

/**
 * Bloqueo duro (SKILL.md O-4, verdad #2 del producto):
 * el caso no puede pasar a fabricación sin aprobación registrada del doctor.
 */
export function sePuedeFabricar(caso: {
  aprobaciones: { decision: string }[];
}) {
  return caso.aprobaciones.some((a) => a.decision === "APROBADO");
}

/** Días hábiles adelante, saltando sábados y domingos. */
export function sumarDiasHabiles(desde: Date, dias: number) {
  const fecha = new Date(desde);
  let restantes = dias;
  while (restantes > 0) {
    fecha.setDate(fecha.getDate() + 1);
    const dia = fecha.getDay();
    if (dia !== 0 && dia !== 6) restantes--;
  }
  return fecha;
}

/**
 * El reloj de la fecha de entrega arranca al ACEPTAR, no al subir (O-3).
 * Antes de aceptar, el caso no tiene fecha comprometida y Mileo lo dice así en
 * pantalla en vez de inventar una.
 */
export function calcularFechaDeEntrega(indicacion: string, aceptadoEn: Date) {
  return sumarDiasHabiles(aceptadoEn, DIAS_POR_INDICACION[indicacion] ?? 5);
}

/**
 * ¿Este caso está en riesgo de no llegar a tiempo?
 *
 * Dos motivos, los dos automáticos:
 *  - lleva en la misma etapa más de su tiempo estándar, o
 *  - ya se le acabó el margen contra la fecha comprometida.
 */
export function evaluarRiesgo({
  etapa,
  desdeCuandoEnEtapa,
  fechaEntregaComprometida,
  ahora = new Date(),
}: {
  etapa: Etapa;
  desdeCuandoEnEtapa: Date;
  fechaEntregaComprometida: Date | null;
  ahora?: Date;
}): { enRiesgo: boolean; motivo: string | null } {
  if (etapa === "ENTREGADO") return { enRiesgo: false, motivo: null };

  if (etapa === "EN_PAUSA") {
    return {
      enRiesgo: true,
      motivo: "El caso está en pausa y el reloj sigue corriendo.",
    };
  }

  const estandar = HORAS_ESTANDAR[etapa];
  if (estandar) {
    const horas = (ahora.getTime() - desdeCuandoEnEtapa.getTime()) / 3_600_000;
    if (horas > estandar) {
      return {
        enRiesgo: true,
        motivo:
          etapa === "ESPERANDO_APROBACION"
            ? "Estoy esperando su aprobación para poder seguir."
            : `El caso lleva más de lo normal en la etapa de ${etapa.toLowerCase().replaceAll("_", " ")}.`,
      };
    }
  }

  if (fechaEntregaComprometida && fechaEntregaComprometida < ahora) {
    return {
      enRiesgo: true,
      motivo: "Ya pasó la fecha que le prometí.",
    };
  }

  return { enRiesgo: false, motivo: null };
}
