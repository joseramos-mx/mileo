"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  exigirUsuario,
  puedeInvitar,
  rolesQuePuedeInvitar,
} from "@/lib/autorizacion";
import { registrarEvento } from "@/lib/bitacora";
import { ROLES } from "@/lib/vocabulario";
import { avisoDeInvitacion, encolarAviso } from "@/lib/avisos";
import type { Rol } from "@/generated/prisma/enums";

export type Resultado = { error?: string; listo?: string };

function urlBaseDeMileo() {
  if (process.env.MILEO_URL) return process.env.MILEO_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "";
}

/** Avisos configurables por el doctor (SKILL.md O-3). */
export async function guardarAvisos(
  porCorreo: boolean,
  porWhatsapp: boolean,
): Promise<Resultado> {
  const usuario = await exigirUsuario();

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { avisoPorCorreo: porCorreo, avisoPorWhatsapp: porWhatsapp },
  });

  revalidatePath("/configuracion");
  return { listo: "Guardado." };
}

const esquemaInvitacion = z.object({
  correo: z.string().trim().toLowerCase().email("Escriba un correo válido."),
  rol: z.enum(["ADMIN", "LABORATORIO", "CLINICA"]),
  clinicaId: z.string().trim().optional(),
  nombreClinica: z.string().trim().max(120).optional(),
});

/**
 * Alta sólo por invitación (SKILL.md O-1). No existe registro abierto: quien no
 * tenga una invitación vigente no puede crearse una cuenta.
 */
export async function invitar(
  _anterior: Resultado,
  datos: FormData,
): Promise<Resultado> {
  const usuario = await exigirUsuario();
  if (!puedeInvitar(usuario)) {
    return { error: "Su cuenta no puede invitar a nadie." };
  }

  const leido = esquemaInvitacion.safeParse({
    correo: datos.get("correo"),
    rol: datos.get("rol"),
    clinicaId: datos.get("clinicaId") || undefined,
    nombreClinica: datos.get("nombreClinica") || undefined,
  });
  if (!leido.success) {
    return { error: leido.error.issues[0].message };
  }

  const rol: Rol = leido.data.rol;
  if (!rolesQuePuedeInvitar(usuario).includes(rol)) {
    return { error: "No puede invitar a alguien con ese rol." };
  }

  const yaExiste = await prisma.usuario.findUnique({
    where: { correo: leido.data.correo },
  });
  if (yaExiste) {
    return { error: "Ese correo ya tiene cuenta en Mileo." };
  }

  let clinicaId: string | null = null;
  if (rol === "CLINICA") {
    if (usuario.rol === "CLINICA") {
      clinicaId = usuario.clinicaId;
    } else if (leido.data.clinicaId && leido.data.clinicaId !== "__nueva__") {
      clinicaId = leido.data.clinicaId;
    } else {
      const nombre = leido.data.nombreClinica?.trim();
      if (!nombre || nombre.length < 2) {
        return {
          error: "Escriba el nombre de la clínica o consultorio a invitar.",
        };
      }
      const nuevaClinica = await prisma.clinica.create({
        data: { nombre },
      });
      clinicaId = nuevaClinica.id;
    }
  }

  const invitacion = await prisma.invitacion.create({
    data: {
      correo: leido.data.correo,
      rol,
      clinicaId,
      token: crypto.randomBytes(24).toString("base64url"),
      expiraEn: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      creadaPorId: usuario.id,
    },
  });

  await registrarEvento(prisma, {
    tipo: "USUARIO_INVITADO",
    resumen: `${usuario.nombreCompleto} invitó a ${invitacion.correo} como ${ROLES[rol].toLowerCase()}.`,
    usuarioId: usuario.id,
    datos: { correo: invitacion.correo, rol },
  });

  // La invitación tiene que llegarle a la persona. Se encola aquí y el guion
  // de entrega la manda; si el proveedor está caído, no se pierde.
  const enlace = `${urlBaseDeMileo()}/invitacion/${invitacion.token}`;
  await encolarAviso(
    prisma,
    { correo: invitacion.correo },
    {
      ...avisoDeInvitacion(usuario.nombreCompleto, enlace),
      distintivo: invitacion.id,
    },
  );

  revalidatePath("/configuracion");
  return {
    listo:
      `Listo. Le mandé la invitación a ${invitacion.correo}; vence en 14 días. ` +
      `Si prefiere pasársela usted, el enlace es ${enlace}`,
  };
}
