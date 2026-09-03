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
        "lg:h-[50%] lg:max-h-[32rem]",
      )}
    >
      <div className="flex h-full flex-col gap-8 xl:flex-row xl:items-stretch">
        {/* --- El titular ------------------------------------------------- */}
        <div className="flex shrink-0 flex-col justify-center gap-6 p-8 xl:w-[36%] xl:p-10">
          <div>
            <p className="text-cuerpo text-secundario">
              ¡Hola, {nombreDePila}!
            </p>
            <h1
              id="bienvenida"
              className="mt-2 text-titulo font-normal text-primario sm:text-[2.5rem] sm:leading-[1.05] xl:text-titular"
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
          // La tira se desplaza a lo ancho: caben los tipos de trabajo que se
          // agreguen después sin apretar los que ya están. Se llega a ellos
          // con el dedo, con la rueda y con el tabulador, porque cada tarjeta
          // es un enlace y el navegador la trae sola al foco.
          <div className="min-w-0 flex-1 overflow-x-auto p-8 pt-0 sin-barra xl:py-8 xl:pr-0 xl:pl-0">
            <ul className="flex h-full gap-4">
              {CATEGORIAS.map(({ indicacion, render }) => {
                const { nombre, descripcion } = INDICACIONES[indicacion];
                return (
                  <li key={indicacion} className="h-full w-72 shrink-0">
                    <Link
                      href={`/casos/nuevo?indicacion=${indicacion}`}
                      className={cn(
                        "flex h-full flex-col gap-2 overflow-hidden rounded-contenedor bg-categoria p-6",
                        "transition-opacity duration-150 hover:opacity-90",
                      )}
                    >
                      <span className="text-subtitulo font-semibold text-white">
                        {nombre}
                      </span>
                      <span className="text-menor text-white/80">
                        {descripcion}
                      </span>

                      {/* Un hueco cuadrado, y dentro el render agrandado a la
                          medida para que todos se vean del mismo tamaño aunque
                          cada archivo traiga distinto aire alrededor. */}
                      <span className="mt-auto flex min-h-0 flex-1 items-end justify-center pt-4">
                        {/* Cuadrado de verdad, medido por el ancho de la
                            tarjeta. Si se dejara mandar por el alto, en una
                            pantalla alta el hueco se estira, `object-contain`
                            deja de encuadrar por el mismo lado y la cuenta que
                            iguala los renders se descuadra: el implante volvía
                            a verse más grande que la corona. */}
                        <span className="relative aspect-square w-full max-h-full">
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
