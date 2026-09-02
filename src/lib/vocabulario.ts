import { TRABAJOS } from "@/lib/trabajos";
import type {
  Arcada,
  Etapa,
  MetodoDeFabricacion,
  Retencion,
  Indicacion,
  Material,
  Prioridad,
  Rol,
  TipoArchivo,
  RolDeUnidad,
} from "@/generated/prisma/enums";

/**
 * El vocabulario de Mileo (SKILL.md §8).
 *
 * Las palabras fijas -- caso, unidad, etapa, aprobacion, solicitar ajuste,
 * rehacer, control de calidad, kit, fecha de entrega -- se escriben igual aqui,
 * en la base de datos y en pantalla. Este archivo es el unico lugar donde una
 * clave de la base se convierte en algo que lee una persona.
 *
 * Prohibido en la interfaz: orden, pedido, estatus, cola, rechazar, remake,
 * ETA, cuota, minimo, upload, preview, status.
 */

// ------------------------------------------------------------------- etapas

export const ETAPAS_DEL_DOCTOR: Etapa[] = [
  "RECIBIDO",
  "EN_REVISION",
  "ACEPTADO",
  "EN_DISENO",
  "ESPERANDO_APROBACION",
  "EN_FABRICACION",
  "EN_CONTROL_DE_CALIDAD",
  "LISTO_Y_EN_CAMINO",
  "ENTREGADO",
];

export const ETAPAS_DE_EXCEPCION: Etapa[] = ["EN_PAUSA", "REHACER"];

/**
 * Tono del chip de etapa. Tres, y cada uno contesta una sola pregunta:
 *
 *   pendiente (ambar) -- le toca al doctor hacer algo.
 *   proceso   (azul)  -- el laboratorio lo tiene, el doctor no hace nada.
 *   terminado (verde) -- ya salio de aqui.
 *
 * SKILL.md §5.1 admite dos semanticos; el azul de proceso es el tercero que
 * pidio el equipo de diseño y queda anotado en ENTREGA.md. El color nunca va
 * solo: el chip siempre lleva el nombre de la etapa escrito (§7).
 */
export type TonoDeEtapa = "proceso" | "pendiente" | "terminado";

type DescripcionDeEtapa = {
  nombre: string;
  tono: TonoDeEtapa;
  /** Que significa para el doctor, en una linea, sin jerga de taller. */
  paraElDoctor: string;
};

export const ETAPAS: Record<Etapa, DescripcionDeEtapa> = {
  RECIBIDO: {
    nombre: "Recibido",
    tono: "proceso",
    paraElDoctor: "Ya recibí su caso. Lo estoy revisando.",
  },
  EN_REVISION: {
    nombre: "En revisión",
    tono: "proceso",
    paraElDoctor: "Estoy revisando que el escaneo venga completo.",
  },
  ACEPTADO: {
    nombre: "Aceptado",
    tono: "proceso",
    paraElDoctor: "El caso está aceptado y ya tiene fecha de entrega.",
  },
  EN_DISENO: {
    nombre: "En diseño",
    tono: "proceso",
    paraElDoctor: "Su técnico está diseñando las unidades.",
  },
  ESPERANDO_APROBACION: {
    nombre: "Esperando su aprobación",
    tono: "pendiente",
    paraElDoctor: "El diseño está listo. Le toca revisarlo a usted.",
  },
  EN_FABRICACION: {
    nombre: "En fabricación",
    tono: "proceso",
    paraElDoctor: "Estamos fabricando su caso.",
  },
  EN_CONTROL_DE_CALIDAD: {
    nombre: "En control de calidad",
    tono: "proceso",
    paraElDoctor: "Revisando ajuste y color antes de enviarlo.",
  },
  LISTO_Y_EN_CAMINO: {
    nombre: "Listo y en camino",
    tono: "terminado",
    paraElDoctor: "Su caso ya va en camino a la clínica.",
  },
  ENTREGADO: {
    nombre: "Entregado",
    tono: "terminado",
    paraElDoctor: "Entregado.",
  },
  EN_PAUSA: {
    nombre: "En pausa",
    tono: "pendiente",
    paraElDoctor: "El caso está detenido. Le digo por qué en el chat.",
  },
  REHACER: {
    nombre: "Rehacer",
    tono: "pendiente",
    paraElDoctor: "Estamos rehaciendo este caso sin costo para usted.",
  },
};

/** Las etapas en las que la pelota está del lado del doctor. */
export function leTocaAlDoctor(etapa: Etapa) {
  return ETAPAS[etapa].tono === "pendiente";
}

// -------------------------------------------------------------- indicaciones

export const INDICACIONES: Record<
  Indicacion,
  {
    nombre: string;
    descripcion: string;
    /**
     * Con qué tipo de trabajo se estrena un diente en un caso de esta
     * indicación. No es una restricción: el catálogo completo sigue a la mano
     * en el odontograma, igual que en el programa de diseño del laboratorio.
     */
    porOmision: RolDeUnidad;
  }
> = {
  CORONA_Y_PUENTE: {
    nombre: "Coronas y puentes",
    descripcion: "Zirconio, disilicato, metal porcelana",
    porOmision: "CORONA_ANATOMICA",
  },
  SOBRE_IMPLANTE: {
    nombre: "Sobre implante",
    descripcion: "Aditamentos, coronas y barras",
    porOmision: "CORONA_ANATOMICA",
  },
  INCRUSTACION_Y_CARILLA: {
    nombre: "Incrustaciones y carillas",
    descripcion: "Inlay, onlay y carillas",
    porOmision: "INCRUSTACION",
  },
  PROVISIONAL: {
    nombre: "Provisional",
    descripcion: "PMMA fresado o impreso",
    porOmision: "CORONA_CASCARON",
  },
  GUARDA_OCLUSAL: {
    nombre: "Guarda oclusal",
    descripcion: "Rígida o blanda",
    porOmision: "GUARDA_OCLUSAL",
  },
  MODELO_3D: {
    nombre: "Modelo 3D",
    descripcion: "Impresión 3D desde su escaneo",
    porOmision: "MODELO",
  },
};

/**
 * El nombre, qué es, qué materiales le quedan y si lleva color de la guía Vita
 * son parte del tipo de trabajo, no de la pantalla: salen del catálogo y no se
 * repiten aquí. Ver `src/lib/trabajos.ts`.
 */
export const ROLES_DE_UNIDAD = Object.fromEntries(
  Object.entries(TRABAJOS).map(([rol, tipo]) => [rol, tipo.nombre]),
) as Record<RolDeUnidad, string>;

export const QUE_ES_CADA_ROL = Object.fromEntries(
  Object.entries(TRABAJOS).map(([rol, tipo]) => [rol, tipo.queEs]),
) as Record<RolDeUnidad, string>;

export const MATERIALES_POR_ROL = Object.fromEntries(
  Object.entries(TRABAJOS).map(([rol, tipo]) => [rol, tipo.materiales]),
) as Record<RolDeUnidad, Material[]>;

/** Los que no llevan color: nadie escoge tono de una barra de titanio. */
export const ROLES_SIN_COLOR = (Object.keys(TRABAJOS) as RolDeUnidad[]).filter(
  (rol) => !TRABAJOS[rol].campos.includes("color"),
);

export const METODOS: Record<MetodoDeFabricacion, string> = {
  FRESADO: "Fresado",
  IMPRESO_3D: "Impreso en 3D",
  PRENSADO: "Prensado",
  COLADO: "Colado",
  SINTERIZADO_LASER: "Sinterizado láser",
  TERMOFORMADO: "Termoformado",
};

export const MATERIALES: Record<Material, string> = {
  ZIRCONIO_MONOLITICO: "Zirconio monolítico",
  ZIRCONIO_ESTRATIFICADO: "Zirconio multicapa",
  ZIRCONIO_ULTRAFINO: "Zirconio ultrafino",
  ZIRCONIO_SOBRE_TITANIO: "Zirconio sobre base de titanio",
  DISILICATO_DE_LITIO: "Disilicato de litio",
  CERAMICA_PRENSADA: "Cerámica prensada",
  METAL_PORCELANA: "Metal-cerámica",
  CROMO_COBALTO: "Cobalto-cromo",
  TITANIO: "Titanio grado 5",
  PMMA: "PMMA",
  PMMA_TRANSPARENTE: "PMMA transparente",
  RESINA_IMPRESION: "Resina impresa",
  RESINA_TERMOPOLIMERIZABLE: "Resina termopolimerizable",
  RESINA_FLEXIBLE: "Resina flexible",
  CERA_CALCINABLE: "Cera",
};

/**
 * Con qué se puede hacer cada material.
 *
 * El método sale del material, no del tipo de trabajo: el zirconio se fresa, la
 * resina impresa se imprime, el disilicato se fresa o se prensa. Los que traen
 * una sola opción se enseñan apagados —no hay nada que escoger—; los que traen
 * dos, encendidos.
 */
export const METODOS_POR_MATERIAL: Record<Material, MetodoDeFabricacion[]> = {
  ZIRCONIO_MONOLITICO: ["FRESADO"],
  ZIRCONIO_ESTRATIFICADO: ["FRESADO"],
  ZIRCONIO_ULTRAFINO: ["FRESADO"],
  ZIRCONIO_SOBRE_TITANIO: ["FRESADO"],
  DISILICATO_DE_LITIO: ["FRESADO", "PRENSADO"],
  CERAMICA_PRENSADA: ["PRENSADO"],
  // El catálogo no la menciona; en el taller se cuela o se fresa.
  METAL_PORCELANA: ["COLADO", "FRESADO"],
  CROMO_COBALTO: ["FRESADO", "SINTERIZADO_LASER"],
  TITANIO: ["FRESADO"],
  PMMA: ["FRESADO"],
  PMMA_TRANSPARENTE: ["FRESADO"],
  RESINA_IMPRESION: ["IMPRESO_3D"],
  // La termopolimerizable se empaca y se prensa en mufla.
  RESINA_TERMOPOLIMERIZABLE: ["PRENSADO"],
  RESINA_FLEXIBLE: ["PRENSADO"],
  CERA_CALCINABLE: ["FRESADO", "IMPRESO_3D"],
};

/** Si el doctor puede escoger el método, o si el material ya lo decidió. */
export function seEscogeElMetodo(material: Material) {
  return METODOS_POR_MATERIAL[material].length > 1;
}

// --------------------------------------------------------------- el color

/** Cuando el color va en una foto y no en una clave de la guía. */
export const COLOR_SEGUN_FOTO = "SEGUN_FOTO";

/** Guía Vita clásica, en el orden en que la usa el doctor. */
export const COLORES_VITA = [
  "A1", "A2", "A3", "A3.5", "A4",
  "B1", "B2", "B3", "B4",
  "C1", "C2", "C3", "C4",
  "D2", "D3", "D4",
];

/** Vita 3D-Master, para quien trabaja con esa guía. */
export const COLORES_3D_MASTER = [
  "0M1", "0M2", "0M3",
  "1M1", "1M2",
  "2L1.5", "2L2.5", "2M1", "2M2", "2M3", "2R1.5", "2R2.5",
  "3L1.5", "3L2.5", "3M1", "3M2", "3M3", "3R1.5", "3R2.5",
  "4L1.5", "4L2.5", "4M1", "4M2", "4M3", "4R1.5", "4R2.5",
  "5M1", "5M2", "5M3",
];

/** Blanqueamiento. */
export const COLORES_BLANQUEAMIENTO = ["BL1", "BL2", "BL3", "BL4"];

/**
 * El color, agrupado como viene en las guías.
 *
 * "Según la foto que adjunté" va siempre al principio: en un caso estético el
 * doctor manda la foto con la guía en boca, y obligarlo a escoger una clave
 * que no representa lo que quiere es empujarlo a mentir en el formulario.
 */
export const GRUPOS_DE_COLOR: { nombre: string; colores: string[] }[] = [
  { nombre: "Vita clásica", colores: COLORES_VITA },
  { nombre: "Vita 3D-Master", colores: COLORES_3D_MASTER },
  { nombre: "Blanqueamiento", colores: COLORES_BLANQUEAMIENTO },
];

export const TODOS_LOS_COLORES = [
  COLOR_SEGUN_FOTO,
  ...GRUPOS_DE_COLOR.flatMap((g) => g.colores),
];

export function nombreDelColor(color: string) {
  return color === COLOR_SEGUN_FOTO ? "Según la foto que adjunté" : color;
}

/** Sobre qué arcada va un trabajo de arcada. */
export const ARCADAS_EN_PALABRAS: Record<Arcada, string> = {
  SUPERIOR: "Arcada superior",
  INFERIOR: "Arcada inferior",
};

/** Cómo se sujeta una restauración sobre implante. */
export const RETENCIONES: Record<Retencion, string> = {
  ATORNILLADA: "Atornillada",
  CEMENTADA: "Cementada",
};

/** El color de la encía en una prótesis. */
export const COLORES_DE_ENCIA = [
  "Rosa claro",
  "Rosa",
  "Rosa intenso",
  "Rosa veteado",
  "Transparente",
];

// -------------------------------------------------------------------- otros

export const ROLES: Record<Rol, string> = {
  DOCTOR: "Doctor",
  ASISTENTE: "Asistente de la clínica",
  ADMISION: "Admisión",
  DISENO: "Diseño",
  MANUFACTURA: "Manufactura",
  ACABADO: "Acabado",
  CALIDAD: "Control de calidad",
  DIRECCION: "Dirección",
};

export const ROLES_DEL_LABORATORIO: Rol[] = [
  "ADMISION",
  "DISENO",
  "MANUFACTURA",
  "ACABADO",
  "CALIDAD",
  "DIRECCION",
];

export const PRIORIDADES: Record<Prioridad, string> = {
  NORMAL: "Normal",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

export const TIPOS_DE_ARCHIVO: Record<TipoArchivo, string> = {
  ESCANEO_PREPARACION: "Escaneo de la preparación",
  ESCANEO_ANTAGONISTA: "Escaneo del antagonista",
  REGISTRO_MORDIDA: "Registro de mordida",
  FOTO_COLOR: "Foto del color",
  DISENO: "Diseño",
  MALLA_LIGERA: "Vista 3D",
  FOTO_CALIDAD_AJUSTE: "Foto de ajuste",
  FOTO_CALIDAD_COLOR: "Foto de color",
  OTRO: "Otro archivo",
};

/** Notación FDI, como la ve el doctor en el odontograma. */
export const DIENTES_SUPERIORES = [
  18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28,
];
export const DIENTES_INFERIORES = [
  48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38,
];

export function nombreDelDiente(diente: number) {
  const posicion = diente % 10;
  const nombres = [
    "central",
    "lateral",
    "canino",
    "primer premolar",
    "segundo premolar",
    "primer molar",
    "segundo molar",
    "tercer molar",
  ];
  const cuadrante = Math.floor(diente / 10);
  const lado = cuadrante === 1 || cuadrante === 4 ? "derecho" : "izquierdo";
  const arcada = cuadrante === 1 || cuadrante === 2 ? "superior" : "inferior";
  return `${nombres[posicion - 1]} ${arcada} ${lado}`;
}
