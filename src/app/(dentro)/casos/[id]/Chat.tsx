"use client";

import { useState, useTransition } from "react";
import { CampoDeTexto } from "@/componentes/Campo";
import { Boton } from "@/componentes/Boton";
import { fechaConHora } from "@/lib/fechas";
import { cn } from "@/lib/utilidades";
import { enviarMensaje } from "./acciones";

type MensajeEnPantalla = {
  id: string;
  texto: string;
  creadoEn: string;
  autor: { id: string; nombreCompleto: string; fotoUrl: string | null };
};

/**
 * Chat anclado al caso (SKILL.md O-4).
 *
 * Las personas firman con su nombre. Mileo nunca finge ser una persona (§8):
 * lo que escribe el sistema aparece en los avisos, no aquí.
 */
export function Chat({
  casoId,
  usuarioId,
  mensajes,
}: {
  casoId: string;
  usuarioId: string;
  mensajes: MensajeEnPantalla[];
}) {
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, empezar] = useTransition();

  return (
    <section aria-labelledby="chat" className="flex flex-col gap-3">
      <div>
        <h2 id="chat" className="text-subtitulo font-semibold text-primario">
          Hable con su técnico
        </h2>
        <p className="mt-1 text-menor text-secundario">
          Lo que escriba aquí queda con el caso, para que quien lo tome lo lea.
        </p>
      </div>

      {mensajes.length === 0 ? (
        <p className="rounded-tarjeta border border-borde bg-superficie p-4 text-cuerpo text-secundario">
          Todavía no hay mensajes en este caso. Si algo no cuadra, escríbalo
          aquí.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {mensajes.map((mensaje) => {
            const mio = mensaje.autor.id === usuarioId;
            return (
              <li
                key={mensaje.id}
                className={cn(
                  "max-w-[85%] rounded-tarjeta border p-3",
                  mio
                    ? "self-end border-accion/30 bg-superficie-suave"
                    : "self-start border-borde bg-superficie",
                )}
              >
                <p className="text-menor font-medium text-primario">
                  {mio ? "Usted" : mensaje.autor.nombreCompleto}
                  <span className="font-normal text-secundario">
                    {" · "}
                    <time dateTime={mensaje.creadoEn}>
                      {fechaConHora(new Date(mensaje.creadoEn))}
                    </time>
                  </span>
                </p>
                <p className="mt-1 text-cuerpo whitespace-pre-wrap text-primario">
                  {mensaje.texto}
                </p>
              </li>
            );
          })}
        </ul>
      )}

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

      <div className="flex flex-col gap-2">
        <CampoDeTexto
          etiqueta="Su mensaje"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escriba aquí"
        />
        <Boton
          type="button"
          disabled={enviando || texto.trim().length === 0}
          onClick={() =>
            empezar(async () => {
              const resultado = await enviarMensaje(casoId, texto);
              if (resultado.error) setError(resultado.error);
              else {
                setTexto("");
                setError(null);
              }
            })
          }
          className="self-start"
        >
          {enviando ? "Mandando…" : "Mandar mensaje"}
        </Boton>
      </div>
    </section>
  );
}
