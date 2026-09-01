import "server-only";
import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { filtroDeCasos } from "@/lib/autorizacion";
import type { UsuarioEnSesion } from "@/lib/sesion";
import type { Etapa, Indicacion } from "@/generated/prisma/enums";
import {
  ETAPAS_DEL_DOCTOR,
  MATERIALES,
  ROLES_DE_UNIDAD,
  leTocaAlDoctor,
} from "@/lib/vocabulario";
import { seFabrica } from "@/lib/trabajos";
import type { RolDeUnidad } from "@/generated/prisma/enums";
import { RENDER_POR_INDICACION } from "@/lib/entrada";
import type { CasoParaTarjeta } from "@/componentes/TarjetaDeCaso";

/** Las etapas en las que el caso está esperando algo del doctor. */
export const ETAPAS_QUE_LE_TOCAN: Etapa[] = ETAPAS_DEL_DOCTOR.filter(
  leTocaAlDoctor,
).concat(["EN_PAUSA", "REHACER"]);

/**
 * Todo lo que la tarjeta de caso necesita, en un solo lugar.
 *
 * Hay una sola tarjeta en todo el sistema, así que hay una sola consulta que la
 * alimenta: si mañana la tarjeta pide un dato más, se agrega aquí y aparece en
 * las cinco pantallas a la vez.
 */
export const seleccionDeTarjeta = {
  id: true,
  folio: true,
  etapa: true,
  indicacion: true,
  fechaEntregaComprometida: true,
  enRiesgo: true,
  paciente: { select: { folio: true, iniciales: true } },
  tecnico: { select: { nombreCompleto: true, fotoUrl: true } },
  unidades: {
    select: { diente: true, rol: true, material: true, color: true },
    orderBy: { diente: "asc" },
  },
} as const;

type UnidadResumible = {
  diente: number;
  rol: string;
  /** Vacío en las anotaciones: un antagonista no se fabrica. */
  material?: string | null;
  color?: string | null;
};

/**
 * Sólo las piezas que el laboratorio va a hacer.
 *
 * El antagonista y el diente vecino se capturan porque el técnico necesita
 * saber que se escanearon, pero no son unidades: contarlos diría que el caso
 * lleva cinco piezas cuando lleva cuatro, y eso acaba en una cuenta mal hecha.
 */
function soloPiezas<T extends { rol: string }>(unidades: T[]) {
  return unidades.filter((u) => seFabrica(u.rol as RolDeUnidad));
}

type CasoCrudo = {
  id: string;
  folio: string;
  etapa: Etapa;
  indicacion: Indicacion;
  fechaEntregaComprometida: Date | null;
  enRiesgo: boolean;
  paciente: { folio: string; iniciales: string };
  tecnico: { nombreCompleto: string; fotoUrl: string | null } | null;
  unidades: UnidadResumible[];
};

/**
 * "3 unidades · Corona, Carilla · Zirconio monolítico" — lo que el doctor
 * necesita para reconocer el caso de un vistazo, sin abrirlo.
 */
export function resumirUnidades(unidades: UnidadResumible[]) {
  const piezas = soloPiezas(unidades);
  if (piezas.length === 0) return "Sin unidades todavía";

  const roles = [
    ...new Set(
      piezas.map((u) => ROLES_DE_UNIDAD[u.rol as keyof typeof ROLES_DE_UNIDAD]),
    ),
  ];
  const materiales = [
    ...new Set(
      piezas
        .map((u) => MATERIALES[u.material as keyof typeof MATERIALES])
        .filter(Boolean),
    ),
  ];

  return [cuantasUnidades(piezas), roles.join(", "), materiales.join(", ")]
    .filter(Boolean)
    .join(" · ");
}

/** "2 unidades" / "1 unidad" */
export function cuantasUnidades(unidades: unknown[]) {
  return unidades.length === 1 ? "1 unidad" : `${unidades.length} unidades`;
}

/** "2 unidades · 14, 15" — el primer renglón de la tarjeta. */
export function unidadesYDientes(unidades: UnidadResumible[]) {
  const piezas = soloPiezas(unidades);
  if (piezas.length === 0) return "Sin unidades todavía";
  return `${cuantasUnidades(piezas)} · ${piezas.map((u) => u.diente).join(", ")}`;
}

/**
 * "Zirconio monolítico A1" — el segundo renglón.
 *
 * Si el caso lleva varios materiales o varios colores se dicen todos: el doctor
 * tiene que poder ver desde la lista que un caso va en dos tonos.
 */
export function materialYColor(unidades: UnidadResumible[]) {
  const piezas = soloPiezas(unidades);
  if (piezas.length === 0) return "Falta escoger el material";

  const materiales = [
    ...new Set(
      piezas
        .map((u) => MATERIALES[u.material as keyof typeof MATERIALES])
        .filter(Boolean),
    ),
  ];
  const colores = [...new Set(piezas.map((u) => u.color).filter(Boolean))];

  return [materiales.join(", "), colores.join(", ")].filter(Boolean).join(" ");
}

/**
 * Qué renders 3D entregó ya el equipo de diseño.
 *
 * Se pregunta al disco una sola vez por petición, no una vez por tarjeta. Donde
 * no hay render, la tarjeta pinta el marco de imagen: nunca un cuadro negro
 * vacío (§9).
 */
const rendersEnDisco = cache(() => {
  const existe = new Map<string, boolean>();
  for (const render of Object.values(RENDER_POR_INDICACION)) {
    if (existe.has(render.ruta)) continue;
    existe.set(
      render.ruta,
      fs.existsSync(path.join(process.cwd(), "public", render.ruta)),
    );
  }
  return existe;
});

export function paraTarjeta(caso: CasoCrudo): CasoParaTarjeta {
  const render = RENDER_POR_INDICACION[caso.indicacion];

  return {
    id: caso.id,
    folio: caso.folio,
    etapa: caso.etapa,
    fechaEntregaComprometida: caso.fechaEntregaComprometida,
    enRiesgo: caso.enRiesgo,
    paciente: caso.paciente,
    unidades: unidadesYDientes(caso.unidades),
    materialYColor: materialYColor(caso.unidades),
    pieza:
      render && rendersEnDisco().get(render.ruta)
        ? { ruta: render.ruta, escala: 0.95 }
        : null,
    tecnico: caso.tecnico
      ? { nombre: caso.tecnico.nombreCompleto, fotoUrl: caso.tecnico.fotoUrl }
      : null,
  };
}

/** Los casos que esperan algo del doctor. Van arriba del todo (§6.10). */
export async function casosQueLeTocan(usuario: UsuarioEnSesion) {
  const casos = await prisma.caso.findMany({
    where: {
      ...filtroDeCasos(usuario),
      esBorrador: false,
      etapa: { in: ETAPAS_QUE_LE_TOCAN },
    },
    select: seleccionDeTarjeta,
    orderBy: [{ enRiesgo: "desc" }, { fechaEntregaComprometida: "asc" }],
  });
  return casos.map(paraTarjeta);
}

/** Los casos que siguen su curso: el doctor no tiene que hacer nada. */
export async function casosEnCurso(usuario: UsuarioEnSesion) {
  const casos = await prisma.caso.findMany({
    where: {
      ...filtroDeCasos(usuario),
      esBorrador: false,
      etapa: { notIn: [...ETAPAS_QUE_LE_TOCAN, "ENTREGADO"] },
    },
    select: seleccionDeTarjeta,
    orderBy: [{ fechaEntregaComprometida: "asc" }],
  });
  return casos.map(paraTarjeta);
}

/** Un caso que la clínica todavía no manda, con todo lo que se capturó. */
export type BorradorDeCaso = {
  id: string;
  folio: string;
  paciente: string;
  indicacion: Indicacion;
  cuantasUnidades: number;
  resumenDeUnidades: string;
  archivos: number;
  actualizadoEn: Date;
};

export async function borradoresDeLaClinica(
  usuario: UsuarioEnSesion,
): Promise<BorradorDeCaso[]> {
  const casos = await prisma.caso.findMany({
    where: { ...filtroDeCasos(usuario), esBorrador: true },
    select: {
      id: true,
      folio: true,
      indicacion: true,
      actualizadoEn: true,
      paciente: { select: { folio: true, iniciales: true } },
      unidades: {
        select: { diente: true, rol: true, material: true },
        orderBy: { diente: "asc" },
      },
      _count: { select: { archivos: true } },
    },
    orderBy: { actualizadoEn: "desc" },
  });

  return casos.map((caso) => ({
    id: caso.id,
    folio: caso.folio,
    paciente: `${caso.paciente.folio} · ${caso.paciente.iniciales}`,
    indicacion: caso.indicacion,
    cuantasUnidades: soloPiezas(caso.unidades).length,
    resumenDeUnidades: resumirUnidades(caso.unidades),
    archivos: caso._count.archivos,
    actualizadoEn: caso.actualizadoEn,
  }));
}

export async function casosEntregados(usuario: UsuarioEnSesion, limite = 20) {
  const casos = await prisma.caso.findMany({
    where: { ...filtroDeCasos(usuario), etapa: "ENTREGADO" },
    select: seleccionDeTarjeta,
    orderBy: { entregadoEn: "desc" },
    take: limite,
  });
  return casos.map(paraTarjeta);
}

/** El folio visible del caso: C-2026-0001. */
export async function siguienteFolio() {
  const anio = new Date().getFullYear();
  const ultimo = await prisma.caso.findFirst({
    where: { folio: { startsWith: `C-${anio}-` } },
    orderBy: { folio: "desc" },
    select: { folio: true },
  });

  const consecutivo = ultimo ? Number(ultimo.folio.split("-")[2]) + 1 : 1;
  return `C-${anio}-${String(consecutivo).padStart(4, "0")}`;
}
