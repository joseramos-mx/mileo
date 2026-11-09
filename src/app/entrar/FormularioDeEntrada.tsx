"use client";

import { useActionState, useState } from "react";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import { Campo } from "@/componentes/Campo";
import { Boton } from "@/componentes/Boton";
import { entrar, type ResultadoEntrada } from "./acciones";

const CUENTAS_RAPIDAS = [
  {
    etiqueta: "Admin",
    correo: "direccion@rmszahn.mx",
    contrasena: "mileo1234",
  },
  {
    etiqueta: "Laboratorio",
    correo: "diseno@rmszahn.mx",
    contrasena: "mileo1234",
  },
  {
    etiqueta: "Clínica",
    correo: "juan.valverde@prodental.mx",
    contrasena: "mileo1234",
  },
] as const;

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
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
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
        value={correo}
        onChange={(e) => setCorreo(e.target.value)}
      />

      <Campo
        etiqueta="Contraseña"
        name="contrasena"
        type={verContrasena ? "text" : "password"}
        autoComplete="current-password"
        placeholder="Su contraseña"
        requerido
        marcaRequerido={false}
        value={contrasena}
        onChange={(e) => setContrasena(e.target.value)}
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

      <div className="flex flex-col gap-1.5">
        <p className="text-minimo text-secundario">Llenado rápido de prueba</p>
        <div className="grid grid-cols-3 gap-1.5">
          {CUENTAS_RAPIDAS.map((cuenta) => (
            <button
              key={cuenta.etiqueta}
              type="button"
              onClick={() => {
                setCorreo(cuenta.correo);
                setContrasena(cuenta.contrasena);
              }}
              className="rounded-control border border-borde bg-superficie px-2 py-1.5 text-minimo font-medium text-primario transition-colors hover:bg-superficie-suave"
            >
              {cuenta.etiqueta}
            </button>
          ))}
        </div>
      </div>

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
        className="mt-1"
      >
        {enviando ? "Entrando…" : "Entrar"}
      </Boton>
    </form>
  );
}
