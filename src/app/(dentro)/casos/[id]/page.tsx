import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/prisma";
import {
  exigirUsuario,
  filtroDeCasos,
  esDelLaboratorio,
  puedeAprobarDisenos,
} from "@/lib/autorizacion";
import { ChipDeEtapa } from "@/componentes/ChipDeEtapa";
import { MarcoDeImagen } from "@/componentes/MarcoDeImagen";
import { resumirUnidades } from "@/lib/casos";
import {
  COLORES_VITA,
  ETAPAS,
  INDICACIONES,
  MATERIALES,
  TIPOS_DE_ARCHIVO,
  ROLES_DE_UNIDAD,
  nombreDelDiente,
} from "@/lib/vocabulario";
import { fechaCorta, cuandoFalta, fechaConHora, paraMaquina } from "@/lib/fechas";
import { enTamano } from "@/lib/formato";
import { LineaDeTiempo } from "./LineaDeTiempo";
import { Aprobacion } from "./Aprobacion";
import { Chat } from "./Chat";
import { ControlesDelLaboratorio } from "./ControlesDelLaboratorio";

export const metadata: Metadata = { title: "Caso · Mileo" };

export default async function PaginaDeCaso({
  params,
  searchParams,
}: PageProps<"/casos/[id]">) {
  const usuario = await exigirUsuario();
  const { id } = await params;
  const consulta = await searchParams;

  const caso = await prisma.caso.findFirst({
    where: { id, ...filtroDeCasos(usuario) },
    include: {
      paciente: true,
      doctor: { select: { nombreCompleto: true } },
      tecnico: { select: { nombreCompleto: true, fotoUrl: true } },
      unidades: { orderBy: { diente: "asc" } },
      archivos: { orderBy: { creadoEn: "desc" } },
      aprobaciones: {
        orderBy: { creadoEn: "desc" },
        include: { usuario: { select: { nombreCompleto: true } } },
      },
      mensajes: {
        orderBy: { creadoEn: "asc" },
        include: {
          autor: { select: { id: true, nombreCompleto: true, fotoUrl: true } },
        },
      },
      eventos: { orderBy: { secuencia: "asc" } },
      controlDeCalidad: {
        include: {
          revisadoPor: { select: { nombreCompleto: true } },
          autorizadoPor: { select: { nombreCompleto: true } },
        },
      },
    },
  });

  if (!caso) notFound();
  if (caso.esBorrador) redirect(`/casos/${caso.id}/capturar`);

  const delLaboratorio = esDelLaboratorio(usuario);
  const malla = caso.archivos.find((a) => a.tipo === "MALLA_LIGERA");
  const diseno = caso.archivos.find((a) => a.tipo === "DISENO");
  const recienEnviado = consulta.enviado === "1";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 pb-8">
      {/* Confirmación visible después de enviar (§6.8). La duda genera llamadas. */}
      {recienEnviado ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-contenedor border border-terminado/40 bg-terminado-fondo p-4 text-cuerpo text-terminado-texto"
        >
          <CheckCircle aria-hidden="true" size={20} weight="fill" className="mt-0.5 shrink-0" />
          <span>
            Ya recibí su caso. Lo reviso hoy mismo y le confirmo la fecha de
            entrega en cuanto lo acepte.
          </span>
        </p>
      ) : null}

      <header className="flex flex-col gap-3">
        <Link
          href={delLaboratorio ? "/tablero" : "/casos"}
          className="text-menor text-enlace underline underline-offset-4"
        >
          {delLaboratorio ? "Regresar al tablero" : "Regresar a mis casos"}
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-titulo font-semibold text-primario">
              Paciente {caso.paciente.folio} · {caso.paciente.iniciales}
            </h1>
            <p className="mt-1 text-menor text-secundario">
              Caso {caso.folio} · {INDICACIONES[caso.indicacion].nombre}
              {delLaboratorio ? ` · ${caso.doctor.nombreCompleto}` : ""}
            </p>
          </div>
          <ChipDeEtapa etapa={caso.etapa} />
        </div>

        <p className="text-cuerpo text-secundario">
          {ETAPAS[caso.etapa].paraElDoctor}
        </p>

        <div className="rounded-tarjeta border border-borde bg-superficie p-4">
          <p className="text-minimo text-secundario">Fecha de entrega</p>
          {caso.fechaEntregaComprometida ? (
            <p className="text-realce font-medium text-primario">
              <time dateTime={paraMaquina(caso.fechaEntregaComprometida)}>
                {fechaCorta(caso.fechaEntregaComprometida)}
              </time>
              <span className="font-normal text-secundario">
                {" · "}
                {cuandoFalta(caso.fechaEntregaComprometida)}
              </span>
            </p>
          ) : (
            <p className="text-realce text-secundario">
              Se la confirmo en cuanto acepte el caso.
            </p>
          )}
          {caso.enRiesgo && caso.motivoRiesgo ? (
            <p className="mt-2 text-menor font-medium text-pendiente-texto">
              {caso.motivoRiesgo}
            </p>
          ) : null}
        </div>
      </header>

      {/* La pantalla estrella: aprobación del diseño (O-4). */}
      {caso.etapa === "ESPERANDO_APROBACION" && malla && diseno ? (
        <Aprobacion
          casoId={caso.id}
          archivoDeMallaId={malla.id}
          archivoOriginalId={diseno.id}
          descripcion={`Diseño de ${resumirUnidades(caso.unidades)} para el paciente ${caso.paciente.folio}.`}
          puedeDecidir={puedeAprobarDisenos(usuario)}
          tecnico={caso.tecnico}
        />
      ) : null}

      <section aria-labelledby="unidades" className="flex flex-col gap-3">
        <h2 id="unidades" className="text-subtitulo font-semibold text-primario">
          Lo que estamos haciendo
        </h2>
        <ul className="flex flex-col gap-2">
          {caso.unidades.map((unidad) => (
            <li
              key={unidad.id}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-tarjeta border border-borde bg-superficie p-3"
            >
              <span className="text-cuerpo font-medium text-primario">
                Diente {unidad.diente}
                <span className="font-normal text-secundario">
                  {" · "}
                  {nombreDelDiente(unidad.diente)}
                </span>
              </span>
              <span className="text-menor text-secundario">
                {[
                  ROLES_DE_UNIDAD[unidad.rol],
                  unidad.material ? MATERIALES[unidad.material] : null,
                  unidad.color && COLORES_VITA.includes(unidad.color)
                    ? `color ${unidad.color}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <LineaDeTiempo etapaActual={caso.etapa} />

      <section aria-labelledby="archivos" className="flex flex-col gap-3">
        <h2 id="archivos" className="text-subtitulo font-semibold text-primario">
          Archivos del caso
        </h2>
        <ul className="flex flex-col gap-2">
          {caso.archivos
            .filter((a) => a.estado === "COMPLETO" && a.tipo !== "MALLA_LIGERA")
            .map((archivo) => (
              <li
                key={archivo.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-tarjeta border border-borde bg-superficie p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-cuerpo text-primario">
                    {archivo.nombre}
                  </p>
                  <p className="text-menor text-secundario">
                    {TIPOS_DE_ARCHIVO[archivo.tipo]} ·{" "}
                    {enTamano(archivo.bytesTotales)} ·{" "}
                    {fechaConHora(archivo.creadoEn)}
                  </p>
                </div>
                <a
                  href={`/api/archivos/${archivo.id}/contenido?descargar`}
                  className="area-tactil inline-flex items-center rounded-control text-menor text-enlace underline underline-offset-4"
                >
                  Descargar
                </a>
              </li>
            ))}
        </ul>
      </section>

      {/* Las fotos de control de calidad se juzgan sobre fondo claro (§5.1). */}
      {caso.archivos.some((a) => a.tipo.startsWith("FOTO_CALIDAD")) ? (
        <section
          aria-labelledby="fotos"
          className="siempre-claro rounded-contenedor border border-borde p-4"
        >
          <h2 id="fotos" className="text-subtitulo font-semibold text-primario">
            Fotos de control de calidad
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {caso.archivos
              .filter((a) => a.tipo.startsWith("FOTO_CALIDAD"))
              .map((foto) => (
                <MarcoDeImagen
                  key={foto.id}
                  proporcion="4/3"
                  etiqueta={`${TIPOS_DE_ARCHIVO[foto.tipo]} del caso ${caso.folio}`}
                />
              ))}
          </div>
        </section>
      ) : null}

      {caso.controlDeCalidad ? (
        <section
          aria-labelledby="envio"
          className="flex flex-col gap-2 rounded-contenedor border border-borde bg-superficie p-4"
        >
          <h2 id="envio" className="text-subtitulo font-semibold text-primario">
            Su caso va en camino
          </h2>
          <p className="text-cuerpo text-secundario">
            Lo revisó {caso.controlDeCalidad.revisadoPor.nombreCompleto} y salió
            del laboratorio.
          </p>
          {caso.controlDeCalidad.numeroDeGuia ? (
            <p className="text-cuerpo text-primario">
              Guía {caso.controlDeCalidad.numeroDeGuia}
            </p>
          ) : null}
          {caso.controlDeCalidad.enlaceDeRastreo ? (
            <a
              href={caso.controlDeCalidad.enlaceDeRastreo}
              className="area-tactil inline-flex items-center text-cuerpo text-enlace underline underline-offset-4"
            >
              Rastrear el envío
            </a>
          ) : null}
        </section>
      ) : null}

      <Chat
        casoId={caso.id}
        usuarioId={usuario.id}
        mensajes={caso.mensajes.map((m) => ({
          id: m.id,
          texto: m.texto,
          creadoEn: m.creadoEn.toISOString(),
          autor: {
            id: m.autor.id,
            nombreCompleto: m.autor.nombreCompleto,
            fotoUrl: m.autor.fotoUrl,
          },
        }))}
      />

      {delLaboratorio ? (
        <ControlesDelLaboratorio
          casoId={caso.id}
          etapa={caso.etapa}
          tieneAprobacion={caso.aprobaciones.some(
            (a) => a.decision === "APROBADO",
          )}
          tieneCalidad={caso.controlDeCalidad !== null}
          disenos={caso.archivos
            .filter((a) => a.tipo === "DISENO" && a.estado === "COMPLETO")
            .map((a) => ({
              id: a.id,
              nombre: a.nombre,
              bytes: Number(a.bytesTotales),
            }))}
          eventos={caso.eventos.map((e) => ({
            id: e.id,
            resumen: e.resumen,
            creadoEn: e.creadoEn.toISOString(),
            hash: e.hash,
          }))}
        />
      ) : null}
    </div>
  );
}
