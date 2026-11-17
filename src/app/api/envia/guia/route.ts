import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { usuarioActual } from "@/lib/sesion";
import { esDelLaboratorio } from "@/lib/autorizacion";
import { registrarEvento } from "@/lib/bitacora";
import {
  construirDestinoDesdeClinica,
  generarGuiaEnvia,
  tieneEnvia,
} from "@/lib/envia";

const esquema = z.object({
  casoId: z.string().min(1),
});

export async function POST(peticion: Request) {
  if (!tieneEnvia()) {
    return NextResponse.json(
      { error: "Envia.com no está configurado en el servidor." },
      { status: 503 },
    );
  }

  const usuario = await usuarioActual();
  if (!usuario || !esDelLaboratorio(usuario)) {
    return NextResponse.json(
      { error: "Sólo el laboratorio puede generar guías de envío." },
      { status: 403 },
    );
  }

  const cuerpo = await peticion.json().catch(() => null);
  const leido = esquema.safeParse(cuerpo);
  if (!leido.success) {
    return NextResponse.json({ error: "Caso inválido." }, { status: 400 });
  }

  const caso = await prisma.caso.findUnique({
    where: { id: leido.data.casoId },
    select: {
      id: true,
      folio: true,
      enviaCarrier: true,
      enviaServicio: true,
      numeroGuia: true,
      clinica: {
        select: {
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
    return NextResponse.json({ error: "No encuentro ese caso." }, { status: 404 });
  }
  if (caso.numeroGuia) {
    return NextResponse.json(
      { error: "Este caso ya tiene una guía generada." },
      { status: 409 },
    );
  }
  if (!caso.enviaCarrier || !caso.enviaServicio) {
    return NextResponse.json(
      { error: "El caso no tiene paquetería seleccionada." },
      { status: 400 },
    );
  }

  const destino = construirDestinoDesdeClinica(caso.clinica, caso.doctor);
  if (!destino) {
    return NextResponse.json(
      { error: "Falta la dirección estructurada de la clínica." },
      { status: 400 },
    );
  }

  try {
    const servicioNormalizado = caso.enviaServicio.endsWith("_od")
      ? caso.enviaServicio.replace(/_od$/, "")
      : caso.enviaServicio;

    const guia = await generarGuiaEnvia({
      destination: destino,
      carrier: caso.enviaCarrier,
      service: servicioNormalizado,
      folioCaso: caso.folio,
    });

    await prisma.$transaction(async (bd) => {
      await bd.caso.update({
        where: { id: caso.id },
        data: {
          enviaShipmentId: guia.shipmentId,
          numeroGuia: guia.trackingNumber,
          urlEtiquetaPdf: guia.labelUrl,
          urlRastreo: guia.trackUrl,
        },
      });
      await registrarEvento(bd, {
        tipo: "CASO_ACTUALIZADO",
        resumen: `Guía de envío generada en Envia.com (${guia.carrier.toUpperCase()} · ${guia.trackingNumber}) para el caso ${caso.folio}.`,
        casoId: caso.id,
        usuarioId: usuario.id,
        datos: {
          carrier: guia.carrier,
          service: guia.service,
          trackingNumber: guia.trackingNumber,
          shipmentId: guia.shipmentId,
        },
      });
    });

    return NextResponse.json({ guia });
  } catch (err) {
    const mensaje =
      err instanceof Error ? err.message : "Error al generar guía en Envia.com.";
    return NextResponse.json({ error: mensaje }, { status: 502 });
  }
}

