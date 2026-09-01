import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { usuarioActual } from "@/lib/sesion";
import { filtroDeCasos } from "@/lib/autorizacion";
import { registrarEvento } from "@/lib/bitacora";
import {
  agregarParte,
  bytesEnDisco,
  borrarArchivo,
  huellaDe,
} from "@/lib/almacen";
import { TIPOS_DE_ARCHIVO } from "@/lib/vocabulario";

/**
 * Las partes de una subida reanudable (SKILL.md O-2).
 *
 *   GET    por dónde iba
 *   PATCH  agrega la siguiente parte
 *   DELETE cancela y borra lo subido
 *
 * La verdad de cuánto se recibió está en el disco, no en la base: si el proceso
 * se cae entre escribir el archivo y actualizar el registro, al reanudar se
 * vuelve a medir el archivo y se corrige. Nunca se pierde ni se duplica.
 */

async function archivoDelUsuario(archivoId: string) {
  const usuario = await usuarioActual();
  if (!usuario) return { error: "sesion" as const };

  const archivo = await prisma.archivo.findFirst({
    where: { id: archivoId, caso: filtroDeCasos(usuario) },
    include: { caso: { select: { id: true, folio: true } } },
  });

  if (!archivo) return { error: "no-existe" as const };
  return { usuario, archivo };
}

export async function GET(
  _peticion: Request,
  { params }: { params: Promise<{ archivoId: string }> },
) {
  const { archivoId } = await params;
  const encontrado = await archivoDelUsuario(archivoId);

  if ("error" in encontrado) {
    return NextResponse.json(
      { error: "No encuentro ese archivo." },
      { status: encontrado.error === "sesion" ? 401 : 404 },
    );
  }

  const { archivo } = encontrado;
  const enDisco = await bytesEnDisco(archivo.rutaRelativa);

  // El disco manda: si la base se quedó atrás, se corrige aquí.
  if (enDisco !== Number(archivo.bytesRecibidos)) {
    await prisma.archivo.update({
      where: { id: archivo.id },
      data: { bytesRecibidos: BigInt(enDisco) },
    });
  }

  return NextResponse.json({
    id: archivo.id,
    nombre: archivo.nombre,
    estado: archivo.estado,
    bytesRecibidos: enDisco,
    bytesTotales: Number(archivo.bytesTotales),
  });
}

export async function PATCH(
  peticion: Request,
  { params }: { params: Promise<{ archivoId: string }> },
) {
  const { archivoId } = await params;
  const encontrado = await archivoDelUsuario(archivoId);

  if ("error" in encontrado) {
    return NextResponse.json(
      { error: "No encuentro ese archivo." },
      { status: encontrado.error === "sesion" ? 401 : 404 },
    );
  }

  const { usuario, archivo } = encontrado;

  if (archivo.estado === "COMPLETO") {
    return NextResponse.json(
      { error: "Ese archivo ya está completo." },
      { status: 409 },
    );
  }

  const desde = Number(peticion.headers.get("x-mileo-desde") ?? "-1");
  if (!Number.isInteger(desde) || desde < 0) {
    return NextResponse.json(
      { error: "Falta indicar desde qué byte va la parte." },
      { status: 400 },
    );
  }

  const parte = Buffer.from(await peticion.arrayBuffer());
  if (parte.byteLength === 0) {
    return NextResponse.json({ error: "La parte venía vacía." }, { status: 400 });
  }

  const bytesTotales = Number(archivo.bytesTotales);
  const nuevoTotal = await agregarParte(archivo.rutaRelativa, desde, parte);

  if (nuevoTotal === null) {
    // El cliente iba desfasado: se le dice por dónde va de verdad y reanuda.
    const enDisco = await bytesEnDisco(archivo.rutaRelativa);
    return NextResponse.json(
      { error: "desfasado", bytesRecibidos: enDisco },
      { status: 409 },
    );
  }

  if (nuevoTotal > bytesTotales) {
    return NextResponse.json(
      { error: "La subida trae más bytes de los anunciados." },
      { status: 400 },
    );
  }

  const completo = nuevoTotal === bytesTotales;

  await prisma.archivo.update({
    where: { id: archivo.id },
    data: {
      bytesRecibidos: BigInt(nuevoTotal),
      estado: completo ? "COMPLETO" : "EN_PROCESO",
      ...(completo ? { sha256: await huellaDe(archivo.rutaRelativa) } : {}),
    },
  });

  if (completo) {
    await registrarEvento(prisma, {
      tipo: "ARCHIVO_SUBIDO",
      resumen: `${usuario.nombreCompleto} subió "${archivo.nombre}" (${TIPOS_DE_ARCHIVO[archivo.tipo]}).`,
      casoId: archivo.casoId,
      usuarioId: usuario.id,
      datos: {
        archivoId: archivo.id,
        nombre: archivo.nombre,
        tipo: archivo.tipo,
        bytes: nuevoTotal,
      },
    });
  }

  return NextResponse.json({
    bytesRecibidos: nuevoTotal,
    bytesTotales,
    estado: completo ? "COMPLETO" : "EN_PROCESO",
  });
}

export async function DELETE(
  _peticion: Request,
  { params }: { params: Promise<{ archivoId: string }> },
) {
  const { archivoId } = await params;
  const encontrado = await archivoDelUsuario(archivoId);

  if ("error" in encontrado) {
    return NextResponse.json(
      { error: "No encuentro ese archivo." },
      { status: encontrado.error === "sesion" ? 401 : 404 },
    );
  }

  const { usuario, archivo } = encontrado;

  await borrarArchivo(archivo.rutaRelativa);
  await prisma.archivo.delete({ where: { id: archivo.id } });

  await registrarEvento(prisma, {
    tipo: "ARCHIVO_ELIMINADO",
    resumen: `${usuario.nombreCompleto} quitó "${archivo.nombre}" del caso.`,
    casoId: archivo.casoId,
    usuarioId: usuario.id,
    datos: { nombre: archivo.nombre, tipo: archivo.tipo },
  });

  return NextResponse.json({ listo: true });
}
