import "server-only";
import fs from "node:fs";
import path from "node:path";
import {
  DIAPOSITIVAS,
  MARCAS_COMPATIBLES,
  type Diapositiva,
  type MarcaCompatible,
} from "@/lib/entrada";

/**
 * Comprueba en el servidor qué imágenes de la portada existen de verdad.
 *
 * Así, mientras el equipo de diseño no entregue las fotos y los logotipos, la
 * pantalla enseña el marco con la descripción de lo que va ahí (§9) en vez de
 * una imagen rota, y no hay parpadeo: la decisión se toma antes de pintar.
 */

function existeEnPublico(ruta: string) {
  return fs.existsSync(path.join(process.cwd(), "public", ruta));
}

export function diapositivasDeLaPortada(): Diapositiva[] {
  return DIAPOSITIVAS.map((d) => ({
    ...d,
    imagen: d.imagen && existeEnPublico(d.imagen) ? d.imagen : undefined,
  }));
}

export function marcasDeLaPortada(): MarcaCompatible[] {
  return MARCAS_COMPATIBLES.map((m) => ({
    ...m,
    logo: m.logo && existeEnPublico(m.logo) ? m.logo : undefined,
  }));
}
