"use client";

import { useMemo, useState } from "react";
import { MagnifyingGlass, CaretLeft, CaretRight } from "@phosphor-icons/react";
import type { BorradorDeCaso } from "@/lib/casos";
import {
  TarjetaDeCaso,
  type CasoParaTarjeta,
} from "@/componentes/TarjetaDeCaso";
import { TablaDeBorradores } from "@/componentes/TablaDeBorradores";
import { EstadoVacio } from "@/componentes/EstadoVacio";
import { ListaConEntrada } from "@/componentes/ListaConEntrada";
import { REJILLA_DE_CASOS } from "@/componentes/RejillaDeCasos";
import { BotonEnlace } from "@/componentes/Boton";
import { ETAPAS } from "@/lib/vocabulario";
import { cn } from "@/lib/utilidades";

const CASOS_POR_PAGINA = 10;

function normalizarTexto(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .toLowerCase();
}

function coincideCaso(caso: CasoParaTarjeta, palabras: string[]) {
  if (palabras.length === 0) return true;
  const pajar = normalizarTexto(
    [
      caso.folio,
      caso.paciente.folio,
      caso.paciente.iniciales,
      `paciente ${caso.paciente.folio}`,
      caso.doctor ?? "",
      caso.clinica ?? "",
      caso.tecnico?.nombre ?? "",
      ETAPAS[caso.etapa]?.nombre ?? "",
      caso.indicacionNombre ?? "",
      caso.resumenCompleto ?? "",
      caso.unidades,
      caso.materialYColor,
    ].join(" "),
  );
  return palabras.every((palabra) => pajar.includes(palabra));
}

export function ListaDeCasos({
  delLaboratorio,
  leTocan,
  enCurso,
  entregados,
  borradores,
  busquedaInicial = "",
}: {
  delLaboratorio: boolean;
  leTocan: CasoParaTarjeta[];
  enCurso: CasoParaTarjeta[];
  entregados: CasoParaTarjeta[];
  borradores: BorradorDeCaso[];
  busquedaInicial?: string;
}) {
  const [busqueda, setBusqueda] = useState(busquedaInicial);
  const [pagina, setPagina] = useState(1);

  const palabras = useMemo(
    () => normalizarTexto(busqueda).split(/\s+/).filter(Boolean),
    [busqueda],
  );

  const leTocanFiltrados = useMemo(
    () => leTocan.filter((c) => coincideCaso(c, palabras)),
    [leTocan, palabras],
  );
  const enCursoFiltrados = useMemo(
    () => enCurso.filter((c) => coincideCaso(c, palabras)),
    [enCurso, palabras],
  );
  const entregadosFiltrados = useMemo(
    () => entregados.filter((c) => coincideCaso(c, palabras)),
    [entregados, palabras],
  );

  const gruposFiltrados = useMemo(
    () =>
      [
        {
          titulo: delLaboratorio ? "Esperan al doctor" : "Le toca a usted",
          casos: leTocanFiltrados,
        },
        {
          titulo: delLaboratorio ? "En el taller" : "En el laboratorio",
          casos: enCursoFiltrados,
        },
        { titulo: "Entregados", casos: entregadosFiltrados },
      ].filter((g) => g.casos.length > 0),
    [delLaboratorio, leTocanFiltrados, enCursoFiltrados, entregadosFiltrados],
  );

  const totalCasosFiltrados =
    leTocanFiltrados.length +
    enCursoFiltrados.length +
    entregadosFiltrados.length;

  const totalCasosOriginal =
    leTocan.length + enCurso.length + entregados.length + borradores.length;

  const totalCasosEnviados =
    leTocan.length + enCurso.length + entregados.length;

  const totalPaginas = Math.max(
    1,
    Math.ceil(totalCasosFiltrados / CASOS_POR_PAGINA),
  );
  const paginaActual = Math.min(pagina, totalPaginas);

  // En laboratorio se pagina de 10 en 10 sobre los casos filtrados, manteniendo sus secciones
  const gruposVisibles = useMemo(() => {
    if (!delLaboratorio) return gruposFiltrados;

    const inicio = (paginaActual - 1) * CASOS_POR_PAGINA;
    const fin = inicio + CASOS_POR_PAGINA;
    let acumulado = 0;

    return gruposFiltrados
      .map((grupo) => {
        const inicioGrupo = acumulado;
        const finGrupo = acumulado + grupo.casos.length;
        acumulado = finGrupo;

        if (finGrupo <= inicio || inicioGrupo >= fin) {
          return { ...grupo, casos: [] };
        }

        const desdeEnGrupo = Math.max(0, inicio - inicioGrupo);
        const hastaEnGrupo = Math.min(grupo.casos.length, fin - inicioGrupo);
        return {
          ...grupo,
          casos: grupo.casos.slice(desdeEnGrupo, hastaEnGrupo),
        };
      })
      .filter((g) => g.casos.length > 0);
  }, [delLaboratorio, gruposFiltrados, paginaActual]);

  const mostrandoDesde =
    totalCasosFiltrados === 0
      ? 0
      : (paginaActual - 1) * CASOS_POR_PAGINA + 1;
  const mostrandoHasta = Math.min(
    paginaActual * CASOS_POR_PAGINA,
    totalCasosFiltrados,
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-titulo font-semibold text-primario">
            {delLaboratorio ? "Casos" : "Mis casos"}
          </h1>
          {delLaboratorio && totalCasosFiltrados > 0 ? (
            <p className="mt-1 text-menor text-secundario">
              Mostrando {mostrandoDesde}–{mostrandoHasta} de{" "}
              {totalCasosFiltrados}{" "}
              {totalCasosFiltrados === 1 ? "caso" : "casos"}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          {totalCasosEnviados > 0 ? (
            <label className="relative flex w-full sm:w-80 items-center">
              <span className="sr-only">
                Buscar casos por folio, paciente, iniciales, doctor, clínica,
                etapa o material
              </span>
              <MagnifyingGlass
                aria-hidden="true"
                size={16}
                className="pointer-events-none absolute left-3 text-secundario"
              />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  setPagina(1);
                }}
                placeholder="Buscar por folio, paciente, doctor, trabajo…"
                className={cn(
                  "vidrio area-tactil w-full rounded-tarjeta border border-borde bg-superficie",
                  "pr-3 pl-9 text-menor text-primario outline-none placeholder:text-secundario focus-visible:ring-2 focus-visible:ring-foco",
                )}
              />
            </label>
          ) : null}

          {!delLaboratorio ? (
            <BotonEnlace href="/casos/nuevo" tono="principal">
              Crear caso
            </BotonEnlace>
          ) : null}
        </div>
      </header>

      {borradores.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-subtitulo font-semibold text-primario">
            Sin terminar de capturar
          </h2>
          <TablaDeBorradores borradores={borradores} />
        </section>
      ) : null}

      {totalCasosOriginal === 0 ? (
        <EstadoVacio
          titulo={
            delLaboratorio
              ? "Todavía no llega ningún caso"
              : "Aquí van a aparecer sus casos"
          }
          explicacion={
            delLaboratorio
              ? "En cuanto una clínica mande un caso, aparece aquí para revisarlo."
              : "Cree un caso y suba el escaneo desde el equipo que ya tiene. Recibo STL, PLY, OBJ, DICOM y ZIP."
          }
          accion={
            delLaboratorio ? undefined : (
              <BotonEnlace href="/casos/nuevo" tono="principal" tamano="grande">
                Crear mi primer caso
              </BotonEnlace>
            )
          }
        />
      ) : gruposVisibles.length === 0 && totalCasosEnviados > 0 ? (
        <div className="vidrio rounded-contenedor p-6 text-center">
          <p className="text-cuerpo text-secundario">
            Ningún caso coincide con “{busqueda}”.
          </p>
        </div>
      ) : (
        <>
          {gruposVisibles.map((grupo) => (
            <section key={grupo.titulo} className="flex flex-col gap-3">
              <h2 className="text-subtitulo font-semibold text-primario">
                {grupo.titulo}
              </h2>
              <ListaConEntrada className={REJILLA_DE_CASOS}>
                {grupo.casos.map((caso) => (
                  <div key={caso.id} className="flex flex-col gap-1">
                    {delLaboratorio && caso.doctor ? (
                      <p className="text-minimo text-secundario">
                        {caso.folio} · {caso.doctor}
                        {caso.clinica ? ` (${caso.clinica})` : ""}
                      </p>
                    ) : null}
                    <TarjetaDeCaso caso={caso} />
                  </div>
                ))}
              </ListaConEntrada>
            </section>
          ))}

          {delLaboratorio && totalPaginas > 1 ? (
            <nav
              aria-label="Paginación de casos"
              className="flex flex-wrap items-center justify-between gap-3 rounded-contenedor border border-borde bg-superficie px-4 py-3"
            >
              <p className="text-menor text-secundario">
                Página <strong className="text-primario">{paginaActual}</strong>{" "}
                de <strong className="text-primario">{totalPaginas}</strong> (
                {mostrandoDesde}–{mostrandoHasta} de {totalCasosFiltrados})
              </p>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={paginaActual <= 1}
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  className={cn(
                    "alto-tactil inline-flex items-center gap-1 rounded-control border border-borde px-3 text-menor font-medium transition-colors",
                    paginaActual <= 1
                      ? "cursor-not-allowed opacity-40 text-secundario"
                      : "bg-superficie text-primario hover:bg-superficie-suave",
                  )}
                >
                  <CaretLeft aria-hidden="true" size={16} />
                  Anterior
                </button>

                {Array.from({ length: totalPaginas }, (_, idx) => idx + 1).map(
                  (num) => (
                    <button
                      key={num}
                      type="button"
                      aria-current={num === paginaActual ? "page" : undefined}
                      onClick={() => setPagina(num)}
                      className={cn(
                        "alto-tactil inline-flex min-w-10 items-center justify-center rounded-control border px-2.5 text-menor font-medium transition-colors",
                        num === paginaActual
                          ? "border-accion bg-accion text-sobre-accion"
                          : "border-borde bg-superficie text-secundario hover:bg-superficie-suave hover:text-primario",
                      )}
                    >
                      {num}
                    </button>
                  ),
                )}

                <button
                  type="button"
                  disabled={paginaActual >= totalPaginas}
                  onClick={() =>
                    setPagina((p) => Math.min(totalPaginas, p + 1))
                  }
                  className={cn(
                    "alto-tactil inline-flex items-center gap-1 rounded-control border border-borde px-3 text-menor font-medium transition-colors",
                    paginaActual >= totalPaginas
                      ? "cursor-not-allowed opacity-40 text-secundario"
                      : "bg-superficie text-primario hover:bg-superficie-suave",
                  )}
                >
                  Siguiente
                  <CaretRight aria-hidden="true" size={16} />
                </button>
              </div>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
