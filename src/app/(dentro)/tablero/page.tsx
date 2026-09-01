import type { Metadata } from "next";
import type { Prisma } from "@/generated/prisma/client";
import type { Prioridad } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { exigirLaboratorio } from "@/lib/autorizacion";
import { resumirUnidades } from "@/lib/casos";
import { PRIORIDADES } from "@/lib/vocabulario";
import { Filtros } from "./Filtros";
import { Tablero } from "./Tablero";

export const metadata: Metadata = { title: "Tablero · Mileo" };

/**
 * Tablero de producción (SKILL.md O-5).
 *
 * Una columna por etapa, con arrastre entre columnas y filtros por doctor,
 * fecha y prioridad. Mover una tarjeta cambia en el momento el estado que ve el
 * doctor.
 */
export default async function PaginaDelTablero({
  searchParams,
}: PageProps<"/tablero">) {
  await exigirLaboratorio();
  const consulta = await searchParams;

  const doctor = typeof consulta.doctor === "string" ? consulta.doctor : null;
  const cuando = typeof consulta.cuando === "string" ? consulta.cuando : null;
  const prioridad =
    typeof consulta.prioridad === "string" &&
    consulta.prioridad in PRIORIDADES
      ? (consulta.prioridad as Prioridad)
      : null;

  const donde: Prisma.CasoWhereInput = {
    esBorrador: false,
    etapa: { not: "ENTREGADO" },
    ...(doctor ? { doctorId: doctor } : {}),
    ...(prioridad ? { prioridad } : {}),
    ...filtroDeFecha(cuando),
  };

  const [casos, doctores] = await Promise.all([
    prisma.caso.findMany({
      where: donde,
      select: {
        id: true,
        folio: true,
        etapa: true,
        prioridad: true,
        enRiesgo: true,
        fechaEntregaComprometida: true,
        doctor: { select: { nombreCompleto: true } },
        paciente: { select: { folio: true, iniciales: true } },
        tecnico: { select: { nombreCompleto: true } },
        unidades: { select: { diente: true, rol: true, material: true } },
        aprobaciones: { select: { decision: true } },
        controlDeCalidad: { select: { id: true } },
      },
      orderBy: [{ prioridad: "desc" }, { fechaEntregaComprometida: "asc" }],
    }),
    prisma.usuario.findMany({
      where: { rol: "DOCTOR", activo: true },
      select: { id: true, nombreCompleto: true },
      orderBy: { nombreCompleto: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-3">
        <div>
          <h1 className="text-titulo font-semibold text-primario">Tablero</h1>
          <p className="mt-1 text-menor text-secundario">
            Arrastre una tarjeta de una columna a otra, o use la lista de cada
            tarjeta. El doctor ve el cambio en el momento.
          </p>
        </div>
        <Filtros
          doctores={doctores.map((d) => ({
            id: d.id,
            nombre: d.nombreCompleto,
          }))}
        />
      </header>

      <Tablero
        casos={casos.map((caso) => ({
          id: caso.id,
          folio: caso.folio,
          etapa: caso.etapa,
          prioridad: caso.prioridad,
          enRiesgo: caso.enRiesgo,
          fechaEntregaComprometida:
            caso.fechaEntregaComprometida?.toISOString() ?? null,
          doctor: caso.doctor.nombreCompleto,
          tecnico: caso.tecnico?.nombreCompleto ?? null,
          paciente: `${caso.paciente.folio} · ${caso.paciente.iniciales}`,
          resumenDeUnidades: resumirUnidades(caso.unidades),
          tieneAprobacion: caso.aprobaciones.some(
            (a) => a.decision === "APROBADO",
          ),
          tieneCalidad: caso.controlDeCalidad !== null,
        }))}
      />
    </div>
  );
}

/** "hoy", "esta semana", "ya se pasó" o "sin fecha todavía". */
function filtroDeFecha(cuando: string | null): Prisma.CasoWhereInput {
  if (!cuando) return {};

  const ahora = new Date();
  const finDeHoy = new Date(ahora);
  finDeHoy.setHours(23, 59, 59, 999);

  if (cuando === "sin-fecha") {
    return { fechaEntregaComprometida: null };
  }
  if (cuando === "vencidos") {
    return { fechaEntregaComprometida: { lt: ahora } };
  }
  if (cuando === "hoy") {
    return { fechaEntregaComprometida: { gte: ahora, lte: finDeHoy } };
  }
  if (cuando === "semana") {
    const enUnaSemana = new Date(ahora);
    enUnaSemana.setDate(enUnaSemana.getDate() + 7);
    return { fechaEntregaComprometida: { gte: ahora, lte: enUnaSemana } };
  }
  return {};
}
