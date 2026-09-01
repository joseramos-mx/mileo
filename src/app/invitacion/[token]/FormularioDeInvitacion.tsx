"use client";

import { useActionState } from "react";
import type { Rol } from "@/generated/prisma/enums";
import { Campo } from "@/componentes/Campo";
import { Boton } from "@/componentes/Boton";
import { ROLES } from "@/lib/vocabulario";
import {
  aceptarInvitacion,
  type ResultadoDeInvitacion,
} from "./acciones";

export function FormularioDeInvitacion({
  token,
  correo,
  rol,
}: {
  token: string;
  correo: string;
  rol: Rol;
}) {
  const [resultado, accion, enviando] = useActionState<
    ResultadoDeInvitacion,
    FormData
  >(aceptarInvitacion, {});

  return (
    <form action={accion} className="flex flex-col gap-5">
      <input type="hidden" name="token" value={token} />

      <div className="rounded-control border border-borde bg-superficie-suave px-3 py-2">
        <p className="text-minimo text-secundario">Su correo</p>
        <p className="text-cuerpo text-primario">{correo}</p>
        <p className="mt-1 text-minimo text-secundario">
          {ROLES[rol]}
        </p>
      </div>

      <Campo
        etiqueta="Su nombre"
        name="nombreCompleto"
        requerido
        autoComplete="name"
        autoFocus
        ayuda="Así lo va a ver el laboratorio en cada caso."
        error={resultado.errores?.nombreCompleto}
      />

      <Campo
        etiqueta="Su teléfono"
        name="telefono"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        ayuda="Para avisarle por WhatsApp cuando le toque algo."
        error={resultado.errores?.telefono}
      />

      <Campo
        etiqueta="Contraseña"
        name="contrasena"
        type="password"
        requerido
        autoComplete="new-password"
        ayuda="Al menos 8 caracteres."
        error={resultado.errores?.contrasena}
      />

      <Campo
        etiqueta="Repita la contraseña"
        name="repetida"
        type="password"
        requerido
        autoComplete="new-password"
        error={resultado.errores?.repetida}
      />

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
        tamano="grande"
        ancho="completo"
        disabled={enviando}
      >
        {enviando ? "Creando su cuenta…" : "Crear mi cuenta"}
      </Boton>
    </form>
  );
}
