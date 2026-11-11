/**
 * Lo que se ve en la portada de Mileo (entrar, registro y verificar).
 *
 * Está aquí y no dentro de las pantallas para que el equipo de diseño pueda
 * cambiar la foto y las marcas sin tocar la interfaz. Las rutas van tal como se
 * entregaron, con sus espacios: se codifican al pintar.
 */

/** La foto del panel derecho. Ya viene con el desenfoque abajo para el texto. */
export const FOTO_DE_PORTADA = {
  ruta: "/bg slide login.png",
  etiqueta: "Una sonrisa con un escáner intraoral",
};

/** El asterisco de Mileo en blanco, para la esquina de la foto. */
export const ICONO_BLANCO = "/Asset 6mileo solo white.svg";

export type MarcaCompatible = {
  nombre: string;
  /** Ruta del logotipo dentro de /public. */
  logo: string;
  /**
   * Alto del `viewBox` del SVG. Los archivos vienen a la misma escala entre sí,
   * así que pintarlos a una misma razón de este alto los deja proporcionados.
   */
  altoOriginal: number;
};

/**
 * Las marcas de escáner con las que Mileo trabaja. Los logotipos son marcas
 * registradas de sus dueños; los entregó el equipo de diseño.
 */
export const MARCAS_COMPATIBLES: MarcaCompatible[] = [
  { nombre: "3Shape", logo: "/Asset 1scanners logo.svg", altoOriginal: 29.76 },
  { nombre: "Medit", logo: "/Asset 2scanners logo.svg", altoOriginal: 22.15 },
  { nombre: "Straumann", logo: "/Asset 3scanners logo.svg", altoOriginal: 34.01 },
  { nombre: "iTero", logo: "/Asset 4scanners logo.svg", altoOriginal: 35.81 },
  { nombre: "Shining 3D", logo: "/Asset 5scanners logo.svg", altoOriginal: 21.73 },
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
