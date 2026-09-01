import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirUsuario, filtroDeCasos } from "@/lib/autorizacion";
import { revisarAdmision, sePuedeEnviar } from "@/lib/admision";
import { INDICACIONES } from "@/lib/vocabulario";
import { CapturaDeUnidades } from "./CapturaDeUnidades";
import { ArchivosDelCaso } from "./ArchivosDelCaso";
import { ListaDeAdmision } from "./ListaDeAdmision";

export const metadata: Metadata = { title: "Capturar caso · Mileo" };

/**
 * Alta de caso, segundo paso (SKILL.md O-2).
 *
 * Sigue la cascada: diente → tipo → material → color, y después los archivos.
 * La lista de admisión de abajo bloquea el envío hasta que el caso venga
 * completo, y dice exactamente qué hacer para completarlo.
 */
export default async function PaginaDeCaptura({ params }: PageProps<"/casos/[id]/capturar">) {
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

  // Ancho de verdad: el odontograma es una herradura alta, y encerrarlo en una
  // columna angosta obligaba a bajar tres pantallas para llegar a los archivos.
  // Aquí cabe todo a lo ancho y el doctor lo ve de un vistazo.
  return (
    <div className="mx-auto flex w-full max-w-[110rem] flex-col gap-6 pb-8">
      <header>
        <Link
          href="/"
          className="text-menor text-enlace underline underline-offset-4"
        >
          Regresar al inicio
        </Link>
        <h1 className="mt-2 text-titulo font-semibold text-primario">
          Paciente {caso.paciente.folio} · {caso.paciente.iniciales}
        </h1>
        <p className="mt-1 text-cuerpo text-secundario">
          Paso 2 de 2 · {INDICACIONES[caso.indicacion].nombre}. Guardo solo lo
          que capture.
        </p>
      </header>

      <CapturaDeUnidades
        casoId={caso.id}
        indicacion={caso.indicacion}
        unidadesIniciales={caso.unidades.map((u) => ({
          diente: u.diente,
          rol: u.rol,
          material: u.material,
          color: u.color,
          notas: u.notas,
          puenteId: u.puenteId,
        }))}
      />

      {/* Los archivos y la lista de admisión, uno al lado del otro: son dos
          columnas cortas, no dos pantallas. */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_28rem]">
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
