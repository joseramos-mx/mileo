"use client";

import { Plus } from "@phosphor-icons/react";
import type { Arcada, RolDeUnidad } from "@/generated/prisma/enums";
import { CamposDeLaUnidad } from "@/componentes/Odontograma";
import { Boton } from "@/componentes/Boton";
import { TRABAJOS, TODOS_LOS_ROLES } from "@/lib/trabajos";
import { ARCADAS_EN_PALABRAS } from "@/lib/vocabulario";
import type { UnidadDelCaso } from "@/lib/tramos";

/**
 * Los trabajos que van sobre una arcada entera.
 *
 * Una prótesis, una guarda oclusal y un modelo no se ponen en un diente: no
 * hay dónde tocar en el odontograma, así que se agregan aquí con su botón. Es
 * la razón por la que el catálogo trae "alcance": si todo se capturara con un
 * clic en un diente, una guarda acabaría colgada de un premolar cualquiera.
 */
export function TrabajosDeArcada({
  unidades,
  catalogoCompleto,
  alAgregar,
  alCambiar,
}: {
  unidades: UnidadDelCaso[];
  catalogoCompleto: boolean;
  alAgregar: (arcada: Arcada, rol: RolDeUnidad) => void;
  alCambiar: (unidades: UnidadDelCaso[]) => void;
}) {
  const deArcada = unidades.filter((u) => u.diente === null);

  const disponibles = TODOS_LOS_ROLES.filter((rol) => {
    const tipo = TRABAJOS[rol];
    if (tipo.alcance !== "ARCADA") return false;
    return catalogoCompleto || tipo.enListaCorta;
  });

  /** Lo que todavía se puede agregar: de cada tipo, uno por arcada. */
  const puestos = new Set(deArcada.map((u) => `${u.rol}-${u.arcada}`));

  return (
    <section
      aria-labelledby="de-arcada"
      className="flex flex-col gap-3 rounded-contenedor border border-borde bg-superficie p-4"
    >
      <div>
        <h3
          id="de-arcada"
          className="text-menor font-medium text-primario"
        >
          Trabajos de arcada completa
        </h3>
        <p className="text-minimo text-secundario">
          Una prótesis, una guarda o un modelo no van en un diente: van sobre la
          arcada entera.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["SUPERIOR", "INFERIOR"] as const).map((arcada) =>
          disponibles.map((rol) => {
            const yaEsta = puestos.has(`${rol}-${arcada}`);
            const tipo = TRABAJOS[rol];

            return (
              <Boton
                key={`${rol}-${arcada}`}
                type="button"
                tono="borde"
                disabled={yaEsta}
                onClick={() => alAgregar(arcada, rol)}
                /* El nombre que oye un lector de pantalla es la frase entera,
                   no las tres piezas sueltas del botón. */
                aria-label={
                  yaEsta
                    ? `${tipo.nombre} ya está en la ${ARCADAS_EN_PALABRAS[arcada].toLowerCase()}`
                    : `Agregar ${tipo.nombre.toLowerCase()} a la ${ARCADAS_EN_PALABRAS[arcada].toLowerCase()}`
                }
              >
                <Plus aria-hidden="true" size={14} weight="bold" />
                <span
                  aria-hidden="true"
                  style={{ backgroundColor: tipo.color }}
                  className="size-2.5 shrink-0 rounded-[3px]"
                />
                <span aria-hidden="true">
                  {tipo.nombre}
                  <span className="text-secundario">
                    {" "}
                    {arcada === "SUPERIOR" ? "arriba" : "abajo"}
                  </span>
                </span>
              </Boton>
            );
          }),
        )}
      </div>

      {deArcada.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {deArcada.map((unidad) => (
            <CamposDeLaUnidad
              key={`${unidad.rol}-${unidad.arcada}`}
              unidad={unidad}
              titulo={TRABAJOS[unidad.rol].nombre}
              debajo={
                unidad.arcada
                  ? ARCADAS_EN_PALABRAS[unidad.arcada]
                  : "Todo el caso"
              }
              alCambiar={(cambio) =>
                alCambiar(
                  unidades.map((u) =>
                    u.diente === null &&
                    u.rol === unidad.rol &&
                    u.arcada === unidad.arcada
                      ? { ...u, ...cambio }
                      : u,
                  ),
                )
              }
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
