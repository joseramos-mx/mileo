/**
 * Convierte el odontograma que entregó diseño en algo que la aplicación puede
 * pintar diente por diente.
 *
 *   npm run marcar:odontograma
 *
 * `public/odontograma.svg` trae los 32 dientes dibujados —dos trazos cada uno,
 * el cuerpo claro y el contorno gris— pero sin identificar, así que no hay
 * forma de pintar uno solo. Este guion los numera por su posición, que es lo
 * único que no depende de en qué orden los exportó el programa de dibujo:
 *
 *   1. Abre el dibujo en un navegador y le pide a cada grupo su caja real.
 *   2. Parte los grupos en arcada superior e inferior por la altura del centro.
 *   3. Ordena cada arcada de izquierda a derecha. Un odontograma se dibuja como
 *      si viéramos al paciente de frente, así que la izquierda de la pantalla
 *      es su lado derecho: 18…11, 21…28 arriba; 48…41, 31…38 abajo.
 *   4. Escribe dos archivos:
 *        public/odontograma-marcado.svg  — el mismo dibujo con id="d-XX"
 *        src/lib/odontograma-trazos.ts   — los trazos, para pintarlos en React
 *
 * El original no se toca. Si diseño entrega un dibujo nuevo, se vuelve a correr
 * esto y nada más.
 */
import fsp from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const ORIGEN = path.resolve(process.cwd(), "public/odontograma.svg");
const SVG_MARCADO = path.resolve(
  process.cwd(),
  "public/odontograma-marcado.svg",
);
const TRAZOS = path.resolve(process.cwd(), "src/lib/odontograma-trazos.ts");

/** Notación FDI, de izquierda a derecha tal como se dibuja el odontograma. */
const SUPERIORES = [
  18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28,
];
const INFERIORES = [
  48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38,
];

const dibujo = await fsp.readFile(ORIGEN, "utf8");
const navegador = await chromium.launch();

/**
 * Todo el trabajo se hace dentro del navegador, no sobre el texto del archivo.
 * Es la única forma de no equivocarse: en el texto no se distingue un grupo que
 * es un diente de uno que sólo envuelve a otros, y marcar el envoltorio pinta
 * media arcada de un solo color.
 */
async function leer() {
  const pagina = await (await navegador.newContext()).newPage();
  await pagina.setContent(dibujo, { waitUntil: "load" });

  return pagina.evaluate(
    ({ superiores, inferiores }) => {
      const svg = document.querySelector("svg")!;

      // Un diente es un grupo con trazos y sin grupos adentro.
      const hojas = [...svg.querySelectorAll("g")].filter(
        (g) => g.querySelector("path") && !g.querySelector("g"),
      );
      if (hojas.length !== 32) {
        return { error: `Se encontraron ${hojas.length} dientes y no 32.` };
      }

      const conCaja = hojas.map((g) => {
        const caja = g.getBBox();
        return {
          g,
          caja,
          x: caja.x + caja.width / 2,
          y: caja.y + caja.height / 2,
        };
      });

      const alturas = conCaja.map((d) => d.y).sort((a, b) => a - b);
      const corte = (alturas[15] + alturas[16]) / 2;

      const arriba = conCaja
        .filter((d) => d.y < corte)
        .sort((a, b) => a.x - b.x);
      const abajo = conCaja.filter((d) => d.y >= corte).sort((a, b) => a.x - b.x);

      if (arriba.length !== 16 || abajo.length !== 16) {
        return {
          error: `Arcadas disparejas: ${arriba.length} arriba, ${abajo.length} abajo.`,
        };
      }

      // Ojo: aquí adentro no se declaran funciones con nombre. El empacador
      // les inyecta un `__name` que no existe en el navegador y todo se cae.
      const dientes: {
        numero: number;
        cuerpo: string;
        contorno: string;
        cx: number;
        cy: number;
      }[] = [];

      for (const [lista, numeros] of [
        [arriba, superiores],
        [abajo, inferiores],
      ] as const) {
        for (let i = 0; i < lista.length; i++) {
          const d = lista[i];
          const numero = numeros[i];
          d.g.setAttribute("id", `d-${numero}`);
          d.g.setAttribute("data-diente", String(numero));

          const trazos = [...d.g.querySelectorAll("path")];
          // El cuerpo es el relleno claro; el contorno, el gris de encima. Si
          // el dibujo trajera más trazos, todos los demás cuentan como
          // contorno, para no perder detalle.
          const cuerpo = trazos.find((p) => p.getAttribute("class") === "cls-2");

          dientes.push({
            numero,
            cuerpo: cuerpo?.getAttribute("d") ?? "",
            contorno: trazos
              .filter((p) => p !== cuerpo)
              .map((p) => p.getAttribute("d") ?? "")
              .join(" "),
            cx: Number(d.x.toFixed(2)),
            cy: Number(d.y.toFixed(2)),
          });
        }
      }

      // El recuadro de cada arcada, con un respiro alrededor, para las vistas
      // separadas del celular.
      const encuadres: string[] = [];
      for (const lista of [arriba, abajo]) {
        const x1 = Math.min(...lista.map((d) => d.caja.x));
        const y1 = Math.min(...lista.map((d) => d.caja.y));
        const x2 = Math.max(...lista.map((d) => d.caja.x + d.caja.width));
        const y2 = Math.max(...lista.map((d) => d.caja.y + d.caja.height));
        const aire = 8;
        encuadres.push(
          [
            Number((x1 - aire).toFixed(2)),
            Number((y1 - aire).toFixed(2)),
            Number((x2 - x1 + aire * 2).toFixed(2)),
            Number((y2 - y1 + aire * 2).toFixed(2)),
          ].join(" "),
        );
      }

      return {
        svg: svg.outerHTML,
        vista: svg.getAttribute("viewBox") ?? "",
        vistaSuperior: encuadres[0],
        vistaInferior: encuadres[1],
        dientes,
        arriba: superiores,
        abajo: inferiores,
      };
    },
    { superiores: SUPERIORES, inferiores: INFERIORES },
  );
}

const leido = await leer();
await navegador.close();

if ("error" in leido && leido.error) {
  console.error(leido.error);
  process.exit(1);
}
if (!leido.svg || !leido.dientes) {
  console.error("El navegador no devolvió el dibujo.");
  process.exit(1);
}

const sinCuerpo = leido.dientes.filter((d) => !d.cuerpo);
if (sinCuerpo.length > 0) {
  console.error(
    `Estos dientes no traen relleno: ${sinCuerpo.map((d) => d.numero).join(", ")}`,
  );
  process.exit(1);
}

await fsp.writeFile(
  SVG_MARCADO,
  `<?xml version="1.0" encoding="UTF-8"?>\n${leido.svg}\n`,
  "utf8",
);

const porNumero = [...leido.dientes].sort((a, b) => a.numero - b.numero);

const modulo = `/**
 * Los trazos del odontograma, sacados de \`public/odontograma.svg\`.
 *
 * GENERADO. No se edita a mano: \`npm run marcar:odontograma\`.
 *
 * Cada diente trae dos caminos —el cuerpo, que es el que se rellena según el
 * trabajo, y el contorno, que va siempre encima— y el centro de su caja, que
 * el odontograma usa para poner el número y la línea del puente.
 */

export type TrazoDeDiente = {
  /** Notación FDI. */
  numero: number;
  /** El relleno del diente. */
  cuerpo: string;
  /** El contorno gris, siempre por encima del relleno. */
  contorno: string;
  cx: number;
  cy: number;
};

export const VISTA_COMPLETA = "${leido.vista}";
export const VISTA_SUPERIOR = "${leido.vistaSuperior}";
export const VISTA_INFERIOR = "${leido.vistaInferior}";

export const TRAZOS: TrazoDeDiente[] = ${JSON.stringify(porNumero, null, 2)};

export const TRAZO_POR_DIENTE = new Map(TRAZOS.map((t) => [t.numero, t]));
`;

await fsp.writeFile(TRAZOS, modulo, "utf8");

console.log(`Escrito ${path.relative(process.cwd(), SVG_MARCADO)}`);
console.log(`Escrito ${path.relative(process.cwd(), TRAZOS)}`);
console.log("");
console.log("Arcada superior, de izquierda a derecha:");
console.log(`  ${leido.arriba?.join(" ")}`);
console.log("Arcada inferior, de izquierda a derecha:");
console.log(`  ${leido.abajo?.join(" ")}`);
