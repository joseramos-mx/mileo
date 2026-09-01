import type { Indicacion } from "@/generated/prisma/enums";

/**
 * Lista de admisión (SKILL.md O-2).
 *
 * Bloquea el envío si falta el antagonista, el registro de mordida o el tipo de
 * trabajo. La misma función la usan la pantalla y la acción de enviar, para que
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
  indicacion: Indicacion | null;
  unidades: { id: string }[];
  archivos: { tipo: string; estado: string }[];
};

function hayArchivo(caso: CasoParaAdmision, tipo: string) {
  return caso.archivos.some((a) => a.tipo === tipo && a.estado === "COMPLETO");
}

export function revisarAdmision(caso: CasoParaAdmision): EstadoDeAdmision[] {
  return [
    {
      clave: "tipo-de-trabajo",
      titulo: "El tipo de trabajo",
      queHacer:
        "Escoja qué necesita y en qué diente, con su material y su color.",
      cumplido: caso.indicacion !== null && caso.unidades.length > 0,
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
      queHacer:
        "Me falta el antagonista. Súbalo aquí para poder ajustar la oclusión.",
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

export function loQueFalta(caso: CasoParaAdmision) {
  return revisarAdmision(caso).filter((punto) => !punto.cumplido);
}

export function sePuedeEnviar(caso: CasoParaAdmision) {
  return loQueFalta(caso).length === 0;
}
