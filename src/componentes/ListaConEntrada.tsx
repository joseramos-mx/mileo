"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";

/**
 * Entrada escalonada de una lista (SKILL.md §5.5).
 *
 * Tres reglas que este componente respeta a propósito:
 *
 * - 150–250 ms. Nada más lento.
 * - Con `prefers-reduced-motion` todo aparece sin transición.
 * - Si la animación retrasara que el doctor vea su información, se elimina: por
 *   eso las tarjetas ya están visibles en el HTML y la animación sólo parte de
 *   un desplazamiento. Si el guion no corre, no se pierde nada.
 */
export function ListaConEntrada({
  children,
  className = "flex flex-col gap-3",
}: {
  children: ReactNode;
  /**
   * La caja que acomoda a los hijos. Las listas de casos le pasan la rejilla
   * de tarjetas de 380 px; lo demás se queda en columna.
   */
  className?: string;
}) {
  const contenedor = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const nodo = contenedor.current;
    if (!nodo) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const contexto = gsap.context(() => {
      gsap.from(nodo.children, {
        y: 8,
        opacity: 0,
        duration: 0.2,
        ease: "power2.out",
        stagger: 0.04,
      });
    }, nodo);

    return () => contexto.revert();
  }, []);

  return (
    <div ref={contenedor} className={className}>
      {children}
    </div>
  );
}
