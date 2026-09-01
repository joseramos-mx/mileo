import type { Indicacion } from "@/generated/prisma/enums";

/**
 * Control de calidad y envío (SKILL.md O-6).
 *
 * Aquí viven las tres reglas que impiden que un caso salga mal del laboratorio.
 * Las usa la pantalla y también la acción del servidor: intentar enviar sin
 * fotos o con el kit incompleto tiene que ser imposible desde la interfaz y
 * desde la API.
 */

// ------------------------------------------------------------------- el kit

export type PiezaDelKit = {
  clave: string;
  nombre: string;
  /** Si es falso, se puede mandar sin ella. */
  obligatoria: boolean;
};

/**
 * Kit por tipo de trabajo.
 *
 * ⚠️ Pendiente del Product Owner: confirmar con el laboratorio qué va en cada
 * kit. Estas listas salen de lo que menciona SKILL.md O-6 (pieza, tornillo,
 * desarmador, análogo, hoja de caso) repartido por indicación.
 */
export const KIT_POR_INDICACION: Record<Indicacion, PiezaDelKit[]> = {
  CORONA_Y_PUENTE: [
    { clave: "pieza", nombre: "La pieza terminada", obligatoria: true },
    { clave: "hoja", nombre: "Hoja del caso", obligatoria: true },
    { clave: "modelo", nombre: "Modelo impreso", obligatoria: false },
  ],
  SOBRE_IMPLANTE: [
    { clave: "pieza", nombre: "La pieza terminada", obligatoria: true },
    { clave: "tornillo", nombre: "Tornillo", obligatoria: true },
    { clave: "desarmador", nombre: "Desarmador", obligatoria: true },
    { clave: "analogo", nombre: "Análogo", obligatoria: true },
    { clave: "hoja", nombre: "Hoja del caso", obligatoria: true },
  ],
  INCRUSTACION_Y_CARILLA: [
    { clave: "pieza", nombre: "La pieza terminada", obligatoria: true },
    { clave: "hoja", nombre: "Hoja del caso", obligatoria: true },
  ],
  PROVISIONAL: [
    { clave: "pieza", nombre: "La pieza terminada", obligatoria: true },
    { clave: "hoja", nombre: "Hoja del caso", obligatoria: true },
  ],
  GUARDA_OCLUSAL: [
    { clave: "pieza", nombre: "La guarda", obligatoria: true },
    { clave: "hoja", nombre: "Hoja del caso", obligatoria: true },
  ],
  MODELO_3D: [
    { clave: "modelo", nombre: "El modelo impreso", obligatoria: true },
    { clave: "hoja", nombre: "Hoja del caso", obligatoria: true },
  ],
};

// ------------------------------------------------------------- las dos fotos

export const FOTOS_OBLIGATORIAS = [
  {
    tipo: "FOTO_CALIDAD_AJUSTE" as const,
    nombre: "Foto del ajuste",
    ayuda: "La pieza asentada en el modelo, donde se vea el margen.",
  },
  {
    tipo: "FOTO_CALIDAD_COLOR" as const,
    nombre: "Foto del color",
    ayuda: "Junto a la guía de color, con luz de día.",
  },
];

// -------------------------------------------------------------- comprobación

export type CasoParaCalidad = {
  indicacion: Indicacion;
  archivos: { tipo: string; estado: string }[];
};

export type PuntoDeCalidad = {
  clave: string;
  titulo: string;
  queHacer: string;
  cumplido: boolean;
};

export function revisarCalidad(
  caso: CasoParaCalidad,
  kitMarcado: string[],
): PuntoDeCalidad[] {
  const tiene = (tipo: string) =>
    caso.archivos.some((a) => a.tipo === tipo && a.estado === "COMPLETO");

  const fotos: PuntoDeCalidad[] = FOTOS_OBLIGATORIAS.map((foto) => ({
    clave: foto.tipo,
    titulo: foto.nombre,
    queHacer: `Tome la foto: ${foto.ayuda}`,
    cumplido: tiene(foto.tipo),
  }));

  const kit: PuntoDeCalidad[] = KIT_POR_INDICACION[caso.indicacion]
    .filter((pieza) => pieza.obligatoria)
    .map((pieza) => ({
      clave: `kit:${pieza.clave}`,
      titulo: pieza.nombre,
      queHacer: `Métalo en la caja y márquelo aquí.`,
      cumplido: kitMarcado.includes(pieza.clave),
    }));

  return [...fotos, ...kit];
}

export function loQueFaltaParaEnviar(
  caso: CasoParaCalidad,
  kitMarcado: string[],
) {
  return revisarCalidad(caso, kitMarcado).filter((p) => !p.cumplido);
}

export function sePuedeEnviar(caso: CasoParaCalidad, kitMarcado: string[]) {
  return loQueFaltaParaEnviar(caso, kitMarcado).length === 0;
}

// ------------------------------------------------- separación de funciones

/**
 * El sistema impide que el mismo usuario cierre diseño y calidad del mismo
 * caso (O-6). Saltárselo requiere autorización de dirección, y queda escrito.
 *
 * Quien "cerró el diseño" es quien mandó el diseño a aprobación: es el técnico
 * asignado al caso.
 */
export function mismaPersonaEnDisenoYCalidad(
  tecnicoDelCaso: string | null,
  quienCierraCalidad: string,
) {
  return tecnicoDelCaso !== null && tecnicoDelCaso === quienCierraCalidad;
}
