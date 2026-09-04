"use client";

import { useCallback, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { Boton } from "@/componentes/Boton";
import { CampoDeTexto } from "@/componentes/Campo";
import type { EstadoDelVisor } from "@/componentes/Visor3D";
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

/**
 * Aprobación del diseño (SKILL.md O-4, la pantalla estrella).
 *
 * Dos botones y nada más: aprobar y solicitar ajuste. El comentario es
 * obligatorio al solicitar ajuste, porque un ajuste sin explicación le cuesta
 * al técnico un día de ida y vuelta.
 *
 * Lo único que se le pone enfrente además de eso son los dos seguros que hacen
 * falta para que "sencillo" no acabe siendo "descuidado":
 *
 * 1. No se aprueba lo que no se vio. Mientras el visor no logre enseñar el
 *    diseño, el botón de aprobar está apagado. Si el visor no puede —un celular
 *    viejo, WebGL apagado—, no se le cierra la puerta: descarga el diseño, lo
 *    abre en su programa, y lo dice con una casilla. Bloquearlo del todo sería
 *    dejar sin aprobar a quien no puede usar el visor (§7).
 * 2. No se aprueba un diseño que ya cambió. La pantalla manda cuál diseño está
 *    mirando y el servidor se niega si el laboratorio mandó otro mientras
 *    tanto.
 */
export function Aprobacion({
  casoId,
  archivoDeMallaId,
  archivoOriginalId,
  descripcion,
  puedeDecidir,
  tecnico,
}: {
  casoId: string;
  archivoDeMallaId: string;
  archivoOriginalId: string;
  descripcion: string;
  puedeDecidir: boolean;
  tecnico: { nombreCompleto: string; fotoUrl: string | null } | null;
}) {
  const [pidiendoAjuste, setPidiendoAjuste] = useState(false);
  const [comentario, setComentario] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [trabajando, empezar] = useTransition();
  const [visor, setVisor] = useState<EstadoDelVisor>("cargando");
  const [revisadoAparte, setRevisadoAparte] = useState(false);

  // Estable: si cambia en cada pintada, el visor vuelve a bajar la malla.
  const alCambiarEstado = useCallback(
    (estado: EstadoDelVisor) => setVisor(estado),
    [],
  );

  const loVio = visor === "listo" || revisadoAparte;

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

      <Visor3D
        archivoDeMallaId={archivoDeMallaId}
        archivoOriginalId={archivoOriginalId}
        descripcion={descripcion}
        alCambiarEstado={alCambiarEstado}
      />

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
          {/* Si el visor no pudo, la salida es verlo en su programa y decirlo.
              Va antes de los botones porque es lo que desbloquea el primero. */}
          {visor === "no-pude" ? (
            <label className="flex items-start gap-2 rounded-control border border-borde bg-superficie p-3 text-menor text-primario">
              <input
                type="checkbox"
                checked={revisadoAparte}
                onChange={(e) => setRevisadoAparte(e.target.checked)}
                className="mt-0.5 size-5 shrink-0"
              />
              <span>
                Descargué el diseño y ya lo revisé en mi programa.
                <span className="block text-secundario">
                  Márquelo para poder aprobarlo desde aquí.
                </span>
              </span>
            </label>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            {/* Una sola acción principal en la pantalla (§6.1). */}
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

          {/* Por qué todavía no se puede. Un botón apagado sin explicación es
              lo que hace que el doctor acabe llamando por teléfono. */}
          {!loVio ? (
            <p className="text-menor text-secundario">
              {visor === "cargando"
                ? "En cuanto termine de cargar su diseño puede aprobarlo."
                : "Descargue el diseño, ábralo en su programa y marque la casilla de arriba. No le voy a pedir que apruebe algo que no pudo ver."}
            </p>
          ) : null}

          {/* Quién lo hizo va después de la decisión: es lo que el doctor lee
              cuando ya sabe qué va a contestar, no lo que le estorba para
              llegar a los botones. */}
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
