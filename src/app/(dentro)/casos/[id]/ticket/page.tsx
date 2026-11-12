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
      {/* Media de impresión: papel 80×40 mm horizontal, sin márgenes */}
      <style>{`
        @media print {
          @page { size: 80mm 40mm; margin: 0; }
          html, body { margin: 0; padding: 0; background: #fff; }
        }
      `}</style>

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

      {/* Lienzo físico de 8 × 4 cm horizontal, paralelo al corte de la impresora. Preview en pantalla a tamaño real. */}
      <div
        className="mx-auto flex flex-col bg-white font-sans text-black shadow-md print:shadow-none"
        style={{ width: "80mm", height: "40mm", padding: "1.5mm" }}
      >
        {/* Encabezado: empresa + fecha de creación */}
        <div
          className="flex items-baseline justify-between border-b border-black pb-[0.5mm]"
          style={{ fontSize: "6pt" }}
        >
          <span className="font-bold tracking-tight">{ticket.empresa}</span>
          <span>{ticket.fechaCreacion}</span>
        </div>

        {/* Cuerpo: QR a la izquierda, bloque de datos a la derecha */}
        <div className="mt-[1mm] flex min-h-0 flex-1 gap-[2mm]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrSrc}
            alt={`QR del caso ${ticket.folio}`}
            style={{ width: "25mm", height: "25mm" }}
            className="shrink-0 object-contain"
          />

          <div className="flex min-w-0 flex-1 flex-col gap-[0.5mm] leading-tight">
            {/* Folio + cintillo pegados para ganar aire abajo */}
            <div
              className="text-center font-extrabold tracking-tight"
              style={{ fontSize: "14pt", lineHeight: 1 }}
            >
              {ticket.folio}
            </div>
            <div
              className="bg-black text-center font-extrabold uppercase tracking-wider text-white"
              style={{ fontSize: "6pt", padding: "0.6mm 1mm" }}
            >
              {ticket.cintillo}
            </div>

            {/* Datos en grilla 2×2: etiqueta chica arriba, valor grueso debajo */}
            <div
              className="mt-[0.5mm] grid grid-cols-2 gap-x-[1.5mm] gap-y-[0.3mm]"
              style={{ lineHeight: 1.1 }}
            >
              <p className="font-bold uppercase" style={{ fontSize: "4.5pt" }}>
                CONSULTORIO
              </p>
              <p className="font-bold uppercase" style={{ fontSize: "4.5pt" }}>
                PACIENTE
              </p>
              <p
                className="truncate font-semibold"
                style={{ fontSize: "6.5pt" }}
              >
                {ticket.consultorio}
              </p>
              <p className="font-bold" style={{ fontSize: "7pt" }}>
                {ticket.paciente}
              </p>

              <p className="font-bold uppercase" style={{ fontSize: "4.5pt" }}>
                TRABAJO
              </p>
              <p className="font-bold uppercase" style={{ fontSize: "4.5pt" }}>
                COLOR · UNIDADES
              </p>
              <p
                className="truncate font-semibold"
                style={{ fontSize: "6.5pt" }}
              >
                {ticket.trabajo}
              </p>
              <p className="font-bold" style={{ fontSize: "7pt" }}>
                {ticket.colorUnidades}
              </p>
            </div>
          </div>
        </div>

        {/* Franja inferior: ENVIO grande + pie */}
        <div
          className="mt-[1mm] flex items-baseline justify-between gap-[2mm] border-t border-black pt-[0.5mm]"
          style={{ lineHeight: 1.1 }}
        >
          <div className="flex items-baseline gap-[1mm]">
            <span className="font-bold uppercase" style={{ fontSize: "5pt" }}>
              ENVIO
            </span>
            <span
              className="font-extrabold tracking-tight"
              style={{ fontSize: "8pt" }}
            >
              {ticket.fechaEnvio}
            </span>
          </div>
          <span
            className="truncate text-right font-semibold"
            style={{ fontSize: "4.5pt" }}
          >
            {ticket.pie1} · {ticket.pie2}
          </span>
        </div>
      </div>
    </div>
  );
}

