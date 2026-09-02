import fs from "node:fs";
import path from "node:path";
import { cn } from "@/lib/utilidades";

/**
 * La marca Mileo.
 *
 * Usa el `public/logo.svg` que entregó el equipo de diseño. Se pinta en línea,
 * no con una etiqueta de imagen, por una sola razón: el logotipo viene con la
 * palabra en casi blanco, hecho para fondo oscuro, y así se puede dejar que la
 * palabra siga al tema mientras el asterisco conserva el azul de marca. La
 * forma no se toca; sólo se cambia ese color por `currentColor`.
 *
 * Si el archivo no está, se dibuja el asterisco de respaldo: es lo único que
 * §9 permite dibujar en código, porque es la propia marca y no una imagen de
 * producto.
 */

const BLANCO_DEL_LOGOTIPO = /#fafafa/gi;

let enMemoria: string | null | undefined;

function leerLogotipo() {
  if (enMemoria !== undefined) return enMemoria;

  const archivo = path.join(process.cwd(), "public", "logo.svg");
  try {
    enMemoria = fs
      .readFileSync(archivo, "utf8")
      // La palabra sigue al tema; el asterisco se queda azul.
      .replace(BLANCO_DEL_LOGOTIPO, "currentColor")
      // El tamaño lo manda el contenedor, no el archivo.
      .replace(/<svg([^>]*)\swidth="[^"]*"/i, "<svg$1")
      .replace(/<svg([^>]*)\sheight="[^"]*"/i, "<svg$1")
      .replace(/<svg /i, '<svg aria-hidden="true" focusable="false" ');
  } catch {
    enMemoria = null;
  }
  return enMemoria;
}

export function Marca({
  className,
  tamano = "normal",
}: {
  className?: string;
  /** "grande" es para la portada y la barra lateral. */
  tamano?: "normal" | "grande";
}) {
  const logotipo = leerLogotipo();
  const grande = tamano === "grande";

  return (
    <span
      className={cn(
        "inline-flex items-center text-primario",
        grande ? "h-7" : "h-7",
        className,
      )}
    >
      {logotipo ? (
        <span
          className="block h-full [&>svg]:block [&>svg]:h-full [&>svg]:w-auto"
          dangerouslySetInnerHTML={{ __html: logotipo }}
        />
      ) : (
        <MarcaDeRespaldo grande={grande} />
      )}
      <span className="sr-only">Mileo, de RMS Zahnfacturing</span>
    </span>
  );
}

/** Mientras no esté el archivo del equipo de diseño. */
function MarcaDeRespaldo({ grande }: { grande: boolean }) {
  return (
    <span className={cn("inline-flex items-center", grande ? "gap-3" : "gap-2")}>
      <svg
        viewBox="0 0 24 24"
        className={cn("shrink-0", grande ? "size-9" : "size-6")}
        aria-hidden="true"
        focusable="false"
      >
        <g
          stroke="var(--azul-600)"
          strokeWidth="2.6"
          strokeLinecap="round"
          fill="none"
        >
          <path d="M12 3.5v17" />
          <path d="M4.6 7.75l14.8 8.5" />
          <path d="M4.6 16.25l14.8-8.5" />
        </g>
      </svg>
      <span
        className={cn(
          "leading-none font-semibold tracking-tight",
          grande ? "text-[2.25rem]" : "text-titulo",
        )}
      >
        mileo
      </span>
    </span>
  );
}
