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
import type { ArchivoDeVista3D } from "@/componentes/Visor3D";
import { resumirUnidades } from "@/lib/casos";
import {
  ARCADAS_EN_PALABRAS,
  ETAPAS,
  INDICACIONES,
  MATERIALES,
  TIPOS_DE_ARCHIVO,
  ROLES_DE_UNIDAD,
  nombreDelColor,
  nombreDelDiente,
} from "@/lib/vocabulario";
import { fechaCorta, cuandoFalta, fechaConHora, paraMaquina } from "@/lib/fechas";
import { enTamano } from "@/lib/formato";
import { esExtensionDeFoto, existeArchivo } from "@/lib/almacen";
import { derivarMallaLigera, rutaDeLaMalla } from "@/lib/malla";
import { LineaDeTiempo } from "./LineaDeTiempo";
import { Aprobacion, VistaPrevia3D } from "./Aprobacion";
import { Chat } from "./Chat";
import { ControlesDelLaboratorio } from "./ControlesDelLaboratorio";

export const metadata: Metadata = { title: "Caso · Mileo" };

function prioridadDeArchivo3D(nombre: string): number {
  if (
    nombre.startsWith("[Conjunto completo]") ||
    /\b(conjunto|completo|junt|oclusion|ambas|modelbase)\b/i.test(nombre)
  ) {
    return 0;
  }
  if (
    nombre.startsWith("[Quijada superior]") ||
    /\b(quijada superior|arcada superior|superior|upper|maxilar)\b/i.test(nombre)
  ) {
    return 2;
  }
  if (
    nombre.startsWith("[Quijada inferior]") ||
    /\b(quijada inferior|arcada inferior|inferior|lower|mandibula)\b/i.test(
      nombre,
    )
  ) {
    return 3;
  }
  // Cualquier archivo 3D sin etiqueta de quijada separada va antes que las quijadas separadas.
  return 1;
}

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
  const mallasExistentes = caso.archivos.filter(
    (a) => a.tipo === "MALLA_LIGERA" && a.estado === "COMPLETO",
  );
  const disenosCompletos = caso.archivos.filter(
    (a) => a.tipo === "DISENO" && a.estado === "COMPLETO",
  );
  const imagenesDeDiseno = disenosCompletos.filter((a) =>
    esExtensionDeFoto(a.extension),
  );
  const disenos3d = [...disenosCompletos]
    .filter((a) => !esExtensionDeFoto(a.extension))
    .sort(
      (a, b) => prioridadDeArchivo3D(a.nombre) - prioridadDeArchivo3D(b.nombre),
    );
  const diseno = disenos3d[0] ?? disenosCompletos[0];

  // Empareja o deriva la malla ligera de cada archivo STL de diseño para que
  // todos aparezcan con su botón de ojo en el visor 3D (el conjunto completo primero).
  const archivosDeMalla: ArchivoDeVista3D[] = [];
  for (const archivo3d of disenos3d) {
    const rutaEsperada = rutaDeLaMalla(archivo3d.id, caso.id);
    let mallaAsociada = mallasExistentes.find(
      (m) => m.rutaRelativa === rutaEsperada,
    );

    if (!mallaAsociada && archivo3d.extension.toLowerCase() === "stl") {
      try {
        const resumen = await derivarMallaLigera({
          rutaDelOriginal: archivo3d.rutaRelativa,
          casoId: caso.id,
          archivoId: archivo3d.id,
        });
        mallaAsociada = await prisma.archivo.create({
          data: {
            casoId: caso.id,
            nombre: `Vista de ${archivo3d.nombre}`,
            tipo: "MALLA_LIGERA",
            extension: "malla",
            bytesTotales: BigInt(resumen.bytes),
            bytesRecibidos: BigInt(resumen.bytes),
            estado: "COMPLETO",
            rutaRelativa: resumen.rutaRelativa,
            subidoPorId: archivo3d.subidoPorId,
          },
        });
      } catch {
        // Si el STL no se pudo convertir, continúa con los demás archivos.
      }
    }

    if (mallaAsociada) {
      archivosDeMalla.push({
        archivoDeMallaId: mallaAsociada.id,
        archivoOriginalId: archivo3d.id,
        nombre: archivo3d.nombre,
      });
    }
  }

  // Respaldo por si hubiera una malla ligera antigua cuyo nombre de ruta no coincida.
  if (archivosDeMalla.length === 0 && mallasExistentes[0] && diseno) {
    archivosDeMalla.push({
      archivoDeMallaId: mallasExistentes[0].id,
      archivoOriginalId: diseno.id,
      nombre: diseno.nombre,
    });
  }

  const mallaPrincipal = archivosDeMalla[0] ?? null;
  const descripcionDelDiseno = `Diseño de ${resumirUnidades(caso.unidades)} para el paciente ${caso.paciente.folio}.`;

  const archivosVisibles = caso.archivos.filter(
    (a) =>
      a.estado === "COMPLETO" &&
      a.tipo !== "MALLA_LIGERA" &&
      (delLaboratorio || a.tipo !== "DISENO"),
  );
  const tieneSubidaIncompleta = caso.archivos.some(
    (a) => a.estado === "EN_PROCESO" && a.tipo !== "MALLA_LIGERA",
  );
  const fotosDeCalidad = await Promise.all(
    caso.archivos
      .filter(
        (a) => a.tipo.startsWith("FOTO_CALIDAD") && a.estado === "COMPLETO",
      )
      .map(async (foto) => ({
        ...foto,
        existeEnAlmacen: await existeArchivo(foto.rutaRelativa),
      })),
  );
  const recienEnviado = consulta.enviado === "1";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 pb-8">
      {/* Confirmación visible después de enviar (§6.8). La duda genera llamadas. */}
      {recienEnviado ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-contenedor border border-terminado/40 bg-terminado-fondo p-4 text-cuerpo text-terminado-texto"
        >
          <CheckCircle
            aria-hidden="true"
            size={20}
            weight="fill"
            className="mt-0.5 shrink-0"
          />
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
      {caso.etapa === "ESPERANDO_APROBACION" ? (
        diseno ? (
          <Aprobacion
            casoId={caso.id}
            archivoDeMallaId={mallaPrincipal?.archivoDeMallaId ?? null}
            archivoOriginalId={diseno.id}
            archivosDeMalla={archivosDeMalla}
            imagenesDeDiseno={imagenesDeDiseno.map((img) => ({
              id: img.id,
              nombre: img.nombre,
            }))}
            descripcion={descripcionDelDiseno}
            puedeDecidir={puedeAprobarDisenos(usuario)}
            tecnico={caso.tecnico}
          />
        ) : (
          <section
            aria-labelledby="aprobacion"
            className="flex flex-col gap-2 rounded-contenedor border border-pendiente/40 bg-pendiente-fondo p-4"
          >
            <h2
              id="aprobacion"
              className="text-subtitulo font-semibold text-pendiente-texto"
            >
              El diseño todavía no está aquí
            </h2>
            <p className="text-cuerpo text-pendiente-texto">
              Su caso quedó marcado como listo para revisar, pero la vista del
              diseño no llegó. No apruebe nada todavía: escríbale a su técnico
              aquí abajo y se la mando.
            </p>
          </section>
        )
      ) : archivosDeMalla.length > 0 || imagenesDeDiseno.length > 0 ? (
        <section
          aria-labelledby="vista-diseno"
          className="flex flex-col gap-4"
        >
          <h2
            id="vista-diseno"
            className="text-subtitulo font-semibold text-primario"
          >
            Vista del diseño
          </h2>

          {archivosDeMalla.length > 0 ? (
            <VistaPrevia3D
              archivosDeMalla={archivosDeMalla}
              descripcion={descripcionDelDiseno}
            />
          ) : null}

          {imagenesDeDiseno.length > 0 ? (
            <div className="siempre-claro flex flex-col gap-3 rounded-contenedor border border-borde bg-superficie p-4">
              <p className="text-menor font-medium text-primario">
                {imagenesDeDiseno.length === 1
                  ? "Imagen del diseño"
                  : "Imágenes del diseño"}
              </p>
              <div
                className={
                  imagenesDeDiseno.length > 1
                    ? "grid gap-3 sm:grid-cols-2"
                    : "flex flex-col gap-3"
                }
              >
                {imagenesDeDiseno.map((img) => (
                  <figure
                    key={img.id}
                    className="flex flex-col gap-2 overflow-hidden rounded-tarjeta border border-borde bg-superficie-suave p-2"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/archivos/${img.id}/contenido`}
                      alt={`${img.nombre} — caso ${caso.folio}`}
                      draggable={false}
                      className="max-h-96 w-full select-none rounded-control object-contain"
                    />
                    <figcaption className="flex items-center justify-between gap-2 px-1 text-minimo text-secundario">
                      <span className="truncate">{img.nombre}</span>
                      {delLaboratorio ? (
                        <a
                          href={`/api/archivos/${img.id}/contenido?descargar`}
                          className="shrink-0 text-enlace underline underline-offset-4"
                        >
                          Descargar
                        </a>
                      ) : (
                        <span className="shrink-0">Solo lectura en visor</span>
                      )}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          ) : null}
        </section>
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
                {unidad.diente !== null ? (
                  <>
                    Diente {unidad.diente}
                    <span className="font-normal text-secundario">
                      {" · "}
                      {nombreDelDiente(unidad.diente)}
                    </span>
                  </>
                ) : unidad.arcada ? (
                  ARCADAS_EN_PALABRAS[unidad.arcada]
                ) : (
                  "Todo el caso"
                )}
              </span>
              <span className="text-menor text-secundario">
                {[
                  ROLES_DE_UNIDAD[unidad.rol],
                  unidad.material ? MATERIALES[unidad.material] : null,
                  unidad.color ? `color ${nombreDelColor(unidad.color)}` : null,
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
        {archivosVisibles.length === 0 ? (
          <p className="rounded-tarjeta border border-borde bg-superficie p-4 text-cuerpo text-secundario">
            {tieneSubidaIncompleta
              ? "Todavía no hay archivos completos en este caso; quedó una subida sin terminar."
              : delLaboratorio
                ? "Todavía no se han subido archivos en este caso."
                : "Todavía no se han subido archivos en este caso. Si necesita compartir un escaneo o una foto, avísele a su técnico en el chat de abajo."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {archivosVisibles.map((archivo) => (
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
        )}
      </section>

      {/* Las fotos de control de calidad se juzgan sobre fondo claro (§5.1). */}
      {fotosDeCalidad.length > 0 ? (
        <section
          aria-labelledby="fotos"
          className="siempre-claro rounded-contenedor border border-borde p-4"
        >
          <h2 id="fotos" className="text-subtitulo font-semibold text-primario">
            Fotos de control de calidad
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {fotosDeCalidad.map((foto) => {
              const etiquetaFoto = `${TIPOS_DE_ARCHIVO[foto.tipo]} del caso ${caso.folio}`;
              return foto.existeEnAlmacen ? (
                <figure
                  key={foto.id}
                  className="flex flex-col gap-2 overflow-hidden rounded-tarjeta border border-borde bg-superficie-suave p-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/archivos/${foto.id}/contenido`}
                    alt={etiquetaFoto}
                    className="aspect-4/3 w-full rounded-control object-contain"
                  />
                  <figcaption className="flex items-center justify-between gap-2 px-1 text-minimo text-secundario">
                    <span className="truncate font-medium text-primario">
                      {TIPOS_DE_ARCHIVO[foto.tipo]}
                    </span>
                    <a
                      href={`/api/archivos/${foto.id}/contenido?descargar`}
                      className="shrink-0 text-enlace underline underline-offset-4"
                    >
                      Descargar
                    </a>
                  </figcaption>
                </figure>
              ) : (
                <MarcoDeImagen
                  key={foto.id}
                  proporcion="4/3"
                  etiqueta={etiquetaFoto}
                />
              );
            })}
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
