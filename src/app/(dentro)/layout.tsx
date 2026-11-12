import Link from "next/link";
import { cookies } from "next/headers";
import { SignOut, ChatCircleDots } from "@phosphor-icons/react/dist/ssr";
import {
  exigirUsuario,
  esDelLaboratorio,
  esDeLaClinica,
} from "@/lib/autorizacion";
import { Marca } from "@/componentes/Marca";
import { BarraSuperior } from "@/componentes/BarraSuperior";
import { EscuchaNovedades } from "@/componentes/EscuchaNovedades";
import { BarraLateral, COOKIE_DE_LA_BARRA } from "@/componentes/BarraLateral";
import {
  NavegacionInferior,
  DESTINOS_DE_LA_CLINICA,
  DESTINOS_DEL_LABORATORIO,
} from "@/componentes/Navegacion";
import { salir } from "@/app/acciones-sesion";
import { metaDelMes } from "@/lib/inicio";

/**
 * La envolvente de Mileo, como el diseño entregado: barra lateral negra a la
 * izquierda y el contenido a la derecha, con su barra de arriba.
 *
 * Ocupa exactamente la pantalla y el contenido se desplaza dentro, para que la
 * navegación de abajo del celular nunca se encime sobre lo que se puede tocar.
 */
export default async function DisposicionDentro({
  children,
}: LayoutProps<"/">) {
  const usuario = await exigirUsuario();
  const delLaboratorio = esDelLaboratorio(usuario);
  const destinos = delLaboratorio
    ? DESTINOS_DEL_LABORATORIO
    : DESTINOS_DE_LA_CLINICA;

  const [meta, galletas] = await Promise.all([
    esDeLaClinica(usuario) ? metaDelMes(usuario) : Promise.resolve(null),
    cookies(),
  ]);
  const barraPlegada = galletas.get(COOKIE_DE_LA_BARRA)?.value === "1";

  // `relative` no es decoración: sin un ancestro posicionado, todo lo que va en
  // absoluto —empezando por los textos de `sr-only`, que Tailwind pone así— se
  // cuelga del bloque inicial. Ahí no lo recorta el overflow de nadie, y el que
  // cae al fondo de una lista larga estira el documento entero: la ventana se
  // desplazaba y la barra lateral se iba para arriba.
  return (
    <div className="relative flex h-dvh flex-col overflow-hidden lg:flex-row">
      {/* Mantiene al día lo que ve el doctor cuando el laboratorio mueve un caso. */}
      <EscuchaNovedades />

      {/* Primer tabulador de cada pantalla: saltarse la navegación. */}
      <a
        href="#contenido"
        className="salto-al-contenido area-tactil rounded-control border border-borde bg-superficie px-4 py-2 text-cuerpo"
      >
        Ir al contenido
      </a>

      {/* --- Barra lateral, escritorio ------------------------------------ */}
      <BarraLateral
        delLaboratorio={delLaboratorio}
        plegadaAlInicio={barraPlegada}
        marca={<Marca tamano="grande" />}
        marcaCompacta={<Marca tamano="grande" soloIcono />}
        usuario={{
          nombre: usuario.nombreCompleto,
          correo: usuario.correo,
          fotoUrl: usuario.fotoUrl,
        }}
      />

      {/* --- Encabezado de celular ---------------------------------------- */}
      <header className="flex items-center justify-between gap-2 border-b border-borde bg-superficie px-4 py-3 lg:hidden">
        <Link href="/" className="flex min-w-0 items-center overflow-hidden">
          <Marca />
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          <Link
            href="/ayuda"
            className="area-tactil flex items-center justify-center rounded-control text-secundario"
          >
            <ChatCircleDots aria-hidden="true" size={20} />
            <span className="sr-only">Ayuda y chat</span>
          </Link>
          <form action={salir}>
            <button
              type="submit"
              className="area-tactil flex items-center justify-center rounded-control text-secundario"
            >
              <SignOut aria-hidden="true" size={20} />
              <span className="sr-only">Salir de Mileo</span>
            </button>
          </form>
        </div>
      </header>

      {/* --- Contenido ----------------------------------------------------- */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* `relative` otra vez, y aquí es el que cuenta: ancla los absolutos
            del contenido a la caja que se desplaza, no al documento. */}
        <main
          id="contenido"
          className="relative flex-1 overflow-x-hidden overflow-y-auto p-3 lg:p-4"
        >
          {/* Márgenes mínimos: el contenido casi toca los bordes, como el
              diseño entregado. */}
          <div className="flex w-full flex-col gap-4">
            <div className="hidden lg:block">
              <BarraSuperior meta={meta} puedeCrearCasos={!delLaboratorio} />
            </div>
            {children}
          </div>
        </main>
        <NavegacionInferior destinos={destinos} />
      </div>
    </div>
  );
}
