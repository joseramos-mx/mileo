"use client";

import { useActionState, useState } from "react";
import { Campo } from "@/componentes/Campo";
import { Boton } from "@/componentes/Boton";
import { INDICACIONES } from "@/lib/vocabulario";
import { cn } from "@/lib/utilidades";
import { crearBorrador, type ResultadoDeBorrador } from "../acciones";

/**
 * Primer paso del alta: indicación y paciente.
 *
 * La indicación se escoge con tarjetas grandes, no con una lista desplegable:
 * en el celular, con guantes, apuntarle a una opción de lista es difícil y
 * cada tarjeta rebasa de sobra los 44 px de área táctil (§7).
 */
export function FormularioDeCaso() {
  const [resultado, accion, enviando] = useActionState<
    ResultadoDeBorrador,
    FormData
  >(crearBorrador, {});
  const [indicacion, setIndicacion] = useState<string | null>(null);

  return (
    <form action={accion} className="flex flex-col gap-8">
      <fieldset className="flex flex-col gap-3">
        <legend className="text-subtitulo font-semibold text-primario">
          ¿Qué necesita?
        </legend>

        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(INDICACIONES).map(([clave, { nombre, descripcion }]) => (
            <label
              key={clave}
              className={cn(
                "flex cursor-pointer flex-col gap-1 rounded-tarjeta border p-4",
                "transition-colors duration-150",
                indicacion === clave
                  ? "border-accion bg-superficie-suave"
                  : "border-borde bg-superficie hover:bg-superficie-suave",
              )}
            >
              <input
                type="radio"
                name="indicacion"
                value={clave}
                required
                checked={indicacion === clave}
                onChange={() => setIndicacion(clave)}
                className="sr-only"
              />
              <span className="text-cuerpo font-medium text-primario">
                {nombre}
              </span>
              <span className="text-menor text-secundario">{descripcion}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="text-subtitulo font-semibold text-primario">
          ¿De qué paciente?
        </legend>
        <p className="-mt-2 text-menor text-secundario">
          Con el folio y las iniciales basta. El nombre completo es suyo y sólo
          se guarda si usted lo escribe.
        </p>

        <Campo
          etiqueta="Folio del paciente"
          name="folioPaciente"
          requerido
          inputMode="text"
          autoComplete="off"
          placeholder="932"
          ayuda="El número con el que lo identifica en su consultorio."
          error={resultado.errores?.folioPaciente}
        />

        <Campo
          etiqueta="Iniciales"
          name="iniciales"
          requerido
          autoComplete="off"
          placeholder="M.L.R."
          error={resultado.errores?.iniciales}
        />

        <Campo
          etiqueta="Nombre completo"
          name="nombreCompleto"
          autoComplete="off"
          error={resultado.errores?.nombreCompleto}
        />
      </fieldset>

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

      <div className="flex flex-col gap-2">
        <Boton
          type="submit"
          tono="principal"
          tamano="grande"
          ancho="completo"
          disabled={enviando}
        >
          {enviando ? "Guardando…" : "Continuar"}
        </Boton>
        <p className="text-center text-minimo text-secundario">
          Todavía no se manda nada al laboratorio.
        </p>
      </div>
    </form>
  );
}
