/**
 * Respaldo diario de Mileo (SKILL.md O-0).
 *
 * Guarda en una sola carpeta con fecha:
 *   datos/<Tabla>.ndjson   un renglon por registro
 *   archivos/              copia de los archivos de paciente
 *   manifiesto.json        inventario con sha256 de todo, para poder comprobar
 *                          despues que la restauracion quedo completa
 *
 *   npm run respaldo
 *   MILEO_AMBIENTE=produccion npm run respaldo
 *
 * El volcado es logico y va por el mismo controlador de Postgres que usa la
 * aplicacion: no depende de que pg_dump este instalado, asi que se comporta
 * igual en Docker, en el Postgres embebido de desarrollo y en uno administrado.
 * El esquema no se guarda aqui porque se reconstruye con `prisma migrate
 * deploy`, que es la unica fuente de verdad del esquema.
 *
 * Para la corrida diaria automatica, ver README.
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { Client } from "pg";
import { cargarAmbiente } from "./ambiente.mjs";
import { TABLAS } from "./tablas.mjs";
import { usarTextoCrudo } from "./pg-texto.mjs";

usarTextoCrudo();
const ambiente = cargarAmbiente();

const urlBd = process.env.MILEO_BD_URL_ADMIN ?? process.env.DATABASE_URL!;
const carpetaArchivos = path.resolve(
  process.cwd(),
  process.env.MILEO_ALMACEN_ARCHIVOS ?? "./almacen/archivos",
);
const carpetaRespaldos = path.resolve(
  process.cwd(),
  process.env.MILEO_CARPETA_RESPALDOS ?? "./respaldos",
);

const marca = new Date()
  .toISOString()
  .replaceAll("-", "")
  .replaceAll(":", "")
  .slice(0, 15)
  .replace("T", "-");
const destino = path.join(carpetaRespaldos, `${ambiente}-${marca}`);
const carpetaDatos = path.join(destino, "datos");
const copiaArchivos = path.join(destino, "archivos");

await fsp.mkdir(carpetaDatos, { recursive: true });
await fsp.mkdir(copiaArchivos, { recursive: true });

function sha256(contenido: Buffer | string) {
  return crypto.createHash("sha256").update(contenido).digest("hex");
}

// --- 1. Datos ---------------------------------------------------------------
const cliente = new Client({ connectionString: urlBd });
await cliente.connect();

const tablas: { tabla: string; registros: number; sha256: string }[] = [];
let totalRegistros = 0;

try {
  // Una sola foto consistente de toda la base.
  await cliente.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");

  for (const tabla of TABLAS) {
    const { rows } = await cliente.query(`SELECT * FROM "${tabla}"`);
    const contenido = rows.map((r) => JSON.stringify(r)).join("\n");
    const archivo = path.join(carpetaDatos, `${tabla}.ndjson`);
    await fsp.writeFile(archivo, contenido ? `${contenido}\n` : "", "utf8");
    tablas.push({
      tabla,
      registros: rows.length,
      sha256: sha256(contenido ? `${contenido}\n` : ""),
    });
    totalRegistros += rows.length;
  }

  await cliente.query("COMMIT");
} finally {
  await cliente.end();
}

// --- 2. Archivos de paciente ------------------------------------------------
if (fs.existsSync(carpetaArchivos)) {
  await fsp.cp(carpetaArchivos, copiaArchivos, { recursive: true });
}

// --- 3. Manifiesto verificable ---------------------------------------------
type Entrada = { ruta: string; bytes: number; sha256: string };

async function inventariar(raiz: string, actual = raiz): Promise<Entrada[]> {
  if (!fs.existsSync(actual)) return [];
  const entradas: Entrada[] = [];
  for (const hijo of await fsp.readdir(actual, { withFileTypes: true })) {
    const completa = path.join(actual, hijo.name);
    if (hijo.isDirectory()) {
      entradas.push(...(await inventariar(raiz, completa)));
    } else {
      const contenido = await fsp.readFile(completa);
      entradas.push({
        ruta: path.relative(raiz, completa).replaceAll("\\", "/"),
        bytes: contenido.byteLength,
        sha256: sha256(contenido),
      });
    }
  }
  return entradas;
}

const archivos = await inventariar(copiaArchivos);

await fsp.writeFile(
  path.join(destino, "manifiesto.json"),
  `${JSON.stringify(
    { ambiente, creadoEn: new Date().toISOString(), tablas, archivos },
    null,
    2,
  )}\n`,
  "utf8",
);

const bytesArchivos = archivos.reduce((suma, a) => suma + a.bytes, 0);
console.log(
  `Respaldo de ${ambiente} listo en ${destino}\n` +
    `  registros : ${totalRegistros} en ${tablas.length} tablas\n` +
    `  archivos  : ${archivos.length} (${(bytesArchivos / 1024).toFixed(1)} KB)`,
);
