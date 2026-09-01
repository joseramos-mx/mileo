import "server-only";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export { enTamano } from "@/lib/formato";

/**
 * Dónde viven los archivos de paciente (SKILL.md O-2).
 *
 * Un archivo por caso, con un nombre que Mileo decide: el nombre que traía del
 * escáner se guarda como dato, nunca como ruta. Así ningún nombre raro llega al
 * sistema de archivos.
 *
 * Las subidas grandes se escriben por partes sobre el mismo archivo. Si se cae
 * la señal, lo ya recibido se queda en disco y la siguiente parte continúa
 * donde iba: nunca se reinicia (§6.6).
 */

/** Escaneos y diseños: lo que Mileo recibe, venga de la marca que venga (O-2). */
export const EXTENSIONES_DE_ESCANEO = [
  "stl",
  "ply",
  "obj",
  "dcm",
  "dicom",
  "zip",
] as const;

/** Fotos: las del color del paciente y las del control de calidad (O-6). */
export const EXTENSIONES_DE_FOTO = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
] as const;

export const EXTENSIONES_ACEPTADAS = [
  ...EXTENSIONES_DE_ESCANEO,
  ...EXTENSIONES_DE_FOTO,
] as const;

/** Los tipos de archivo que son una foto y no una malla. */
const TIPOS_DE_FOTO = [
  "FOTO_COLOR",
  "FOTO_CALIDAD_AJUSTE",
  "FOTO_CALIDAD_COLOR",
];

export const TIPOS_MIME_ACEPTADOS = [
  "model/stl",
  "application/sla",
  "application/vnd.ms-pki.stl",
  "model/obj",
  "application/octet-stream",
  "application/dicom",
  "application/zip",
  "application/x-zip-compressed",
];

/** 2 GB por archivo: un DICOM completo cabe de sobra. */
export const BYTES_MAXIMOS_POR_ARCHIVO = 2 * 1024 * 1024 * 1024;

export function carpetaBase() {
  return path.resolve(
    process.cwd(),
    process.env.MILEO_ALMACEN_ARCHIVOS ?? "./almacen/archivos",
  );
}

export function extensionDe(nombre: string) {
  const partes = nombre.toLowerCase().split(".");
  return partes.length > 1 ? partes[partes.length - 1] : "";
}

/**
 * Que la extensión corresponda a lo que se está subiendo: una foto donde va un
 * escaneo no sirve, y un STL donde va la foto del color, tampoco.
 */
export function extensionAceptada(nombre: string, tipo?: string) {
  const extension = extensionDe(nombre);
  const permitidas: readonly string[] =
    tipo && TIPOS_DE_FOTO.includes(tipo)
      ? EXTENSIONES_DE_FOTO
      : EXTENSIONES_DE_ESCANEO;
  return permitidas.includes(extension);
}

/** Lo que se le dice a la persona si escogió el archivo equivocado. */
export function extensionesQueEsperaba(tipo?: string) {
  const permitidas: readonly string[] =
    tipo && TIPOS_DE_FOTO.includes(tipo)
      ? EXTENSIONES_DE_FOTO
      : EXTENSIONES_DE_ESCANEO;
  return permitidas.join(", ").toUpperCase();
}

/** Ruta relativa que se guarda en la base. Nunca depende del nombre original. */
export function rutaRelativaDe(
  casoId: string,
  archivoId: string,
  extension: string,
) {
  return `${casoId}/${archivoId}.${extension}`;
}

export function rutaAbsolutaDe(rutaRelativa: string) {
  const completa = path.resolve(carpetaBase(), rutaRelativa);
  // Cinturón contra rutas que se salgan del almacén.
  if (!completa.startsWith(carpetaBase())) {
    throw new Error("Ruta de archivo fuera del almacén.");
  }
  return completa;
}

export async function prepararCarpeta(rutaRelativa: string) {
  const completa = rutaAbsolutaDe(rutaRelativa);
  await fsp.mkdir(path.dirname(completa), { recursive: true });
  return completa;
}

/** Cuántos bytes hay realmente en disco. La base puede haberse quedado atrás. */
export async function bytesEnDisco(rutaRelativa: string) {
  try {
    const { size } = await fsp.stat(rutaAbsolutaDe(rutaRelativa));
    return size;
  } catch {
    return 0;
  }
}

/**
 * Agrega una parte al final del archivo.
 * `desde` tiene que coincidir con lo que ya hay en disco; si no, se devuelve
 * null y quien sube vuelve a preguntar por dónde iba.
 */
export async function agregarParte(
  rutaRelativa: string,
  desde: number,
  parte: Buffer,
): Promise<number | null> {
  const completa = await prepararCarpeta(rutaRelativa);
  const yaHay = await bytesEnDisco(rutaRelativa);

  if (desde !== yaHay) return null;

  await fsp.appendFile(completa, parte);
  return yaHay + parte.byteLength;
}

export async function huellaDe(rutaRelativa: string) {
  const completa = rutaAbsolutaDe(rutaRelativa);
  const hash = crypto.createHash("sha256");
  await new Promise<void>((listo, falla) => {
    const flujo = fs.createReadStream(completa);
    flujo.on("data", (trozo) => hash.update(trozo));
    flujo.on("end", () => listo());
    flujo.on("error", falla);
  });
  return hash.digest("hex");
}

export async function borrarArchivo(rutaRelativa: string) {
  try {
    await fsp.unlink(rutaAbsolutaDe(rutaRelativa));
  } catch {
    // Si ya no estaba, el resultado es el que queríamos.
  }
}
