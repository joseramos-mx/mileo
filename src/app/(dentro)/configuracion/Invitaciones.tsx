"use client";

import { useActionState } from "react";
import type { Rol } from "@/generated/prisma/enums";
import { Campo, CampoDeSeleccion } from "@/componentes/Campo";
import { Boton } from "@/componentes/Boton";
import { ROLES } from "@/lib/vocabulario";
import { fechaCorta } from "@/lib/fechas";
import { invitar, type Resultado } from "./acciones";

/**
 * Invitaciones (SKILL.md O-1).
 *
 * El doctor puede invitar a su asistente. La asistente sube y consulta, pero no
 * aprueba diseños ni ve facturación: eso se dice aquí para que nadie se lleve
 * una sorpresa.
 */
export function Invitaciones({
  roles,
  invitaciones,
}: {
  roles: Rol[];
  invitaciones: {
    id: string;
    correo: string;
    rol: Rol;
    aceptada: boolean;
    expiraEn: string;
  }[];
}) {
  const [resultado, accion, enviando] = useActionState<Resultado, FormData>(
    invitar,
    {},
  );

  return (
    <section className="flex flex-col gap-4 rounded-contenedor border border-borde bg-superficie p-5">
      <div>
        <h2 className="text-subtitulo font-semibold text-primario">
          Invitar a alguien
        </h2>
        <p className="mt-1 text-menor text-secundario">
          En Mileo se entra sólo por invitación. Su asistente puede dar de alta
          casos y subir archivos; la aprobación del diseño y la facturación se
          quedan con usted.
        </p>
      </div>

      <form action={accion} className="flex flex-col gap-4">
        <Campo
          etiqueta="Correo"
          name="correo"
          type="email"
          inputMode="email"
          requerido
          placeholder="asistente@suclinica.mx"
        />

        <CampoDeSeleccion etiqueta="Rol" name="rol" requerido defaultValue={roles[0]}>
          {roles.map((rol) => (
            <option key={rol} value={rol}>
              {ROLES[rol]}
            </option>
          ))}
        </CampoDeSeleccion>

        <p
          role="alert"
          aria-live="polite"
          className={
            resultado.error
              ? "rounded-control border border-pendiente/40 bg-pendiente-fondo px-3 py-2 text-menor text-pendiente-texto"
              : resultado.listo
                ? "rounded-control border border-terminado/40 bg-terminado-fondo px-3 py-2 text-menor text-terminado-texto"
                : "sr-only"
          }
        >
          {resultado.error ?? resultado.listo ?? ""}
        </p>

        <Boton
          type="submit"
          tono="principal"
          disabled={enviando}
          className="self-start"
        >
          {enviando ? "Mandando…" : "Mandar invitación"}
        </Boton>
      </form>

      {invitaciones.length > 0 ? (
        <div>
          <h3 className="text-menor font-medium text-primario">
            Invitaciones que ha mandado
          </h3>
          <ul className="mt-2 flex flex-col gap-1">
            {invitaciones.map((invitacion) => (
              <li
                key={invitacion.id}
                className="flex flex-wrap justify-between gap-2 text-menor"
              >
                <span className="text-primario">{invitacion.correo}</span>
                <span className="text-secundario">
                  {ROLES[invitacion.rol]} ·{" "}
                  {invitacion.aceptada
                    ? "ya entró"
                    : `vence el ${fechaCorta(new Date(invitacion.expiraEn))}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
