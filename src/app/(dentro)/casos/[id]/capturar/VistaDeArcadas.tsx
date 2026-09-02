"use client";

import { Plus } from "@phosphor-icons/react";
import type { Arcada, RolDeUnidad } from "@/generated/prisma/enums";
import {
  DIENTES_DIBUJADOS,
  ENCIA_INFERIOR,
  ENCIA_SUPERIOR,
  NUMEROS_DIBUJADOS,
  VISTA_MANDIBULAS,
} from "@/lib/mandibulas-trazos";
import { CamposDeLaUnidad } from "@/componentes/Odontograma";
import { Boton } from "@/componentes/Boton";
import { TRABAJOS, TODOS_LOS_ROLES } from "@/lib/trabajos";
import { ARCADAS_EN_PALABRAS } from "@/lib/vocabulario";
import { conDiente, type UnidadDelCaso } from "@/lib/tramos";
import { cn } from "@/lib/utilidades";

/**
 * Lo que va sobre una arcada entera: prótesis, guarda, modelo y la marca del
 * antagonista.
 *
 * Se captura sobre el dibujo de maxilar y mandíbula que entregó diseño, no
 * sobre el odontograma: una guarda oclusal no se pone en un diente, y si se
 * capturara tocando uno acabaría colgada de un premolar cualquiera.
 *
 * Los dientes que ya llevan trabajo se pintan en gris. No es decoración: son
 * los que el doctor ya resolvió en la otra pestaña, y verlos aquí evita que
 * pida una prótesis total sobre una arcada donde acaba de pedir cuatro coronas.
 */
export function VistaDeArcadas({
  unidades,
  catalogoCompleto,
  alAgregar,
  alCambiar,
  alQuitar,
}: {
  unidades: UnidadDelCaso[];
  catalogoCompleto: boolean;
  alAgregar: (arcada: Arcada, rol: RolDeUnidad) => void;
  alCambiar: (unidades: UnidadDelCaso[]) => void;
  alQuitar: (unidad: UnidadDelCaso) => void;
}) {
  const deArcada = unidades.filter((u) => u.diente === null);
  const conTrabajo = new Set(conDiente(unidades).map((u) => u.diente));

  // De frente no se ven los terceros molares, así que lo que se capture en un
  // 18, 28, 38 o 48 no tiene dónde pintarse aquí. Se dice con palabras en vez
  // de esconderlo.
  const fueraDelDibujo = [...conTrabajo]
    .filter((d) => !NUMEROS_DIBUJADOS.has(d))
    .sort((a, b) => a - b);

  const disponibles = TODOS_LOS_ROLES.filter((rol) => {
    const tipo = TRABAJOS[rol];
    if (tipo.alcance !== "ARCADA") return false;
    return catalogoCompleto || tipo.enListaCorta;
  });

  const puestos = new Set(deArcada.map((u) => `${u.rol}-${u.arcada}`));

  /** Qué trabajos de arcada tiene ya cada arcada, para pintarla. */
  const trabajosDe = (arcada: Arcada) =>
    deArcada.filter((u) => u.arcada === arcada);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] xl:items-start">
      {/* ------------------------------------------------------- el dibujo */}
      <div className="siempre-claro flex flex-col gap-3 rounded-contenedor bg-diente-lienzo p-4">
        <svg
          viewBox={VISTA_MANDIBULAS}
          role="img"
          aria-label={
            conTrabajo.size === 0
              ? "Maxilar y mandíbula, sin trabajo todavía."
              : `Maxilar y mandíbula. En gris, los ${conTrabajo.size} dientes que ya llevan trabajo: ${[...conTrabajo].sort((a, b) => a - b).join(", ")}.`
          }
          className="h-auto w-full"
        >
          {/* La encía primero, que los dientes van encima. Va con el gris
              del dibujo entregado, no en blanco: en el diseño la encía y los
              dientes son del mismo gris y sólo los separa el contorno. */}
          {[...ENCIA_SUPERIOR, ...ENCIA_INFERIOR].map((d, i) => (
            <path
              key={`encia-${i}`}
              d={d}
              fill="var(--mandibula-relleno)"
              stroke="var(--diente-contorno)"
              strokeWidth={2}
            />
          ))}

          {DIENTES_DIBUJADOS.map((diente) => {
            const ocupado = conTrabajo.has(diente.numero);

            return (
              <path
                key={diente.numero}
                data-diente={diente.numero}
                data-ocupado={ocupado ? "si" : undefined}
                d={diente.d}
                // El diente sin nada va del gris del dibujo, como lo entregó
                // diseño. El gris oscuro dice "aquí ya hay trabajo", y no va
                // solo: está escrito en el aria-label y en la leyenda de al
                // lado.
                fill={
                  ocupado
                    ? "var(--diente-ocupado)"
                    : "var(--mandibula-relleno)"
                }
                stroke="var(--diente-contorno)"
                strokeWidth={2}
              />
            );
          })}
        </svg>

        <Leyenda hayOcupados={conTrabajo.size > 0} />

        {fueraDelDibujo.length > 0 ? (
          <p className="text-minimo text-secundario">
            De frente no se ven las muelas del juicio, así que{" "}
            {fueraDelDibujo.length === 1 ? "el diente" : "los dientes"}{" "}
            {fueraDelDibujo.join(", ")} no{" "}
            {fueraDelDibujo.length === 1 ? "sale" : "salen"} en el dibujo, pero{" "}
            {fueraDelDibujo.length === 1 ? "sigue" : "siguen"} en el caso.
          </p>
        ) : null}
      </div>

      {/* --------------------------------------------------- los trabajos */}
      <div className="flex flex-col gap-4">
        {(["SUPERIOR", "INFERIOR"] as const).map((arcada) => (
          <section
            key={arcada}
            aria-label={ARCADAS_EN_PALABRAS[arcada]}
            className="flex flex-col gap-3 rounded-contenedor border border-borde bg-superficie p-4"
          >
            <h3 className="text-menor font-medium text-primario">
              {ARCADAS_EN_PALABRAS[arcada]}
            </h3>

            <div className="flex flex-wrap gap-2">
              {disponibles.map((rol) => {
                const yaEsta = puestos.has(`${rol}-${arcada}`);
                const tipo = TRABAJOS[rol];

                return (
                  <Boton
                    key={rol}
                    type="button"
                    tono="borde"
                    disabled={yaEsta}
                    onClick={() => alAgregar(arcada, rol)}
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
                      className={cn(
                        "size-2.5 shrink-0 rounded-[3px]",
                        tipo.esAnotacion && "border border-dashed bg-transparent!",
                      )}
                    />
                    <span aria-hidden="true">{tipo.nombre}</span>
                  </Boton>
                );
              })}
            </div>

            {trabajosDe(arcada).length > 0 ? (
              <div className="grid gap-3 2xl:grid-cols-2">
                {trabajosDe(arcada).map((unidad) => (
                  <CamposDeLaUnidad
                    key={unidad.rol}
                    unidad={unidad}
                    titulo={TRABAJOS[unidad.rol].nombre}
                    debajo={ARCADAS_EN_PALABRAS[arcada]}
                    alQuitar={() => alQuitar(unidad)}
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
            ) : (
              <p className="text-minimo text-secundario">
                Nada todavía en esta arcada.
              </p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

/** Qué quiere decir cada relleno, escrito. El color nunca va solo (§7). */
function Leyenda({ hayOcupados }: { hayOcupados: boolean }) {
  const renglones = [
    { relleno: "var(--mandibula-relleno)", texto: "Sin trabajo" },
    ...(hayOcupados
      ? [
          {
            relleno: "var(--diente-ocupado)",
            texto: "Ya tiene trabajo, capturado en Dientes",
          },
        ]
      : []),
  ];

  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-minimo text-secundario">
      {renglones.map((renglon) => (
        <li key={renglon.texto} className="flex items-center gap-1.5">
          <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3 shrink-0">
            <rect
              x="1"
              y="1"
              width="10"
              height="10"
              rx="3"
              strokeWidth="1.5"
              fill={renglon.relleno}
              stroke="var(--diente-contorno)"
            />
          </svg>
          {renglon.texto}
        </li>
      ))}
    </ul>
  );
}
