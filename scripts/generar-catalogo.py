# -*- coding: utf-8 -*-
"""Escribe src/lib/trabajos.ts: el catalogo de trabajos del laboratorio.

    python scripts/generar-catalogo.py

Aqui vive la tabla completa —alcance, campos, materiales y color de cada tipo—
y de aqui sale el modulo que usan la pantalla y el servidor. Se corre a mano
cuando se agrega o se cambia un tipo.

Falla y no escribe nada si algun color no llega a 4.5:1 con su texto, para que
un color bonito que no se lee no entre a la interfaz (SKILL.md §7).
"""
import io


def lin(c):
    c = c / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def lum(h):
    h = h.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def razon(a, b):
    la, lb = lum(a), lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def tenue(h, blanco=0.75):
    hh = h.lstrip("#")
    r, g, b = (int(hh[i:i + 2], 16) for i in (0, 2, 4))
    m = lambda c: round(c + (255 - c) * blanco)
    return "#%02x%02x%02x" % (m(r), m(g), m(b))


BLANCO, TINTA = "#ffffff", "#1d2126"

# --------------------------------------------------------------- materiales
# Grupos que se repiten. Salen de la tabla de material -> metodo del catalogo.
CORONA_COMPLETA = [
    "ZIRCONIO_MONOLITICO", "ZIRCONIO_ESTRATIFICADO", "DISILICATO_DE_LITIO",
    "PMMA", "RESINA_IMPRESION", "METAL_PORCELANA", "TITANIO",
]
SUBESTRUCTURA = [
    "ZIRCONIO_MONOLITICO", "DISILICATO_DE_LITIO", "CROMO_COBALTO", "TITANIO",
]
PRENSADO = ["DISILICATO_DE_LITIO", "CERAMICA_PRENSADA"]
PONTICO_REDUCIDO = ["ZIRCONIO_MONOLITICO", "DISILICATO_DE_LITIO", "CROMO_COBALTO"]
PROVISIONAL = ["PMMA", "RESINA_IMPRESION"]
MOCKUP = ["PMMA", "RESINA_IMPRESION", "CERA_CALCINABLE"]
COPIADO = ["CERA_CALCINABLE", "PMMA", "RESINA_IMPRESION"]
INCRUSTACION = ["DISILICATO_DE_LITIO", "ZIRCONIO_MONOLITICO", "RESINA_IMPRESION"]
INCRUSTACION_ALIVIO = ["DISILICATO_DE_LITIO", "ZIRCONIO_MONOLITICO"]
CARILLA = ["DISILICATO_DE_LITIO", "ZIRCONIO_ULTRAFINO", "RESINA_IMPRESION"]
ADITAMENTO = ["TITANIO", "ZIRCONIO_SOBRE_TITANIO"]
BARRA = ["TITANIO", "CROMO_COBALTO"]
SUBESTRUCTURA_ALIVIO = ["ZIRCONIO_MONOLITICO", "CROMO_COBALTO", "TITANIO"]
TELESCOPICA_PRIMARIA = ["TITANIO", "CROMO_COBALTO", "ZIRCONIO_MONOLITICO"]
TELESCOPICA_SECUNDARIA = ["CROMO_COBALTO", "TITANIO"]
PROTESIS_TOTAL = ["RESINA_TERMOPOLIMERIZABLE", "RESINA_IMPRESION"]
ESQUELETO = ["CROMO_COBALTO", "TITANIO", "RESINA_FLEXIBLE"]
GUARDA = ["PMMA_TRANSPARENTE", "RESINA_IMPRESION", "RESINA_FLEXIBLE"]
MODELO = ["RESINA_IMPRESION"]

# -------------------------------------------------------------- el catalogo
# clave, nombre, que es, color, materiales, alcance, campos extra, lista corta
#
# `campos` son los que van ADEMAS de material, metodo y notas, que se resuelven
# solos: el material siempre que haya materiales, el metodo siempre que haya
# material, y las notas siempre.
CATALOGO = [
 ("Coronas y cofias", [
  ("CORONA_ANATOMICA", "Corona anatómica",
   "La corona completa, con su forma y su anatomía.",
   "#7b3ff2", CORONA_COMPLETA, "DIENTE", ["color"], True),
  ("COFIA", "Cofia",
   "La estructura interna. Se recubre después con cerámica.",
   "#0f7b6c", SUBESTRUCTURA, "DIENTE", [], True),
  ("CORONA_PRENSADA", "Corona prensada",
   "Corona completa fabricada por técnica de prensado.",
   "#7cb342", PRENSADO, "DIENTE", ["color"], False),
  ("CORONA_CASCARON", "Corona cascarón (provisional)",
   "Cascarón hueco, para el provisional del paciente.",
   "#6a1fd0", PROVISIONAL, "DIENTE", ["color"], True),
  ("COFIA_CON_ALIVIO", "Cofia con alivio",
   "Cofia con espacio adicional para el material que va encima.",
   "#2b833c", SUBESTRUCTURA, "DIENTE", ["espesorAlivio"], False),
  ("MOCKUP", "Mockup",
   "Prueba de forma para enseñarle el resultado al paciente antes de tallar.",
   "#c74767", MOCKUP, "DIENTE", [], False),
 ]),
 ("Pónticos", [
  ("PONTICO_ANATOMICO", "Póntico anatómico",
   "El diente que va en el espacio, con su forma completa.",
   "#8e1a3a", CORONA_COMPLETA, "DIENTE", ["color"], True),
  ("PONTICO_REDUCIDO", "Póntico reducido",
   "Póntico con la forma reducida para recubrirlo con cerámica.",
   "#c2185b", PONTICO_REDUCIDO, "DIENTE", [], False),
  ("PONTICO_PRENSADO", "Póntico prensado",
   "Póntico fabricado por técnica de prensado.",
   "#3d8fd1", PRENSADO, "DIENTE", ["color"], False),
  ("PONTICO_CASCARON", "Póntico cascarón (provisional)",
   "Póntico hueco, para el puente provisional.",
   "#a3216b", PROVISIONAL, "DIENTE", ["color"], False),
 ]),
 ("Incrustaciones y carillas", [
  ("INCRUSTACION", "Incrustación inlay u onlay",
   "Restauración parcial que va dentro o sobre la cúspide.",
   "#2e7d32", INCRUSTACION, "DIENTE", ["color"], True),
  ("INCRUSTACION_CON_ALIVIO", "Incrustación con alivio",
   "Incrustación con espacio para el recubrimiento.",
   "#1565c0", INCRUSTACION_ALIVIO, "DIENTE", ["espesorAlivio"], False),
  ("CARILLA", "Carilla",
   "Lámina que cubre sólo la cara visible del diente.",
   "#00796b", CARILLA, "DIENTE", ["color"], True),
 ]),
 ("Copiado digital", [
  ("ENCERADO_ANATOMICO", "Encerado anatómico",
   "Copia la forma completa de un encerado o provisional que ya existe.",
   "#00a878", COPIADO, "DIENTE", [], False),
  ("ENCERADO_REDUCIDO", "Encerado reducido",
   "Copia esa forma, reducida para recubrir con cerámica.",
   "#6d4c41", COPIADO, "DIENTE", [], False),
  ("ENCERADO_DE_PONTICO", "Encerado de póntico",
   "Copia la forma del póntico de un encerado existente.",
   "#5e35b1", COPIADO, "DIENTE", [], False),
 ]),
 ("Sobre implante", [
  ("ADITAMENTO", "Aditamento",
   "Pieza que conecta el implante con la restauración.",
   "#00494d", ADITAMENTO, "DIENTE", ["sistemaImplante", "color"], True),
  ("PILAR_DE_BARRA", "Pilar de barra",
   "El punto donde la barra se atornilla al implante.",
   "#5a4a1f", BARRA, "DIENTE", ["sistemaImplante"], False),
 ]),
 ("Barras y estructuras", [
  ("SEGMENTO_DE_BARRA", "Segmento de barra",
   "El tramo de barra entre dos pilares.",
   "#5f4b9e", BARRA, "TRAMO", [], False),
  ("SUBESTRUCTURA_CON_ALIVIO", "Subestructura con alivio",
   "Estructura con espacio para el material que va encima.",
   "#7d7455", SUBESTRUCTURA_ALIVIO, "TRAMO", ["espesorAlivio"], False),
 ]),
 ("Removibles y aparatos", [
  ("PROTESIS_TOTAL", "Prótesis total",
   "Dentadura completa para una arcada sin dientes.",
   "#0097a7", PROTESIS_TOTAL, "ARCADA", ["colorBase", "colorDientes"], True),
  ("PROTESIS_PARCIAL", "Prótesis parcial",
   "Prótesis removible que se apoya en los dientes que quedan.",
   "#9a673c", ESQUELETO, "ARCADA", ["colorBase", "colorDientes"], True),
  ("GUARDA_OCLUSAL", "Guarda oclusal",
   "Férula para bruxismo o para proteger la oclusión.",
   "#37474f", GUARDA, "ARCADA", ["grosor"], True),
  ("TELESCOPICA_PRIMARIA", "Corona telescópica primaria",
   "La corona interna, fija sobre el diente.",
   "#a8536b", TELESCOPICA_PRIMARIA, "DIENTE", [], False),
  ("TELESCOPICA_SECUNDARIA", "Corona telescópica secundaria",
   "La corona externa, unida a la prótesis removible.",
   "#795548", TELESCOPICA_SECUNDARIA, "DIENTE", [], False),
 ]),
 ("Modelos", [
  ("MODELO", "Modelo",
   "Modelo impreso en 3D del caso.",
   "#455a64", MODELO, "ARCADA", ["troqueles"], True),
 ]),
 ("Dentición restante", [
  ("ANTAGONISTA", "Antagonista",
   "La arcada opuesta. Se usa para ajustar la oclusión.",
   "#c44e00", [], "CONTEXTO", [], True),
  ("DIENTE_VECINO", "Diente vecino",
   "Diente contiguo que se toma como referencia.",
   "#8a6d1f", [], "CONTEXTO", [], True),
  ("OMITIR_EN_PUENTE", "Omitir en el puente",
   "Espacio que el puente cruza sin colocar diente.",
   "#c62828", [], "CONTEXTO", [], True),
 ]),
]

filas, errores = [], []
for categoria, tipos in CATALOGO:
    for clave, nombre, que, color, materiales, alcance, extra, corta in tipos:
        texto = BLANCO if razon(BLANCO, color) >= 4.5 else TINTA
        r = razon(texto, color)
        suave = tenue(color)
        rn = razon(TINTA, suave)
        if r < 4.5 or rn < 4.5:
            errores.append("%s: pastilla %.2f, numero %.2f" % (clave, r, rn))

        campos = list(extra)
        if materiales:
            campos = ["material", "metodo"] + campos
        campos.append("notas")

        filas.append(dict(clave=clave, nombre=nombre, que=que, categoria=categoria,
                          color=color, suave=suave, texto=texto, alcance=alcance,
                          materiales=materiales, campos=campos, corta=corta))

if errores:
    print("CONTRASTE INSUFICIENTE:")
    for e in errores:
        print("  " + e)
    raise SystemExit(1)


def lista(xs):
    return "[" + ", ".join('"%s"' % x for x in xs) + "]"


cuerpo = "\n".join(
    '  %s: {\n'
    '    nombre: "%s",\n'
    '    queEs: "%s",\n'
    '    categoria: "%s",\n'
    '    alcance: "%s",\n'
    '    color: "%s",\n'
    '    colorTenue: "%s",\n'
    '    colorDelTexto: "%s",\n'
    '    materiales: %s,\n'
    '    campos: %s,\n'
    '    enListaCorta: %s,\n'
    '  },'
    % (f["clave"], f["nombre"], f["que"], f["categoria"], f["alcance"],
       f["color"], f["suave"], f["texto"], lista(f["materiales"]),
       lista(f["campos"]), "true" if f["corta"] else "false")
    for f in filas
)

categorias = "\n".join(
    '  { nombre: "%s", tipos: %s },' % (categoria, lista(t[0] for t in tipos))
    for categoria, tipos in CATALOGO
)

CABECERA = '''import type {
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
'''

PIE = '''};

/** Las categorías, en el orden en que se enseñan. */
export const CATEGORIAS: { nombre: string; tipos: RolDeUnidad[] }[] = [
%s
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
''' % categorias

io.open("src/lib/trabajos.ts", "w", encoding="utf-8").write(CABECERA + cuerpo + "\n" + PIE)

por_alcance = {}
for f in filas:
    por_alcance.setdefault(f["alcance"], []).append(f["clave"])
print("%d tipos en %d categorias. Contraste: todos pasan." % (len(filas), len(CATALOGO)))
for alcance, claves in por_alcance.items():
    print("  %-9s %2d: %s" % (alcance, len(claves), " ".join(claves)))
print("  lista corta del doctor: %s" % " ".join(f["clave"] for f in filas if f["corta"]))
