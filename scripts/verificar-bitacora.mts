/**
 * Comprueba que la bitacora siga siendo inmutable e integra (SKILL.md O-0).
 *
 *   npm run verificar:bitacora
 *
 * Hace tres cosas:
 *   1. Recorre la cadena de hash completa y reporta cualquier eslabon roto.
 *   2. Intenta un UPDATE y un DELETE con el rol de la aplicacion. Los dos
 *      tienen que fallar; si alguno pasa, la bitacora no es inmutable.
 *   3. Resume cuantos eventos hay por caso.
 */
import { Client } from "pg";
import { cargarAmbiente } from "./ambiente.mjs";

const ambiente = cargarAmbiente();
const urlApp = process.env.DATABASE_URL!;

const cliente = new Client({ connectionString: urlApp });
await cliente.connect();

let fallas = 0;

try {
  // --- 1. Cadena de hash ----------------------------------------------------
  const rotos = (await cliente.query("SELECT * FROM mileo_bitacora_verificar()"))
    .rows;
  const total = Number(
    (await cliente.query('SELECT count(*)::int AS n FROM "EventoBitacora"'))
      .rows[0].n,
  );

  console.log(`Ambiente: ${ambiente}`);
  console.log(`Eventos en la bitacora: ${total}`);
  if (rotos.length === 0) {
    console.log("  cadena de hash: integra");
  } else {
    fallas++;
    console.error(`  cadena de hash: ${rotos.length} eslabones rotos`);
    for (const roto of rotos) console.error(`    ${JSON.stringify(roto)}`);
  }

  // --- 2. Inmutabilidad -----------------------------------------------------
  const alguno = (
    await cliente.query('SELECT id FROM "EventoBitacora" ORDER BY secuencia LIMIT 1')
  ).rows[0];

  if (!alguno) {
    console.log("  no hay eventos que probar todavia");
  } else {
    for (const [nombre, sql] of [
      ["UPDATE", `UPDATE "EventoBitacora" SET resumen = 'alterado' WHERE id = $1`],
      ["DELETE", `DELETE FROM "EventoBitacora" WHERE id = $1`],
      ["TRUNCATE", `TRUNCATE "EventoBitacora"`],
    ] as const) {
      try {
        await cliente.query("BEGIN");
        await cliente.query(sql, sql.includes("$1") ? [alguno.id] : undefined);
        await cliente.query("ROLLBACK");
        fallas++;
        console.error(`  ${nombre}: PASO. La bitacora NO es inmutable.`);
      } catch (error) {
        await cliente.query("ROLLBACK");
        const mensaje = error instanceof Error ? error.message : String(error);
        console.log(`  ${nombre}: rechazado (${mensaje.split("\n")[0]})`);
      }
    }
  }

  // --- 3. Resumen por caso --------------------------------------------------
  const porCaso = (
    await cliente.query(
      `SELECT c.folio, count(e.id)::int AS eventos
         FROM "Caso" c
         LEFT JOIN "EventoBitacora" e ON e."casoId" = c.id
        GROUP BY c.folio
        ORDER BY c.folio`,
    )
  ).rows;

  if (porCaso.length) {
    console.log("\nEventos por caso:");
    for (const renglon of porCaso) {
      console.log(`  ${renglon.folio}: ${renglon.eventos}`);
    }
  }
} finally {
  await cliente.end();
}

if (fallas > 0) {
  console.error("\nLa verificacion FALLO.");
  process.exit(1);
}
console.log("\nBitacora verificada.");
