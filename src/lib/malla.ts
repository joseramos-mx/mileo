import "server-only";
import fsp from "node:fs/promises";
import { rutaAbsolutaDe, prepararCarpeta } from "@/lib/almacen";

/**
 * Malla ligera derivada (SKILL.md §9, O-4).
 *
 * Regla dura: al doctor se le sirve una malla ligera derivada, nunca el archivo
 * original. Este módulo la fabrica a partir del STL del diseño.
 *
 * Qué hace, y por qué:
 *
 * 1. Lee el STL. Un STL repite cada vértice tres veces por triángulo y gasta
 *    50 bytes por triángulo; casi todo eso es redundante.
 * 2. Une los vértices repetidos. Un diseño típico baja de golpe a menos de la
 *    mitad, sin perder un solo detalle de la anatomía.
 * 3. Si aun así trae demasiados triángulos, los reduce agrupando vértices en
 *    una rejilla. Sólo se hace cuando hace falta: el doctor juzga la anatomía
 *    oclusal en esta pantalla y no se le degrada si no es necesario.
 * 4. Cuantiza las posiciones a enteros de 16 bits dentro de la caja del modelo.
 *    A la escala de una corona eso es una milésima de milímetro: invisible.
 *
 * El resultado es un binario propio, chico y directo de leer en el navegador,
 * sin biblioteca de carga de por medio.
 */

/** Arriba de esto sí se reduce. Un diseño de tres unidades no llega. */
const TRIANGULOS_OBJETIVO = 120_000;

const FIRMA = 0x4d4c4c41; // "MLLA"
const VERSION = 1;

export function rutaDeLaMalla(archivoId: string, casoId: string) {
  return `${casoId}/${archivoId}.malla`;
}

type Malla = {
  posiciones: Float32Array;
  indices: Uint32Array;
};

// ------------------------------------------------------------------ lectura

function leerStl(datos: Buffer): Float32Array {
  const esAscii =
    datos.length > 5 &&
    datos.subarray(0, 5).toString("ascii").toLowerCase() === "solid" &&
    // Un STL binario también puede empezar con "solid": se confirma con el
    // tamaño que anuncia su encabezado.
    !tieneTamanoBinario(datos);

  return esAscii ? leerStlDeTexto(datos) : leerStlBinario(datos);
}

function tieneTamanoBinario(datos: Buffer) {
  if (datos.length < 84) return false;
  const triangulos = datos.readUInt32LE(80);
  return datos.length === 84 + triangulos * 50;
}

function leerStlBinario(datos: Buffer): Float32Array {
  if (datos.length < 84) throw new Error("El STL viene incompleto.");
  const triangulos = datos.readUInt32LE(80);
  const salida = new Float32Array(triangulos * 9);

  let origen = 84;
  for (let t = 0; t < triangulos; t++) {
    origen += 12; // la normal se recalcula en el navegador
    for (let v = 0; v < 9; v++) {
      salida[t * 9 + v] = datos.readFloatLE(origen);
      origen += 4;
    }
    origen += 2; // atributo
  }
  return salida;
}

function leerStlDeTexto(datos: Buffer): Float32Array {
  const texto = datos.toString("utf8");
  const numeros: number[] = [];
  const patron = /vertex\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)/g;

  let coincidencia = patron.exec(texto);
  while (coincidencia !== null) {
    numeros.push(
      Number(coincidencia[1]),
      Number(coincidencia[2]),
      Number(coincidencia[3]),
    );
    coincidencia = patron.exec(texto);
  }
  return Float32Array.from(numeros);
}

// -------------------------------------------------------------- unir y bajar

/** Une vértices repetidos. Sin pérdida: la geometría queda idéntica. */
function unirVertices(sopa: Float32Array, rejilla: number | null): Malla {
  const conocidos = new Map<string, number>();
  const posiciones: number[] = [];
  const indices: number[] = [];

  const triangulos = Math.floor(sopa.length / 9);

  for (let t = 0; t < triangulos; t++) {
    const esquinas: number[] = [];

    for (let v = 0; v < 3; v++) {
      const base = t * 9 + v * 3;
      let x = sopa[base];
      let y = sopa[base + 1];
      let z = sopa[base + 2];

      if (rejilla !== null) {
        x = Math.round(x / rejilla) * rejilla;
        y = Math.round(y / rejilla) * rejilla;
        z = Math.round(z / rejilla) * rejilla;
      }

      const clave = `${x},${y},${z}`;
      let indice = conocidos.get(clave);
      if (indice === undefined) {
        indice = posiciones.length / 3;
        conocidos.set(clave, indice);
        posiciones.push(x, y, z);
      }
      esquinas.push(indice);
    }

    // Al agrupar en rejilla, un triángulo puede colapsar en una línea. Se tira.
    if (
      esquinas[0] !== esquinas[1] &&
      esquinas[1] !== esquinas[2] &&
      esquinas[0] !== esquinas[2]
    ) {
      indices.push(esquinas[0], esquinas[1], esquinas[2]);
    }
  }

  return {
    posiciones: Float32Array.from(posiciones),
    indices: Uint32Array.from(indices),
  };
}

function cajaDe(posiciones: Float32Array) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  for (let i = 0; i < posiciones.length; i += 3) {
    for (let eje = 0; eje < 3; eje++) {
      const valor = posiciones[i + eje];
      if (valor < min[eje]) min[eje] = valor;
      if (valor > max[eje]) max[eje] = valor;
    }
  }
  return { min, max };
}

// ---------------------------------------------------------------- escritura

/**
 * Formato .malla
 *
 *   0  uint32  firma "MLLA"
 *   4  uint32  versión
 *   8  uint32  número de vértices
 *  12  uint32  número de índices
 *  16  float32[3]  esquina mínima de la caja
 *  28  float32[3]  tamaño de la caja
 *  40  uint16[3 * vértices]  posiciones cuantizadas
 *   .. uint32[índices]       triángulos
 */
function empaquetar(malla: Malla): Buffer {
  const vertices = malla.posiciones.length / 3;
  const { min, max } = cajaDe(malla.posiciones);
  const tamano = [
    Math.max(max[0] - min[0], 1e-6),
    Math.max(max[1] - min[1], 1e-6),
    Math.max(max[2] - min[2], 1e-6),
  ];

  const bytesPosiciones = vertices * 3 * 2;
  const relleno = bytesPosiciones % 4 === 0 ? 0 : 2;
  const total = 40 + bytesPosiciones + relleno + malla.indices.length * 4;

  const buffer = Buffer.alloc(total);
  buffer.writeUInt32LE(FIRMA, 0);
  buffer.writeUInt32LE(VERSION, 4);
  buffer.writeUInt32LE(vertices, 8);
  buffer.writeUInt32LE(malla.indices.length, 12);
  for (let eje = 0; eje < 3; eje++) {
    buffer.writeFloatLE(min[eje], 16 + eje * 4);
    buffer.writeFloatLE(tamano[eje], 28 + eje * 4);
  }

  let salida = 40;
  for (let i = 0; i < malla.posiciones.length; i++) {
    const eje = i % 3;
    const normalizado = (malla.posiciones[i] - min[eje]) / tamano[eje];
    buffer.writeUInt16LE(
      Math.max(0, Math.min(65535, Math.round(normalizado * 65535))),
      salida,
    );
    salida += 2;
  }
  salida += relleno;

  for (const indice of malla.indices) {
    buffer.writeUInt32LE(indice, salida);
    salida += 4;
  }

  return buffer;
}

// ------------------------------------------------------------------ público

export type ResumenDeMalla = {
  rutaRelativa: string;
  triangulos: number;
  vertices: number;
  bytes: number;
  reducida: boolean;
};

export async function derivarMallaLigera({
  rutaDelOriginal,
  casoId,
  archivoId,
}: {
  rutaDelOriginal: string;
  casoId: string;
  archivoId: string;
}): Promise<ResumenDeMalla> {
  const datos = await fsp.readFile(rutaAbsolutaDe(rutaDelOriginal));
  const sopa = leerStl(datos);

  if (sopa.length === 0) {
    throw new Error("Ese archivo no trae geometría que pueda mostrar.");
  }

  let malla = unirVertices(sopa, null);
  let reducida = false;

  const triangulos = malla.indices.length / 3;
  if (triangulos > TRIANGULOS_OBJETIVO) {
    // Rejilla proporcional a la caja: cuanto más grande el modelo, más gruesa.
    const { min, max } = cajaDe(malla.posiciones);
    const diagonal = Math.hypot(
      max[0] - min[0],
      max[1] - min[1],
      max[2] - min[2],
    );
    const factor = Math.sqrt(triangulos / TRIANGULOS_OBJETIVO);
    malla = unirVertices(sopa, (diagonal / 512) * factor);
    reducida = true;
  }

  const empaquetada = empaquetar(malla);
  const rutaRelativa = rutaDeLaMalla(archivoId, casoId);
  const completa = await prepararCarpeta(rutaRelativa);
  await fsp.writeFile(completa, empaquetada);

  return {
    rutaRelativa,
    triangulos: malla.indices.length / 3,
    vertices: malla.posiciones.length / 3,
    bytes: empaquetada.byteLength,
    reducida,
  };
}
