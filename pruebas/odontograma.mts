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

// El interruptor del catalogo se guarda en el perfil, asi que la prueba lo
// deja como estaba antes de empezar: si no, la segunda corrida arrancaria con
// el catalogo completo encendido por la primera.
await bd.query('UPDATE "Usuario" SET "catalogoCompleto" = false WHERE id = $1', [
  usuarioId,
]);

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

const panel = (p: typeof pagina, diente: number) =>
  p.getByRole("region", { name: new RegExp(`^Detalle de Diente ${diente}`) });

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
  "al tocar un diente se abre su catálogo",
  await pagina.getByRole("heading", { name: "Diente 14", exact: true }).isVisible(),
);
comprobar(
  "y su material y color salen arriba del resumen, no al fondo del panel",
  await pagina
    .getByRole("region", { name: /^Detalle de Diente 14/ })
    .getByLabel(/^Material/)
    .isVisible(),
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

await pagina.locator('g[data-diente="15"]').click();
await pagina.waitForTimeout(250);
comprobar(
  "el puente aparece nombrado de 14 a 17",
  await pagina.getByText("Puente 14 a 17").first().isVisible(),
);

const etiqueta15 = await pagina.locator('g[data-diente="15"]').getAttribute("aria-label");
comprobar(`el 15 quedó de póntico (${etiqueta15})`, (etiqueta15 ?? "").includes("póntico"));
const etiqueta17 = await pagina.locator('g[data-diente="17"]').getAttribute("aria-label");
comprobar(
  `el 17, que va en la punta, quedó de corona (${etiqueta17})`,
  (etiqueta17 ?? "").includes("corona anatómica"),
);

// Cada tipo de trabajo pinta el diente de su color, y se comprueba en el
// dibujo, no a ojo.
const relleno = async (diente: number) =>
  (await pagina
    .locator(`g[data-diente="${diente}"] path`)
    .first()
    .getAttribute("fill")) ?? "";
const rolDe = async (diente: number) =>
  (await pagina.locator(`g[data-diente="${diente}"]`).getAttribute("data-rol")) ?? "";

comprobar(
  `el 14 quedó de corona anatómica (${await rolDe(14)})`,
  (await rolDe(14)) === "CORONA_ANATOMICA",
);
comprobar(
  `el 15 quedó de póntico anatómico (${await rolDe(15)})`,
  (await rolDe(15)) === "PONTICO_ANATOMICO",
);

const pilar = await relleno(14);
const pontico = await relleno(15);
const sinNada = await relleno(13);
comprobar(`la corona y el póntico se pintan distinto (${pilar} / ${pontico})`,
  pilar !== pontico && pilar !== "" && pontico !== "");
comprobar(
  `el que no lleva trabajo se queda sin color (${sinNada})`,
  sinNada === "var(--diente-cuerpo)",
);
comprobar("los dos pilares se pintan igual", (await relleno(17)) === pilar);
comprobar("los dos pónticos se pintan igual", (await relleno(16)) === pontico);
comprobar(
  "el diente abierto lleva su anillo",
  (await pagina.locator('g[data-diente="15"] path.stroke-diente-anillo').count()) === 1,
);

// El catalogo entero, en pastillas y no en una lista desplegable.
comprobar(
  "la pastilla puesta se marca, no sólo con color",
  (await pagina
    .locator('aside button[data-trabajo="PONTICO_ANATOMICO"]')
    .getAttribute("aria-pressed")) === "true",
);

// Dentro de un puente, en medio solo caben ponticos.
comprobar(
  "en medio del puente sólo ofrece pónticos",
  (await pagina.locator('aside button[data-trabajo="CORONA_ANATOMICA"]').count()) === 0,
);

// La tabla de abajo, con el metodo de fabricacion.
comprobar(
  "la tabla del caso trae un renglón por diente",
  (await pagina.getByRole("row").count()) === 5, // 4 dientes + encabezados
);
const columnas = await pagina
  .getByRole("columnheader")
  .allInnerTexts();
comprobar(
  `las columnas son diente, trabajo, método, material y color (${columnas.join(", ")})`,
  columnas.slice(0, 5).join("|") ===
    "Diente|Qué se le hace|Método|Material|Color",
);
const renglon15 = pagina.getByRole("row").filter({ hasText: "Póntico anatómico" }).first();
comprobar(
  `el método sale del material (${await renglon15.innerText()})`,
  (await renglon15.innerText()).includes("Fresado"),
);

// Fuera del puente, el catalogo completo, en pastillas y no en una lista.
await pagina.locator('g[data-diente="13"]').click();
await pagina.waitForTimeout(300);
const cortas = await pagina.locator("aside button[data-trabajo]").count();
comprobar(
  `por omisión el doctor ve la lista corta (${cortas} tipos)`,
  // Los nueve de diente de la lista corta. Los de arcada viven en su pestaña.
  cortas === 9,
);
comprobar(
  "y ninguna de arcada, que no se pone en un diente",
  (await pagina.locator('aside button[data-trabajo="GUARDA_OCLUSAL"]').count()) === 0,
);
comprobar(
  "agrupadas por categoría, como en el programa del laboratorio",
  await pagina.getByText("Coronas y cofias").isVisible(),
);

// El catalogo completo se enciende desde la misma pantalla.
await pagina.getByRole("button", { name: "Ver el catálogo completo" }).click();
await pagina.waitForTimeout(400);
const completas = await pagina.locator("aside button[data-trabajo]").count();
comprobar(
  `el catálogo completo trae bastantes más (${completas} tipos)`,
  completas > cortas + 10,
);
comprobar(
  "y ahí sí aparecen los que el laboratorio afina",
  (await pagina.locator('aside button[data-trabajo="CORONA_PRENSADA"]').count()) === 1,
);
comprobar(
  "y ningún desplegable para escoger el tipo",
  (await pagina
    .locator('aside[aria-label^="Qué se le va a hacer"] select')
    .count()) === 0,
);
await pagina.screenshot({ path: "pruebas/capturas/odontograma-catalogo.png" });

// Cada pastilla se mide de verdad en pantalla, con los colores que salieron
// del navegador. Son 29 y ninguna puede quedar por debajo de 4.5:1 (§7).
const contrastes = await pagina.evaluate(() => {
  // Sin funciones con nombre aquí adentro, ni siquiera flechas guardadas en
  // una constante: el empacador les inyecta un `__name` que no existe en el
  // navegador y la llamada se cae entera.
  const flojas: string[] = [];
  const peso = [0.2126, 0.7152, 0.0722];

  for (const boton of document.querySelectorAll("aside button[data-trabajo]")) {
    const estilo = getComputedStyle(boton);
    let fondo = estilo.backgroundColor;
    let padre = boton.parentElement;
    while (padre && /rgba\(0, 0, 0, 0\)|transparent/.test(fondo)) {
      fondo = getComputedStyle(padre).backgroundColor;
      padre = padre.parentElement;
    }

    const luces: number[] = [];
    for (const color of [estilo.color, fondo]) {
      const partes = (color.match(/\d+/g) ?? ["0", "0", "0"]).map(Number);
      let total = 0;
      for (let i = 0; i < 3; i++) {
        const v = partes[i] / 255;
        total +=
          peso[i] *
          (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
      }
      luces.push(total);
    }

    const razon =
      (Math.max(luces[0], luces[1]) + 0.05) /
      (Math.min(luces[0], luces[1]) + 0.05);
    if (razon < 4.5) {
      flojas.push(`${boton.getAttribute("data-trabajo")} ${razon.toFixed(2)}`);
    }
  }
  return flojas;
});
for (const floja of contrastes) console.log(`   contraste bajo: ${floja}`);
comprobar(
  `las 29 pastillas llegan a 4.5:1 (${contrastes.length} por debajo)`,
  contrastes.length === 0,
);
// Se deshace: el 13 no es de este caso.
await pagina
  .getByRole("button", { name: /^Quitar corona anatómica de 13/ })
  .click();
await pagina.waitForTimeout(300);
await pagina.locator('g[data-diente="15"]').click();
await pagina.waitForTimeout(300);

// Cambiar de tipo desde la pastilla.
await pagina.locator('aside button[data-trabajo="PONTICO_PRENSADO"]').click();
await pagina.waitForTimeout(300);
comprobar(
  `el 15 cambió a póntico prensado (${await rolDe(15)})`,
  (await rolDe(15)) === "PONTICO_PRENSADO",
);
comprobar(
  "y el diente se repintó con el color del tipo nuevo",
  (await relleno(15)) !== pontico,
);
await pagina.locator('aside button[data-trabajo="PONTICO_ANATOMICO"]').click();
await pagina.waitForTimeout(300);

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
  await pagina.getByRole("heading", { name: "Diente 47", exact: true }).isVisible(),
);
// Se deshace: este diente no es del caso.
await pagina
  .getByRole("button", { name: /^Quitar .* de 47/ })
  .click();
await pagina.waitForTimeout(250);

// Lo que quedó guardado en la base.
await pagina.waitForTimeout(1500);
const guardadas = (
  await bd.query(
    `SELECT u.diente, u.rol, u.metodo, u."tramoId" FROM "Unidad" u
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
  new Set(guardadas.map((u) => u.tramoId)).size === 1 && guardadas[0].tramoId !== null,
);
comprobar(
  `en las puntas coronas y en medio pónticos (${guardadas.map((u) => `${u.diente}:${u.rol}`).join(" ")})`,
  guardadas.map((u) => u.rol).join(",") ===
    "CORONA_ANATOMICA,PONTICO_ANATOMICO,PONTICO_ANATOMICO,CORONA_ANATOMICA",
);

const tramos = (
  await bd.query('SELECT count(*)::int n FROM "Tramo" WHERE "casoId" = $1', [caso.id])
).rows[0].n;
const indicacion = (
  await bd.query('SELECT indicacion FROM "Caso" WHERE id = $1', [caso.id])
).rows[0].indicacion;
comprobar(
  `la indicación se dedujo de lo capturado (${indicacion})`,
  indicacion === "CORONA_Y_PUENTE",
);
comprobar(`quedó un solo renglón de Tramo (${tramos})`, tramos === 1);
comprobar(
  `el método quedó guardado (${guardadas.map((u) => u.metodo).join(", ")})`,
  guardadas.every((u) => u.metodo !== null),
);

// ------------------------------------------------ el alcance de cada trabajo

// Una anotacion de diente no es una pieza: se dibuja punteada y no cuenta.
await pagina.locator('g[data-diente="26"]').click();
await pagina.waitForTimeout(300);
await pagina.locator('aside button[data-trabajo="DIENTE_VECINO"]').click();
await pagina.waitForTimeout(400);
comprobar(
  "la anotación se dibuja con el contorno punteado",
  (await pagina.locator('g[data-diente="26"][data-anotacion="si"]').count()) === 1,
);
comprobar(
  "y no pregunta material ni color: no se fabrica",
  (await pagina
    .getByRole("region", { name: /^Detalle de Diente 26/ })
    .getByLabel(/^Material/)
    .count()) === 0,
);

// Un trabajo de arcada no se pone en un diente: vive en su propia pestaña.
comprobar(
  "la guarda no se ofrece en el diente",
  (await pagina.locator('aside button[data-trabajo="GUARDA_OCLUSAL"]').count()) === 0,
);

// ------------------------------------------------------------- las pestañas
const pestanaDientes = pagina.getByRole("tab", { name: /^Dientes/ });
const pestanaArcadas = pagina.getByRole("tab", { name: /^Arcadas/ });
comprobar(
  `cada pestaña dice cuántas lleva (${await pestanaDientes.innerText()})`,
  /Dientes \(\d+\)/.test(await pestanaDientes.innerText()) &&
    /Arcadas \(\d+\)/.test(await pestanaArcadas.innerText()),
);
comprobar(
  "la pestaña puesta se anuncia como tal",
  (await pestanaDientes.getAttribute("aria-selected")) === "true" &&
    (await pestanaArcadas.getAttribute("aria-selected")) === "false",
);

// Con el teclado: una parada de tabulador y las flechas mueven.
await pestanaDientes.focus();
await pagina.keyboard.press("ArrowRight");
await pagina.waitForTimeout(300);
comprobar(
  "la flecha derecha cambia de pestaña",
  (await pestanaArcadas.getAttribute("aria-selected")) === "true",
);
const panelArcadas = pagina.getByRole("tabpanel", { name: /^Arcadas/ });
comprobar(
  "y el panel de la pestaña queda a la vista",
  await panelArcadas.isVisible(),
);
// El panel de la otra tiene que desaparecer de verdad. Con `hidden` a secas no
// bastaba: una clase `flex` le gana al `display: none` del atributo y los dos
// se pintaban encimados.
comprobar(
  "y el de la otra pestaña se esconde de verdad",
  (await pagina
    .getByRole("tabpanel", { name: /^Dientes/, includeHidden: true })
    .evaluate((e) => e.getBoundingClientRect().height)) === 0,
);

// Los dientes con trabajo se ven en gris en el dibujo de las arcadas.
comprobar(
  "en Arcadas, los dientes con trabajo se ven en gris",
  (await panelArcadas.locator('path[data-diente="14"][data-ocupado="si"]').count()) === 1 &&
    (await panelArcadas.locator('path[data-diente="13"][data-ocupado="si"]').count()) === 0,
);
comprobar(
  "la leyenda dice qué es cada color, con texto",
  await panelArcadas
    .getByText("Ya tiene trabajo, capturado en Dientes")
    .isVisible(),
);

// La arcada se escoge tocando el dibujo, igual que un diente.
comprobar(
  "de entrada el panel pide escoger una arcada",
  (await panelArcadas.locator("aside button[data-trabajo]").count()) === 0,
);
await panelArcadas.locator('g[data-arcada="SUPERIOR"]').click();
await pagina.waitForTimeout(400);
comprobar(
  "al tocar la arcada de arriba, se abre su panel",
  await panelArcadas
    .getByRole("heading", { name: "Arcada superior" })
    .isVisible(),
);
comprobar(
  "y la arcada tocada queda marcada",
  (await panelArcadas
    .locator('g[data-arcada="SUPERIOR"]')
    .getAttribute("aria-pressed")) === "true",
);

// Se pueden abrir las dos a la vez.
await panelArcadas.locator('g[data-arcada="INFERIOR"]').click();
await pagina.waitForTimeout(400);
comprobar(
  "se pueden abrir las dos arcadas a la vez",
  await panelArcadas
    .getByRole("heading", { name: "Las dos arcadas" })
    .isVisible(),
);

// Y lo que se escoge se pone en las dos.
await panelArcadas.locator('aside button[data-trabajo="MODELO"]').click();
await pagina.waitForTimeout(1600);
const modelos = (
  await bd.query(
    `SELECT arcada FROM "Unidad"
     WHERE "casoId" = $1 AND rol = 'MODELO' ORDER BY arcada`,
    [caso.id],
  )
).rows;
comprobar(
  `con las dos abiertas, el modelo se puso en las dos (${JSON.stringify(modelos)})`,
  modelos.length === 2,
);
comprobar(
  "y la pastilla queda puesta",
  (await panelArcadas
    .locator('aside button[data-trabajo="MODELO"]')
    .getAttribute("aria-pressed")) === "true",
);

// Volver a tocar una arcada la cierra y saca lo suyo del pedido.
await panelArcadas.locator('g[data-arcada="INFERIOR"]').click();
await pagina.waitForTimeout(1600);
const quedan = (
  await bd.query(
    `SELECT arcada FROM "Unidad" WHERE "casoId" = $1 AND rol = 'MODELO'`,
    [caso.id],
  )
).rows;
comprobar(
  `volver a tocar la arcada la saca del pedido (queda ${JSON.stringify(quedan)})`,
  quedan.length === 1 && quedan[0].arcada === "SUPERIOR",
);
comprobar(
  "y con una sola abierta, el panel vuelve a nombrarla",
  await panelArcadas
    .getByRole("heading", { name: "Arcada superior" })
    .isVisible(),
);

// Los trabajos de arcada se agregan aqui, con las mismas pastillas del diente.
await panelArcadas.locator('aside button[data-trabajo="GUARDA_OCLUSAL"]').click();
await pagina.waitForTimeout(400);
comprobar(
  "la guarda se agrega a la arcada y pide su grosor",
  await panelArcadas
    .getByRole("region", { name: /^Detalle de Guarda oclusal/ })
    .getByLabel(/^Grosor/)
    .isVisible(),
);
comprobar(
  "y no pide color: es transparente",
  (await panelArcadas
    .getByRole("region", { name: /^Detalle de Guarda oclusal/ })
    .getByLabel(/^Color/)
    .count()) === 0,
);

// El antagonista se marca por arcada, y con el teclado se cambia de arcada.
await panelArcadas.locator('g[data-arcada="SUPERIOR"]').focus();
await pagina.keyboard.press("ArrowDown");
await pagina.waitForTimeout(200);
await pagina.keyboard.press("Enter");
await pagina.waitForTimeout(400);
await panelArcadas.locator('aside button[data-trabajo="ANTAGONISTA"]').click();
await pagina.waitForTimeout(400);
comprobar(
  "el antagonista se marca sobre la arcada entera",
  (await panelArcadas
    .getByRole("region", { name: /^Detalle de Antagonista/ })
    .count()) > 0,
);

// Volver a Dientes no pierde nada.
const antesDeVolver = await pestanaArcadas.innerText();
await pestanaArcadas.focus();
await pagina.keyboard.press("ArrowLeft");
await pagina.waitForTimeout(400);
comprobar(
  `volver a Dientes no borra lo capturado en Arcadas (${antesDeVolver.trim()})`,
  (await pestanaArcadas.innerText()) === antesDeVolver &&
    /Arcadas \([1-9]/.test(antesDeVolver),
);
comprobar(
  "ni al revés: el odontograma sigue con sus dientes",
  (await pagina.locator("g[data-diente][data-rol]:not([data-rol=''])").count()) > 0,
);

// --------------------------------------------- los campos salen del trabajo
await pagina.locator('g[data-diente="24"]').click();
await pagina.waitForTimeout(300);
await pagina.locator('aside button[data-trabajo="ADITAMENTO"]').click();
await pagina.waitForTimeout(400);
const panel24 = pagina.getByRole("region", { name: /^Detalle de Diente 24/ });
comprobar(
  "el aditamento pide el sistema de implante",
  await panel24.getByLabel(/^Sistema de implante/).isVisible(),
);
comprobar(
  "y cómo se sujeta",
  await panel24.getByRole("radio", { name: "Atornillada" }).isVisible(),
);
await panel24.getByLabel(/^Sistema de implante/).fill("Straumann BLX 4.0");
await pagina.waitForTimeout(400);

// Al cambiar de tipo, lo que ya no aplica desaparece.
await pagina.locator('aside button[data-trabajo="CORONA_ANATOMICA"]').click();
await pagina.waitForTimeout(400);
comprobar(
  "al pasar a corona, el sistema de implante deja de preguntarse",
  (await panel24.getByLabel(/^Sistema de implante/).count()) === 0,
);
comprobar(
  "y en su lugar aparece el color",
  await panel24.getByLabel(/^Color/).isVisible(),
);

// Lo capturado que sigue sirviendo no se pierde.
await pagina.locator('g[data-diente="25"]').click();
await pagina.waitForTimeout(300);
await panel(pagina, 25).getByLabel(/^Color/).selectOption("B2");
await pagina.waitForTimeout(400);
await pagina.locator('aside button[data-trabajo="CARILLA"]').click();
await pagina.waitForTimeout(400);
comprobar(
  "al cambiar de tipo, el color que sigue sirviendo se conserva",
  (await panel(pagina, 25).getByLabel(/^Color/).inputValue()) === "B2",
);

// Lo que quedo guardado de todo esto.
await pagina.waitForTimeout(1600);
const deArcada = (
  await bd.query(
    `SELECT rol, arcada, "grosorMm", diente FROM "Unidad"
     WHERE "casoId" = $1 AND diente IS NULL ORDER BY rol`,
    [caso.id],
  )
).rows;
comprobar(
  `los de arcada se guardaron sin diente (${JSON.stringify(deArcada)})`,
  deArcada.length > 0 &&
    deArcada.every((u) => u.diente === null && u.arcada !== null) &&
    deArcada.some((u) => u.rol === "GUARDA_OCLUSAL" && u.grosorMm !== null) &&
    deArcada.some((u) => u.rol === "ANTAGONISTA"),
);
const anotacion = (
  await bd.query(
    `SELECT material, metodo FROM "Unidad" WHERE "casoId" = $1 AND diente = 26`,
    [caso.id],
  )
).rows[0];
comprobar(
  `la anotación se guardó sin material (${JSON.stringify(anotacion)})`,
  anotacion.material === null && anotacion.metodo === null,
);

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
  await pm
    .getByRole("button", { name: "Arcada inferior", exact: true })
    .isVisible(),
);
await pm.getByRole("button", { name: "Arcada inferior", exact: true }).click();
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
