import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { registrarEvento } from "@/lib/bitacora";
import { armarTicketDelCaso, type DatosDelTicket } from "@/lib/ticket";

function tokenAutorizado(request: NextRequest): boolean {
  const esperado = process.env.MILEO_IMPRESORA_TOKEN;
  // Si no se configuró MILEO_IMPRESORA_TOKEN en entorno local, se permite para pruebas.
  if (!esperado) return true;

  const encabezado = request.headers.get("authorization") ?? "";
  if (encabezado === `Bearer ${esperado}`) return true;

  const queryToken = request.nextUrl.searchParams.get("token");
  return queryToken === esperado;
}

/**
 * GET /api/impresora/pendientes
 * La Raspberry Pi consulta aquí cada pocos segundos qué casos nuevos o
 * solicitados desde el laboratorio están pendientes de imprimir en la POS80.
 */
export async function GET(request: NextRequest) {
  if (!tokenAutorizado(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const candidatos = await prisma.caso.findMany({
    where: { esBorrador: false },
    orderBy: { actualizadoEn: "desc" },
    take: 25,
    select: {
      id: true,
      eventos: {
        where: {
          tipo: { in: ["CASO_ENVIADO", "CASO_ACTUALIZADO"] },
        },
        orderBy: { secuencia: "desc" },
        select: {
          tipo: true,
          datos: true,
          secuencia: true,
        },
      },
    },
  });

  const tickets: DatosDelTicket[] = [];

  for (const caso of candidatos) {
    let ultimaSolicitud: bigint | null = null;
    let ultimaImpresion: bigint | null = null;

    for (const ev of caso.eventos) {
      const datos = (ev.datos ?? {}) as Record<string, unknown>;
      if (
        ultimaSolicitud === null &&
        ((ev.tipo === "CASO_ENVIADO" && datos.ticketPendiente === true) ||
          (ev.tipo === "CASO_ACTUALIZADO" && datos.solicitarImpresion === true))
      ) {
        ultimaSolicitud = ev.secuencia;
      }
      if (
        ultimaImpresion === null &&
        ev.tipo === "CASO_ACTUALIZADO" &&
        datos.ticketImpreso === true
      ) {
        ultimaImpresion = ev.secuencia;
      }
    }

    const necesitaImprimir =
      ultimaSolicitud !== null &&
      (ultimaImpresion === null || ultimaSolicitud > ultimaImpresion);

    if (necesitaImprimir) {
      const ticket = await armarTicketDelCaso(caso.id);
      if (ticket) tickets.push(ticket);
    }
  }

  return NextResponse.json({ tickets });
}

/**
 * POST /api/impresora/pendientes
 * La Raspberry Pi avisa que ya imprimió el ticket del caso para que no se
 * vuelva a imprimir en el siguiente ciclo.
 */
export async function POST(request: NextRequest) {
  if (!tokenAutorizado(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const cuerpo = (await request.json().catch(() => ({}))) as {
    casoId?: string;
  };
  if (!cuerpo.casoId) {
    return NextResponse.json({ error: "Falta casoId." }, { status: 400 });
  }

  const caso = await prisma.caso.findUnique({
    where: { id: cuerpo.casoId },
    select: { id: true, folio: true },
  });
  if (!caso) {
    return NextResponse.json({ error: "Caso no encontrado." }, { status: 404 });
  }

  await registrarEvento(prisma, {
    tipo: "CASO_ACTUALIZADO",
    casoId: caso.id,
    resumen: `Se imprimió el ticket térmico (POS80) del caso ${caso.folio}.`,
    datos: { ticketImpreso: true },
  });

  return NextResponse.json({ ok: true });
}

