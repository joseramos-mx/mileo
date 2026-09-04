/**
 * Le pone un diseño a los casos de demostración que no lo tienen.
 *
 *     npm run demo:disenos
 *
 * Para qué existe: en producción, un caso sólo llega a "esperando su
 * aprobación" pasando por `mandarDisenoAAprobacion`, que sube el diseño y
 * deriva su vista antes de mover la etapa. En una base de desarrollo no: las
 * pruebas de riesgo y avisos crean casos directamente en esa etapa para
 * comprobar los recordatorios de 24 y 48 horas, y cada corrida deja uno. Con
 * treinta corridas, el doctor abre su inicio y ve treinta recuadros punteados
 * de "aquí va el diseño" en vez de sus piezas.
 *
 * Esto los completa. La geometría es la esfera facetada de siempre, no un
 * diente: los diseños de verdad son los STL que sube el laboratorio (§9). Sirve
 * para que la pantalla se vea como se va a ver, no para simular un caso.
 *
 * No toca nada en producción, y no escribe en la bitácora: no está pasando
 * nada: está completando un archivo que faltaba en datos de prueba.
 */
import fsp from "node:fs/promises";
import { Client } from "pg";
import { cargarAmbiente } from "./ambiente.mjs";
import { prepararCarpeta, rutaRelativaDe } from "../src/lib/almacen.js";
import { derivarMallaLigera } from "../src/lib/malla.js";

cargarAmbiente();

if (process.env.NODE_ENV === "production") {
  console.error("Esto es para datos de demostración, no para producción.");
  process.exit(1);
}

/** La misma esfera facetada que usan las pruebas. No es un diente. */
function esferaDePrueba(divisiones = 48): Buffer {
  const triangulos: number[][] = [];

  for (let anillo = 0; anillo < divisiones / 2; anillo++) {
    const phi1 = (anillo / (divisiones / 2)) * Math.PI;
    const phi2 = ((anillo + 1) / (divisiones / 2)) * Math.PI;

    for (let sector = 0; sector < divisiones; sector++) {
      const theta1 = (sector / divisiones) * 2 * Math.PI;
      const theta2 = ((sector + 1) / divisiones) * 2 * Math.PI;

      const punto = (phi: number, theta: number) => [
        10 * Math.sin(phi) * Math.cos(theta),
        10 * Math.cos(phi),
        10 * Math.sin(phi) * Math.sin(theta),
      ];

      const a = punto(phi1, theta1);
      const b = punto(phi2, theta1);
      const c = punto(phi2, theta2);
      const d = punto(phi1, theta2);

      triangulos.push([...a, ...b, ...c]);
      triangulos.push([...a, ...c, ...d]);
    }
  }

  const buffer = Buffer.alloc(84 + triangulos.length * 50);
  buffer.write("Mileo · diseño de demostración", 0, 79, "ascii");
  buffer.writeUInt32LE(triangulos.length, 80);

  let salida = 84;
  for (const triangulo of triangulos) {
    salida += 12; // la normal se recalcula al leer
    for (const valor of triangulo) {
      buffer.writeFloatLE(valor, salida);
      salida += 4;
    }
    salida += 2; // el atributo del triángulo
  }

  return buffer;
}

const bd = new Client({ connectionString: process.env.MILEO_BD_URL_ADMIN });
await bd.connect();

// Los que ya pasaron por diseño y no tienen vista que enseñar.
const huerfanos = (
  await bd.query(
    `SELECT c.id, c.folio, c."tecnicoId"
       FROM "Caso" c
      WHERE NOT c."esBorrador"
        AND c.etapa IN ('ESPERANDO_APROBACION', 'EN_FABRICACION',
                        'EN_CONTROL_DE_CALIDAD', 'LISTO_Y_EN_CAMINO',
                        'ENTREGADO')
        AND NOT EXISTS (
          SELECT 1 FROM "Archivo" a
           WHERE a."casoId" = c.id
             AND a.tipo = 'MALLA_LIGERA'
             AND a.estado = 'COMPLETO')
      ORDER BY c."creadoEn"`,
  )
).rows as { id: string; folio: string; tecnicoId: string | null }[];

if (huerfanos.length === 0) {
  console.log("Todos los casos que pasaron por diseño ya tienen su vista.");
  await bd.end();
  process.exit(0);
}

// Quién lo sube: el técnico del caso si lo tiene, y si no, alguien del
// laboratorio. Nunca el doctor: él no manda diseños.
const delLaboratorio = (
  await bd.query(
    `SELECT id FROM "Usuario"
      WHERE rol IN ('DISENO', 'MANUFACTURA', 'ACABADO', 'DIRECCION')
      ORDER BY rol LIMIT 1`,
  )
).rows[0] as { id: string } | undefined;

if (!delLaboratorio) {
  console.error("No hay ningún usuario del laboratorio que pueda subirlo.");
  await bd.end();
  process.exit(1);
}

const stl = esferaDePrueba();
console.log(`${huerfanos.length} casos sin vista del diseño.`);

let hechos = 0;
for (const caso of huerfanos) {
  const subidoPor = caso.tecnicoId ?? delLaboratorio.id;

  const disenoId = (
    await bd.query(
      `INSERT INTO "Archivo" (id, "casoId", nombre, tipo, extension,
                              "bytesTotales", "bytesRecibidos", estado,
                              "rutaRelativa", "subidoPorId", "creadoEn",
                              "actualizadoEn")
       VALUES (gen_random_uuid()::text, $1, $2, 'DISENO', 'stl', $3, $3,
               'COMPLETO', '', $4,
               now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC')
       RETURNING id`,
      [caso.id, `Diseño de ${caso.folio}.stl`, stl.length, subidoPor],
    )
  ).rows[0].id as string;

  const ruta = rutaRelativaDe(caso.id, disenoId, "stl");
  await fsp.writeFile(await prepararCarpeta(ruta), stl);
  await bd.query('UPDATE "Archivo" SET "rutaRelativa" = $1 WHERE id = $2', [
    ruta,
    disenoId,
  ]);

  // La misma derivación que corre cuando el laboratorio manda el diseño: la
  // malla ligera y, de una vez, el retrato que ven las tarjetas.
  const resumen = await derivarMallaLigera({
    rutaDelOriginal: ruta,
    casoId: caso.id,
    archivoId: disenoId,
  });

  await bd.query(
    `INSERT INTO "Archivo" (id, "casoId", nombre, tipo, extension,
                            "bytesTotales", "bytesRecibidos", estado,
                            "rutaRelativa", "subidoPorId", "creadoEn",
                            "actualizadoEn")
     VALUES (gen_random_uuid()::text, $1, $2, 'MALLA_LIGERA', 'malla', $3, $3,
             'COMPLETO', $4, $5,
             now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC')`,
    [
      caso.id,
      `Vista de ${caso.folio}`,
      resumen.bytes,
      resumen.rutaRelativa,
      subidoPor,
    ],
  );

  hechos++;
  if (hechos % 10 === 0) console.log(`  ${hechos} de ${huerfanos.length}…`);
}

await bd.end();
console.log(`Listo: ${hechos} casos con su vista del diseño.`);
process.exit(0);
