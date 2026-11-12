/**
 * Mide el contenido visible de cada render 3D.
 *
 *   npm run dev            (en otra terminal)
 *   npm run medir:renders
 *
 * Cada PNG trae el objeto con distinta cantidad de transparente alrededor: la
 * corona ocupa el 55% de su lienzo y el implante el 89%. Puestos del mismo
 * tamaño se ven dispares, y por eso Mileo no los escala a ojo: mide cuánto
 * ocupa el objeto de verdad y con eso los iguala (ver src/lib/entrada.ts).
 *
 * Cuando el equipo de diseño entregue renders nuevos, se corre esto y se copian
 * los números a RENDERS_3D.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { cargarAmbiente } from "../scripts/ambiente.mjs";

cargarAmbiente();
const BASE = process.env.MILEO_URL ?? "http://localhost:3000";

// Todos los PNG de la carpeta: cuando lleguen renders nuevos no hay que
// acordarse de listarlos aquí.
const RUTAS = fs
  .readdirSync(path.join(process.cwd(), "public", "iconos 3d"))
  .filter((nombre) => nombre.toLowerCase().endsWith(".png"))
  .sort()
  .map((nombre) => `/iconos 3d/${nombre}`);

const OCUPACION = 0.55;

const navegador = await chromium.launch();

async function medir() {
  const pagina = await (await navegador.newContext()).newPage();
  await pagina.goto(`${BASE}/entrar`);

  const medidas = await pagina.evaluate(async (rutas) => {
    const salida: Record<string, unknown> = {};
    for (const ruta of rutas) {
      const img = new Image();
      img.src = encodeURI(ruta);
      await img.decode();

      const lienzo = document.createElement("canvas");
      lienzo.width = img.naturalWidth;
      lienzo.height = img.naturalHeight;
      const ctx = lienzo.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const datos = ctx.getImageData(0, 0, lienzo.width, lienzo.height).data;

      let x0 = lienzo.width,
        y0 = lienzo.height,
        x1 = 0,
        y1 = 0;
      for (let y = 0; y < lienzo.height; y++) {
        for (let x = 0; x < lienzo.width; x++) {
          // Cuenta como objeto lo que no es transparente y tampoco es el
          // fondo negro: los renders nuevos vienen sobre negro y se pintan
          // con mezcla "screen", así que el negro no se ve.
          const i = (y * lienzo.width + x) * 4;
          const brillo = Math.max(datos[i], datos[i + 1], datos[i + 2]);
          if (datos[i + 3] > 12 && brillo > 40) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
      }

      salida[ruta] = {
        proporcion: Number((lienzo.width / lienzo.height).toFixed(3)),
        // Qué fracción del lienzo ocupa el objeto, a lo alto y a lo ancho.
        fraccionAlto: Number(((y1 - y0 + 1) / lienzo.height).toFixed(3)),
        fraccionAncho: Number(((x1 - x0 + 1) / lienzo.width).toFixed(3)),
      };
    }
    return salida;
  }, RUTAS);

  console.log("Cópielos a RENDERS_3D en src/lib/entrada.ts:");
  console.log(JSON.stringify(medidas, null, 2));
  console.log(
    `Con ocupación ${OCUPACION}, cada render se pinta a esta altura del hueco:`,
  );
  for (const [ruta, m] of Object.entries(medidas)) {
    const d = m as {
      proporcion: number;
      fraccionAlto: number;
      fraccionAncho: number;
    };
    const mayor = Math.max(d.proporcion * d.fraccionAncho, d.fraccionAlto);
    console.log(
      `  ${ruta.padEnd(32)} ${((OCUPACION / mayor) * 100).toFixed(0)}%`,
    );
  }
}

await medir();
await navegador.close();
