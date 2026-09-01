"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { cn } from "@/lib/utilidades";

/**
 * La barra de arriba del inicio: la meta del mes, la búsqueda y crear caso.
 *
 * La meta es una sola barra: la parte llena es lo que va del mes y el número de
 * la derecha lo dice también con palabras, porque el color nunca puede ser el
 * único portador de información (§7).
 */
export function BarraSuperior({
  meta,
  puedeCrearCasos,
}: {
  meta: { hechos: number; objetivo: number } | null;
  puedeCrearCasos: boolean;
}) {
  const router = useRouter();
  const consulta = useSearchParams();
  const [texto, setTexto] = useState(consulta.get("buscar") ?? "");

  function buscar(evento: React.FormEvent) {
    evento.preventDefault();
    const limpio = texto.trim();
    router.push(limpio ? `/casos?buscar=${encodeURIComponent(limpio)}` : "/casos");
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {meta ? <BarraDeMeta {...meta} /> : <span />}

      <div className="flex flex-1 items-center justify-end gap-3">
        <form onSubmit={buscar} className="w-full max-w-xs" role="search">
          <label className="relative flex items-center">
            <span className="sr-only">Buscar un caso o un paciente</span>
            <MagnifyingGlass
              aria-hidden="true"
              size={16}
              className="pointer-events-none absolute left-3 text-secundario"
            />
            <input
              type="search"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Buscar"
              className={cn(
                "area-tactil w-full rounded-control border border-borde bg-superficie",
                "pl-9 pr-3 text-cuerpo text-primario placeholder:text-secundario",
              )}
            />
          </label>
        </form>

        {puedeCrearCasos ? (
          <Link
            href="/casos/nuevo"
            className={cn(
              "area-tactil inline-flex shrink-0 items-center gap-1.5 rounded-full",
              "bg-accion px-5 text-cuerpo font-medium text-sobre-accion",
              "transition-colors duration-150 hover:bg-accion-encima",
            )}
          >
            <Plus aria-hidden="true" size={16} weight="bold" />
            Nuevo caso
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function BarraDeMeta({
  hechos,
  objetivo,
}: {
  hechos: number;
  objetivo: number;
}) {
  const porcentaje = Math.min(100, Math.round((hechos / objetivo) * 100));

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={objetivo}
      aria-valuenow={hechos}
      aria-label={`Meta del mes: ${hechos} de ${objetivo} casos entregados`}
      className="relative flex h-9 w-56 shrink-0 items-center overflow-hidden rounded-full bg-superficie"
    >
      {/* El relleno es proporcional de verdad: si va en cero, se ve en cero.
          El texto va en blanco, que se lee igual sobre el relleno azul que
          sobre el fondo de la barra. */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 rounded-full bg-accion transition-[width] duration-200"
        style={{ width: `${porcentaje}%` }}
      />
      <span className="relative z-10 pl-4 text-minimo font-medium text-white">
        Meta del mes
      </span>
      <span className="relative z-10 ml-auto pr-4 text-minimo font-medium text-white">
        {hechos}/{objetivo}
      </span>
    </div>
  );
}
