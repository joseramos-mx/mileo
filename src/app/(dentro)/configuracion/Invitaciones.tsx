"use client";

import { useActionState, useState } from "react";
import type { Rol } from "@/generated/prisma/enums";
import { Campo, CampoDeSeleccion } from "@/componentes/Campo";
import { Boton } from "@/componentes/Boton";
import { ROLES } from "@/lib/vocabulario";
import { fechaCorta } from "@/lib/fechas";
import { invitar, type Resultado } from "./acciones";

/**
 * Invitaciones (SKILL.md O-1).
 *
 * Administración puede invitar a Admin, Laboratorio o Clínica (eligiendo una
 * clínica existente o dando de alta una nueva). Una clínica puede invitar a
 * otros dentistas de su mismo consultorio.
 */
export function Invitaciones({
  esAdmin,
  roles,
  clinicas,
  invitaciones,
}: {
  esAdmin: boolean;
  roles: Rol[];
  clinicas: { id: string; nombre: string }[];
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
  const [rolElegido, setRolElegido] = useState<Rol>(roles[0]);
  const [clinicaElegida, setClinicaElegida] = useState<string>(
    clinicas[0]?.id ?? "__nueva__",
  );

  const pideClinica = esAdmin && rolElegido === "CLINICA";
  const pideNombreNuevaClinica =
    pideClinica && (clinicas.length === 0 || clinicaElegida === "__nueva__");

  return (
    <section className="flex flex-col gap-4 rounded-contenedor border border-borde bg-superficie p-5">
      <div>
        <h2 className="text-subtitulo font-semibold text-primario">
          Invitar a alguien
        </h2>
        <p className="mt-1 text-menor text-secundario">
          {esAdmin
            ? "En Mileo se entra sólo por invitación. Elija si la persona entra como Admin, Laboratorio o Clínica."
            : "En Mileo se entra sólo por invitación. Puede invitar a otro dentista o colega de su clínica."}
        </p>
      </div>

      <form action={accion} className="flex flex-col gap-4">
        <Campo
          etiqueta="Correo"
          name="correo"
          type="email"
          inputMode="email"
          requerido
          placeholder="doctor@suclinica.mx"
        />

        <CampoDeSeleccion
          etiqueta="Rol"
          name="rol"
          requerido
          value={rolElegido}
          onChange={(e) => setRolElegido(e.target.value as Rol)}
        >
          {roles.map((rol) => (
            <option key={rol} value={rol}>
              {ROLES[rol]}
            </option>
          ))}
        </CampoDeSeleccion>

        {pideClinica && clinicas.length > 0 ? (
          <CampoDeSeleccion
            etiqueta="Clínica"
            name="clinicaId"
            requerido
            value={clinicaElegida}
            onChange={(e) => setClinicaElegida(e.target.value)}
          >
            {clinicas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
            <option value="__nueva__">Nueva clínica…</option>
          </CampoDeSeleccion>
        ) : null}

        {pideNombreNuevaClinica ? (
          <Campo
            etiqueta="Nombre de la clínica o consultorio"
            name="nombreClinica"
            requerido
            placeholder="Clínica Dental del Valle"
          />
        ) : null}

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
