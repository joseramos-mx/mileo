import * as THREE from "three";

/**
 * Lee en el navegador la malla ligera que derivó el servidor (src/lib/malla.ts).
 *
 * Lo usan las dos pantallas que enseñan el diseño: el visor 3D de la aprobación
 * y el recuadro del inicio. Una sola versión del lector, para que las dos
 * enseñen exactamente la misma geometría.
 */

const FIRMA = 0x4d4c4c41; // "MLLA"

export type MallaLeida = {
  geometria: THREE.BufferGeometry;
  triangulos: number;
};

/** Trae la malla del caso, contando el avance real de la descarga. */
export async function traerMalla(
  archivoDeMallaId: string,
  alAvanzar?: (porcentaje: number) => void,
  senal?: AbortSignal,
): Promise<MallaLeida> {
  const respuesta = await fetch(`/api/archivos/${archivoDeMallaId}/contenido`, {
    signal: senal,
  });
  if (!respuesta.ok || !respuesta.body) {
    throw new Error("No pude traer la vista del diseño.");
  }

  const total = Number(respuesta.headers.get("content-length") ?? "0");
  const lector = respuesta.body.getReader();
  const trozos: Uint8Array[] = [];
  let recibidos = 0;

  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    if (value) {
      trozos.push(value);
      recibidos += value.byteLength;
      if (total > 0) alAvanzar?.(Math.round((recibidos / total) * 100));
    }
  }

  const datos = new Uint8Array(recibidos);
  let desplazamiento = 0;
  for (const trozo of trozos) {
    datos.set(trozo, desplazamiento);
    desplazamiento += trozo.byteLength;
  }

  return armarGeometria(datos.buffer);
}

/** Lee el formato .malla que produce src/lib/malla.ts. */
export function armarGeometria(buffer: ArrayBuffer): MallaLeida {
  const vista = new DataView(buffer);
  if (vista.getUint32(0, true) !== FIRMA) {
    throw new Error("La vista del diseño llegó dañada.");
  }

  const vertices = vista.getUint32(8, true);
  const cuantosIndices = vista.getUint32(12, true);

  const min = [
    vista.getFloat32(16, true),
    vista.getFloat32(20, true),
    vista.getFloat32(24, true),
  ];
  const tamano = [
    vista.getFloat32(28, true),
    vista.getFloat32(32, true),
    vista.getFloat32(36, true),
  ];

  const crudas = new Uint16Array(buffer, 40, vertices * 3);
  const posiciones = new Float32Array(vertices * 3);
  for (let i = 0; i < posiciones.length; i++) {
    const eje = i % 3;
    posiciones[i] = min[eje] + (crudas[i] / 65535) * tamano[eje];
  }

  const bytesPosiciones = vertices * 3 * 2;
  const relleno = bytesPosiciones % 4 === 0 ? 0 : 2;
  const indices = new Uint32Array(
    buffer,
    40 + bytesPosiciones + relleno,
    cuantosIndices,
  );

  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.BufferAttribute(posiciones, 3));
  geometria.setIndex(new THREE.BufferAttribute(indices, 1));
  geometria.computeVertexNormals();

  // Se normaliza el tamaño para que la cámara sirva igual para una carilla que
  // para un modelo de arcada completa.
  geometria.computeBoundingSphere();
  const radio = geometria.boundingSphere?.radius ?? 1;
  geometria.scale(1 / radio, 1 / radio, 1 / radio);
  geometria.computeBoundingSphere();

  return { geometria, triangulos: cuantosIndices / 3 };
}

/** El material con el que Mileo pinta una pieza. Uno solo, en las dos vistas. */
export function materialDeLaPieza() {
  return new THREE.MeshStandardMaterial({
    color: "#e9e6e0",
    roughness: 0.55,
    metalness: 0.02,
  });
}
