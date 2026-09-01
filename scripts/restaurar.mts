/**
 * Restauracion de un respaldo de Mileo (SKILL.md O-0).
 *
 *   npm run restaurar -- respaldos/desarrollo-20260831-2230
 *
 * Vacia la base, vuelve a cargar los datos, repone los archivos de paciente y
 * despues comprueba tres cosas:
 *   1. que cada tabla haya quedado con el numero de registros del manifiesto,
 *   2. que cada archivo tenga el mismo sha256 que tenia,
 *   3. que la cadena de hash de la bitacora siga integra.
 *
 * Un respaldo que nunca se restauro no es un respaldo. Este guion es el que
 * cierra el criterio de aceptacion de O-0.
 *
 * Corre con el rol dueno de la base (MILEO_BD_URL_ADMIN). El esquema debe estar
 * al dia antes: `npm run bd:desplegar`.
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { Client } from "pg";
import { cargarAmbiente } from "./ambiente.mjs";
import { TABLAS, LLAVES_A_SI_MISMA, COLUMNAS_JSON } from "./tablas.mjs";
import { usarTextoCrudo } from "./pg-texto.mjs";

usarTextoCrudo();
const ambiente = cargarAmbiente();

const carpeta = process.argv[2];
if (!carpeta) {
  console.error(
    "Indique la carpeta del respaldo.\n" +
      "  npm run restaurar -- respaldos/desarrollo-20260831-2230",
  );
  process.exit(1);
}

const origen = path.resolve(process.cwd(), carpeta);
const manifiesto = JSON.parse(
  await fsp.readFile(path.join(origen, "manifiesto.json"), "utf8"),
) as {
  ambiente: string;
  tablas: { tabla: string; registros: number }[];
  archivos: { ruta: string; sha256: string }[];
};

if (manifiesto.ambiente !== ambiente) {
  console.error(
    `El respaldo es del ambiente "${manifiesto.ambiente}" y usted esta en ` +
      `"${ambiente}". Restaurar de un ambiente a otro se hace a proposito: ` +
      "vuelva a correr con MILEO_AMBIENTE correcto.",
  );
  process.exit(1);
}

const urlBd = process.env.MILEO_BD_URL_ADMIN;
if (!urlBd) {
  console.error("Falta MILEO_BD_URL_ADMIN: restaurar requiere el rol dueno.");
  process.exit(1);
}

const carpetaArchivos = path.resolve(
  process.cwd(),
  process.env.MILEO_ALMACEN_ARCHIVOS ?? "./almacen/archivos",
);

const cliente = new Client({ connectionString: urlBd });
await cliente.connect();

const problemas: string[] = [];

try {
  // Restaurar es una operacion del dueno de la base, no de la aplicacion: hay
  // que apagar el candado de la bitacora para poder vaciarla y volver a
  // llenarla con sus hashes originales.
  await cliente.query(
    'ALTER TABLE "EventoBitacora" DISABLE TRIGGER bitacora_sin_cambios',
  );
  await cliente.query(
    'ALTER TABLE "EventoBitacora" DISABLE TRIGGER bitacora_sin_truncate',
  );

  try {
    await cliente.query("BEGIN");

    // --- 1. Vaciar, de hijos a padres -------------------------------------
    for (const tabla of [...TABLAS].reverse()) {
      await cliente.query(`DELETE FROM "${tabla}"`);
    }

    // --- 2. Cargar, de padres a hijos -------------------------------------
    const pendientesDeEnlazar: {
      tabla: string;
      id: string;
      valores: Record<string, unknown>;
    }[] = [];

    for (const tabla of TABLAS) {
      const archivo = path.join(origen, "datos", `${tabla}.ndjson`);
      if (!fs.existsSync(archivo)) continue;

      const lineas = (await fsp.readFile(archivo, "utf8"))
        .split("\n")
        .filter((l) => l.trim().length > 0);

      const aSiMisma =
        LLAVES_A_SI_MISMA[tabla as keyof typeof LLAVES_A_SI_MISMA] ?? [];
      const columnasJson =
        COLUMNAS_JSON[tabla as keyof typeof COLUMNAS_JSON] ?? [];

      for (const linea of lineas) {
        const registro = JSON.parse(linea) as Record<string, unknown>;

        // Las referencias a la misma tabla se rellenan en una segunda pasada.
        const enlaces: Record<string, unknown> = {};
        for (const columna of aSiMisma) {
          if (registro[columna] != null) {
            enlaces[columna] = registro[columna];
            registro[columna] = null;
          }
        }
        if (Object.keys(enlaces).length > 0) {
          pendientesDeEnlazar.push({
            tabla,
            id: String(registro.id),
            valores: enlaces,
          });
        }

        // El volcado guarda jsonb como texto crudo; si viniera como objeto
        // (respaldo hecho con una version anterior) se serializa aqui.
        for (const columna of columnasJson) {
          const valor = registro[columna];
          if (valor != null && typeof valor !== "string") {
            registro[columna] = JSON.stringify(valor);
          }
        }

        const columnas = Object.keys(registro);
        const marcadores = columnas.map((_, i) => `$${i + 1}`);
        await cliente.query(
          `INSERT INTO "${tabla}" (${columnas.map((c) => `"${c}"`).join(", ")})
           VALUES (${marcadores.join(", ")})`,
          columnas.map((c) => registro[c]),
        );
      }
    }

    // --- 3. Segunda pasada: referencias a la misma tabla -------------------
    for (const pendiente of pendientesDeEnlazar) {
      const columnas = Object.keys(pendiente.valores);
      await cliente.query(
        `UPDATE "${pendiente.tabla}"
            SET ${columnas.map((c, i) => `"${c}" = $${i + 1}`).join(", ")}
          WHERE id = $${columnas.length + 1}`,
        [...columnas.map((c) => pendiente.valores[c]), pendiente.id],
      );
    }

    // --- 4. Reponer las secuencias ----------------------------------------
    await cliente.query(`
      SELECT setval(
        pg_get_serial_sequence('"EventoBitacora"', 'secuencia'),
        COALESCE((SELECT max(secuencia) FROM "EventoBitacora"), 1)
      )
    `);

    await cliente.query("COMMIT");
  } catch (error) {
    await cliente.query("ROLLBACK");
    throw error;
  } finally {
    await cliente.query(
      'ALTER TABLE "EventoBitacora" ENABLE TRIGGER bitacora_sin_cambios',
    );
    await cliente.query(
      'ALTER TABLE "EventoBitacora" ENABLE TRIGGER bitacora_sin_truncate',
    );
  }

  // --- 5. Archivos de paciente ---------------------------------------------
  const copiaArchivos = path.join(origen, "archivos");
  await fsp.mkdir(carpetaArchivos, { recursive: true });
  if (fs.existsSync(copiaArchivos)) {
    await fsp.cp(copiaArchivos, carpetaArchivos, { recursive: true });
  }

  // --- 6. Comprobaciones ----------------------------------------------------
  console.log(`Restauracion del respaldo ${path.basename(origen)}\n`);
  console.log("Tablas:");
  for (const esperada of manifiesto.tablas) {
    const { rows } = await cliente.query(
      `SELECT count(*)::int AS n FROM "${esperada.tabla}"`,
    );
    const encontrados = Number(rows[0].n);
    const bien = encontrados === esperada.registros;
    if (!bien) {
      problemas.push(
        `${esperada.tabla}: se esperaban ${esperada.registros} registros y hay ${encontrados}`,
      );
    }
    console.log(
      `  ${bien ? "ok" : "MAL"}  ${esperada.tabla.padEnd(16)} ${encontrados}/${esperada.registros}`,
    );
  }

  console.log("\nArchivos de paciente:");
  let archivosBien = 0;
  for (const esperado of manifiesto.archivos) {
    const completa = path.join(carpetaArchivos, esperado.ruta);
    if (!fs.existsSync(completa)) {
      problemas.push(`falta el archivo ${esperado.ruta}`);
      continue;
    }
    const sha = crypto
      .createHash("sha256")
      .update(await fsp.readFile(completa))
      .digest("hex");
    if (sha !== esperado.sha256) {
      problemas.push(`el archivo ${esperado.ruta} regreso alterado`);
      continue;
    }
    archivosBien++;
  }
  console.log(
    `  ${archivosBien}/${manifiesto.archivos.length} con el mismo contenido`,
  );

  const rotos = (await cliente.query("SELECT * FROM mileo_bitacora_verificar()"))
    .rows;
  const totalEventos = Number(
    (await cliente.query('SELECT count(*)::int AS n FROM "EventoBitacora"'))
      .rows[0].n,
  );
  console.log(`\nBitacora: ${totalEventos} eventos`);
  if (rotos.length > 0) {
    for (const roto of rotos) problemas.push(`bitacora: ${JSON.stringify(roto)}`);
    console.log(`  ${rotos.length} eslabones rotos`);
  } else {
    console.log("  cadena de hash integra");
  }
} finally {
  await cliente.end();
}

if (problemas.length > 0) {
  console.error("\nRestauracion INCOMPLETA:");
  for (const problema of problemas) console.error(`  - ${problema}`);
  process.exit(1);
}

console.log("\nRestauracion completa y verificada.");
