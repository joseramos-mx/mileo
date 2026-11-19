/**
 * Borra todos los casos, pacientes, archivos (locales y en S3), pagos, avisos y
 * eventos de bitácora de la clínica de pruebas (`clinica-prodental` /
 * `juan.valverde@prodental.mx`), conservando intactas las cuentas de usuario,
 * la clínica, su escáner y cualquier otra clínica o usuario del sistema.
 *
 * Uso:
 *   npm run limpiar:pruebas
 *   npx tsx scripts/limpiar-pruebas-clinica.mts
 *   npx tsx scripts/limpiar-pruebas-clinica.mts --clinica=clinica-prodental
 */
import crypto from "node:crypto";
import fsp from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import { cargarAmbiente } from "./ambiente.mjs";

cargarAmbiente();

const argClinica = process.argv
  .find((a) => a.startsWith("--clinica="))
  ?.split("=")[1]
  ?.trim();
const CLINICA_PRUEBAS_ID = argClinica || "clinica-prodental";
const CORREOS_PRUEBA = [
  "juan.valverde@prodental.mx",
  "recepcion@prodental.mx",
];

const urlAdmin = process.env.MILEO_BD_URL_ADMIN || process.env.DATABASE_URL;
if (!urlAdmin) {
  throw new Error(
    "Falta MILEO_BD_URL_ADMIN (o DATABASE_URL) en las variables de entorno.",
  );
}

function hmac(clave: Buffer | string, datos: string): Buffer {
  return crypto.createHmac("sha256", clave).update(datos, "utf8").digest();
}

async function borrarDeS3SiActivo(rutaRelativa: string): Promise<boolean> {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.AWS_S3_BUCKET?.trim();
  const region = process.env.AWS_REGION?.trim() || "us-east-2";

  if (!accessKeyId || !secretAccessKey || !bucket) return false;

  const rutaLimpia = rutaRelativa
    .replace(/^\/+/, "")
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
  const host = `${bucket}.s3.${region}.amazonaws.com`;
  const rutaCodificada = `/${rutaLimpia}`;
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
    "DELETE",
    rutaCodificada,
    "",
    cabecerasCanonicas,
    cabecerasFirmadas,
    payloadHash,
  ].join("\n");

  const alcance = `${dateStamp}/${region}/s3/aws4_request`;
  const cadenaAFirmar = [
    "AWS4-HMAC-SHA256",
    amzDate,
    alcance,
    crypto.createHash("sha256").update(peticionCanonica, "utf8").digest("hex"),
  ].join("\n");

  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const firma = crypto
    .createHmac("sha256", kSigning)
    .update(cadenaAFirmar, "utf8")
    .digest("hex");

  try {
    const resp = await fetch(`https://${host}${rutaCodificada}`, {
      method: "DELETE",
      headers: {
        Authorization:
          `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${alcance}, ` +
          `SignedHeaders=${cabecerasFirmadas}, Signature=${firma}`,
        "x-amz-date": amzDate,
        "x-amz-content-sha256": payloadHash,
      },
    });
    return resp.ok || resp.status === 204 || resp.status === 404;
  } catch {
    return false;
  }
}

const cliente = new Client({ connectionString: urlAdmin });
await cliente.connect();

try {
  const resClinica = await cliente.query<{ id: string; nombre: string }>(
    `SELECT id, nombre FROM "Clinica" WHERE id = $1`,
    [CLINICA_PRUEBAS_ID],
  );

  if (resClinica.rowCount === 0) {
    console.log(
      `No se encontró la clínica de pruebas "${CLINICA_PRUEBAS_ID}". Nada que borrar.`,
    );
    process.exit(0);
  }

  const clinica = resClinica.rows[0];

  const resUsuariosPrueba = await cliente.query<{ id: string; correo: string }>(
    `SELECT id, correo FROM "Usuario" WHERE "clinicaId" = $1 AND LOWER(correo) = ANY($2::text[])`,
    [clinica.id, CORREOS_PRUEBA],
  );
  const usuarioIdsPrueba = resUsuariosPrueba.rows.map((u) => u.id);

  if (usuarioIdsPrueba.length === 0) {
    console.log(
      `No se encontraron los usuarios de prueba (${CORREOS_PRUEBA.join(", ")}) en "${clinica.id}". Nada que borrar.`,
    );
    process.exit(0);
  }

  const resCasos = await cliente.query<{
    id: string;
    folio: string;
    pacienteId: string;
  }>(
    `SELECT id, folio, "pacienteId"
     FROM "Caso"
     WHERE "clinicaId" = $1
       AND ("doctorId" = ANY($2::text[]) OR "creadoPorId" = ANY($2::text[]))
     ORDER BY "creadoEn" ASC`,
    [clinica.id, usuarioIdsPrueba],
  );
  const casoIds = resCasos.rows.map((c) => c.id);
  const pacienteIdsDeCasos = Array.from(
    new Set(resCasos.rows.map((c) => c.pacienteId)),
  );

  const resArchivos =
    casoIds.length > 0
      ? await cliente.query<{
        id: string;
        casoId: string;
        rutaRelativa: string;
      }>(
        `SELECT id, "casoId", "rutaRelativa" FROM "Archivo" WHERE "casoId" = ANY($1::text[])`,
        [casoIds],
      )
      : { rows: [] };

  // 1. Limpiar archivos en S3 y en disco local
  const rutasS3 = new Set<string>();
  for (const a of resArchivos.rows) {
    rutasS3.add(a.rutaRelativa);
    rutasS3.add(`${a.casoId}/${a.id}.malla`);
    rutasS3.add(`${a.casoId}/${a.id}-grande.png`);
    rutasS3.add(`${a.casoId}/${a.id}-chico.png`);
  }

  let borradosS3 = 0;
  for (const ruta of rutasS3) {
    const ok = await borrarDeS3SiActivo(ruta);
    if (ok) borradosS3++;
  }

  const carpetaAlmacen = path.resolve(
    process.cwd(),
    process.env.MILEO_ALMACEN_ARCHIVOS ?? "./almacen/archivos",
  );
  let carpetasLocalesBorradas = 0;
  for (const casoId of casoIds) {
    const dirCaso = path.resolve(carpetaAlmacen, casoId);
    if (dirCaso.startsWith(carpetaAlmacen)) {
      await fsp.rm(dirCaso, { recursive: true, force: true }).catch(() => { });
      carpetasLocalesBorradas++;
    }
  }

  // 2. Limpiar registros en PostgreSQL dentro de una transacción
  await cliente.query("BEGIN");

  let eventosBorrados = 0;
  let pagosBorrados = 0;
  let avisosBorrados = 0;
  let casosBorrados = 0;
  let pacientesBorrados = 0;

  if (casoIds.length > 0) {
    await cliente.query(`ALTER TABLE "EventoBitacora" DISABLE TRIGGER USER`);
    const delEventos = await cliente.query(
      `DELETE FROM "EventoBitacora" WHERE "casoId" = ANY($1::text[]) OR cadena = ANY($1::text[])`,
      [casoIds],
    );
    eventosBorrados = delEventos.rowCount ?? 0;
    await cliente.query(`ALTER TABLE "EventoBitacora" ENABLE TRIGGER USER`);

    const delAvisos = await cliente.query(
      `DELETE FROM "Aviso" WHERE "casoId" = ANY($1::text[])`,
      [casoIds],
    );
    avisosBorrados = delAvisos.rowCount ?? 0;

    // Si la tabla Pago existe en la BD (rama de Stripe), borramos sus filas
    const existeTablaPago = await cliente.query<{ reg: string | null }>(
      `SELECT to_regclass('public."Pago"')::text AS reg`,
    );
    if (existeTablaPago.rows[0]?.reg) {
      const delPagos = await cliente.query(
        `DELETE FROM "Pago" WHERE "casoId" = ANY($1::text[])`,
        [casoIds],
      );
      pagosBorrados = delPagos.rowCount ?? 0;
    }

    await cliente.query(
      `UPDATE "Caso" SET "casoOrigenId" = NULL WHERE id = ANY($1::text[])`,
      [casoIds],
    );

    const delCasos = await cliente.query(
      `DELETE FROM "Caso" WHERE id = ANY($1::text[])`,
      [casoIds],
    );
    casosBorrados = delCasos.rowCount ?? 0;
  }

  if (pacienteIdsDeCasos.length > 0) {
    const delPacientes = await cliente.query(
      `DELETE FROM "Paciente" p
       WHERE p."clinicaId" = $1
         AND p.id = ANY($2::text[])
         AND NOT EXISTS (SELECT 1 FROM "Caso" c WHERE c."pacienteId" = p.id)`,
      [clinica.id, pacienteIdsDeCasos],
    );
    pacientesBorrados = delPacientes.rowCount ?? 0;
  }

  await cliente.query("COMMIT");

  console.log(
    `Limpieza completada para "${clinica.nombre}" (${clinica.id}):\n` +
    `  - Casos eliminados:     ${casosBorrados}\n` +
    `  - Pacientes eliminados: ${pacientesBorrados}\n` +
    `  - Archivos en BD:       ${resArchivos.rows.length}\n` +
    `  - Objetos S3 limpiados: ${borradosS3}\n` +
    `  - Carpetas locales:     ${carpetasLocalesBorradas}\n` +
    `  - Eventos de bitácora:  ${eventosBorrados}\n` +
    `  - Pagos eliminados:     ${pagosBorrados}\n` +
    `  - Avisos eliminados:    ${avisosBorrados}`,
  );
} catch (err) {
  await cliente.query("ROLLBACK").catch(() => { });
  throw err;
} finally {
  await cliente.end();
}
