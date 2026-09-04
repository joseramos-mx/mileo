"use client";

import { useState, useTransition } from "react";
import { guardarAvisos } from "./acciones";
import { ejecutar } from "@/lib/acciones-cliente";

/**
 * Avisos configurables (SKILL.md O-3).
 *
 * Máximo un aviso por etapa. Notificar diez veces por caso hasta que el doctor
 * apaga los avisos es un antipatrón (§11): por eso puede escoger canal en vez
 * de tener que apagarlo todo.
 */
export function Avisos({
  porCorreo,
  porWhatsapp,
  telefono,
}: {
  porCorreo: boolean;
  porWhatsapp: boolean;
  telefono: string | null;
}) {
  const [correo, setCorreo] = useState(porCorreo);
  const [whatsapp, setWhatsapp] = useState(porWhatsapp);
  const [aviso, setAviso] = useState<string | null>(null);
  const [, empezar] = useTransition();

  function guardar(nuevoCorreo: boolean, nuevoWhatsapp: boolean) {
    setCorreo(nuevoCorreo);
    setWhatsapp(nuevoWhatsapp);
    empezar(async () => {
      const resultado = await ejecutar(() =>
        guardarAvisos(nuevoCorreo, nuevoWhatsapp),
      );
      setAviso(resultado.error ?? resultado.listo ?? null);
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-contenedor border border-borde bg-superficie p-5">
      <div>
        <h2 className="text-subtitulo font-semibold text-primario">
          Cómo le aviso
        </h2>
        <p className="mt-1 text-menor text-secundario">
          Le mando un aviso por cada cambio de etapa de sus casos, uno por etapa
          y nada más.
        </p>
      </div>

      <label className="area-tactil flex items-center gap-3">
        <input
          type="checkbox"
          checked={correo}
          onChange={(e) => guardar(e.target.checked, whatsapp)}
          className="size-5 accent-accion"
        />
        <span className="text-cuerpo text-primario">Por correo</span>
      </label>

      <label className="area-tactil flex items-center gap-3">
        <input
          type="checkbox"
          checked={whatsapp}
          onChange={(e) => guardar(correo, e.target.checked)}
          className="size-5 accent-accion"
        />
        <span className="text-cuerpo text-primario">
          Por WhatsApp
          {telefono ? (
            <span className="text-secundario"> · {telefono}</span>
          ) : (
            <span className="text-secundario">
              {" "}
              · falta su teléfono, escríbanos y lo damos de alta
            </span>
          )}
        </span>
      </label>

      <p aria-live="polite" className="text-menor text-secundario">
        {aviso ?? ""}
      </p>
    </section>
  );
}
