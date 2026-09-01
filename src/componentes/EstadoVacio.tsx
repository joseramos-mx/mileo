import type { ReactNode } from "react";
import { cn } from "@/lib/utilidades";

/**
 * Estado vacío (SKILL.md §5.4 "EmptyState", §6.7).
 *
 * Los estados vacíos enseñan. La primera vez que entra un doctor no tiene
 * casos: esa pantalla debe enseñarle a subir el primero, con la guía de su
 * escáner a la mano. Nunca "sin resultados".
 */

export function EstadoVacio({
  titulo,
  explicacion,
  accion,
  ayuda,
  className,
}: {
  /** Qué está pasando, en positivo. */
  titulo: string;
  /** Qué sigue y cómo se hace. */
  explicacion: string;
  /** La acción principal. Con verbo. */
  accion?: ReactNode;
  /** Un enlace de apoyo: la guía del escáner, el chat, el soporte. */
  ayuda?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-contenedor border border-borde",
        "bg-superficie px-6 py-10 text-center",
        className,
      )}
    >
      <h2 className="text-subtitulo font-semibold text-primario">{titulo}</h2>
      <p className="max-w-prose text-cuerpo text-secundario">{explicacion}</p>
      {accion ? <div className="mt-2">{accion}</div> : null}
      {ayuda ? <div className="text-menor">{ayuda}</div> : null}
    </div>
  );
}
