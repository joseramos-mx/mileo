import type { MarcaCompatible } from "@/lib/entrada";

/**
 * Las marcas de escáner con las que Mileo trabaja, en la portada.
 *
 * Es la promesa del producto puesta a la vista: Mileo es agnóstico de marca, y
 * ésa es su única ventaja estructural. Va sobre fondo blanco porque un
 * logotipo se ve como es sobre blanco.
 *
 * Los logotipos son marcas registradas de sus dueños: los entrega el equipo de
 * diseño en `public/marcas/` y no se dibujan en código (§9). Mientras no
 * lleguen, se enseña el nombre, que dice exactamente lo mismo.
 */
export function MarcasCompatibles({ marcas }: { marcas: MarcaCompatible[] }) {
  return (
    <div className="siempre-claro shrink-0 bg-superficie px-6 py-6">
      <p className="text-center text-minimo text-secundario">
        Trabajo con los escáneres de
      </p>

      <ul className="mx-auto mt-3 grid max-w-md grid-cols-3 overflow-hidden rounded-tarjeta border border-borde">
        {marcas.map((marca, posicion) => (
          <li
            key={marca.nombre}
            className={[
              "flex h-16 items-center justify-center px-3",
              // Rejilla de 3 columnas: rayas entre celdas, no alrededor.
              posicion % 3 !== 2 ? "border-r border-borde" : "",
              posicion < marcas.length - 3 ? "border-b border-borde" : "",
            ].join(" ")}
          >
            {marca.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={marca.logo}
                alt={marca.nombre}
                className="max-h-6 w-auto object-contain"
              />
            ) : (
              <span className="text-menor font-semibold text-primario">
                {marca.nombre}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
