/**
 * Prueba del criterio de aceptación de O-3:
 *
 *   "Al exceder el tiempo estándar de una etapa, el caso se marca en riesgo y
 *    sale el aviso sin intervención humana."
 *
 * Y del recordatorio de O-4: a las 24 y a las 48 horas, y si no hay respuesta,
 * el caso se marca en riesgo y la fecha se recorre con aviso.
 *
 *   npm run prueba:avisos
 *
 * Qué comprueba:
 *   1. Un caso lleva 50 horas esperando aprobación. Nadie hace nada.
 *   2. El vigilante lo marca en riesgo y encola el aviso, con fecha concreta.
 *   3. Encola los recordatorios de 24 y de 48 horas.
 *   4. Correrlo otra vez no manda nada repetido: máximo un aviso por etapa.
 *   5. Los avisos se entregan y quedan marcados.
 *   6. Ningún mensaje usa las palabras prohibidas de SKILL.md §8.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Client } from "pg";
import { cargarAmbiente } from "../scripts/ambiente.mjs";

cargarAmbiente();

const problemas: string[] = [];

function comprobar(condicion: boolean, queDeberia: string) {
  console.log(`   ${condicion ? "ok  " : "MAL "} ${queDeberia}`);
  if (!condicion) problemas.push(queDeberia);
}

function correr(guion: string, extra: Record<string, string> = {}) {
  return execFileSync("npx", ["tsx", guion], {
    encoding: "utf8",
    env: { ...process.env, ...extra },
    shell: process.platform === "win32",
  });
}

/** Palabras que no deben aparecer nunca frente al doctor (SKILL.md §8). */
const PROHIBIDAS = [
  "orden",
  "pedido",
  "estatus",
  "status",
  "cola",
  "rechaz",
  "remake",
  " eta ",
  "cuota",
  "upload",
  "preview",
  "pronto",
  "a la brevedad",
];

const bd = new Client({ connectionString: process.env.MILEO_BD_URL_ADMIN });
await bd.connect();

try {
  console.log("\n1. Preparando un caso que lleva 50 horas esperando aprobación");

  const doctor = (
    await bd.query('SELECT id, "clinicaId" FROM "Usuario" WHERE correo = $1', [
      "juan.valverde@prodental.mx",
    ])
  ).rows[0];
  const paciente = (
    await bd.query('SELECT id FROM "Paciente" WHERE "clinicaId" = $1 LIMIT 1', [
      doctor.clinicaId,
    ])
  ).rows[0];

  // Un solo caso para siempre, no uno por corrida.
  //
  // Antes el folio llevaba la hora, así que cada auditoría dejaba un caso más
  // esperando aprobación —y sin diseño, porque aquí se inserta la etapa a mano
  // en vez de pasar por el laboratorio—. A las treinta corridas el doctor abría
  // su inicio y encontraba treinta casos de prueba. Y no se pueden borrar: la
  // bitácora es inmutable y no deja quitar un caso que ya tiene eventos, que es
  // justo la garantía funcionando.
  //
  // Reusarlo también hace la prueba más honesta: comprueba que el vigilante
  // vuelve a marcar en riesgo un caso que ya pasó por esto.
  const folio = "C-RIESGO";
  const existente = (
    await bd.query('SELECT id FROM "Caso" WHERE folio = $1', [folio])
  ).rows[0];
  const casoId = existente?.id ?? crypto.randomUUID();

  if (existente) {
    await bd.query(
      `UPDATE "Caso"
          SET etapa = 'ESPERANDO_APROBACION',
              "esBorrador" = false,
              "enRiesgo" = false,
              "motivoRiesgo" = NULL,
              "doctorId" = $2,
              "clinicaId" = $3,
              "pacienteId" = $4,
              "aceptadoEn" = (now() AT TIME ZONE 'UTC') - interval '4 days',
              "fechaEntregaComprometida" =
                (now() AT TIME ZONE 'UTC') + interval '2 days',
              "actualizadoEn" = now() AT TIME ZONE 'UTC'
        WHERE id = $1`,
      [casoId, doctor.id, doctor.clinicaId, paciente.id],
    );
  } else {
    await bd.query(
      `INSERT INTO "Caso" (id, folio, "clinicaId", "doctorId", "creadoPorId",
                           "pacienteId", indicacion, etapa, "esBorrador",
                           "aceptadoEn", "fechaEntregaComprometida",
                           "creadoEn", "actualizadoEn")
       VALUES ($1, $2, $3, $4, $4, $5, 'CORONA_Y_PUENTE',
               'ESPERANDO_APROBACION', false,
               (now() AT TIME ZONE 'UTC') - interval '4 days',
               (now() AT TIME ZONE 'UTC') + interval '2 days',
               (now() AT TIME ZONE 'UTC') - interval '4 days',
               now() AT TIME ZONE 'UTC')`,
      [casoId, folio, doctor.clinicaId, doctor.id, paciente.id],
    );
  }

  // El evento que marca cuándo entró a la etapa: hace 50 horas.
  await bd.query(
    `INSERT INTO "EventoBitacora"
       (id, cadena, "casoId", "usuarioId", tipo, "etapaNueva", resumen, "creadoEn")
     VALUES ($1, $2, $2, $3, 'ETAPA_CAMBIADA', 'ESPERANDO_APROBACION',
             'Prueba: el caso entró a esperar aprobación.',
             (now() AT TIME ZONE 'UTC') - interval '50 hours')`,
    [crypto.randomUUID(), casoId, doctor.id],
  );

  console.log(`   Caso ${folio}`);

  // --- 2 y 3. El vigilante, sin que nadie se lo pida ----------------------
  console.log("\n2. Corriendo el vigilante");
  const salida = correr("scripts/vigilar-riesgos.mts");
  console.log(
    salida
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => `      ${l}`)
      .join("\n"),
  );

  const caso = (
    await bd.query(
      'SELECT "enRiesgo", "motivoRiesgo" FROM "Caso" WHERE id = $1',
      [casoId],
    )
  ).rows[0];

  comprobar(caso.enRiesgo === true, "el caso quedó marcado en riesgo solo");
  comprobar(
    typeof caso.motivoRiesgo === "string" && caso.motivoRiesgo.length > 0,
    `el riesgo dice por qué: "${caso.motivoRiesgo}"`,
  );

  const avisos = (
    await bd.query(
      'SELECT tipo, canal, estado, cuerpo, clave FROM "Aviso" WHERE "casoId" = $1',
      [casoId],
    )
  ).rows;

  const tipos = new Set(avisos.map((a) => a.tipo));
  comprobar(
    tipos.has("RIESGO_DE_RETRASO") || tipos.has("FECHA_RECORRIDA"),
    "salió el aviso de riesgo sin intervención humana",
  );
  comprobar(
    tipos.has("RECORDATORIO_DE_APROBACION"),
    "salieron los recordatorios de aprobación",
  );

  const recordatorios = avisos.filter(
    (a) => a.tipo === "RECORDATORIO_DE_APROBACION" && a.canal === "CORREO",
  );
  comprobar(
    recordatorios.length === 2,
    `hay un recordatorio de 24 h y otro de 48 h (encontrados: ${recordatorios.length})`,
  );

  // --- 4. Idempotencia ---------------------------------------------------
  console.log("\n3. Corriendo el vigilante otra vez");
  correr("scripts/vigilar-riesgos.mts");
  correr("scripts/vigilar-riesgos.mts");

  const despues = Number(
    (
      await bd.query('SELECT count(*)::int n FROM "Aviso" WHERE "casoId" = $1', [
        casoId,
      ])
    ).rows[0].n,
  );
  comprobar(
    despues === avisos.length,
    `correrlo tres veces no repite avisos (${avisos.length} antes, ${despues} después)`,
  );

  // --- 5. Entrega ---------------------------------------------------------
  console.log("\n4. Entregando la cola");
  const registro = path.resolve(process.cwd(), "almacen/avisos.log");
  if (fs.existsSync(registro)) fs.rmSync(registro);

  const entrega = correr("scripts/enviar-avisos.mts", {
    MILEO_AVISOS_TRANSPORTE: "registro",
  });
  console.log(
    entrega
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => `      ${l}`)
      .join("\n"),
  );

  const pendientes = Number(
    (
      await bd.query(
        `SELECT count(*)::int n FROM "Aviso"
          WHERE "casoId" = $1 AND estado = 'PENDIENTE'`,
        [casoId],
      )
    ).rows[0].n,
  );
  comprobar(pendientes === 0, "no quedan avisos pendientes de este caso");
  comprobar(fs.existsSync(registro), "los avisos quedaron escritos");

  // --- 6. Vocabulario -----------------------------------------------------
  console.log("\n5. Revisando el vocabulario de los mensajes");
  const todos = (await bd.query('SELECT asunto, cuerpo FROM "Aviso"')).rows;

  const conProhibidas: string[] = [];
  for (const aviso of todos) {
    const texto = ` ${aviso.asunto} ${aviso.cuerpo} `.toLowerCase();
    for (const palabra of PROHIBIDAS) {
      if (texto.includes(palabra)) {
        conProhibidas.push(`"${palabra.trim()}" en: ${aviso.asunto}`);
      }
    }
  }
  comprobar(
    conProhibidas.length === 0,
    `ningún aviso usa palabras prohibidas de §8${conProhibidas.length ? `: ${conProhibidas.join("; ")}` : ""}`,
  );

  const conFecha = todos.filter((a) =>
    /\b\d{1,2}\s+(de\s+)?(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)/i.test(
      a.cuerpo,
    ),
  );
  comprobar(
    conFecha.length > 0,
    "los avisos dicen fecha concreta, no «pronto»",
  );

  // Limpieza de lo que creó la prueba. La bitácora no se toca: es inmutable.
  await bd.query('DELETE FROM "Aviso" WHERE "casoId" = $1', [casoId]);
} finally {
  await bd.end();
}

console.log("\n────────────────────────────────────────");
if (problemas.length > 0) {
  console.error(`LA PRUEBA FALLÓ (${problemas.length}):`);
  for (const problema of problemas) console.error(`  - ${problema}`);
  process.exit(1);
}
console.log("Riesgo, recordatorios y avisos: todo automático y sin repetir.");
