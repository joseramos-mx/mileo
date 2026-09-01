/**
 * Lo que se ve en la portada de Mileo.
 *
 * Está aquí y no dentro de las pantallas para que el equipo de diseño y el
 * laboratorio puedan cambiar las fotos y las marcas sin tocar la interfaz.
 */

export type Diapositiva = {
  /**
   * Ruta de la foto dentro de /public. Mientras no exista, la pantalla enseña
   * el marco con la descripción: no se recrean imágenes en código (§9).
   */
  imagen?: string;
  /** Qué debe ir ahí. Es la descripción para quien no ve la foto. */
  etiqueta: string;
};

/**
 * ⚠️ Para el equipo de diseño: dejen las fotos en `public/entrada/` con estos
 * nombres y la portada queda igual al diseño entregado, sin tocar código.
 */
export const DIAPOSITIVAS: Diapositiva[] = [
  {
    imagen: "/entrada/laboratorio.jpg",
    etiqueta: "El laboratorio RMS Zahnfacturing en Durango",
  },
  {
    imagen: "/entrada/diseno.jpg",
    etiqueta: "Un diseño de zirconio en pantalla, listo para aprobación",
  },
  {
    imagen: "/entrada/entrega.jpg",
    etiqueta: "Un caso terminado y empacado, listo para salir",
  },
];

export type MarcaCompatible = {
  nombre: string;
  /** Ruta del logotipo dentro de /public/marcas. Opcional hasta que lo entreguen. */
  logo?: string;
};

/**
 * Las marcas de escáner con las que Mileo trabaja.
 *
 * ⚠️ Pendiente del Product Owner (§12.6): confirmar cuáles se cubren el primer
 * día. Los logotipos son marcas registradas de sus dueños: los entrega el
 * equipo de diseño en `public/marcas/`, no se dibujan en código (§9). Mientras
 * tanto se enseña el nombre.
 */
export const MARCAS_COMPATIBLES: MarcaCompatible[] = [
  { nombre: "3Shape", logo: "/marcas/3shape.svg" },
  { nombre: "Medit", logo: "/marcas/medit.svg" },
  { nombre: "Straumann", logo: "/marcas/straumann.svg" },
  { nombre: "Dental Wings", logo: "/marcas/dental-wings.svg" },
  { nombre: "Carestream", logo: "/marcas/carestream.svg" },
  { nombre: "Planmeca", logo: "/marcas/planmeca.svg" },
];

/**
 * Los renders 3D por tipo de trabajo, tal como los entregó el equipo de diseño.
 * Se usan en las tarjetas de categoría del inicio y como miniatura de cada caso.
 * Las rutas van con sus espacios: se codifican al pintar, no se renombra nada.
 *
 * Cada PNG trae el objeto con distinta cantidad de transparente alrededor: la
 * corona ocupa el 55% de su lienzo y el implante el 89%. Puestos del mismo
 * tamaño se verían dispares, así que aquí se guarda cuánto ocupa cada uno de
 * verdad y `alturaDelRender` los iguala. Los números se miden con
 * `npm run medir:renders`, no a ojo.
 */
export type Render3D = {
  ruta: string;
  etiqueta: string;
  /** Ancho entre alto del lienzo. */
  proporcion: number;
  /** Qué fracción del lienzo ocupa el objeto. */
  fraccionAncho: number;
  fraccionAlto: number;
};

export const RENDER_DE_CORONA: Render3D = {
  ruta: "/iconos 3d/corona.png",
  etiqueta: "Render de una corona de zirconio",
  proporcion: 1,
  fraccionAncho: 0.582,
  fraccionAlto: 0.555,
};

export const RENDER_DE_IMPLANTE: Render3D = {
  ruta: "/iconos 3d/caso de implante.png",
  etiqueta: "Render de una corona sobre implante con su tornillo",
  proporcion: 0.667,
  fraccionAncho: 0.872,
  fraccionAlto: 0.887,
};

export const RENDER_DE_MODELO: Render3D = {
  ruta: "/iconos 3d/modelo.png",
  etiqueta: "Render de un modelo impreso en 3D",
  proporcion: 1,
  fraccionAncho: 0.649,
  fraccionAlto: 0.515,
};

export const RENDERS_3D: Render3D[] = [
  RENDER_DE_CORONA,
  RENDER_DE_IMPLANTE,
  RENDER_DE_MODELO,
];

export const RENDER_POR_INDICACION: Record<string, Render3D> = {
  CORONA_Y_PUENTE: RENDER_DE_CORONA,
  INCRUSTACION_Y_CARILLA: RENDER_DE_CORONA,
  PROVISIONAL: RENDER_DE_CORONA,
  GUARDA_OCLUSAL: RENDER_DE_CORONA,
  SOBRE_IMPLANTE: RENDER_DE_IMPLANTE,
  MODELO_3D: RENDER_DE_MODELO,
};

/**
 * Cuánto agrandar un render para que todos se vean del mismo tamaño.
 *
 * Se aplica como `transform: scale()` sobre una imagen que ya llena un hueco
 * **cuadrado** con `object-contain`. Se hace con transform y no con alto,
 * porque el transform no mueve el acomodo: el aire transparente del archivo
 * puede salirse sin empujar la tarjeta ni recortar la pieza.
 *
 * La cuenta iguala el **lado mayor visible** de cada objeto, así que una corona
 * compacta, un implante alto y un modelo ancho ocupan el mismo espacio aunque
 * tengan formas muy distintas. Y como el objeto queda en `ocupacion` del hueco,
 * con `ocupacion <= 1` nunca se sale de su cuadro.
 *
 * @param ocupacion qué fracción del hueco debe llenar el lado mayor del objeto.
 */
export function escalaDelRender(render: Render3D, ocupacion = 0.85) {
  const ladoMayor = Math.max(
    render.proporcion * render.fraccionAncho,
    render.fraccionAlto,
  );
  return Number((ocupacion / ladoMayor).toFixed(3));
}
