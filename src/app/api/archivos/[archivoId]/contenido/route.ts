import { prisma } from "@/lib/prisma";
import { usuarioActual } from "@/lib/sesion";
import { esDelLaboratorio, filtroDeCasos } from "@/lib/autorizacion";
import { esExtensionDeFoto, leerArchivo } from "@/lib/almacen";

/**
 * Entrega el contenido de un archivo del caso (desde Amazon S3 o caché local).
 *
 * Sirve para dos cosas: alimentar al visor 3D con la malla ligera y, sobre
 * todo, para la alternativa al visor que exige §7 — quien no puede usar el
 * visor descarga el archivo y lo abre en su programa.
 *
 * Nunca se sirve un archivo por su ruta: siempre por su identificador, y sólo
 * si el caso es de quien lo pide.
 */

const TIPOS_DE_CONTENIDO: Record<string, string> = {
  malla: "application/octet-stream",
  stl: "model/stl",
  ply: "application/octet-stream",
  obj: "text/plain",
  dcm: "application/dicom",
  dicom: "application/dicom",
  zip: "application/zip",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
};

export async function GET(
  peticion: Request,
  { params }: { params: Promise<{ archivoId: string }> },
) {
  const usuario = await usuarioActual();
  if (!usuario) {
    return new Response("Necesita entrar a Mileo.", { status: 401 });
  }

  const { archivoId } = await params;
  const archivo = await prisma.archivo.findFirst({
    where: { id: archivoId, caso: filtroDeCasos(usuario) },
  });

  if (!archivo || archivo.estado !== "COMPLETO") {
    return new Response("No encuentro ese archivo.", { status: 404 });
  }

  const descargar = new URL(peticion.url).searchParams.has("descargar");
  const delLab = esDelLaboratorio(usuario);

  // Protección del diseño: fuera del laboratorio no se puede descargar ni
  // acceder directamente al archivo original (solo se ve desde el visor).
  if (!delLab) {
    if (archivo.tipo === "MALLA_LIGERA" && descargar) {
      return new Response("El diseño sólo se puede ver en el visor.", {
        status: 403,
      });
    }
    if (archivo.tipo === "DISENO") {
      if (descargar || !esExtensionDeFoto(archivo.extension)) {
        return new Response("El diseño sólo se puede ver en el visor.", {
          status: 403,
        });
      }
    }
  }

  let bytes: Buffer;
  try {
    bytes = await leerArchivo(archivo.rutaRelativa);
  } catch {
    return new Response("No encuentro ese archivo.", { status: 404 });
  }

  const ext = archivo.extension.toLowerCase();

  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type":
        TIPOS_DE_CONTENIDO[ext] ?? "application/octet-stream",
      "content-length": String(bytes.byteLength),
      "x-content-type-options": "nosniff",
      "cache-control":
        archivo.tipo === "DISENO" || archivo.tipo === "MALLA_LIGERA"
          ? "private, no-store"
          : "private, max-age=3600",
      ...(descargar
        ? {
            "content-disposition": `attachment; filename="${encodeURIComponent(archivo.nombre)}"`,
          }
        : {}),
    },
  });
}
