import { prisma } from "@/lib/prisma";
import { usuarioActual } from "@/lib/sesion";
import { filtroDeCasos } from "@/lib/autorizacion";

export const dynamic = "force-dynamic";

/**
 * Novedades en vivo (SKILL.md O-5).
 *
 * Criterio de aceptación: mover una tarjeta en el tablero actualiza en tiempo
 * real el estado que ve el doctor.
 *
 * Cómo: la bitácora ya lleva un número de secuencia que sube con cada cambio.
 * Esta ruta mantiene abierta una conexión y avisa cuando ese número crece para
 * los casos que esta persona puede ver. El navegador vuelve a pedir la pantalla
 * y ya. Sin infraestructura extra ni servidor de mensajes.
 */

const CADA_MS = 3000;
const MINUTOS_DE_VIDA = 30;

export async function GET(peticion: Request) {
  const usuario = await usuarioActual();
  if (!usuario) return new Response("Necesita entrar a Mileo.", { status: 401 });

  const donde = { caso: filtroDeCasos(usuario) };

  async function ultimaSecuencia() {
    const ultimo = await prisma.eventoBitacora.findFirst({
      where: donde,
      orderBy: { secuencia: "desc" },
      select: { secuencia: true },
    });
    return ultimo?.secuencia ?? BigInt(0);
  }

  let anterior = await ultimaSecuencia();
  const codificador = new TextEncoder();

  const flujo = new ReadableStream({
    async start(control) {
      const hasta = Date.now() + MINUTOS_DE_VIDA * 60 * 1000;

      control.enqueue(codificador.encode(": conectado\n\n"));

      const reloj = setInterval(async () => {
        if (peticion.signal.aborted || Date.now() > hasta) {
          clearInterval(reloj);
          try {
            control.close();
          } catch {
            // Ya estaba cerrado.
          }
          return;
        }

        try {
          const actual = await ultimaSecuencia();
          if (actual > anterior) {
            anterior = actual;
            control.enqueue(
              codificador.encode(`event: novedad\ndata: ${actual}\n\n`),
            );
          } else {
            // Latido: mantiene viva la conexión detrás de proxys.
            control.enqueue(codificador.encode(": latido\n\n"));
          }
        } catch {
          clearInterval(reloj);
          try {
            control.close();
          } catch {
            // Ya estaba cerrado.
          }
        }
      }, CADA_MS);

      peticion.signal.addEventListener("abort", () => clearInterval(reloj));
    },
  });

  return new Response(flujo, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
