import type { RolDeUnidad } from "@/generated/prisma/enums";
import { seFabrica } from "@/lib/trabajos";

/**
 * Lista de admisión (SKILL.md O-2).
 *
 * Verifica que el caso tenga qué fabricar y al menos un archivo de escaneo
 * subido (ya sea el conjunto completo o los escaneos por separado).
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

const TIPOS_DE_ESCANEO = new Set([
  "ESCANEO_PREPARACION",
  "ESCANEO_ANTAGONISTA",
  "REGISTRO_MORDIDA",
]);

function hayAlMenosUnEscaneo(caso: CasoParaAdmision) {
  return caso.archivos.some(
    (a) => TIPOS_DE_ESCANEO.has(a.tipo) && a.estado === "COMPLETO",
  );
}

export function revisarAdmision(caso: CasoParaAdmision): EstadoDeAdmision[] {
  const piezas = caso.unidades.filter((u) => seFabrica(u.rol));
  const tieneEscaneo = hayAlMenosUnEscaneo(caso);

  return [
    {
      clave: "tipo-de-trabajo",
      titulo: "Qué se va a fabricar",
      queHacer:
        "Regrese al paso del trabajo y escoja los dientes de este caso, o agregue un trabajo de arcada completa.",
      cumplido: piezas.length > 0,
    },
    {
      clave: "escaneo",
      titulo: "Al menos un archivo de escaneo",
      queHacer:
        "Suba al menos un archivo (puede subir el conjunto completo o las quijadas por separado).",
      cumplido: tieneEscaneo,
    },
  ];
}

export function loQueFalta(caso: CasoParaAdmision) {
  return revisarAdmision(caso).filter((punto) => !punto.cumplido);
}

export function sePuedeEnviar(caso: CasoParaAdmision) {
  return loQueFalta(caso).length === 0;
}
