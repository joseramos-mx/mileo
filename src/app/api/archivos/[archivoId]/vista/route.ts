import fsp from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { usuarioActual } from "@/lib/sesion";
import { filtroDeCasos } from "@/lib/autorizacion";
import { prepararCarpeta, rutaAbsolutaDe } from "@/lib/almacen";
import {
  LADO_DEL_RETRATO,
  desempaquetar,
  rutaDelRetrato,
} from "@/lib/malla";
import { dibujarLaPieza } from "@/lib/vista-malla";

/**
 * El retrato del diseño: un PNG de la misma pieza que el doctor gira en la
 * pantalla de aprobación.
 *
 * Existe para que la vista del diseño se pueda enseñar en cualquier lista —el
 * inicio, sus casos, cada tarjeta que espera su revisión— con un `<img>` y sin
 * abrir un contexto 3D por tarjeta (§5.5).
 *
 * Normalmente ya está dibujado desde que el laboratorio mandó el diseño. Si no
 * —una malla de antes de que esto existiera—, se dibuja aquí la primera vez y
 * se guarda al lado de la malla.
 *
 * Como todo archivo del caso: nunca por su ruta, siempre por su identificador,
 * y sólo si el caso es de quien lo pide.
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
      tipo: "MALLA_LIGERA",
      estado: "COMPLETO",
      caso: filtroDeCasos(usuario),
    },
    select: { id: true, casoId: true, rutaRelativa: true },
  });

  if (!archivo) {
    return new Response("No encuentro esa vista.", { status: 404 });
  }

  // `?tamano=chico` es el de las miniaturas. Cualquier otra cosa, el grande:
  // el parámetro viene de la dirección y no se le hace caso a lo que traiga.
  const tamano =
    new URL(peticion.url).searchParams.get("tamano") === "chico"
      ? "chico"
      : "grande";
  const retrato = rutaDelRetrato(archivo.id, archivo.casoId, tamano);
  let png: Buffer;

  try {
    png = await fsp.readFile(rutaAbsolutaDe(retrato));
  } catch {
    // Todavía no está dibujado: se dibuja de la malla, no del original.
    let malla: Buffer;
    try {
      malla = await fsp.readFile(rutaAbsolutaDe(archivo.rutaRelativa));
    } catch {
      return new Response("No encuentro esa vista.", { status: 404 });
    }

    try {
      png = dibujarLaPieza(desempaquetar(malla), LADO_DEL_RETRATO[tamano]);
    } catch {
      return new Response("No pude dibujar esa vista.", { status: 500 });
    }

    // Se guarda para no volver a dibujarla. Si el disco no deja, no importa:
    // la respuesta ya va en camino.
    try {
      await fsp.writeFile(await prepararCarpeta(retrato), png);
    } catch {}
  }

  return new Response(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      "content-length": String(png.length),
      // El retrato de un diseño no cambia: si el laboratorio manda otro, es
      // otra malla y otro identificador.
      "cache-control": "private, max-age=604800, immutable",
    },
  });
}
