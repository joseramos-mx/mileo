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

      const numerados: {
        numero: number;
        d: string;
        cx: number;
        cy: number;
      }[] = [];
      for (const [lista, numeros] of [
        [arriba, superiores],
        [abajo, inferiores],
      ] as const) {
        for (let i = 0; i < lista.length; i++) {
          numerados.push({
            numero: numeros[i],
            d: lista[i].d,
            cx: Number(lista[i].x.toFixed(2)),
            cy: Number(lista[i].y.toFixed(2)),
          });
        }
      }

      // Cada encía va con su arcada: la de arriba está más arriba.
      const ordenadas = [...encias].sort((a, b) => a.y - b.y);
      return {
        vista: svg.getAttribute("viewBox") ?? "",
        enciaSuperior: ordenadas.slice(0, encias.length - 1).map((e) => e.d),
        enciaInferior: [ordenadas[ordenadas.length - 1].d],
        dientes: numerados,
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
if (!leido.dientes) {
  console.error("El navegador no devolvió el dibujo.");
  process.exit(1);
}

const porNumero = [...leido.dientes].sort((a, b) => a.numero - b.numero);

const modulo = `/**
 * Los trazos de maxilar y mandíbula, sacados de \`public/mandibles.svg\`.
 *
 * GENERADO. No se edita a mano: \`npm run marcar:mandibulas\`.
 *
 * Es la vista de frente de las dos arcadas. De frente no se ven los terceros
 * molares, así que este dibujo trae siete dientes por cuadrante: 11 a 17 y sus
 * simétricos. Lo que se capture en un 18, 28, 38 o 48 no tiene dónde pintarse
 * aquí, y la pantalla lo dice con palabras en vez de esconderlo.
 */

export type TrazoDeMandibula = {
  /** Notación FDI. */
  numero: number;
  d: string;
  cx: number;
  cy: number;
};

export const VISTA_MANDIBULAS = "${leido.vista}";

/** Los trazos de la encía, que van debajo de los dientes. */
export const ENCIA_SUPERIOR: string[] = ${JSON.stringify(leido.enciaSuperior, null, 2)};
export const ENCIA_INFERIOR: string[] = ${JSON.stringify(leido.enciaInferior, null, 2)};

export const DIENTES_DIBUJADOS: TrazoDeMandibula[] = ${JSON.stringify(porNumero, null, 2)};

/** Los que este dibujo sí puede pintar. */
export const NUMEROS_DIBUJADOS = new Set(
  DIENTES_DIBUJADOS.map((d) => d.numero),
);
`;

await fsp.writeFile(DESTINO, modulo, "utf8");
console.log(`Escrito ${path.relative(process.cwd(), DESTINO)}`);
console.log(`  ${leido.dientes.length} dientes, ${leido.enciaSuperior.length + leido.enciaInferior.length} trazos de encía`);
console.log(`  arriba: ${SUPERIORES.join(" ")}`);
console.log(`  abajo:  ${INFERIORES.join(" ")}`);
