import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { usuarioActual } from "@/lib/sesion";
import { filtroDeCasos, esDelLaboratorio } from "@/lib/autorizacion";
import {
  BYTES_MAXIMOS_POR_ARCHIVO,
  extensionAceptada,
  extensionDe,
  rutaRelativaDe,
  prepararCarpeta,
  extensionesQueEsperaba,
} from "@/lib/almacen";
import fsp from "node:fs/promises";

/**
 * Empieza la subida de un archivo (SKILL.md O-2).
 *
 * Devuelve el identificador con el que se van mandando las partes. Si ya había
 * una subida sin terminar del mismo archivo en el mismo caso, se devuelve esa
 * en vez de crear otra: así, volver a escoger el archivo después de perder la
 * señal continúa en vez de reiniciar.
 */

/** Lo que puede subir la clinica. */
const TIPOS_DE_LA_CLINICA = [
  "ESCANEO_PREPARACION",
  "ESCANEO_ANTAGONISTA",
  "REGISTRO_MORDIDA",
  "FOTO_COLOR",
  "OTRO",
] as const;

/** Lo que ademas puede subir el laboratorio. */
const TIPOS_DEL_LABORATORIO = [
  "DISENO",
  "FOTO_CALIDAD_AJUSTE",
  "FOTO_CALIDAD_COLOR",
] as const;

const esquema = z.object({
  nombre: z.string().trim().min(1).max(240),
  bytesTotales: z.number().int().positive().max(BYTES_MAXIMOS_POR_ARCHIVO),
  tipo: z.enum([...TIPOS_DE_LA_CLINICA, ...TIPOS_DEL_LABORATORIO]),
});

export async function POST(
  peticion: Request,
  { params }: { params: Promise<{ casoId: string }> },
) {
  const usuario = await usuarioActual();
  if (!usuario) {
    return NextResponse.json({ error: "Necesita entrar a Mileo." }, { status: 401 });
  }

  const { casoId } = await params;

  const caso = await prisma.caso.findFirst({
    where: { id: casoId, ...filtroDeCasos(usuario) },
    select: { id: true, esBorrador: true },
  });
  if (!caso) {
    return NextResponse.json({ error: "No encuentro ese caso." }, { status: 404 });
  }

  const leido = esquema.safeParse(await peticion.json());
  if (!leido.success) {
    return NextResponse.json(
      { error: "No pude leer los datos del archivo." },
      { status: 400 },
    );
  }

  const { nombre, bytesTotales, tipo } = leido.data;

  // El diseno y las fotos de control de calidad son del laboratorio: la clinica
  // no puede subir un archivo haciendolo pasar por diseno aprobado.
  const esDelLab = esDelLaboratorio(usuario);
  if (!esDelLab && !(TIPOS_DE_LA_CLINICA as readonly string[]).includes(tipo)) {
    return NextResponse.json(
      { error: "Ese tipo de archivo lo sube el laboratorio." },
      { status: 403 },
    );
  }

  if (!extensionAceptada(nombre, tipo)) {
    return NextResponse.json(
      {
        error:
          `Ese archivo no lo puedo abrir. Aquí espero ` +
          `${extensionesQueEsperaba(tipo)}.`,
      },
      { status: 400 },
    );
  }

  // ¿Ya había una subida a medias de este mismo archivo?
  const enProceso = await prisma.archivo.findFirst({
    where: {
      casoId: caso.id,
      nombre,
      bytesTotales: BigInt(bytesTotales),
      estado: "EN_PROCESO",
    },
  });

  if (enProceso) {
    return NextResponse.json({
      id: enProceso.id,
      bytesRecibidos: Number(enProceso.bytesRecibidos),
      bytesTotales: Number(enProceso.bytesTotales),
      continuando: true,
    });
  }

  const extension = extensionDe(nombre);
  const archivo = await prisma.archivo.create({
    data: {
      casoId: caso.id,
      nombre,
      tipo,
      extension,
      bytesTotales: BigInt(bytesTotales),
      bytesRecibidos: BigInt(0),
      estado: "EN_PROCESO",
      rutaRelativa: "pendiente",
      subidoPorId: usuario.id,
    },
  });

  const rutaRelativa = rutaRelativaDe(caso.id, archivo.id, extension);
  await prisma.archivo.update({
    where: { id: archivo.id },
    data: { rutaRelativa },
  });

  // Se crea vacío para que reanudar siempre encuentre algo que medir.
  const completa = await prepararCarpeta(rutaRelativa);
  await fsp.writeFile(completa, "");

  return NextResponse.json({
    id: archivo.id,
    bytesRecibidos: 0,
    bytesTotales,
    continuando: false,
  });
}
