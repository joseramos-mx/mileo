import Link from "next/link";
import { INDICACIONES } from "@/lib/vocabulario";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { RENDER_POR_INDICACION, escalaDelRender } from "@/lib/entrada";
import { MarcoDeImagen } from "@/componentes/MarcoDeImagen";
import { cn } from "@/lib/utilidades";

/**
 * El panel de bienvenida del inicio (SKILL.md §6.10, verdad #1 del producto).
 *
 * Lo primero y más grande de la pantalla es cuántos casos necesitan del doctor.
 * En cinco segundos, sin abrir nada, ya sabe si le toca algo.
 *
 * A la derecha, los seis tipos de trabajo como accesos rápidos para empezar un
 * caso. Los renders los entrega el equipo de diseño (§9); mientras tanto va el
 * marco.
 *
 * Redondeos: el panel lleva el mismo de todas las tarjetas de la app (1 rem) y
 * los accesos rápidos, que van dentro, uno un poco menor (0.75 rem) para que
 * no se vean más redondos que su contenedor.
 */

/** Los seis tipos de trabajo, como accesos rápidos para empezar un caso. */
const ACCESOS: (keyof typeof INDICACIONES)[] = [
  "CORONA_Y_PUENTE",
  "SOBRE_IMPLANTE",
  "INCRUSTACION_Y_CARILLA",
  "PROVISIONAL",
  "GUARDA_OCLUSAL",
  "MODELO_3D",
];

export function PanelDeBienvenida({
  nombreDePila,
  cuantosLeTocan,
  puedeCrearCasos,
  renders,
}: {
  nombreDePila: string;
  cuantosLeTocan: number;
  puedeCrearCasos: boolean;
  /** Qué renders existen ya en /public. */
  renders: Record<string, boolean>;
}) {
  const titular =
    cuantosLeTocan === 0
      ? "No tiene nada pendiente"
      : cuantosLeTocan === 1
        ? "1 caso necesita de usted"
        : `${cuantosLeTocan} casos necesitan de usted`;

  return (
    // El panel sigue el tema. Era una isla oscura —negra en medio de una
    // pantalla clara—, y quedaba como un hueco. En claro es una superficie
    // más, con su borde, igual que las demás tarjetas; en oscuro se queda con
    // el azul casi negro del diseño entregado. La presencia se la dan las tres
    // categorías azules, que no cambian con el tema.
    //
    // En escritorio se queda con la mitad del alto, como el diseño entregado:
    // el titular y las categorías mandan, y lo de abajo cabe en lo que sobra.
    <section
      aria-labelledby="bienvenida"
      className={cn(
        "filo-de-luz shrink-0 overflow-hidden rounded-contenedor bg-portada/70 backdrop-blur-xl",
        "xl:h-[48%] xl:min-h-[20rem] xl:max-h-[32rem]",
      )}
    >
      <div className="flex h-full flex-col gap-6 p-6 xl:flex-row xl:items-stretch 2xl:gap-8">
        {/* --- El titular ------------------------------------------------- */}
        <div className="flex shrink-0 flex-col justify-center gap-5 xl:w-[28%] xl:min-w-56 2xl:w-[30%] 2xl:gap-6 2xl:px-2">
          <div>
            <p className="text-cuerpo text-secundario">
              ¡Hola, {nombreDePila}!
            </p>
            <h1
              id="bienvenida"
              className="mt-2 text-titulo font-normal text-primario sm:text-[2.25rem] sm:leading-[1.08] 2xl:text-titular"
            >
              {titular}
            </h1>
          </div>

          <Link
            href="/casos"
            className={cn(
              "area-tactil inline-flex w-fit items-center rounded-full bg-accion px-6",
              "text-cuerpo font-medium text-sobre-accion",
              "transition-colors duration-150 hover:bg-accion-encima",
            )}
          >
            Ver mis casos
          </Link>
        </div>

        {/* --- Accesos rápidos ------------------------------------------- */}
        {/* Tarjetas apaisadas: el nombre arriba a la izquierda, "Empezar caso"
            abajo y el render a la derecha, entero dentro de la tarjeta.
            La primera va en azul lleno, como la destacada; las demás, de
            vidrio con un halo de luz detrás de la pieza. */}
        {puedeCrearCasos ? (
          <nav aria-label="Empezar un caso nuevo" className="min-w-0 flex-1">
            <ul className="grid h-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-rows-2">
              {ACCESOS.map((indicacion, posicion) => {
                const { nombre, descripcion } = INDICACIONES[indicacion];
                const render = RENDER_POR_INDICACION[indicacion];
                const destacada = posicion === 0;
                return (
                  <li key={indicacion} className="min-h-36 xl:min-h-0">
                    <Link
                      href={`/casos/nuevo?indicacion=${indicacion}`}
                      className={cn(
                        "group relative isolate flex h-full flex-col justify-between overflow-hidden rounded-tarjeta p-5",
                        destacada
                          ? "filo-de-luz bg-linear-to-br from-accion to-[color-mix(in_oklab,var(--color-accion),black_45%)] text-white"
                          : "vidrio vidrio-toque text-primario",
                      )}
                    >
                      {/* Halo detrás de la pieza. */}
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute -right-[10%] -bottom-[30%] -z-10 aspect-square h-[130%] rounded-full blur-2xl"
                        style={{
                          background: destacada
                            ? "radial-gradient(closest-side, rgb(255 255 255 / 0.16), transparent)"
                            : "radial-gradient(closest-side, color-mix(in oklab, var(--color-accion) 14%, transparent), transparent)",
                        }}
                      />

                      {/* La pieza, entera dentro de la tarjeta: un cuadro del
                          alto de la tarjeta menos su orilla, y el objeto escalado
                          para ocupar a lo más el 90% de ese cuadro. */}
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-3 right-3 -z-10 aspect-square"
                      >
                        {render && renders[render.ruta] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={encodeURI(render.ruta)}
                            alt=""
                            style={{
                              transform: `scale(${escalaDelRender(render, 0.9)})`,
                            }}
                            className="size-full object-contain drop-shadow-[0_6px_10px_rgb(0_0_0/0.12)] transition-transform duration-500 ease-out group-hover:rotate-[-3deg]"
                          />
                        ) : (
                          <MarcoDeImagen
                            proporcion="llenar"
                            etiqueta={render?.etiqueta ?? nombre}
                            className="size-full"
                          />
                        )}
                      </span>

                      <span className="flex max-w-[58%] flex-col">
                        <span className="text-realce leading-tight font-semibold 2xl:text-subtitulo">
                          {nombre}
                        </span>
                        <span
                          className={cn(
                            "mt-1 text-menor leading-snug",
                            destacada ? "text-white/70" : "text-secundario",
                          )}
                        >
                          {descripcion}
                        </span>
                      </span>

                      <span className="mt-4 flex items-center gap-2.5">
                        <span
                          className={cn(
                            "flex size-7 items-center justify-center rounded-full transition-transform duration-150 group-hover:rotate-45",
                            destacada
                              ? "bg-white text-accion"
                              : "bg-primario text-app",
                          )}
                        >
                          <ArrowUpRight
                            aria-hidden="true"
                            size={14}
                            weight="bold"
                          />
                        </span>
                        <span
                          className={cn(
                            "text-minimo font-medium tracking-wide uppercase",
                            destacada ? "text-white/90" : "text-secundario",
                          )}
                        >
                          Empezar caso
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        ) : null}
      </div>
    </section>
  );
}
