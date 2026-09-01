"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "@phosphor-icons/react";
import { cn } from "@/lib/utilidades";

/**
 * Interruptor de tema (SKILL.md §5.1).
 *
 * Oscuro por omisión, como el diseño entregado; claro como interruptor del
 * usuario. La elección se guarda en su navegador y se aplica antes del primer
 * pintado (ver el layout raíz).
 *
 * El tema real vive en el atributo `data-tema` del documento, no en React: el
 * guion que corre antes del primer pintado ya lo puso ahí. Este componente se
 * suscribe a ese atributo en vez de llevar su propia copia, que se desincroniza
 * en cuanto hay dos interruptores en pantalla.
 */

function suscribirse(alCambiar: () => void) {
  const observador = new MutationObserver(alCambiar);
  observador.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-tema"],
  });
  return () => observador.disconnect();
}

function leerDelDocumento() {
  return document.documentElement.dataset.tema !== "claro";
}

function leerEnElServidor() {
  return true;
}

export function InterruptorDeTema({ className }: { className?: string }) {
  const oscuro = useSyncExternalStore(
    suscribirse,
    leerDelDocumento,
    leerEnElServidor,
  );

  function alternar() {
    if (oscuro) {
      document.documentElement.dataset.tema = "claro";
      localStorage.setItem("mileo-tema", "claro");
    } else {
      delete document.documentElement.dataset.tema;
      localStorage.setItem("mileo-tema", "oscuro");
    }
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-pressed={oscuro}
      className={cn(
        "area-tactil flex items-center justify-center gap-2 rounded-control",
        "border border-borde bg-superficie px-3 text-menor text-secundario",
        "hover:text-primario",
        className,
      )}
    >
      {oscuro ? (
        <Sun aria-hidden="true" size={16} />
      ) : (
        <Moon aria-hidden="true" size={16} />
      )}
      {oscuro ? "Tema claro" : "Tema oscuro"}
    </button>
  );
}
