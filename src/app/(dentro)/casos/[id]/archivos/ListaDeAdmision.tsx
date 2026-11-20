"use client";

import { useState, useTransition } from "react";
import { CheckCircle, Circle, FileText, X } from "@phosphor-icons/react";
import { Boton } from "@/componentes/Boton";
import type { EstadoDeAdmision } from "@/lib/admision";
import { enviarCaso } from "../../acciones";
import { ejecutar } from "@/lib/acciones-cliente";
import {
  COMUNICACION,
  GARANTIA,
  POLITICAS_INTERNAS,
  REQUISITOS_DE_TRABAJO,
} from "@/lib/politicas-servicio";

/**
 * Lista de admisión (SKILL.md O-2).
 *
 * Bloquea el envío mientras falte algo o no se hayan aceptado las condiciones
 * y políticas del laboratorio.
 */
export function ListaDeAdmision({
  casoId,
  puntos,
  listo,
}: {
  casoId: string;
  puntos: EstadoDeAdmision[];
  listo: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [aceptoCondiciones, setAceptoCondiciones] = useState(false);
  const [mostrarPoliticas, setMostrarPoliticas] = useState(false);
  const [enviando, empezar] = useTransition();

  const puedeEnviar = listo && aceptoCondiciones && !enviando;

  return (
    <section
      aria-labelledby="admision"
      className="flex flex-col gap-4 rounded-contenedor border border-borde bg-superficie p-5"
    >
      <div>
        <h2 id="admision" className="text-subtitulo font-semibold text-primario">
          Antes de mandarlo
        </h2>
        <p className="mt-1 text-menor text-secundario">
          Reviso esto para no tener que regresarle el caso después.
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {puntos.map((punto) => (
          <li key={punto.clave} className="flex items-start gap-2.5">
            {punto.cumplido ? (
              <CheckCircle
                aria-hidden="true"
                size={20}
                weight="fill"
                className="mt-0.5 shrink-0 text-terminado"
              />
            ) : (
              <Circle
                aria-hidden="true"
                size={20}
                className="mt-0.5 shrink-0 text-secundario"
              />
            )}
            <div>
              <p className="text-cuerpo text-primario">
                {punto.titulo}
                <span className="sr-only">
                  {punto.cumplido ? ": listo" : ": falta"}
                </span>
              </p>
              {!punto.cumplido ? (
                <p className="text-menor text-secundario">{punto.queHacer}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {/* Aceptación obligatoria de condiciones y políticas de servicio */}
      <div className="rounded-tarjeta border border-borde bg-superficie-suave p-3.5">
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={aceptoCondiciones}
            onChange={(e) => setAceptoCondiciones(e.target.checked)}
            className="mt-1 size-4 shrink-0 accent-[var(--rol-accion)]"
          />
          <span className="text-menor text-primario">
            He leído y acepto los requisitos de trabajo, garantía y políticas
            internas del laboratorio.{" "}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setMostrarPoliticas(true);
              }}
              className="inline-flex items-center gap-1 font-medium text-enlace underline underline-offset-4"
            >
              <FileText aria-hidden="true" size={14} />
              Ver condiciones y políticas
            </button>
          </span>
        </label>
      </div>

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

      <Boton
        type="button"
        tono="principal"
        tamano="grande"
        ancho="completo"
        disabled={!puedeEnviar}
        onClick={() =>
          empezar(async () => {
            const resultado = await ejecutar(() =>
              enviarCaso(casoId, aceptoCondiciones),
            );
            if (resultado?.error) setError(resultado.error);
          })
        }
      >
        {enviando ? "Mandando…" : "Mandar el caso al laboratorio"}
      </Boton>

      {!listo || !aceptoCondiciones ? (
        <p className="text-center text-minimo text-secundario">
          {!listo
            ? "Complete los archivos obligatorios y acepte las políticas para activar el botón."
            : "Acepte las condiciones y políticas del laboratorio para enviar el caso."}
        </p>
      ) : null}

      {/* Popup / Modal de Condiciones y Políticas (Servicios a Clientes) */}
      {mostrarPoliticas ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-politicas-servicio"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
          onClick={() => setMostrarPoliticas(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-contenedor border border-borde bg-superficie shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-borde px-5 py-4">
              <div>
                <h3
                  id="titulo-politicas-servicio"
                  className="text-subtitulo font-semibold text-primario"
                >
                  Servicios a Clientes · Condiciones y Políticas
                </h3>
                <p className="text-minimo text-secundario">
                  Requisitos de trabajo, garantía, comunicación y políticas internas
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMostrarPoliticas(false)}
                aria-label="Cerrar ventana de políticas"
                className="flex h-8 w-8 items-center justify-center rounded-control text-secundario hover:bg-superficie-suave hover:text-primario"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-5 overflow-y-auto px-5 py-4 text-menor text-primario">
              <section className="flex flex-col gap-2">
                <h4 className="font-semibold uppercase tracking-wide text-primario">
                  Requisitos de trabajo
                </h4>
                <ul className="flex flex-col gap-2 text-secundario">
                  {REQUISITOS_DE_TRABAJO.map((item) => (
                    <li key={item} className="leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="flex flex-col gap-2 border-t border-borde pt-4">
                <h4 className="font-semibold uppercase tracking-wide text-primario">
                  Garantía
                </h4>
                <ul className="flex flex-col gap-2 text-secundario">
                  {GARANTIA.map((item) => (
                    <li key={item} className="leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="flex flex-col gap-2 border-t border-borde pt-4">
                <h4 className="font-semibold uppercase tracking-wide text-primario">
                  Comunicación
                </h4>
                <ul className="flex flex-col gap-2 text-secundario">
                  {COMUNICACION.map((item) => (
                    <li key={item} className="leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="flex flex-col gap-2 border-t border-borde pt-4">
                <h4 className="font-semibold uppercase tracking-wide text-primario">
                  Políticas internas
                </h4>
                <ul className="flex flex-col gap-2 text-secundario">
                  {POLITICAS_INTERNAS.map((item) => (
                    <li key={item} className="leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-borde bg-superficie-suave px-5 py-3">
              <Boton
                type="button"
                onClick={() => setMostrarPoliticas(false)}
              >
                Cerrar
              </Boton>
              <Boton
                type="button"
                tono="principal"
                onClick={() => {
                  setAceptoCondiciones(true);
                  setMostrarPoliticas(false);
                }}
              >
                Aceptar condiciones y cerrar
              </Boton>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
