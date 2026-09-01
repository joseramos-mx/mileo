/**
 * Prueba del criterio de aceptación de O-2:
 *
 *   "Una asistente sube 400 MB de DICOM desde un celular, pierde señal a la
 *    mitad, y la subida se reanuda sin perder lo capturado."
 *
 *   npm run dev              (en otra terminal)
 *   npm run prueba:subida
 *
 * Sigue el mismo camino que el cliente real (src/lib/subida.ts): manda las
 * partes por posición en bytes, no por número de parte. Eso importa, porque al
 * cortarse la señal a media parte el servidor se queda en un byte que no cae en
 * el borde de ninguna, y reanudar desde ahí es justo lo difícil.
 *
 * Qué comprueba:
 *   1. Entra como la asistente de la clínica.
 *   2. Sube 400 MB.
 *   3. A la mitad se corta la conexión sin avisar.
 *   4. Pregunta por dónde iba y continúa desde ese byte exacto.
 *   5. El sha256 del archivo en el servidor tiene que ser idéntico al del
 *      original: ni un byte perdido, ni uno repetido.
 */
import crypto from "node:crypto";
import { Client } from "pg";
import { cargarAmbiente } from "../scripts/ambiente.mjs";

cargarAmbiente();

const BASE = process.env.MILEO_URL ?? "http://localhost:3000";
const MEGAS = Number(process.env.MILEO_PRUEBA_MEGAS ?? "400");
const BYTES_TOTALES = MEGAS * 1024 * 1024;
const BYTES_POR_PARTE = 4 * 1024 * 1024;

function paso(texto: string) {
  console.log(`\n${texto}`);
}

/**
 * El contenido del archivo depende de la posición absoluta de cada byte, no de
 * en qué parte cayó. Así se puede pedir cualquier tramo y compararlo.
 */
function tramo(desde: number, hasta: number) {
  const trozo = Buffer.alloc(hasta - desde);
  for (let i = 0; i < trozo.length; i++) {
    trozo[i] = (desde + i) % 251;
  }
  return trozo;
}

function huellaCompleta() {
  const hash = crypto.createHash("sha256");
  for (let desde = 0; desde < BYTES_TOTALES; desde += BYTES_POR_PARTE) {
    hash.update(tramo(desde, Math.min(desde + BYTES_POR_PARTE, BYTES_TOTALES)));
  }
  return hash.digest("hex");
}

async function main() {
  // ---------------------------------------------------------------- 1. entrar
  //
  // La sesión y el caso de prueba se crean directo en la base, con las mismas
  // reglas que usa la aplicación. Así la prueba no obliga a dejar ninguna
  // puerta trasera abierta en el código que se va a producción.
  paso("1. Entrando como la asistente de la clínica…");

  const bd = new Client({ connectionString: process.env.DATABASE_URL });
  await bd.connect();

  const asistente = (
    await bd.query('SELECT id, "clinicaId" FROM "Usuario" WHERE correo = $1', [
      "recepcion@prodental.mx",
    ])
  ).rows[0];

  if (!asistente) {
    throw new Error("Falta la semilla de desarrollo. Corra: npx prisma db seed");
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  // Prisma guarda las fechas sin zona horaria y las lee como UTC: hay que
  // insertarlas igual, o la sesión nace vencida.
  await bd.query(
    `INSERT INTO "Sesion" (id, "usuarioId", "tokenHash", "expiraEn", "creadoEn")
     VALUES ($1, $2, $3,
             (now() AT TIME ZONE 'UTC') + interval '1 hour',
             now() AT TIME ZONE 'UTC')`,
    [crypto.randomUUID(), asistente.id, tokenHash],
  );
  const conSesion = { cookie: `mileo_sesion=${token}` };

  // -------------------------------------------------------------- 2. el caso
  const doctor = (
    await bd.query(
      `SELECT id FROM "Usuario" WHERE "clinicaId" = $1 AND rol = 'DOCTOR' LIMIT 1`,
      [asistente.clinicaId],
    )
  ).rows[0];

  const paciente = (
    await bd.query('SELECT id FROM "Paciente" WHERE "clinicaId" = $1 LIMIT 1', [
      asistente.clinicaId,
    ])
  ).rows[0];

  const casoId = crypto.randomUUID();
  const folio = `C-PRUEBA-${Date.now()}`;
  await bd.query(
    `INSERT INTO "Caso" (id, folio, "clinicaId", "doctorId", "creadoPorId",
                         "pacienteId", indicacion, etapa, "esBorrador",
                         "actualizadoEn")
     VALUES ($1, $2, $3, $4, $5, $6, 'CORONA_Y_PUENTE', 'RECIBIDO', true,
             now() AT TIME ZONE 'UTC')`,
    [casoId, folio, asistente.clinicaId, doctor.id, asistente.id, paciente.id],
  );

  console.log(`   Caso de prueba: ${folio}`);

  // ------------------------------------------------------------- 3. la subida
  paso(`2. Empezando a subir ${MEGAS} MB de DICOM…`);

  const inicio = await fetch(`${BASE}/api/casos/${casoId}/archivos`, {
    method: "POST",
    headers: { ...conSesion, "content-type": "application/json" },
    body: JSON.stringify({
      nombre: `tomografia-${Date.now()}.dcm`,
      bytesTotales: BYTES_TOTALES,
      tipo: "OTRO",
    }),
  });

  if (!inicio.ok) throw new Error(await inicio.text());
  const { id: archivoId } = await inicio.json();

  const cortarEnByte = Math.floor(BYTES_TOTALES / 2);
  let desde = 0;
  let seCorto = false;
  let desdeDespuesDelCorte = -1;
  let avisos = 0;
  const arranque = Date.now();

  while (desde < BYTES_TOTALES) {
    const hasta = Math.min(desde + BYTES_POR_PARTE, BYTES_TOTALES);
    const parte = tramo(desde, hasta);

    // ------------------------------------------------------ se cae la señal
    if (!seCorto && desde >= cortarEnByte) {
      seCorto = true;
      paso(
        `3. Se cae la señal a la mitad (${(desde / 1024 / 1024).toFixed(0)} MB subidos)…`,
      );

      const abortador = new AbortController();
      const enElAire = fetch(`${BASE}/api/archivos/${archivoId}`, {
        method: "PATCH",
        headers: {
          ...conSesion,
          "content-type": "application/octet-stream",
          "x-mileo-desde": String(desde),
        },
        body: new Uint8Array(parte),
        signal: abortador.signal,
      }).catch(() => null);

      setTimeout(() => abortador.abort(), 15);
      await enElAire;

      paso("4. Vuelve la señal. Preguntando por dónde iba…");
      const estado = await (
        await fetch(`${BASE}/api/archivos/${archivoId}`, { headers: conSesion })
      ).json();

      desdeDespuesDelCorte = estado.bytesRecibidos;
      desde = estado.bytesRecibidos;

      const alineado = desde % BYTES_POR_PARTE === 0;
      console.log(
        `   El servidor dice: byte ${desde} ` +
          `(${(desde / 1024 / 1024).toFixed(2)} MB), ` +
          `${alineado ? "justo en el borde de una parte" : "a media parte"}.`,
      );

      if (desde === 0) {
        throw new Error("FALLA: se perdió todo lo subido al caerse la señal.");
      }
      continue;
    }

    const respuesta = await fetch(`${BASE}/api/archivos/${archivoId}`, {
      method: "PATCH",
      headers: {
        ...conSesion,
        "content-type": "application/octet-stream",
        "x-mileo-desde": String(desde),
      },
      body: new Uint8Array(parte),
    });

    if (respuesta.status === 409) {
      // El servidor iba en otro byte: se le hace caso y se sigue desde ahí.
      const cuerpo = await respuesta.json();
      desde = cuerpo.bytesRecibidos;
      continue;
    }

    if (!respuesta.ok) throw new Error(await respuesta.text());

    const cuerpo = await respuesta.json();
    desde = cuerpo.bytesRecibidos;

    const porcentaje = Math.floor((desde / BYTES_TOTALES) * 100);
    if (porcentaje >= avisos + 20) {
      avisos = porcentaje;
      console.log(`   ${porcentaje}% (${(desde / 1024 / 1024).toFixed(0)} MB)`);
    }
  }

  const segundos = ((Date.now() - arranque) / 1000).toFixed(1);

  // ------------------------------------------------------- 4. comprobaciones
  paso("5. Comprobando que no se perdió ni se repitió un byte…");

  const final = await (
    await fetch(`${BASE}/api/archivos/${archivoId}`, { headers: conSesion })
  ).json();

  const huellaLocal = huellaCompleta();
  const huellaDelServidor = (
    await bd.query('SELECT sha256 FROM "Archivo" WHERE id = $1', [archivoId])
  ).rows[0]?.sha256;

  const problemas: string[] = [];
  if (final.bytesRecibidos !== BYTES_TOTALES) {
    problemas.push(
      `el servidor tiene ${final.bytesRecibidos} bytes y esperaba ${BYTES_TOTALES}`,
    );
  }
  if (final.estado !== "COMPLETO") {
    problemas.push(`el archivo quedó en estado ${final.estado}`);
  }
  if (huellaDelServidor !== huellaLocal) {
    problemas.push(
      `la huella no coincide:\n      servidor ${huellaDelServidor}\n      esperada ${huellaLocal}`,
    );
  }
  if (!seCorto) problemas.push("nunca se simuló la caída de señal");

  console.log(`   Se reanudó desde  : byte ${desdeDespuesDelCorte}`);
  console.log(`   Bytes al terminar : ${final.bytesRecibidos}`);
  console.log(`   Estado            : ${final.estado}`);
  console.log(`   sha256 servidor   : ${huellaDelServidor}`);
  console.log(`   sha256 esperado   : ${huellaLocal}`);
  console.log(`   Tiempo            : ${segundos} s`);

  // Se limpia lo que creó la prueba, archivo incluido: 400 MB por corrida
  // llenan el disco en una tarde. Se borra por la API, que es la que sabe
  // quitarlo también del almacén. La bitácora no se toca: es inmutable.
  await fetch(`${BASE}/api/archivos/${archivoId}`, {
    method: "DELETE",
    headers: conSesion,
  });
  await bd.query('DELETE FROM "Archivo" WHERE "casoId" = $1', [casoId]);
  await bd.query('DELETE FROM "Sesion" WHERE "tokenHash" = $1', [tokenHash]);
  await bd.end();

  if (problemas.length > 0) {
    console.error("\nLA PRUEBA FALLÓ:");
    for (const problema of problemas) console.error(`  - ${problema}`);
    process.exit(1);
  }

  console.log(
    `\n${MEGAS} MB subidos con un corte de señal a la mitad, reanudados desde ` +
      `el byte exacto y con el contenido intacto.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
