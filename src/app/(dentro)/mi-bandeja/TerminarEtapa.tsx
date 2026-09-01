"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Etapa } from "@/generated/prisma/enums";
import { Boton } from "@/componentes/Boton";
import { ETAPAS } from "@/lib/vocabulario";
import { siguienteEtapa } from "@/lib/etapas";
import { cambiarEtapa } from "@/app/(dentro)/casos/[id]/acciones";

/**
 * Un solo botón para terminar la etapa (SKILL.md O-5).
 *
 * Quien está en el taller no viene a escoger de una lista: aprieta un botón que
 * dice a dónde pasa el caso, y ya.
 */
export function TerminarEtapa({
  casoId,
  etapa,
  tieneAprobacion,
}: {
  casoId: string;
  etapa: Etapa;
  tieneAprobacion: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [trabajando, empezar] = useTransition();

  const destino = siguienteEtapa(etapa);
  if (!destino) return null;

  // El bloqueo duro también se refleja en la interfaz: sin aprobación del
  // doctor, este botón no manda a fabricación (O-4).
  const bloqueado = destino === "EN_FABRICACION" && !tieneAprobacion;

  return (
    <div className="flex flex-col gap-2">
      <Boton
        type="button"
        tono="principal"
        disabled={trabajando || bloqueado}
        onClick={() =>
          empezar(async () => {
            const resultado = await cambiarEtapa(casoId, destino);
            if (resultado.error) setError(resultado.error);
            else {
              setError(null);
              router.refresh();
            }
          })
        }
      >
        {trabajando ? "Guardando…" : `Pasar a ${ETAPAS[destino].nombre.toLowerCase()}`}
      </Boton>

      {bloqueado ? (
        <p className="text-menor text-secundario">
          Falta la aprobación del doctor. Mande el diseño desde la pantalla del
          caso.
        </p>
      ) : null}

      <p role="alert" aria-live="polite" className={error ? "text-menor text-pendiente-texto" : "sr-only"}>
        {error ?? ""}
      </p>
    </div>
  );
}
