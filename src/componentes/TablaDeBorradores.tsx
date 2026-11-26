"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CaretLeft,
  CaretRight,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import type { BorradorDeCaso } from "@/lib/casos";
import { INDICACIONES } from "@/lib/vocabulario";
import { haceCuanto, paraMaquina } from "@/lib/fechas";
import { cn } from "@/lib/utilidades";

const BORRADORES_POR_PAGINA = 10;

/**
 * Los casos que la clínica todavía no manda, en lista con la información
 * repartida en columnas, buscador completo y paginación de 10 en 10.
 */
function normalizarTexto(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .toLowerCase();
}

export function TablaDeBorradores({
  borradores,
}: {
  borradores: BorradorDeCaso[];
}) {
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);

  const filtrados = useMemo(() => {
    const palabras = normalizarTexto(busqueda)
      .split(/\s+/)
      .filter(Boolean);
    if (palabras.length === 0) return borradores;
    return borradores.filter((b) => {
      const textoArchivos =
        b.archivos === 0
          ? "ninguno todavia"
          : b.archivos === 1
            ? "1 archivo"
            : `${b.archivos} archivos`;
      const pajar = normalizarTexto(
        [
          b.folio,
          `paciente ${b.paciente}`,
          b.paciente,
          b.folioPaciente ?? "",
          b.inicialesPaciente ?? "",
          b.nombrePaciente ?? "",
          b.doctor ?? "",
          b.clinica ?? "",
          INDICACIONES[b.indicacion].nombre,
          b.resumenDeUnidades,
          b.dientes ?? "",
          textoArchivos,
          haceCuanto(b.actualizadoEn),
        ].join(" "),
      );
      return palabras.every((palabra) => pajar.includes(palabra));
    });
  }, [borradores, busqueda]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(filtrados.length / BORRADORES_POR_PAGINA),
  );
  const paginaActual = Math.min(pagina, totalPaginas);

  const visibles = useMemo(() => {
    const inicio = (paginaActual - 1) * BORRADORES_POR_PAGINA;
    return filtrados.slice(inicio, inicio + BORRADORES_POR_PAGINA);
  }, [filtrados, paginaActual]);

  const mostrandoDesde =
    filtrados.length === 0 ? 0 : (paginaActual - 1) * BORRADORES_POR_PAGINA + 1;
  const mostrandoHasta = Math.min(
    paginaActual * BORRADORES_POR_PAGINA,
    filtrados.length,
  );

  return (
    <div className="vidrio min-w-0 overflow-hidden rounded-contenedor">
      {borradores.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primario/5 p-3">
          <label className="relative flex w-full max-w-md items-center">
            <span className="sr-only">Buscar entre sus casos sin terminar</span>
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
              placeholder="Buscar por paciente, folio, iniciales, tipo de trabajo o material…"
              className={cn(
                "alto-tactil w-full rounded-control border border-borde bg-superficie-suave",
                "pr-3 pl-9 text-menor text-primario outline-none placeholder:text-secundario focus-visible:ring-2 focus-visible:ring-foco",
              )}
            />
          </label>

          {filtrados.length > 0 ? (
            <p className="text-minimo text-secundario">
              Mostrando{" "}
              <strong className="text-primario">
                {mostrandoDesde}–{mostrandoHasta}
              </strong>{" "}
              de <strong className="text-primario">{filtrados.length}</strong>
            </p>
          ) : null}
        </div>
      ) : null}

      {/* La tabla se desplaza dentro de su propio marco: en pantallas angostas
          se recorre a lo ancho sin empujar la página (§7). */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] border-collapse text-left">
          <caption className="sr-only">
            Sus casos sin terminar de capturar, con el paciente, el tipo de
            trabajo, lo que lleva capturado y cuándo lo guardé.
          </caption>
          <thead>
            <tr className="border-b border-primario/5">
              <Encabezado>Paciente</Encabezado>
              <Encabezado>Tipo de trabajo</Encabezado>
              <Encabezado>Lo que lleva</Encabezado>
              <Encabezado>Archivos</Encabezado>
              <Encabezado>Guardado</Encabezado>
              <th scope="col" className="px-4 py-2">
                <span className="sr-only">Continuar</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {visibles.map((borrador) => (
              <tr
                key={borrador.id}
                className="border-b border-primario/5 last:border-b-0 hover:bg-primario/5"
              >
                <th scope="row" className="px-4 py-3 font-normal">
                  <span className="block text-cuerpo font-medium text-primario">
                    Paciente {borrador.paciente}
                  </span>
                  <span className="block text-minimo text-secundario">
                    {borrador.folio}
                  </span>
                </th>

                <td className="px-4 py-3 text-menor text-secundario">
                  {INDICACIONES[borrador.indicacion].nombre}
                </td>

                <td className="px-4 py-3 text-menor text-secundario">
                  {borrador.resumenDeUnidades}
                </td>

                <td className="px-4 py-3 text-menor text-secundario">
                  {borrador.archivos === 0
                    ? "Ninguno todavía"
                    : borrador.archivos === 1
                      ? "1 archivo"
                      : `${borrador.archivos} archivos`}
                </td>

                <td className="px-4 py-3 text-menor text-secundario">
                  <time dateTime={paraMaquina(borrador.actualizadoEn)}>
                    {haceCuanto(borrador.actualizadoEn)}
                  </time>
                </td>

                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/casos/${borrador.id}`}
                    className="alto-tactil inline-flex items-center gap-1.5 text-menor font-medium text-enlace hover:underline"
                  >
                    Continuar
                    <ArrowRight aria-hidden="true" size={14} />
                    <span className="sr-only">
                      la captura del paciente {borrador.paciente}
                    </span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtrados.length === 0 ? (
        <p className="p-6 text-center text-cuerpo text-secundario">
          Ninguno de sus casos sin terminar coincide con “{busqueda}”.
        </p>
      ) : null}

      {totalPaginas > 1 ? (
        <nav
          aria-label="Paginación de casos sin terminar"
          className="flex flex-wrap items-center justify-between gap-3 border-t border-primario/5 px-4 py-3"
        >
          <p className="text-menor text-secundario">
            Página <strong className="text-primario">{paginaActual}</strong> de{" "}
            <strong className="text-primario">{totalPaginas}</strong> (
            {mostrandoDesde}–{mostrandoHasta} de {filtrados.length})
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
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
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
    </div>
  );
}

function Encabezado({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="px-4 py-2 text-minimo font-medium text-secundario"
    >
      {children}
    </th>
  );
}
