"use client";

import { useActionState, useState } from "react";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import { Campo } from "@/componentes/Campo";
import { Boton } from "@/componentes/Boton";
import { entrar, type ResultadoEntrada } from "./acciones";

/**
 * El formulario de la portada.
 *
 * Los dos campos son obligatorios y se ve a simple vista, así que no se repite
 * "(obligatorio)" en cada etiqueta: sería ruido en la pantalla más sencilla de
 * Mileo.
 */
export function FormularioDeEntrada() {
  const [resultado, accion, enviando] = useActionState<
    ResultadoEntrada,
    FormData
  >(entrar, {});
  const [verContrasena, setVerContrasena] = useState(false);

  return (
    <form action={accion} className="mt-8 flex flex-col gap-4">
      <Campo
        etiqueta="Correo"
        name="correo"
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder="doctor@suclinica.mx"
        requerido
        marcaRequerido={false}
        autoFocus
      />

      <Campo
        etiqueta="Contraseña"
        name="contrasena"
        type={verContrasena ? "text" : "password"}
        autoComplete="current-password"
        placeholder="Su contraseña"
        requerido
        marcaRequerido={false}
        sufijo={
          <button
            type="button"
            onClick={() => setVerContrasena((v) => !v)}
            aria-pressed={verContrasena}
            className="area-tactil flex items-center justify-center rounded-control text-secundario hover:text-primario"
          >
            {verContrasena ? (
              <EyeSlash aria-hidden="true" size={18} />
            ) : (
              <Eye aria-hidden="true" size={18} />
            )}
            <span className="sr-only">
              {verContrasena ? "Ocultar la contraseña" : "Ver la contraseña"}
            </span>
          </button>
        }
      />

      {/* El error se anuncia sin robar el foco de donde está el doctor. */}
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
        className="mt-2"
      >
        {enviando ? "Entrando…" : "Entrar"}
      </Boton>
    </form>
  );
}
