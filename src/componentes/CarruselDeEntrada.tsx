"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import type { Diapositiva } from "@/lib/entrada";
import { MarcoDeImagen } from "@/componentes/MarcoDeImagen";
import { cn } from "@/lib/utilidades";

/**
 * El carrusel de la portada.
 *
 * Se mueve sólo cuando alguien lo mueve: nada de avance automático, que roba la
 * atención de quien está escribiendo su contraseña al lado (§5.5). Las dos
 * flechas son botones de verdad, así que funcionan con teclado, y el cambio se
 * anuncia en una región viva para quien no ve la foto.
 */
export function CarruselDeEntrada({
  diapositivas,
}: {
  diapositivas: Diapositiva[];
}) {
  const [indice, setIndice] = useState(0);
  const actual = diapositivas[indice];
  const cuantas = diapositivas.length;

  function mover(paso: number) {
    setIndice((previo) => (previo + paso + cuantas) % cuantas);
  }

  return (
    <div className="relative flex-1 overflow-hidden bg-superficie-suave">
      {actual.imagen ? (
        // Foto entregada por el equipo de diseño.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={actual.imagen}
          alt={actual.etiqueta}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        // Todavía no hay foto: se enseña qué va aquí, no se dibuja (§9).
        <MarcoDeImagen
          proporcion="llenar"
          etiqueta={actual.etiqueta}
          className="absolute inset-0 rounded-none"
        />
      )}

      {/* Sólo las dos flechas. La foto habla sola. */}
      {cuantas > 1 ? (
        <div className="absolute right-5 bottom-5 flex gap-2">
          <Flecha
            hacia="anterior"
            alTocar={() => mover(-1)}
            etiqueta="Ver la foto anterior"
          />
          <Flecha
            hacia="siguiente"
            alTocar={() => mover(1)}
            etiqueta="Ver la siguiente foto"
          />
        </div>
      ) : null}

      <p aria-live="polite" className="sr-only">
        Foto {indice + 1} de {cuantas}: {actual.etiqueta}
      </p>
    </div>
  );
}

function Flecha({
  hacia,
  alTocar,
  etiqueta,
}: {
  hacia: "anterior" | "siguiente";
  alTocar: () => void;
  etiqueta: string;
}) {
  return (
    <button
      type="button"
      onClick={alTocar}
      className={cn(
        "area-tactil flex items-center justify-center rounded-control",
        "border border-white/30 bg-black/40 text-white",
        "transition-colors duration-150 hover:bg-black/60",
      )}
    >
      {hacia === "anterior" ? (
        <ArrowLeft aria-hidden="true" size={18} />
      ) : (
        <ArrowRight aria-hidden="true" size={18} />
      )}
      <span className="sr-only">{etiqueta}</span>
    </button>
  );
}
