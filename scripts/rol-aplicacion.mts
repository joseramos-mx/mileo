/**
 * Asigna al rol "mileo_app" la contrasena de este ambiente y le permite entrar.
 *
 * Se corre una vez por ambiente, despues de las migraciones, con el rol dueno:
 *   npm run bd:rol-aplicacion
 *
 * La contrasena sale de MILEO_BD_CONTRASENA_APP y nunca se guarda en una
 * migracion versionada.
 */
import { Client } from "pg";
import { cargarAmbiente } from "./ambiente.mjs";

const ambiente = cargarAmbiente();

const urlAdmin = process.env.MILEO_BD_URL_ADMIN;
const contrasena = process.env.MILEO_BD_CONTRASENA_APP;

if (!urlAdmin) {
  throw new Error(
    "Falta MILEO_BD_URL_ADMIN: la conexion con el rol dueno de la base.",
  );
}
if (!contrasena) {
  throw new Error("Falta MILEO_BD_CONTRASENA_APP.");
}

const cliente = new Client({ connectionString: urlAdmin });
await cliente.connect();
try {
  // La contrasena va como literal escapado por el propio Postgres.
  await cliente.query(
    `ALTER ROLE mileo_app LOGIN PASSWORD ${literal(contrasena)}`,
  );
  console.log(`Rol mileo_app listo en el ambiente de ${ambiente}.`);
} finally {
  await cliente.end();
}

function literal(valor: string) {
  return `'${valor.replaceAll("'", "''")}'`;
}
