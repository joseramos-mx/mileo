import "server-only";
import crypto from "node:crypto";

/**
 * Cliente ligero y seguro para Amazon S3 con firma criptográfica AWS Signature V4
 * usando únicamente módulos nativos de Node.js (`node:crypto` y `fetch`).
 */

type ConfiguracionS3 = {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
};

let regionDetectada: string | null = null;

export function configuracionS3(): ConfiguracionS3 | null {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.AWS_S3_BUCKET?.trim();
  const region =
    regionDetectada ?? process.env.AWS_REGION?.trim() ?? "us-east-2";

  if (!accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }

  return { accessKeyId, secretAccessKey, region, bucket };
}

export function tieneS3(): boolean {
  return configuracionS3() !== null;
}

function hmac(clave: Buffer | string, datos: string): Buffer {
  return crypto.createHmac("sha256", clave).update(datos, "utf8").digest();
}

function sha256Hex(datos: string): string {
  return crypto.createHash("sha256").update(datos, "utf8").digest("hex");
}

function codificarRutaS3(rutaRelativa: string): string {
  return rutaRelativa
    .replace(/^\/+/, "")
    .split("/")
    .map((segmento) => encodeURIComponent(segmento))
    .join("/");
}

async function peticionS3(
  metodo: "GET" | "PUT" | "HEAD" | "DELETE",
  rutaRelativa: string,
  cuerpo?: Buffer | Uint8Array,
  contentType?: string,
  regionForzada?: string,
): Promise<Response> {
  const cfg = configuracionS3();
  if (!cfg) {
    throw new Error(
      "Falta configurar AWS_S3_BUCKET, AWS_ACCESS_KEY_ID o AWS_SECRET_ACCESS_KEY.",
    );
  }

  const region = regionForzada ?? cfg.region;
  const host = `${cfg.bucket}.s3.${region}.amazonaws.com`;
  const rutaCodificada = `/${codificarRutaS3(rutaRelativa)}`;
  const url = `https://${host}${rutaCodificada}`;

  const ahora = new Date();
  const amzDate = ahora.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = "UNSIGNED-PAYLOAD";

  const cabecerasCanonicas =
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const cabecerasFirmadas = "host;x-amz-content-sha256;x-amz-date";

  const peticionCanonica = [
    metodo,
    rutaCodificada,
    "",
    cabecerasCanonicas,
    cabecerasFirmadas,
    payloadHash,
  ].join("\n");

  const alcanceCredencial = `${dateStamp}/${region}/s3/aws4_request`;
  const cadenaAFirmar = [
    "AWS4-HMAC-SHA256",
    amzDate,
    alcanceCredencial,
    sha256Hex(peticionCanonica),
  ].join("\n");

  const kDate = hmac(`AWS4${cfg.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const firma = crypto
    .createHmac("sha256", kSigning)
    .update(cadenaAFirmar, "utf8")
    .digest("hex");

  const autorizacion =
    `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${alcanceCredencial}, ` +
    `SignedHeaders=${cabecerasFirmadas}, Signature=${firma}`;

  const headers: Record<string, string> = {
    Authorization: autorizacion,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
  };

  if (contentType) {
    headers["Content-Type"] = contentType;
  }
  if (cuerpo) {
    headers["Content-Length"] = String(cuerpo.byteLength);
  }

  const respuesta = await fetch(url, {
    method: metodo,
    headers,
    body: cuerpo ? new Uint8Array(cuerpo) : undefined,
    cache: "no-store",
  });

  // Si el bucket está en otra región de AWS, S3 devuelve la región exacta en
  // la cabecera `x-amz-bucket-region`; reintentamos automáticamente con ella.
  const regionReal = respuesta.headers.get("x-amz-bucket-region");
  if (
    (respuesta.status === 301 || respuesta.status === 400) &&
    regionReal &&
    regionReal !== region &&
    !regionForzada
  ) {
    regionDetectada = regionReal;
    return peticionS3(metodo, rutaRelativa, cuerpo, contentType, regionReal);
  }

  return respuesta;
}

export async function subirObjetoS3(
  rutaRelativa: string,
  datos: Buffer | Uint8Array,
  contentType = "application/octet-stream",
): Promise<void> {
  const resp = await peticionS3("PUT", rutaRelativa, datos, contentType);
  if (!resp.ok) {
    const detalle = await resp.text().catch(() => "");
    throw new Error(
      `No se pudo guardar el archivo en Amazon S3 (${resp.status}): ${detalle.slice(0, 180)}`,
    );
  }
}

export async function descargarObjetoS3(
  rutaRelativa: string,
): Promise<Buffer | null> {
  const resp = await peticionS3("GET", rutaRelativa);
  if (resp.status === 404) return null;
  if (!resp.ok) {
    throw new Error(`Error al leer archivo de S3 (${resp.status}).`);
  }
  const arreglo = await resp.arrayBuffer();
  return Buffer.from(arreglo);
}

export async function tamanoObjetoS3(
  rutaRelativa: string,
): Promise<number | null> {
  const resp = await peticionS3("HEAD", rutaRelativa);
  if (resp.status === 404) return null;
  if (!resp.ok) return null;
  const longitud = Number(resp.headers.get("content-length") ?? "0");
  return Number.isFinite(longitud) ? longitud : 0;
}

export async function borrarObjetoS3(rutaRelativa: string): Promise<void> {
  try {
    const resp = await peticionS3("DELETE", rutaRelativa);
    if (!resp.ok && resp.status !== 404 && resp.status !== 204) {
      const detalle = await resp.text().catch(() => "");
      console.warn(
        `[S3] No se pudo borrar ${rutaRelativa} (${resp.status}): ${detalle.slice(0, 160)}`,
      );
    }
  } catch (err) {
    console.warn(`[S3] Error de red al borrar ${rutaRelativa}:`, err);
  }
}

