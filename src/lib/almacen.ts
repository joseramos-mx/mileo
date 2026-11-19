import "server-only";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import {
  borrarObjetoS3,
  descargarObjetoS3,
  subirObjetoS3,
  tamanoObjetoS3,
  tieneS3,
} from "@/lib/s3";

export { enTamano } from "@/lib/formato";

/**
 * Dónde viven los archivos de paciente (SKILL.md O-2).
 *
 * Cuando AWS S3 está configurado (`AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`,
 * `AWS_SECRET_ACCESS_KEY`), todos los archivos completos, mallas 3D derivadas,
 * retratos e imágenes se guardan y leen desde el bucket privado de Amazon S3,
 * usando el disco local sólo como caché de trabajo temporal.
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

/** Los tipos de archivo que son exclusivamente una foto. */
const TIPOS_SOLO_FOTO = [
  "FOTO_COLOR",
  "FOTO_CALIDAD_AJUSTE",
  "FOTO_CALIDAD_COLOR",
];

/** Tipos donde se permiten tanto mallas/escaneos como imágenes (p. ej. capturas del diseño). */
const TIPOS_MIXTOS = ["DISENO", "OTRO"];

export function esExtensionDeFoto(extension: string) {
  return (EXTENSIONES_DE_FOTO as readonly string[]).includes(
    extension.toLowerCase(),
  );
}

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

const MIME_POR_EXTENSION: Record<string, string> = {
  malla: "application/octet-stream",
  stl: "model/stl",
  ply: "application/octet-stream",
  obj: "text/plain",
  dcm: "application/dicom",
  dicom: "application/dicom",
  zip: "application/zip",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
};

export function mimeDeRuta(rutaRelativa: string): string {
  const ext = extensionDe(rutaRelativa);
  return MIME_POR_EXTENSION[ext] ?? "application/octet-stream";
}

/** 2 GB por archivo: un DICOM completo cabe de sobra. */
export const BYTES_MAXIMOS_POR_ARCHIVO = 2 * 1024 * 1024 * 1024;

export function carpetaBase() {
  if (
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    (process.env.NODE_ENV === "production" && tieneS3())
  ) {
    return path.join(os.tmpdir(), "mileo-archivos");
  }
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
  if (tipo && TIPOS_MIXTOS.includes(tipo)) {
    return (EXTENSIONES_ACEPTADAS as readonly string[]).includes(extension);
  }
  const permitidas: readonly string[] =
    tipo && TIPOS_SOLO_FOTO.includes(tipo)
      ? EXTENSIONES_DE_FOTO
      : EXTENSIONES_DE_ESCANEO;
  return permitidas.includes(extension);
}

/** Lo que se le dice a la persona si escogió el archivo equivocado. */
export function extensionesQueEsperaba(tipo?: string) {
  if (tipo && TIPOS_MIXTOS.includes(tipo)) {
    return EXTENSIONES_ACEPTADAS.join(", ").toUpperCase();
  }
  const permitidas: readonly string[] =
    tipo && TIPOS_SOLO_FOTO.includes(tipo)
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

/** Guarda un archivo completo directamente en Amazon S3 (o en disco local si S3 no está configurado). */
export async function guardarArchivo(
  rutaRelativa: string,
  datos: Buffer,
  contentType?: string,
): Promise<void> {
  if (tieneS3()) {
    await subirObjetoS3(
      rutaRelativa,
      datos,
      contentType ?? mimeDeRuta(rutaRelativa),
    );
    return;
  }

  const completa = await prepararCarpeta(rutaRelativa);
  await fsp.writeFile(completa, datos);
}

/**
 * Lee un archivo completo directamente desde Amazon S3 (sin pasar por `/tmp`)
 * cuando S3 está configurado, o desde disco local si se corre sin S3.
 */
export async function leerArchivo(rutaRelativa: string): Promise<Buffer> {
  if (tieneS3()) {
    const desdeS3 = await descargarObjetoS3(rutaRelativa);
    if (!desdeS3) {
      throw new Error(`Archivo no encontrado en S3: ${rutaRelativa}`);
    }
    return desdeS3;
  }

  return fsp.readFile(rutaAbsolutaDe(rutaRelativa));
}

/** Verifica si el archivo existe en Amazon S3 (o en disco local si no hay S3). */
export async function existeArchivo(rutaRelativa: string): Promise<boolean> {
  if (tieneS3()) {
    const tamano = await tamanoObjetoS3(rutaRelativa);
    return tamano !== null && tamano > 0;
  }

  try {
    const { size } = await fsp.stat(rutaAbsolutaDe(rutaRelativa));
    return size > 0;
  } catch {
    return false;
  }
}

/** Cuántos bytes hay realmente guardados en Amazon S3 (o en disco local si no hay S3). */
export async function bytesEnDisco(rutaRelativa: string) {
  if (tieneS3()) {
    const enS3 = await tamanoObjetoS3(rutaRelativa);
    return enS3 ?? 0;
  }

  try {
    const { size } = await fsp.stat(rutaAbsolutaDe(rutaRelativa));
    return size > 0 ? size : 0;
  } catch {
    return 0;
  }
}

/**
 * Agrega una parte al final del archivo.
 * Cuando S3 está configurado, opera 100% en memoria contra S3 sin tocar `/tmp`.
 */
export async function agregarParte(
  rutaRelativa: string,
  desde: number,
  parte: Buffer,
): Promise<number | null> {
  if (tieneS3()) {
    if (desde === 0) {
      await subirObjetoS3(rutaRelativa, parte, mimeDeRuta(rutaRelativa));
      return parte.byteLength;
    }

    const previoS3 = await descargarObjetoS3(rutaRelativa);
    const yaHayS3 = previoS3 ? previoS3.byteLength : 0;
    if (desde !== yaHayS3 || !previoS3) {
      return null;
    }

    const combinado = Buffer.concat([previoS3, parte]);
    await subirObjetoS3(rutaRelativa, combinado, mimeDeRuta(rutaRelativa));
    return combinado.byteLength;
  }

  const completa = await prepararCarpeta(rutaRelativa);
  let yaHay = 0;
  try {
    yaHay = (await fsp.stat(completa)).size;
  } catch {
    yaHay = 0;
  }

  if (desde === 0 && yaHay > 0) {
    await fsp.writeFile(completa, Buffer.alloc(0));
    yaHay = 0;
  }

  if (desde !== yaHay) return null;

  await fsp.appendFile(completa, parte);
  return yaHay + parte.byteLength;
}

export async function huellaDe(rutaRelativa: string) {
  const datos = await leerArchivo(rutaRelativa);
  return crypto.createHash("sha256").update(datos).digest("hex");
}

export async function borrarArchivo(rutaRelativa: string) {
  if (tieneS3()) {
    await borrarObjetoS3(rutaRelativa);
  }

  try {
    await fsp.unlink(rutaAbsolutaDe(rutaRelativa));
  } catch {
    // Si no existía en disco local, continuamos.
  }
}
