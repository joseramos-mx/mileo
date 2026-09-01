import Link from "next/link";
import { SignOut, ChatCircleDots } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/prisma";
import {
  exigirUsuario,
  esDelLaboratorio,
  esDeLaClinica,
} from "@/lib/autorizacion";
import { ROLES } from "@/lib/vocabulario";
import { Marca } from "@/componentes/Marca";
import { BarraSuperior } from "@/componentes/BarraSuperior";
import { EscuchaNovedades } from "@/componentes/EscuchaNovedades";
import { FichaDeUsuario } from "@/componentes/FichaDeUsuario";
import {
  NavegacionLateral,
  NavegacionInferior,
  EnlacesDeApoyo,
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

  const [clinica, meta] = await Promise.all([
    usuario.clinicaId
      ? prisma.clinica.findUnique({
          where: { id: usuario.clinicaId },
          select: { nombre: true },
        })
      : Promise.resolve(null),
    esDeLaClinica(usuario) ? metaDelMes(usuario) : Promise.resolve(null),
  ]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden lg:flex-row">
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
      {/* El borde de la derecha marca su espacio, y la ficha de la cuenta se
          apoya en el pie ocupando todo el ancho, como el diseño entregado. */}
      <header className="hidden w-72 shrink-0 flex-col border-r border-borde bg-app lg:flex">
        <div className="flex flex-1 flex-col gap-10 overflow-y-auto p-4">
          <Link href="/" className="area-tactil flex items-center px-3 pt-3">
            <Marca tamano="grande" />
          </Link>
          <NavegacionLateral destinos={destinos} />
        </div>

        <div className="px-4 pb-3">
          <EnlacesDeApoyo />
        </div>

        <FichaDeUsuario
          nombre={usuario.nombreCompleto}
          debajo={clinica?.nombre ?? ROLES[usuario.rol]}
          fotoUrl={usuario.fotoUrl}
        />
      </header>

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
        <main
          id="contenido"
          className="flex-1 overflow-x-hidden overflow-y-auto p-3 lg:p-4"
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
