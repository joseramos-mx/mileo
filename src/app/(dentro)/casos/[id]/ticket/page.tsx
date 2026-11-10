import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirUsuario, filtroDeCasos } from "@/lib/autorizacion";
import { prisma } from "@/lib/prisma";
import { armarTicketDelCaso } from "@/lib/ticket";
import { BotonImprimirNavegador } from "./BotonImprimirNavegador";

export const metadata: Metadata = { title: "Ticket · Mileo" };

export default async function PaginaDeTicket({
  params,
}: PageProps<"/casos/[id]/ticket">) {
  const usuario = await exigirUsuario();
  const { id } = await params;

  const caso = await prisma.caso.findFirst({
    where: { id, ...filtroDeCasos(usuario) },
    select: { id: true },
  });
  if (!caso) notFound();

  const ticket = await armarTicketDelCaso(caso.id);
  if (!ticket) notFound();

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&data=${encodeURIComponent(ticket.urlQr)}`;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 pb-10">
      <div className="flex flex-col gap-3 print:hidden">
        <Link
          href={`/casos/${caso.id}`}
          className="text-menor text-enlace underline underline-offset-4"
        >
          Regresar al caso
        </Link>
        <h1 className="text-titulo font-semibold text-primario">
          Ticket del caso
        </h1>
        <p className="text-menor text-secundario">
          Este ticket se envía a imprimir automáticamente al crear el caso.
          También puede mandarlo a imprimir desde aquí.
        </p>
        <BotonImprimirNavegador casoId={caso.id} />
      </div>

      {/* Lienzo físico de 80 mm (proporción 576px térmico en blanco y negro puro) */}
      <div className="mx-auto w-full max-w-[380px] rounded-tarjeta border border-black/20 bg-white p-5 font-sans text-black shadow-md print:max-w-none print:border-none print:p-0 print:shadow-none">
        {/* Encabezado */}
        <div className="flex items-baseline justify-between border-b-2 border-black pb-2 text-xs font-bold tracking-tight">
          <span>{ticket.empresa}</span>
          <span className="font-medium">{ticket.fechaCreacion}</span>
        </div>

        {/* Folio gigante */}
        <div className="py-2 text-center text-4xl font-extrabold tracking-tight text-black">
          {ticket.folio}
        </div>

        {/* Cintillo invertido negro */}
        <div className="bg-black px-3 py-1.5 text-center text-lg font-extrabold tracking-wider text-white">
          {ticket.cintillo}
        </div>

        {/* Bloque central: QR a la izquierda + 4 campos a la derecha */}
        <div className="mt-4 grid grid-cols-[132px_1fr] items-start gap-3.5 border-b-2 border-black pb-4">
          <div className="flex items-center justify-center bg-white p-0.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrSrc}
              alt={`QR del caso ${ticket.folio}`}
              className="size-[128px] object-contain"
            />
          </div>

          <div className="flex min-w-0 flex-col gap-1.5 text-left leading-tight">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-black/80">
                CONSULTORIO
              </p>
              <p className="truncate text-sm font-semibold text-black">
                {ticket.consultorio}
              </p>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-black/80">
                PACIENTE
              </p>
              <p className="text-base font-bold text-black">
                {ticket.paciente}
              </p>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-black/80">
                TRABAJO
              </p>
              <p className="text-sm font-semibold text-black">
                {ticket.trabajo}
              </p>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-black/80">
                COLOR · UNIDADES
              </p>
              <p className="text-base font-bold text-black">
                {ticket.colorUnidades}
              </p>
            </div>
          </div>
        </div>

        {/* Fecha de entrega */}
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-xs font-extrabold uppercase tracking-wider text-black">
            ENTREGA
          </span>
          <span className="text-2xl font-extrabold tracking-tight text-black">
            {ticket.fechaEntrega}
          </span>
        </div>

        {/* Pie del ticket */}
        <div className="mt-2 flex flex-col gap-0.5 text-xs text-black">
          <p className="font-semibold">{ticket.pie1}</p>
          <p className="text-black/80">{ticket.pie2}</p>
        </div>
      </div>
    </div>
  );
}

