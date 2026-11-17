import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { usuarioActual } from "@/lib/sesion";
import { filtroDeCasos } from "@/lib/autorizacion";
import { rastrearEnvioEnvia, tieneEnvia } from "@/lib/envia";

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
  if (!usuario) {
    return NextResponse.json(
      { error: "Necesita iniciar sesión en Mileo." },
      { status: 401 },
    );
  }

  const cuerpo = await peticion.json().catch(() => null);
  const leido = esquema.safeParse(cuerpo);
  if (!leido.success) {
    return NextResponse.json({ error: "Caso inválido." }, { status: 400 });
  }

  const caso = await prisma.caso.findFirst({
    where: { id: leido.data.casoId, ...filtroDeCasos(usuario) },
    select: {
      id: true,
      numeroGuia: true,
      enviaCarrier: true,
      enviaServicioNombre: true,
      urlRastreo: true,
    },
  });

  if (!caso) {
    return NextResponse.json({ error: "No encuentro ese caso." }, { status: 404 });
  }
  if (!caso.numeroGuia) {
    return NextResponse.json(
      { error: "Este caso todavía no tiene número de guía." },
      { status: 404 },
    );
  }

  const rastreo = await rastrearEnvioEnvia(caso.numeroGuia);
  return NextResponse.json({
    rastreo: rastreo ?? {
      trackingNumber: caso.numeroGuia,
      carrier: caso.enviaCarrier ?? "",
      serviceDescription: caso.enviaServicioNombre ?? "",
      status: "Created",
      estimatedDelivery: null,
      trackUrl: caso.urlRastreo,
      events: [],
    },
  });
}

