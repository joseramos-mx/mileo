"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Etapa, Prioridad } from "@/generated/prisma/enums";
import { ETAPAS, ETAPAS_DEL_DOCTOR, PRIORIDADES } from "@/lib/vocabulario";
import { fechaCorta, cuandoFalta } from "@/lib/fechas";
import { cn } from "@/lib/utilidades";
import { cambiarEtapa } from "@/app/(dentro)/casos/[id]/acciones";
import { ejecutar } from "@/lib/acciones-cliente";

export type CasoEnTablero = {
  id: string;
  folio: string;
  etapa: Etapa;
  prioridad: Prioridad;
  enRiesgo: boolean;
  fechaEntregaComprometida: string | null;
  doctor: string;
  tecnico: string | null;
  paciente: string;
  resumenDeUnidades: string;
  tieneAprobacion: boolean;
  tieneCalidad: boolean;
};

const COLUMNAS: Etapa[] = [
  ...ETAPAS_DEL_DOCTOR.filter((e) => e !== "ENTREGADO"),
  "EN_PAUSA",
  "REHACER",
];

/**
 * Tablero de producción (SKILL.md O-5).
 *
 * Se arrastra con el ratón y también se mueve con el teclado: cada tarjeta
 * lleva una lista de destinos, porque un tablero que sólo funciona arrastrando
 * deja fuera a quien no usa ratón (§7).
 */
export function Tablero({ casos }: { casos: CasoEnTablero[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [columnaActiva, setColumnaActiva] = useState<Etapa | null>(null);
  const [, empezar] = useTransition();

  function mover(casoId: string, destino: Etapa) {
    empezar(async () => {
      const resultado = await ejecutar(() => cambiarEtapa(casoId, destino));
      if (resultado.error) setError(resultado.error);
      else {
        setError(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p
        role="alert"
        aria-live="polite"
        className={
          error
            ? "rounded-control border border-pendiente/40 bg-pendiente-fondo px-3 py-2 text-menor text-pendiente-texto"
            : "sr-only"
        }
      >
        {error ?? ""}
      </p>

      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3">
          {COLUMNAS.map((columna) => {
            const enColumna = casos.filter((c) => c.etapa === columna);
            return (
              <section
                key={columna}
                aria-label={`${ETAPAS[columna].nombre}, ${enColumna.length} casos`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setColumnaActiva(columna);
                }}
                onDragLeave={() => setColumnaActiva(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setColumnaActiva(null);
                  if (arrastrando) mover(arrastrando, columna);
                  setArrastrando(null);
                }}
                className={cn(
                  "flex w-72 shrink-0 flex-col gap-2 rounded-contenedor border p-3",
                  columnaActiva === columna
                    ? "border-accion bg-superficie-suave"
                    : "border-borde bg-superficie-suave",
                )}
              >
                <h2 className="text-menor font-semibold text-primario">
                  {ETAPAS[columna].nombre}
                  <span className="font-normal text-secundario">
                    {" "}
                    · {enColumna.length}
                  </span>
                </h2>

                {enColumna.length === 0 ? (
                  <p className="text-minimo text-secundario">Sin casos aquí.</p>
                ) : null}

                {enColumna.map((caso) => (
                  <TarjetaDelTablero
                    key={caso.id}
                    caso={caso}
                    alEmpezarArrastre={() => setArrastrando(caso.id)}
                    alMover={(destino) => mover(caso.id, destino)}
                  />
                ))}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TarjetaDelTablero({
  caso,
  alEmpezarArrastre,
  alMover,
}: {
  caso: CasoEnTablero;
  alEmpezarArrastre: () => void;
  alMover: (destino: Etapa) => void;
}) {
  const fecha = caso.fechaEntregaComprometida
    ? new Date(caso.fechaEntregaComprometida)
    : null;

  return (
    <article
      draggable
      onDragStart={alEmpezarArrastre}
      className={cn(
        "rounded-tarjeta border bg-superficie p-3",
        caso.enRiesgo ? "border-pendiente/50" : "border-borde",
      )}
    >
      <Link
        href={`/casos/${caso.id}`}
        className="block text-cuerpo font-medium text-primario"
      >
        {caso.paciente}
      </Link>
      <p className="mt-0.5 text-minimo text-secundario">
        {caso.folio} · {caso.doctor}
      </p>
      <p className="mt-1 text-minimo text-secundario">{caso.resumenDeUnidades}</p>

      <p className="mt-2 text-minimo text-secundario">
        {fecha ? (
          <>
            {fechaCorta(fecha)} · {cuandoFalta(fecha)}
          </>
        ) : (
          "Sin fecha hasta aceptarlo"
        )}
        {caso.prioridad !== "NORMAL"
          ? ` · prioridad ${PRIORIDADES[caso.prioridad].toLowerCase()}`
          : ""}
      </p>

      {caso.enRiesgo ? (
        <p className="mt-1 text-minimo font-medium text-pendiente-texto">
          Requiere atención
        </p>
      ) : null}

      {/* La salida por teclado: mismo movimiento, sin arrastrar. */}
      <label className="mt-2 block">
        <span className="sr-only">
          Mover el caso {caso.folio} a otra etapa
        </span>
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) alMover(e.target.value as Etapa);
          }}
          className="area-tactil w-full rounded-control border border-borde bg-superficie px-2 text-minimo text-secundario"
        >
          <option value="">Mover a…</option>
          {COLUMNAS.filter(
            (destino) =>
              destino !== caso.etapa &&
              // Los dos bloqueos duros tambien se ven aqui: sin aprobacion no
              // se fabrica (O-4) y sin control de calidad no se manda (O-6).
              (destino !== "EN_FABRICACION" || caso.tieneAprobacion) &&
              (destino !== "LISTO_Y_EN_CAMINO" || caso.tieneCalidad),
          ).map((destino) => (
            <option key={destino} value={destino}>
              {ETAPAS[destino].nombre}
            </option>
          ))}
          <option value="ENTREGADO">{ETAPAS.ENTREGADO.nombre}</option>
        </select>
      </label>
    </article>
  );
}
