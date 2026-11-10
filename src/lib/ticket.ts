import "server-only";
import { prisma } from "@/lib/prisma";
import { sumarDiasHabiles } from "@/lib/etapas";
import { seFabrica } from "@/lib/trabajos";
import {
  INDICACIONES,
  MATERIALES,
  PRIORIDADES,
  ROLES_DE_UNIDAD,
  nombreDelColor,
} from "@/lib/vocabulario";
import type {
  Indicacion,
  Material,
  MetodoDeFabricacion,
  Prioridad,
  RolDeUnidad,
} from "@/generated/prisma/enums";

export type DatosDelTicket = {
  casoId: string;
  empresa: string;
  fechaCreacion: string;
  folio: string;
  cintillo: string;
  urlQr: string;
  consultorio: string;
  paciente: string;
  trabajo: string;
  colorUnidades: string;
  fechaEnvio: string;
  /** Alias por compatibilidad con agentes externos. */
  fechaEntrega: string;
  pie1: string;
  pie2: string;
};

const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES_CORTOS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

function formatearFechaHoraTicket(fecha: Date): string {
  const diaSemana = DIAS_CORTOS[fecha.getDay()];
  const dia = fecha.getDate();
  const mes = MESES_CORTOS[fecha.getMonth()];
  const horas = String(fecha.getHours()).padStart(2, "0");
  const minutos = String(fecha.getMinutes()).padStart(2, "0");
  return `${diaSemana} ${dia} ${mes} · ${horas}:${minutos}`;
}

function urlBaseDeMileo(): string {
  if (process.env.MILEO_URL) return process.env.MILEO_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

function resumirDientes(dientes: number[]): string {
  if (dientes.length === 0) return "";
  const ordenados = [...new Set(dientes)].sort((a, b) => a - b);
  if (ordenados.length === 1) return `${ordenados[0]}`;
  if (ordenados.length >= 2) {
    return `${ordenados[0]}-${ordenados[ordenados.length - 1]}`;
  }
  return ordenados.join(", ");
}

function mismoDiaCalendario(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Calcula la fecha y hora de ENVÍO según la tabla de tiempos del laboratorio:
 *
 * 1. Zirconia monolítica (corona o puente corto):
 *    - Estándar: 2 días hábiles
 *    - Rápido: Día siguiente (1 día hábil) si llega antes de las 11:00 y el diseño se aprueba ese día
 * 2. Disilicato monolítico:
 *    - Estándar: Día siguiente (1 día hábil)
 *    - Rápido: Mismo día (0 días) si llega antes de las 10:00
 * 3. Impresos (provisionales, guías, modelos):
 *    - Estándar: Día siguiente (1 día hábil)
 *    - Rápido: Mismo día (0 días) si llega antes de mediodía (12:00)
 * 4. Prótesis total impresa:
 *    - Estándar: 2 días hábiles
 *    - Rápido: Día siguiente (1 día hábil) si se imprime en una sola pieza
 * 5. Removible metálico (Ti o CoCr):
 *    - Estándar: 4 a 5 días hábiles (5 días)
 *    - Rápido: 3 días hábiles
 */
export function calcularFechaDeEnvio({
  fechaLlegada,
  indicacion,
  prioridad,
  unidades,
  fechaAprobacion,
}: {
  fechaLlegada: Date;
  indicacion: Indicacion;
  prioridad: Prioridad;
  unidades: {
    rol: RolDeUnidad;
    material: Material | null;
    metodo: MetodoDeFabricacion | null;
    colorBase: string | null;
    colorDientes: string | null;
  }[];
  fechaAprobacion?: Date | null;
}): Date {
  const diaSemana = fechaLlegada.getDay();
  const esDiaHabil = diaSemana !== 0 && diaSemana !== 6;
  const horaLlegada =
    fechaLlegada.getHours() + fechaLlegada.getMinutes() / 60;
  const esRapidoPrioridad = prioridad === "URGENTE" || prioridad === "ALTA";

  const piezas = unidades.filter((u) => seFabrica(u.rol));
  const cuantas = piezas.length || 1;

  const tieneRemovibleMetalico = piezas.some(
    (u) =>
      u.material === "TITANIO" ||
      u.material === "CROMO_COBALTO" ||
      u.rol === "PROTESIS_PARCIAL" ||
      u.rol === "PILAR_DE_BARRA" ||
      u.rol === "SEGMENTO_DE_BARRA",
  );

  const tieneProtesisTotal = piezas.some((u) => u.rol === "PROTESIS_TOTAL");

  const tieneZirconia = piezas.some(
    (u) =>
      u.material === "ZIRCONIO_MONOLITICO" ||
      u.material === "ZIRCONIO_ULTRAFINO" ||
      u.material === "ZIRCONIO_ESTRATIFICADO" ||
      u.material === "ZIRCONIO_SOBRE_TITANIO",
  );

  const tieneDisilicato = piezas.some(
    (u) =>
      u.material === "DISILICATO_DE_LITIO" ||
      u.material === "CERAMICA_PRENSADA",
  );

  const esImpreso =
    indicacion === "PROVISIONAL" ||
    indicacion === "GUARDA_OCLUSAL" ||
    indicacion === "MODELO_3D" ||
    piezas.some(
      (u) =>
        u.metodo === "IMPRESO_3D" ||
        u.material === "RESINA_IMPRESION" ||
        u.material === "PMMA" ||
        u.material === "PMMA_TRANSPARENTE",
    );

  let diasHabiles = 2;

  if (tieneRemovibleMetalico) {
    // Removible metálico (Ti o CoCr): Estándar 4-5 días, Rápido 3 días
    diasHabiles = esRapidoPrioridad ? 3 : 5;
  } else if (tieneProtesisTotal) {
    // Prótesis total impresa: Día siguiente si se imprime en una sola pieza, 2 días estándar
    const enUnaSolaPieza = piezas
      .filter((u) => u.rol === "PROTESIS_TOTAL")
      .every((u) => !u.colorBase || !u.colorDientes);
    diasHabiles = enUnaSolaPieza || esRapidoPrioridad ? 1 : 2;
  } else if (tieneZirconia) {
    // Zirconia monolítica (corona o puente corto <= 4 unidades):
    // Día siguiente si llega antes de las 11:00 y el diseño se aprueba ese día; si no, 2 días hábiles
    const esMonoliticaCorta =
      cuantas <= 4 &&
      piezas.every(
        (u) =>
          !u.material ||
          u.material === "ZIRCONIO_MONOLITICO" ||
          u.material === "ZIRCONIO_ULTRAFINO",
      );
    const llegoAntesDeLas11 = esDiaHabil && horaLlegada < 11;
    // Al crearse el caso hoy antes de las 11:00 (o si ya se aprobó ese mismo día), aplica Día siguiente
    const cumpleAprobacionMismoDia = fechaAprobacion
      ? mismoDiaCalendario(fechaLlegada, fechaAprobacion)
      : mismoDiaCalendario(fechaLlegada, new Date());

    diasHabiles =
      esMonoliticaCorta && llegoAntesDeLas11 && cumpleAprobacionMismoDia
        ? 1
        : 2;
  } else if (tieneDisilicato) {
    // Disilicato monolítico: Mismo día si llega antes de las 10:00; si no, Día siguiente
    const llegoAntesDeLas10 = esDiaHabil && horaLlegada < 10;
    diasHabiles = llegoAntesDeLas10 ? 0 : 1;
  } else if (esImpreso) {
    // Impresos (provisionales, guías, modelos): Mismo día si llega antes de mediodía (12:00); si no, Día siguiente
    const llegoAntesDeMediodia = esDiaHabil && horaLlegada < 12;
    diasHabiles = llegoAntesDeMediodia ? 0 : 1;
  }

  if (diasHabiles === 0 && esDiaHabil) {
    const mismoDia = new Date(fechaLlegada);
    mismoDia.setHours(18, 0, 0, 0);
    return mismoDia;
  }

  const fechaEnvio = sumarDiasHabiles(
    fechaLlegada,
    diasHabiles === 0 ? 1 : diasHabiles,
  );
  fechaEnvio.setHours(13, 0, 0, 0);
  return fechaEnvio;
}

/**
 * Arma los datos exactos del ticket térmico de 80 mm (POS80) para un caso.
 */
export async function armarTicketDelCaso(
  casoId: string,
): Promise<DatosDelTicket | null> {
  const caso = await prisma.caso.findUnique({
    where: { id: casoId },
    include: {
      clinica: { select: { nombre: true } },
      doctor: { select: { nombreCompleto: true } },
      paciente: { select: { folio: true, iniciales: true } },
      unidades: { orderBy: { diente: "asc" } },
      tramos: { select: { id: true } },
      aprobaciones: {
        where: { decision: "APROBADO" },
        orderBy: { creadoEn: "asc" },
        take: 1,
        select: { creadoEn: true },
      },
    },
  });

  if (!caso) return null;

  const piezas = caso.unidades.filter((u) => seFabrica(u.rol as RolDeUnidad));
  const cuantas = piezas.length || caso.unidades.length || 1;

  // Material principal para el cintillo negro superior
  const primerMaterial = piezas.find((u) => u.material)?.material;
  const nombreMaterial = primerMaterial
    ? MATERIALES[primerMaterial].split(" ")[0].toUpperCase()
    : INDICACIONES[caso.indicacion].nombre.toUpperCase();
  const nombrePrioridad = PRIORIDADES[caso.prioridad].toUpperCase();
  const cintillo = `${nombreMaterial} · ${nombrePrioridad}`;

  // Resumen del trabajo: ej. "Puente 3 unidades · 14-16" o "Corona · 16"
  const esPuente =
    caso.tramos.length > 0 || piezas.some((u) => u.tramoId !== null);
  const primerRol = piezas[0]?.rol
    ? ROLES_DE_UNIDAD[piezas[0].rol].split(" ")[0]
    : INDICACIONES[caso.indicacion].nombre;
  const tipoTrabajo = esPuente ? "Puente" : primerRol;
  const rangoDientes = resumirDientes(
    piezas.map((u) => u.diente).filter((d): d is number => d !== null),
  );
  const textoUnidades = cuantas === 1 ? "1 unidad" : `${cuantas} unidades`;
  const trabajo = [
    esPuente || cuantas > 1 ? `${tipoTrabajo} ${textoUnidades}` : tipoTrabajo,
    rangoDientes,
  ]
    .filter(Boolean)
    .join(" · ");

  // Color · Unidades: ej. "A2 · 3 u"
  const primerColor = piezas.find((u) => u.color)?.color;
  const textoColor = primerColor ? nombreDelColor(primerColor) : "S/C";
  const colorUnidades = `${textoColor} · ${cuantas} u`;

  const fechaBase = caso.enviadoEn ?? caso.creadoEn;
  const fechaCalculada = calcularFechaDeEnvio({
    fechaLlegada: fechaBase,
    indicacion: caso.indicacion,
    prioridad: caso.prioridad,
    unidades: caso.unidades,
    fechaAprobacion: caso.aprobaciones[0]?.creadoEn ?? null,
  });

  const textoFechaEnvio = formatearFechaHoraTicket(fechaCalculada);

  return {
    casoId: caso.id,
    empresa: "RMS ZAHNFACTURING",
    fechaCreacion: formatearFechaHoraTicket(fechaBase),
    folio: caso.folio,
    cintillo,
    urlQr: `${urlBaseDeMileo()}/casos/${caso.id}`,
    consultorio: caso.clinica.nombre || caso.doctor.nombreCompleto,
    paciente: caso.paciente.iniciales,
    trabajo,
    colorUnidades,
    fechaEnvio: textoFechaEnvio,
    fechaEntrega: textoFechaEnvio,
    pie1: "Escaneo del doctor",
    pie2: "Escanea el QR en cada estación.",
  };
}

/**
 * Si MILEO_IMPRESORA_URL está configurada (p. ej. IP local o túnel hacia la
 * Raspberry Pi), empuja el ticket de inmediato por HTTP POST sin bloquear el flujo.
 */
export async function empujarTicketARaspberry(casoId: string): Promise<boolean> {
  const url = process.env.MILEO_IMPRESORA_URL;
  if (!url) return false;

  try {
    const ticket = await armarTicketDelCaso(casoId);
    if (!ticket) return false;

    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (process.env.MILEO_IMPRESORA_TOKEN) {
      headers["authorization"] = `Bearer ${process.env.MILEO_IMPRESORA_TOKEN}`;
    }

    const respuesta = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(ticket),
      signal: AbortSignal.timeout(4000),
    });
    return respuesta.ok;
  } catch {
    return false;
  }
}
