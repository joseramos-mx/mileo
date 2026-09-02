import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/prisma";
import { exigirUsuario, filtroDeCasos } from "@/lib/autorizacion";
import { revisarAdmision, sePuedeEnviar } from "@/lib/admision";
import { resumirUnidades } from "@/lib/casos";
import { PasosDelCaso, pasosDelAlta } from "@/componentes/PasosDelCaso";
import { ArchivosDelCaso } from "./ArchivosDelCaso";
import { ListaDeAdmision } from "./ListaDeAdmision";

export const metadata: Metadata = { title: "Archivos del caso · Mileo" };

/**
 * Alta de caso, paso 3: los archivos y la revisión (SKILL.md O-2).
 *
 * Aquí se sube el escaneo y se revisa que el caso venga completo antes de
 * mandarlo. La lista de admisión bloquea el envío mientras falte algo, y dice
 * qué hacer para completarlo, no qué falló (§6.5). La misma lista corre en el
 * servidor: apagar el botón desde el navegador no sirve de nada.
 */
export default async function PaginaDeArchivos({
  params,
}: PageProps<"/casos/[id]/archivos">) {
  const usuario = await exigirUsuario();
  const { id } = await params;

  const caso = await prisma.caso.findFirst({
    where: { id, ...filtroDeCasos(usuario) },
    include: {
      paciente: true,
      unidades: { orderBy: { diente: "asc" } },
      archivos: { orderBy: { creadoEn: "asc" } },
    },
  });

  if (!caso) notFound();
  if (!caso.esBorrador) redirect(`/casos/${caso.id}`);

  const admision = revisarAdmision(caso);
  const listo = sePuedeEnviar(caso);

  return (
    <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-5 pb-8">
      <header className="flex flex-col gap-3">
        <Link
          href={`/casos/${caso.id}/capturar`}
          className="inline-flex w-fit items-center gap-1.5 text-menor text-enlace underline underline-offset-4"
        >
          <ArrowLeft aria-hidden="true" size={14} />
          Regresar al trabajo
        </Link>

        <PasosDelCaso pasos={pasosDelAlta(caso.id)} actual={3} />

        <div>
          <h1 className="text-titulo font-semibold text-primario">
            Paciente {caso.paciente.folio} · {caso.paciente.iniciales}
          </h1>
          {/* Lo que quedó capturado en el paso anterior, para no tener que
              regresar a verificarlo antes de mandar el caso. */}
          <p className="mt-1 text-cuerpo text-secundario">
            {resumirUnidades(caso.unidades)}
          </p>
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_26rem] xl:items-start">
        <ArchivosDelCaso
          casoId={caso.id}
          archivos={caso.archivos.map((a) => ({
            id: a.id,
            nombre: a.nombre,
            tipo: a.tipo,
            estado: a.estado,
            bytesTotales: Number(a.bytesTotales),
          }))}
        />

        <ListaDeAdmision casoId={caso.id} puntos={admision} listo={listo} />
      </div>
    </div>
  );
}
