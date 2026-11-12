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
  {
    nombre: "Straumann",
    logo: "/Asset 3scanners logo.svg",
    altoOriginal: 34.01,
  },
  { nombre: "iTero", logo: "/Asset 4scanners logo.svg", altoOriginal: 35.81 },
  {
    nombre: "Shining 3D",
    logo: "/Asset 5scanners logo.svg",
    altoOriginal: 21.73,
  },
];

/**
 * Los renders 3D por tipo de trabajo, tal como los entregó el equipo de diseño.
 * Se usan en las tarjetas de categoría del inicio y como miniatura de cada caso.
 * Las rutas van con sus espacios: se codifican al pintar, no se renombra nada.
 *
 * Vienen con fondo transparente. Cada objeto ocupa distinta parte de su lienzo, así que aquí se guarda cuánto ocupa de
 * verdad y `escalaDelRender` los iguala. Los números se miden con
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
  ruta: "/iconos 3d/01-corona.png",
  etiqueta: "Render de una corona",
  proporcion: 1,
  fraccionAncho: 0.586,
  fraccionAlto: 0.666,
};

export const RENDER_DE_PUENTE: Render3D = {
  ruta: "/iconos 3d/02-puente.png",
  etiqueta: "Render de un puente",
  proporcion: 1,
  fraccionAncho: 0.65,
  fraccionAlto: 0.527,
};

export const RENDER_DE_IMPLANTE: Render3D = {
  ruta: "/iconos 3d/07-protesis-sobre-implantes.png",
  etiqueta: "Render de una corona sobre implante con su tornillo",
  proporcion: 1,
  fraccionAncho: 0.431,
  fraccionAlto: 0.799,
};

export const RENDER_DE_CARILLAS: Render3D = {
  ruta: "/iconos 3d/06-carillas.png",
  etiqueta: "Render de carillas",
  proporcion: 1,
  fraccionAncho: 0.541,
  fraccionAlto: 0.654,
};

export const RENDER_DE_PROVISIONAL: Render3D = {
  ruta: "/iconos 3d/11-provisional.png",
  etiqueta: "Render de un provisional",
  proporcion: 1,
  fraccionAncho: 0.591,
  fraccionAlto: 0.628,
};

export const RENDER_DE_GUARDA: Render3D = {
  ruta: "/iconos 3d/09-guarda-ferula.png",
  etiqueta: "Render de una guarda oclusal",
  proporcion: 1,
  fraccionAncho: 0.652,
  fraccionAlto: 0.446,
};

export const RENDER_DE_MODELO: Render3D = {
  ruta: "/iconos 3d/05-modelo-impreso-3d.png",
  etiqueta: "Render de un modelo impreso en 3D",
  proporcion: 1,
  fraccionAncho: 0.659,
  fraccionAlto: 0.559,
};

export const RENDER_DE_BARRA: Render3D = {
  ruta: "/iconos 3d/03-barra-titanio.png",
  etiqueta: "Render de una barra sobre implantes",
  proporcion: 1,
  fraccionAncho: 0.684,
  fraccionAlto: 0.425,
};

export const RENDER_DE_ENCERADO: Render3D = {
  ruta: "/iconos 3d/10-encerado-diagnostico.png",
  etiqueta: "Render de un encerado diagnóstico",
  proporcion: 1,
  fraccionAncho: 0.628,
  fraccionAlto: 0.583,
};

export const RENDER_DE_GUIA_QUIRURGICA: Render3D = {
  ruta: "/iconos 3d/04-guia-quirurgica.png",
  etiqueta: "Render de una guía quirúrgica",
  proporcion: 1,
  fraccionAncho: 0.699,
  fraccionAlto: 0.594,
};

export const RENDER_DE_REMOVIBLE: Render3D = {
  ruta: "/iconos 3d/08-protesis-removible.png",
  etiqueta: "Render de una prótesis parcial removible",
  proporcion: 1,
  fraccionAncho: 0.707,
  fraccionAlto: 0.604,
};

export const RENDERS_3D: Render3D[] = [
  RENDER_DE_CORONA,
  RENDER_DE_PUENTE,
  RENDER_DE_IMPLANTE,
  RENDER_DE_CARILLAS,
  RENDER_DE_PROVISIONAL,
  RENDER_DE_GUARDA,
  RENDER_DE_MODELO,
  RENDER_DE_BARRA,
  RENDER_DE_ENCERADO,
  RENDER_DE_GUIA_QUIRURGICA,
  RENDER_DE_REMOVIBLE,
];

/**
 * Qué render lleva cada tipo de trabajo. La barra, el encerado, la guía
 * quirúrgica y la removible ya están entregados, pero todavía no hay un tipo de
 * trabajo que los use: se agregan aquí en cuanto exista la indicación.
 */
export const RENDER_POR_INDICACION: Record<string, Render3D> = {
  CORONA_Y_PUENTE: RENDER_DE_CORONA,
  INCRUSTACION_Y_CARILLA: RENDER_DE_CARILLAS,
  PROVISIONAL: RENDER_DE_PROVISIONAL,
  GUARDA_OCLUSAL: RENDER_DE_GUARDA,
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
