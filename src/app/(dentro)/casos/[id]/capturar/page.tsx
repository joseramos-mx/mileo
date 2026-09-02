import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/prisma";
import { exigirUsuario, filtroDeCasos } from "@/lib/autorizacion";
import { PasosDelCaso, pasosDelAlta } from "@/componentes/PasosDelCaso";
import { BotonEnlace } from "@/componentes/Boton";
import { desdeLaBase } from "@/lib/tramos";
import { CapturaDeUnidades } from "./CapturaDeUnidades";

export const metadata: Metadata = { title: "Capturar caso · Mileo" };

/**
 * Alta de caso, paso 2: el trabajo (SKILL.md O-2).
 *
 * Sólo el odontograma y lo que lleva cada diente. Los archivos y la lista de
 * admisión se fueron al paso 3: mezclarlos aquí obligaba a bajar media pantalla
 * con el dibujo todavía a medio llenar, y el escaneo se subía antes de saber
 * qué se iba a fabricar.
 */
export default async function PaginaDeCaptura({
  params,
}: PageProps<"/casos/[id]/capturar">) {
  const usuario = await exigirUsuario();
  const { id } = await params;

  const caso = await prisma.caso.findFirst({
    where: { id, ...filtroDeCasos(usuario) },
    include: {
      paciente: true,
      unidades: { orderBy: { diente: "asc" } },
    },
  });

  if (!caso) notFound();
  if (!caso.esBorrador) redirect(`/casos/${caso.id}`);

  // Ancho de verdad: el odontograma es una herradura alta, y encerrarlo en una
  // columna angosta obligaba a bajar tres pantallas para verlo entero.
  return (
    <div className="mx-auto flex w-full max-w-[110rem] flex-col gap-5 pb-8">
      <header className="flex flex-col gap-3">
        <Link
          href="/"
          className="text-menor text-enlace underline underline-offset-4"
        >
          Regresar al inicio
        </Link>

        <PasosDelCaso pasos={pasosDelAlta(caso.id)} actual={2} />

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-titulo font-semibold text-primario">
              Paciente {caso.paciente.folio} · {caso.paciente.iniciales}
            </h1>
            <p className="mt-1 text-cuerpo text-secundario">
              Guardo solo lo que capture; si se sale, lo encuentra igual.
            </p>
          </div>

          <BotonEnlace href={`/casos/${caso.id}/archivos`} tono="principal">
            Continuar a los archivos
            <ArrowRight aria-hidden="true" size={16} />
          </BotonEnlace>
        </div>
      </header>

      <CapturaDeUnidades
        casoId={caso.id}
        catalogoCompleto={usuario.catalogoCompleto}
        unidadesIniciales={caso.unidades.map(desdeLaBase)}
      />
    </div>
  );
}
