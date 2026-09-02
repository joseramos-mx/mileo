"use client";

import { useActionState } from "react";
import { Campo } from "@/componentes/Campo";
import { Boton } from "@/componentes/Boton";
import { crearBorrador, type ResultadoDeBorrador } from "../acciones";

/**
 * Primer paso del alta: de quién es el caso, y nada más.
 *
 * Aquí se preguntaba también qué tipo de trabajo era. Se quitó: era pedirle al
 * doctor que resumiera por adelantado lo que va a capturar diente por diente en
 * el paso siguiente, con el catálogo completo enfrente. La indicación se deduce
 * de lo capturado, que es el dato de verdad (ver `indicacionDeLasUnidades`).
 */
export function FormularioDeCaso({
  folioSugerido,
}: {
  /** El siguiente número de paciente de la clínica, ya calculado. */
  folioSugerido: string;
}) {
  const [resultado, accion, enviando] = useActionState<
    ResultadoDeBorrador,
    FormData
  >(crearBorrador, {});

  return (
    <form action={accion} className="flex flex-col gap-8">
      <fieldset className="flex flex-col gap-5">
        {/* El título y su explicación van dentro del <legend>: el navegador
            saca la leyenda del flujo del fieldset, así que el `gap` del flex no
            la separa de lo que sigue y cualquier margen negativo se la come. */}
        <legend className="mb-4 flex flex-col gap-1">
          <span className="text-subtitulo font-semibold text-primario">
            ¿De qué paciente?
          </span>
          <span className="text-menor font-normal text-secundario">
            Con el folio y las iniciales basta. El nombre completo es suyo y
            sólo se guarda si usted lo escribe. Si el paciente ya tiene casos,
            escriba su mismo folio para que queden juntos.
          </span>
        </legend>

        {/* El número lo da el sistema. Queda editable porque muchas clínicas
            usan el suyo, y porque escribir el de un paciente que ya tiene caso
            es justamente cómo se le manda trabajo otra vez. */}
        <input type="hidden" name="folioSugerido" value={folioSugerido} />
        <Campo
          etiqueta="Folio del paciente"
          name="folioPaciente"
          requerido
          defaultValue={folioSugerido}
          inputMode="text"
          autoComplete="off"
          ayuda="Se lo doy yo. Puede cambiarlo."
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
