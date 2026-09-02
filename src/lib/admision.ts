import type { RolDeUnidad } from "@/generated/prisma/enums";
import { seFabrica } from "@/lib/trabajos";

/**
 * Lista de admisión (SKILL.md O-2).
 *
 * Bloquea el envío si falta el antagonista, el registro de mordida o los
 * dientes del trabajo. La misma función la usan la pantalla y la acción de enviar, para que
 * sea imposible saltarse la lista tanto desde la interfaz como desde la API.
 *
 * Los mensajes dicen qué hacer, no qué falló (§6.5).
 */

export type EstadoDeAdmision = {
  clave: string;
  titulo: string;
  queHacer: string;
  cumplido: boolean;
};

export type CasoParaAdmision = {
  unidades: { rol: RolDeUnidad }[];
  archivos: { tipo: string; estado: string }[];
};

function hayArchivo(caso: CasoParaAdmision, tipo: string) {
  return caso.archivos.some((a) => a.tipo === tipo && a.estado === "COMPLETO");
}

export function revisarAdmision(caso: CasoParaAdmision): EstadoDeAdmision[] {
  // Una anotación no es una unidad: un caso que sólo trae "antagonista" y
  // "diente vecino" no tiene nada que fabricar, y mandarlo así le costaría al
  // laboratorio una llamada para preguntar qué se hace.
  const piezas = caso.unidades.filter((u) => seFabrica(u.rol));

  // Si hay algo que se cementa en boca, el antagonista deja de ser opcional:
  // sin él no se ajusta la oclusión.
  const necesitaAntagonista = piezas.some((u) => NECESITAN_OCLUSION.has(u.rol));

  return [
    {
      clave: "tipo-de-trabajo",
      titulo: "Qué se va a fabricar",
      queHacer:
        "Regrese al paso del trabajo y escoja los dientes de este caso, o agregue un trabajo de arcada completa.",
      cumplido: piezas.length > 0,
    },
    {
      clave: "preparacion",
      titulo: "El escaneo de la preparación",
      queHacer: "Suba el escaneo de la arcada que preparó.",
      cumplido: hayArchivo(caso, "ESCANEO_PREPARACION"),
    },
    {
      clave: "antagonista",
      titulo: "El escaneo del antagonista",
      queHacer: necesitaAntagonista
        ? "No marcó el antagonista. Sin él no puedo ajustar la oclusión."
        : "Me falta el antagonista. Súbalo aquí para poder ajustar la oclusión.",
      cumplido: hayArchivo(caso, "ESCANEO_ANTAGONISTA"),
    },
    {
      clave: "mordida",
      titulo: "El registro de mordida",
      queHacer:
        "Me falta el registro de mordida. Sin él no puedo montar el caso.",
      cumplido: hayArchivo(caso, "REGISTRO_MORDIDA"),
    },
  ];
}

/** Los trabajos que terminan en boca y necesitan que la mordida cierre bien. */
const NECESITAN_OCLUSION = new Set<RolDeUnidad>([
  "CORONA_ANATOMICA",
  "CORONA_PRENSADA",
  "CORONA_CASCARON",
  "PONTICO_ANATOMICO",
  "PONTICO_PRENSADO",
  "PONTICO_CASCARON",
  "INCRUSTACION",
  "CARILLA",
  "PROTESIS_TOTAL",
  "PROTESIS_PARCIAL",
  "GUARDA_OCLUSAL",
]);

export function loQueFalta(caso: CasoParaAdmision) {
  return revisarAdmision(caso).filter((punto) => !punto.cumplido);
}

export function sePuedeEnviar(caso: CasoParaAdmision) {
  return loQueFalta(caso).length === 0;
}
