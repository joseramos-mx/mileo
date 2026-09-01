import { cn } from "@/lib/utilidades";

/**
 * Marco de imagen (SKILL.md §5.4 "ImagePlaceholder", §9).
 *
 * Regla dura: no se recrean imágenes con CSS, HTML ni SVG. Nada de dientes,
 * coronas, escáneres ni guías dibujados a mano en código. Donde falta un render
 * real va este bloque neutro con borde punteado y la etiqueta de qué debe ir
 * ahí. El equipo de diseño los reemplaza con renders generados desde los STL
 * del laboratorio; hasta entonces el marco se queda visible.
 */

type Proporcion = "1/1" | "4/3" | "16/9" | "3/4" | "llenar";

const proporciones: Record<Proporcion, string> = {
  "1/1": "aspect-square",
  "4/3": "aspect-4/3",
  "16/9": "aspect-video",
  "3/4": "aspect-3/4",
  // Toma el tamaño de su contenedor, para cuando el hueco ya está definido.
  llenar: "h-full",
};

export function MarcoDeImagen({
  proporcion = "4/3",
  etiqueta,
  sobreColor = false,
  className,
}: {
  proporcion?: Proporcion;
  /**
   * Qué imagen va aquí, descrita para el equipo de diseño y para quien no ve.
   * Vacía cuando el hueco es puramente decorativo —una miniatura al lado de un
   * texto que ya lo dice todo—: entonces el marco se esconde de los lectores de
   * pantalla en vez de anunciarse sin nombre.
   */
  etiqueta: string;
  /** Sobre un fondo de color, donde el gris del tema no alcanza contraste. */
  sobreColor?: boolean;
  className?: string;
}) {
  const decorativo = etiqueta.trim().length === 0;

  return (
    <div
      {...(decorativo
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": etiqueta })}
      className={cn(
        proporciones[proporcion],
        "flex w-full items-center justify-center",
        "rounded-tarjeta border border-dashed p-4 text-center",
        sobreColor
          ? "border-white/40 bg-white/5"
          : "border-borde bg-superficie-suave",
        className,
      )}
    >
      {decorativo ? null : (
        <span
          className={cn(
            "text-menor",
            sobreColor ? "text-white/80" : "text-secundario",
          )}
        >
          {etiqueta}
        </span>
      )}
    </div>
  );
}
