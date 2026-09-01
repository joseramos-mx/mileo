"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, MagnifyingGlass } from "@phosphor-icons/react";
import type { BorradorDeCaso } from "@/lib/casos";
import { INDICACIONES } from "@/lib/vocabulario";
import { haceCuanto, paraMaquina } from "@/lib/fechas";
import { cn } from "@/lib/utilidades";

/**
 * Los casos que la clínica todavía no manda, en lista con la información
 * repartida en columnas.
 *
 * Es una tabla de verdad, no una rejilla de cajas: cada renglón es un caso y
 * cada columna un dato, así que un lector de pantalla puede decir "Paciente,
 * 1041 · R.T.G." en vez de leer texto suelto.
 *
 * No lleva chip de etapa a propósito: estos casos no han salido de la clínica,
 * y enseñar "Recibido" le diría al doctor que el laboratorio ya los tiene (§8).
 * Lo que sí lleva es qué falta para poder mandarlos.
 */
export function TablaDeBorradores({
  borradores,
}: {
  borradores: BorradorDeCaso[];
}) {
  const [busqueda, setBusqueda] = useState("");

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return borradores;
    return borradores.filter((b) =>
      [b.folio, b.paciente, INDICACIONES[b.indicacion].nombre, b.resumenDeUnidades]
        .join(" ")
        .toLowerCase()
        .includes(texto),
    );
  }, [borradores, busqueda]);

  return (
    <div className="overflow-hidden rounded-contenedor border border-borde bg-superficie">
      {borradores.length > 4 ? (
        <div className="border-b border-borde p-3">
          <label className="relative flex max-w-sm items-center">
            <span className="sr-only">Buscar entre sus casos sin terminar</span>
            <MagnifyingGlass
              aria-hidden="true"
              size={16}
              className="pointer-events-none absolute left-3 text-secundario"
            />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por paciente o tipo de trabajo"
              className={cn(
                "alto-tactil w-full rounded-control border border-borde bg-superficie-suave",
                "pr-3 pl-9 text-menor text-primario placeholder:text-secundario",
              )}
            />
          </label>
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
            <tr className="border-b border-borde">
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
                className="border-b border-borde last:border-b-0 hover:bg-superficie-suave"
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

      {visibles.length === 0 ? (
        <p className="p-6 text-center text-cuerpo text-secundario">
          Ninguno de sus casos sin terminar coincide con “{busqueda}”.
        </p>
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
