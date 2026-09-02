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
 * la derecha lo dice también con cifras, porque el color nunca puede ser el
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

/** El ancho de la barra, en dos lugares porque la capa llena la copia. */
const ANCHO_DE_LA_META = "14rem";

function BarraDeMeta({
  hechos,
  objetivo,
}: {
  hechos: number;
  objetivo: number;
}) {
  const porcentaje = Math.min(100, Math.round((hechos / objetivo) * 100));

  // El texto va encima de dos fondos a la vez: el relleno azul y lo que queda
  // de barra. Un solo color no sirve para los dos —en tema claro el blanco se
  // perdía sobre el fondo de la barra—, así que se pinta dos veces: la de
  // abajo con el color normal del texto, y encima una copia en blanco
  // recortada justo a lo que va lleno. Cada mitad queda sobre su propio fondo,
  // con el contraste que pide §7 en los dos temas.
  const contenido = (
    <div
      className="flex h-full items-center justify-between px-4 text-minimo font-medium"
      style={{ width: ANCHO_DE_LA_META }}
    >
      <span>Meta del mes</span>
      <span>
        {hechos}/{objetivo}
      </span>
    </div>
  );

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={objetivo}
      aria-valuenow={hechos}
      aria-label={`Meta del mes: ${hechos} de ${objetivo} casos entregados`}
      style={{ width: ANCHO_DE_LA_META }}
      className="relative h-9 shrink-0 overflow-hidden rounded-full border border-borde bg-superficie text-primario"
    >
      {contenido}

      {/* El relleno es proporcional de verdad: si va en cero, se ve en cero. */}
      <div
        aria-hidden="true"
        style={{ width: `${porcentaje}%` }}
        className="absolute inset-y-0 left-0 overflow-hidden transition-[width] duration-200"
      >
        <div className="h-full bg-accion text-sobre-accion">{contenido}</div>
      </div>
    </div>
  );
}
