"use client";

import Link from "next/link";
import { Plus } from "@phosphor-icons/react";
import { cn } from "@/lib/utilidades";

/**
 * La barra de arriba del inicio: la meta del mes y crear caso.
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
  if (!meta && !puedeCrearCasos) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {meta ? <BarraDeMeta {...meta} /> : <span />}

      {puedeCrearCasos ? (
        <div className="flex flex-1 items-center justify-end gap-3">
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
        </div>
      ) : null}
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
      className="vidrio relative h-9 shrink-0 overflow-hidden rounded-full text-primario"
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
