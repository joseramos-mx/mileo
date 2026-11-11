/**
 * Pruebas del cotizador. Corren con el ejecutor de Node, sin dependencias:
 *
 *   npx tsx --test src/lib/cotizador.test.ts
 *
 * El catálogo de abajo repite el que siembra `sql/cotizador-rls-y-datos.sql`.
 * Si cambian los precios en la base, estas pruebas no se enteran: prueban la
 * lógica, no los precios.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aCotizacionGuardada,
  cotizar,
  entregaElegida,
  type CatalogoDeCotizacion,
  type UnidadParaCotizar,
} from "./cotizador";

const catalogo: CatalogoDeCotizacion = {
  recargoDiaSiguientePct: 30,
  recargoMismoDiaPct: 50,
  diasHabiles: [1, 2, 3, 4, 5],
  zonaHoraria: "America/Mexico_City",
  inhabiles: ["2026-11-16", "2026-12-25"],
  plazos: [
    { clave: "ZIRCONIO", nombre: "Zirconia monolítica", diasEstandar: 2, diasEstandarMax: null, diasRapido: 1, horaLimite: "11:00", maxUnidadesPorPieza: 3, condicionRapida: "El diseño se aprueba ese mismo día.", diasPorPrueba: null },
    { clave: "DISILICATO", nombre: "Disilicato monolítico", diasEstandar: 1, diasEstandarMax: null, diasRapido: 0, horaLimite: "10:00", maxUnidadesPorPieza: null, condicionRapida: null, diasPorPrueba: null },
    { clave: "IMPRESOS", nombre: "Impresos", diasEstandar: 1, diasEstandarMax: null, diasRapido: 0, horaLimite: "12:00", maxUnidadesPorPieza: null, condicionRapida: null, diasPorPrueba: null },
    { clave: "TOTAL", nombre: "Prótesis total impresa", diasEstandar: 2, diasEstandarMax: null, diasRapido: 1, horaLimite: null, maxUnidadesPorPieza: null, condicionRapida: "Sólo si se imprime en una sola pieza.", diasPorPrueba: null },
    { clave: "REMOVIBLE", nombre: "Removible metálico", diasEstandar: 4, diasEstandarMax: 5, diasRapido: 3, horaLimite: null, maxUnidadesPorPieza: null, condicionRapida: null, diasPorPrueba: 2 },
  ],
  tarifas: [
    { clave: "ZIRCONIO_MONOLITICO", nombre: "Zirconia monolítica", precioCentavos: 115000, roles: ["CORONA_ANATOMICA", "PONTICO_ANATOMICO", "PONTICO_REDUCIDO"], materiales: ["ZIRCONIO_MONOLITICO"], sobreImplante: false, retencion: null, prioridad: 0, incluidaConOtroTrabajo: false, plazoClave: "ZIRCONIO" },
    { clave: "ZIRCONIO_MULTICAPA", nombre: "Zirconia multicapa", precioCentavos: 135000, roles: ["CORONA_ANATOMICA", "PONTICO_ANATOMICO", "PONTICO_REDUCIDO"], materiales: ["ZIRCONIO_ESTRATIFICADO"], sobreImplante: false, retencion: null, prioridad: 0, incluidaConOtroTrabajo: false, plazoClave: "ZIRCONIO" },
    { clave: "DISILICATO_CORONA", nombre: "Disilicato monolítico", precioCentavos: 140000, roles: ["CORONA_ANATOMICA"], materiales: ["DISILICATO_DE_LITIO"], sobreImplante: false, retencion: null, prioridad: 0, incluidaConOtroTrabajo: false, plazoClave: "DISILICATO" },
    { clave: "CORONA_IMPLANTE", nombre: "Corona atornillada sobre implante", precioCentavos: 230000, roles: ["CORONA_ANATOMICA"], materiales: ["ZIRCONIO_MONOLITICO", "ZIRCONIO_ESTRATIFICADO"], sobreImplante: true, retencion: "ATORNILLADA", prioridad: 10, incluidaConOtroTrabajo: false, plazoClave: "ZIRCONIO" },
    { clave: "MODELO_IMPRESO", nombre: "Modelo impreso", precioCentavos: 30000, roles: ["MODELO"], materiales: [], sobreImplante: null, retencion: null, prioridad: 0, incluidaConOtroTrabajo: true, plazoClave: "IMPRESOS" },
    { clave: "GUARDA", nombre: "Guarda oclusal", precioCentavos: 95000, roles: ["GUARDA_OCLUSAL"], materiales: [], sobreImplante: null, retencion: null, prioridad: 0, incluidaConOtroTrabajo: false, plazoClave: "IMPRESOS" },
    { clave: "TOTAL_IMPRESA", nombre: "Prótesis total impresa", precioCentavos: 380000, roles: ["PROTESIS_TOTAL"], materiales: ["RESINA_IMPRESION"], sobreImplante: null, retencion: null, prioridad: 0, incluidaConOtroTrabajo: false, plazoClave: "TOTAL" },
    { clave: "REMOVIBLE_COCR", nombre: "Removible de cromo-cobalto", precioCentavos: 420000, roles: ["PROTESIS_PARCIAL"], materiales: ["CROMO_COBALTO"], sobreImplante: null, retencion: null, prioridad: 0, incluidaConOtroTrabajo: false, plazoClave: "REMOVIBLE" },
  ],
};

const unidad = (parcial: Partial<UnidadParaCotizar>): UnidadParaCotizar => ({
  diente: null,
  arcada: null,
  rol: "CORONA_ANATOMICA",
  material: "ZIRCONIO_MONOLITICO",
  esImplante: false,
  retencion: null,
  tramoId: null,
  ...parcial,
});

const corona = (diente: number, parcial: Partial<UnidadParaCotizar> = {}) =>
  unidad({ diente, ...parcial });

/** Hora de la Ciudad de México (UTC-6, sin horario de verano). */
const cdmx = (fechaYHora: string) => new Date(`${fechaYHora}:00-06:00`);

// Miércoles 11 de noviembre de 2026. El lunes 16 es feriado.
const miercoles9y30 = cdmx("2026-11-11T09:30");

describe("precios", () => {
  it("un puente de zirconia cobra pilares y pónticos como corona", () => {
    const puente = [
      corona(14, { tramoId: "t" }),
      corona(15, { tramoId: "t", rol: "PONTICO_ANATOMICO" }),
      corona(16, { tramoId: "t" }),
    ];
    const c = cotizar(catalogo, puente, { llegaEn: miercoles9y30 })!;
    assert.equal(c.subtotalCentavos, 3 * 115000);
    assert.equal(c.sinPrecio, 0);
  });

  it("distingue zirconia monolítica de multicapa", () => {
    const c = cotizar(
      catalogo,
      [corona(11), corona(21, { material: "ZIRCONIO_ESTRATIFICADO" })],
      { llegaEn: miercoles9y30 },
    )!;
    assert.deepEqual(c.lineas.map((l) => l.precioCentavos), [115000, 135000]);
  });

  it("la corona atornillada sobre implante gana a la de zirconia", () => {
    const c = cotizar(
      catalogo,
      [corona(36, { esImplante: true, retencion: "ATORNILLADA" })],
      { llegaEn: miercoles9y30 },
    )!;
    assert.equal(c.subtotalCentavos, 230000);
  });

  it("cementada sobre implante no tiene precio: se cotiza aparte", () => {
    const c = cotizar(
      catalogo,
      [corona(36, { esImplante: true, retencion: "CEMENTADA" })],
      { llegaEn: miercoles9y30 },
    )!;
    assert.equal(c.lineas[0].precioCentavos, null);
    assert.equal(c.sinPrecio, 1);
    assert.equal(c.subtotalCentavos, 0);
  });

  it("el modelo va incluido con otro trabajo", () => {
    const c = cotizar(
      catalogo,
      [corona(11), unidad({ rol: "MODELO", material: null, arcada: "SUPERIOR" })],
      { llegaEn: miercoles9y30 },
    )!;
    assert.equal(c.subtotalCentavos, 115000);
    assert.equal(c.lineas[1].incluida, true);
  });

  it("el modelo pedido solo cuesta por arcada", () => {
    const c = cotizar(
      catalogo,
      [
        unidad({ rol: "MODELO", material: null, arcada: "SUPERIOR" }),
        unidad({ rol: "MODELO", material: null, arcada: "INFERIOR" }),
      ],
      { llegaEn: miercoles9y30 },
    )!;
    assert.equal(c.subtotalCentavos, 2 * 30000);
  });

  it("un trabajo sin tarifa no se cuenta, pero tampoco tumba el resto", () => {
    const c = cotizar(
      catalogo,
      [corona(11), corona(12, { rol: "COFIA", material: "ZIRCONIO_ULTRAFINO" })],
      { llegaEn: miercoles9y30 },
    )!;
    assert.equal(c.subtotalCentavos, 115000);
    assert.equal(c.sinPrecio, 1);
  });

  it("sin unidades no hay cotización", () => {
    assert.equal(cotizar(catalogo, [], { llegaEn: miercoles9y30 }), null);
  });
});

describe("fecha de entrega", () => {
  it("zirconia: estándar en dos días hábiles y rápida mañana con +30%", () => {
    const c = cotizar(catalogo, [corona(11)], { llegaEn: miercoles9y30 })!;
    assert.equal(c.estandar.fecha, "2026-11-13");
    assert.equal(c.estandar.diasHabiles, 2);
    assert.equal(c.rapida?.disponible, true);
    assert.equal(c.rapida?.fecha, "2026-11-12");
    assert.equal(c.rapida?.recargoPct, 30);
    assert.equal(c.rapida?.recargoCentavos, 34500);
    assert.equal(c.rapida?.totalCentavos, 149500);
    assert.deepEqual(c.rapida?.condiciones, ["El diseño se aprueba ese mismo día."]);
  });

  it("zirconia: llegando a las 11:00 en punto ya no hay rápida", () => {
    const c = cotizar(catalogo, [corona(11)], { llegaEn: cdmx("2026-11-11T11:00") })!;
    assert.equal(c.rapida?.disponible, false);
    assert.match(c.rapida?.motivo ?? "", /antes de las 11:00/);
    assert.equal(c.rapida?.totalCentavos, 115000);
  });

  it("disilicato: estándar mañana y rápida el mismo día con +50%", () => {
    const c = cotizar(
      catalogo,
      [corona(11, { material: "DISILICATO_DE_LITIO" })],
      { llegaEn: miercoles9y30 },
    )!;
    assert.equal(c.estandar.fecha, "2026-11-12");
    assert.equal(c.rapida?.fecha, "2026-11-11");
    assert.equal(c.rapida?.diasHabiles, 0);
    assert.equal(c.rapida?.recargoPct, 50);
    assert.equal(c.rapida?.recargoCentavos, 70000);
  });

  it("en un caso mixto manda la pieza más lenta, y el recargo es del caso entero", () => {
    const c = cotizar(
      catalogo,
      [corona(11), corona(21, { material: "DISILICATO_DE_LITIO" })],
      { llegaEn: miercoles9y30 },
    )!;
    assert.equal(c.estandar.fecha, "2026-11-13");
    assert.equal(c.rapida?.fecha, "2026-11-12");
    assert.equal(c.rapida?.recargoPct, 30);
    assert.equal(c.rapida?.recargoCentavos, Math.round(0.3 * (115000 + 140000)));
  });

  it("si una pieza pierde su hora límite, la rápida no adelanta nada", () => {
    // 10:30: el disilicato ya no alcanza el mismo día; la zirconia sí el siguiente.
    const c = cotizar(
      catalogo,
      [corona(11, { material: "DISILICATO_DE_LITIO" })],
      { llegaEn: cdmx("2026-11-11T10:30") },
    )!;
    assert.equal(c.rapida?.disponible, false);
    assert.match(c.rapida?.motivo ?? "", /antes de las 10:00/);
  });

  it("un puente de cuatro unidades no entra en el plazo rápido de zirconia", () => {
    const puente = [11, 12, 13, 14].map((d) => corona(d, { tramoId: "t" }));
    const c = cotizar(catalogo, puente, { llegaEn: miercoles9y30 })!;
    assert.equal(c.rapida?.disponible, false);
    assert.match(c.rapida?.motivo ?? "", /4 unidades/);
  });

  it("tres coronas sueltas no son un puente", () => {
    const c = cotizar(catalogo, [corona(11), corona(21), corona(31), corona(41)], {
      llegaEn: miercoles9y30,
    })!;
    assert.equal(c.rapida?.disponible, true);
  });

  it("salta fines de semana y feriados al contar", () => {
    // Viernes 13: un día hábil después es el martes 17, porque el lunes es feriado.
    const c = cotizar(catalogo, [corona(11)], { llegaEn: cdmx("2026-11-13T09:00") })!;
    assert.equal(c.estandar.fecha, "2026-11-18");
    assert.equal(c.rapida?.fecha, "2026-11-17");
  });

  it("un caso que llega en día cerrado cuenta desde el siguiente día hábil", () => {
    // Sábado 14: el domingo no se trabaja y el lunes 16 es feriado.
    const c = cotizar(catalogo, [corona(11)], { llegaEn: cdmx("2026-11-14T15:00") })!;
    assert.deepEqual(c.llegada, { fecha: "2026-11-17", ajustada: true });
    assert.equal(c.estandar.fecha, "2026-11-19");
    assert.equal(c.rapida?.fecha, "2026-11-18");
  });

  it("usa la hora de la clínica, no la del servidor", () => {
    // 17:30 UTC es 11:30 en la Ciudad de México: ya pasó la hora de la zirconia.
    const c = cotizar(catalogo, [corona(11)], { llegaEn: new Date("2026-11-11T17:30:00Z") })!;
    assert.equal(c.rapida?.disponible, false);
    // 16:30 UTC son las 10:30 allá: todavía alcanza.
    const antes = cotizar(catalogo, [corona(11)], { llegaEn: new Date("2026-11-11T16:30:00Z") })!;
    assert.equal(antes.rapida?.disponible, true);
    // 03:00 UTC del día 12 es el 11 a las 21:00: en la clínica sigue siendo el día 11.
    const noche = cotizar(catalogo, [corona(11)], { llegaEn: new Date("2026-11-12T03:00:00Z") })!;
    assert.equal(noche.llegada.fecha, "2026-11-11");
  });

  it("removible metálico: de 4 a 5 días hábiles, y cada prueba suma", () => {
    const removible = unidad({
      rol: "PROTESIS_PARCIAL",
      material: "CROMO_COBALTO",
      arcada: "SUPERIOR",
    });
    const sin = cotizar(catalogo, [removible], { llegaEn: miercoles9y30 })!;
    assert.equal(sin.estandar.diasHabilesDesde, 4);
    assert.equal(sin.estandar.diasHabiles, 5);
    assert.equal(sin.estandar.desde, "2026-11-18"); // jue 12, vie 13, mar 17, mié 18
    assert.equal(sin.estandar.fecha, "2026-11-19");
    assert.equal(sin.admitePruebas, true);

    const con = cotizar(catalogo, [removible], { llegaEn: miercoles9y30, pruebas: 1 })!;
    assert.equal(con.estandar.diasHabiles, 7);
    assert.equal(con.rapida?.diasHabiles, 5);
  });

  it("una rápida de tres días no tiene recargo en el catálogo: se avisa, no se inventa", () => {
    const removible = unidad({
      rol: "PROTESIS_PARCIAL",
      material: "CROMO_COBALTO",
      arcada: "SUPERIOR",
    });
    const c = cotizar(catalogo, [removible], { llegaEn: miercoles9y30 })!;
    assert.equal(c.rapida?.disponible, true);
    assert.equal(c.rapida?.recargoPct, null);
    assert.equal(c.rapida?.recargoPorConfirmar, true);
    assert.equal(c.rapida?.recargoCentavos, 0);
  });

  it("sin plazos en el caso, no hay fecha", () => {
    const c = cotizar(
      catalogo,
      [corona(12, { rol: "COFIA", material: "ZIRCONIO_ULTRAFINO" })],
      { llegaEn: miercoles9y30 },
    )!;
    assert.equal(c.estandar.fecha, null);
    assert.equal(c.estandar.disponible, false);
    assert.equal(c.rapida, null);
  });

  it("cambiar un precio o un plazo en el catálogo cambia el resultado", () => {
    const otro: CatalogoDeCotizacion = {
      ...catalogo,
      recargoDiaSiguientePct: 40,
      tarifas: catalogo.tarifas.map((t) =>
        t.clave === "ZIRCONIO_MONOLITICO" ? { ...t, precioCentavos: 120000 } : t,
      ),
      plazos: catalogo.plazos.map((p) =>
        p.clave === "ZIRCONIO" ? { ...p, diasEstandar: 3, horaLimite: "12:00" } : p,
      ),
    };
    const c = cotizar(otro, [corona(11)], { llegaEn: cdmx("2026-11-11T11:30") })!;
    assert.equal(c.subtotalCentavos, 120000);
    // Tres días hábiles desde el miércoles: jueves, viernes y, por el feriado, martes.
    assert.equal(c.estandar.fecha, "2026-11-17");
    assert.equal(c.rapida?.fecha, "2026-11-12");
    assert.equal(c.rapida?.recargoCentavos, 48000);
  });
});

describe("la entrega que marcó el doctor", () => {
  it("sin marcar la rápida, se cobra y se promete la estándar", () => {
    const c = cotizar(catalogo, [corona(11)], { llegaEn: miercoles9y30 })!;
    const e = entregaElegida(c, false);
    assert.ok(e.ok);
    assert.equal(e.rapida, false);
    assert.equal(e.entrega.totalCentavos, 115000);
    assert.equal(e.entrega.fecha, "2026-11-13");
  });

  it("marcada la rápida, se cobra el recargo y se promete la fecha rápida", () => {
    const c = cotizar(catalogo, [corona(11)], { llegaEn: miercoles9y30 })!;
    const e = entregaElegida(c, true);
    assert.ok(e.ok);
    assert.equal(e.rapida, true);
    assert.equal(e.entrega.totalCentavos, 149500);
    assert.equal(e.entrega.fecha, "2026-11-12");
  });

  it("marcada la rápida pasada la hora límite, se rechaza con el motivo: no se baja a estándar en silencio", () => {
    const c = cotizar(catalogo, [corona(11)], { llegaEn: cdmx("2026-11-11T11:05") })!;
    const e = entregaElegida(c, true);
    assert.equal(e.ok, false);
    assert.ok(!e.ok && /antes de las 11:00/.test(e.motivo));
  });

  it("marcada la rápida en un puente demasiado largo, se rechaza", () => {
    const puente = [11, 12, 13, 14].map((d) => corona(d, { tramoId: "t" }));
    const c = cotizar(catalogo, puente, { llegaEn: miercoles9y30 })!;
    const e = entregaElegida(c, true);
    assert.ok(!e.ok && /puente de 4 unidades/.test(e.motivo));
  });

  it("marcada la rápida en un caso sin ninguna pieza acelerable, se rechaza", () => {
    const c = cotizar(
      catalogo,
      [corona(12, { rol: "COFIA", material: "ZIRCONIO_ULTRAFINO" })],
      { llegaEn: miercoles9y30 },
    )!;
    const e = entregaElegida(c, true);
    assert.ok(!e.ok && /Ninguna pieza/.test(e.motivo));
  });

  it("si el plazo ya no tiene rápida en el catálogo, se rechaza", () => {
    const sinRapida: CatalogoDeCotizacion = {
      ...catalogo,
      plazos: catalogo.plazos.map((p) =>
        p.clave === "ZIRCONIO" ? { ...p, diasRapido: null } : p,
      ),
    };
    const c = cotizar(sinRapida, [corona(11)], { llegaEn: miercoles9y30 })!;
    assert.equal(c.rapida, null);
    assert.equal(entregaElegida(c, true).ok, false);
  });

  it("la rápida de disilicato cobra el 50% sobre todo el caso, no sólo sobre la pieza rápida", () => {
    const c = cotizar(
      catalogo,
      [
        corona(11, { material: "DISILICATO_DE_LITIO" }),
        unidad({ arcada: "SUPERIOR", rol: "MODELO", material: null }),
      ],
      { llegaEn: miercoles9y30 },
    )!;
    const e = entregaElegida(c, true);
    assert.ok(e.ok);
    // El modelo va incluido: el subtotal es la corona sola.
    assert.equal(c.subtotalCentavos, 140000);
    assert.equal(e.entrega.recargoCentavos, 70000);
    assert.equal(e.entrega.totalCentavos, 210000);
  });
});

describe("la cotización que se congela en el caso", () => {
  it("guarda lo que se le dijo al doctor, con la rápida cobrada", () => {
    const llegaEn = miercoles9y30;
    const c = cotizar(catalogo, [corona(11), corona(21)], { llegaEn })!;
    const e = entregaElegida(c, true);
    assert.ok(e.ok);
    const g = aCotizacionGuardada(c, e, llegaEn);

    assert.equal(g.version, 1);
    assert.equal(g.entregaRapida, true);
    assert.equal(g.subtotalCentavos, 230000);
    assert.equal(g.recargoPct, 30);
    assert.equal(g.recargoCentavos, 69000);
    assert.equal(g.totalCentavos, 299000);
    assert.equal(g.fechaEstimada, "2026-11-12");
    assert.equal(g.llegada, "2026-11-11");
    assert.equal(g.calculadaEn, llegaEn.toISOString());
    assert.deepEqual(
      g.lineas.map((l) => [l.diente, l.tarifa, l.precioCentavos]),
      [
        [11, "ZIRCONIO_MONOLITICO", 115000],
        [21, "ZIRCONIO_MONOLITICO", 115000],
      ],
    );
  });

  it("la estándar se guarda sin recargo", () => {
    const c = cotizar(catalogo, [corona(11)], { llegaEn: miercoles9y30 })!;
    const e = entregaElegida(c, false);
    assert.ok(e.ok);
    const g = aCotizacionGuardada(c, e, miercoles9y30);
    assert.equal(g.entregaRapida, false);
    assert.equal(g.recargoCentavos, 0);
    assert.equal(g.totalCentavos, 115000);
    assert.equal(g.fechaEstimada, "2026-11-13");
  });

  it("es JSON puro: ida y vuelta sin perder nada (es lo que entra en Caso.cotizacion)", () => {
    const c = cotizar(
      catalogo,
      [corona(11), corona(12, { rol: "COFIA", material: "ZIRCONIO_ULTRAFINO" })],
      { llegaEn: miercoles9y30 },
    )!;
    const e = entregaElegida(c, false);
    assert.ok(e.ok);
    const g = aCotizacionGuardada(c, e, miercoles9y30);
    assert.deepEqual(JSON.parse(JSON.stringify(g)), g);
    // Lo que no tiene precio queda anotado, no en cero.
    assert.equal(g.sinPrecio, 1);
    assert.equal(g.lineas[1].precioCentavos, null);
  });

  it("un precio que cambie después no mueve lo ya guardado", () => {
    const c = cotizar(catalogo, [corona(11)], { llegaEn: miercoles9y30 })!;
    const e = entregaElegida(c, false);
    assert.ok(e.ok);
    const g = aCotizacionGuardada(c, e, miercoles9y30);

    const nuevo: CatalogoDeCotizacion = {
      ...catalogo,
      tarifas: catalogo.tarifas.map((t) =>
        t.clave === "ZIRCONIO_MONOLITICO" ? { ...t, precioCentavos: 999900 } : t,
      ),
    };
    const despues = cotizar(nuevo, [corona(11)], { llegaEn: miercoles9y30 })!;
    assert.equal(despues.subtotalCentavos, 999900);
    assert.equal(g.totalCentavos, 115000);
  });
});
