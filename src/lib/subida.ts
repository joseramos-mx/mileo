/**
 * Subida reanudable de archivos grandes (SKILL.md O-2).
 *
 * El criterio a cumplir: una asistente sube 400 MB de DICOM desde un celular,
 * pierde señal a la mitad, y la subida se reanuda sin perder lo capturado.
 *
 * Cómo se logra:
 *
 * - El archivo se manda en partes de 4 MB, una tras otra.
 * - Cada parte dice desde qué byte va. El servidor sólo la acepta si empata con
 *   lo que ya tiene en disco; si no, contesta por dónde iba de verdad y se
 *   reanuda desde ahí.
 * - Un fallo de red no cancela nada: se espera y se reintenta la misma parte.
 *   Sin señal, la subida queda en pausa y sigue sola cuando vuelve.
 * - Si la persona vuelve a escoger el mismo archivo después de recargar, el
 *   servidor reconoce la subida a medias por nombre y tamaño, y continúa.
 *
 * Este módulo corre en el navegador.
 */

export const BYTES_POR_PARTE = 4 * 1024 * 1024;

export type TipoDeArchivoSubido =
  | "ESCANEO_PREPARACION"
  | "ESCANEO_ANTAGONISTA"
  | "REGISTRO_MORDIDA"
  | "FOTO_COLOR"
  | "OTRO"
  // Sólo el laboratorio; el servidor lo verifica.
  | "DISENO"
  | "FOTO_CALIDAD_AJUSTE"
  | "FOTO_CALIDAD_COLOR";

export type EstadoDeSubida =
  | "esperando"
  | "subiendo"
  | "sin-senal"
  | "completo"
  | "error";

export type AvanceDeSubida = {
  archivoId: string | null;
  bytesRecibidos: number;
  bytesTotales: number;
  estado: EstadoDeSubida;
  mensaje?: string;
};

function esperar(ms: number) {
  return new Promise((listo) => setTimeout(listo, ms));
}

/** Espera a que vuelva la señal, sin quemar la batería consultando. */
function esperarSenal() {
  if (navigator.onLine) return Promise.resolve();
  return new Promise<void>((listo) => {
    const alVolver = () => {
      window.removeEventListener("online", alVolver);
      listo();
    };
    window.addEventListener("online", alVolver);
  });
}

export async function subirArchivo({
  casoId,
  archivo,
  tipo,
  alAvanzar,
  senal,
}: {
  casoId: string;
  archivo: File;
  tipo: TipoDeArchivoSubido;
  alAvanzar: (avance: AvanceDeSubida) => void;
  senal?: AbortSignal;
}): Promise<{ archivoId: string }> {
  const bytesTotales = archivo.size;

  alAvanzar({
    archivoId: null,
    bytesRecibidos: 0,
    bytesTotales,
    estado: "esperando",
  });

  // 1. Abrir o continuar la subida.
  const inicio = await fetch(`/api/casos/${casoId}/archivos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nombre: archivo.name, bytesTotales, tipo }),
    signal: senal,
  });

  if (!inicio.ok) {
    const cuerpo = await inicio.json().catch(() => ({}));
    const mensaje = cuerpo.error ?? "No pude empezar a subir el archivo.";
    alAvanzar({
      archivoId: null,
      bytesRecibidos: 0,
      bytesTotales,
      estado: "error",
      mensaje,
    });
    throw new Error(mensaje);
  }

  const { id: archivoId } = (await inicio.json()) as { id: string };

  // 2. Preguntar por dónde va (0 si es nueva).
  let desde = await porDondeVa(archivoId);

  alAvanzar({
    archivoId,
    bytesRecibidos: desde,
    bytesTotales,
    estado: desde >= bytesTotales ? "completo" : "subiendo",
  });

  // 3. Mandar parte por parte, aguantando cortes de red.
  let esperaEntreIntentos = 1000;

  while (desde < bytesTotales) {
    senal?.throwIfAborted();

    if (!navigator.onLine) {
      alAvanzar({
        archivoId,
        bytesRecibidos: desde,
        bytesTotales,
        estado: "sin-senal",
        mensaje: "Se fue la señal. Sigo en cuanto vuelva; no pierde lo subido.",
      });
      await esperarSenal();
      alAvanzar({
        archivoId,
        bytesRecibidos: desde,
        bytesTotales,
        estado: "subiendo",
      });
    }

    const hasta = Math.min(desde + BYTES_POR_PARTE, bytesTotales);
    const parte = archivo.slice(desde, hasta);

    try {
      const respuesta = await fetch(`/api/archivos/${archivoId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/octet-stream",
          "x-mileo-desde": String(desde),
        },
        body: parte,
        signal: senal,
      });

      if (respuesta.status === 409) {
        // Ibamos desfasados: el servidor dice por dónde va de verdad.
        const cuerpo = await respuesta.json();
        if (typeof cuerpo.bytesRecibidos === "number") {
          desde = cuerpo.bytesRecibidos;
          continue;
        }
      }

      if (!respuesta.ok) {
        const cuerpo = await respuesta.json().catch(() => ({}));
        throw new Error(cuerpo.error ?? "Falló el envío de una parte.");
      }

      const cuerpo = (await respuesta.json()) as { bytesRecibidos: number };
      desde = cuerpo.bytesRecibidos;
      esperaEntreIntentos = 1000;

      alAvanzar({
        archivoId,
        bytesRecibidos: desde,
        bytesTotales,
        estado: desde >= bytesTotales ? "completo" : "subiendo",
      });
    } catch (error) {
      if (senal?.aborted) throw error;

      // Un corte de red no cancela nada: se espera y se reintenta la misma
      // parte. Lo ya subido sigue en el servidor.
      alAvanzar({
        archivoId,
        bytesRecibidos: desde,
        bytesTotales,
        estado: "sin-senal",
        mensaje: "Se interrumpió la subida. Sigo intentando; no se pierde nada.",
      });

      await esperar(esperaEntreIntentos);
      esperaEntreIntentos = Math.min(esperaEntreIntentos * 2, 15000);

      // Volver a preguntar evita repetir bytes que sí llegaron.
      const confirmado = await porDondeVa(archivoId).catch(() => desde);
      desde = confirmado;
    }
  }

  alAvanzar({
    archivoId,
    bytesRecibidos: bytesTotales,
    bytesTotales,
    estado: "completo",
  });

  return { archivoId };
}

async function porDondeVa(archivoId: string) {
  const respuesta = await fetch(`/api/archivos/${archivoId}`);
  if (!respuesta.ok) return 0;
  const cuerpo = (await respuesta.json()) as { bytesRecibidos: number };
  return cuerpo.bytesRecibidos;
}

export async function quitarArchivo(archivoId: string) {
  await fetch(`/api/archivos/${archivoId}`, { method: "DELETE" });
}
