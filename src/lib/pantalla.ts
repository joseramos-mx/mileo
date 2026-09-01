"use client";

import { useSyncExternalStore } from "react";

/**
 * Preguntas sobre el tamaño de la pantalla, contestadas en el navegador.
 *
 * Llevan prefijo `use` y no `usar` porque es lo que reconoce la regla de los
 * hooks de React; el resto del nombre sí va en español, como todo el código.
 *
 * En el servidor no se sabe de qué tamaño es la pantalla, así que el HTML se
 * pinta con la respuesta de escritorio y al montar se ajusta. Es la única
 * manera honesta: adivinar en el servidor deja el primer dibujo mal.
 */
function useConsulta(consulta: string, enElServidor: boolean) {
  return useSyncExternalStore(
    (avisar) => {
      const medio = window.matchMedia(consulta);
      medio.addEventListener("change", avisar);
      return () => medio.removeEventListener("change", avisar);
    },
    () => window.matchMedia(consulta).matches,
    () => enElServidor,
  );
}

/** Angosta: el odontograma enseña una arcada a la vez. */
export function usePantallaAngosta() {
  return useConsulta("(max-width: 1023px)", false);
}

/**
 * Si la pantalla da para poner el dibujo, el catálogo y el detalle del diente
 * uno junto al otro.
 *
 * Por debajo de 1440 no da: el dibujo se queda tan chico que un diente baja de
 * lo que se puede apretar con el dedo. Ahí el detalle se va al principio del
 * panel del catálogo, que es el otro lugar donde no hay que desplazarse para
 * verlo.
 */
export function useTresColumnas() {
  return useConsulta("(min-width: 1440px)", true);
}
