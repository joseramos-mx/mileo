"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirUsuario, filtroDeCasos } from "@/lib/autorizacion";
import { registrarEvento } from "@/lib/bitacora";
import { siguienteFolio } from "@/lib/casos";
import { sePuedeEnviar, loQueFalta } from "@/lib/admision";
import { arcadaDe, nombreDelPuente, puentesDe } from "@/lib/puentes";
import {
  DIENTES_INFERIORES,
  DIENTES_SUPERIORES,
  INDICACIONES,
  MATERIALES,
  MATERIALES_POR_ROL,
  ROLES_DE_UNIDAD,
} from "@/lib/vocabulario";

const DIENTES_VALIDOS = [...DIENTES_SUPERIORES, ...DIENTES_INFERIORES];

// ------------------------------------------------------------ crear borrador

const esquemaBorrador = z.object({
  indicacion: z.enum(
    Object.keys(INDICACIONES) as [keyof typeof INDICACIONES],
  ),
  folioPaciente: z
    .string()
    .trim()
    .min(1, "Escriba el folio con el que identifica al paciente.")
    .max(40),
  iniciales: z
    .string()
    .trim()
    .min(2, "Escriba al menos dos iniciales.")
    .max(10),
  nombreCompleto: z.string().trim().max(120).optional(),
});

export type ResultadoDeBorrador = {
  error?: string;
  errores?: Record<string, string>;
};

export async function crearBorrador(
  _anterior: ResultadoDeBorrador,
  datos: FormData,
): Promise<ResultadoDeBorrador> {
  const usuario = await exigirUsuario();

  if (!usuario.clinicaId) {
    return {
      error:
        "Su cuenta todavía no está ligada a una clínica. Escríbanos y lo resolvemos.",
    };
  }

  const leido = esquemaBorrador.safeParse({
    indicacion: datos.get("indicacion"),
    folioPaciente: datos.get("folioPaciente"),
    iniciales: datos.get("iniciales"),
    nombreCompleto: datos.get("nombreCompleto") || undefined,
  });

  if (!leido.success) {
    const errores: Record<string, string> = {};
    for (const problema of leido.error.issues) {
      errores[String(problema.path[0])] = problema.message;
    }
    return { errores };
  }

  const { indicacion, folioPaciente, iniciales, nombreCompleto } = leido.data;

  // El doctor del caso es quien lo crea si es doctor; si es la asistente, el
  // doctor de su clínica.
  const doctorId =
    usuario.rol === "DOCTOR"
      ? usuario.id
      : (
          await prisma.usuario.findFirst({
            where: { clinicaId: usuario.clinicaId, rol: "DOCTOR" },
            select: { id: true },
          })
        )?.id;

  if (!doctorId) {
    return {
      error: "No encuentro al doctor de su clínica. Escríbanos y lo resolvemos.",
    };
  }

  const paciente = await prisma.paciente.upsert({
    where: {
      clinicaId_folio: { clinicaId: usuario.clinicaId, folio: folioPaciente },
    },
    update: { iniciales, ...(nombreCompleto ? { nombreCompleto } : {}) },
    create: {
      clinicaId: usuario.clinicaId,
      folio: folioPaciente,
      iniciales,
      nombreCompleto: nombreCompleto ?? null,
    },
  });

  const caso = await prisma.caso.create({
    data: {
      folio: await siguienteFolio(),
      clinicaId: usuario.clinicaId,
      doctorId,
      creadoPorId: usuario.id,
      pacienteId: paciente.id,
      indicacion,
      etapa: "RECIBIDO",
      esBorrador: true,
    },
  });

  await registrarEvento(prisma, {
    tipo: "CASO_CREADO",
    resumen: `${usuario.nombreCompleto} empezó el caso ${caso.folio} para el paciente ${paciente.folio}.`,
    casoId: caso.id,
    usuarioId: usuario.id,
    datos: { indicacion, paciente: paciente.folio },
  });

  redirect(`/casos/${caso.id}/capturar`);
}

// ---------------------------------------------------------------- unidades

const esquemaUnidad = z.object({
  diente: z.number().int().refine((d) => DIENTES_VALIDOS.includes(d), {
    message: "Ese diente no existe en el odontograma.",
  }),
  rol: z.enum(
    Object.keys(ROLES_DE_UNIDAD) as [keyof typeof ROLES_DE_UNIDAD],
  ),
  material: z.enum(Object.keys(MATERIALES) as [keyof typeof MATERIALES]),
  color: z.string().trim().max(8).nullable(),
  notas: z.string().trim().max(500).nullable(),
  /**
   * La clave del puente al que pertenece, tal como la armó la pantalla. Aquí
   * se cambia por la del renglón real de Puente: el cliente no inventa llaves
   * de la base.
   */
  puenteId: z.string().trim().max(60).nullable(),
});

/**
 * Un puente tiene que ser un tramo seguido de una misma arcada, con dos
 * unidades o más, pilares en los extremos y pónticos en medio. Si no, el caso
 * no se puede fabricar y hay que decirlo con palabras del consultorio.
 */
function revisarPuentes(
  unidades: { diente: number; rol: string; puenteId: string | null }[],
) {
  for (const grupo of puentesDe(
    unidades as Parameters<typeof puentesDe>[0],
  ).values()) {
    const dientes = grupo.map((u) => u.diente);

    if (grupo.length < 2) {
      return `El diente ${dientes[0]} está marcado como puente él solo. Un puente lleva al menos dos piezas unidas.`;
    }

    const arcada = arcadaDe(dientes[0]);
    if (!arcada || dientes.some((d) => !arcada.includes(d))) {
      return `Un puente no puede unir la arcada de arriba con la de abajo. Revise los dientes ${dientes.join(", ")}.`;
    }

    const posiciones = dientes.map((d) => arcada.indexOf(d));
    const seguido = posiciones.every(
      (p, i) => i === 0 || p === posiciones[i - 1] + 1,
    );
    if (!seguido) {
      return `El puente ${nombreDelPuente(grupo)} tiene un hueco. Un puente une dientes pegados.`;
    }

    const esperado = grupo.map((_, i) =>
      i === 0 || i === grupo.length - 1 ? "PILAR" : "PONTICO",
    );
    const malo = grupo.findIndex((u, i) => u.rol !== esperado[i]);
    if (malo !== -1) {
      return esperado[malo] === "PILAR"
        ? `En el puente ${nombreDelPuente(grupo)}, el diente ${dientes[malo]} está en la punta: tiene que ser pilar.`
        : `En el puente ${nombreDelPuente(grupo)}, el diente ${dientes[malo]} va en medio: tiene que ser póntico.`;
    }
  }

  return null;
}

export type ResultadoDeUnidades = { error?: string; guardadoEn?: string };

/**
 * Guarda las unidades del caso. Se llama sola mientras se captura: el borrador
 * nunca se pierde (§6.6).
 */
export async function guardarUnidades(
  casoId: string,
  unidades: unknown,
): Promise<ResultadoDeUnidades> {
  const usuario = await exigirUsuario();

  const caso = await prisma.caso.findFirst({
    where: { id: casoId, ...filtroDeCasos(usuario) },
    select: { id: true, folio: true, esBorrador: true },
  });
  if (!caso) return { error: "No encuentro ese caso." };
  if (!caso.esBorrador) {
    return { error: "Este caso ya está en el laboratorio y no se puede editar." };
  }

  const leido = z.array(esquemaUnidad).max(32).safeParse(unidades);
  if (!leido.success) {
    return { error: "Revise que cada diente tenga rol y material." };
  }

  // Que el material corresponda al rol: la cascada también se valida aquí,
  // no sólo en la pantalla.
  for (const unidad of leido.data) {
    if (!MATERIALES_POR_ROL[unidad.rol].includes(unidad.material)) {
      return {
        error: `${MATERIALES[unidad.material]} no aplica para ${ROLES_DE_UNIDAD[unidad.rol]}.`,
      };
    }
  }

  const malPuente = revisarPuentes(leido.data);
  if (malPuente) return { error: malPuente };

  await prisma.$transaction(async (bd) => {
    // Se rehace el caso completo: las unidades y sus puentes salen y entran
    // juntos, así no queda un puente apuntando a un diente que ya no está.
    await bd.unidad.deleteMany({ where: { casoId: caso.id } });
    await bd.puente.deleteMany({ where: { casoId: caso.id } });

    // La pantalla manda su propia clave de puente; aquí se cambia por la del
    // renglón real. El cliente nunca escribe una llave de la base.
    const clavesDeLaPantalla = [
      ...new Set(
        leido.data.map((u) => u.puenteId).filter((c): c is string => Boolean(c)),
      ),
    ];
    const puenteReal = new Map<string, string>();
    for (const clave of clavesDeLaPantalla) {
      const puente = await bd.puente.create({
        data: { casoId: caso.id },
        select: { id: true },
      });
      puenteReal.set(clave, puente.id);
    }

    if (leido.data.length > 0) {
      await bd.unidad.createMany({
        data: leido.data.map((u) => ({
          ...u,
          casoId: caso.id,
          puenteId: u.puenteId ? (puenteReal.get(u.puenteId) ?? null) : null,
        })),
      });
    }

    await bd.caso.update({
      where: { id: caso.id },
      data: { actualizadoEn: new Date() },
    });
  });

  revalidatePath(`/casos/${caso.id}/capturar`);
  return { guardadoEn: new Date().toISOString() };
}

// ------------------------------------------------------------- enviar caso

export async function enviarCaso(casoId: string): Promise<{ error?: string }> {
  const usuario = await exigirUsuario();

  const caso = await prisma.caso.findFirst({
    where: { id: casoId, ...filtroDeCasos(usuario) },
    select: {
      id: true,
      folio: true,
      esBorrador: true,
      indicacion: true,
      unidades: { select: { id: true } },
      archivos: { select: { tipo: true, estado: true } },
    },
  });

  if (!caso) return { error: "No encuentro ese caso." };
  if (!caso.esBorrador) return { error: "Este caso ya está en el laboratorio." };

  // La misma lista que ve la pantalla. Imposible saltarla desde la API.
  if (!sePuedeEnviar(caso)) {
    const falta = loQueFalta(caso)
      .map((punto) => punto.titulo.toLowerCase())
      .join(", ");
    return { error: `Todavía me falta ${falta}.` };
  }

  await prisma.$transaction(async (bd) => {
    await bd.caso.update({
      where: { id: caso.id },
      data: { esBorrador: false, enviadoEn: new Date(), etapa: "RECIBIDO" },
    });

    await registrarEvento(bd, {
      tipo: "CASO_ENVIADO",
      resumen: `${usuario.nombreCompleto} envió el caso ${caso.folio} al laboratorio, con ${caso.unidades.length} unidades.`,
      casoId: caso.id,
      usuarioId: usuario.id,
      etapaNueva: "RECIBIDO",
    });
  });

  revalidatePath("/", "layout");
  redirect(`/casos/${caso.id}?enviado=1`);
}
