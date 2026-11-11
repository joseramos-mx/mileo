import type { PrismaClient } from "@/generated/prisma/client";
import type { CatalogoDeCotizacion } from "@/lib/cotizador";

/**
 * Lo que se necesita del cliente de Prisma. Acepta el cliente normal y también
 * el de una transacción (`prisma.$transaction(async (tx) => ...)`), que es como
 * se va a llamar al enviar el caso.
 */
export type ClienteDeCotizacion = Pick<
  PrismaClient,
  "tarifa" | "plazoDeEntrega" | "ajustesDeCotizacion" | "diaInhabil"
>;

/**
 * Lee de la base lo que la calculadora necesita: tarifas, plazos, días
 * inhábiles y ajustes. Son unas veinte filas, así que se mandan enteras al
 * navegador y el precio se recalcula ahí mientras el doctor escoge.
 *
 * Se llama desde el servidor (una página o una acción) con el cliente de
 * Prisma de la aplicación:
 *
 *   const catalogo = await cargarCatalogoDeCotizacion(prisma);
 *
 * Sólo cuenta lo activo. Si la fila de ajustes no existe, se usan los valores
 * de siempre en vez de romper la pantalla.
 */
export async function cargarCatalogoDeCotizacion(
  db: ClienteDeCotizacion,
): Promise<CatalogoDeCotizacion> {
  const [tarifas, plazos, ajustes, inhabiles] = await Promise.all([
    db.tarifa.findMany({ where: { activa: true }, orderBy: { clave: "asc" } }),
    db.plazoDeEntrega.findMany({ orderBy: { clave: "asc" } }),
    db.ajustesDeCotizacion.findUnique({ where: { id: "unica" } }),
    db.diaInhabil.findMany({ orderBy: { fecha: "asc" } }),
  ]);

  return {
    tarifas: tarifas.map((t) => ({
      clave: t.clave,
      nombre: t.nombre,
      precioCentavos: t.precioCentavos,
      roles: t.roles,
      materiales: t.materiales,
      sobreImplante: t.sobreImplante,
      retencion: t.retencion,
      prioridad: t.prioridad,
      incluidaConOtroTrabajo: t.incluidaConOtroTrabajo,
      plazoClave: t.plazoClave,
    })),
    plazos: plazos.map((p) => ({
      clave: p.clave,
      nombre: p.nombre,
      diasEstandar: p.diasEstandar,
      diasEstandarMax: p.diasEstandarMax,
      diasRapido: p.diasRapido,
      horaLimite: p.horaLimite,
      maxUnidadesPorPieza: p.maxUnidadesPorPieza,
      condicionRapida: p.condicionRapida,
      diasPorPrueba: p.diasPorPrueba,
    })),
    recargoDiaSiguientePct: ajustes?.recargoDiaSiguientePct ?? 30,
    recargoMismoDiaPct: ajustes?.recargoMismoDiaPct ?? 50,
    diasHabiles: ajustes?.diasHabiles ?? [1, 2, 3, 4, 5],
    zonaHoraria: ajustes?.zonaHoraria ?? "America/Mexico_City",
    // @db.Date llega como medianoche UTC: los diez primeros caracteres son el día.
    inhabiles: inhabiles.map((d) => d.fecha.toISOString().slice(0, 10)),
  };
}
