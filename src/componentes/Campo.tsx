"use client";

import { useId } from "react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utilidades";

/**
 * Campo de formulario (SKILL.md §5.4 "Field").
 *
 * Siempre con <label> real asociado y el error anunciado con aria-live (§7).
 * Los errores dicen qué hacer, no qué pasó: "falta el escaneo del antagonista,
 * súbalo aquí" y no "archivo inválido" (§6.5).
 */

type BaseCampo = {
  etiqueta: string;
  /** Una línea de apoyo debajo de la etiqueta. */
  ayuda?: string;
  error?: string;
  requerido?: boolean;
  className?: string;
  /**
   * Un control que va dentro del campo, pegado a la derecha: ver la
   * contraseña, limpiar, etc. Va aquí como variante y no copiando el
   * componente en cada pantalla (SKILL.md §5.4).
   */
  sufijo?: ReactNode;
  /**
   * Cuando toda la pantalla es obligatoria, repetir "(obligatorio)" en cada
   * campo es ruido. Se puede callar sin quitarle el `required` al control.
   */
  marcaRequerido?: boolean;
};

function Envoltura({
  id,
  etiqueta,
  ayuda,
  error,
  requerido,
  marcaRequerido = true,
  className,
  children,
}: BaseCampo & { id: string; children: ReactNode }) {
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-menor font-medium text-primario">
        {etiqueta}
        {marcaRequerido ? (
          requerido ? (
            <span className="text-secundario"> (obligatorio)</span>
          ) : (
            <span className="text-secundario"> (opcional)</span>
          )
        ) : null}
      </label>

      {ayuda ? (
        <p id={idAyuda} className="text-menor text-secundario">
          {ayuda}
        </p>
      ) : null}

      {children}

      {/* El error se anuncia en cuanto aparece, sin robar el foco. */}
      <p
        id={idError}
        role="alert"
        aria-live="polite"
        className={cn(
          "text-menor text-pendiente-texto",
          error ? "" : "sr-only",
        )}
      >
        {error ?? ""}
      </p>
    </div>
  );
}

const estilosControl = [
  "area-tactil w-full rounded-control border bg-superficie px-3 py-2",
  "text-cuerpo text-primario",
  "placeholder:text-secundario",
  "disabled:cursor-not-allowed disabled:opacity-60",
];

export function Campo({
  etiqueta,
  ayuda,
  error,
  requerido,
  marcaRequerido,
  className,
  sufijo,
  ...props
}: Omit<ComponentProps<"input">, "className"> & BaseCampo) {
  const generado = useId();
  const id = props.id ?? generado;

  return (
    <Envoltura
      id={id}
      etiqueta={etiqueta}
      ayuda={ayuda}
      error={error}
      requerido={requerido}
      marcaRequerido={marcaRequerido}
      className={className}
    >
      <div className="relative">
        <input
          {...props}
          id={id}
          required={requerido}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            [ayuda ? `${id}-ayuda` : null, error ? `${id}-error` : null]
              .filter(Boolean)
              .join(" ") || undefined
          }
          className={cn(
            estilosControl,
            sufijo && "pr-12",
            error ? "border-pendiente" : "border-borde",
          )}
        />
        {sufijo ? (
          <div className="absolute inset-y-0 right-1 flex items-center">
            {sufijo}
          </div>
        ) : null}
      </div>
    </Envoltura>
  );
}

export function CampoDeSeleccion({
  etiqueta,
  ayuda,
  error,
  requerido,
  marcaRequerido,
  className,
  children,
  ...props
}: Omit<ComponentProps<"select">, "className"> & BaseCampo) {
  const generado = useId();
  const id = props.id ?? generado;

  return (
    <Envoltura
      id={id}
      etiqueta={etiqueta}
      ayuda={ayuda}
      error={error}
      requerido={requerido}
      marcaRequerido={marcaRequerido}
      className={className}
    >
      {/* Select nativo a propósito: en el celular abre la rueda del sistema,
          que es más rápida y más accesible que cualquier lista propia. */}
      <select
        {...props}
        id={id}
        required={requerido}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [ayuda ? `${id}-ayuda` : null, error ? `${id}-error` : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
        className={cn(
          estilosControl,
          error ? "border-pendiente" : "border-borde",
        )}
      >
        {children}
      </select>
    </Envoltura>
  );
}

export function CampoDeTexto({
  etiqueta,
  ayuda,
  error,
  requerido,
  marcaRequerido,
  className,
  ...props
}: Omit<ComponentProps<"textarea">, "className"> & BaseCampo) {
  const generado = useId();
  const id = props.id ?? generado;

  return (
    <Envoltura
      id={id}
      etiqueta={etiqueta}
      ayuda={ayuda}
      error={error}
      requerido={requerido}
      marcaRequerido={marcaRequerido}
      className={className}
    >
      <textarea
        {...props}
        id={id}
        required={requerido}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [ayuda ? `${id}-ayuda` : null, error ? `${id}-error` : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
        className={cn(
          estilosControl,
          "min-h-24 resize-y",
          error ? "border-pendiente" : "border-borde",
        )}
      />
    </Envoltura>
  );
}
