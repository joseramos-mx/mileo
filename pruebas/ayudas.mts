import crypto from "node:crypto";
import { Client } from "pg";

/** Cosas que comparten las pruebas de navegador. */

/**
 * Abre una sesión para un correo de la semilla y devuelve la galleta lista para
 * ponerle al navegador. Se hace contra la base, con las mismas reglas que la
 * aplicación, para no dejar puertas traseras en el código de producción.
 */
export async function sesionPara(bd: Client, correo: string) {
  const usuario = (
    await bd.query('SELECT id FROM "Usuario" WHERE correo = $1', [correo])
  ).rows[0];

  if (!usuario) {
    throw new Error(
      `No existe ${correo}. Falta la semilla: npx prisma db seed`,
    );
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  // Prisma lee las fechas sin zona horaria como UTC: hay que guardarlas igual.
  await bd.query(
    `INSERT INTO "Sesion" (id, "usuarioId", "tokenHash", "expiraEn", "creadoEn")
     VALUES ($1, $2, $3,
             (now() AT TIME ZONE 'UTC') + interval '2 hours',
             now() AT TIME ZONE 'UTC')`,
    [crypto.randomUUID(), usuario.id, tokenHash],
  );

  return { token, tokenHash, usuarioId: usuario.id };
}

/**
 * Genera un STL binario con forma de esfera facetada.
 *
 * No es un diente: es geometría de prueba para comprobar que la derivación de
 * la malla ligera funciona con un archivo real. Los renders de verdad los
 * entrega el equipo de diseño desde los STL del laboratorio (SKILL.md §9).
 */
export function stlDePrueba(divisiones = 64): Buffer {
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
  buffer.write("Mileo STL de prueba", 0, 79, "ascii");
  buffer.writeUInt32LE(triangulos.length, 80);

  let salida = 84;
  for (const triangulo of triangulos) {
    // La normal se recalcula al leer; aquí va en cero.
    salida += 12;
    for (const valor of triangulo) {
      buffer.writeFloatLE(valor, salida);
      salida += 4;
    }
    salida += 2;
  }

  return buffer;
}

/**
 * Un PNG chiquito y valido, para las fotos del control de calidad.
 * No es una foto de una pieza: es un archivo real con el que probar el flujo.
 * Las fotos de verdad las toma quien revisa, con la pieza en la mano.
 */
export function pngDePrueba(): Buffer {
  const base64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAJUlEQVR42mNk" +
    "+M9Qz0AEYBxVSF+FjIyM/xkYGBgYRxXSVyEA6/8L8Q0Yy0kAAAAASUVORK5CYII=";
  return Buffer.from(base64, "base64");
}
