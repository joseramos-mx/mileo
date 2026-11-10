/**
 * Las pantallas que se ven sin haber entrado.
 *
 * RUTA_DE_ENTRADA es donde vive la portada con el formulario de acceso: si en
 * su proyecto se llama distinto, se cambia aquí y se cambia en todos lados.
 * Las tres rutas tienen que estar permitidas en el proxy/middleware que manda
 * a la gente sin sesión a la portada.
 */
export const RUTA_DE_ENTRADA = "/entrar";
export const RUTA_DE_REGISTRO = "/registro";
export const RUTA_DE_VERIFICACION = "/verificar";

/** Dirección pública de Mileo, sin diagonal al final. Solo en el servidor. */
export function urlBase(): string {
  const url = process.env.MILEO_URL;
  if (!url) throw new Error("Falta URL_DE_LA_APP en el entorno.");
  return url.replace(/\/+$/, "");
}
