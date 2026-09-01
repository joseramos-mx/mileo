# -*- coding: utf-8 -*-
"""Escribe src/lib/trabajos.ts con la paleta verificada.

    python scripts/generar-catalogo.py

Se corre a mano cuando se agrega un tipo de trabajo. Falla si algun color no
alcanza 4.5:1, para que no entre a la interfaz.
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

CORONA = ["ZIRCONIO_MONOLITICO", "ZIRCONIO_ESTRATIFICADO", "DISILICATO_DE_LITIO", "METAL_PORCELANA"]
SUBESTR = ["ZIRCONIO_MONOLITICO", "CROMO_COBALTO", "METAL_PORCELANA", "TITANIO"]
PRENSA = ["DISILICATO_DE_LITIO", "ZIRCONIO_ESTRATIFICADO"]
TEMP = ["PMMA", "RESINA_IMPRESION"]
CERA = ["CERA_CALCINABLE", "PMMA"]
METAL = ["TITANIO", "CROMO_COBALTO"]

CATALOGO = [
 ("Coronas y cofias", [
  ("CORONA_ANATOMICA", "Corona anatómica", "La corona completa, con su forma y su anatomía.", "#7b3ff2", CORONA, True, "CORONA"),
  ("COFIA", "Cofia", "La estructura interna. Encima va la porcelana.", "#0f7b6c", SUBESTR, True, "CORONA"),
  ("CORONA_PRENSADA", "Corona prensada", "Corona hecha por inyección, no fresada.", "#7cb342", PRENSA, True, "CORONA"),
  ("CORONA_CASCARON", "Corona cascarón (provisional)", "Provisional delgada, para que el paciente salga con algo puesto.", "#6a1fd0", TEMP, True, "CORONA"),
  ("COFIA_CON_ALIVIO", "Cofia con alivio", "Cofia con espacio reservado para el recubrimiento.", "#2b833c", SUBESTR, True, "CORONA"),
  ("MOCKUP", "Mockup", "Una prueba en boca antes de fabricar en definitivo.", "#c74767", TEMP, True, "CORONA"),
 ]),
 ("Pónticos", [
  ("PONTICO_ANATOMICO", "Póntico anatómico", "Reemplaza el diente ausente. Cuelga de los pilares.", "#8e1a3a", CORONA, True, "PONTICO"),
  ("PONTICO_REDUCIDO", "Póntico reducido", "Póntico rebajado, para recubrirlo con porcelana.", "#c2185b", SUBESTR, True, "PONTICO"),
  ("PONTICO_PRENSADO", "Póntico prensado", "Póntico hecho por inyección.", "#3d8fd1", PRENSA, True, "PONTICO"),
  ("PONTICO_CASCARON", "Póntico cascarón (provisional)", "Póntico provisional, mientras se fabrica el definitivo.", "#a3216b", TEMP, True, "PONTICO"),
 ]),
 ("Incrustaciones y carillas", [
  ("INCRUSTACION", "Incrustación inlay u onlay", "Rellena la parte del diente que falta.", "#2e7d32", PRENSA, True, "PARCIAL"),
  ("INCRUSTACION_CON_ALIVIO", "Incrustación con alivio", "Incrustación con espacio para el recubrimiento.", "#1565c0", PRENSA, True, "PARCIAL"),
  ("CARILLA", "Carilla", "Sólo la cara visible del diente.", "#00796b", PRENSA, True, "PARCIAL"),
 ]),
 ("Copiado digital", [
  ("ENCERADO_ANATOMICO", "Encerado anatómico", "El encerado completo, para copiarlo o colarlo.", "#00a878", CERA, False, "CORONA"),
  ("ENCERADO_REDUCIDO", "Encerado reducido", "Encerado rebajado, para recubrirlo después.", "#6d4c41", CERA, False, "CORONA"),
  ("ENCERADO_DE_PONTICO", "Encerado de póntico", "El encerado del póntico de un puente.", "#5e35b1", CERA, False, "PONTICO"),
 ]),
 ("Removibles y aparatos", [
  ("PROTESIS_TOTAL", "Prótesis total", "La dentadura completa de una arcada.", "#0097a7", TEMP, True, "APARATO"),
  ("PROTESIS_PARCIAL", "Prótesis parcial", "Repone varios dientes y se apoya en los que quedan.", "#9a673c", TEMP, True, "APARATO"),
  ("GUARDA_OCLUSAL", "Guarda oclusal", "Para el bruxismo. No va sobre un diente en particular.", "#37474f", TEMP, False, "APARATO"),
  ("TELESCOPICA_PRIMARIA", "Corona telescópica primaria", "La que va cementada sobre el diente.", "#a8536b", SUBESTR, True, "CORONA"),
  ("TELESCOPICA_SECUNDARIA", "Corona telescópica secundaria", "La que embona sobre la primaria y sostiene la prótesis.", "#795548", SUBESTR, True, "CORONA"),
  ("ADITAMENTO", "Aditamento", "La pieza que une el implante con la corona.", "#00494d", METAL, False, "APARATO"),
 ]),
 ("Barras", [
  ("PILAR_DE_BARRA", "Pilar de barra", "El apoyo de la barra sobre el implante.", "#5a4a1f", METAL, False, "BARRA"),
  ("SEGMENTO_DE_BARRA", "Segmento de barra", "El tramo de barra entre dos pilares.", "#5f4b9e", METAL, False, "BARRA"),
  ("SUBESTRUCTURA_CON_ALIVIO", "Subestructura con alivio", "Estructura con espacio reservado para el recubrimiento.", "#7d7455", METAL, False, "BARRA"),
 ]),
 ("Modelos", [
  ("MODELO", "Modelo", "El modelo impreso de la arcada.", "#455a64", ["RESINA_IMPRESION"], False, "APARATO"),
 ]),
 ("Dentición restante", [
  ("ANTAGONISTA", "Antagonista", "No se fabrica: se escanea para revisar la mordida.", "#c44e00", [], False, "MARCA"),
  ("DIENTE_VECINO", "Diente vecino", "No se fabrica: se escanea para revisar el contacto.", "#8a6d1f", [], False, "MARCA"),
  ("OMITIR_EN_PUENTE", "Omitir en el puente", "El puente pasa de largo por aquí, sin pieza.", "#c62828", [], False, "MARCA"),
 ]),
]

filas, errores = [], []
for categoria, tipos in CATALOGO:
    for clave, nombre, que, color, materiales, vita, familia in tipos:
        texto = BLANCO if razon(BLANCO, color) >= 4.5 else TINTA
        r = razon(texto, color)
        suave = tenue(color)
        rn = razon(TINTA, suave)
        if r < 4.5 or rn < 4.5:
            errores.append("%s: pastilla %.2f, numero %.2f" % (clave, r, rn))
        filas.append(dict(clave=clave, nombre=nombre, que=que, categoria=categoria,
                          color=color, suave=suave, texto=texto,
                          materiales=materiales, vita=vita, familia=familia))

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
    '    familia: "%s",\n'
    '    color: "%s",\n'
    '    colorTenue: "%s",\n'
    '    colorDelTexto: "%s",\n'
    '    materiales: %s,\n'
    '    llevaColorVita: %s,\n'
    '  },'
    % (f["clave"], f["nombre"], f["que"], f["categoria"], f["familia"],
       f["color"], f["suave"], f["texto"], lista(f["materiales"]),
       "true" if f["vita"] else "false")
    for f in filas
)

categorias = "\n".join(
    '  { nombre: "%s", tipos: %s },' % (categoria, lista(t[0] for t in tipos))
    for categoria, tipos in CATALOGO
)

CABECERA = '''import type { Material, RolDeUnidad } from "@/generated/prisma/enums";

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
'''

PIE = '''};

/** Las categorías, en el orden en que se enseñan. */
export const CATEGORIAS: { nombre: string; tipos: RolDeUnidad[] }[] = [
%s
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
''' % categorias

io.open("src/lib/trabajos.ts", "w", encoding="utf-8").write(CABECERA + cuerpo + "\n" + PIE)
print("%d tipos en %d categorias. Contraste: todos pasan." % (len(filas), len(CATALOGO)))
print(" ".join(f["clave"] for f in filas))
