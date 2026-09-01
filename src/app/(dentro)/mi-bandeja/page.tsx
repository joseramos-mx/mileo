import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { exigirLaboratorio } from "@/lib/autorizacion";
import { paraTarjeta, seleccionDeTarjeta } from "@/lib/casos";
import { TarjetaDeCaso } from "@/componentes/TarjetaDeCaso";
import { REJILLA_DE_CASOS } from "@/componentes/RejillaDeCasos";
import { EstadoVacio } from "@/componentes/EstadoVacio";
import { BotonEnlace } from "@/componentes/Boton";
import { TerminarEtapa } from "./TerminarEtapa";
import type { Etapa, Rol } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Mi bandeja · Mileo" };

/** Qué etapa le toca a cada rol del laboratorio (SKILL.md O-5). */
const ETAPA_DE_CADA_ROL: Partial<Record<Rol, Etapa[]>> = {
  ADMISION: ["RECIBIDO", "EN_REVISION"],
  DISENO: ["ACEPTADO", "EN_DISENO"],
  MANUFACTURA: ["EN_FABRICACION"],
  ACABADO: ["EN_FABRICACION"],
  CALIDAD: ["EN_CONTROL_DE_CALIDAD"],
  DIRECCION: [
    "RECIBIDO",
    "EN_REVISION",
    "ACEPTADO",
    "EN_DISENO",
    "EN_FABRICACION",
    "EN_CONTROL_DE_CALIDAD",
    "LISTO_Y_EN_CAMINO",
  ],
};

/**
 * Mi bandeja (SKILL.md O-5).
 *
 * Lo del día de cada quien, ordenado por urgencia, con un solo botón para
 * terminar la etapa. Nada más: quien está en el taller no viene a navegar.
 */
export default async function PaginaDeMiBandeja() {
  const usuario = await exigirLaboratorio();
  const etapas = ETAPA_DE_CADA_ROL[usuario.rol] ?? [];

  const casos = await prisma.caso.findMany({
    where: { esBorrador: false, etapa: { in: etapas } },
    select: {
      ...seleccionDeTarjeta,
      doctor: { select: { nombreCompleto: true } },
      aprobaciones: { select: { decision: true } },
    },
    orderBy: [{ enRiesgo: "desc" }, { fechaEntregaComprometida: "asc" }],
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-titulo font-semibold text-primario">Mi bandeja</h1>
        <p className="mt-1 text-menor text-secundario">
          Lo que le toca hoy, lo más urgente arriba.
        </p>
      </header>

      {casos.length === 0 ? (
        <EstadoVacio
          titulo="Su bandeja está vacía"
          explicacion="No hay casos esperándolo en su etapa. Cuando llegue uno, aparece aquí."
          accion={
            <BotonEnlace href="/tablero" tono="principal">
              Ver el tablero
            </BotonEnlace>
          }
        />
      ) : (
        <ul className={REJILLA_DE_CASOS}>
          {casos.map((caso) => (
            <li key={caso.id} className="flex flex-col gap-2">
              <p className="text-minimo text-secundario">
                {caso.folio} · {caso.doctor.nombreCompleto}
              </p>
              <TarjetaDeCaso caso={paraTarjeta(caso)} />
              <div className="w-full max-w-[23.75rem]">
                <TerminarEtapa
                  casoId={caso.id}
                  etapa={caso.etapa}
                  tieneAprobacion={caso.aprobaciones.some(
                    (a) => a.decision === "APROBADO",
                  )}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
