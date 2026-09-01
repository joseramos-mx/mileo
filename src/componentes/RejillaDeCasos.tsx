import type { ReactNode } from "react";
import { cn } from "@/lib/utilidades";

/**
 * La caja donde se acomodan las tarjetas de caso.
 *
 * Columnas de 380 px que se van llenando de izquierda a derecha: en el celular
 * cabe una, en la pantalla del consultorio caben tres. La tarjeta no cambia de
 * tamaño según dónde esté; lo que cambia es cuántas caben.
 */
export const REJILLA_DE_CASOS =
  "grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(0,23.75rem))]";

export function RejillaDeCasos({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn(REJILLA_DE_CASOS, className)}>{children}</div>;
}
