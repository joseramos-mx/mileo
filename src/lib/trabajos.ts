import type {
  Indicacion,
  Material,
  RolDeUnidad,
} from "@/generated/prisma/enums";

/**
 * El catálogo de trabajos del laboratorio.
 *
 * GENERADO por `python scripts/generar-catalogo.py`. Agregar un tipo es agregar
 * un renglón allá, su valor en el enum de Prisma y su migración.
 *
 * Cada tipo dice tres cosas que el resto del sistema obedece:
 *
 *   alcance   sobre qué se asigna. No todo se pone en un diente: una barra va
 *             sobre un tramo de dientes unidos, una guarda sobre una arcada
 *             entera, y el antagonista no es una pieza sino una anotación.
 *   campos    qué se le pregunta al doctor. Un campo que no aplica no se
 *             enseña apagado: no se enseña (§6.5).
 *   color     el suyo, para el diente y la pastilla. Son veintinueve y no son
 *             roles de la interfaz sino un dato del catálogo, por eso viven en
 *             esta tabla y no en `globals.css`.
 *
 * Los dos pares de color están medidos: la pastilla llega a 4.5:1 y el número
 * del diente sobre el relleno también (§7). El guion que genera esto se niega a
 * escribir un color que no alcance, y `npm run prueba:odontograma` lo vuelve a
 * medir en pantalla.
 */

/** Sobre qué se asigna un trabajo. */
export type AlcanceDeTrabajo =
  /** Un toque en el odontograma: una unidad, un diente. */
  | "DIENTE"
  /** Sobre dos o más dientes vecinos unidos entre sí. */
  | "TRAMO"
  /** Sobre una arcada completa. No se toca ningún diente. */
  | "ARCADA"
  /** Una anotación sobre el diente. No se fabrica ni se cotiza. */
  | "CONTEXTO";

/** Lo que se le pregunta al doctor de una unidad. */
export type CampoDeUnidad =
  | "material"
  | "metodo"
  | "color"
  | "sistemaImplante"
  | "retencion"
  | "espesorAlivio"
  | "grosor"
  | "colorBase"
  | "colorDientes"
  | "troqueles"
  | "notas";

export type TipoDeTrabajo = {
  nombre: string;
  /** Qué es, en una línea, para el doctor (§8). */
  queEs: string;
  categoria: string;
  alcance: AlcanceDeTrabajo;
  color: string;
  colorTenue: string;
  colorDelTexto: string;
  materiales: Material[];
  campos: CampoDeUnidad[];
  /**
   * Si sale en la lista corta del doctor. Veintinueve opciones paralizan a un
   * dentista y le cuestan al laboratorio en errores de captura; el laboratorio
   * ve la lista entera y afina el tipo al diseñar.
   */
  enListaCorta: boolean;
};

export const TRABAJOS: Record<RolDeUnidad, TipoDeTrabajo> = {
  CORONA_ANATOMICA: {
    nombre: "Corona anatómica",
    queEs: "La corona completa, con su forma y su anatomía.",
    categoria: "Coronas y cofias",
    alcance: "DIENTE",
    color: "#7b3ff2",
    colorTenue: "#decffc",
    colorDelTexto: "#ffffff",
    materiales: ["ZIRCONIO_MONOLITICO", "ZIRCONIO_ESTRATIFICADO", "DISILICATO_DE_LITIO", "PMMA", "RESINA_IMPRESION", "METAL_PORCELANA", "TITANIO"],
    campos: ["material", "metodo", "color", "notas"],
    enListaCorta: true,
  },
  COFIA: {
    nombre: "Cofia",
    queEs: "La estructura interna. Se recubre después con cerámica.",
    categoria: "Coronas y cofias",
    alcance: "DIENTE",
    color: "#0f7b6c",
    colorTenue: "#c3deda",
    colorDelTexto: "#ffffff",
    materiales: ["ZIRCONIO_MONOLITICO", "DISILICATO_DE_LITIO", "CROMO_COBALTO", "TITANIO"],
    campos: ["material", "metodo", "notas"],
    enListaCorta: true,
  },
  CORONA_PRENSADA: {
    nombre: "Corona prensada",
    queEs: "Corona completa fabricada por técnica de prensado.",
    categoria: "Coronas y cofias",
    alcance: "DIENTE",
    color: "#7cb342",
    colorTenue: "#deecd0",
    colorDelTexto: "#1d2126",
    materiales: ["DISILICATO_DE_LITIO", "CERAMICA_PRENSADA"],
    campos: ["material", "metodo", "color", "notas"],
    enListaCorta: false,
  },
  CORONA_CASCARON: {
    nombre: "Corona cascarón (provisional)",
    queEs: "Cascarón hueco, para el provisional del paciente.",
    categoria: "Coronas y cofias",
    alcance: "DIENTE",
    color: "#6a1fd0",
    colorTenue: "#dac7f3",
    colorDelTexto: "#ffffff",
    materiales: ["PMMA", "RESINA_IMPRESION"],
    campos: ["material", "metodo", "color", "notas"],
    enListaCorta: true,
  },
  COFIA_CON_ALIVIO: {
    nombre: "Cofia con alivio",
    queEs: "Cofia con espacio adicional para el material que va encima.",
    categoria: "Coronas y cofias",
    alcance: "DIENTE",
    color: "#2b833c",
    colorTenue: "#cae0ce",
    colorDelTexto: "#ffffff",
    materiales: ["ZIRCONIO_MONOLITICO", "DISILICATO_DE_LITIO", "CROMO_COBALTO", "TITANIO"],
    campos: ["material", "metodo", "espesorAlivio", "notas"],
    enListaCorta: false,
  },
  MOCKUP: {
    nombre: "Mockup",
    queEs: "Prueba de forma para enseñarle el resultado al paciente antes de tallar.",
    categoria: "Coronas y cofias",
    alcance: "DIENTE",
    color: "#c74767",
    colorTenue: "#f1d1d9",
    colorDelTexto: "#ffffff",
    materiales: ["PMMA", "RESINA_IMPRESION", "CERA_CALCINABLE"],
    campos: ["material", "metodo", "notas"],
    enListaCorta: false,
  },
  PONTICO_ANATOMICO: {
    nombre: "Póntico anatómico",
    queEs: "El diente que va en el espacio, con su forma completa.",
    categoria: "Pónticos",
    alcance: "DIENTE",
    color: "#8e1a3a",
    colorTenue: "#e3c6ce",
    colorDelTexto: "#ffffff",
    materiales: ["ZIRCONIO_MONOLITICO", "ZIRCONIO_ESTRATIFICADO", "DISILICATO_DE_LITIO", "PMMA", "RESINA_IMPRESION", "METAL_PORCELANA", "TITANIO"],
    campos: ["material", "metodo", "color", "notas"],
    enListaCorta: true,
  },
  PONTICO_REDUCIDO: {
    nombre: "Póntico reducido",
    queEs: "Póntico con la forma reducida para recubrirlo con cerámica.",
    categoria: "Pónticos",
    alcance: "DIENTE",
    color: "#c2185b",
    colorTenue: "#f0c5d6",
    colorDelTexto: "#ffffff",
    materiales: ["ZIRCONIO_MONOLITICO", "DISILICATO_DE_LITIO", "CROMO_COBALTO"],
    campos: ["material", "metodo", "notas"],
    enListaCorta: false,
  },
  PONTICO_PRENSADO: {
    nombre: "Póntico prensado",
    queEs: "Póntico fabricado por técnica de prensado.",
    categoria: "Pónticos",
    alcance: "DIENTE",
    color: "#3d8fd1",
    colorTenue: "#cee3f4",
    colorDelTexto: "#1d2126",
    materiales: ["DISILICATO_DE_LITIO", "CERAMICA_PRENSADA"],
    campos: ["material", "metodo", "color", "notas"],
    enListaCorta: false,
  },
  PONTICO_CASCARON: {
    nombre: "Póntico cascarón (provisional)",
    queEs: "Póntico hueco, para el puente provisional.",
    categoria: "Pónticos",
    alcance: "DIENTE",
    color: "#a3216b",
    colorTenue: "#e8c8da",
    colorDelTexto: "#ffffff",
    materiales: ["PMMA", "RESINA_IMPRESION"],
    campos: ["material", "metodo", "color", "notas"],
    enListaCorta: false,
  },
  INCRUSTACION: {
    nombre: "Incrustación inlay u onlay",
    queEs: "Restauración parcial que va dentro o sobre la cúspide.",
    categoria: "Incrustaciones y carillas",
    alcance: "DIENTE",
    color: "#2e7d32",
    colorTenue: "#cbdecc",
    colorDelTexto: "#ffffff",
    materiales: ["DISILICATO_DE_LITIO", "ZIRCONIO_MONOLITICO", "RESINA_IMPRESION"],
    campos: ["material", "metodo", "color", "notas"],
    enListaCorta: true,
  },
  INCRUSTACION_CON_ALIVIO: {
    nombre: "Incrustación con alivio",
    queEs: "Incrustación con espacio para el recubrimiento.",
    categoria: "Incrustaciones y carillas",
    alcance: "DIENTE",
    color: "#1565c0",
    colorTenue: "#c4d8ef",
    colorDelTexto: "#ffffff",
    materiales: ["DISILICATO_DE_LITIO", "ZIRCONIO_MONOLITICO"],
    campos: ["material", "metodo", "espesorAlivio", "notas"],
    enListaCorta: false,
  },
  CARILLA: {
    nombre: "Carilla",
    queEs: "Lámina que cubre sólo la cara visible del diente.",
    categoria: "Incrustaciones y carillas",
    alcance: "DIENTE",
    color: "#00796b",
    colorTenue: "#bfdeda",
    colorDelTexto: "#ffffff",
    materiales: ["DISILICATO_DE_LITIO", "ZIRCONIO_ULTRAFINO", "RESINA_IMPRESION"],
    campos: ["material", "metodo", "color", "notas"],
    enListaCorta: true,
  },
  ENCERADO_ANATOMICO: {
    nombre: "Encerado anatómico",
    queEs: "Copia la forma completa de un encerado o provisional que ya existe.",
    categoria: "Copiado digital",
    alcance: "DIENTE",
    color: "#00a878",
    colorTenue: "#bfe9dd",
    colorDelTexto: "#1d2126",
    materiales: ["CERA_CALCINABLE", "PMMA", "RESINA_IMPRESION"],
    campos: ["material", "metodo", "notas"],
    enListaCorta: false,
  },
  ENCERADO_REDUCIDO: {
    nombre: "Encerado reducido",
    queEs: "Copia esa forma, reducida para recubrir con cerámica.",
    categoria: "Copiado digital",
    alcance: "DIENTE",
    color: "#6d4c41",
    colorTenue: "#dad2d0",
    colorDelTexto: "#ffffff",
    materiales: ["CERA_CALCINABLE", "PMMA", "RESINA_IMPRESION"],
    campos: ["material", "metodo", "notas"],
    enListaCorta: false,
  },
  ENCERADO_DE_PONTICO: {
    nombre: "Encerado de póntico",
    queEs: "Copia la forma del póntico de un encerado existente.",
    categoria: "Copiado digital",
    alcance: "DIENTE",
    color: "#5e35b1",
    colorTenue: "#d7ccec",
    colorDelTexto: "#ffffff",
    materiales: ["CERA_CALCINABLE", "PMMA", "RESINA_IMPRESION"],
    campos: ["material", "metodo", "notas"],
    enListaCorta: false,
  },
  ADITAMENTO: {
    nombre: "Aditamento",
    queEs: "Pieza que conecta el implante con la restauración.",
    categoria: "Sobre implante",
    alcance: "DIENTE",
    color: "#00494d",
    colorTenue: "#bfd2d2",
    colorDelTexto: "#ffffff",
    materiales: ["TITANIO", "ZIRCONIO_SOBRE_TITANIO"],
    campos: ["material", "metodo", "sistemaImplante", "color", "notas"],
    enListaCorta: true,
  },
  PILAR_DE_BARRA: {
    nombre: "Pilar de barra",
    queEs: "El punto donde la barra se atornilla al implante.",
    categoria: "Sobre implante",
    alcance: "DIENTE",
    color: "#5a4a1f",
    colorTenue: "#d6d2c7",
    colorDelTexto: "#ffffff",
    materiales: ["TITANIO", "CROMO_COBALTO"],
    campos: ["material", "metodo", "sistemaImplante", "notas"],
    enListaCorta: false,
  },
  SEGMENTO_DE_BARRA: {
    nombre: "Segmento de barra",
    queEs: "El tramo de barra entre dos pilares.",
    categoria: "Barras y estructuras",
    alcance: "TRAMO",
    color: "#5f4b9e",
    colorTenue: "#d7d2e7",
    colorDelTexto: "#ffffff",
    materiales: ["TITANIO", "CROMO_COBALTO"],
    campos: ["material", "metodo", "notas"],
    enListaCorta: false,
  },
  SUBESTRUCTURA_CON_ALIVIO: {
    nombre: "Subestructura con alivio",
    queEs: "Estructura con espacio para el material que va encima.",
    categoria: "Barras y estructuras",
    alcance: "TRAMO",
    color: "#7d7455",
    colorTenue: "#dedcd4",
    colorDelTexto: "#ffffff",
    materiales: ["ZIRCONIO_MONOLITICO", "CROMO_COBALTO", "TITANIO"],
    campos: ["material", "metodo", "espesorAlivio", "notas"],
    enListaCorta: false,
  },
  PROTESIS_TOTAL: {
    nombre: "Prótesis total",
    queEs: "Dentadura completa para una arcada sin dientes.",
    categoria: "Removibles y aparatos",
    alcance: "ARCADA",
    color: "#0097a7",
    colorTenue: "#bfe5e9",
    colorDelTexto: "#1d2126",
    materiales: ["RESINA_TERMOPOLIMERIZABLE", "RESINA_IMPRESION"],
    campos: ["material", "metodo", "colorBase", "colorDientes", "notas"],
    enListaCorta: true,
  },
  PROTESIS_PARCIAL: {
    nombre: "Prótesis parcial",
    queEs: "Prótesis removible que se apoya en los dientes que quedan.",
    categoria: "Removibles y aparatos",
    alcance: "ARCADA",
    color: "#9a673c",
    colorTenue: "#e6d9ce",
    colorDelTexto: "#ffffff",
    materiales: ["CROMO_COBALTO", "TITANIO", "RESINA_FLEXIBLE"],
    campos: ["material", "metodo", "colorBase", "colorDientes", "notas"],
    enListaCorta: true,
  },
  GUARDA_OCLUSAL: {
    nombre: "Guarda oclusal",
    queEs: "Férula para bruxismo o para proteger la oclusión.",
    categoria: "Removibles y aparatos",
    alcance: "ARCADA",
    color: "#37474f",
    colorTenue: "#cdd1d3",
    colorDelTexto: "#ffffff",
    materiales: ["PMMA_TRANSPARENTE", "RESINA_IMPRESION", "RESINA_FLEXIBLE"],
    campos: ["material", "metodo", "grosor", "notas"],
    enListaCorta: true,
  },
  TELESCOPICA_PRIMARIA: {
    nombre: "Corona telescópica primaria",
    queEs: "La corona interna, fija sobre el diente.",
    categoria: "Removibles y aparatos",
    alcance: "DIENTE",
    color: "#a8536b",
    colorTenue: "#e9d4da",
    colorDelTexto: "#ffffff",
    materiales: ["TITANIO", "CROMO_COBALTO", "ZIRCONIO_MONOLITICO"],
    campos: ["material", "metodo", "notas"],
    enListaCorta: false,
  },
  TELESCOPICA_SECUNDARIA: {
    nombre: "Corona telescópica secundaria",
    queEs: "La corona externa, unida a la prótesis removible.",
    categoria: "Removibles y aparatos",
    alcance: "DIENTE",
    color: "#795548",
    colorTenue: "#ded4d1",
    colorDelTexto: "#ffffff",
    materiales: ["CROMO_COBALTO", "TITANIO"],
    campos: ["material", "metodo", "notas"],
    enListaCorta: false,
  },
  MODELO: {
    nombre: "Modelo",
    queEs: "Modelo impreso en 3D del caso.",
    categoria: "Modelos",
    alcance: "ARCADA",
    color: "#455a64",
    colorTenue: "#d0d6d8",
    colorDelTexto: "#ffffff",
    materiales: ["RESINA_IMPRESION"],
    campos: ["material", "metodo", "troqueles", "notas"],
    enListaCorta: true,
  },
  ANTAGONISTA: {
    nombre: "Antagonista",
    queEs: "La arcada opuesta. Se usa para ajustar la oclusión.",
    categoria: "Dentición restante",
    alcance: "CONTEXTO",
    color: "#c44e00",
    colorTenue: "#f0d3bf",
    colorDelTexto: "#ffffff",
    materiales: [],
    campos: ["notas"],
    enListaCorta: true,
  },
  DIENTE_VECINO: {
    nombre: "Diente vecino",
    queEs: "Diente contiguo que se toma como referencia.",
    categoria: "Dentición restante",
    alcance: "CONTEXTO",
    color: "#8a6d1f",
    colorTenue: "#e2dac7",
    colorDelTexto: "#ffffff",
    materiales: [],
    campos: ["notas"],
    enListaCorta: true,
  },
  OMITIR_EN_PUENTE: {
    nombre: "Omitir en el puente",
    queEs: "Espacio que el puente cruza sin colocar diente.",
    categoria: "Dentición restante",
    alcance: "CONTEXTO",
    color: "#c62828",
    colorTenue: "#f1c9c9",
    colorDelTexto: "#ffffff",
    materiales: [],
    campos: ["notas"],
    enListaCorta: true,
  },
};

/** Las categorías, en el orden en que se enseñan. */
export const CATEGORIAS: { nombre: string; tipos: RolDeUnidad[] }[] = [
  { nombre: "Coronas y cofias", tipos: ["CORONA_ANATOMICA", "COFIA", "CORONA_PRENSADA", "CORONA_CASCARON", "COFIA_CON_ALIVIO", "MOCKUP"] },
  { nombre: "Pónticos", tipos: ["PONTICO_ANATOMICO", "PONTICO_REDUCIDO", "PONTICO_PRENSADO", "PONTICO_CASCARON"] },
  { nombre: "Incrustaciones y carillas", tipos: ["INCRUSTACION", "INCRUSTACION_CON_ALIVIO", "CARILLA"] },
  { nombre: "Copiado digital", tipos: ["ENCERADO_ANATOMICO", "ENCERADO_REDUCIDO", "ENCERADO_DE_PONTICO"] },
  { nombre: "Sobre implante", tipos: ["ADITAMENTO", "PILAR_DE_BARRA"] },
  { nombre: "Barras y estructuras", tipos: ["SEGMENTO_DE_BARRA", "SUBESTRUCTURA_CON_ALIVIO"] },
  { nombre: "Removibles y aparatos", tipos: ["PROTESIS_TOTAL", "PROTESIS_PARCIAL", "GUARDA_OCLUSAL", "TELESCOPICA_PRIMARIA", "TELESCOPICA_SECUNDARIA"] },
  { nombre: "Modelos", tipos: ["MODELO"] },
  { nombre: "Dentición restante", tipos: ["ANTAGONISTA", "DIENTE_VECINO", "OMITIR_EN_PUENTE"] },
];

export const TODOS_LOS_ROLES = Object.keys(TRABAJOS) as RolDeUnidad[];

/**
 * Lo que sí se fabrica y se cotiza.
 *
 * Una anotación —antagonista, diente vecino, omitir en el puente— se captura
 * porque el técnico necesita saberla, pero no es una unidad: no cuenta para el
 * resumen del caso, no se cotiza y no suma puntos del comodato.
 */
export function seFabrica(rol: RolDeUnidad) {
  return TRABAJOS[rol].alcance !== "CONTEXTO";
}

/** Si el trabajo le pregunta este campo al doctor. */
export function pregunta(rol: RolDeUnidad, campo: CampoDeUnidad) {
  return TRABAJOS[rol].campos.includes(campo);
}

/** Sirve de extremo de un tramo: se apoya en un diente preparado. */
export function puedeSerPilar(rol: RolDeUnidad) {
  return PILARES.includes(rol);
}

/** Va en medio de un tramo, colgando de los pilares. */
export function esPontico(rol: RolDeUnidad) {
  return PONTICOS.includes(rol);
}

/** Los que se apoyan en un diente preparado y pueden cerrar un tramo. */
const PILARES: RolDeUnidad[] = [
  "CORONA_ANATOMICA",
  "COFIA",
  "CORONA_PRENSADA",
  "CORONA_CASCARON",
  "COFIA_CON_ALIVIO",
  "ENCERADO_ANATOMICO",
  "ENCERADO_REDUCIDO",
  "TELESCOPICA_PRIMARIA",
  "TELESCOPICA_SECUNDARIA",
  "PILAR_DE_BARRA",
];

/**
 * A que indicacion pertenece cada tipo de trabajo.
 *
 * La indicacion no se pregunta: se deduce de lo capturado, y de ella sale el
 * kit que va en la caja (O-6).
 */
const INDICACION_DE_CADA_ROL: Partial<Record<RolDeUnidad, Indicacion>> = {
  CORONA_ANATOMICA: "CORONA_Y_PUENTE",
  COFIA: "CORONA_Y_PUENTE",
  CORONA_PRENSADA: "CORONA_Y_PUENTE",
  CORONA_CASCARON: "PROVISIONAL",
  COFIA_CON_ALIVIO: "CORONA_Y_PUENTE",
  MOCKUP: "PROVISIONAL",
  PONTICO_ANATOMICO: "CORONA_Y_PUENTE",
  PONTICO_REDUCIDO: "CORONA_Y_PUENTE",
  PONTICO_PRENSADO: "CORONA_Y_PUENTE",
  PONTICO_CASCARON: "PROVISIONAL",
  INCRUSTACION: "INCRUSTACION_Y_CARILLA",
  INCRUSTACION_CON_ALIVIO: "INCRUSTACION_Y_CARILLA",
  CARILLA: "INCRUSTACION_Y_CARILLA",
  ENCERADO_ANATOMICO: "CORONA_Y_PUENTE",
  ENCERADO_REDUCIDO: "CORONA_Y_PUENTE",
  ENCERADO_DE_PONTICO: "CORONA_Y_PUENTE",
  ADITAMENTO: "SOBRE_IMPLANTE",
  PILAR_DE_BARRA: "SOBRE_IMPLANTE",
  SEGMENTO_DE_BARRA: "SOBRE_IMPLANTE",
  SUBESTRUCTURA_CON_ALIVIO: "SOBRE_IMPLANTE",
  TELESCOPICA_PRIMARIA: "CORONA_Y_PUENTE",
  TELESCOPICA_SECUNDARIA: "CORONA_Y_PUENTE",
  PROTESIS_TOTAL: "GUARDA_OCLUSAL",
  PROTESIS_PARCIAL: "GUARDA_OCLUSAL",
  GUARDA_OCLUSAL: "GUARDA_OCLUSAL",
  MODELO: "MODELO_3D",
};

/**
 * De mayor a menor exigencia de kit. Un caso con coronas y un aditamento sale
 * como "sobre implante" porque su caja lleva tornillo, desarmador y analogo: si
 * se resolviera al reves, la pieza llegaria a la clinica sin con que ponerla.
 */
const INDICACIONES_POR_EXIGENCIA: Indicacion[] = [
  "SOBRE_IMPLANTE",
  "CORONA_Y_PUENTE",
  "INCRUSTACION_Y_CARILLA",
  "PROVISIONAL",
  "GUARDA_OCLUSAL",
  "MODELO_3D",
];

/** Que indicacion resume lo que el doctor capturo. */
export function indicacionDeLasUnidades(
  unidades: { rol: RolDeUnidad }[],
): Indicacion {
  const presentes = new Set(
    unidades.map((u) => INDICACION_DE_CADA_ROL[u.rol]).filter(Boolean),
  );
  return (
    INDICACIONES_POR_EXIGENCIA.find((i) => presentes.has(i)) ??
    "CORONA_Y_PUENTE"
  );
}

/** Los que cuelgan entre dos pilares. */
const PONTICOS: RolDeUnidad[] = [
  "PONTICO_ANATOMICO",
  "PONTICO_REDUCIDO",
  "PONTICO_PRENSADO",
  "PONTICO_CASCARON",
  "ENCERADO_DE_PONTICO",
  "SEGMENTO_DE_BARRA",
  "SUBESTRUCTURA_CON_ALIVIO",
];
