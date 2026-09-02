import Link from "next/link";
import { Check } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utilidades";

/**
 * Por dónde va el alta del caso (SKILL.md §6.4).
 *
 * Una tira horizontal arriba de cada paso, para que quien está capturando sepa
 * siempre cuánto lleva y cuánto le falta. Los pasos que ya pasó son enlaces:
 * volver a corregir un dato no debería costar empezar de nuevo (§6.6).
 *
 * El estado no lo dice sólo la forma ni sólo el color (§7): el paso en curso
 * lleva `aria-current="step"`, los cumplidos llevan su palomita con texto
 * escondido, y el número va escrito en todos.
 */

export type PasoDelCaso = {
  numero: number;
  titulo: string;
  /** A dónde lleva, si ya se puede entrar. */
  href?: string;
};

export function PasosDelCaso({
  pasos,
  actual,
  className,
}: {
  pasos: PasoDelCaso[];
  /** El número del paso en el que está parado. */
  actual: number;
  className?: string;
}) {
  return (
    <nav aria-label="Pasos para crear el caso" className={className}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
        {pasos.map((paso, posicion) => {
          const cumplido = paso.numero < actual;
          const enCurso = paso.numero === actual;
          const sePuedeIr = cumplido && paso.href;

          const contenido = (
            <>
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full",
                  "text-minimo font-semibold",
                  enCurso && "bg-accion text-sobre-accion",
                  cumplido && "bg-terminado-fondo text-terminado-texto",
                  !enCurso && !cumplido && "border border-borde text-secundario",
                )}
              >
                {cumplido ? <Check size={14} weight="bold" /> : paso.numero}
              </span>

              <span className="text-menor font-medium wrap-break-word">
                {paso.titulo}
              </span>

              <span className="sr-only">
                {cumplido
                  ? ", ya está"
                  : enCurso
                    ? ", en el que va"
                    : ", falta"}
              </span>
            </>
          );

          return (
            <li key={paso.numero} className="flex items-center gap-2">
              {sePuedeIr ? (
                <Link
                  href={paso.href!}
                  aria-current={enCurso ? "step" : undefined}
                  className={cn(
                    "alto-tactil flex items-center gap-2 rounded-control px-2",
                    "text-primario hover:bg-superficie-suave",
                  )}
                >
                  {contenido}
                </Link>
              ) : (
                <span
                  aria-current={enCurso ? "step" : undefined}
                  className={cn(
                    "alto-tactil flex items-center gap-2 px-2",
                    enCurso ? "text-primario" : "text-secundario",
                  )}
                >
                  {contenido}
                </span>
              )}

              {posicion < pasos.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-px w-6 shrink-0 sm:w-10",
                    cumplido ? "bg-terminado" : "bg-borde",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Los tres pasos del alta, para no repetirlos en cada pantalla. */
export function pasosDelAlta(casoId?: string): PasoDelCaso[] {
  return [
    { numero: 1, titulo: "Paciente" },
    {
      numero: 2,
      titulo: "Trabajo",
      href: casoId ? `/casos/${casoId}/capturar` : undefined,
    },
    {
      numero: 3,
      titulo: "Archivos",
      href: casoId ? `/casos/${casoId}/archivos` : undefined,
    },
  ];
}
