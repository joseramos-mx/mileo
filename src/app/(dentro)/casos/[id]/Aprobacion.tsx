"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { Boton } from "@/componentes/Boton";
import { CampoDeTexto } from "@/componentes/Campo";
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
      />

      {/* La alternativa al visor: qué se está viendo, en palabras (§7). */}
      <p className="text-menor text-secundario">{descripcion}</p>

      {tecnico ? (
        <p className="text-menor text-secundario">
          Lo diseñó {tecnico.nombreCompleto}. Puede escribirle aquí abajo.
        </p>
      ) : null}

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
                  const resultado = await solicitarAjuste(casoId, comentario);
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
        <div className="flex flex-col gap-2 sm:flex-row">
          {/* Una sola acción principal en la pantalla (§6.1). */}
          <Boton
            type="button"
            tono="principal"
            tamano="grande"
            disabled={trabajando}
            onClick={() =>
              empezar(async () => {
                const resultado = await aprobarDiseno(casoId);
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
      )}
    </section>
  );
}
