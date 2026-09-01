import type { Etapa } from "@/generated/prisma/enums";
import { ETAPAS, ETAPAS_DEL_DOCTOR } from "@/lib/vocabulario";
import { cn } from "@/lib/utilidades";

/**
 * Por dónde va el caso (SKILL.md O-3).
 *
 * Se enseñan sólo las etapas que el doctor entiende. Todo el detalle interno
 * —anidado, fresado, sinterizado— se colapsa en "En fabricación": exponer las
 * etapas internas de manufactura al doctor es un antipatrón (§11).
 */
export function LineaDeTiempo({ etapaActual }: { etapaActual: Etapa }) {
  const esExcepcion = etapaActual === "EN_PAUSA" || etapaActual === "REHACER";
  const posicionActual = ETAPAS_DEL_DOCTOR.indexOf(etapaActual);

  return (
    <section aria-labelledby="por-donde-va" className="flex flex-col gap-3">
      <h2
        id="por-donde-va"
        className="text-subtitulo font-semibold text-primario"
      >
        Por dónde va
      </h2>

      {esExcepcion ? (
        <p className="rounded-control border border-pendiente/40 bg-pendiente-fondo px-3 py-2 text-menor text-pendiente-texto">
          {ETAPAS[etapaActual].paraElDoctor}
        </p>
      ) : null}

      <ol className="flex flex-col">
        {ETAPAS_DEL_DOCTOR.map((etapa, posicion) => {
          const pasada = posicionActual > posicion;
          const actual = posicionActual === posicion;

          return (
            <li key={etapa} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-1.5 size-2.5 shrink-0 rounded-full border",
                    actual && "border-transparent bg-accion",
                    pasada && "border-transparent bg-terminado",
                    !actual && !pasada && "border-borde bg-superficie",
                  )}
                />
                {posicion < ETAPAS_DEL_DOCTOR.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "w-px flex-1",
                      pasada ? "bg-terminado" : "bg-borde",
                    )}
                  />
                ) : null}
              </div>

              <p
                className={cn(
                  "pb-4 text-cuerpo",
                  actual ? "font-medium text-primario" : "text-secundario",
                )}
              >
                {ETAPAS[etapa].nombre}
                {actual ? (
                  <span className="text-menor font-normal text-secundario">
                    {" "}
                    · aquí va ahora
                  </span>
                ) : null}
                {pasada ? <span className="sr-only"> · ya pasó</span> : null}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
