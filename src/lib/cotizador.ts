import type {
  Arcada,
  Material,
  Retencion,
  RolDeUnidad,
} from "@/generated/prisma/enums";

/**
 * Calculadora de precios y fecha de entrega.
 *
 * Es una función pura: recibe el catálogo (que sale de la base, ver
 * `cotizador-catalogo.ts`), las unidades del caso y el momento en que llega, y
 * devuelve el precio y las fechas. No sabe de Prisma ni de React, así que corre
 * igual en el navegador —para que el precio cambie mientras el doctor escoge—
 * y en el servidor, que es quien tiene la última palabra al enviar el caso.
 *
 * Ningún precio, plazo, hora ni porcentaje está escrito aquí: todo viene del
 * catálogo, y lo que el catálogo no cubre se dice ("se cotiza aparte") en vez de
 * inventarse.
 *
 * Quién recibe qué: las anotaciones (antagonista, diente vecino, omitir en
 * puente) no se fabrican ni se cotizan, y quien llama las quita antes.
 */

// ------------------------------------------------------------------- entrada

export type UnidadParaCotizar = {
  diente: number | null;
  arcada: Arcada | null;
  rol: RolDeUnidad;
  material: Material | null;
  esImplante: boolean;
  retencion: Retencion | null;
  tramoId: string | null;
};

export type TarifaDeCotizacion = {
  clave: string;
  nombre: string;
  precioCentavos: number;
  roles: RolDeUnidad[];
  materiales: Material[];
  sobreImplante: boolean | null;
  retencion: Retencion | null;
  prioridad: number;
  incluidaConOtroTrabajo: boolean;
  plazoClave: string;
};

export type PlazoDeCotizacion = {
  clave: string;
  nombre: string;
  diasEstandar: number;
  diasEstandarMax: number | null;
  diasRapido: number | null;
  horaLimite: string | null;
  maxUnidadesPorPieza: number | null;
  condicionRapida: string | null;
  diasPorPrueba: number | null;
};

export type CatalogoDeCotizacion = {
  tarifas: TarifaDeCotizacion[];
  plazos: PlazoDeCotizacion[];
  recargoDiaSiguientePct: number;
  recargoMismoDiaPct: number;
  /** 1 es lunes, 7 es domingo. */
  diasHabiles: number[];
  zonaHoraria: string;
  /** "AAAA-MM-DD". */
  inhabiles: string[];
};

export type OpcionesDeCotizacion = {
  /** Cuándo llega el caso al laboratorio. */
  llegaEn: Date;
  /** Cuántas pruebas con el paciente lleva, en los plazos que las admiten. */
  pruebas?: number;
};

// -------------------------------------------------------------------- salida

export type LineaCotizada = {
  /** Estable, para la llave de React. */
  clave: string;
  diente: number | null;
  arcada: Arcada | null;
  rol: RolDeUnidad;
  tarifa: { clave: string; nombre: string } | null;
  /** null: ninguna tarifa la cubre. 0: va incluida con el caso. */
  precioCentavos: number | null;
  incluida: boolean;
};

export type EntregaCotizada = {
  disponible: boolean;
  /** "AAAA-MM-DD". null si no hay de dónde sacar un plazo. */
  fecha: string | null;
  /** Primer día posible, cuando el plazo es un rango. */
  desde: string | null;
  /** Días hábiles desde que llega el caso. 0 es el mismo día. */
  diasHabiles: number | null;
  diasHabilesDesde: number | null;
  /** null: el catálogo no tiene recargo para un plazo así. */
  recargoPct: number | null;
  recargoCentavos: number;
  recargoPorConfirmar: boolean;
  /** Subtotal más recargo. */
  totalCentavos: number;
  /** Lo que el laboratorio confirma y esto no puede saber. */
  condiciones: string[];
  /** Por qué no está disponible. */
  motivo: string | null;
};

export type Cotizacion = {
  lineas: LineaCotizada[];
  /** Sólo lo que tiene precio. */
  subtotalCentavos: number;
  /** Cuántas líneas no tienen tarifa y quedan fuera del total y de la fecha. */
  sinPrecio: number;
  /** Algún plazo del caso admite pruebas con el paciente. */
  admitePruebas: boolean;
  /** Cuándo cuenta el laboratorio que llegó. */
  llegada: { fecha: string; ajustada: boolean };
  estandar: EntregaCotizada;
  /** null si ninguna pieza del caso se puede acelerar. */
  rapida: EntregaCotizada | null;
};

// ------------------------------------------------------------------- calendario

const MS_DIA = 86_400_000;

function aDia(fecha: string): Date {
  return new Date(`${fecha}T00:00:00Z`);
}

function deDia(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

function sumarDias(fecha: string, dias: number): string {
  return deDia(new Date(aDia(fecha).getTime() + dias * MS_DIA));
}

function esHabil(c: CatalogoDeCotizacion, fecha: string): boolean {
  const diaDeLaSemana = aDia(fecha).getUTCDay() || 7;
  return c.diasHabiles.includes(diaDeLaSemana) && !c.inhabiles.includes(fecha);
}

function siguienteHabil(c: CatalogoDeCotizacion, fecha: string): string {
  if (c.diasHabiles.length === 0) {
    throw new Error("El laboratorio no tiene ningún día hábil configurado.");
  }
  let dia = sumarDias(fecha, 1);
  // Un año de días inhábiles seguidos es una configuración rota, no un caso.
  for (let i = 0; i < 366 && !esHabil(c, dia); i++) dia = sumarDias(dia, 1);
  return dia;
}

function sumarHabiles(c: CatalogoDeCotizacion, fecha: string, dias: number): string {
  let dia = fecha;
  for (let i = 0; i < dias; i++) dia = siguienteHabil(c, dia);
  return dia;
}

/** Cuántos días hábiles hay después de `desde`, hasta `hasta` inclusive. */
function habilesEntre(c: CatalogoDeCotizacion, desde: string, hasta: string): number {
  let cuenta = 0;
  for (let dia = sumarDias(desde, 1); dia <= hasta; dia = sumarDias(dia, 1)) {
    if (esHabil(c, dia)) cuenta++;
  }
  return cuenta;
}

/** Fecha y hora en la zona del laboratorio, no en la del servidor. */
function partesLocales(ahora: Date, zona: string) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: zona,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(ahora)
      .map((p) => [p.type, p.value]),
  );
  return {
    fecha: `${partes.year}-${partes.month}-${partes.day}`,
    minutos: Number(partes.hour) * 60 + Number(partes.minute),
  };
}

/** "11:00" -> 660. */
function aMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + (m || 0);
}

/**
 * Cuándo cuenta el laboratorio que llegó el caso. Si llega un día que no
 * trabaja, cuenta como llegado a la apertura del siguiente día hábil: no se
 * promete nada para un día cerrado.
 */
function llegadaEfectiva(c: CatalogoDeCotizacion, llegaEn: Date) {
  const local = partesLocales(llegaEn, c.zonaHoraria);
  if (esHabil(c, local.fecha)) {
    return { fecha: local.fecha, minutos: local.minutos, ajustada: false };
  }
  return { fecha: siguienteHabil(c, local.fecha), minutos: 0, ajustada: true };
}

// ------------------------------------------------------------------- precios

function cubre(tarifa: TarifaDeCotizacion, u: UnidadParaCotizar): boolean {
  if (!tarifa.roles.includes(u.rol)) return false;
  if (tarifa.materiales.length > 0) {
    if (!u.material || !tarifa.materiales.includes(u.material)) return false;
  }
  if (tarifa.sobreImplante !== null && tarifa.sobreImplante !== u.esImplante) {
    return false;
  }
  if (tarifa.retencion !== null && tarifa.retencion !== u.retencion) return false;
  return true;
}

/** La de mayor prioridad; a igualdad, la de clave menor, para que sea estable. */
function tarifaDe(
  tarifas: TarifaDeCotizacion[],
  u: UnidadParaCotizar,
): TarifaDeCotizacion | null {
  let mejor: TarifaDeCotizacion | null = null;
  for (const t of tarifas) {
    if (!cubre(t, u)) continue;
    if (
      !mejor ||
      t.prioridad > mejor.prioridad ||
      (t.prioridad === mejor.prioridad && t.clave < mejor.clave)
    ) {
      mejor = t;
    }
  }
  return mejor;
}

// --------------------------------------------------------------------- cálculo

const sinEntrega: EntregaCotizada = {
  disponible: false,
  fecha: null,
  desde: null,
  diasHabiles: null,
  diasHabilesDesde: null,
  recargoPct: 0,
  recargoCentavos: 0,
  recargoPorConfirmar: false,
  totalCentavos: 0,
  condiciones: [],
  motivo: null,
};

export function cotizar(
  c: CatalogoDeCotizacion,
  unidades: UnidadParaCotizar[],
  { llegaEn, pruebas = 0 }: OpcionesDeCotizacion,
): Cotizacion | null {
  if (unidades.length === 0) return null;

  const cubiertas = unidades.map((u) => ({ u, tarifa: tarifaDe(c.tarifas, u) }));

  // Lo que va incluido sólo se regala si hay algo más que cobrar: un modelo
  // solo es un pedido, no un obsequio.
  const hayOtroTrabajo = cubiertas.some(({ tarifa }) => !tarifa?.incluidaConOtroTrabajo);

  const lineas: LineaCotizada[] = cubiertas.map(({ u, tarifa }) => {
    const incluida = Boolean(tarifa?.incluidaConOtroTrabajo && hayOtroTrabajo);
    return {
      clave: `${u.diente ?? u.arcada ?? "caso"}-${u.rol}`,
      diente: u.diente,
      arcada: u.arcada,
      rol: u.rol,
      tarifa: tarifa ? { clave: tarifa.clave, nombre: tarifa.nombre } : null,
      precioCentavos: !tarifa ? null : incluida ? 0 : tarifa.precioCentavos,
      incluida,
    };
  });

  const subtotalCentavos = lineas.reduce((s, l) => s + (l.precioCentavos ?? 0), 0);
  const sinPrecio = lineas.filter((l) => l.precioCentavos === null).length;

  // ---- fechas
  const llegada = llegadaEfectiva(c, llegaEn);
  const plazosPorClave = new Map(c.plazos.map((p) => [p.clave, p]));

  // Cuántas unidades unidas lleva el puente más grande de cada plazo.
  const tamanoDeTramo = new Map<string, number>();
  for (const { u } of cubiertas) {
    if (u.tramoId) tamanoDeTramo.set(u.tramoId, (tamanoDeTramo.get(u.tramoId) ?? 0) + 1);
  }
  const usados = new Map<string, { plazo: PlazoDeCotizacion; tramoMayor: number }>();
  for (const { u, tarifa } of cubiertas) {
    const plazo = tarifa && plazosPorClave.get(tarifa.plazoClave);
    if (!plazo) continue;
    const tramo = u.tramoId ? (tamanoDeTramo.get(u.tramoId) ?? 1) : 1;
    const previo = usados.get(plazo.clave);
    usados.set(plazo.clave, {
      plazo,
      tramoMayor: Math.max(previo?.tramoMayor ?? 1, tramo),
    });
  }

  if (usados.size === 0) {
    return {
      lineas,
      subtotalCentavos,
      sinPrecio,
      admitePruebas: false,
      llegada: { fecha: llegada.fecha, ajustada: llegada.ajustada },
      estandar: {
        ...sinEntrega,
        totalCentavos: subtotalCentavos,
        motivo: "Ninguna pieza del caso tiene plazo en la lista.",
      },
      rapida: null,
    };
  }

  const extraPorPruebas = (p: PlazoDeCotizacion) =>
    Math.max(0, Math.floor(pruebas)) * (p.diasPorPrueba ?? 0);

  let estandarMin = llegada.fecha;
  let estandarMax = llegada.fecha;
  let rapidaFecha = llegada.fecha;
  let hayRapido = false;
  let admitePruebas = false;
  const razones: string[] = [];
  const condiciones: string[] = [];

  for (const { plazo, tramoMayor } of usados.values()) {
    const extra = extraPorPruebas(plazo);
    if (plazo.diasPorPrueba) admitePruebas = true;

    const tope = sumarHabiles(c, llegada.fecha, (plazo.diasEstandarMax ?? plazo.diasEstandar) + extra);
    const piso = sumarHabiles(c, llegada.fecha, plazo.diasEstandar + extra);
    if (tope > estandarMax) estandarMax = tope;
    if (piso > estandarMin) estandarMin = piso;

    // Rápido: si esta familia no se puede acelerar, se queda en su estándar.
    let fechaRapida = tope;
    if (plazo.diasRapido !== null) {
      hayRapido = true;
      const pasaDeLaHora =
        plazo.horaLimite !== null && llegada.minutos >= aMinutos(plazo.horaLimite);
      const puenteGrande =
        plazo.maxUnidadesPorPieza !== null && tramoMayor > plazo.maxUnidadesPorPieza;

      if (pasaDeLaHora) {
        razones.push(
          `Para ${plazo.nombre.toLowerCase()} el caso tiene que llegar antes de las ${plazo.horaLimite}.`,
        );
      } else if (puenteGrande) {
        razones.push(
          `Un puente de ${tramoMayor} unidades no entra en el plazo rápido: llega hasta ${plazo.maxUnidadesPorPieza}.`,
        );
      } else {
        fechaRapida = sumarHabiles(c, llegada.fecha, plazo.diasRapido + extra);
        if (plazo.condicionRapida && !condiciones.includes(plazo.condicionRapida)) {
          condiciones.push(plazo.condicionRapida);
        }
      }
    }
    if (fechaRapida > rapidaFecha) rapidaFecha = fechaRapida;
  }

  const estandar: EntregaCotizada = {
    disponible: true,
    fecha: estandarMax,
    desde: estandarMin !== estandarMax ? estandarMin : null,
    diasHabiles: habilesEntre(c, llegada.fecha, estandarMax),
    diasHabilesDesde:
      estandarMin !== estandarMax ? habilesEntre(c, llegada.fecha, estandarMin) : null,
    recargoPct: 0,
    recargoCentavos: 0,
    recargoPorConfirmar: false,
    totalCentavos: subtotalCentavos,
    condiciones: [],
    motivo: null,
  };

  if (!hayRapido) return {
    lineas,
    subtotalCentavos,
    sinPrecio,
    admitePruebas,
    llegada: { fecha: llegada.fecha, ajustada: llegada.ajustada },
    estandar,
    rapida: null,
  };

  const adelanta = rapidaFecha < estandarMax;
  let rapida: EntregaCotizada;

  if (!adelanta) {
    rapida = {
      ...sinEntrega,
      totalCentavos: subtotalCentavos,
      motivo: razones.length > 0 ? razones.join(" ") : "El caso no se puede entregar antes.",
    };
  } else {
    // El recargo lo manda lo que se adelanta, no la pieza: se cobra sobre todo
    // el caso según se entregue el mismo día o el siguiente.
    const recargoPct =
      rapidaFecha === llegada.fecha
        ? c.recargoMismoDiaPct
        : rapidaFecha === siguienteHabil(c, llegada.fecha)
          ? c.recargoDiaSiguientePct
          : null;
    const recargoCentavos = Math.round(((recargoPct ?? 0) * subtotalCentavos) / 100);
    rapida = {
      disponible: true,
      fecha: rapidaFecha,
      desde: null,
      diasHabiles: habilesEntre(c, llegada.fecha, rapidaFecha),
      diasHabilesDesde: null,
      recargoPct,
      recargoCentavos,
      recargoPorConfirmar: recargoPct === null,
      totalCentavos: subtotalCentavos + recargoCentavos,
      condiciones,
      motivo: null,
    };
  }

  return {
    lineas,
    subtotalCentavos,
    sinPrecio,
    admitePruebas,
    llegada: { fecha: llegada.fecha, ajustada: llegada.ajustada },
    estandar,
    rapida,
  };
}

// ------------------------------------------------- lo que el doctor escogió

/**
 * La entrega que el doctor marcó, o por qué no se puede.
 *
 * La entrega rápida depende de la hora, del tamaño del puente y de qué piezas
 * lleva el caso, así que lo que se marcó hace un minuto puede ya no valer. Esta
 * función es la que decide, y la usan igual la pantalla y el servidor: si la
 * rápida no se puede, no se cobra el recargo ni se promete la fecha.
 */
export type EleccionDeEntrega =
  | { ok: true; rapida: boolean; entrega: EntregaCotizada }
  | { ok: false; motivo: string };

export function entregaElegida(c: Cotizacion, quiereRapida: boolean): EleccionDeEntrega {
  if (!quiereRapida) return { ok: true, rapida: false, entrega: c.estandar };
  if (c.rapida?.disponible) return { ok: true, rapida: true, entrega: c.rapida };
  return {
    ok: false,
    motivo: c.rapida?.motivo ?? "Ninguna pieza de este caso se puede entregar más rápido.",
  };
}

/**
 * El precio y la fecha como se le dijeron al doctor al enviar el caso. Se guarda
 * en `Caso.cotizacion` (JSON): las tarifas cambian, y un caso ya enviado no debe
 * cambiar de precio porque alguien editó la lista después.
 *
 * Sólo lleva tipos que viajan como JSON, sin fechas de objeto.
 */
export type CotizacionGuardada = {
  version: 1;
  /** Cuándo se calculó, ISO 8601. */
  calculadaEn: string;
  /** El doctor marcó entrega rápida y se le cobró el recargo. */
  entregaRapida: boolean;
  /** Día que el laboratorio contó como llegada, "AAAA-MM-DD". */
  llegada: string;
  lineas: {
    diente: number | null;
    arcada: Arcada | null;
    rol: RolDeUnidad;
    /** Clave de la tarifa que se aplicó; null si no había. */
    tarifa: string | null;
    nombre: string | null;
    /** null: se cotiza aparte. 0: va incluida. */
    precioCentavos: number | null;
    incluida: boolean;
  }[];
  subtotalCentavos: number;
  /** null: el catálogo no tiene recargo para ese plazo (ver `recargoPorConfirmar`). */
  recargoPct: number | null;
  recargoCentavos: number;
  recargoPorConfirmar: boolean;
  totalCentavos: number;
  /** Líneas que no tienen precio y no cuentan en el total. */
  sinPrecio: number;
  /** "AAAA-MM-DD". Un estimado: la fecha comprometida la da el laboratorio al aceptar. */
  fechaEstimada: string | null;
  /** Primer día posible cuando el plazo es un rango. */
  fechaDesde: string | null;
};

export function aCotizacionGuardada(
  c: Cotizacion,
  eleccion: Extract<EleccionDeEntrega, { ok: true }>,
  calculadaEn: Date,
): CotizacionGuardada {
  const { entrega } = eleccion;
  return {
    version: 1,
    calculadaEn: calculadaEn.toISOString(),
    entregaRapida: eleccion.rapida,
    llegada: c.llegada.fecha,
    lineas: c.lineas.map((l) => ({
      diente: l.diente,
      arcada: l.arcada,
      rol: l.rol,
      tarifa: l.tarifa?.clave ?? null,
      nombre: l.tarifa?.nombre ?? null,
      precioCentavos: l.precioCentavos,
      incluida: l.incluida,
    })),
    subtotalCentavos: c.subtotalCentavos,
    recargoPct: entrega.recargoPct,
    recargoCentavos: entrega.recargoCentavos,
    recargoPorConfirmar: entrega.recargoPorConfirmar,
    totalCentavos: entrega.totalCentavos,
    sinPrecio: c.sinPrecio,
    fechaEstimada: entrega.fecha,
    fechaDesde: entrega.desde,
  };
}
