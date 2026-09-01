import fs from "node:fs";
import { prisma } from "@/lib/prisma";
import { usuarioActual } from "@/lib/sesion";
import { filtroDeCasos } from "@/lib/autorizacion";
import { rutaAbsolutaDe } from "@/lib/almacen";

/**
 * Entrega el contenido de un archivo del caso.
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

  const completa = rutaAbsolutaDe(archivo.rutaRelativa);
  let tamano: number;
  try {
    tamano = (await fs.promises.stat(completa)).size;
  } catch {
    return new Response("No encuentro ese archivo.", { status: 404 });
  }

  const descargar = new URL(peticion.url).searchParams.has("descargar");

  const flujo = fs.createReadStream(completa);
  return new Response(
    // El flujo de Node se adapta al que espera la respuesta web.
    flujo as unknown as ReadableStream,
    {
      headers: {
        "content-type":
          TIPOS_DE_CONTENIDO[archivo.extension] ?? "application/octet-stream",
        "content-length": String(tamano),
        "cache-control": "private, max-age=3600",
        ...(descargar
          ? {
              "content-disposition": `attachment; filename="${encodeURIComponent(archivo.nombre)}"`,
            }
          : {}),
      },
    },
  );
}
