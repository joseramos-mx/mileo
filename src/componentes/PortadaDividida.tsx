import Image from "next/image";
import type { ReactNode } from "react";
import { GradienteVivo } from "@/componentes/GradienteVivo";
import {
  FOTO_DE_PORTADA,
  ICONO_BLANCO,
  MARCAS_COMPATIBLES,
} from "@/lib/entrada";

/**
 * El armado de la portada (entrar, registro y verificar), igual al diseño
 * entregado: a la izquierda el formulario centrado y, abajo, la fila de
 * escáneres compatibles; a la derecha una tarjeta redondeada con la foto, el
 * lema encima y el asterisco de Mileo en la esquina.
 *
 * Siempre oscura, sin importar el tema: es la portada (§5.1).
 */

/** Cuántos píxeles mide cada unidad del `viewBox` de los logotipos. */
const ESCALA_DE_LOGOS = 0.76;

export function PortadaDividida({ children }: { children: ReactNode }) {
  return (
    <main className="siempre-oscuro relative isolate grid h-dvh grid-cols-1 overflow-hidden bg-black lg:grid-cols-2">
      {/* Un resplandor azul que baja desde el borde de arriba, a todo lo ancho,
          y se apaga en el negro. Va detrás de todo: la foto lo tapa y el
          formulario queda encima. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 hidden h-[24vh] lg:block"
        style={{
          maskImage: "linear-gradient(to bottom, black 0%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, black 0%, transparent 100%)",
        }}
      >
        <GradienteVivo />
      </div>

      {/* --- Izquierda: formulario y escáneres ----------------------------- */}
      <div className="relative min-h-0">
        {/* Se desplaza por dentro si hace falta: con el texto al 200% tiene
            que seguir alcanzándose (§7), sin que la pantalla entera se mueva.
            El relleno de abajo deja libre la fila de logotipos. */}
        <div className="flex h-full justify-center overflow-y-auto px-6 py-10 lg:pb-40">
          <div className="my-auto w-full max-w-xs">{children}</div>
        </div>

        <ul
          aria-label="Escáneres compatibles"
          className="pointer-events-none absolute inset-x-0 bottom-[12%] hidden items-center justify-between px-[clamp(2rem,5vw,4.75rem)] lg:flex"
        >
          {MARCAS_COMPATIBLES.map((marca) => (
            <li key={marca.nombre}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={encodeURI(marca.logo)}
                alt={marca.nombre}
                style={{
                  height: `calc(${marca.altoOriginal * ESCALA_DE_LOGOS}px * var(--escala-logos, 1))`,
                }}
                className="w-auto [--escala-logos:0.8] xl:[--escala-logos:1]"
              />
            </li>
          ))}
        </ul>
      </div>

      {/* --- Derecha: la foto con el lema ---------------------------------- */}
      <div className="relative hidden min-h-0 py-[5.5vh] pr-8 pl-14 lg:flex">
        <div className="relative flex-1 overflow-hidden rounded-panel">
          <Image
            src={encodeURI(FOTO_DE_PORTADA.ruta)}
            alt={FOTO_DE_PORTADA.etiqueta}
            fill
            priority
            sizes="50vw"
            className="object-cover"
          />

          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-6 px-10 pb-11 text-white">
            <div>
              <p className="text-[clamp(2.5rem,3.7vw,3.75rem)] leading-[1.05] tracking-tight">
                <span className="block font-bold">Nada en</span>
                <span className="block font-light">tu camino</span>
              </p>
              <p className="mt-6 text-[clamp(1rem,1.2vw,1.25rem)] leading-[1.45]">
                Diseñado para que tu trabajo fluya,
                <br />
                sin fricciones ni interrupciones.
              </p>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={encodeURI(ICONO_BLANCO)}
              alt=""
              aria-hidden="true"
              className="size-12 shrink-0"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
