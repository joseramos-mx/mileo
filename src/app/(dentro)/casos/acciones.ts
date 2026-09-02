"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirUsuario, filtroDeCasos } from "@/lib/autorizacion";
import { registrarEvento } from "@/lib/bitacora";
import { siguienteFolio, siguienteFolioDePaciente } from "@/lib/casos";
import { sePuedeEnviar, loQueFalta } from "@/lib/admision";
import { arcadaDe, nombreDelTramo, tramosDe } from "@/lib/tramos";
import {
  TRABAJOS,
  esPontico,
  indicacionDeLasUnidades,
  pregunta,
  puedeSerPilar,
} from "@/lib/trabajos";
import {
  DIENTES_INFERIORES,
  DIENTES_SUPERIORES,
  ARCADAS_EN_PALABRAS,
  MATERIALES,
  METODOS,
  METODOS_POR_MATERIAL,
  ROLES_DE_UNIDAD,
} from "@/lib/vocabulario";

const DIENTES_VALIDOS = [...DIENTES_SUPERIORES, ...DIENTES_INFERIORES];

// ------------------------------------------------------------ crear borrador

const esquemaBorrador = z.object({
  folioPaciente: z
    .string()
    .trim()
    .min(1, "Escriba el folio con el que identifica al paciente.")
    .max(40),
  /**
   * El folio que la pantalla propuso. Sirve para saber si el usuario lo dejó
   * como venía o escribió el suyo.
   */
  folioSugerido: z.string().trim().max(40).optional(),
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
    folioPaciente: datos.get("folioPaciente"),
    folioSugerido: datos.get("folioSugerido") || undefined,
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

  const { iniciales, nombreCompleto, folioSugerido } = leido.data;
  let { folioPaciente } = leido.data;

  // Si dejó el número que le propuse y entre tanto alguien más lo ocupó, tomo
  // el siguiente libre. Si escribió otro, se respeta tal cual: eso es que está
  // volviendo a mandar trabajo del mismo paciente, y el folio es la llave.
  if (folioSugerido && folioPaciente === folioSugerido) {
    const yaEsta = await prisma.paciente.findUnique({
      where: {
        clinicaId_folio: { clinicaId: usuario.clinicaId, folio: folioPaciente },
      },
      select: { id: true },
    });
    if (yaEsta) folioPaciente = await siguienteFolioDePaciente(usuario.clinicaId);
  }

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
      // Arranca en lo más común y se recalcula sola con cada guardado del
      // paso 2, según lo que el doctor vaya capturando.
      indicacion: "CORONA_Y_PUENTE",
      etapa: "RECIBIDO",
      esBorrador: true,
    },
  });

  await registrarEvento(prisma, {
    tipo: "CASO_CREADO",
    resumen: `${usuario.nombreCompleto} empezó el caso ${caso.folio} para el paciente ${paciente.folio}.`,
    casoId: caso.id,
    usuarioId: usuario.id,
    datos: { paciente: paciente.folio },
  });

  redirect(`/casos/${caso.id}/capturar`);
}

// ---------------------------------------------------------------- unidades

const esquemaUnidad = z.object({
  // Vacío en los trabajos de arcada: una guarda no va en un diente.
  diente: z
    .number()
    .int()
    .refine((d) => DIENTES_VALIDOS.includes(d), {
      message: "Ese diente no existe en el odontograma.",
    })
    .nullable(),
  arcada: z.enum(["SUPERIOR", "INFERIOR"]).nullable(),
  rol: z.enum(
    Object.keys(ROLES_DE_UNIDAD) as [keyof typeof ROLES_DE_UNIDAD],
  ),
  material: z
    .enum(Object.keys(MATERIALES) as [keyof typeof MATERIALES])
    .nullable(),
  metodo: z.enum(Object.keys(METODOS) as [keyof typeof METODOS]).nullable(),
  color: z.string().trim().max(12).nullable(),
  notas: z.string().trim().max(500).nullable(),

  esImplante: z.boolean(),
  sistemaImplante: z.string().trim().max(80).nullable(),
  retencion: z.enum(["ATORNILLADA", "CEMENTADA"]).nullable(),
  espesorAlivioMm: z.number().min(0.1).max(3).nullable(),
  grosorMm: z.number().min(0.5).max(6).nullable(),
  colorBase: z.string().trim().max(30).nullable(),
  colorDientes: z.string().trim().max(12).nullable(),
  troqueles: z.boolean(),

  /**
   * La clave del tramo al que pertenece, tal como la armó la pantalla. Aquí se
   * cambia por la del renglón real de Tramo: el cliente no inventa llaves de
   * la base.
   */
  tramoId: z.string().trim().max(60).nullable(),
});

type UnidadLeida = z.infer<typeof esquemaUnidad>;

/** Cómo se nombra la unidad cuando hay que decir dónde está el problema. */
function donde(unidad: UnidadLeida) {
  if (unidad.diente !== null) return `el diente ${unidad.diente}`;
  if (unidad.arcada) return ARCADAS_EN_PALABRAS[unidad.arcada].toLowerCase();
  return TRABAJOS[unidad.rol].nombre.toLowerCase();
}

/**
 * Que cada unidad traiga lo que su tipo de trabajo pide.
 *
 * Los mensajes dicen qué falta y dónde, en lenguaje del consultorio. Nunca
 * "campo requerido" (§6.5).
 */
function revisarCampos(unidades: UnidadLeida[]) {
  for (const unidad of unidades) {
    const tipo = TRABAJOS[unidad.rol];
    const nombre = tipo.nombre.toLowerCase();

    // Donde va: una unidad de diente sin diente, o una de arcada sin arcada,
    // es una unidad que el taller no sabría dónde poner.
    if (tipo.alcance === "ARCADA") {
      if (unidad.diente !== null || unidad.arcada === null) {
        return `${tipo.nombre} va sobre una arcada completa, no sobre un diente.`;
      }
    } else if (unidad.diente === null) {
      return `${tipo.nombre} va sobre un diente y no se dijo cuál.`;
    }

    if (tipo.materiales.length === 0) {
      if (unidad.material !== null) {
        return `${tipo.nombre} no se fabrica, así que no lleva material.`;
      }
    } else {
      if (!unidad.material) {
        return `Falta el material de ${nombre} en ${donde(unidad)}.`;
      }
      if (!tipo.materiales.includes(unidad.material)) {
        return `${MATERIALES[unidad.material]} no aplica para ${nombre}.`;
      }

      // El método sale del material: ninguna máquina del taller cuela resina.
      const metodos = METODOS_POR_MATERIAL[unidad.material];
      if (!unidad.metodo) {
        return `Falta decir con qué se hace ${donde(unidad)}: ${metodos
          .map((m) => METODOS[m].toLowerCase())
          .join(" o ")}.`;
      }
      if (!metodos.includes(unidad.metodo)) {
        return `${MATERIALES[unidad.material]} no se puede ${METODOS[
          unidad.metodo
        ].toLowerCase()}.`;
      }
    }

    if (pregunta(unidad.rol, "color") && !unidad.color) {
      return `Falta el color de ${nombre} en ${donde(unidad)}.`;
    }
    if (pregunta(unidad.rol, "colorBase") && !unidad.colorBase) {
      return `Falta el color de la encía de ${nombre} en ${donde(unidad)}.`;
    }
    if (pregunta(unidad.rol, "colorDientes") && !unidad.colorDientes) {
      return `Falta el color de los dientes de ${nombre} en ${donde(unidad)}.`;
    }
    if (pregunta(unidad.rol, "espesorAlivio") && unidad.espesorAlivioMm === null) {
      return `Falta el espesor del alivio de ${nombre} en ${donde(unidad)}.`;
    }
    if (pregunta(unidad.rol, "grosor") && unidad.grosorMm === null) {
      return `Falta el grosor de ${nombre} en ${donde(unidad)}.`;
    }

    // Sobre implante hay que saber de qué sistema es: sin eso no se pide la
    // pieza, y la corona llega sin con qué atornillarla.
    const sobreImplante = pregunta(unidad.rol, "sistemaImplante") || unidad.esImplante;
    if (sobreImplante && !unidad.sistemaImplante) {
      return `Falta el sistema de implante de ${donde(unidad)}.`;
    }
    if (sobreImplante && !unidad.retencion) {
      return `Falta decir si ${donde(unidad)} va atornillada o cementada.`;
    }
  }

  return null;
}

/**
 * Un tramo tiene que ser un tramo seguido de una misma arcada, con dos
 * unidades o más, algo que se apoye en el diente preparado en las puntas y
 * algo que cuelgue en medio. Si no, no se puede fabricar, y hay que decirlo
 * con palabras del consultorio.
 */
function revisarTramos(unidades: UnidadLeida[]) {
  for (const grupo of tramosDe(
    unidades as unknown as Parameters<typeof tramosDe>[0],
  ).values()) {
    const dientes = grupo.map((u) => u.diente);

    if (grupo.length < 2) {
      return `El diente ${dientes[0]} está unido él solo. Un tramo lleva al menos dos piezas unidas.`;
    }

    const arcada = arcadaDe(dientes[0]);
    if (!arcada || dientes.some((d) => !arcada.includes(d))) {
      return `Un tramo no puede unir la arcada de arriba con la de abajo. Revise los dientes ${dientes.join(", ")}.`;
    }

    const posiciones = dientes.map((d) => arcada.indexOf(d));
    const seguido = posiciones.every(
      (p, i) => i === 0 || p === posiciones[i - 1] + 1,
    );
    if (!seguido) {
      return `El tramo ${nombreDelTramo(grupo)} tiene un hueco. Un tramo une dientes pegados.`;
    }

    // En las puntas va algo que se apoya en un diente preparado; en medio,
    // algo que cuelga. Si no, el tramo no se puede fabricar.
    const malo = grupo.findIndex((u, i) => {
      const enLaPunta = i === 0 || i === grupo.length - 1;
      return enLaPunta ? !puedeSerPilar(u.rol) : !esPontico(u.rol);
    });
    if (malo !== -1) {
      const enLaPunta = malo === 0 || malo === grupo.length - 1;
      const tipo = TRABAJOS[grupo[malo].rol].nombre.toLowerCase();
      return enLaPunta
        ? `En el tramo ${nombreDelTramo(grupo)}, el diente ${dientes[malo]} está en la punta: ahí va algo que se apoye en el diente preparado, no ${tipo}.`
        : `En el tramo ${nombreDelTramo(grupo)}, el diente ${dientes[malo]} va en medio: ahí va algo que cuelgue, no ${tipo}.`;
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

  const malCampo = revisarCampos(leido.data);
  if (malCampo) return { error: malCampo };

  const malPuente = revisarTramos(leido.data);
  if (malPuente) return { error: malPuente };

  await prisma.$transaction(async (bd) => {
    // Se rehace el caso completo: las unidades y sus puentes salen y entran
    // juntos, así no queda un puente apuntando a un diente que ya no está.
    await bd.unidad.deleteMany({ where: { casoId: caso.id } });
    await bd.tramo.deleteMany({ where: { casoId: caso.id } });

    // La pantalla manda su propia clave de puente; aquí se cambia por la del
    // renglón real. El cliente nunca escribe una llave de la base.
    const clavesDeLaPantalla = [
      ...new Set(
        leido.data.map((u) => u.tramoId).filter((c): c is string => Boolean(c)),
      ),
    ];
    const tramoReal = new Map<string, string>();
    for (const clave of clavesDeLaPantalla) {
      const puente = await bd.tramo.create({
        data: { casoId: caso.id },
        select: { id: true },
      });
      tramoReal.set(clave, puente.id);
    }

    if (leido.data.length > 0) {
      await bd.unidad.createMany({
        data: leido.data.map((u) => ({
          ...u,
          casoId: caso.id,
          tramoId: u.tramoId ? (tramoReal.get(u.tramoId) ?? null) : null,
        })),
      });
    }

    await bd.caso.update({
      where: { id: caso.id },
      data: {
        actualizadoEn: new Date(),
        // La indicación resume lo capturado, y de ella sale el kit que va en
        // la caja: se recalcula aquí para que no se quede en lo que se dijo
        // al principio.
        indicacion: indicacionDeLasUnidades(leido.data),
      },
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
      unidades: { select: { id: true, rol: true } },
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

// ------------------------------------------------------- catalogo del doctor

/**
 * Enciende o apaga el catalogo completo para quien esta capturando.
 *
 * Se guarda en su perfil y no en la pantalla: quien trabaja con el catalogo
 * entero lo hace siempre, y volver a encenderlo en cada caso seria pedirselo
 * cada vez.
 */
export async function cambiarCatalogo(completo: boolean) {
  const usuario = await exigirUsuario();
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { catalogoCompleto: completo },
  });
}
