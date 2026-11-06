import Link from "next/link";
import { INDICACIONES } from "@/lib/vocabulario";
import {
  RENDER_DE_CORONA,
  RENDER_DE_IMPLANTE,
  RENDER_DE_MODELO,
  escalaDelRender,
  type Render3D,
} from "@/lib/entrada";
import { MarcoDeImagen } from "@/componentes/MarcoDeImagen";
import { cn } from "@/lib/utilidades";

/**
 * El panel de bienvenida del inicio (SKILL.md §6.10, verdad #1 del producto).
 *
 * Lo primero y más grande de la pantalla es cuántos casos necesitan del doctor.
 * En cinco segundos, sin abrir nada, ya sabe si le toca algo.
 *
 * A la derecha, las categorías con las que puede empezar un caso. Los renders
 * los entrega el equipo de diseño (§9); mientras tanto va el marco.
 */

/** Las tres categorías del diseño entregado, en ese orden. */
const CATEGORIAS: {
  indicacion: keyof typeof INDICACIONES;
  render: Render3D;
}[] = [
  { indicacion: "CORONA_Y_PUENTE", render: RENDER_DE_CORONA },
  { indicacion: "SOBRE_IMPLANTE", render: RENDER_DE_IMPLANTE },
  { indicacion: "MODELO_3D", render: RENDER_DE_MODELO },
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
        "shrink-0 overflow-hidden rounded-panel border border-borde bg-portada",
        "xl:h-[48%] xl:min-h-[18rem] xl:max-h-[32rem] 2xl:min-h-[21rem]",
      )}
    >
      <div className="flex h-full flex-col gap-6 sm:p-6 xl:flex-row xl:items-stretch xl:gap-6 2xl:gap-8 2xl:p-8">
        {/* --- El titular ------------------------------------------------- */}
        <div className="flex shrink-0 flex-col justify-center gap-5 p-6 pb-0 sm:p-0 xl:w-[28%] xl:min-w-56 2xl:w-[33%] 2xl:gap-6 2xl:px-2">
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

        {/* --- Las categorías ---------------------------------------------- */}
        {puedeCrearCasos ? (
          // En celular la tira se desplaza a lo ancho; desde tableta y laptop
          // las tres tarjetas reparten el ancho en rejilla para que ninguna
          // quede partida a la mitad en pantallas medianas.
          <div className="min-w-0 flex-1 max-sm:overflow-x-auto max-sm:p-6 max-sm:pt-0 sin-barra">
            <ul className="flex h-full gap-4 sm:grid sm:grid-cols-3 sm:gap-3 2xl:gap-4">
              {CATEGORIAS.map(({ indicacion, render }) => {
                const { nombre, descripcion } = INDICACIONES[indicacion];
                return (
                  <li
                    key={indicacion}
                    className="h-full w-64 shrink-0 sm:w-auto sm:min-w-0 sm:shrink"
                  >
                    <Link
                      href={`/casos/nuevo?indicacion=${indicacion}`}
                      className={cn(
                        "flex h-full flex-col gap-1.5 overflow-hidden rounded-contenedor bg-categoria p-4 2xl:gap-2 2xl:p-6",
                        "transition-opacity duration-150 hover:opacity-90",
                      )}
                    >
                      <span className="text-realce font-semibold leading-snug text-white 2xl:text-subtitulo">
                        {nombre}
                      </span>
                      <span className="text-menor leading-snug text-white/80">
                        {descripcion}
                      </span>

                      {/* Un hueco cuadrado real en ambos ejes (containerType: size),
                          para que todos los renders guarden la misma proporción
                          tanto en laptops bajas como en monitores grandes. */}
                      <span
                        style={{ containerType: "size" }}
                        className="mt-auto flex min-h-28 flex-1 items-end justify-center pt-2 2xl:min-h-36 2xl:pt-4"
                      >
                        <span className="relative size-[min(100cqw,100cqh)]">
                          {renders[render.ruta] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={encodeURI(render.ruta)}
                              alt=""
                              style={{
                                transform: `scale(${escalaDelRender(render)})`,
                              }}
                              className="size-full object-contain"
                            />
                          ) : (
                            <MarcoDeImagen
                              proporcion="llenar"
                              etiqueta={render.etiqueta}
                              sobreColor
                              className="size-full"
                            />
                          )}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
