import "server-only";
import { extensionDe, guardarArchivo, leerArchivo } from "@/lib/almacen";
import { dibujarLaPieza } from "@/lib/vista-malla";

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

/** Arriba de esto sí se reduce. 450k triángulos conserva arcadas completas intactas. */
const TRIANGULOS_OBJETIVO = 450_000;

const FIRMA = 0x4d4c4c41; // "MLLA"
const VERSION = 1;

export function rutaDeLaMalla(archivoId: string, casoId: string) {
  return `${casoId}/${archivoId}.v2.malla`;
}

export function esExtension3DVisualizable(extension: string): boolean {
  return ["stl", "ply", "obj"].includes(extension.toLowerCase());
}

export type Malla = {
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

type TipoEscalarPly =
  | "int8"
  | "uint8"
  | "int16"
  | "uint16"
  | "int32"
  | "uint32"
  | "float32"
  | "float64";

type PropiedadPly =
  | { clase: "escalar"; nombre: string; tipo: TipoEscalarPly; bytes: number }
  | {
      clase: "lista";
      nombre: string;
      tipoConteo: TipoEscalarPly;
      bytesConteo: number;
      tipoItem: TipoEscalarPly;
      bytesItem: number;
    };

function normalizarTipoPly(crudo: string): {
  tipo: TipoEscalarPly;
  bytes: number;
} {
  switch (crudo.toLowerCase()) {
    case "char":
    case "int8":
      return { tipo: "int8", bytes: 1 };
    case "uchar":
    case "uint8":
      return { tipo: "uint8", bytes: 1 };
    case "short":
    case "int16":
      return { tipo: "int16", bytes: 2 };
    case "ushort":
    case "uint16":
      return { tipo: "uint16", bytes: 2 };
    case "int":
    case "int32":
      return { tipo: "int32", bytes: 4 };
    case "uint":
    case "uint32":
      return { tipo: "uint32", bytes: 4 };
    case "double":
    case "float64":
      return { tipo: "float64", bytes: 8 };
    case "float":
    case "float32":
    default:
      return { tipo: "float32", bytes: 4 };
  }
}

function leerEscalarBinarioPly(
  datos: Buffer,
  offset: number,
  tipo: TipoEscalarPly,
  littleEndian: boolean,
): number {
  switch (tipo) {
    case "int8":
      return datos.readInt8(offset);
    case "uint8":
      return datos.readUInt8(offset);
    case "int16":
      return littleEndian
        ? datos.readInt16LE(offset)
        : datos.readInt16BE(offset);
    case "uint16":
      return littleEndian
        ? datos.readUInt16LE(offset)
        : datos.readUInt16BE(offset);
    case "int32":
      return littleEndian
        ? datos.readInt32LE(offset)
        : datos.readInt32BE(offset);
    case "uint32":
      return littleEndian
        ? datos.readUInt32LE(offset)
        : datos.readUInt32BE(offset);
    case "float64":
      return littleEndian
        ? datos.readDoubleLE(offset)
        : datos.readDoubleBE(offset);
    case "float32":
      return littleEndian
        ? datos.readFloatLE(offset)
        : datos.readFloatBE(offset);
  }
}

function leerPly(datos: Buffer): Float32Array {
  const marcadorCrLf = datos.indexOf("end_header\r\n");
  const marcadorLf = datos.indexOf("end_header\n");
  let inicioCuerpo = -1;
  let finEncabezado = -1;

  if (marcadorCrLf !== -1 && (marcadorLf === -1 || marcadorCrLf < marcadorLf)) {
    finEncabezado = marcadorCrLf;
    inicioCuerpo = marcadorCrLf + 12;
  } else if (marcadorLf !== -1) {
    finEncabezado = marcadorLf;
    inicioCuerpo = marcadorLf + 11;
  } else {
    throw new Error("El archivo PLY no tiene un encabezado válido.");
  }

  const textoEncabezado = datos.subarray(0, finEncabezado).toString("ascii");
  const lineas = textoEncabezado
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("comment"));

  let formato: "ascii" | "binary_little_endian" | "binary_big_endian" = "ascii";
  const elementos: {
    nombre: string;
    cantidad: number;
    propiedades: PropiedadPly[];
  }[] = [];

  for (const linea of lineas) {
    const partes = linea.split(/\s+/);
    if (partes[0] === "format" && partes[1]) {
      if (partes[1] === "binary_little_endian") {
        formato = "binary_little_endian";
      } else if (partes[1] === "binary_big_endian") {
        formato = "binary_big_endian";
      } else {
        formato = "ascii";
      }
    } else if (partes[0] === "element" && partes[1] && partes[2]) {
      elementos.push({
        nombre: partes[1],
        cantidad: Number(partes[2]) || 0,
        propiedades: [],
      });
    } else if (partes[0] === "property" && elementos.length > 0) {
      const actual = elementos[elementos.length - 1];
      if (partes[1] === "list" && partes[2] && partes[3] && partes[4]) {
        const c = normalizarTipoPly(partes[2]);
        const it = normalizarTipoPly(partes[3]);
        actual.propiedades.push({
          clase: "lista",
          nombre: partes[4],
          tipoConteo: c.tipo,
          bytesConteo: c.bytes,
          tipoItem: it.tipo,
          bytesItem: it.bytes,
        });
      } else if (partes[1] && partes[2]) {
        const esc = normalizarTipoPly(partes[1]);
        actual.propiedades.push({
          clase: "escalar",
          nombre: partes[2],
          tipo: esc.tipo,
          bytes: esc.bytes,
        });
      }
    }
  }

  if (formato === "ascii") {
    const cuerpoTexto = datos.subarray(inicioCuerpo).toString("utf8");
    const lineasCuerpo = cuerpoTexto
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    let cursorLinea = 0;
    let vertices = new Float32Array(0);
    const sopa: number[] = [];

    for (const el of elementos) {
      if (el.nombre === "vertex") {
        vertices = new Float32Array(el.cantidad * 3);
        const idxX = el.propiedades.findIndex((p) => p.nombre === "x");
        const idxY = el.propiedades.findIndex((p) => p.nombre === "y");
        const idxZ = el.propiedades.findIndex((p) => p.nombre === "z");
        for (let i = 0; i < el.cantidad && cursorLinea < lineasCuerpo.length; i++) {
          const cols = lineasCuerpo[cursorLinea++].split(/\s+/);
          vertices[i * 3] = Number(cols[idxX >= 0 ? idxX : 0]) || 0;
          vertices[i * 3 + 1] = Number(cols[idxY >= 0 ? idxY : 1]) || 0;
          vertices[i * 3 + 2] = Number(cols[idxZ >= 0 ? idxZ : 2]) || 0;
        }
      } else if (el.nombre === "face") {
        for (let i = 0; i < el.cantidad && cursorLinea < lineasCuerpo.length; i++) {
          const cols = lineasCuerpo[cursorLinea++].split(/\s+/).map(Number);
          const n = cols[0] || 0;
          if (n >= 3) {
            const i0 = cols[1];
            for (let k = 1; k < n - 1; k++) {
              const i1 = cols[1 + k];
              const i2 = cols[2 + k];
              sopa.push(
                vertices[i0 * 3],
                vertices[i0 * 3 + 1],
                vertices[i0 * 3 + 2],
                vertices[i1 * 3],
                vertices[i1 * 3 + 1],
                vertices[i1 * 3 + 2],
                vertices[i2 * 3],
                vertices[i2 * 3 + 1],
                vertices[i2 * 3 + 2],
              );
            }
          }
        }
      } else {
        cursorLinea += el.cantidad;
      }
    }

    return Float32Array.from(sopa);
  }

  // Binario (little_endian o big_endian)
  const littleEndian = formato === "binary_little_endian";
  let offset = inicioCuerpo;
  let vertices = new Float32Array(0);
  const sopa: number[] = [];

  for (const el of elementos) {
    if (el.nombre === "vertex") {
      vertices = new Float32Array(el.cantidad * 3);
      const esFijo = el.propiedades.every((p) => p.clase === "escalar");
      if (esFijo) {
        let paso = 0;
        let offX = 0;
        let tipoX: TipoEscalarPly = "float32";
        let offY = 4;
        let tipoY: TipoEscalarPly = "float32";
        let offZ = 8;
        let tipoZ: TipoEscalarPly = "float32";

        for (const p of el.propiedades) {
          if (p.clase === "escalar") {
            if (p.nombre === "x") {
              offX = paso;
              tipoX = p.tipo;
            } else if (p.nombre === "y") {
              offY = paso;
              tipoY = p.tipo;
            } else if (p.nombre === "z") {
              offZ = paso;
              tipoZ = p.tipo;
            }
            paso += p.bytes;
          }
        }

        for (let i = 0; i < el.cantidad; i++) {
          if (offset + paso > datos.length) break;
          vertices[i * 3] = leerEscalarBinarioPly(
            datos,
            offset + offX,
            tipoX,
            littleEndian,
          );
          vertices[i * 3 + 1] = leerEscalarBinarioPly(
            datos,
            offset + offY,
            tipoY,
            littleEndian,
          );
          vertices[i * 3 + 2] = leerEscalarBinarioPly(
            datos,
            offset + offZ,
            tipoZ,
            littleEndian,
          );
          offset += paso;
        }
      }
    } else if (el.nombre === "face") {
      const totalVertices = vertices.length / 3;
      for (let i = 0; i < el.cantidad; i++) {
        if (offset >= datos.length) break;
        for (const p of el.propiedades) {
          if (p.clase === "escalar") {
            offset += p.bytes;
          } else {
            if (offset + p.bytesConteo > datos.length) break;
            const n = leerEscalarBinarioPly(
              datos,
              offset,
              p.tipoConteo,
              littleEndian,
            );
            offset += p.bytesConteo;
            if (offset + n * p.bytesItem > datos.length) break;

            const esIndices =
              p.nombre === "vertex_indices" || p.nombre === "vertex_index";
            if (esIndices && n >= 3) {
              const i0 = leerEscalarBinarioPly(
                datos,
                offset,
                p.tipoItem,
                littleEndian,
              );
              for (let k = 1; k < n - 1; k++) {
                const i1 = leerEscalarBinarioPly(
                  datos,
                  offset + k * p.bytesItem,
                  p.tipoItem,
                  littleEndian,
                );
                const i2 = leerEscalarBinarioPly(
                  datos,
                  offset + (k + 1) * p.bytesItem,
                  p.tipoItem,
                  littleEndian,
                );
                if (
                  i0 >= 0 &&
                  i0 < totalVertices &&
                  i1 >= 0 &&
                  i1 < totalVertices &&
                  i2 >= 0 &&
                  i2 < totalVertices
                ) {
                  sopa.push(
                    vertices[i0 * 3],
                    vertices[i0 * 3 + 1],
                    vertices[i0 * 3 + 2],
                    vertices[i1 * 3],
                    vertices[i1 * 3 + 1],
                    vertices[i1 * 3 + 2],
                    vertices[i2 * 3],
                    vertices[i2 * 3 + 1],
                    vertices[i2 * 3 + 2],
                  );
                }
              }
            }
            offset += n * p.bytesItem;
          }
        }
      }
    } else {
      for (let i = 0; i < el.cantidad; i++) {
        for (const p of el.propiedades) {
          if (p.clase === "escalar") {
            offset += p.bytes;
          } else {
            if (offset + p.bytesConteo > datos.length) break;
            const n = leerEscalarBinarioPly(
              datos,
              offset,
              p.tipoConteo,
              littleEndian,
            );
            offset += p.bytesConteo + n * p.bytesItem;
          }
        }
      }
    }
  }

  return Float32Array.from(sopa);
}

function leerObj(datos: Buffer): Float32Array {
  const texto = datos.toString("utf8");
  const lineas = texto.split(/\r?\n/);
  const vertices: number[] = [];
  const sopa: number[] = [];

  for (const cruda of lineas) {
    const linea = cruda.trim();
    if (linea.startsWith("v ")) {
      const partes = linea.split(/\s+/);
      vertices.push(
        Number(partes[1]) || 0,
        Number(partes[2]) || 0,
        Number(partes[3]) || 0,
      );
    } else if (linea.startsWith("f ")) {
      const partes = linea.split(/\s+/).slice(1);
      const totalV = vertices.length / 3;
      const indices: number[] = [];
      for (const token of partes) {
        const crudo = Number(token.split("/")[0]);
        if (!Number.isFinite(crudo) || crudo === 0) continue;
        const idx = crudo > 0 ? crudo - 1 : totalV + crudo;
        if (idx >= 0 && idx < totalV) indices.push(idx);
      }
      if (indices.length >= 3) {
        const i0 = indices[0];
        for (let k = 1; k < indices.length - 1; k++) {
          const i1 = indices[k];
          const i2 = indices[k + 1];
          sopa.push(
            vertices[i0 * 3],
            vertices[i0 * 3 + 1],
            vertices[i0 * 3 + 2],
            vertices[i1 * 3],
            vertices[i1 * 3 + 1],
            vertices[i1 * 3 + 2],
            vertices[i2 * 3],
            vertices[i2 * 3 + 1],
            vertices[i2 * 3 + 2],
          );
        }
      }
    }
  }

  return Float32Array.from(sopa);
}

function leerGeometria3D(datos: Buffer, rutaDelOriginal: string): Float32Array {
  const ext = extensionDe(rutaDelOriginal);
  if (ext === "ply") return leerPly(datos);
  if (ext === "obj") return leerObj(datos);
  return leerStl(datos);
}

// -------------------------------------------------------------- unir y bajar

/**
 * Une vértices repetidos. Cuando `rejilla` es `null`, no hay pérdida alguna.
 * Cuando `rejilla` tiene valor, agrupa vértices cercanos calculando el
 * centroide exacto (promedio de coordenadas originales) de cada celda en lugar
 * de truncar a la esquina de la rejilla, evitando el efecto escalonado/pixelado.
 */
function unirVertices(sopa: Float32Array, rejilla: number | null): Malla {
  const conocidos = new Map<string, number>();
  const sumaPosiciones: number[] = [];
  const conteos: number[] = [];
  const indices: number[] = [];

  const triangulos = Math.floor(sopa.length / 9);

  for (let t = 0; t < triangulos; t++) {
    const esquinas: number[] = [];

    for (let v = 0; v < 3; v++) {
      const base = t * 9 + v * 3;
      const x = sopa[base];
      const y = sopa[base + 1];
      const z = sopa[base + 2];

      const clave =
        rejilla !== null
          ? `${Math.round(x / rejilla)},${Math.round(y / rejilla)},${Math.round(z / rejilla)}`
          : `${x},${y},${z}`;

      let indice = conocidos.get(clave);
      if (indice === undefined) {
        indice = conteos.length;
        conocidos.set(clave, indice);
        sumaPosiciones.push(x, y, z);
        conteos.push(1);
      } else if (rejilla !== null) {
        const idx3 = indice * 3;
        sumaPosiciones[idx3] += x;
        sumaPosiciones[idx3 + 1] += y;
        sumaPosiciones[idx3 + 2] += z;
        conteos[indice] += 1;
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

  const posiciones = new Float32Array(sumaPosiciones.length);
  for (let i = 0; i < conteos.length; i++) {
    const c = conteos[i];
    const idx3 = i * 3;
    posiciones[idx3] = sumaPosiciones[idx3] / c;
    posiciones[idx3 + 1] = sumaPosiciones[idx3 + 1] / c;
    posiciones[idx3 + 2] = sumaPosiciones[idx3 + 2] / c;
  }

  return {
    posiciones,
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

/**
 * Al revés de `empaquetar`: recupera la malla de su binario.
 *
 * El navegador ya sabía leerla —`malla-cliente.ts`—, pero el servidor también
 * la necesita para dibujar el retrato de la pieza sin volver a tocar el STL
 * original, que pesa cien veces más y a veces ya ni existe.
 */
export function desempaquetar(datos: Buffer): Malla {
  if (datos.length < 40 || datos.readUInt32LE(0) !== FIRMA) {
    throw new Error("Esa vista del diseño no es una malla de Mileo.");
  }
  if (datos.readUInt32LE(4) !== VERSION) {
    throw new Error("Esa vista del diseño es de otra versión.");
  }

  const vertices = datos.readUInt32LE(8);
  const cuantosIndices = datos.readUInt32LE(12);
  const min = [
    datos.readFloatLE(16),
    datos.readFloatLE(20),
    datos.readFloatLE(24),
  ];
  const tamano = [
    datos.readFloatLE(28),
    datos.readFloatLE(32),
    datos.readFloatLE(36),
  ];

  const posiciones = new Float32Array(vertices * 3);
  for (let i = 0; i < posiciones.length; i++) {
    const eje = i % 3;
    posiciones[i] = min[eje] + (datos.readUInt16LE(40 + i * 2) / 65535) * tamano[eje];
  }

  const bytesPosiciones = vertices * 3 * 2;
  const relleno = bytesPosiciones % 4 === 0 ? 0 : 2;
  let desde = 40 + bytesPosiciones + relleno;
  const indices = new Uint32Array(cuantosIndices);
  for (let i = 0; i < cuantosIndices; i++) {
    indices[i] = datos.readUInt32LE(desde);
    desde += 4;
  }

  return { posiciones, indices };
}

/**
 * Dónde vive el retrato de una pieza, al lado de su malla.
 *
 * Hay dos tamaños. El grande es el de la tarjeta del inicio; el chico, el de
 * la miniatura de 40 px que lleva cada caso en la lista. Servir el grande para
 * un cuadrito de 40 px son doscientos kilobytes de más en un inicio con doce
 * casos, y esto se abre con datos móviles entre paciente y paciente (§5.5).
 */
export function rutaDelRetrato(
  archivoId: string,
  casoId: string,
  tamano: TamanoDelRetrato = "grande",
) {
  const cola = tamano === "chico" ? ".chico" : "";
  return `${casoId}/${archivoId}.v2.vista${cola}.png`;
}

export type TamanoDelRetrato = "grande" | "chico";

/** Los lados de cada uno, en pixeles. */
export const LADO_DEL_RETRATO: Record<TamanoDelRetrato, number> = {
  grande: 320,
  chico: 96,
};

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
  const datos = await leerArchivo(rutaDelOriginal);
  const sopa = leerGeometria3D(datos, rutaDelOriginal);

  if (sopa.length === 0) {
    throw new Error("Ese archivo no trae geometría que pueda mostrar.");
  }

  let malla = unirVertices(sopa, null);
  let reducida = false;

  const triangulos = malla.indices.length / 3;
  if (triangulos > TRIANGULOS_OBJETIVO) {
    // Rejilla fina proporcional a la caja con promedio de centroides.
    const { min, max } = cajaDe(malla.posiciones);
    const diagonal = Math.hypot(
      max[0] - min[0],
      max[1] - min[1],
      max[2] - min[2],
    );
    const factor = Math.sqrt(triangulos / TRIANGULOS_OBJETIVO);
    malla = unirVertices(sopa, (diagonal / 1024) * factor);
    reducida = true;
  }

  const empaquetada = empaquetar(malla);
  const rutaRelativa = rutaDeLaMalla(archivoId, casoId);
  await guardarArchivo(rutaRelativa, empaquetada, "application/octet-stream");

  // Los dos retratos salen de una vez: es la misma pieza que el doctor va a
  // ver en cada tarjeta, y dibujarlos aquí ahorra hacerlo la primera vez que
  // alguien abre su inicio.
  for (const tamano of ["grande", "chico"] as const) {
    const retrato = rutaDelRetrato(archivoId, casoId, tamano);
    await guardarArchivo(
      retrato,
      dibujarLaPieza(malla, LADO_DEL_RETRATO[tamano]),
      "image/png",
    );
  }

  return {
    rutaRelativa,
    triangulos: malla.indices.length / 3,
    vertices: malla.posiciones.length / 3,
    bytes: empaquetada.byteLength,
    reducida,
  };
}
