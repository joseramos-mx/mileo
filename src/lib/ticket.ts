import "server-only";
import { prisma } from "@/lib/prisma";
import { calcularFechaDeEntrega } from "@/lib/etapas";
import { seFabrica } from "@/lib/trabajos";
import {
  INDICACIONES,
  MATERIALES,
  PRIORIDADES,
  ROLES_DE_UNIDAD,
  nombreDelColor,
} from "@/lib/vocabulario";
import type { RolDeUnidad } from "@/generated/prisma/enums";

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
  const esPuente = caso.tramos.length > 0 || piezas.some((u) => u.tramoId !== null);
  const primerRol = piezas[0]?.rol
    ? ROLES_DE_UNIDAD[piezas[0].rol].split(" ")[0]
    : INDICACIONES[caso.indicacion].nombre;
  const tipoTrabajo = esPuente ? "Puente" : primerRol;
  const rangoDientes = resumirDientes(
    piezas.map((u) => u.diente).filter((d): d is number => d !== null),
  );
  const textoUnidades =
    cuantas === 1 ? "1 unidad" : `${cuantas} unidades`;
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

  // Fecha de creación y de entrega (si aún no está aceptado, estima desde enviadoEn/creadoEn a las 13:00)
  const fechaBase = caso.enviadoEn ?? caso.creadoEn;
  const fechaEntregaEstimada =
    caso.fechaEntregaComprometida ??
    (() => {
      const f = calcularFechaDeEntrega(caso.indicacion, fechaBase);
      f.setHours(13, 0, 0, 0);
      return f;
    })();

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
    fechaEntrega: formatearFechaHoraTicket(fechaEntregaEstimada),
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
    // Si la Raspberry Pi está apagada o en modo cola (polling), quedará pendiente
    // en /api/impresora/pendientes para imprimirse en cuanto conecte.
    return false;
  }
}

