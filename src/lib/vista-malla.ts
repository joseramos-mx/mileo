import "server-only";
import zlib from "node:zlib";
import type { Malla } from "@/lib/malla";

/**
 * El retrato de una pieza, dibujado en el servidor (SKILL.md O-4, §5.5).
 *
 * El visor 3D es para la pantalla de aprobación, donde el doctor gira el
 * diseño. Pero la vista del diseño hace falta en muchos más lados —el inicio,
 * la lista de casos, cada tarjeta que espera su revisión—, y ahí no se puede
 * abrir un contexto WebGL por tarjeta: el navegador tiene un tope de contextos
 * vivos, los va tirando cuando lo pasa, y una lista de doce casos acaba con
 * cuadros en blanco. Además gasta batería por un dibujo que nadie va a girar.
 *
 * Así que la misma malla ligera se dibuja una vez aquí, sin GPU y sin
 * biblioteca, y sale un PNG que cualquier `<img>` pinta gratis.
 *
 * El encuadre, la luz y el color son los mismos que usa el visor, para que el
 * doctor vea la misma pieza en los dos lados. No es idéntico pixel a pixel
 * —three.js sombrea con un modelo físico y aquí es Lambert— pero es la misma
 * pieza desde el mismo ángulo, que es lo que tiene que reconocer.
 */

/** El color de la pieza, el mismo de `materialDeLaPieza`. */
const PIEZA: [number, number, number] = [0xe9, 0xe6, 0xe0];

/** El fondo, el mismo neutro claro del visor. Aquí no se juzga sobre negro. */
const FONDO: [number, number, number] = [0xff, 0xff, 0xff];

/** Las luces del visor: ambiente, una fuerte y una de relleno. */
const AMBIENTE = 0.75;
const LUCES: { direccion: [number, number, number]; fuerza: number }[] = [
  { direccion: [3, 4, 5], fuerza: 1.5 },
  { direccion: [-4, -2, -3], fuerza: 0.5 },
];

/** La cámara del visor: a 4.2 de distancia, con 35 grados de campo. */
const DISTANCIA = 4.2;
const CAMPO = (35 * Math.PI) / 180;

/**
 * De frente y un poco de lado, como en el visor quieto: se ve la cara oclusal
 * y el perfil al mismo tiempo, que es por donde se reconoce una corona.
 */
const GIRO: [number, number, number] = [-0.5, 0.4, 0];

/** Se dibuja al doble y se reduce: es el antialias del pobre, y basta. */
const DOBLE = 2;

/**
 * La luz se suma en lineal y se devuelve a sRGB al final, como hace three.js.
 *
 * Sumarla directamente sobre los bytes del color parecía funcionar, pero
 * saturaba: la esfera de prueba salía como un disco plano, sin volumen. El
 * reparto entre π es el de la BRDF de Lambert, y es lo que deja el lado
 * iluminado casi blanco y el otro en un gris que todavía se lee.
 */
const ALBEDO = PIEZA.map((c) => aLineal(c / 255));

export function dibujarLaPieza(malla: Malla, tamano = 320): Buffer {
  const lado = tamano * DOBLE;
  const { posiciones, indices } = prepararla(malla);
  const normales = normalesDeLosVertices(posiciones, indices);

  // Proyección a pantalla. `cerca` es 1/distancia: se interpola linealmente en
  // pantalla —eso es lo que hace correcta la perspectiva— y sirve de llave del
  // buffer de profundidad, donde más grande es más cerca.
  const vertices = posiciones.length / 3;
  const x = new Float32Array(vertices);
  const y = new Float32Array(vertices);
  const cerca = new Float32Array(vertices);
  const escala = lado / 2 / Math.tan(CAMPO / 2);

  for (let v = 0; v < vertices; v++) {
    const px = posiciones[v * 3];
    const py = posiciones[v * 3 + 1];
    const pz = posiciones[v * 3 + 2];
    const d = DISTANCIA - pz;
    cerca[v] = d > 0.001 ? 1 / d : 0;
    x[v] = lado / 2 + (px * escala) / (d || 1);
    y[v] = lado / 2 - (py * escala) / (d || 1);
  }

  const lienzo = new Uint8Array(lado * lado * 3);
  for (let i = 0; i < lienzo.length; i += 3) {
    lienzo[i] = FONDO[0];
    lienzo[i + 1] = FONDO[1];
    lienzo[i + 2] = FONDO[2];
  }
  const fondo = new Float32Array(lado * lado);

  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t];
    const b = indices[t + 1];
    const c = indices[t + 2];
    if (cerca[a] === 0 || cerca[b] === 0 || cerca[c] === 0) continue;

    const ax = x[a];
    const ay = y[a];
    const bx = x[b];
    const by = y[b];
    const cx = x[c];
    const cy = y[c];

    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (area === 0) continue;

    const desde = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
    const hasta = Math.min(lado - 1, Math.ceil(Math.max(ax, bx, cx)));
    const arriba = Math.max(0, Math.floor(Math.min(ay, by, cy)));
    const abajo = Math.min(lado - 1, Math.ceil(Math.max(ay, by, cy)));
    if (desde > hasta || arriba > abajo) continue;

    for (let py = arriba; py <= abajo; py++) {
      for (let px = desde; px <= hasta; px++) {
        const cx0 = px + 0.5;
        const cy0 = py + 0.5;

        // Coordenadas baricéntricas, con el signo del área para no depender de
        // cómo venga enrollado el triángulo en el STL.
        const w0 = ((bx - cx0) * (cy - cy0) - (by - cy0) * (cx - cx0)) / area;
        const w1 = ((cx - cx0) * (ay - cy0) - (cy - cy0) * (ax - cx0)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;

        const z = w0 * cerca[a] + w1 * cerca[b] + w2 * cerca[c];
        const donde = py * lado + px;
        if (z <= fondo[donde]) continue;
        fondo[donde] = z;

        let nx =
          w0 * normales[a * 3] + w1 * normales[b * 3] + w2 * normales[c * 3];
        let ny =
          w0 * normales[a * 3 + 1] +
          w1 * normales[b * 3 + 1] +
          w2 * normales[c * 3 + 1];
        let nz =
          w0 * normales[a * 3 + 2] +
          w1 * normales[b * 3 + 2] +
          w2 * normales[c * 3 + 2];
        const largo = Math.hypot(nx, ny, nz) || 1;
        nx /= largo;
        ny /= largo;
        nz /= largo;
        // Se ilumina la cara que mira a la cámara: la malla derivada no siempre
        // viene enrollada igual, y sin esto medio diseño sale negro.
        if (nz < 0) {
          nx = -nx;
          ny = -ny;
          nz = -nz;
        }

        let luz = AMBIENTE;
        for (const { direccion, fuerza } of LUCES) {
          const [lx, ly, lz] = direccion;
          const n = Math.hypot(lx, ly, lz);
          const punto = (nx * lx + ny * ly + nz * lz) / n;
          if (punto > 0) luz += punto * fuerza;
        }
        luz /= Math.PI;
        if (luz > 1) luz = 1;

        lienzo[donde * 3] = aSrgb(ALBEDO[0] * luz) * 255;
        lienzo[donde * 3 + 1] = aSrgb(ALBEDO[1] * luz) * 255;
        lienzo[donde * 3 + 2] = aSrgb(ALBEDO[2] * luz) * 255;
      }
    }
  }

  return aPng(reducir(lienzo, lado, DOBLE), tamano, tamano);
}

function aLineal(c: number) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function aSrgb(c: number) {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/**
 * La misma preparación que hace el visor: se normaliza el tamaño para que la
 * cámara sirva igual para una carilla que para una arcada entera, se centra, y
 * se gira al ángulo del retrato.
 */
function prepararla(malla: Malla) {
  const original = malla.posiciones;
  const cuantos = original.length / 3;

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let v = 0; v < cuantos; v++) {
    const px = original[v * 3];
    const py = original[v * 3 + 1];
    const pz = original[v * 3 + 2];
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (pz < minZ) minZ = pz;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
    if (pz > maxZ) maxZ = pz;
  }

  const centroX = (minX + maxX) / 2;
  const centroY = (minY + maxY) / 2;
  const centroZ = (minZ + maxZ) / 2;

  // El radio de la esfera que cubre todo, medido desde el centro de la caja:
  // es lo mismo que calcula `computeBoundingSphere`.
  let radio = 0;
  for (let v = 0; v < cuantos; v++) {
    const d = Math.hypot(
      original[v * 3] - centroX,
      original[v * 3 + 1] - centroY,
      original[v * 3 + 2] - centroZ,
    );
    if (d > radio) radio = d;
  }
  if (radio === 0) radio = 1;

  const [gx, gy, gz] = GIRO;
  const cx = Math.cos(gx);
  const sx = Math.sin(gx);
  const cy = Math.cos(gy);
  const sy = Math.sin(gy);
  const cz = Math.cos(gz);
  const sz = Math.sin(gz);

  const posiciones = new Float32Array(original.length);
  for (let v = 0; v < cuantos; v++) {
    const px = (original[v * 3] - centroX) / radio;
    const py = (original[v * 3 + 1] - centroY) / radio;
    const pz = (original[v * 3 + 2] - centroZ) / radio;

    // Euler XYZ, el orden que usa three.js por omisión.
    const y1 = py * cx - pz * sx;
    const z1 = py * sx + pz * cx;
    const x2 = px * cy + z1 * sy;
    const z2 = -px * sy + z1 * cy;
    const x3 = x2 * cz - y1 * sz;
    const y3 = x2 * sz + y1 * cz;

    posiciones[v * 3] = x3;
    posiciones[v * 3 + 1] = y3;
    posiciones[v * 3 + 2] = z2;
  }

  return { posiciones, indices: malla.indices };
}

/** Normales por vértice, pesadas por área, como `computeVertexNormals`. */
function normalesDeLosVertices(
  posiciones: Float32Array,
  indices: Uint32Array,
) {
  const normales = new Float32Array(posiciones.length);

  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3;
    const b = indices[t + 1] * 3;
    const c = indices[t + 2] * 3;

    const abx = posiciones[b] - posiciones[a];
    const aby = posiciones[b + 1] - posiciones[a + 1];
    const abz = posiciones[b + 2] - posiciones[a + 2];
    const acx = posiciones[c] - posiciones[a];
    const acy = posiciones[c + 1] - posiciones[a + 1];
    const acz = posiciones[c + 2] - posiciones[a + 2];

    // El producto cruz sin normalizar ya trae el área: los triángulos grandes
    // pesan más, que es lo que hace suave una malla reducida.
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;

    for (const v of [a, b, c]) {
      normales[v] += nx;
      normales[v + 1] += ny;
      normales[v + 2] += nz;
    }
  }

  return normales;
}

/** Promedia cada cuadro de `factor × factor` en un pixel. */
function reducir(lienzo: Uint8Array, lado: number, factor: number) {
  const chico = lado / factor;
  const salida = new Uint8Array(chico * chico * 3);
  const cuantos = factor * factor;

  for (let y = 0; y < chico; y++) {
    for (let x = 0; x < chico; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let dy = 0; dy < factor; dy++) {
        for (let dx = 0; dx < factor; dx++) {
          const donde = ((y * factor + dy) * lado + x * factor + dx) * 3;
          r += lienzo[donde];
          g += lienzo[donde + 1];
          b += lienzo[donde + 2];
        }
      }
      const destino = (y * chico + x) * 3;
      salida[destino] = r / cuantos;
      salida[destino + 1] = g / cuantos;
      salida[destino + 2] = b / cuantos;
    }
  }

  return salida;
}

// ------------------------------------------------------------------ el PNG

/**
 * Un PNG de color verdadero, sin filtros.
 *
 * Se escribe a mano para no meter una dependencia por cuatro trozos: firma,
 * IHDR, IDAT con el zlib que ya trae Node, y IEND.
 */
function aPng(pixeles: Uint8Array, ancho: number, alto: number): Buffer {
  const crudo = Buffer.alloc(alto * (1 + ancho * 3));
  for (let y = 0; y < alto; y++) {
    const renglon = y * (1 + ancho * 3);
    crudo[renglon] = 0; // sin filtro
    Buffer.from(
      pixeles.buffer,
      pixeles.byteOffset + y * ancho * 3,
      ancho * 3,
    ).copy(crudo, renglon + 1);
  }

  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(ancho, 0);
  cabecera.writeUInt32BE(alto, 4);
  cabecera[8] = 8; // 8 bits por canal
  cabecera[9] = 2; // color verdadero, sin alfa
  cabecera[10] = 0;
  cabecera[11] = 0;
  cabecera[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo("IHDR", cabecera),
    trozo("IDAT", zlib.deflateSync(crudo, { level: 9 })),
    trozo("IEND", Buffer.alloc(0)),
  ]);
}

function trozo(nombre: string, datos: Buffer) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length, 0);
  const cuerpo = Buffer.concat([Buffer.from(nombre, "ascii"), datos]);
  const suma = Buffer.alloc(4);
  suma.writeUInt32BE(crc32(cuerpo), 0);
  return Buffer.concat([largo, cuerpo, suma]);
}

const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    tabla[n] = c >>> 0;
  }
  return tabla;
})();

function crc32(datos: Buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < datos.length; i++) {
    c = TABLA_CRC[(c ^ datos[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}
