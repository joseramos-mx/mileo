/**
 * Convierte el odontograma que entregó diseño en algo que la aplicación puede
 * pintar diente por diente.
 *
 *   npm run marcar:odontograma
 *
 * `public/odontogramapuentes.svg` trae los 32 dientes dibujados —dos trazos
 * cada uno, el cuerpo claro y el contorno gris—, un nodo por diente y una línea
 * por cada par de vecinos: 15 por arcada, 30 en total. Esas líneas son el
 * interruptor con el que se unen dos dientes en un puente.
 *
 * Nada de eso viene identificado, así que no hay forma de pintar un diente
 * solo ni de saber qué par une cada línea. Este guion lo deduce de la posición,
 * que es lo único que no depende de en qué orden lo exportó el programa de
 * dibujo:
 *
 *   1. Abre el dibujo en un navegador y le pide a cada grupo su caja real.
 *   2. Parte los grupos en arcada superior e inferior por la altura del centro.
 *   3. Ordena cada arcada de izquierda a derecha. Un odontograma se dibuja como
 *      si viéramos al paciente de frente, así que la izquierda de la pantalla
 *      es su lado derecho: 18…11, 21…28 arriba; 48…41, 31…38 abajo.
 *   4. Le asigna a cada nodo su diente, y a cada línea el par de dientes que
 *      une, por cercanía a los nodos de sus dos puntas.
 *   5. Escribe dos archivos:
 *        public/odontograma-marcado.svg  — el mismo dibujo con id="d-XX"
 *        src/lib/odontograma-trazos.ts   — trazos y enlaces, para React
 *
 * El original no se toca. Si diseño entrega un dibujo nuevo, se vuelve a correr
 * esto y nada más.
 */
import fsp from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const ORIGEN = path.resolve(process.cwd(), "public/odontogramapuentes.svg");
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

      // A cada nodo le toca el diente que tenga mas cerca. Son 32 circulos y
      // 32 dientes: si alguno se repitiera, el dibujo no es el que esperamos y
      // mas vale enterarse aqui que en la pantalla del doctor.
      const circulos = [...svg.querySelectorAll("circle")];
      if (circulos.length !== 32) {
        return { error: `Se encontraron ${circulos.length} nodos y no 32.` };
      }

      const nodos: { numero: number; x: number; y: number; r: number }[] = [];
      for (const c of circulos) {
        const x = Number(c.getAttribute("cx"));
        const y = Number(c.getAttribute("cy"));
        let cerca = dientes[0];
        let menor = Infinity;
        for (const d of dientes) {
          const distancia = Math.hypot(d.cx - x, d.cy - y);
          if (distancia < menor) {
            menor = distancia;
            cerca = d;
          }
        }
        nodos.push({
          numero: cerca.numero,
          x: Number(x.toFixed(2)),
          y: Number(y.toFixed(2)),
          r: Number(Number(c.getAttribute("r")).toFixed(2)),
        });
      }

      const repetidos = nodos.length - new Set(nodos.map((n) => n.numero)).size;
      if (repetidos > 0) {
        return { error: `${repetidos} dientes se quedaron con dos nodos.` };
      }

      // Cada linea une dos nodos: sus puntas caen justo en el centro de uno.
      const rectas = [...svg.querySelectorAll("line")];
      const enlaces: {
        a: number;
        b: number;
        x1: number;
        y1: number;
        x2: number;
        y2: number;
      }[] = [];

      for (const l of rectas) {
        const puntas = [
          [Number(l.getAttribute("x1")), Number(l.getAttribute("y1"))],
          [Number(l.getAttribute("x2")), Number(l.getAttribute("y2"))],
        ];
        const deQuien: number[] = [];
        for (const [x, y] of puntas) {
          let cerca = nodos[0];
          let menor = Infinity;
          for (const n of nodos) {
            const distancia = Math.hypot(n.x - x, n.y - y);
            if (distancia < menor) {
              menor = distancia;
              cerca = n;
            }
          }
          if (menor > 3) {
            return {
              error: `Una linea empieza en (${x}, ${y}), a ${menor.toFixed(1)} de cualquier nodo.`,
            };
          }
          deQuien.push(cerca.numero);
        }

        enlaces.push({
          a: deQuien[0],
          b: deQuien[1],
          x1: Number(puntas[0][0].toFixed(2)),
          y1: Number(puntas[0][1].toFixed(2)),
          x2: Number(puntas[1][0].toFixed(2)),
          y2: Number(puntas[1][1].toFixed(2)),
        });
      }

      // Y cada enlace tiene que unir dos vecinos de la misma arcada.
      for (const e of enlaces) {
        const arcada = superiores.includes(e.a) ? superiores : inferiores;
        const i = arcada.indexOf(e.a);
        const j = arcada.indexOf(e.b);
        if (i === -1 || j === -1 || Math.abs(i - j) !== 1) {
          return { error: `La linea de ${e.a} a ${e.b} no une dos vecinos.` };
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
        nodos,
        enlaces,
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
const nodoDe = new Map((leido.nodos ?? []).map((n) => [n.numero, n]));

const conNodo = porNumero.map((diente) => {
  const nodo = nodoDe.get(diente.numero);
  if (!nodo) {
    console.error(`El diente ${diente.numero} se quedó sin nodo.`);
    process.exit(1);
  }
  return { ...diente, nodo: { x: nodo.x, y: nodo.y, r: nodo.r } };
});

// Los enlaces, nombrados como los dice el doctor: del número menor al mayor.
const enlaces = (leido.enlaces ?? [])
  .map((e) => (e.a < e.b ? e : { ...e, a: e.b, b: e.a, x1: e.x2, y1: e.y2, x2: e.x1, y2: e.y1 }))
  .sort((uno, otro) => uno.a - otro.a || uno.b - otro.b);

const modulo = `/**
 * Los trazos del odontograma, sacados de \`public/odontogramapuentes.svg\`.
 *
 * GENERADO. No se edita a mano: \`npm run marcar:odontograma\`.
 *
 * Cada diente trae dos caminos —el cuerpo, que es el que se rellena según el
 * trabajo, y el contorno, que va siempre encima—, el centro de su caja, donde
 * va el número, y su nodo sobre el riel.
 *
 * Los enlaces son las líneas del riel: cada una une dos dientes vecinos y es el
 * interruptor con el que se arma o se deshace un puente.
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
  /** El punto del riel que le corresponde. */
  nodo: { x: number; y: number; r: number };
};

/** Una línea del riel: el interruptor entre dos dientes vecinos. */
export type EnlaceDeDientes = {
  /** El de número menor, para nombrarlo como lo dice el doctor. */
  a: number;
  b: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export const VISTA_COMPLETA = "${leido.vista}";
export const VISTA_SUPERIOR = "${leido.vistaSuperior}";
export const VISTA_INFERIOR = "${leido.vistaInferior}";

export const TRAZOS: TrazoDeDiente[] = ${JSON.stringify(conNodo, null, 2)};

export const ENLACES: EnlaceDeDientes[] = ${JSON.stringify(enlaces, null, 2)};

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
console.log("");
console.log(`${enlaces.length} enlaces entre vecinos:`);
console.log(`  ${enlaces.map((e) => `${e.a}-${e.b}`).join(" ")}`);
