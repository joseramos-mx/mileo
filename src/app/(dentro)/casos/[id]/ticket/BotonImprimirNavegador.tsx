"use client";

import { useState, useTransition } from "react";
import { Printer } from "@phosphor-icons/react";
import { Boton } from "@/componentes/Boton";
import { ejecutar } from "@/lib/acciones-cliente";
import { solicitarImpresionDeTicket } from "../acciones";

export function BotonImprimirNavegador({ casoId }: { casoId: string }) {
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [enviando, empezar] = useTransition();

  return (
    <div className="flex flex-col gap-2 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <Boton
          type="button"
          tono="principal"
          disabled={enviando}
          onClick={() =>
            empezar(async () => {
              const res = await ejecutar(() =>
                solicitarImpresionDeTicket(casoId),
              );
              if (res.error) {
                setMensaje(res.error);
              } else {
                setMensaje("Ticket enviado a imprimir.");
              }
            })
          }
        >
          <Printer aria-hidden="true" size={18} />
          {enviando ? "Enviando…" : "Mandar a imprimir Ticket"}
        </Boton>

        <Boton type="button" onClick={() => window.print()}>
          Imprimir desde el navegador
        </Boton>
      </div>

      {mensaje ? (
        <p className="text-menor text-terminado-texto">{mensaje}</p>
      ) : null}
    </div>
  );
}

