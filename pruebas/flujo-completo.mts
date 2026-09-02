/**
 * Recorrido completo de un caso, de principio a fin, en un navegador de verdad
 * (SKILL.md §10: "probado con un caso real del laboratorio de principio a fin").
 *
 *   npm run dev            (en otra terminal)
 *   npm run prueba:flujo
 *
 * Recorre, en este orden:
 *   1. La asistente entra y da de alta el caso: indicación, paciente, dientes,
 *      tipo, material y color.
 *   2. Sube el escaneo de la preparación, el antagonista y el registro de
 *      mordida. Comprueba que la lista de admisión bloquea el envío hasta que
 *      estén los tres.
 *   3. Manda el caso al laboratorio.
 *   4. El laboratorio lo acepta: aquí arranca el reloj de la fecha de entrega.
 *   5. Diseño sube el diseño y lo manda a aprobación. Se deriva la malla ligera.
 *   6. Comprueba el bloqueo duro: sin aprobación del doctor no se puede pasar a
 *      fabricación.
 *   7. El doctor abre el visor 3D en un celular y aprueba.
 *   8. Comprueba que el caso ya está en fabricación.
 *
 * En cada pantalla corre axe y guarda una captura en pruebas/capturas.
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { Client } from "pg";
import { cargarAmbiente } from "../scripts/ambiente.mjs";
import { sesionPara, stlDePrueba, pngDePrueba } from "./ayudas.mjs";

cargarAmbiente();

const BASE = process.env.MILEO_URL ?? "http://localhost:3000";
const CAPTURAS = path.resolve(process.cwd(), "pruebas/capturas");
const TEMPORALES = path.resolve(process.cwd(), "pruebas/.temporales");

const CELULAR = { width: 390, height: 844 };
const ESCRITORIO = { width: 1280, height: 900 };

const SALTOS = new RegExp("\s*[\r\n]+\s*");

const problemas: string[] = [];
const violaciones: string[] = [];

function paso(texto: string) {
  console.log(`\n${texto}`);
}

function comprobar(condicion: boolean, queDeberia: string) {
  if (condicion) {
    console.log(`   ok   ${queDeberia}`);
  } else {
    console.log(`   MAL  ${queDeberia}`);
    problemas.push(queDeberia);
  }
}

/** Cero violaciones críticas o serias antes de dar por terminado (§10). */
async function auditar(pagina: Page, nombre: string) {
  // El cascaron se queda quieto: lo unico que se desplaza es <main>. Si algo
  // vuelve a estirar el documento —un absoluto sin ancestro posicionado, por
  // ejemplo un texto de `sr-only`— la barra lateral se va para arriba y queda
  // media pantalla en blanco. Se revisa en cada pantalla auditada.
  const seDesplazo = await pagina.evaluate(() => {
    window.scrollTo(0, 9000);
    const donde = window.scrollY;
    window.scrollTo(0, 0);
    return donde;
  });
  comprobar(
    seDesplazo === 0,
    `en ${nombre} sólo se desplaza el contenido, no la pantalla`,
  );

  // Y tampoco de lado: lo que se recorre a lo ancho es una tabla dentro de su
  // propia caja, nunca la pantalla.
  const deLado = await pagina.evaluate(() => {
    const m = document.querySelector("main");
    if (!m) return 0;
    m.scrollLeft = 9000;
    const donde = m.scrollLeft;
    m.scrollLeft = 0;
    return donde;
  });
  comprobar(deLado === 0, `en ${nombre} nada se recorre de lado`);

  const resultado = await new AxeBuilder({ page: pagina })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();

  const graves = resultado.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );

  if (graves.length === 0) {
    console.log(`   ok   accesibilidad de ${nombre}: sin violaciones graves`);
  } else {
    console.log(`   MAL  accesibilidad de ${nombre}:`);
    for (const violacion of graves) {
      const detalle = `${nombre}: [${violacion.impact}] ${violacion.id} — ${violacion.help} (${violacion.nodes.length})`;
      console.log(`        ${detalle}`);
      for (const nodo of violacion.nodes.slice(0, 3)) {
        console.log(`          ${nodo.target.join(" ")}`);
        const resumen = (nodo.failureSummary ?? "")
          .split(SALTOS)
          .filter(Boolean)
          .join(" | ");
        if (resumen) console.log(`          ${resumen}`);
      }
      violaciones.push(detalle);
    }
  }
}

async function capturar(pagina: Page, nombre: string) {
  // El contenido se desplaza dentro de la envolvente, no en la ventana: una
  // captura de pagina completa no anadiria nada.
  await pagina.screenshot({ path: path.join(CAPTURAS, `${nombre}.png`) });
}

async function contextoDe(
  navegador: Awaited<ReturnType<typeof chromium.launch>>,
  token: string,
  tamano: { width: number; height: number },
) {
  const contexto = await navegador.newContext({
    viewport: tamano,
    locale: "es-MX",
    timezoneId: "America/Monterrey",
    hasTouch: tamano.width < 500,
    isMobile: tamano.width < 500,
    deviceScaleFactor: tamano.width < 500 ? 3 : 1,
  });
  await contexto.addCookies([
    {
      name: "mileo_sesion",
      value: token,
      url: BASE,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  return contexto;
}

async function main() {
  await fsp.mkdir(CAPTURAS, { recursive: true });
  await fsp.mkdir(TEMPORALES, { recursive: true });

  // Archivos de escaneo de prueba.
  const escaneo = path.join(TEMPORALES, "preparacion.stl");
  const antagonista = path.join(TEMPORALES, "antagonista.stl");
  const mordida = path.join(TEMPORALES, "mordida.stl");
  const diseno = path.join(TEMPORALES, "diseno.stl");

  await fsp.writeFile(escaneo, stlDePrueba(24));
  await fsp.writeFile(antagonista, stlDePrueba(24));
  await fsp.writeFile(mordida, stlDePrueba(16));
  await fsp.writeFile(diseno, stlDePrueba(80));

  const fotoAjuste = path.join(TEMPORALES, "ajuste.png");
  const fotoColor = path.join(TEMPORALES, "color.png");
  await fsp.writeFile(fotoAjuste, pngDePrueba());
  await fsp.writeFile(fotoColor, pngDePrueba());

  console.log(
    `Diseño de prueba: ${(fs.statSync(diseno).size / 1024 / 1024).toFixed(2)} MB de STL`,
  );

  const bd = new Client({ connectionString: process.env.DATABASE_URL });
  await bd.connect();

  const asistente = await sesionPara(bd, "recepcion@prodental.mx");
  const doctor = await sesionPara(bd, "juan.valverde@prodental.mx");
  const laboratorio = await sesionPara(bd, "diseno@rmszahn.mx");

  const navegador = await chromium.launch();
  let casoId = "";

  try {
    // ------------------------------------------------------------ 0. entrar
    paso("0. La pantalla de entrada");
    const anonimo = await navegador.newContext({
      viewport: ESCRITORIO,
      locale: "es-MX",
    });
    const entrada = await anonimo.newPage();
    await entrada.goto(`${BASE}/entrar`);
    await entrada.waitForLoadState("networkidle");
    await capturar(entrada, "01-entrar");
    await auditar(entrada, "entrar");
    comprobar(
      await entrada.getByRole("button", { name: "Entrar" }).isVisible(),
      "la pantalla de entrada tiene un botón Entrar",
    );

    // La portada es una sola pantalla: no se desplaza en ningún sentido.
    const seDesplaza = await entrada.evaluate(() => ({
      ancho:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 2,
      alto:
        document.documentElement.scrollHeight >
        document.documentElement.clientHeight + 2,
    }));
    comprobar(
      !seDesplaza.ancho && !seDesplaza.alto,
      "la portada cabe entera en una pantalla, sin desplazamiento",
    );

    comprobar(
      await entrada.getByText("Trabajo con los escáneres de").isVisible(),
      "la portada enseña las marcas compatibles",
    );

    // El carrusel se mueve con las flechas, que son botones de verdad.
    const antesDeLaFlecha = await entrada
      .locator("main [aria-live='polite']")
      .filter({ hasText: "Foto" })
      .first()
      .textContent();
    await entrada
      .getByRole("button", { name: "Ver la siguiente foto" })
      .click();
    await entrada.waitForTimeout(250);
    const despuesDeLaFlecha = await entrada
      .locator("main [aria-live='polite']")
      .filter({ hasText: "Foto" })
      .first()
      .textContent();
    comprobar(
      Boolean(antesDeLaFlecha) && antesDeLaFlecha !== despuesDeLaFlecha,
      "las flechas del carrusel cambian la foto y lo anuncian",
    );

    await anonimo.close();

    // ------------------------------------------- 1. alta de caso, en celular
    paso("1. La asistente da de alta el caso desde el celular");
    const deLaClinica = await contextoDe(navegador, asistente.token, CELULAR);
    const clinica = await deLaClinica.newPage();

    await clinica.goto(`${BASE}/`);
    await clinica.waitForLoadState("networkidle");
    await capturar(clinica, "02-inicio-celular");
    await auditar(clinica, "inicio (celular)");

    await clinica.goto(`${BASE}/casos/nuevo`);
    comprobar(
      (await clinica.getByText("¿Qué necesita?").count()) === 0,
      "el paso del paciente ya no pregunta el tipo de trabajo: eso es del paso 2",
    );
    const folioPuesto = await clinica
      .getByLabel(/Folio del paciente/)
      .inputValue();
    comprobar(
      /^\d+$/.test(folioPuesto),
      `el folio del paciente lo da el sistema (${folioPuesto})`,
    );
    await clinica.getByLabel(/Folio del paciente/).fill("1041");
    await clinica.getByLabel(/^Iniciales/).fill("R.T.G.");
    await capturar(clinica, "03-alta-paso-1");
    await auditar(clinica, "alta de caso paso 1");

    await clinica.getByRole("button", { name: "Continuar" }).click();
    await clinica.waitForURL(/\/casos\/.+\/capturar/);
    casoId = clinica.url().split("/casos/")[1].split("/")[0];
    console.log(`   Caso: ${casoId}`);

    // -------------------------------------------------- 2. dientes y material
    paso("2. Odontograma, rol, material y color");

    // El odontograma es el dibujo que entregó diseño: cada diente es un trazo
    // del SVG con su número FDI, no un botón de una rejilla.
    // El odontograma lo pinta un componente de cliente: se espera a que
    // aparezca en vez de contarlo al vuelo, que en la primera carga de la ruta
    // llegaba antes de la hidratación.
    const dientesDelDibujo = clinica.locator(
      "svg[aria-label^='Odontograma'] g[data-diente]",
    );
    await dientesDelDibujo.first().waitFor({ timeout: 20_000 });
    comprobar(
      (await dientesDelDibujo.count()) === 16,
      "el odontograma se pinta sobre el dibujo entregado",
    );

    await clinica.getByRole("button", { name: /^Diente 16/ }).click();
    await clinica.waitForTimeout(400);
    comprobar(
      await clinica
        .getByRole("heading", { name: "Diente 16", exact: true })
        .isVisible(),
      "al tocar un diente se abre su panel con rol, material y color",
    );

    // El material tiene que corresponder al rol: se cambia y se revisa.
    await clinica
      .getByLabel(/^Material/)
      .selectOption({ label: "Disilicato de litio" });
    await clinica.waitForTimeout(400);

    await clinica.getByRole("button", { name: /^Diente 15/ }).click();
    await clinica.waitForTimeout(1500); // deja que guarde el borrador

    comprobar(
      (await clinica
        .getByRole("rowheader")
        .filter({ hasText: /^1[56]/ })
        .count()) === 2,
      "los dos dientes quedan en la tabla del caso",
    );

    await capturar(clinica, "04-alta-paso-2");
    await auditar(clinica, "alta de caso paso 2");

    // ------------------------------------------------ 3. archivos y admisión
    paso("3. Archivos y lista de admisión");

    comprobar(
      (await clinica.getByRole("navigation", { name: /Pasos para crear/ }).count()) === 1,
      "cada paso enseña arriba por dónde va el alta",
    );

    await clinica.getByRole("link", { name: /Continuar a los archivos/ }).click();
    await clinica.waitForURL(/\/casos\/.+\/archivos/);
    await clinica.waitForLoadState("networkidle");
    await auditar(clinica, "archivos del caso");

    const mandar = clinica.getByRole("button", {
      name: "Mandar el caso al laboratorio",
    });
    comprobar(
      await mandar.isDisabled(),
      "sin archivos, la lista de admisión bloquea el envío",
    );

    const zonas = clinica.locator('input[type="file"]');
    await zonas.nth(0).setInputFiles(escaneo);
    await clinica.waitForTimeout(2500);
    await zonas.nth(1).setInputFiles(antagonista);
    await clinica.waitForTimeout(2500);

    comprobar(
      await mandar.isDisabled(),
      "falta el registro de mordida: el envío sigue bloqueado",
    );

    await zonas.nth(2).setInputFiles(mordida);
    await clinica.waitForTimeout(3000);
    await clinica.reload();
    await clinica.waitForLoadState("networkidle");

    const mandarListo = clinica.getByRole("button", {
      name: "Mandar el caso al laboratorio",
    });
    comprobar(
      await mandarListo.isEnabled(),
      "con la lista completa, el envío se desbloquea",
    );

    await capturar(clinica, "05-admision-completa");
    await auditar(clinica, "lista de admisión");

    // ------------------------------------------------------------ 4. mandar
    paso("4. La asistente manda el caso");
    await mandarListo.scrollIntoViewIfNeeded();
    await clinica.waitForTimeout(600);

    // Que el botón principal no quede tapado por nada: en el celular, tocar y
    // que responda otra cosa es peor que no poder tocarlo.
    const loQueEstaEncima = await clinica.evaluate(() => {
      const boton = [...document.querySelectorAll("button")].find((b) =>
        b.textContent?.includes("Mandar el caso"),
      );
      if (!boton) return "no encontré el botón";
      const r = boton.getBoundingClientRect();
      const encima = document.elementFromPoint(
        r.left + r.width / 2,
        r.top + r.height / 2,
      );
      if (encima === boton || boton.contains(encima)) return "el botón";
      return `${encima?.tagName ?? "nada"}.${(encima as HTMLElement)?.className ?? ""}`.slice(0, 80);
    });
    comprobar(
      loQueEstaEncima === "el botón",
      `nada tapa el botón principal (en su centro hay: ${loQueEstaEncima})`,
    );

    // Se acciona con teclado, como exige §7.
    await mandarListo.focus();
    await clinica.keyboard.press("Enter");
    await clinica.waitForURL(/\/casos\/[^/]+(\?|$)/, { timeout: 20000 });
    await clinica.waitForLoadState("networkidle");

    comprobar(
      await clinica.getByRole("status").isVisible(),
      "después de mandar, Mileo confirma qué sigue y cuándo",
    );
    await capturar(clinica, "06-caso-enviado");
    await auditar(clinica, "caso recién enviado");
    await deLaClinica.close();

    // ------------------------------------------------------ 5. laboratorio
    paso("5. El laboratorio acepta y diseña");
    const delLaboratorio = await contextoDe(
      navegador,
      laboratorio.token,
      ESCRITORIO,
    );
    const taller = await delLaboratorio.newPage();

    await taller.goto(`${BASE}/`);
    await taller.waitForLoadState("networkidle");
    await capturar(taller, "07-requiere-atencion");
    await auditar(taller, "requiere atención");

    await taller.goto(`${BASE}/tablero`);
    await taller.waitForLoadState("networkidle");
    await capturar(taller, "08-tablero");
    await auditar(taller, "tablero");

    await taller.goto(`${BASE}/casos/${casoId}`);
    await taller.waitForLoadState("networkidle");

    const sinFecha = await taller
      .getByText(/Se la confirmo en cuanto acepte el caso/)
      .isVisible();
    comprobar(
      sinFecha,
      "antes de aceptar no hay fecha comprometida: el reloj arranca al aceptar",
    );

    // Recibido → en revisión → aceptado
    await taller.getByRole("button", { name: "En revisión" }).click();
    await taller.waitForLoadState("networkidle");
    await taller.getByRole("button", { name: "Aceptado", exact: true }).click();
    await taller.waitForLoadState("networkidle");

    const conFecha = await taller.getByText(/Fecha de entrega/).isVisible();
    comprobar(conFecha, "al aceptar, el caso ya tiene fecha de entrega");

    // Aceptado → en diseño
    await taller.getByRole("button", { name: "En diseño" }).click();
    await taller.waitForLoadState("networkidle");

    // -------------------------------------------- 6. diseño y bloqueo duro
    paso("6. Diseño sube el diseño y lo manda a aprobación");

    // El diseño se sube desde la propia pantalla del laboratorio.
    await taller.locator('input[type="file"]').first().setInputFiles(diseno);
    await taller.waitForTimeout(4000);
    await taller.reload();
    await taller.waitForLoadState("networkidle");

    const disenoSubido = (
      await bd.query(
        `SELECT count(*)::int AS n FROM "Archivo"
          WHERE "casoId" = $1 AND tipo = 'DISENO' AND estado = 'COMPLETO'`,
        [casoId],
      )
    ).rows[0].n;
    comprobar(disenoSubido === 1, "el laboratorio sube el diseño desde Mileo");

    // La clínica no puede hacer pasar un archivo suyo por diseño aprobado.
    const intentoDeLaClinica = await fetch(
      `${BASE}/api/casos/${casoId}/archivos`,
      {
        method: "POST",
        headers: {
          cookie: `mileo_sesion=${asistente.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          nombre: "falso.stl",
          bytesTotales: 100,
          tipo: "DISENO",
        }),
      },
    );
    comprobar(
      intentoDeLaClinica.status === 403,
      "la clínica no puede subir un archivo haciéndolo pasar por diseño",
    );

    await taller
      .getByRole("button", { name: /Mandar a aprobación/ })
      .first()
      .click();
    await taller.waitForLoadState("networkidle");
    await taller.waitForTimeout(1500);

    const mallaLista = (
      await bd.query(
        `SELECT count(*)::int AS n FROM "Archivo"
          WHERE "casoId" = $1 AND tipo = 'MALLA_LIGERA' AND estado = 'COMPLETO'`,
        [casoId],
      )
    ).rows[0].n;
    comprobar(
      mallaLista === 1,
      "se derivó la malla ligera: al doctor no se le manda el archivo original",
    );

    const etapaAhora = (
      await bd.query('SELECT etapa FROM "Caso" WHERE id = $1', [casoId])
    ).rows[0].etapa;
    comprobar(
      etapaAhora === "ESPERANDO_APROBACION",
      "el caso queda esperando la aprobación del doctor",
    );

    // Bloqueo duro: nada se fabrica sin aprobación registrada del doctor.
    const botonesDeEtapa = await taller
      .getByRole("button", { name: "En fabricación" })
      .count();
    comprobar(
      botonesDeEtapa === 0,
      "sin aprobación del doctor, el laboratorio no tiene a dónde mandar a fabricar",
    );

    await capturar(taller, "09-laboratorio-caso");
    await auditar(taller, "caso visto por el laboratorio");
    await delLaboratorio.close();

    // --------------------------------------------- 7. el doctor, en celular
    paso("7. El doctor abre el visor 3D en su celular y aprueba");
    const delDoctor = await contextoDe(navegador, doctor.token, CELULAR);
    const celular = await delDoctor.newPage();

    await celular.goto(`${BASE}/`);
    await celular.waitForLoadState("networkidle");
    comprobar(
      await celular
        .getByRole("heading", { name: /necesita.? de usted/ })
        .isVisible(),
      "el inicio del doctor dice de entrada qué le toca a él",
    );
    await capturar(celular, "10-inicio-doctor");
    await auditar(celular, "inicio del doctor");

    const arranqueDelVisor = Date.now();
    await celular.goto(`${BASE}/casos/${casoId}`);
    await celular.waitForSelector("canvas", { timeout: 20000 });
    await celular.waitForTimeout(1200);
    const segundosDelVisor = (Date.now() - arranqueDelVisor) / 1000;

    comprobar(
      segundosDelVisor < 10,
      `el visor 3D abre en menos de 10 s (tardó ${segundosDelVisor.toFixed(1)} s)`,
    );

    // El fondo del visor se mide de verdad: se resuelve el color y se calcula
    // su luminancia. Tiene que ser claro aunque el tema esté en oscuro.
    const luzDelFondo = await celular.evaluate(() => {
      const nodo = document.querySelector(".siempre-claro");
      if (!nodo) return -1;
      const color = getComputedStyle(nodo).backgroundColor;
      const [r, g, b] = (color.match(/\d+/g) ?? ["0", "0", "0"]).map(Number);
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    });
    comprobar(
      luzDelFondo > 0.8,
      `el visor va sobre fondo neutro claro (luminancia ${luzDelFondo.toFixed(2)})`,
    );

    await capturar(celular, "11-aprobacion-visor");
    await auditar(celular, "aprobación del diseño");

    await celular.getByRole("button", { name: "Aprobar y fabricar" }).click();
    await celular.waitForLoadState("networkidle");
    await celular.waitForTimeout(1500);

    const despues = (
      await bd.query('SELECT etapa FROM "Caso" WHERE id = $1', [casoId])
    ).rows[0].etapa;
    comprobar(
      despues === "EN_FABRICACION",
      "con la aprobación registrada, el caso pasa a fabricación",
    );

    const aprobaciones = (
      await bd.query(
        `SELECT count(*)::int AS n FROM "Aprobacion"
          WHERE "casoId" = $1 AND decision = 'APROBADO'`,
        [casoId],
      )
    ).rows[0].n;
    comprobar(aprobaciones === 1, "la aprobación del doctor queda registrada");

    await capturar(celular, "12-aprobado");

    await delDoctor.close();

    // --------------------------------------- 8. control de calidad y envio
    paso("8. Control de calidad y envio");
    const deCalidad = await contextoDe(navegador, laboratorio.token, CELULAR);
    const revision = await deCalidad.newPage();

    await bd.query(
      `UPDATE "Caso" SET etapa = 'EN_CONTROL_DE_CALIDAD' WHERE id = $1`,
      [casoId],
    );

    await revision.goto(`${BASE}/casos/${casoId}`);
    await revision.waitForLoadState("networkidle");

    const ofreceSalir = await revision
      .getByRole("button", { name: "Listo y en camino" })
      .count();
    comprobar(
      ofreceSalir === 0,
      "sin control de calidad, el caso no se puede mandar moviendo la etapa",
    );

    await revision.goto(`${BASE}/casos/${casoId}/calidad`);
    await revision.waitForLoadState("networkidle");

    const cerrar = revision.getByRole("button", {
      name: "Cerrar calidad y mandar el caso",
    });
    comprobar(
      await cerrar.isDisabled(),
      "sin las dos fotos ni el kit, no se puede cerrar la calidad",
    );
    await capturar(revision, "13-calidad-bloqueada");
    await auditar(revision, "control de calidad");

    const camaras = revision.locator('input[type="file"]');
    await camaras.nth(0).setInputFiles(fotoAjuste);
    await revision.waitForTimeout(2500);
    await camaras.nth(1).setInputFiles(fotoColor);
    await revision.waitForTimeout(2500);
    await revision.reload();
    await revision.waitForLoadState("networkidle");

    const conFotosSinKit = revision.getByRole("button", {
      name: "Cerrar calidad y mandar el caso",
    });
    comprobar(
      await conFotosSinKit.isDisabled(),
      "con las fotos pero sin el kit, sigue bloqueado",
    );

    const casillas = revision.locator('input[name="kit"]');
    const cuantas = await casillas.count();
    for (let i = 0; i < cuantas; i++) {
      await casillas.nth(i).check();
    }
    await revision.getByLabel(/Numero de guia|Número de guía/).fill("EST-99887766");
    await revision.waitForTimeout(300);

    const listoParaCerrar = revision.getByRole("button", {
      name: "Cerrar calidad y mandar el caso",
    });
    comprobar(
      await listoParaCerrar.isEnabled(),
      "con las dos fotos y el kit completo, se activa el boton",
    );
    await capturar(revision, "14-calidad-lista");

    await listoParaCerrar.click();
    await revision.waitForLoadState("networkidle");
    await revision.waitForTimeout(1500);

    const etapaTrasIntento = (
      await bd.query('SELECT etapa FROM "Caso" WHERE id = $1', [casoId])
    ).rows[0].etapa;
    comprobar(
      etapaTrasIntento === "EN_CONTROL_DE_CALIDAD",
      "quien diseno el caso no puede cerrar tambien su control de calidad",
    );

    await revision
      .getByLabel(/Correo de direccion|Correo de dirección/)
      .fill("direccion@rmszahn.mx");
    await revision
      .getByLabel(/Por que se autoriza|Por qué se autoriza/)
      .fill("Es sabado y no hay nadie mas en el laboratorio para revisarlo.");
    await revision
      .getByRole("button", { name: "Cerrar calidad y mandar el caso" })
      .click();
    await revision.waitForLoadState("networkidle");
    await revision.waitForTimeout(1800);

    const calidad = (
      await bd.query(
        `SELECT c.etapa, q."numeroDeGuia", q."autorizadoPorId",
                q."motivoDeAutorizacion"
           FROM "Caso" c JOIN "ControlDeCalidad" q ON q."casoId" = c.id
          WHERE c.id = $1`,
        [casoId],
      )
    ).rows[0];

    comprobar(
      calidad?.etapa === "LISTO_Y_EN_CAMINO",
      "con la autorizacion de direccion, el caso sale del laboratorio",
    );
    comprobar(
      calidad?.numeroDeGuia === "EST-99887766",
      "la guia queda guardada en el caso",
    );
    comprobar(
      Boolean(calidad?.autorizadoPorId && calidad?.motivoDeAutorizacion),
      "la autorizacion de direccion queda registrada con su motivo",
    );

    const enBitacora = Number(
      (
        await bd.query(
          `SELECT count(*)::int n FROM "EventoBitacora"
            WHERE "casoId" = $1 AND resumen ILIKE '%autoriz%'`,
          [casoId],
        )
      ).rows[0].n,
    );
    comprobar(enBitacora >= 1, "la bitacora guarda que se salto la separacion");

    await deCalidad.close();

    // ------------------------------------------------- 9. tema oscuro y zoom
    paso("9. Los dos temas y el zoom al 200%");
    const delDoctorOtraVez = await contextoDe(navegador, doctor.token, CELULAR);
    const celular2 = await delDoctorOtraVez.newPage();

    // Oscuro por omisión, como el diseño entregado.
    await celular2.goto(`${BASE}/`);
    await celular2.waitForLoadState("networkidle");
    const arrancaOscuro = await celular2.evaluate(
      () => document.documentElement.dataset.tema !== "claro",
    );
    comprobar(arrancaOscuro, "Mileo arranca en tema oscuro, como el diseño");
    await capturar(celular2, "15-tema-oscuro");
    await auditar(celular2, "inicio en tema oscuro");

    // Y el claro sigue siendo un interruptor del usuario.
    await celular2.goto(`${BASE}/configuracion`);
    await celular2.waitForLoadState("networkidle");
    await celular2.getByRole("button", { name: /Tema claro/ }).click();
    await celular2.waitForTimeout(400);
    await celular2.goto(`${BASE}/`);
    await celular2.waitForLoadState("networkidle");
    const quedoClaro = await celular2.evaluate(
      () => document.documentElement.dataset.tema === "claro",
    );
    comprobar(quedoClaro, "el interruptor cambia a tema claro y se queda");
    await capturar(celular2, "16-tema-claro");
    await auditar(celular2, "inicio en tema claro");

    await celular2.evaluate(() => {
      document.documentElement.style.fontSize = "32px";
    });
    await celular2.waitForTimeout(300);
    // Qué se considera roto: que la ventana se desplace a lo ancho, o que algo
    // quede cortado sin manera de alcanzarlo. Una tira que se desplaza a
    // propósito —las categorías del inicio— no cuenta: su contenido sí se
    // alcanza.
    // Qué se considera roto: que la ventana se desplace a lo ancho, o que algo
    // quede cortado sin manera de alcanzarlo. Una tira que se desplaza a
    // propósito —las categorías del inicio— no cuenta: su contenido sí se
    // alcanza.
    //
    // Sin funciones adentro del evaluate: esbuild les inyecta __name, que no
    // existe en el navegador.
    const desbordaAlZoom = await celular2.evaluate(() => {
      window.scrollTo(9999, 0);
      const seMueveLaVentana = window.scrollX > 0;
      window.scrollTo(0, 0);
      if (seMueveLaVentana) return true;

      const contenido = document.getElementById("contenido");
      if (!contenido) return false;

      const borde = contenido.getBoundingClientRect();
      for (const nodo of contenido.querySelectorAll("*")) {
        // Las tripas de un SVG miden en su propio sistema de coordenadas: sus
        // rectángulos no dicen nada del acomodo de la página.
        if ((nodo as SVGElement).ownerSVGElement) continue;

        const r = nodo.getBoundingClientRect();
        if (r.width === 0) continue;
        if (r.right - borde.left <= contenido.clientWidth + 1) continue;

        let dentroDeUnaTira = false;
        let padre: Element | null = nodo.parentElement;
        while (padre && padre !== contenido) {
          const desplazable = getComputedStyle(padre).overflowX;
          if (desplazable === "auto" || desplazable === "scroll") {
            dentroDeUnaTira = true;
            break;
          }
          padre = padre.parentElement;
        }
        if (!dentroDeUnaTira) return true;
      }
      return false;
    });

    comprobar(
      !desbordaAlZoom,
      "con el texto al 200% la pantalla no se desborda a lo ancho",
    );
    await capturar(celular2, "17-zoom-200");

    await delDoctorOtraVez.close();
  } finally {
    await navegador.close();
    await bd.end();
  }

  // ------------------------------------------------------------- resultado
  console.log("\n────────────────────────────────────────");
  console.log(`Capturas en ${CAPTURAS}`);
  console.log(`Comprobaciones fallidas : ${problemas.length}`);
  console.log(`Violaciones graves      : ${violaciones.length}`);

  if (problemas.length || violaciones.length) {
    console.error("\nLA AUDITORÍA FALLÓ:");
    for (const problema of problemas) console.error(`  - ${problema}`);
    for (const violacion of violaciones) console.error(`  - ${violacion}`);
    process.exit(1);
  }

  console.log("\nRecorrido completo y auditoría limpios.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
