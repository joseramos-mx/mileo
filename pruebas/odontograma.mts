import { Client } from "pg";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { sesionPara } from "./ayudas.mjs";
import { cargarAmbiente } from "../scripts/ambiente.mjs";

cargarAmbiente();
const BASE = "http://localhost:3000";
const bd = new Client({ connectionString: process.env.MILEO_BD_URL_ADMIN });
await bd.connect();

const { token, usuarioId } = await sesionPara(bd, "juan.valverde@prodental.mx");

// Un borrador limpio para no ensuciar los que ya existen.
const paciente = (
  await bd.query('SELECT id FROM "Paciente" LIMIT 1')
).rows[0];
const clinica = (await bd.query('SELECT id FROM "Clinica" LIMIT 1')).rows[0];
const caso = (
  await bd.query(
    `INSERT INTO "Caso" (id, folio, "clinicaId", "doctorId", "creadoPorId",
                         "pacienteId", indicacion, etapa, "esBorrador",
                         "creadoEn", "actualizadoEn")
     VALUES (gen_random_uuid()::text, $1, $2, $3, $3, $4, 'CORONA_Y_PUENTE',
             'RECIBIDO', true, now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC')
     RETURNING id, folio`,
    [`C-ODONTO-${Date.now()}`, clinica.id, usuarioId, paciente.id],
  )
).rows[0];

const navegador = await chromium.launch();
const contexto = await navegador.newContext({ viewport: { width: 1500, height: 1000 } });
await contexto.addCookies([
  { name: "mileo_sesion", value: token, domain: "localhost", path: "/" },
]);
const pagina = await contexto.newPage();
pagina.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLA:", m.text().slice(0, 250));
});

let fallas = 0;
function comprobar(que: string, bien: boolean) {
  console.log(`   ${bien ? "ok  " : "FALLA"} ${que}`);
  if (!bien) fallas++;
}

await pagina.goto(`${BASE}/casos/${caso.id}/capturar`, { waitUntil: "networkidle" });
await pagina.addStyleTag({ content: "nextjs-portal { display: none !important }" });

const svg = pagina.locator('svg[aria-label^="Odontograma"]');
comprobar("el odontograma usa el dibujo de diseño", await svg.count() === 1);
comprobar("trae los 32 dientes", await svg.locator("g[data-diente]").count() === 32);

// El 14 sale del dibujo entregado, no de una rejilla.
const d14 = pagina.locator('g[data-diente="14"]');
comprobar(
  "cada diente son trazos del SVG",
  (await d14.locator("path").count()) >= 2,
);
comprobar(
  "sin trabajo, el aria-label lo dice",
  ((await d14.getAttribute("aria-label")) ?? "").includes("sin trabajo"),
);

await pagina.screenshot({ path: "pruebas/capturas/odontograma-vacio.png" });

// Se arma el puente 14-17 tocando el 14 y uniendo vecino por vecino.
await d14.click();
await pagina.waitForTimeout(150);
comprobar(
  "al tocar un diente se abre su panel",
  await pagina.getByRole("heading", { name: "Diente 14" }).isVisible(),
);

comprobar(
  "el riel trae una línea por cada par de vecinos",
  (await pagina.locator("g[data-enlace]").count()) === 30,
);

// El puente se arma en el riel: cada línea es un interruptor.
for (const par of ["14-15", "15-16", "16-17"]) {
  const linea = pagina.locator(`g[data-enlace="${par}"]`);
  comprobar(
    `la línea ${par} empieza apagada`,
    (await linea.getAttribute("aria-checked")) === "false",
  );
  await linea.click();
  await pagina.waitForTimeout(250);
  comprobar(
    `al tocarla, la línea ${par} queda encendida`,
    (await linea.getAttribute("aria-checked")) === "true",
  );
}

// El area de toque de la linea, en pixeles de pantalla.
const cajaEnlace = await pagina.locator('g[data-enlace="14-15"]').boundingBox();
const grosor = Math.min(cajaEnlace?.width ?? 0, cajaEnlace?.height ?? 0);
comprobar(
  `la línea se puede tocar con el dedo (${grosor.toFixed(0)} px de ancho)`,
  grosor >= 24,
);
const cajaDiente = await pagina.locator('g[data-diente="14"]').boundingBox();
comprobar(
  `y el diente también (${(cajaDiente?.width ?? 0).toFixed(0)} px)`,
  Math.min(cajaDiente?.width ?? 0, cajaDiente?.height ?? 0) >= 24,
);

comprobar(
  "la línea 17-18 sigue apagada: nadie la tocó",
  (await pagina.locator('g[data-enlace="17-18"]').getAttribute("aria-checked")) ===
    "false",
);

await pagina.locator('g[data-diente="17"]').click();
await pagina.waitForTimeout(250);
comprobar(
  "el puente aparece nombrado de 14 a 17",
  await pagina.getByText("Puente 14 a 17").first().isVisible(),
);

const etiqueta15 = await pagina.locator('g[data-diente="15"]').getAttribute("aria-label");
comprobar(`el 15 quedó de póntico (${etiqueta15})`, (etiqueta15 ?? "").includes("póntico"));
const etiqueta17 = await pagina.locator('g[data-diente="17"]').getAttribute("aria-label");
comprobar(`el 17 quedó de pilar (${etiqueta17})`, (etiqueta17 ?? "").includes("pilar"));

// Cada estado se pinta distinto, y se comprueba en el dibujo, no a ojo.
const relleno = async (diente: number) =>
  (await pagina
    .locator(`g[data-diente="${diente}"] path`)
    .first()
    .getAttribute("class")) ?? "";
const pilar = await relleno(14);
const pontico = await relleno(15);
const sinNada = await relleno(13);
comprobar(`el pilar va relleno (${pilar})`, pilar.includes("fill-diente-trabajo"));
comprobar(
  `el póntico va con relleno tenue (${pontico})`,
  pontico.includes("fill-diente-pontico"),
);
comprobar(
  `el que no lleva trabajo va sin relleno (${sinNada})`,
  sinNada.includes("fill-diente-cuerpo"),
);
comprobar(
  "los dos pilares se pintan igual",
  (await relleno(17)) === pilar,
);
comprobar(
  "los dos pónticos se pintan igual",
  (await relleno(16)) === pontico,
);
comprobar(
  "el diente abierto lleva su anillo",
  (await pagina.locator('g[data-diente="17"] path.stroke-diente-anillo').count()) === 1,
);

await pagina.screenshot({ path: "pruebas/capturas/odontograma-puente.png" });

// Volver a tocar la línea separa, y se puede deshacer.
await pagina.locator('g[data-enlace="15-16"]').click();
await pagina.waitForTimeout(300);
comprobar(
  "volver a tocar la línea parte el puente en dos",
  (await pagina.locator('g[data-enlace="15-16"]').getAttribute("aria-checked")) ===
    "false",
);
comprobar(
  "y los dos pedazos siguen siendo puentes",
  (await pagina.locator('g[data-enlace="14-15"]').getAttribute("aria-checked")) ===
    "true" &&
    (await pagina.locator('g[data-enlace="16-17"]').getAttribute("aria-checked")) ===
      "true",
);
await pagina.locator('g[data-enlace="15-16"]').click();
await pagina.waitForTimeout(300);
comprobar(
  "y se vuelve a unir",
  (await pagina.locator('g[data-enlace="15-16"]').getAttribute("aria-checked")) ===
    "true",
);

// El teclado: se entra una vez y se recorre con las flechas.
// La arcada de arriba se dibuja del 18 al 28, así que a la derecha del 17
// está el 16 y a su izquierda, el 18.
await pagina.locator('g[data-diente="17"]').focus();
await pagina.keyboard.press("ArrowLeft");
await pagina.waitForTimeout(120);
const aLaIzquierda = await pagina.evaluate(() =>
  document.activeElement?.getAttribute("data-diente"),
);
comprobar(
  `la flecha izquierda va al 18 (llegó a ${aLaIzquierda})`,
  aLaIzquierda === "18",
);
await pagina.keyboard.press("ArrowRight");
await pagina.waitForTimeout(120);
const deVuelta = await pagina.evaluate(() =>
  document.activeElement?.getAttribute("data-diente"),
);
comprobar(`y la derecha regresa al 17 (llegó a ${deVuelta})`, deVuelta === "17");
await pagina.keyboard.press("ArrowDown");
await pagina.waitForTimeout(120);
const abajo = await pagina.evaluate(() =>
  document.activeElement?.getAttribute("data-diente"),
);
comprobar(
  `la flecha abajo cambia de arcada, al 47 (llegó a ${abajo})`,
  abajo === "47",
);
await pagina.keyboard.press("Enter");
await pagina.waitForTimeout(250);
comprobar(
  "con Enter se abre el diente en el que va el foco",
  await pagina.getByRole("heading", { name: "Diente 47" }).isVisible(),
);
// Se deshace: este diente no es del caso.
await pagina.getByRole("button", { name: "Quitar el diente 47 del caso" }).click();
await pagina.waitForTimeout(250);

// Lo que quedó guardado en la base.
await pagina.waitForTimeout(1500);
const guardadas = (
  await bd.query(
    `SELECT u.diente, u.rol, u."puenteId" FROM "Unidad" u
     WHERE u."casoId" = $1 ORDER BY u.diente`,
    [caso.id],
  )
).rows;
comprobar(
  `se guardaron las 4 unidades (${guardadas.map((u) => u.diente).join(", ")})`,
  guardadas.length === 4,
);
comprobar(
  "las cuatro comparten el mismo puente",
  new Set(guardadas.map((u) => u.puenteId)).size === 1 && guardadas[0].puenteId !== null,
);
comprobar(
  `14 y 17 pilares, 15 y 16 pónticos (${guardadas.map((u) => `${u.diente}:${u.rol}`).join(" ")})`,
  guardadas.map((u) => u.rol).join(",") === "PILAR,PONTICO,PONTICO,PILAR",
);

const puentes = (
  await bd.query('SELECT count(*)::int n FROM "Puente" WHERE "casoId" = $1', [caso.id])
).rows[0].n;
comprobar(`quedó un solo renglón de Puente (${puentes})`, puentes === 1);

// Accesibilidad de la pantalla con el odontograma.
const axe = await new AxeBuilder({ page: pagina })
  .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
  .analyze();
const graves = axe.violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
for (const v of graves) console.log(`   axe: ${v.id} — ${v.help}`);
comprobar("accesibilidad del odontograma: sin violaciones graves", graves.length === 0);

// En el celular, una arcada a la vez.
const movil = await navegador.newContext({
  viewport: { width: 390, height: 844 },
  storageState: await contexto.storageState(),
});
const pm = await movil.newPage();
await pm.goto(`${BASE}/casos/${caso.id}/capturar`, { waitUntil: "networkidle" });
await pm.addStyleTag({ content: "nextjs-portal { display: none !important }" });
await pm.waitForTimeout(400);
comprobar(
  "en el celular se ve una arcada a la vez",
  (await pm.locator("svg[aria-label^='Odontograma'] g[data-diente]").count()) === 16,
);
comprobar(
  "y se puede cambiar a la de abajo",
  await pm.getByRole("button", { name: "Arcada inferior" }).isVisible(),
);
await pm.getByRole("button", { name: "Arcada inferior" }).click();
await pm.waitForTimeout(300);
comprobar(
  "al cambiar, se ven los dientes de abajo",
  (await pm.locator('g[data-diente="48"]').count()) === 1,
);
await pm.screenshot({ path: "pruebas/capturas/odontograma-movil.png", fullPage: true });

await navegador.close();
await bd.query('DELETE FROM "Caso" WHERE id = $1', [caso.id]);
await bd.end();

console.log("");
console.log(fallas === 0 ? "Odontograma: todo bien." : `Odontograma: ${fallas} fallas.`);
process.exitCode = fallas === 0 ? 0 : 1;
