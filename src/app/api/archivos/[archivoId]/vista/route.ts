import { prisma } from "@/lib/prisma";
import { usuarioActual } from "@/lib/sesion";
import { filtroDeCasos } from "@/lib/autorizacion";
import {
  esExtensionDeFoto,
  guardarArchivo,
  leerArchivo,
} from "@/lib/almacen";
import {
  LADO_DEL_RETRATO,
  desempaquetar,
  rutaDelRetrato,
} from "@/lib/malla";
import { dibujarLaPieza } from "@/lib/vista-malla";

/**
 * El retrato del diseño: un PNG de la misma pieza que el doctor gira en la
 * pantalla de aprobación (servido desde Amazon S3 o caché local).
 */
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
    where: {
      id: archivoId,
      tipo: { in: ["MALLA_LIGERA", "DISENO"] },
      estado: "COMPLETO",
      caso: filtroDeCasos(usuario),
    },
    select: {
      id: true,
      casoId: true,
      tipo: true,
      extension: true,
      rutaRelativa: true,
    },
  });

  if (!archivo) {
    return new Response("No encuentro esa vista.", { status: 404 });
  }

  if (archivo.tipo === "DISENO" && esExtensionDeFoto(archivo.extension)) {
    try {
      const bytes = await leerArchivo(archivo.rutaRelativa);
      const ext = archivo.extension.toLowerCase();
      const mime =
        ext === "png"
          ? "image/png"
          : ext === "webp"
            ? "image/webp"
            : ext === "heic"
              ? "image/heic"
              : "image/jpeg";
      return new Response(new Uint8Array(bytes), {
        headers: {
          "content-type": mime,
          "content-length": String(bytes.length),
          "cache-control": "private, max-age=604800, immutable",
        },
      });
    } catch {
      return new Response("No encuentro esa vista.", { status: 404 });
    }
  }

  if (archivo.tipo !== "MALLA_LIGERA") {
    return new Response("No encuentro esa vista.", { status: 404 });
  }

  const tamano =
    new URL(peticion.url).searchParams.get("tamano") === "chico"
      ? "chico"
      : "grande";
  const retrato = rutaDelRetrato(archivo.id, archivo.casoId, tamano);
  let png: Buffer;

  try {
    png = await leerArchivo(retrato);
  } catch {
    let malla: Buffer;
    try {
      malla = await leerArchivo(archivo.rutaRelativa);
    } catch {
      return new Response("No encuentro esa vista.", { status: 404 });
    }

    try {
      png = dibujarLaPieza(desempaquetar(malla), LADO_DEL_RETRATO[tamano]);
    } catch {
      return new Response("No pude dibujar esa vista.", { status: 500 });
    }

    try {
      await guardarArchivo(retrato, png, "image/png");
    } catch {}
  }

  return new Response(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      "content-length": String(png.length),
      "cache-control": "private, max-age=604800, immutable",
    },
  });
}
