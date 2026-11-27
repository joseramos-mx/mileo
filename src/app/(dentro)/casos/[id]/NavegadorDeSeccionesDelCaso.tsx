"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "@phosphor-icons/react";
import { Boton } from "@/componentes/Boton";

const SELECTOR_SECCIONES = "[data-seccion-lab]";

/**
 * Navegación flotante por secciones del caso para la vista de laboratorio.
 *
 * - Si está en la primera sección (hasta arriba), muestra únicamente el botón
 *   para bajar a la siguiente sección.
 * - Si está en una sección intermedia, muestra ambos botones (subir a la
 *   sección anterior y bajar a la siguiente).
 * - Si está en la última sección (hasta abajo), muestra únicamente el botón
 *   para subir a la sección anterior.
 */
export function NavegadorDeSeccionesDelCaso() {
  const [indiceActual, setIndiceActual] = useState(0);
  const [totalSecciones, setTotalSecciones] = useState(0);

  useEffect(() => {
    const contenedor = document.getElementById("contenido");

    function obtenerSecciones(): HTMLElement[] {
      return Array.from(
        document.querySelectorAll<HTMLElement>(SELECTOR_SECCIONES),
      );
    }

    function calcularSeccionActual() {
      const secciones = obtenerSecciones();
      setTotalSecciones(secciones.length);
      if (secciones.length <= 1) {
        setIndiceActual(0);
        return;
      }

      if (contenedor) {
        const scrollTop = contenedor.scrollTop;
        const maxScroll = contenedor.scrollHeight - contenedor.clientHeight;

        if (scrollTop <= 24) {
          setIndiceActual(0);
          return;
        }
        if (maxScroll > 0 && scrollTop >= maxScroll - 32) {
          setIndiceActual(secciones.length - 1);
          return;
        }

        const rectContenedor = contenedor.getBoundingClientRect();
        const lineaReferencia = rectContenedor.top + 140;

        let mejorIndice = 0;
        for (let i = 0; i < secciones.length; i++) {
          const rect = secciones[i].getBoundingClientRect();
          if (rect.top <= lineaReferencia) {
            mejorIndice = i;
          } else {
            break;
          }
        }
        setIndiceActual(mejorIndice);
      } else {
        const lineaReferencia = 140;
        let mejorIndice = 0;
        for (let i = 0; i < secciones.length; i++) {
          const rect = secciones[i].getBoundingClientRect();
          if (rect.top <= lineaReferencia) {
            mejorIndice = i;
          } else {
            break;
          }
        }
        setIndiceActual(mejorIndice);
      }
    }

    calcularSeccionActual();

    const destinoScroll: EventTarget = contenedor ?? window;
    destinoScroll.addEventListener("scroll", calcularSeccionActual, {
      passive: true,
    });
    window.addEventListener("resize", calcularSeccionActual);

    const observador = new MutationObserver(calcularSeccionActual);
    if (contenedor) {
      observador.observe(contenedor, { childList: true, subtree: true });
    }

    return () => {
      destinoScroll.removeEventListener("scroll", calcularSeccionActual);
      window.removeEventListener("resize", calcularSeccionActual);
      observador.disconnect();
    };
  }, []);

  if (totalSecciones <= 1) return null;

  const enPrimera = indiceActual <= 0;
  const enUltima = indiceActual >= totalSecciones - 1;

  function irASeccion(nuevoIndice: number) {
    const secciones = Array.from(
      document.querySelectorAll<HTMLElement>(SELECTOR_SECCIONES),
    );
    const destino = secciones[nuevoIndice];
    if (!destino) return;

    setIndiceActual(nuevoIndice);
    destino.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <nav
      aria-label="Navegación entre secciones del caso"
      className="fixed right-4 bottom-20 z-30 flex flex-col gap-2 lg:right-6 lg:bottom-6"
    >
      {!enPrimera ? (
        <Boton
          type="button"
          tono="principal"
          forma="circular"
          onClick={() => irASeccion(Math.max(0, indiceActual - 1))}
          aria-label="Subir a la sección anterior"
          title="Subir a la sección anterior"
          className="shadow-lg"
        >
          <ArrowUp aria-hidden="true" size={20} weight="bold" />
        </Boton>
      ) : null}

      {!enUltima ? (
        <Boton
          type="button"
          tono="principal"
          forma="circular"
          onClick={() =>
            irASeccion(Math.min(totalSecciones - 1, indiceActual + 1))
          }
          aria-label="Bajar a la siguiente sección"
          title="Bajar a la siguiente sección"
          className="shadow-lg"
        >
          <ArrowDown aria-hidden="true" size={20} weight="bold" />
        </Boton>
      ) : null}
    </nav>
  );
}
