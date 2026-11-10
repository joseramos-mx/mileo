"use client";

import { useActionState, useState } from "react";
import { Eye, EyeSlash, EnvelopeSimple } from "@phosphor-icons/react";
import { Campo } from "@/componentes/Campo";
import { Boton } from "@/componentes/Boton";
import { registrar, type ResultadoRegistro } from "./acciones";

/**
 * El formulario de registro de clínicas.
 *
 * Solo lo indispensable para entrar y hacer un pedido: quién es, de qué clínica
 * y cómo avisarle. La dirección de entrega no se pide aquí: se completa en
 * ajustes, antes de enviar el primer caso. Los campos obligatorios no llevan
 * "(obligatorio)", igual que en la portada; el teléfono y la ciudad sí se
 * entienden opcionales porque no llevan marca.
 */
export function FormularioDeRegistro() {
  const [resultado, accion, enviando] = useActionState<
    ResultadoRegistro,
    FormData
  >(registrar, {});
  const [verContrasena, setVerContrasena] = useState(false);
  // Para volver al formulario desde "revise su correo" sin perder lo escrito.
  const [ocultoPara, setOcultoPara] = useState<ResultadoRegistro | null>(null);

  const valores = resultado.valores;

  if (resultado.enviadoA && ocultoPara !== resultado) {
    return (
      <div role="status" className="mt-12 flex flex-col items-center gap-4 text-center">
        <EnvelopeSimple aria-hidden="true" size={40} className="text-primario" />
        <h1 className="text-titulo font-normal text-primario">
          Revise su correo
        </h1>
        <p className="text-menor text-secundario">
          Le mandamos un enlace a{" "}
          <span className="font-medium text-primario">
            {resultado.enviadoA}
          </span>
          . Ábralo para confirmar su cuenta y empezar a hacer pedidos.
        </p>
        <p className="text-menor text-secundario">
          ¿No le llegó? Revise la carpeta de correo no deseado o{" "}
          <button
            type="button"
            onClick={() => setOcultoPara(resultado)}
            className="font-medium text-primario underline underline-offset-4"
          >
            vuelva a intentarlo
          </button>
          .
        </p>
      </div>
    );
  }

  return (
    <>
      <h1 className="mt-12 text-center text-titulo font-normal text-primario">
        Cree su cuenta
      </h1>
      <p className="mt-2 text-center text-menor text-secundario">
        Registre su clínica y mande su primer caso hoy.
      </p>

      <form action={accion} className="mt-8 flex flex-col gap-4">
        <Campo
          etiqueta="Su nombre completo"
          name="nombreCompleto"
          type="text"
          autoComplete="name"
          placeholder="Dra. Ana Pérez"
          defaultValue={valores?.nombreCompleto}
          requerido
          marcaRequerido={false}
          autoFocus
        />

        <Campo
          etiqueta="Nombre de la clínica"
          name="nombreClinica"
          type="text"
          autoComplete="organization"
          placeholder="Clínica Dental Sonrisa"
          defaultValue={valores?.nombreClinica}
          requerido
          marcaRequerido={false}
        />

        <Campo
          etiqueta="Ciudad"
          name="ciudad"
          type="text"
          autoComplete="address-level2"
          placeholder="Durango"
          defaultValue={valores?.ciudad}
        />

        <Campo
          etiqueta="Correo"
          name="correo"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="doctor@suclinica.mx"
          defaultValue={valores?.correo}
          requerido
          marcaRequerido={false}
        />

        <Campo
          etiqueta="WhatsApp"
          name="telefono"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="618 123 4567"
          defaultValue={valores?.telefono}
        />

        <Campo
          etiqueta="Contraseña"
          name="contrasena"
          type={verContrasena ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
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

        {/* Trampa para robots: escondido para las personas y para el lector de
            pantalla; un robot lo llena y así se descarta el registro. */}
        <div aria-hidden="true" className="sr-only">
          <label>
            No llenar este campo
            <input type="text" name="sitio" tabIndex={-1} autoComplete="off" />
          </label>
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
          className="mt-2"
        >
          {enviando ? "Creando su cuenta…" : "Crear cuenta"}
        </Boton>
      </form>
    </>
  );
}
