import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirLaboratorio } from "@/lib/autorizacion";
import { KIT_POR_INDICACION, mismaPersonaEnDisenoYCalidad } from "@/lib/calidad";
import { resumirUnidades } from "@/lib/casos";
import { FormularioDeCalidad } from "./FormularioDeCalidad";

export const metadata: Metadata = { title: "Control de calidad · Mileo" };

/**
 * Control de calidad y envío (SKILL.md O-6).
 *
 * Pantalla de celular: se usa de pie, junto a la caja, con la pieza en la mano.
 *
 * Va entera sobre fondo neutro claro, sin importar el tema: aquí se juzga el
 * color de la pieza y se ven sus fotos, y eso no se hace sobre negro (§5.1).
 */
export default async function PaginaDeCalidad({
  params,
}: PageProps<"/casos/[id]/calidad">) {
  const usuario = await exigirLaboratorio();
  const { id } = await params;

  const caso = await prisma.caso.findUnique({
    where: { id },
    include: {
      paciente: true,
      doctor: { select: { nombreCompleto: true } },
      tecnico: { select: { id: true, nombreCompleto: true } },
      unidades: { select: { diente: true, rol: true, material: true } },
      archivos: { orderBy: { creadoEn: "desc" } },
      controlDeCalidad: true,
    },
  });

  if (!caso) notFound();
  if (caso.controlDeCalidad) redirect(`/casos/${caso.id}`);

  const chocaConElDiseno = mismaPersonaEnDisenoYCalidad(
    caso.tecnicoId,
    usuario.id,
  );

  return (
    <div className="siempre-claro mx-auto flex w-full max-w-2xl flex-col gap-6 rounded-contenedor p-4 pb-8">
      <header>
        <Link
          href={`/casos/${caso.id}`}
          className="text-menor text-enlace underline underline-offset-4"
        >
          Regresar al caso
        </Link>
        <h1 className="mt-2 text-titulo font-semibold text-primario">
          Control de calidad
        </h1>
        <p className="mt-1 text-cuerpo text-secundario">
          Paciente {caso.paciente.folio} · {caso.paciente.iniciales} · caso{" "}
          {caso.folio} · {caso.doctor.nombreCompleto}
        </p>
        <p className="mt-1 text-menor text-secundario">
          {resumirUnidades(caso.unidades)}
        </p>
      </header>

      {chocaConElDiseno ? (
        <p
          role="status"
          className="rounded-contenedor border border-pendiente/40 bg-pendiente-fondo p-4 text-cuerpo text-pendiente-texto"
        >
          Usted diseñó este caso. Quien diseña no cierra su propio control de
          calidad: pídale a alguien más que lo revise, o que dirección lo
          autorice abajo. La autorización queda en la bitácora.
        </p>
      ) : null}

      <FormularioDeCalidad
        casoId={caso.id}
        indicacion={caso.indicacion}
        piezasDelKit={KIT_POR_INDICACION[caso.indicacion]}
        chocaConElDiseno={chocaConElDiseno}
        archivos={caso.archivos.map((a) => ({
          id: a.id,
          nombre: a.nombre,
          tipo: a.tipo,
          estado: a.estado,
          bytesTotales: Number(a.bytesTotales),
        }))}
      />
    </div>
  );
}
