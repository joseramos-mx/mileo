/**
 * Postgres real para desarrollo, sin Docker.
 *
 * La ruta canonica de Mileo es `docker compose up` (ver docker-compose.yml).
 * En equipos sin Docker este script levanta el MISMO motor Postgres desde un
 * binario embebido, en el mismo puerto 5433 y con las mismas credenciales, de
 * modo que DATABASE_URL no cambia y las migraciones, los triggers y pg_dump se
 * comportan igual.
 *
 *   npm run bd:local     levanta y se queda corriendo
 *   Ctrl+C               apaga limpio
 */
import fs from "node:fs";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const CARPETA_DATOS = path.resolve(process.cwd(), "prisma/.postgres-local");
const PUERTO = 5433;
const USUARIO = "mileo";
const CONTRASENA = "mileo_dev";
const BASE = "mileo_dev";

async function main() {
  const yaInicializado = fs.existsSync(path.join(CARPETA_DATOS, "PG_VERSION"));

  const postgres = new EmbeddedPostgres({
    databaseDir: CARPETA_DATOS,
    user: USUARIO,
    password: CONTRASENA,
    port: PUERTO,
    persistent: true,
    onLog: () => {},
    onError: (mensaje) => process.stderr.write(String(mensaje)),
  });

  if (!yaInicializado) {
    console.log("Inicializando Postgres local en prisma/.postgres-local ...");
    await postgres.initialise();
  }

  await postgres.start();
  console.log(`Postgres escuchando en localhost:${PUERTO}`);

  try {
    await postgres.createDatabase(BASE);
    console.log(`Base "${BASE}" creada.`);
  } catch {
    console.log(`Base "${BASE}" ya existia.`);
  }

  console.log(
    `\nDATABASE_URL="postgresql://${USUARIO}:${CONTRASENA}@localhost:${PUERTO}/${BASE}?schema=public"\n` +
      "Listo. Ctrl+C para apagar.",
  );

  const apagar = async () => {
    console.log("\nApagando Postgres ...");
    await postgres.stop();
    process.exit(0);
  };
  process.on("SIGINT", apagar);
  process.on("SIGTERM", apagar);

  // Mantener vivo el proceso.
  await new Promise(() => {});
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
