"use client";

import { useRef, useState, type ReactNode } from "react";
import type { Arcada, RolDeUnidad } from "@/generated/prisma/enums";
import {
  CONTORNO_DE_ARCADA,
  NUMEROS_DIBUJADOS,
  PIEZAS_DEL_DIBUJO,
  VISTA_MANDIBULAS,
} from "@/lib/mandibulas-trazos";
import { CamposDeLaUnidad } from "@/componentes/Odontograma";
import { TRABAJOS, TODOS_LOS_ROLES } from "@/lib/trabajos";
import { ARCADAS_EN_PALABRAS } from "@/lib/vocabulario";
import { conDiente, type UnidadDelCaso } from "@/lib/tramos";
import { cn } from "@/lib/utilidades";

/**
 * Lo que va sobre una arcada entera: prótesis, guarda, modelo y la marca del
 * antagonista.
 *
 * Funciona igual que la pestaña de Dientes, a propósito: se toca la arcada en
 * el dibujo y al lado aparece qué se le puede poner. Antes eran dos secciones
 * con los mismos cinco botones repetidos, y había que leer el título para saber
 * en cuál se estaba parado.
 *
 * Se captura sobre el dibujo de maxilar y mandíbula que entregó diseño, no
 * sobre el odontograma: una guarda oclusal no se pone en un diente, y si se
 * capturara tocando uno acabaría colgada de un premolar cualquiera.
 *
 * Los dientes que ya llevan trabajo se pintan en gris. No es decoración: son
 * los que el doctor ya resolvió en la otra pestaña, y verlos aquí evita que
 * pida una prótesis total sobre una arcada donde acaba de pedir cuatro coronas.
 */
/**
 * El grosor del trazo, en unidades del dibujo. Diseño lo entregó en 2; a 1 se
 * ve más fino sin perder el contorno, que es lo que separa un diente del de
 * al lado.
 */
const TRAZO = 1;

export function VistaDeArcadas({
  unidades,
  abierta,
  alAbrir,
  catalogoCompleto,
  alAgregar,
  alQuitar,
  detalle,
}: {
  unidades: UnidadDelCaso[];
  /**
   * La arcada abierta. La manda quien usa la vista porque sus campos se pintan
   * afuera, en la tercera columna, igual que el detalle del diente.
   */
  abierta: Arcada | null;
  alAbrir: (arcada: Arcada | null) => void;
  catalogoCompleto: boolean;
  alAgregar: (arcada: Arcada, rol: RolDeUnidad) => void;
  alQuitar: (unidad: UnidadDelCaso) => void;
  /**
   * Los campos de lo que lleva la arcada, cuando la pantalla no da para
   * ponerlos en su propia columna. Van al principio del catálogo.
   */
  detalle?: ReactNode;
}) {
  const [enfocada, setEnfocada] = useState<Arcada>("SUPERIOR");
  const enPantalla = useRef(new Map<Arcada, SVGGElement>());

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

  const trabajosDe = (arcada: Arcada) =>
    deArcada.filter((u) => u.arcada === arcada);

  function mover(arcada: Arcada) {
    setEnfocada(arcada);
    requestAnimationFrame(() => enPantalla.current.get(arcada)?.focus());
  }

  return (
    <div
      className={cn(
        "siempre-claro grid gap-4 rounded-contenedor bg-diente-lienzo p-4",
        // Las mismas medidas que el odontograma, para que las dos pestañas se
        // vean iguales.
        "lg:grid-cols-[minmax(0,1fr)_22rem]",
        "xl:grid-cols-[minmax(0,1fr)_26rem] 2xl:grid-cols-[minmax(0,1fr)_30rem]",
      )}
    >
      {/* ------------------------------------------------------- el dibujo */}
      <div className="flex min-w-0 flex-col gap-3">
        <svg
          viewBox={VISTA_MANDIBULAS}
          role="group"
          aria-label="Maxilar y mandíbula. Toque una arcada para ver qué se le puede poner."
          className="mx-auto h-auto w-full max-w-[34rem]"
        >
          {(["SUPERIOR", "INFERIOR"] as const).map((arcada) => {
            const suyas = PIEZAS_DEL_DIBUJO.filter((p) => p.arcada === arcada);
            const trabajos = trabajosDe(arcada);
            const puesta = abierta === arcada;

            const comoEsta =
              trabajos.length === 0
                ? "sin nada todavía"
                : trabajos
                    .map((u) => TRABAJOS[u.rol].nombre.toLowerCase())
                    .join(", ");

            return (
              <g
                key={arcada}
                ref={(nodo) => {
                  if (nodo) enPantalla.current.set(arcada, nodo);
                  else enPantalla.current.delete(arcada);
                }}
                data-arcada={arcada}
                role="button"
                tabIndex={enfocada === arcada ? 0 : -1}
                aria-pressed={puesta}
                aria-label={`${ARCADAS_EN_PALABRAS[arcada]}: ${comoEsta}.`}
                onClick={() => {
                  alAbrir(arcada);
                  setEnfocada(arcada);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    alAbrir(arcada);
                    return;
                  }
                  if (e.key === "ArrowDown" || e.key === "ArrowRight") {
                    e.preventDefault();
                    mover("INFERIOR");
                  }
                  if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
                    e.preventDefault();
                    mover("SUPERIOR");
                  }
                }}
                className="cursor-pointer"
              >
                {/* En el orden del archivo dentro de cada arcada: el dibujo
                    trae una encía después de seis dientes y los tapa a
                    propósito. Agrupar por arcada no lo rompe, porque el
                    maxilar y la mandíbula no se encinan entre sí. */}
                {suyas.map((pieza, i) => {
                  const ocupado =
                    pieza.numero !== null && conTrabajo.has(pieza.numero);

                  return (
                    <path
                      key={pieza.numero ?? `encia-${i}`}
                      data-diente={pieza.numero ?? undefined}
                      data-ocupado={ocupado ? "si" : undefined}
                      d={pieza.d}
                      // El gris oscuro dice "aquí ya hay trabajo", y no va
                      // solo: está escrito en el aria-label y en la leyenda.
                      fill={
                        ocupado
                          ? "var(--diente-ocupado)"
                          : puesta
                            ? "var(--diente-pontico)"
                            : "var(--mandibula-relleno)"
                      }
                      stroke="var(--diente-contorno)"
                      strokeWidth={TRAZO}
                    />
                  );
                })}

                {/* El contorno de la arcada abierta, con el trazo que entregó
                    diseño aparte. Repasar el de la encía dibujaba un garabato:
                    trae los huecos de cada diente. Refuerza nada más: lo que
                    dice cuál está abierta es su panel al lado. */}
                {puesta ? (
                  <path
                    d={CONTORNO_DE_ARCADA[arcada]}
                    fill="none"
                    strokeWidth={TRAZO * 1.5}
                    strokeLinejoin="round"
                    className="stroke-diente-anillo"
                  />
                ) : null}
              </g>
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

      {/* --------------------------------------- el catálogo de la arcada */}
      <CatalogoDeLaArcada
        arcada={abierta}
        trabajos={abierta ? trabajosDe(abierta) : []}
        disponibles={disponibles}
        alAgregar={alAgregar}
        alQuitar={alQuitar}
        detalle={detalle}
      />
    </div>
  );
}

/**
 * Qué se le puede poner a la arcada abierta.
 *
 * Es el gemelo del catálogo del diente: pastillas con el color de cada tipo,
 * pegadas al dibujo, porque es lo que se escoge mirándolo. Los campos de lo que
 * ya está puesto viven en la tercera columna, igual que allá.
 *
 * La diferencia es que una arcada puede llevar varias cosas a la vez —una
 * guarda y un modelo—, así que las pastillas encienden y apagan en vez de
 * escoger una sola.
 */
function CatalogoDeLaArcada({
  arcada,
  trabajos,
  disponibles,
  alAgregar,
  alQuitar,
  detalle,
}: {
  arcada: Arcada | null;
  trabajos: UnidadDelCaso[];
  disponibles: RolDeUnidad[];
  alAgregar: (arcada: Arcada, rol: RolDeUnidad) => void;
  alQuitar: (unidad: UnidadDelCaso) => void;
  detalle?: ReactNode;
}) {
  if (!arcada) {
    return (
      <aside className="rounded-tarjeta bg-superficie p-4 text-menor text-secundario">
        <p>
          Toque una arcada en el dibujo. Aquí le pregunto qué se le va a poner:
          una prótesis, una guarda, un modelo, o si es la arcada que escaneó de
          antagonista.
        </p>
      </aside>
    );
  }

  const puestos = new Map(trabajos.map((u) => [u.rol, u]));

  return (
    <aside
      aria-label={`Qué se le va a poner a la ${ARCADAS_EN_PALABRAS[arcada].toLowerCase()}`}
      className="flex flex-col gap-4 rounded-tarjeta bg-superficie p-4"
    >
      <div>
        <h3 className="text-subtitulo font-semibold text-primario">
          {ARCADAS_EN_PALABRAS[arcada]}
        </h3>
        <p className="text-minimo text-secundario">
          Lo que va sobre la arcada entera, no sobre un diente.
        </p>
      </div>

      {detalle}

      <div className="flex flex-wrap gap-1.5">
        {disponibles.map((rol) => {
          const tipo = TRABAJOS[rol];
          const puesta = puestos.get(rol);

          return (
            <button
              key={rol}
              type="button"
              data-trabajo={rol}
              aria-pressed={Boolean(puesta)}
              onClick={() =>
                puesta ? alQuitar(puesta) : alAgregar(arcada, rol)
              }
              style={
                puesta
                  ? { backgroundColor: tipo.color, color: tipo.colorDelTexto }
                  : { borderColor: tipo.color }
              }
              className={cn(
                "alto-tactil inline-flex items-center gap-2 rounded-control px-3 py-1.5",
                "text-left text-minimo font-medium transition-colors duration-150",
                puesta
                  ? "border border-transparent"
                  : "border bg-superficie text-primario",
              )}
            >
              {/* Sin poner, el color va en el borde y en el cuadrito, nunca en
                  la letra: varios de los del catálogo no alcanzan 4.5:1 como
                  texto sobre blanco, y el nombre tiene que leerse (§7). */}
              {puesta ? null : (
                <span
                  aria-hidden="true"
                  style={{ backgroundColor: tipo.color }}
                  className={cn(
                    "size-2.5 shrink-0 rounded-[3px]",
                    tipo.esAnotacion && "border border-dashed bg-transparent!",
                  )}
                />
              )}
              {tipo.nombre}
            </button>
          );
        })}
      </div>

      {trabajos.length === 0 ? (
        <p className="text-minimo text-secundario">
          Nada todavía en esta arcada. Toque lo que necesite.
        </p>
      ) : null}
    </aside>
  );
}

/**
 * Los campos de todo lo que lleva la arcada abierta.
 *
 * Va en la tercera columna, como el detalle del diente: material, método y lo
 * que cada tipo pregunte de más son obligatorios, y al final del catálogo
 * quedaban abajo del pliegue.
 */
export function CamposDeLaArcada({
  arcada,
  unidades,
  alCambiar,
  alQuitar,
}: {
  arcada: Arcada | null;
  unidades: UnidadDelCaso[];
  alCambiar: (unidades: UnidadDelCaso[]) => void;
  alQuitar: (unidad: UnidadDelCaso) => void;
}) {
  if (!arcada) return null;
  const trabajos = unidades.filter(
    (u) => u.diente === null && u.arcada === arcada,
  );
  if (trabajos.length === 0) return null;

  return (
    <>
      {trabajos.map((unidad) => (
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
    </>
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
    { relleno: "var(--diente-pontico)", texto: "La arcada abierta" },
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
