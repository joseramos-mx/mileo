import { SignOut } from "@phosphor-icons/react/dist/ssr";
import { MarcoDeImagen } from "@/componentes/MarcoDeImagen";
import { salir } from "@/app/acciones-sesion";

/**
 * Quién está usando Mileo, al pie de la barra lateral, con la salida a la mano
 * (SKILL.md §6.9).
 *
 * El punto verde dice que la sesión está abierta, y lo dice también con
 * palabras: el color nunca es el único portador de información (§7).
 */
export function FichaDeUsuario({
  nombre,
  debajo,
  fotoUrl,
}: {
  nombre: string;
  debajo: string;
  fotoUrl: string | null;
}) {
  return (
    // Ocupa todo el ancho de la barra lateral y se apoya en su borde de abajo,
    // como en el diseño entregado.
    <div className="flex items-center gap-3 rounded-t-contenedor bg-superficie p-4">
      <div className="relative size-12 shrink-0">
        {fotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fotoUrl}
            alt=""
            className="size-12 rounded-full object-cover"
          />
        ) : (
          <MarcoDeImagen
            proporcion="1/1"
            etiqueta=""
            className="size-12 rounded-full p-0"
          />
        )}
        <span
          aria-hidden="true"
          className="absolute right-0 bottom-0 size-3 rounded-full border-2 border-superficie bg-terminado"
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-cuerpo font-semibold text-primario">
          {nombre}
        </p>
        <p className="truncate text-menor text-secundario">{debajo}</p>
        <span className="sr-only">Su sesión está abierta.</span>
      </div>

      <form action={salir}>
        <button
          type="submit"
          className="area-tactil flex items-center justify-center rounded-control bg-superficie-suave text-secundario hover:text-primario"
        >
          <SignOut aria-hidden="true" size={18} />
          <span className="sr-only">Salir de Mileo</span>
        </button>
      </form>
    </div>
  );
}
