// Sin "server-only" a proposito: este modulo lo usan tanto la aplicacion
// como los guiones de cron (vigilar-riesgos, enviar-avisos), que corren
// en Node y no dentro de Next.
import type { ClienteBd } from "@/lib/bitacora";
import type { CanalDeAviso, Etapa, TipoDeAviso } from "@/generated/prisma/enums";
import { ETAPAS } from "@/lib/vocabulario";
import { fechaCorta, cuandoFalta } from "@/lib/fechas";

/**
 * Avisos al doctor (SKILL.md O-3).
 *
 * Tres reglas que este módulo hace cumplir solo:
 *
 * 1. **Máximo uno por etapa.** Cada aviso lleva una clave única formada por
 *    persona, caso, tipo y etapa. Encolar dos veces el mismo aviso no manda dos
 *    mensajes, corra el vigilante las veces que corra. Notificar diez veces por
 *    caso hasta que el doctor apaga los avisos es un antipatrón (§11).
 * 2. **Configurable por el doctor.** Si apagó un canal, el aviso se guarda como
 *    omitido en vez de mandarse: queda el registro de que se decidió no
 *    molestarlo, no un hueco.
 * 3. **Cada mensaje dice qué sigue y cuándo, con fecha concreta.** Nada de
 *    "pronto" ni "a la brevedad" (§8).
 *
 * Mileo habla en primera persona. Nunca finge ser una persona: las personas
 * firman con su nombre en el chat del caso.
 */

/** A quién va el aviso: a una cuenta, o a un correo que todavía no la tiene. */
export type Destinatario =
  | { usuarioId: string }
  | { correo: string; telefono?: string | null };

export type DatosDelAviso = {
  casoId?: string | null;
  tipo: TipoDeAviso;
  /**
   * Entra en la clave de idempotencia. Normalmente es la etapa del caso, que
   * es lo que hace cumplir "maximo un aviso por etapa"; los recordatorios de
   * aprobacion le agregan las horas, porque hay uno a las 24 y otro a las 48.
   */
  distintivo?: string | null;
  asunto: string;
  cuerpo: string;
};

/**
 * Deja el aviso en la cola, por cada canal que la persona tenga encendido.
 * Devuelve cuántos quedaron pendientes de entregar.
 */
export async function encolarAviso(
  bd: ClienteBd,
  destinatario: Destinatario,
  datos: DatosDelAviso,
): Promise<number> {
  let usuarioId: string | null = null;
  let destinoCorreo: string | null = null;
  let destinoTelefono: string | null = null;
  let canales: { canal: CanalDeAviso; encendido: boolean }[];

  if ("usuarioId" in destinatario) {
    const usuario = await bd.usuario.findUnique({
      where: { id: destinatario.usuarioId },
      select: {
        id: true,
        activo: true,
        telefono: true,
        avisoPorCorreo: true,
        avisoPorWhatsapp: true,
      },
    });
    if (!usuario?.activo) return 0;

    usuarioId = usuario.id;
    canales = [
      { canal: "CORREO", encendido: usuario.avisoPorCorreo },
      {
        canal: "WHATSAPP",
        // Sin teléfono no hay WhatsApp que valga.
        encendido: usuario.avisoPorWhatsapp && Boolean(usuario.telefono),
      },
    ];
  } else {
    // Todavía no tiene cuenta: no hay preferencias que respetar, así que va
    // por los canales que se conozcan de él.
    destinoCorreo = destinatario.correo;
    destinoTelefono = destinatario.telefono ?? null;
    canales = [
      { canal: "CORREO", encendido: true },
      { canal: "WHATSAPP", encendido: Boolean(destinoTelefono) },
    ];
  }

  let pendientes = 0;

  for (const { canal, encendido } of canales) {
    const clave = [
      usuarioId ?? destinoCorreo,
      datos.casoId ?? "sin-caso",
      datos.tipo,
      datos.distintivo ?? "sin-distintivo",
      canal,
    ].join(":");

    const creado = await bd.aviso.createMany({
      data: [
        {
          usuarioId,
          destinoCorreo,
          destinoTelefono,
          casoId: datos.casoId ?? null,
          tipo: datos.tipo,
          canal,
          clave,
          asunto: datos.asunto,
          cuerpo: datos.cuerpo,
          estado: encendido ? "PENDIENTE" : "OMITIDO",
        },
      ],
      // Si ya existía, no se hace nada: es el candado de "uno por etapa".
      skipDuplicates: true,
    });

    if (encendido) pendientes += creado.count;
  }

  return pendientes;
}

// ------------------------------------------------------------------ textos

function conFecha(fecha: Date | null) {
  if (!fecha) return "En cuanto acepte el caso le confirmo la fecha.";
  return `Se lo entrego el ${fechaCorta(fecha)}, ${cuandoFalta(fecha)}.`;
}

type CasoParaAviso = {
  id: string;
  folio: string;
  etapa: Etapa;
  fechaEntregaComprometida: Date | null;
  paciente: { folio: string; iniciales: string };
};

export function avisoDeCambioDeEtapa(caso: CasoParaAviso): DatosDelAviso {
  const quien = `paciente ${caso.paciente.folio} · ${caso.paciente.iniciales}`;
  const etapa = ETAPAS[caso.etapa];

  return {
    casoId: caso.id,
    tipo:
      caso.etapa === "ESPERANDO_APROBACION"
        ? "ESPERA_SU_APROBACION"
        : "CAMBIO_DE_ETAPA",
    distintivo: caso.etapa,
    asunto: `${etapa.nombre} · ${quien}`,
    cuerpo:
      `${etapa.paraElDoctor} (caso ${caso.folio}, ${quien}). ` +
      conFecha(caso.fechaEntregaComprometida),
  };
}

export function avisoDeRiesgo(
  caso: CasoParaAviso,
  motivo: string,
  fechaNueva: Date | null,
): DatosDelAviso {
  const quien = `paciente ${caso.paciente.folio} · ${caso.paciente.iniciales}`;

  return {
    casoId: caso.id,
    tipo: fechaNueva ? "FECHA_RECORRIDA" : "RIESGO_DE_RETRASO",
    distintivo: caso.etapa,
    asunto: `Le aviso de un retraso · ${quien}`,
    cuerpo: fechaNueva
      ? `${motivo} Le recorro la fecha del caso ${caso.folio} (${quien}) al ` +
        `${fechaCorta(fechaNueva)}, ${cuandoFalta(fechaNueva)}. ` +
        `Si eso no le sirve, dígamelo en el chat del caso y lo resolvemos.`
      : `${motivo} El caso ${caso.folio} (${quien}) va apretado contra su ` +
        `fecha. Se la confirmo o se la recorro hoy mismo, y en cualquier caso ` +
        `se lo digo yo antes de que llegue el día.`,
  };
}

export function avisoDeRecordatorio(
  caso: CasoParaAviso,
  horas: number,
): DatosDelAviso {
  const quien = `paciente ${caso.paciente.folio} · ${caso.paciente.iniciales}`;

  return {
    casoId: caso.id,
    tipo: "RECORDATORIO_DE_APROBACION",
    // La etapa sola no basta: hay recordatorio a las 24 y a las 48 horas.
    distintivo: `${caso.etapa}:${horas}h`,
    asunto: `Su diseño sigue esperándolo · ${quien}`,
    cuerpo:
      `El diseño del caso ${caso.folio} (${quien}) lleva ${horas} horas ` +
      `esperando su aprobación. No fabrico nada sin ella. ` +
      conFecha(caso.fechaEntregaComprometida),
  };
}

export function avisoDeInvitacion(
  nombreDeQuienInvita: string,
  enlace: string,
): DatosDelAviso {
  return {
    tipo: "INVITACION",
    asunto: "Su cuenta de Mileo está lista",
    cuerpo:
      `${nombreDeQuienInvita} le abrió una cuenta en Mileo, la plataforma de ` +
      `casos de RMS Zahnfacturing. Entre aquí y escoja su contraseña: ` +
      `${enlace}. La invitación vence en 14 días.`,
  };
}

/** Encola un aviso ya redactado para alguien con cuenta. */
export async function avisarA(
  bd: ClienteBd,
  usuarioId: string,
  aviso: DatosDelAviso,
) {
  return encolarAviso(bd, { usuarioId }, aviso);
}
