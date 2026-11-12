"use client";

import { useCallback, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { Boton } from "@/componentes/Boton";
import { CampoDeTexto } from "@/componentes/Campo";
import type {
  ArchivoDeVista3D,
  EstadoDelVisor,
} from "@/componentes/Visor3D";
import { ejecutar } from "@/lib/acciones-cliente";
import { aprobarDiseno, solicitarAjuste } from "./acciones";

// El visor pesa: se carga sólo en esta pantalla y sólo en el navegador.
const Visor3D = dynamic(
  () => import("@/componentes/Visor3D").then((m) => m.Visor3D),
  {
    ssr: false,
    loading: () => (
      <div className="siempre-claro aspect-4/3 w-full animate-pulse rounded-contenedor border border-borde bg-superficie-suave" />
    ),
  },
);

export function VistaPrevia3D({
  archivosDeMalla,
  descripcion,
}: {
  archivosDeMalla: ArchivoDeVista3D[];
  descripcion: string;
}) {
  if (archivosDeMalla.length === 0) return null;
  const principal = archivosDeMalla[0];
  return (
    <Visor3D
      archivoDeMallaId={principal.archivoDeMallaId}
      archivoOriginalId={principal.archivoOriginalId}
      archivos={archivosDeMalla}
      descripcion={descripcion}
    />
  );
}

/**
 * Aprobación del diseño (SKILL.md O-4, la pantalla estrella).
 *
 * Dos botones y nada más: aprobar y solicitar ajuste. El comentario es
 * obligatorio al solicitar ajuste, porque un ajuste sin explicación le cuesta
 * al técnico un día de ida y vuelta.
 *
 * Enseña el visor 3D (con selector de ojo por cada archivo subido: conjunto
 * completo primero y las dos quijadas por separado), las imágenes/capturas del
 * diseño subidas por el laboratorio (sobre fondo neutro claro) o ambos.
 */
export function Aprobacion({
  casoId,
  archivoDeMallaId,
  archivoOriginalId,
  archivosDeMalla = [],
  imagenesDeDiseno = [],
  descripcion,
  puedeDecidir,
  tecnico,
}: {
  casoId: string;
  archivoDeMallaId: string | null;
  archivoOriginalId: string;
  archivosDeMalla?: ArchivoDeVista3D[];
  imagenesDeDiseno?: { id: string; nombre: string }[];
  descripcion: string;
  puedeDecidir: boolean;
  tecnico: { nombreCompleto: string; fotoUrl: string | null } | null;
}) {
  const [pidiendoAjuste, setPidiendoAjuste] = useState(false);
  const [comentario, setComentario] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [trabajando, empezar] = useTransition();

  const listaMallas =
    archivosDeMalla.length > 0
      ? archivosDeMalla
      : archivoDeMallaId
        ? [
            {
              archivoDeMallaId,
              archivoOriginalId,
              nombre: "Conjunto completo",
            },
          ]
        : [];
  const mallaPrincipalId = listaMallas[0]?.archivoDeMallaId ?? null;

  const [visor, setVisor] = useState<EstadoDelVisor>(
    mallaPrincipalId ? "cargando" : "no-pude",
  );

  // Estable: si cambia en cada pintada, el visor vuelve a bajar la malla.
  const alCambiarEstado = useCallback(
    (estado: EstadoDelVisor) => setVisor(estado),
    [],
  );

  const tieneImagenes = imagenesDeDiseno.length > 0;
  const loVio = mallaPrincipalId
    ? visor === "listo" || tieneImagenes
    : tieneImagenes;

  return (
    <section aria-labelledby="aprobacion" className="flex flex-col gap-4">
      <div>
        <h2
          id="aprobacion"
          className="text-subtitulo font-semibold text-primario"
        >
          Su diseño está listo
        </h2>
        <p className="mt-1 text-cuerpo text-secundario">
          Revíselo y dígame si lo fabrico así. No fabrico nada sin su
          aprobación.
        </p>
      </div>

      {mallaPrincipalId ? (
        <Visor3D
          archivoDeMallaId={mallaPrincipalId}
          archivoOriginalId={listaMallas[0]?.archivoOriginalId ?? archivoOriginalId}
          archivos={listaMallas}
          descripcion={descripcion}
          alCambiarEstado={alCambiarEstado}
        />
      ) : null}

      {tieneImagenes ? (
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
                  alt={`${img.nombre} — ${descripcion}`}
                  draggable={false}
                  onContextMenu={(e) => e.preventDefault()}
                  className="max-h-96 w-full select-none rounded-control object-contain"
                />
                <figcaption className="flex items-center justify-between gap-2 px-1 text-minimo text-secundario">
                  <span className="truncate">{img.nombre}</span>
                  <span className="shrink-0">Solo lectura en visor</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      ) : null}

      {!mallaPrincipalId && !tieneImagenes ? (
        <div className="rounded-contenedor border border-borde bg-superficie p-4">
          <p className="text-menor text-secundario">
            Este diseño no tiene una vista previa compatible en el visor.
            Pídale a su técnico en el chat que suba el archivo STL o una imagen
            para poder revisarlo aquí.
          </p>
        </div>
      ) : null}

      {/* La alternativa al visor: qué se está viendo, en palabras (§7). */}
      <p className="text-menor text-secundario">{descripcion}</p>

      <p
        role="alert"
        aria-live="polite"
        className={
          error
            ? "rounded-control border border-pendiente/40 bg-pendiente-fondo px-3 py-2 text-menor text-pendiente-texto"
            : "sr-only"
        }
      >
        {error ?? ""}
      </p>

      {!puedeDecidir ? (
        <p className="rounded-control border border-borde bg-superficie-suave px-3 py-2 text-menor text-secundario">
          La aprobación la registra el doctor. Usted puede revisar el diseño y
          escribirle al técnico.
        </p>
      ) : pidiendoAjuste ? (
        <div className="flex flex-col gap-3 rounded-contenedor border border-borde bg-superficie p-4">
          <CampoDeTexto
            etiqueta="¿Qué hay que ajustar?"
            requerido
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            ayuda="Por ejemplo: el contacto mesial del 11 está abierto, y el borde incisal va 0.5 mm más corto."
            placeholder="Cuénteme qué cambiar"
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Boton
              type="button"
              tono="principal"
              disabled={trabajando}
              onClick={() =>
                empezar(async () => {
                  const resultado = await ejecutar(() =>
                    solicitarAjuste(casoId, comentario),
                  );
                  if (resultado.error) setError(resultado.error);
                })
              }
            >
              {trabajando ? "Mandando…" : "Mandar el ajuste"}
            </Boton>
            <Boton
              type="button"
              onClick={() => {
                setPidiendoAjuste(false);
                setError(null);
              }}
            >
              Mejor no
            </Boton>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Boton
              type="button"
              tono="principal"
              tamano="grande"
              disabled={trabajando || !loVio}
              onClick={() =>
                empezar(async () => {
                  const resultado = await ejecutar(() =>
                    aprobarDiseno(casoId, archivoOriginalId),
                  );
                  if (resultado.error) setError(resultado.error);
                })
              }
            >
              {trabajando ? "Registrando…" : "Aprobar y fabricar"}
            </Boton>
            <Boton
              type="button"
              tamano="grande"
              onClick={() => setPidiendoAjuste(true)}
            >
              Solicitar ajuste
            </Boton>
          </div>

          {!loVio ? (
            <p className="text-menor text-secundario">
              {visor === "cargando"
                ? "En cuanto termine de cargar su diseño puede aprobarlo."
                : "Descargue el diseño, ábralo en su programa y marque la casilla de arriba. No le voy a pedir que apruebe algo que no pudo ver."}
            </p>
          ) : null}

          {tecnico ? (
            <p className="text-menor text-secundario">
              Lo diseñó {tecnico.nombreCompleto}. Puede escribirle aquí abajo.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
