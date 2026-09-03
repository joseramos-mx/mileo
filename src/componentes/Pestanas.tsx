"use client";

import { useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utilidades";

/**
 * Pestañas (SKILL.md §5.4).
 *
 * Con teclado se entra una vez y se recorre con las flechas, que es como se
 * navegan unas pestañas de verdad: la que está puesta es la única que recibe el
 * tabulador, y las flechas mueven entre ellas. Cada una dice a qué panel manda
 * con `aria-controls`, y el panel dice de qué pestaña viene.
 *
 * En pantalla angosta se vuelven un selector segmentado —los mismos botones,
 * más juntos y a todo lo ancho—, nunca una lista desplegable: esconder una de
 * dos opciones detrás de un menú es cobrarle un toque de más a quien captura de
 * pie y con prisa (§6.2).
 */

export type Pestana = {
  clave: string;
  titulo: string;
  /** Cuántas unidades lleva. Va escrito al lado del título. */
  cuantas?: number;
  contenido: ReactNode;
};

export function Pestanas({
  pestanas,
  puesta,
  alCambiar,
  className,
}: {
  pestanas: Pestana[];
  puesta: string;
  alCambiar: (clave: string) => void;
  className?: string;
}) {
  const base = useId();
  const botones = useRef(new Map<string, HTMLButtonElement>());

  const idPestana = (clave: string) => `${base}-p-${clave}`;
  const idPanel = (clave: string) => `${base}-c-${clave}`;

  function alTeclear(evento: React.KeyboardEvent, posicion: number) {
    const destino: Record<string, number | undefined> = {
      ArrowRight: posicion + 1,
      ArrowLeft: posicion - 1,
      ArrowDown: posicion + 1,
      ArrowUp: posicion - 1,
      Home: 0,
      End: pestanas.length - 1,
    };
    const siguiente = destino[evento.key];
    if (siguiente === undefined) return;
    evento.preventDefault();

    const cual = pestanas[(siguiente + pestanas.length) % pestanas.length];
    alCambiar(cual.clave);
    requestAnimationFrame(() => botones.current.get(cual.clave)?.focus());
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div
        role="tablist"
        aria-label="Qué se está capturando"
        className={cn(
          // Angosta: segmentado, a todo lo ancho y sin borde de abajo.
          "flex gap-1 rounded-control bg-superficie-suave p-1",
          // Ancha: pestañas de verdad, apoyadas en una línea.
          "sm:gap-0 sm:rounded-none sm:bg-transparent sm:p-0",
          "sm:border-b sm:border-borde",
        )}
      >
        {pestanas.map((pestana, posicion) => {
          const activa = pestana.clave === puesta;

          return (
            <button
              key={pestana.clave}
              ref={(nodo) => {
                if (nodo) botones.current.set(pestana.clave, nodo);
                else botones.current.delete(pestana.clave);
              }}
              type="button"
              role="tab"
              id={idPestana(pestana.clave)}
              aria-selected={activa}
              aria-controls={idPanel(pestana.clave)}
              tabIndex={activa ? 0 : -1}
              onClick={() => alCambiar(pestana.clave)}
              onKeyDown={(e) => alTeclear(e, posicion)}
              className={cn(
                "alto-tactil flex-1 px-4 text-menor font-medium",
                "transition-colors duration-150 sm:flex-none",
                activa
                  ? "rounded-control bg-superficie text-primario sm:rounded-none sm:bg-transparent sm:border-b-2 sm:border-accion sm:-mb-px"
                  : "text-secundario hover:text-primario",
              )}
            >
              {pestana.titulo}
              {pestana.cuantas !== undefined ? (
                <span className={activa ? "text-secundario" : ""}>
                  {" "}
                  ({pestana.cuantas})
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Los paneles que no se ven siguen montados: cambiar de pestaña no
          puede borrar lo capturado en la otra, y desmontarlos tiraría su
          estado. */}
      {pestanas.map((pestana) => {
        const escondido = pestana.clave !== puesta;

        return (
          <div
            key={pestana.clave}
            role="tabpanel"
            id={idPanel(pestana.clave)}
            aria-labelledby={idPestana(pestana.clave)}
            hidden={escondido}
            // El `hidden` solo no basta: una clase `flex` le gana al
            // `display: none` que trae el atributo, y los dos paneles se
            // pintaban encimados. Se esconde con la clase, no con el atributo.
            className={cn("flex-col gap-4", escondido ? "hidden" : "flex")}
          >
            {pestana.contenido}
          </div>
        );
      })}
    </div>
  );
}
