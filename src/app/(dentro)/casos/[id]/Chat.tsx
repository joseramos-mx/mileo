"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { CampoDeTexto } from "@/componentes/Campo";
import { Boton } from "@/componentes/Boton";
import { fechaConHora } from "@/lib/fechas";
import { cn } from "@/lib/utilidades";
import { enviarMensaje } from "./acciones";
import { ejecutar } from "@/lib/acciones-cliente";

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
  const listaRef = useRef<HTMLUListElement | null>(null);
  const entradaRef = useRef<HTMLTextAreaElement | null>(null);
  const yaInicializadoRef = useRef(false);
  const cercaDelFinalRef = useRef(true);

  function mandar() {
    if (enviando || texto.trim().length === 0) return;
    empezar(async () => {
      const resultado = await ejecutar(() => enviarMensaje(casoId, texto));
      if (resultado.error) setError(resultado.error);
      else {
        setTexto("");
        setError(null);
        if (entradaRef.current) entradaRef.current.style.height = "";
      }
    });
  }

  const ultimoMensaje = mensajes[mensajes.length - 1];
  const ultimoId = ultimoMensaje?.id;
  const ultimoEsMio = ultimoMensaje?.autor.id === usuarioId;

  useEffect(() => {
    const lista = listaRef.current;
    if (!lista) return;

    if (!yaInicializadoRef.current || cercaDelFinalRef.current || ultimoEsMio) {
      lista.scrollTop = lista.scrollHeight;
      yaInicializadoRef.current = true;
      cercaDelFinalRef.current = true;
    }
  }, [mensajes.length, ultimoId, ultimoEsMio]);

  return (
    <section
      aria-labelledby="chat"
      className="flex flex-col gap-4 rounded-contenedor border border-borde bg-superficie p-4 sm:p-5"
    >
      <div>
        <h2 id="chat" className="text-subtitulo font-semibold text-primario">
          Hable con su técnico
        </h2>
        <p className="mt-1 text-menor text-secundario">
          Lo que escriba aquí queda con el caso, para que quien lo tome lo lea.
        </p>
      </div>

      {mensajes.length === 0 ? (
        <p className="rounded-tarjeta border border-borde bg-app p-4 text-cuerpo text-secundario">
          Todavía no hay mensajes en este caso. Si algo no cuadra, escríbalo
          aquí.
        </p>
      ) : (
        <ul
          ref={listaRef}
          tabIndex={0}
          aria-label="Mensajes del caso"
          onScroll={(e) => {
            const el = e.currentTarget;
            cercaDelFinalRef.current =
              el.scrollHeight - el.scrollTop - el.clientHeight <= 64;
          }}
          className="flex max-h-80 flex-col gap-3 overflow-y-auto rounded-tarjeta border border-borde bg-app p-3 sm:max-h-96"
        >
          {mensajes.map((mensaje) => {
            const mio = mensaje.autor.id === usuarioId;
            return (
              <li
                key={mensaje.id}
                className={cn(
                  "max-w-[85%] rounded-tarjeta border p-3",
                  mio
                    ? "self-end border-accion/30 bg-superficie-marcada"
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
                <p className="mt-1 wrap-break-word text-cuerpo whitespace-pre-wrap text-primario">
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

      <div className="flex items-end gap-2">
        <CampoDeTexto
          ref={entradaRef}
          etiqueta="Escribe un mensaje"
          etiquetaOculta
          redimensionable={false}
          compacto
          rows={1}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${e.target.scrollHeight}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              mandar();
            }
          }}
          placeholder="Escribe un mensaje"
          className="min-w-0 flex-1"
        />
        <Boton
          type="button"
          tono="principal"
          forma="circular"
          disabled={enviando || texto.trim().length === 0}
          aria-label={enviando ? "Mandando mensaje" : "Mandar mensaje"}
          title="Mandar mensaje"
          onClick={mandar}
        >
          <ArrowRight aria-hidden="true" size={20} />
        </Boton>
      </div>
    </section>
  );
}
