import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { usuarioActual } from "@/lib/sesion";
import { filtroDeCasos } from "@/lib/autorizacion";
import {
  construirDestinoDesdeClinica,
  cotizarEnvioEnvia,
  tieneEnvia,
} from "@/lib/envia";

const esquemaDireccion = z.object({
  codigoPostal: z.string().trim().regex(/^\d{5}$/, "Código postal de 5 dígitos."),
  calle: z.string().trim().min(2, "Indique la calle."),
  numeroExterior: z.string().trim().min(1, "Indique el número exterior."),
  colonia: z.string().trim().min(2, "Indique la colonia."),
  ciudad: z.string().trim().min(2, "Indique la ciudad."),
  estadoEnvio: z.string().trim().length(2, "Seleccione un estado válido."),
  telefonoEnvio: z.string().trim().min(10, "Teléfono a 10 dígitos."),
  correoEnvio: z.string().trim().email("Correo inválido.").optional().or(z.literal("")),
});

const esquema = z.object({
  casoId: z.string().min(1),
  direccion: esquemaDireccion.optional(),
});

export async function POST(peticion: Request) {
  if (!tieneEnvia()) {
    return NextResponse.json(
      { error: "Envia.com no está configurado en el servidor." },
      { status: 503 },
    );
  }

  const usuario = await usuarioActual();
  if (!usuario) {
    return NextResponse.json(
      { error: "Necesita iniciar sesión en Mileo." },
      { status: 401 },
    );
  }

  const cuerpo = await peticion.json().catch(() => null);
  const leido = esquema.safeParse(cuerpo);
  if (!leido.success) {
    const mensaje =
      leido.error.issues[0]?.message || "Revise los datos de la dirección.";
    return NextResponse.json({ error: mensaje }, { status: 400 });
  }

  const { casoId, direccion } = leido.data;

  const caso = await prisma.caso.findFirst({
    where: { id: casoId, ...filtroDeCasos(usuario) },
    select: {
      id: true,
      clinicaId: true,
      clinica: {
        select: {
          id: true,
          nombre: true,
          ciudad: true,
          codigoPostal: true,
          calle: true,
          numeroExterior: true,
          colonia: true,
          estadoEnvio: true,
          telefonoEnvio: true,
          correoEnvio: true,
        },
      },
      doctor: {
        select: {
          nombreCompleto: true,
          correo: true,
          telefono: true,
        },
      },
    },
  });

  if (!caso) {
    return NextResponse.json(
      { error: "No encuentro ese caso." },
      { status: 404 },
    );
  }

  let clinicaActual = caso.clinica;

  if (direccion) {
    clinicaActual = await prisma.clinica.update({
      where: { id: caso.clinicaId },
      data: {
        codigoPostal: direccion.codigoPostal,
        calle: direccion.calle,
        numeroExterior: direccion.numeroExterior,
        colonia: direccion.colonia,
        ciudad: direccion.ciudad,
        estadoEnvio: direccion.estadoEnvio.toUpperCase(),
        telefonoEnvio: direccion.telefonoEnvio,
        correoEnvio: direccion.correoEnvio || null,
        direccionEntrega: `${direccion.calle} ${direccion.numeroExterior}, ${direccion.colonia}, CP ${direccion.codigoPostal}, ${direccion.ciudad}`,
      },
      select: {
        id: true,
        nombre: true,
        ciudad: true,
        codigoPostal: true,
        calle: true,
        numeroExterior: true,
        colonia: true,
        estadoEnvio: true,
        telefonoEnvio: true,
        correoEnvio: true,
      },
    });
  }

  const destino = construirDestinoDesdeClinica(clinicaActual, caso.doctor);
  if (!destino) {
    return NextResponse.json(
      {
        error: "Complete la dirección de envío de la clínica para cotizar.",
        requiereDireccion: true,
      },
      { status: 400 },
    );
  }

  const tarifas = await cotizarEnvioEnvia(destino);
  if (tarifas.length === 0) {
    return NextResponse.json(
      {
        error:
          "Envia.com no devolvió tarifas disponibles para ese código postal. Verifique la dirección e intente de nuevo.",
      },
      { status: 404 },
    );
  }

  return NextResponse.json({ tarifas, direccion: clinicaActual });
}

