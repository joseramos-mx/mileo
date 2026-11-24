"use client";

import { useState } from "react";
import type { Arcada } from "@/generated/prisma/enums";
import {
  ENLACES,
  TRAZOS,
  VISTA_COMPLETA,
  VISTA_INFERIOR,
  VISTA_SUPERIOR,
} from "@/lib/odontograma-trazos";
import {
  CONTORNO_DE_ARCADA,
  NUMEROS_DIBUJADOS,
  PIEZAS_DEL_DIBUJO,
  VISTA_MANDIBULAS,
} from "@/lib/mandibulas-trazos";
import {
  conDiente,
  esSuperior,
  estanUnidos,
  nombreDelTramo,
  ordenarPorBoca,
  tramoDe,
  type UnidadDelCaso,
} from "@/lib/tramos";
import {
  ARCADAS_EN_PALABRAS,
  MATERIALES,
  METODOS,
  METODOS_POR_MATERIAL,
  RETENCIONES,
  ROLES_DE_UNIDAD,
  nombreDelColor,
  nombreDelDiente,
} from "@/lib/vocabulario";
import { TRABAJOS, esPontico, pregunta, puedeSerPilar, tinte } from "@/lib/trabajos";
import { Pestanas } from "@/componentes/Pestanas";
import { usePantallaAngosta } from "@/lib/pantalla";
import { cn } from "@/lib/utilidades";

const TAMANO_DEL_NUMERO = 11;
const TRAZO_MANDIBULA = 1;

/**
 * Vista interactiva de solo lectura para "Lo que estamos haciendo" en la vista
 * de laboratorio (`/casos/[id]`).
 *
 * Muestra el odontograma (y las arcadas cuando el caso incluye trabajos de
 * arcada) con las piezas trabajadas coloreadas. Al hacer clic en un diente con
 * trabajo (o en una arcada trabajada), muestra al lado únicamente la
 * información aplicable a esa unidad sin controles de edición ni campos vacíos.
 */
export function ResumenInteractivoDeUnidades({
  unidades: unidadesOriginales,
}: {
  unidades: UnidadDelCaso[];
}) {
  const unidades = ordenarPorBoca(unidadesOriginales);
  const unidadesConDiente = conDiente(unidades);
  const unidadesDeArcada = unidades.filter((u) => u.diente === null);

  const primerDiente = unidadesConDiente[0]?.diente ?? null;
  const primeraArcada: Arcada | null =
    unidadesDeArcada.find((u) => u.arcada !== null)?.arcada ?? null;

  const [pestana, setPestana] = useState<string>(
    unidadesConDiente.length > 0 || unidadesDeArcada.length === 0
      ? "dientes"
      : "arcadas",
  );
  const [dienteSeleccionado, setDienteSeleccionado] = useState<number | null>(
    primerDiente,
  );
  const [arcadaSeleccionada, setArcadaSeleccionada] = useState<Arcada | null>(
    primeraArcada,
  );
  const [arcadaVisibleMovil, setArcadaVisibleMovil] = useState<
    "superior" | "inferior"
  >(
    primerDiente !== null && !esSuperior(primerDiente)
      ? "inferior"
      : "superior",
  );

  const angosta = usePantallaAngosta();
  const porDiente = new Map(unidadesConDiente.map((u) => [u.diente, u]));

  const vistaOdontograma = !angosta
    ? VISTA_COMPLETA
    : arcadaVisibleMovil === "superior"
      ? VISTA_SUPERIOR
      : VISTA_INFERIOR;

  const arribaVisible = arcadaVisibleMovil === "superior";
  const trazosVisibles = !angosta
    ? TRAZOS
    : TRAZOS.filter((t) => esSuperior(t.numero) === arribaVisible);
  const enlacesVisibles = !angosta
    ? ENLACES
    : ENLACES.filter((e) => esSuperior(e.a) === arribaVisible);

  const unidadDienteActiva =
    dienteSeleccionado !== null
      ? (porDiente.get(dienteSeleccionado) ?? null)
      : null;

  const unidadesArcadaActivas =
    arcadaSeleccionada !== null
      ? unidadesDeArcada.filter((u) => u.arcada === arcadaSeleccionada)
      : unidadesDeArcada;

  const mostrarPestanas =
    unidadesConDiente.length > 0 && unidadesDeArcada.length > 0;

  const panelDientes = (
    <div className="grid gap-4 rounded-contenedor bg-diente-lienzo p-4 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_25rem]">
      {/* Dibujo del odontograma */}
      <div className="flex min-w-0 flex-col gap-3">
        {angosta ? (
          <div
            role="group"
            aria-label="Qué arcada se ve"
            className="flex gap-1 rounded-control bg-superficie p-1"
          >
            {(["superior", "inferior"] as const).map((cual) => (
              <button
                key={cual}
                type="button"
                aria-pressed={arcadaVisibleMovil === cual}
                onClick={() => setArcadaVisibleMovil(cual)}
                className={cn(
                  "alto-tactil flex-1 rounded-control px-3 text-menor font-medium",
                  arcadaVisibleMovil === cual
                    ? "bg-accion text-sobre-accion"
                    : "text-secundario hover:bg-superficie-suave",
                )}
              >
                Arcada {cual}
              </button>
            ))}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <svg
            viewBox={vistaOdontograma}
            role="group"
            aria-label="Odontograma del caso. Seleccione un diente con trabajo para consultar su información."
            className={cn(
              "h-auto w-full min-w-[34rem]",
              "lg:mx-auto lg:block lg:h-[min(58vh,34rem)] lg:w-auto lg:max-w-full lg:min-w-0",
            )}
          >
            {/* Uniones y riel de puentes (solo lectura) */}
            <g aria-hidden="true">
              {enlacesVisibles.map((enlace) => {
                const unido = estanUnidos(unidades, enlace.a, enlace.b);
                return (
                  <line
                    key={`${enlace.a}-${enlace.b}`}
                    x1={enlace.x1}
                    y1={enlace.y1}
                    x2={enlace.x2}
                    y2={enlace.y2}
                    strokeWidth={unido ? 10 : 8}
                    strokeLinecap="round"
                    className={
                      unido ? "stroke-diente-puente" : "stroke-diente-contorno"
                    }
                  />
                );
              })}

              {trazosVisibles.map((trazo) => (
                <circle
                  key={trazo.numero}
                  cx={trazo.nodo.x}
                  cy={trazo.nodo.y}
                  r={trazo.nodo.r}
                  strokeWidth={1}
                  className={cn(
                    "pointer-events-none stroke-diente-contorno",
                    porDiente.get(trazo.numero)?.tramoId
                      ? "fill-diente-puente stroke-diente-puente"
                      : "fill-diente-cuerpo",
                  )}
                />
              ))}
            </g>

            {/* Dientes */}
            <g role="group" aria-label="Dientes">
              {trazosVisibles.map((trazo) => {
                const unidad = porDiente.get(trazo.numero) ?? null;
                const tipo = unidad ? TRABAJOS[unidad.rol] : null;
                const esAnotacion = Boolean(tipo?.esAnotacion);
                const seleccionado = dienteSeleccionado === trazo.numero;
                const tieneTrabajo = unidad !== null;

                const descripcionAria = !unidad
                  ? "sin trabajo"
                  : [
                      TRABAJOS[unidad.rol].nombre.toLowerCase(),
                      esAnotacion ? "(anotación, no se fabrica)" : "",
                      unidad.material
                        ? `de ${MATERIALES[unidad.material].toLowerCase()}`
                        : "",
                      unidad.color
                        ? `color ${nombreDelColor(unidad.color)}`
                        : "",
                      unidad.esImplante ? "sobre implante" : "",
                    ]
                      .filter(Boolean)
                      .join(" ");

                return (
                  <g
                    key={trazo.numero}
                    data-diente={trazo.numero}
                    data-rol={unidad?.rol ?? ""}
                    role={tieneTrabajo ? "button" : undefined}
                    tabIndex={tieneTrabajo ? 0 : -1}
                    aria-pressed={tieneTrabajo ? seleccionado : undefined}
                    aria-label={`Diente ${trazo.numero}, ${nombreDelDiente(trazo.numero)}: ${descripcionAria}.`}
                    onClick={() => {
                      if (tieneTrabajo) {
                        setDienteSeleccionado(trazo.numero);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (
                        tieneTrabajo &&
                        (e.key === "Enter" || e.key === " ")
                      ) {
                        e.preventDefault();
                        setDienteSeleccionado(trazo.numero);
                      }
                    }}
                    className={
                      tieneTrabajo ? "cursor-pointer" : "cursor-default"
                    }
                  >
                    <path
                      d={trazo.cuerpo}
                      fill={
                        !tipo || esAnotacion
                          ? "var(--diente-cuerpo)"
                          : tinte(tipo.color)
                      }
                    />
                    {esAnotacion && tipo ? (
                      <path
                        d={trazo.cuerpo}
                        fill="none"
                        stroke={tipo.color}
                        strokeWidth={3}
                        strokeDasharray="7 5"
                      />
                    ) : null}
                    <path
                      d={trazo.contorno}
                      fill={
                        !tipo || esAnotacion
                          ? "var(--diente-contorno)"
                          : tipo.color
                      }
                    />
                    {seleccionado ? (
                      <path
                        d={trazo.cuerpo}
                        fill="none"
                        strokeWidth={5}
                        className="stroke-diente-anillo"
                      />
                    ) : null}
                  </g>
                );
              })}
            </g>

            {/* Números FDI */}
            <g aria-hidden="true" className="pointer-events-none">
              {trazosVisibles.map((trazo) => (
                <text
                  key={trazo.numero}
                  x={trazo.cx}
                  y={trazo.cy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={TAMANO_DEL_NUMERO}
                  fontWeight={600}
                  className="fill-diente-numero"
                >
                  {trazo.numero}
                </text>
              ))}
            </g>
          </svg>
        </div>

        {/* Leyenda y selector rápido de dientes con trabajo */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <LeyendaDeDientes unidades={unidadesConDiente} />
          {unidadesConDiente.length > 1 ? (
            <div className="flex flex-wrap gap-1.5">
              {unidadesConDiente.map((u) => {
                const activo = u.diente === dienteSeleccionado;
                const tipo = TRABAJOS[u.rol];
                return (
                  <button
                    key={u.diente}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => {
                      setDienteSeleccionado(u.diente);
                      if (angosta) {
                        setArcadaVisibleMovil(
                          esSuperior(u.diente) ? "superior" : "inferior",
                        );
                      }
                    }}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-control border px-2.5 py-1 text-minimo font-medium transition-colors",
                      activo
                        ? "border-accion bg-superficie text-primario shadow-xs"
                        : "border-borde bg-superficie/60 text-secundario hover:bg-superficie",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      style={{ backgroundColor: tipo.color }}
                      className={cn(
                        "size-2 shrink-0 rounded-[2px]",
                        tipo.esAnotacion &&
                          "border border-dashed bg-transparent!",
                      )}
                    />
                    Diente {u.diente}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {/* Panel derecho meramente informativo del diente seleccionado */}
      <div className="flex min-w-0 flex-col gap-3">
        {unidadDienteActiva && dienteSeleccionado !== null ? (
          <TarjetaInformativaDeUnidad
            unidad={unidadDienteActiva}
            todasLasUnidades={unidades}
            titulo={`Diente ${dienteSeleccionado} · ${ROLES_DE_UNIDAD[unidadDienteActiva.rol]}`}
            subtitulo={nombreDelDiente(dienteSeleccionado)}
          />
        ) : (
          <aside className="rounded-tarjeta border border-borde bg-superficie p-4 text-menor text-secundario">
            Seleccione un diente marcado en el odontograma para ver sus
            especificaciones.
          </aside>
        )}
      </div>
    </div>
  );

  const panelArcadas = (
    <div className="grid gap-4 rounded-contenedor bg-diente-lienzo p-4 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_25rem]">
      <div className="flex min-w-0 flex-col gap-3">
        <VistaInformativaDeArcadas
          unidades={unidades}
          arcadaSeleccionada={arcadaSeleccionada}
          alSeleccionarArcada={setArcadaSeleccionada}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        {unidadesArcadaActivas.length > 0 ? (
          unidadesArcadaActivas.map((u, idx) => (
            <TarjetaInformativaDeUnidad
              key={`${u.arcada ?? "caso"}-${u.rol}-${idx}`}
              unidad={u}
              todasLasUnidades={unidades}
              titulo={ROLES_DE_UNIDAD[u.rol]}
              subtitulo={
                u.arcada ? ARCADAS_EN_PALABRAS[u.arcada] : "Todo el caso"
              }
            />
          ))
        ) : (
          <aside className="rounded-tarjeta border border-borde bg-superficie p-4 text-menor text-secundario">
            Seleccione una arcada con trabajo en el diagrama para ver sus
            especificaciones.
          </aside>
        )}
      </div>
    </div>
  );

  if (mostrarPestanas) {
    return (
      <Pestanas
        puesta={pestana}
        alCambiar={setPestana}
        pestanas={[
          {
            clave: "dientes",
            titulo: "Dientes",
            cuantas: unidadesConDiente.length,
            contenido: panelDientes,
          },
          {
            clave: "arcadas",
            titulo: "Arcadas",
            cuantas: unidadesDeArcada.length,
            contenido: panelArcadas,
          },
        ]}
      />
    );
  }

  if (unidadesConDiente.length === 0 && unidadesDeArcada.length > 0) {
    return panelArcadas;
  }

  return panelDientes;
}

/**
 * Tarjeta meramente informativa de una unidad (diente o arcada).
 * Solo muestra los campos que aplican o tienen información capturada.
 */
function TarjetaInformativaDeUnidad({
  unidad,
  todasLasUnidades,
  titulo,
  subtitulo,
}: {
  unidad: UnidadDelCaso;
  todasLasUnidades: UnidadDelCaso[];
  titulo: string;
  subtitulo: string;
}) {
  const tipo = TRABAJOS[unidad.rol];
  const tiene = (campo: Parameters<typeof pregunta>[1]) =>
    pregunta(unidad.rol, campo);

  const grupoPuente =
    unidad.diente !== null ? tramoDe(todasLasUnidades, unidad.diente) : null;
  const enPuente = Boolean(grupoPuente && grupoPuente.length > 1);
  const enLaPunta =
    enPuente && grupoPuente
      ? grupoPuente[0].diente === unidad.diente ||
        grupoPuente[grupoPuente.length - 1].diente === unidad.diente
      : false;

  const metodoResuelto =
    unidad.metodo ??
    (unidad.material ? METODOS_POR_MATERIAL[unidad.material]?.[0] : null) ??
    null;

  const mostrarImplante = unidad.esImplante || tiene("sistemaImplante");

  const filas: { etiqueta: string; valor: string; ayuda?: string }[] = [];

  if (mostrarImplante) {
    filas.push({
      etiqueta: "Sobre implante",
      valor: "Sí (no sobre diente preparado)",
    });
    if (unidad.sistemaImplante) {
      filas.push({
        etiqueta: "Sistema de implante",
        valor: unidad.sistemaImplante,
      });
    }
    if (unidad.retencion) {
      filas.push({
        etiqueta: "Cómo se sujeta",
        valor: RETENCIONES[unidad.retencion],
      });
    }
  }

  if (unidad.material) {
    filas.push({
      etiqueta: "Material",
      valor: MATERIALES[unidad.material],
    });
  }

  if (metodoResuelto) {
    filas.push({
      etiqueta: "Método",
      valor: METODOS[metodoResuelto],
    });
  }

  if (tiene("color") && unidad.color) {
    filas.push({
      etiqueta: "Color",
      valor: nombreDelColor(unidad.color),
    });
  }

  if (tiene("espesorAlivio") && unidad.espesorAlivioMm !== null) {
    filas.push({
      etiqueta: "Espesor del alivio",
      valor: `${unidad.espesorAlivioMm} mm`,
    });
  }

  if (tiene("grosor") && unidad.grosorMm !== null) {
    filas.push({
      etiqueta: "Grosor",
      valor: `${unidad.grosorMm} mm`,
    });
  }

  if (tiene("colorBase") && unidad.colorBase) {
    filas.push({
      etiqueta: "Color de la encía",
      valor: unidad.colorBase,
    });
  }

  if (tiene("colorDientes") && unidad.colorDientes) {
    filas.push({
      etiqueta: "Color de los dientes",
      valor: nombreDelColor(unidad.colorDientes),
    });
  }

  if (tiene("troqueles") && unidad.troqueles) {
    filas.push({
      etiqueta: "Troqueles removibles",
      valor: "Sí, con troqueles removibles",
    });
  }

  return (
    <section
      aria-label={`Información de ${titulo}`}
      className="flex flex-col gap-4 rounded-tarjeta border border-borde bg-superficie p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-subtitulo font-semibold text-primario">
            {titulo}
          </h3>
          <p className="text-minimo text-secundario">{subtitulo}</p>
        </div>
        <span
          style={{
            backgroundColor: tipo.color,
            color: tipo.colorDelTexto,
          }}
          className="inline-flex shrink-0 items-center rounded-control px-2.5 py-1 text-minimo font-medium"
        >
          {tipo.nombre}
        </span>
      </div>

      {tipo.esAnotacion ? (
        <p className="rounded-control bg-superficie-suave p-3 text-minimo text-secundario">
          {tipo.queEs} No se fabrica ni se cotiza: es una anotación para el
          técnico.
        </p>
      ) : null}

      {enPuente && grupoPuente ? (
        <div className="flex flex-col gap-0.5 rounded-control bg-superficie-suave p-3">
          <p className="text-menor font-medium text-primario">
            Puente {nombreDelTramo(grupoPuente)}
          </p>
          <p className="text-minimo text-secundario">
            {enLaPunta && puedeSerPilar(unidad.rol)
              ? "Pilar en extremo del puente."
              : esPontico(unidad.rol)
                ? "Póntico intermedio del puente."
                : "Pieza unida al tramo."}
          </p>
        </div>
      ) : null}

      {filas.length > 0 ? (
        <dl className="flex flex-col gap-3">
          {filas.map((fila) => (
            <div
              key={fila.etiqueta}
              className="flex flex-col gap-0.5 rounded-control border border-borde bg-superficie-suave/50 px-3 py-2"
            >
              <dt className="text-minimo text-secundario">{fila.etiqueta}</dt>
              <dd className="text-cuerpo font-medium text-primario">
                {fila.valor}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {unidad.notas && unidad.notas.trim().length > 0 ? (
        <div className="flex flex-col gap-1 rounded-control border border-borde bg-superficie-suave/50 px-3 py-2">
          <p className="text-minimo text-secundario">Notas</p>
          <p className="whitespace-pre-wrap text-menor text-primario">
            {unidad.notas}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function LeyendaDeDientes({
  unidades,
}: {
  unidades: (UnidadDelCaso & { diente: number })[];
}) {
  const usados = [...new Set(unidades.map((u) => u.rol))];
  if (usados.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-minimo text-secundario">
      {usados.map((rol) => (
        <li key={rol} className="flex items-center gap-1.5">
          <svg
            aria-hidden="true"
            viewBox="0 0 12 12"
            className="size-3 shrink-0"
          >
            <rect
              x="1"
              y="1"
              width="10"
              height="10"
              rx="3"
              strokeWidth="1.5"
              fill={
                TRABAJOS[rol].esAnotacion ? "none" : tinte(TRABAJOS[rol].color)
              }
              stroke={TRABAJOS[rol].color}
              strokeDasharray={
                TRABAJOS[rol].esAnotacion ? "2.5 2" : undefined
              }
            />
          </svg>
          {TRABAJOS[rol].nombre}
          {TRABAJOS[rol].esAnotacion ? " (no se fabrica)" : ""}
        </li>
      ))}
    </ul>
  );
}

function VistaInformativaDeArcadas({
  unidades,
  arcadaSeleccionada,
  alSeleccionarArcada,
}: {
  unidades: UnidadDelCaso[];
  arcadaSeleccionada: Arcada | null;
  alSeleccionarArcada: (arcada: Arcada) => void;
}) {
  const deArcada = unidades.filter((u) => u.diente === null);
  const conTrabajoDiente = new Set(conDiente(unidades).map((u) => u.diente));

  const fueraDelDibujo = [...conTrabajoDiente]
    .filter((d) => !NUMEROS_DIBUJADOS.has(d))
    .sort((a, b) => a - b);

  return (
    <>
      <svg
        viewBox={VISTA_MANDIBULAS}
        role="group"
        aria-label="Maxilar y mandíbula del caso."
        className="mx-auto h-auto w-full max-w-[34rem]"
      >
        {(["SUPERIOR", "INFERIOR"] as const).map((arcada) => {
          const suyas = PIEZAS_DEL_DIBUJO.filter((p) => p.arcada === arcada);
          const trabajos = deArcada.filter((u) => u.arcada === arcada);
          const tieneTrabajo = trabajos.length > 0;
          const seleccionada = arcadaSeleccionada === arcada;

          const comoEsta =
            trabajos.length === 0
              ? "sin trabajo de arcada"
              : trabajos
                  .map((u) => TRABAJOS[u.rol].nombre.toLowerCase())
                  .join(", ");

          return (
            <g
              key={arcada}
              data-arcada={arcada}
              role={tieneTrabajo ? "button" : undefined}
              tabIndex={tieneTrabajo ? 0 : -1}
              aria-pressed={tieneTrabajo ? seleccionada : undefined}
              aria-label={`${ARCADAS_EN_PALABRAS[arcada]}: ${comoEsta}.`}
              onClick={() => {
                if (tieneTrabajo) alSeleccionarArcada(arcada);
              }}
              onKeyDown={(e) => {
                if (
                  tieneTrabajo &&
                  (e.key === "Enter" || e.key === " ")
                ) {
                  e.preventDefault();
                  alSeleccionarArcada(arcada);
                }
              }}
              className={tieneTrabajo ? "cursor-pointer" : "cursor-default"}
            >
              {suyas.map((pieza, i) => {
                const ocupado =
                  pieza.numero !== null && conTrabajoDiente.has(pieza.numero);

                return (
                  <path
                    key={pieza.numero ?? `encia-${i}`}
                    d={pieza.d}
                    fill={
                      ocupado
                        ? "var(--diente-ocupado)"
                        : tieneTrabajo
                          ? "var(--diente-pontico)"
                          : "var(--mandibula-relleno)"
                    }
                    stroke="var(--diente-contorno)"
                    strokeWidth={TRAZO_MANDIBULA}
                  />
                );
              })}

              {seleccionada ? (
                <path
                  d={CONTORNO_DE_ARCADA[arcada]}
                  fill="none"
                  strokeWidth={TRAZO_MANDIBULA * 1.5}
                  strokeLinejoin="round"
                  className="stroke-diente-anillo"
                />
              ) : null}
            </g>
          );
        })}
      </svg>

      {fueraDelDibujo.length > 0 ? (
        <p className="text-minimo text-secundario">
          De frente no se ven las muelas del juicio, así que{" "}
          {fueraDelDibujo.length === 1 ? "el diente" : "los dientes"}{" "}
          {fueraDelDibujo.join(", ")} no{" "}
          {fueraDelDibujo.length === 1 ? "sale" : "salen"} en el dibujo, pero{" "}
          {fueraDelDibujo.length === 1 ? "sigue" : "siguen"} en el caso.
        </p>
      ) : null}
    </>
  );
}
