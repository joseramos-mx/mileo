import type { PrismaClient } from "@/generated/prisma/client";
import {
  aCotizacionGuardada,
  cotizar,
  entregaElegida,
  type CotizacionGuardada,
} from "@/lib/cotizador";
import {
  cargarCatalogoDeCotizacion,
  type ClienteDeCotizacion,
} from "@/lib/cotizador-catalogo";
import { TRABAJOS } from "@/lib/trabajos";

/**
 * Recalcula el precio del caso en el servidor y lo congela en `Caso`.
 *
 * Se llama al ENVIAR el caso, antes de marcarlo enviado y dentro de la misma
 * transacción. El precio que vio el doctor lo calculó el navegador: sirve para
 * decidir, pero aquí se vuelve a calcular con la lista de la base, porque lo que
 * se cobra no puede depender de lo que mande el cliente.
 *
 *   const resultado = await prisma.$transaction((tx) =>
 *     congelarCotizacion(tx, { casoId, entregaRapida }),
 *   );
 *   if (!resultado.ok) return { error: resultado.motivo };
 *
 * Si el doctor marcó entrega rápida y ya no se puede (pasó la hora límite, el
 * puente creció), NO se manda como estándar sin avisarle: se devuelve el motivo
 * y el caso se queda en borrador. El recargo se le prometió; la fecha, también.
 *
 * `llegaEn` es ahora. Lo que se guarda es un estimado: la fecha que se promete
 * se fija cuando el laboratorio acepta el caso (O-3), con la misma `cotizar`.
 */
export type ClienteDeCaso = ClienteDeCotizacion &
  Pick<PrismaClient, "unidad" | "caso">;

export type ResultadoDeCotizacion =
  | { ok: true; cotizacion: CotizacionGuardada }
  | { ok: false; motivo: string };

export async function congelarCotizacion(
  db: ClienteDeCaso,
  {
    casoId,
    entregaRapida,
    llegaEn = new Date(),
    pruebas = 0,
  }: {
    casoId: string;
    entregaRapida: boolean;
    llegaEn?: Date;
    pruebas?: number;
  },
): Promise<ResultadoDeCotizacion> {
  const [unidades, catalogo] = await Promise.all([
    db.unidad.findMany({
      where: { casoId },
      select: {
        diente: true,
        arcada: true,
        rol: true,
        material: true,
        esImplante: true,
        retencion: true,
        tramoId: true,
      },
    }),
    cargarCatalogoDeCotizacion(db),
  ]);

  // Las anotaciones (antagonista, diente vecino) no se fabrican ni se cobran.
  const fabricables = unidades.filter((u) => !TRABAJOS[u.rol].esAnotacion);

  const cotizacion = cotizar(catalogo, fabricables, { llegaEn, pruebas });
  if (!cotizacion) {
    return { ok: false, motivo: "El caso no tiene piezas que se fabriquen." };
  }

  const eleccion = entregaElegida(cotizacion, entregaRapida);
  if (!eleccion.ok) return { ok: false, motivo: eleccion.motivo };

  const guardada = aCotizacionGuardada(cotizacion, eleccion, llegaEn);

  await db.caso.update({
    where: { id: casoId },
    data: { entregaRapida: eleccion.rapida, cotizacion: guardada },
  });

  return { ok: true, cotizacion: guardada };
}
