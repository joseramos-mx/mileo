/**
 * Numera los dientes del dibujo de maxilar y mandíbula.
 *
 *   npm run marcar:mandibulas
 *
 * `public/mandibles.svg` es la vista de frente de las dos arcadas: la encía de
 * arriba, la de abajo y los dientes que se ven desde el frente. Como el
 * odontograma, viene sin identificar, así que aquí se numeran por posición.
 *
 * De frente no se ven los terceros molares —18, 28, 38 y 48 quedan detrás—, así
 * que el dibujo trae siete dientes por cuadrante y no ocho. La pantalla lo dice
 * cuando el caso lleva trabajo en uno de ésos, en vez de esconderlo.
 *
 * El original no se toca. Si diseño entrega un dibujo nuevo, se vuelve a correr.
 */
import fsp from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const ORIGEN = path.resolve(process.cwd(), "public/mandibles.svg");
const DESTINO = path.resolve(process.cwd(), "src/lib/mandibulas-trazos.ts");

/** De izquierda a derecha en pantalla, que es la derecha del paciente. */
const SUPERIORES = [17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27];
const INFERIORES = [47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37];

const dibujo = await fsp.readFile(ORIGEN, "utf8");
const navegador = await chromium.launch();

const leido = await (async () => {
  const pagina = await (await navegador.newContext()).newPage();
  await pagina.setContent(dibujo, { waitUntil: "load" });

  return pagina.evaluate(
    ({ superiores, inferiores }) => {
      const svg = document.querySelector("svg")!;
      const trazos = [...svg.querySelectorAll("path")].map((p) => {
        const caja = p.getBBox();
        return {
          d: p.getAttribute("d") ?? "",
          x: caja.x + caja.width / 2,
          y: caja.y + caja.height / 2,
          ancho: caja.width,
          alto: caja.height,
        };
      });

      // Las encías son los dos trazos anchos: cruzan el dibujo de lado a lado.
      // Todo lo que no las cruza es un diente.
      const anchoTotal = svg.getBBox().width;
      const encias = trazos.filter((t) => t.ancho > anchoTotal * 0.8);
      const dientes = trazos.filter((t) => t.ancho <= anchoTotal * 0.8);

      if (dientes.length !== 28) {
        return { error: `Se encontraron ${dientes.length} dientes y no 28.` };
      }

      const alturas = dientes.map((d) => d.y).sort((a, b) => a - b);
      const corte = (alturas[13] + alturas[14]) / 2;
      const arriba = dientes.filter((d) => d.y < corte).sort((a, b) => a.x - b.x);
      const abajo = dientes.filter((d) => d.y >= corte).sort((a, b) => a.x - b.x);

      if (arriba.length !== 14 || abajo.length !== 14) {
        return {
          error: `Arcadas disparejas: ${arriba.length} arriba, ${abajo.length} abajo.`,
        };
      }

      // Se devuelve todo en el orden del archivo. Importa: hay una encía
      // dibujada despues de seis dientes, y los tapa a proposito. Si se
      // reordena —encias primero, dientes despues— con un solo color no se
      // nota, pero al pintar un diente de otro color aparece entero, incluida
      // la parte que el dibujo esconde.
      const numeroDe = new Map<(typeof trazos)[number], number>();
      for (const [lista, numeros] of [
        [arriba, superiores],
        [abajo, inferiores],
      ] as const) {
        for (let i = 0; i < lista.length; i++) {
          numeroDe.set(lista[i], numeros[i]);
        }
      }

      const piezas = trazos.map((t) => ({
        numero: numeroDe.get(t) ?? null,
        d: t.d,
        cx: Number(t.x.toFixed(2)),
        cy: Number(t.y.toFixed(2)),
      }));

      return {
        vista: svg.getAttribute("viewBox") ?? "",
        piezas,
        cuantosDientes: dientes.length,
        cuantasEncias: encias.length,
      };
    },
    { superiores: SUPERIORES, inferiores: INFERIORES },
  );
})();

await navegador.close();

if ("error" in leido && leido.error) {
  console.error(leido.error);
  process.exit(1);
}
if (!leido.piezas) {
  console.error("El navegador no devolvió el dibujo.");
  process.exit(1);
}

const modulo = `/**
 * Los trazos de maxilar y mandíbula, sacados de \`public/mandibles.svg\`.
 *
 * GENERADO. No se edita a mano: \`npm run marcar:mandibulas\`.
 *
 * Es la vista de frente de las dos arcadas. De frente no se ven los terceros
 * molares, así que este dibujo trae siete dientes por cuadrante: 11 a 17 y sus
 * simétricos. Lo que se capture en un 18, 28, 38 o 48 no tiene dónde pintarse
 * aquí, y la pantalla lo dice con palabras en vez de esconderlo.
 *
 * Las piezas van EN EL ORDEN DEL ARCHIVO y hay que pintarlas en ese orden. No
 * es capricho: el dibujo trae una encía después de seis dientes, y los tapa a
 * propósito. Reordenarlas —encías primero, dientes después— no se nota mientras
 * todo va del mismo gris, pero en cuanto un diente se pinta de otro color
 * aparece entero, incluida la parte que el dibujo esconde.
 */

export type PiezaDelDibujo = {
  /** Notación FDI, o nulo si es encía. */
  numero: number | null;
  d: string;
  cx: number;
  cy: number;
};

export const VISTA_MANDIBULAS = "${leido.vista}";

export const PIEZAS_DEL_DIBUJO: PiezaDelDibujo[] = ${JSON.stringify(leido.piezas, null, 2)};

/** Los que este dibujo sí puede pintar. */
export const NUMEROS_DIBUJADOS = new Set(
  PIEZAS_DEL_DIBUJO.map((p) => p.numero).filter((n): n is number => n !== null),
);
`;

await fsp.writeFile(DESTINO, modulo, "utf8");
console.log(`Escrito ${path.relative(process.cwd(), DESTINO)}`);
console.log(
  `  ${leido.cuantosDientes} dientes y ${leido.cuantasEncias} trazos de encía, en el orden del archivo`,
);
console.log(`  arriba: ${SUPERIORES.join(" ")}`);
console.log(`  abajo:  ${INFERIORES.join(" ")}`);
