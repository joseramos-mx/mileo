"use client";

import { useState } from "react";
import { MarcoDeImagen } from "@/componentes/MarcoDeImagen";
import { cn } from "@/lib/utilidades";

/**
 * El retrato del diseño del caso.
 *
 * Es la misma pieza que el doctor gira en la pantalla de aprobación, dibujada
 * una vez en el servidor y servida como imagen. Antes esto abría un contexto
 * WebGL por cuadro: en el inicio, con cuatro diseños y una columna de casos, el
 * navegador llegaba a su tope de contextos vivos, empezaba a tirarlos, y unas
 * tarjetas se quedaban en blanco mientras otras no. Y gastaba batería pintando
 * algo que nadie iba a girar (§5.5).
 *
 * Va sobre fondo neutro claro, como todo lo que enseña una pieza (§5.1). Si el
 * caso todavía no tiene diseño, o el retrato no se pudo traer, se enseña el
 * marco con la descripción (§9): nunca un cuadro roto.
 */
export function VistaDelDiseno({
  archivoDeMallaId,
  descripcion,
  proporcion = "4/3",
  className,
}: {
  /** La malla ligera del caso, o null si todavía no hay diseño. */
  archivoDeMallaId: string | null;
  /**
   * Qué se está viendo. Vacía cuando el retrato va al lado de un texto que ya
   * lo dice: entonces la imagen es decorativa y no se anuncia dos veces.
   */
  descripcion: string;
  /**
   * "1/1" es la miniatura de la lista, y pide el retrato chico: un cuadrito de
   * 40 px no necesita los 320 de la tarjeta grande.
   */
  proporcion?: "4/3" | "1/1";
  className?: string;
}) {
  const [fallo, setFallo] = useState(false);

  if (!archivoDeMallaId || fallo) {
    return (
      <MarcoDeImagen
        proporcion={proporcion}
        etiqueta={descripcion}
        className={className}
      />
    );
  }

  const decorativo = descripcion.trim().length === 0;

  return (
    <span
      className={cn(
        "block w-full overflow-hidden rounded-tarjeta bg-superficie",
        proporcion === "1/1" ? "aspect-square" : "aspect-4/3",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/archivos/${archivoDeMallaId}/vista${proporcion === "1/1" ? "?tamano=chico" : ""}`}
        alt={decorativo ? "" : descripcion}
        onError={() => setFallo(true)}
        className="size-full object-contain"
      />
    </span>
  );
}
