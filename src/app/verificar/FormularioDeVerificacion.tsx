"use client";

import { useActionState } from "react";
import { Boton } from "@/componentes/Boton";
import { confirmarCorreo, type ResultadoVerificacion } from "./acciones";

/** El botón que confirma el correo. El enlace del correo solo trae hasta aquí. */
export function FormularioDeVerificacion({ codigo }: { codigo: string }) {
  const [resultado, accion, enviando] = useActionState<
    ResultadoVerificacion,
    FormData
  >(confirmarCorreo, {});

  return (
    <form action={accion} className="mt-8 flex flex-col gap-4">
      <input type="hidden" name="token_hash" value={codigo} />

      <p
        role="alert"
        aria-live="polite"
        className={
          resultado.error
            ? "rounded-control border border-pendiente/40 bg-pendiente-fondo px-3 py-2 text-menor text-pendiente-texto"
            : "sr-only"
        }
      >
        {resultado.error ?? ""}
      </p>

      <Boton
        type="submit"
        tono="principal"
        ancho="completo"
        disabled={enviando}
      >
        {enviando ? "Confirmando…" : "Confirmar mi correo"}
      </Boton>
    </form>
  );
}
