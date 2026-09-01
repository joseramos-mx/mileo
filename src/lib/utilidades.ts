import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Une clases de Tailwind resolviendo las que se pisan entre sí.
 *
 * Hay que enseñarle nuestras escalas. Sin esto, tailwind-merge no sabe si
 * `text-cuerpo` es un tamaño o un color y lo mete en el mismo grupo que
 * `text-sobre-accion`: al chocar, se queda con uno y borra el otro. Eso dejaba
 * al botón principal con el texto oscuro sobre el relleno azul, 2.8:1, muy por
 * debajo del 4.5:1 que exige §7. Lo encontró la auditoría de contraste.
 */

const TAMANOS_DE_TEXTO = [
  "titular",
  "titulo",
  "subtitulo",
  "realce",
  "cuerpo",
  "menor",
  "minimo",
];

const COLORES = [
  "app",
  "superficie",
  "superficie-suave",
  "superficie-marcada",
  "borde",
  "borde-encima",
  "primario",
  "secundario",
  "accion",
  "accion-encima",
  "sobre-accion",
  "enlace",
  "foco",
  "pendiente",
  "pendiente-fondo",
  "pendiente-texto",
  "proceso",
  "proceso-fondo",
  "proceso-texto",
  "terminado",
  "terminado-fondo",
  "terminado-texto",
  "portada",
  "categoria",
  "validacion",
  "cielo",
  "magenta",
  "pastilla-neutra-fondo",
  "pastilla-neutra-texto",
  "pastilla-azul-fondo",
  "pastilla-azul-texto",
  "pastilla-verde-fondo",
  "pastilla-verde-texto",
  "pastilla-ambar-fondo",
  "pastilla-ambar-texto",
  "diente-lienzo",
  "diente-cuerpo",
  "diente-contorno",
  "diente-trabajo",
  "diente-trabajo-contorno",
  "diente-pontico",
  "diente-anillo",
  "diente-numero",
  "diente-puente",
  "mosaico-recibido",
  "mosaico-revision",
  "mosaico-aceptado",
  "mosaico-diseno",
  "mosaico-aprobacion",
  "mosaico-fabricacion",
  "mosaico-calidad",
  "mosaico-camino",
  "mosaico-entregado",
  "mosaico-pausa",
  "mosaico-rehacer",
];

const RADIOS = ["control", "tarjeta", "contenedor"];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: TAMANOS_DE_TEXTO }],
      "text-color": [{ text: COLORES }],
      "bg-color": [{ bg: COLORES }],
      "border-color": [{ border: COLORES }],
      "border-w": [],
      // El odontograma pinta dientes: sus colores llegan por fill y stroke.
      fill: [{ fill: COLORES }],
      stroke: [{ stroke: COLORES }],
      rounded: [{ rounded: RADIOS }],
    },
  },
});

export function cn(...clases: ClassValue[]) {
  return twMerge(clsx(clases));
}
