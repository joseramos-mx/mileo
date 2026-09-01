import type { Material, RolDeUnidad } from "@/generated/prisma/enums";

/**
 * El catálogo de trabajos, con la misma estructura que el que ya usan los
 * técnicos en exocad: agrupado por categoría y con un color por tipo.
 *
 * GENERADO por `python scripts/generar-catalogo.py`. Agregar un tipo es
 * agregar un renglón allá, su valor en el enum de Prisma y su migración.
 *
 * Por qué el color vive aquí y no en `globals.css`: son veintinueve, y no son
 * roles de la interfaz —no hay un "color de acción" ni un "color de borde"—
 * sino un dato del catálogo. Meterlos como tokens obligaría a nombrar 58
 * variables y a escribir la clase literal de cada una para que Tailwind las
 * genere. Aquí es una tabla, que es lo que son.
 *
 * Tres colores por tipo, y no uno, porque cada uno tiene su trabajo:
 *   color         el de la pastilla y el contorno del diente
 *   colorTenue    el relleno del diente, para que el número se siga leyendo
 *   colorDelTexto el que va encima de la pastilla
 *
 * Los dos pares están medidos: la pastilla llega a 4.5:1 y el número sobre el
 * relleno también (§7). El guion que genera esto se niega a escribir un color
 * que no alcance, y `npm run prueba:odontograma` lo vuelve a medir en pantalla.
 */

export type FamiliaDeTrabajo =
  /** Va sobre un diente preparado. Sirve de extremo de un puente. */
  | "CORONA"
  /** Cuelga entre dos pilares. Sólo va en medio de un puente. */
  | "PONTICO"
  /** Cubre parte del diente. No entra en un puente. */
  | "PARCIAL"
  /** No va sobre un diente en particular. */
  | "APARATO"
  /** Estructura sobre implantes. */
  | "BARRA"
  /** No se fabrica: es una anotación sobre ese diente. */
  | "MARCA";

export type TipoDeTrabajo = {
  nombre: string;
  /** Qué es, en una línea, para el doctor (§8). */
  queEs: string;
  categoria: string;
  familia: FamiliaDeTrabajo;
  color: string;
  colorTenue: string;
  colorDelTexto: string;
  materiales: Material[];
  llevaColorVita: boolean;
};

export const TRABAJOS: Record<RolDeUnidad, TipoDeTrabajo> = {
  CORONA_ANATOMICA: {
    nombre: "Corona anatómica",
    queEs: "La corona completa, con su forma y su anatomía.",
    categoria: "Coronas y cofias",
    familia: "CORONA",
    color: "#7b3ff2",
    colorTenue: "#decffc",
    colorDelTexto: "#ffffff",
    materiales: ["ZIRCONIO_MONOLITICO", "ZIRCONIO_ESTRATIFICADO", "DISILICATO_DE_LITIO", "METAL_PORCELANA"],
    llevaColorVita: true,
  },
  COFIA: {
    nombre: "Cofia",
    queEs: "La estructura interna. Encima va la porcelana.",
    categoria: "Coronas y cofias",
    familia: "CORONA",
    color: "#0f7b6c",
    colorTenue: "#c3deda",
    colorDelTexto: "#ffffff",
    materiales: ["ZIRCONIO_MONOLITICO", "CROMO_COBALTO", "METAL_PORCELANA", "TITANIO"],
    llevaColorVita: true,
  },
  CORONA_PRENSADA: {
    nombre: "Corona prensada",
    queEs: "Corona hecha por inyección, no fresada.",
    categoria: "Coronas y cofias",
    familia: "CORONA",
    color: "#7cb342",
    colorTenue: "#deecd0",
    colorDelTexto: "#1d2126",
    materiales: ["DISILICATO_DE_LITIO", "ZIRCONIO_ESTRATIFICADO"],
    llevaColorVita: true,
  },
  CORONA_CASCARON: {
    nombre: "Corona cascarón (provisional)",
    queEs: "Provisional delgada, para que el paciente salga con algo puesto.",
    categoria: "Coronas y cofias",
    familia: "CORONA",
    color: "#6a1fd0",
    colorTenue: "#dac7f3",
    colorDelTexto: "#ffffff",
    materiales: ["PMMA", "RESINA_IMPRESION"],
    llevaColorVita: true,
  },
  COFIA_CON_ALIVIO: {
    nombre: "Cofia con alivio",
    queEs: "Cofia con espacio reservado para el recubrimiento.",
    categoria: "Coronas y cofias",
    familia: "CORONA",
    color: "#2b833c",
    colorTenue: "#cae0ce",
    colorDelTexto: "#ffffff",
    materiales: ["ZIRCONIO_MONOLITICO", "CROMO_COBALTO", "METAL_PORCELANA", "TITANIO"],
    llevaColorVita: true,
  },
  MOCKUP: {
    nombre: "Mockup",
    queEs: "Una prueba en boca antes de fabricar en definitivo.",
    categoria: "Coronas y cofias",
    familia: "CORONA",
    color: "#c74767",
    colorTenue: "#f1d1d9",
    colorDelTexto: "#ffffff",
    materiales: ["PMMA", "RESINA_IMPRESION"],
    llevaColorVita: true,
  },
  PONTICO_ANATOMICO: {
    nombre: "Póntico anatómico",
    queEs: "Reemplaza el diente ausente. Cuelga de los pilares.",
    categoria: "Pónticos",
    familia: "PONTICO",
    color: "#8e1a3a",
    colorTenue: "#e3c6ce",
    colorDelTexto: "#ffffff",
    materiales: ["ZIRCONIO_MONOLITICO", "ZIRCONIO_ESTRATIFICADO", "DISILICATO_DE_LITIO", "METAL_PORCELANA"],
    llevaColorVita: true,
  },
  PONTICO_REDUCIDO: {
    nombre: "Póntico reducido",
    queEs: "Póntico rebajado, para recubrirlo con porcelana.",
    categoria: "Pónticos",
    familia: "PONTICO",
    color: "#c2185b",
    colorTenue: "#f0c5d6",
    colorDelTexto: "#ffffff",
    materiales: ["ZIRCONIO_MONOLITICO", "CROMO_COBALTO", "METAL_PORCELANA", "TITANIO"],
    llevaColorVita: true,
  },
  PONTICO_PRENSADO: {
    nombre: "Póntico prensado",
    queEs: "Póntico hecho por inyección.",
    categoria: "Pónticos",
    familia: "PONTICO",
    color: "#3d8fd1",
    colorTenue: "#cee3f4",
    colorDelTexto: "#1d2126",
    materiales: ["DISILICATO_DE_LITIO", "ZIRCONIO_ESTRATIFICADO"],
    llevaColorVita: true,
  },
  PONTICO_CASCARON: {
    nombre: "Póntico cascarón (provisional)",
    queEs: "Póntico provisional, mientras se fabrica el definitivo.",
    categoria: "Pónticos",
    familia: "PONTICO",
    color: "#a3216b",
    colorTenue: "#e8c8da",
    colorDelTexto: "#ffffff",
    materiales: ["PMMA", "RESINA_IMPRESION"],
    llevaColorVita: true,
  },
  INCRUSTACION: {
    nombre: "Incrustación inlay u onlay",
    queEs: "Rellena la parte del diente que falta.",
    categoria: "Incrustaciones y carillas",
    familia: "PARCIAL",
    color: "#2e7d32",
    colorTenue: "#cbdecc",
    colorDelTexto: "#ffffff",
    materiales: ["DISILICATO_DE_LITIO", "ZIRCONIO_ESTRATIFICADO"],
    llevaColorVita: true,
  },
  INCRUSTACION_CON_ALIVIO: {
    nombre: "Incrustación con alivio",
    queEs: "Incrustación con espacio para el recubrimiento.",
    categoria: "Incrustaciones y carillas",
    familia: "PARCIAL",
    color: "#1565c0",
    colorTenue: "#c4d8ef",
    colorDelTexto: "#ffffff",
    materiales: ["DISILICATO_DE_LITIO", "ZIRCONIO_ESTRATIFICADO"],
    llevaColorVita: true,
  },
  CARILLA: {
    nombre: "Carilla",
    queEs: "Sólo la cara visible del diente.",
    categoria: "Incrustaciones y carillas",
    familia: "PARCIAL",
    color: "#00796b",
    colorTenue: "#bfdeda",
    colorDelTexto: "#ffffff",
    materiales: ["DISILICATO_DE_LITIO", "ZIRCONIO_ESTRATIFICADO"],
    llevaColorVita: true,
  },
  ENCERADO_ANATOMICO: {
    nombre: "Encerado anatómico",
    queEs: "El encerado completo, para copiarlo o colarlo.",
    categoria: "Copiado digital",
    familia: "CORONA",
    color: "#00a878",
    colorTenue: "#bfe9dd",
    colorDelTexto: "#1d2126",
    materiales: ["CERA_CALCINABLE", "PMMA"],
    llevaColorVita: false,
  },
  ENCERADO_REDUCIDO: {
    nombre: "Encerado reducido",
    queEs: "Encerado rebajado, para recubrirlo después.",
    categoria: "Copiado digital",
    familia: "CORONA",
    color: "#6d4c41",
    colorTenue: "#dad2d0",
    colorDelTexto: "#ffffff",
    materiales: ["CERA_CALCINABLE", "PMMA"],
    llevaColorVita: false,
  },
  ENCERADO_DE_PONTICO: {
    nombre: "Encerado de póntico",
    queEs: "El encerado del póntico de un puente.",
    categoria: "Copiado digital",
    familia: "PONTICO",
    color: "#5e35b1",
    colorTenue: "#d7ccec",
    colorDelTexto: "#ffffff",
    materiales: ["CERA_CALCINABLE", "PMMA"],
    llevaColorVita: false,
  },
  PROTESIS_TOTAL: {
    nombre: "Prótesis total",
    queEs: "La dentadura completa de una arcada.",
    categoria: "Removibles y aparatos",
    familia: "APARATO",
    color: "#0097a7",
    colorTenue: "#bfe5e9",
    colorDelTexto: "#1d2126",
    materiales: ["PMMA", "RESINA_IMPRESION"],
    llevaColorVita: true,
  },
  PROTESIS_PARCIAL: {
    nombre: "Prótesis parcial",
    queEs: "Repone varios dientes y se apoya en los que quedan.",
    categoria: "Removibles y aparatos",
    familia: "APARATO",
    color: "#9a673c",
    colorTenue: "#e6d9ce",
    colorDelTexto: "#ffffff",
    materiales: ["PMMA", "RESINA_IMPRESION"],
    llevaColorVita: true,
  },
  GUARDA_OCLUSAL: {
    nombre: "Guarda oclusal",
    queEs: "Para el bruxismo. No va sobre un diente en particular.",
    categoria: "Removibles y aparatos",
    familia: "APARATO",
    color: "#37474f",
    colorTenue: "#cdd1d3",
    colorDelTexto: "#ffffff",
    materiales: ["PMMA", "RESINA_IMPRESION"],
    llevaColorVita: false,
  },
  TELESCOPICA_PRIMARIA: {
    nombre: "Corona telescópica primaria",
    queEs: "La que va cementada sobre el diente.",
    categoria: "Removibles y aparatos",
    familia: "CORONA",
    color: "#a8536b",
    colorTenue: "#e9d4da",
    colorDelTexto: "#ffffff",
    materiales: ["ZIRCONIO_MONOLITICO", "CROMO_COBALTO", "METAL_PORCELANA", "TITANIO"],
    llevaColorVita: true,
  },
  TELESCOPICA_SECUNDARIA: {
    nombre: "Corona telescópica secundaria",
    queEs: "La que embona sobre la primaria y sostiene la prótesis.",
    categoria: "Removibles y aparatos",
    familia: "CORONA",
    color: "#795548",
    colorTenue: "#ded4d1",
    colorDelTexto: "#ffffff",
    materiales: ["ZIRCONIO_MONOLITICO", "CROMO_COBALTO", "METAL_PORCELANA", "TITANIO"],
    llevaColorVita: true,
  },
  ADITAMENTO: {
    nombre: "Aditamento",
    queEs: "La pieza que une el implante con la corona.",
    categoria: "Removibles y aparatos",
    familia: "APARATO",
    color: "#00494d",
    colorTenue: "#bfd2d2",
    colorDelTexto: "#ffffff",
    materiales: ["TITANIO", "CROMO_COBALTO"],
    llevaColorVita: false,
  },
  PILAR_DE_BARRA: {
    nombre: "Pilar de barra",
    queEs: "El apoyo de la barra sobre el implante.",
    categoria: "Barras",
    familia: "BARRA",
    color: "#5a4a1f",
    colorTenue: "#d6d2c7",
    colorDelTexto: "#ffffff",
    materiales: ["TITANIO", "CROMO_COBALTO"],
    llevaColorVita: false,
  },
  SEGMENTO_DE_BARRA: {
    nombre: "Segmento de barra",
    queEs: "El tramo de barra entre dos pilares.",
    categoria: "Barras",
    familia: "BARRA",
    color: "#5f4b9e",
    colorTenue: "#d7d2e7",
    colorDelTexto: "#ffffff",
    materiales: ["TITANIO", "CROMO_COBALTO"],
    llevaColorVita: false,
  },
  SUBESTRUCTURA_CON_ALIVIO: {
    nombre: "Subestructura con alivio",
    queEs: "Estructura con espacio reservado para el recubrimiento.",
    categoria: "Barras",
    familia: "BARRA",
    color: "#7d7455",
    colorTenue: "#dedcd4",
    colorDelTexto: "#ffffff",
    materiales: ["TITANIO", "CROMO_COBALTO"],
    llevaColorVita: false,
  },
  MODELO: {
    nombre: "Modelo",
    queEs: "El modelo impreso de la arcada.",
    categoria: "Modelos",
    familia: "APARATO",
    color: "#455a64",
    colorTenue: "#d0d6d8",
    colorDelTexto: "#ffffff",
    materiales: ["RESINA_IMPRESION"],
    llevaColorVita: false,
  },
  ANTAGONISTA: {
    nombre: "Antagonista",
    queEs: "No se fabrica: se escanea para revisar la mordida.",
    categoria: "Dentición restante",
    familia: "MARCA",
    color: "#c44e00",
    colorTenue: "#f0d3bf",
    colorDelTexto: "#ffffff",
    materiales: [],
    llevaColorVita: false,
  },
  DIENTE_VECINO: {
    nombre: "Diente vecino",
    queEs: "No se fabrica: se escanea para revisar el contacto.",
    categoria: "Dentición restante",
    familia: "MARCA",
    color: "#8a6d1f",
    colorTenue: "#e2dac7",
    colorDelTexto: "#ffffff",
    materiales: [],
    llevaColorVita: false,
  },
  OMITIR_EN_PUENTE: {
    nombre: "Omitir en el puente",
    queEs: "El puente pasa de largo por aquí, sin pieza.",
    categoria: "Dentición restante",
    familia: "MARCA",
    color: "#c62828",
    colorTenue: "#f1c9c9",
    colorDelTexto: "#ffffff",
    materiales: [],
    llevaColorVita: false,
  },
};

/** Las categorías, en el orden en que se enseñan. */
export const CATEGORIAS: { nombre: string; tipos: RolDeUnidad[] }[] = [
  { nombre: "Coronas y cofias", tipos: ["CORONA_ANATOMICA", "COFIA", "CORONA_PRENSADA", "CORONA_CASCARON", "COFIA_CON_ALIVIO", "MOCKUP"] },
  { nombre: "Pónticos", tipos: ["PONTICO_ANATOMICO", "PONTICO_REDUCIDO", "PONTICO_PRENSADO", "PONTICO_CASCARON"] },
  { nombre: "Incrustaciones y carillas", tipos: ["INCRUSTACION", "INCRUSTACION_CON_ALIVIO", "CARILLA"] },
  { nombre: "Copiado digital", tipos: ["ENCERADO_ANATOMICO", "ENCERADO_REDUCIDO", "ENCERADO_DE_PONTICO"] },
  { nombre: "Removibles y aparatos", tipos: ["PROTESIS_TOTAL", "PROTESIS_PARCIAL", "GUARDA_OCLUSAL", "TELESCOPICA_PRIMARIA", "TELESCOPICA_SECUNDARIA", "ADITAMENTO"] },
  { nombre: "Barras", tipos: ["PILAR_DE_BARRA", "SEGMENTO_DE_BARRA", "SUBESTRUCTURA_CON_ALIVIO"] },
  { nombre: "Modelos", tipos: ["MODELO"] },
  { nombre: "Dentición restante", tipos: ["ANTAGONISTA", "DIENTE_VECINO", "OMITIR_EN_PUENTE"] },
];

/** Lo que sí se fabrica. Una marca no es una unidad que el laboratorio haga. */
export function seFabrica(rol: RolDeUnidad) {
  return TRABAJOS[rol].familia !== "MARCA";
}

/** Sirve de extremo de un puente: se apoya en un diente preparado. */
export function puedeSerPilar(rol: RolDeUnidad) {
  return TRABAJOS[rol].familia === "CORONA";
}

/** Va en medio de un puente. */
export function esPontico(rol: RolDeUnidad) {
  return TRABAJOS[rol].familia === "PONTICO";
}
