"use client";

import { useState, useTransition } from "react";
import { CheckCircle, Circle } from "@phosphor-icons/react";
import { Boton } from "@/componentes/Boton";
import type { EstadoDeAdmision } from "@/lib/admision";
import { enviarCaso } from "../../acciones";

/**
 * Lista de admisión (SKILL.md O-2).
 *
 * Bloquea el envío mientras falte algo, y dice qué hacer para completarlo, no
 * qué falló (§6.5). La misma lista corre en el servidor: apagar el botón desde
 * el navegador no sirve de nada.
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
  const [enviando, empezar] = useTransition();

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
        disabled={!listo || enviando}
        onClick={() =>
          empezar(async () => {
            const resultado = await enviarCaso(casoId);
            if (resultado?.error) setError(resultado.error);
          })
        }
      >
        {enviando ? "Mandando…" : "Mandar el caso al laboratorio"}
      </Boton>

      {!listo ? (
        <p className="text-center text-minimo text-secundario">
          En cuanto complete la lista se activa el botón.
        </p>
      ) : null}
    </section>
  );
}
