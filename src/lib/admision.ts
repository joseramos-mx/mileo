import type { RolDeUnidad } from "@/generated/prisma/enums";
import { TRABAJOS, seFabrica } from "@/lib/trabajos";

/**
 * Lista de admisión (SKILL.md O-2).
 *
 * Verifica que el caso tenga qué fabricar y todos los archivos obligatorios
 * subidos (y si lleva trabajo sobre implante, también el archivo sobre
 * implantes digitales).
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

export function llevaSobreImplante(unidades: { rol: RolDeUnidad }[]): boolean {
  return unidades.some((u) => TRABAJOS[u.rol]?.categoria === "Sobre implante");
}

function tieneArchivoCompleto(caso: CasoParaAdmision, tipo: string): boolean {
  return caso.archivos.some((a) => a.tipo === tipo && a.estado === "COMPLETO");
}

export function revisarAdmision(caso: CasoParaAdmision): EstadoDeAdmision[] {
  const piezas = caso.unidades.filter((u) => seFabrica(u.rol));
  const puntos: EstadoDeAdmision[] = [
    {
      clave: "tipo-de-trabajo",
      titulo: "Qué se va a fabricar",
      queHacer:
        "Regrese al paso del trabajo y escoja los dientes de este caso, o agregue un trabajo de arcada completa.",
      cumplido: piezas.length > 0,
    },
    {
      clave: "ESCANEO_PREPARACION",
      titulo: "Escaneo de la preparación",
      queHacer: "Suba el escaneo de la preparación en el primer apartado.",
      cumplido: tieneArchivoCompleto(caso, "ESCANEO_PREPARACION"),
    },
    {
      clave: "ESCANEO_ANTAGONISTA",
      titulo: "Escaneo del antagonista",
      queHacer: "Suba el escaneo del antagonista.",
      cumplido: tieneArchivoCompleto(caso, "ESCANEO_ANTAGONISTA"),
    },
    {
      clave: "REGISTRO_MORDIDA",
      titulo: "Registro de mordida",
      queHacer: "Suba el archivo del registro de mordida.",
      cumplido: tieneArchivoCompleto(caso, "REGISTRO_MORDIDA"),
    },
    {
      clave: "FOTO_COLOR",
      titulo: "Foto del color",
      queHacer: "Suba la foto del color del paciente.",
      cumplido: tieneArchivoCompleto(caso, "FOTO_COLOR"),
    },
  ];

  if (llevaSobreImplante(caso.unidades)) {
    puntos.push({
      clave: "OTRO",
      titulo: "Archivo sobre implantes digitales",
      queHacer:
        "Suba el archivo sobre implantes digitales (scanbody o referencia del implante).",
      cumplido: tieneArchivoCompleto(caso, "OTRO"),
    });
  }

  return puntos;
}

export function loQueFalta(caso: CasoParaAdmision) {
  return revisarAdmision(caso).filter((punto) => !punto.cumplido);
}

export function sePuedeEnviar(caso: CasoParaAdmision) {
  return loQueFalta(caso).length === 0;
}
