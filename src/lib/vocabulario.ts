import type {
  Etapa,
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
  { nombre: string; descripcion: string; roles: RolDeUnidad[] }
> = {
  CORONA_Y_PUENTE: {
    nombre: "Coronas y puentes",
    descripcion: "Zirconio, disilicato, metal porcelana",
    roles: ["CORONA", "PILAR", "PONTICO"],
  },
  SOBRE_IMPLANTE: {
    nombre: "Sobre implante",
    descripcion: "Aditamentos, coronas y barras",
    roles: ["CORONA", "ADITAMENTO", "BARRA"],
  },
  INCRUSTACION_Y_CARILLA: {
    nombre: "Incrustaciones y carillas",
    descripcion: "Inlay, onlay y carillas",
    roles: ["INCRUSTACION", "CARILLA"],
  },
  PROVISIONAL: {
    nombre: "Provisional",
    descripcion: "PMMA fresado o impreso",
    roles: ["PROVISIONAL"],
  },
  GUARDA_OCLUSAL: {
    nombre: "Guarda oclusal",
    descripcion: "Rígida o blanda",
    roles: ["GUARDA_OCLUSAL"],
  },
  MODELO_3D: {
    nombre: "Modelo 3D",
    descripcion: "Impresión 3D desde su escaneo",
    roles: ["MODELO"],
  },
};

/**
 * Que papel juega la unidad dentro del trabajo.
 *
 * No es lo mismo que la indicacion del caso: una corona sobre implante sigue
 * siendo una corona, y que vaya sobre implante lo dice la indicacion. Lo que
 * el rol contesta es otra cosa: si esa pieza se apoya en un diente preparado
 * (pilar) o cuelga entre dos (pontico). De ahi salen los puentes.
 */
export const ROLES_DE_UNIDAD: Record<RolDeUnidad, string> = {
  CORONA: "Corona",
  PILAR: "Pilar",
  PONTICO: "Póntico",
  CARILLA: "Carilla",
  INCRUSTACION: "Incrustación",
  ADITAMENTO: "Aditamento",
  PROVISIONAL: "Provisional",
  GUARDA_OCLUSAL: "Guarda oclusal",
  MODELO: "Modelo",
  BARRA: "Barra",
};

/** Como se le explica cada rol al doctor cuando escoge (§8). */
export const QUE_ES_CADA_ROL: Record<RolDeUnidad, string> = {
  CORONA: "Va sobre un diente preparado o sobre un implante.",
  PILAR: "Sostiene un puente. Va cementada sobre el diente preparado.",
  PONTICO: "Reemplaza el diente ausente. No toca hueso: cuelga de los pilares.",
  CARILLA: "Sólo la cara visible del diente.",
  INCRUSTACION: "Rellena la parte del diente que falta, inlay u onlay.",
  ADITAMENTO: "La pieza que une el implante con la corona.",
  PROVISIONAL: "Para que el paciente salga con algo puesto mientras tanto.",
  GUARDA_OCLUSAL: "Para el bruxismo. No va sobre un diente en particular.",
  MODELO: "El modelo impreso de la arcada.",
  BARRA: "La estructura que une varios implantes.",
};

export const MATERIALES: Record<Material, string> = {
  ZIRCONIO_MONOLITICO: "Zirconio monolítico",
  ZIRCONIO_ESTRATIFICADO: "Zirconio estratificado",
  DISILICATO_DE_LITIO: "Disilicato de litio",
  METAL_PORCELANA: "Metal porcelana",
  CROMO_COBALTO: "Cromo cobalto",
  TITANIO: "Titanio",
  PMMA: "PMMA",
  RESINA_IMPRESION: "Resina de impresión",
  CERA_CALCINABLE: "Cera calcinable",
};

/** Que materiales tienen sentido para cada rol. */
export const MATERIALES_POR_ROL: Record<RolDeUnidad, Material[]> = {
  CORONA: [
    "ZIRCONIO_MONOLITICO",
    "ZIRCONIO_ESTRATIFICADO",
    "DISILICATO_DE_LITIO",
    "METAL_PORCELANA",
  ],
  PILAR: [
    "ZIRCONIO_MONOLITICO",
    "ZIRCONIO_ESTRATIFICADO",
    "METAL_PORCELANA",
  ],
  PONTICO: [
    "ZIRCONIO_MONOLITICO",
    "ZIRCONIO_ESTRATIFICADO",
    "METAL_PORCELANA",
  ],
  CARILLA: ["DISILICATO_DE_LITIO", "ZIRCONIO_ESTRATIFICADO"],
  INCRUSTACION: ["DISILICATO_DE_LITIO", "ZIRCONIO_MONOLITICO"],
  ADITAMENTO: ["TITANIO", "ZIRCONIO_MONOLITICO"],
  PROVISIONAL: ["PMMA", "RESINA_IMPRESION"],
  GUARDA_OCLUSAL: ["PMMA", "RESINA_IMPRESION"],
  MODELO: ["RESINA_IMPRESION"],
  BARRA: ["TITANIO", "CROMO_COBALTO"],
};

/** Los roles que no llevan color: nadie escoge tono de una barra de titanio. */
export const ROLES_SIN_COLOR: RolDeUnidad[] = ["BARRA", "MODELO", "ADITAMENTO"];

/**
 * Los roles que arman un puente. Un puente es un grupo de unidades vecinas
 * donde los extremos son pilares y lo de en medio, ponticos: asi un 14-17 se
 * lee sin ambiguedad.
 */
export const ROLES_DE_PUENTE: RolDeUnidad[] = ["PILAR", "PONTICO"];

/** Guía Vita clásica, en el orden en que la usa el doctor. */
export const COLORES_VITA = [
  "A1",
  "A2",
  "A3",
  "A3.5",
  "A4",
  "B1",
  "B2",
  "B3",
  "B4",
  "C1",
  "C2",
  "C3",
  "C4",
  "D2",
  "D3",
  "D4",
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
