"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  crearClienteSupabaseAdmin,
  crearClienteSupabaseServidor,
} from "@/lib/supabase/servidor";
import { registrarEvento } from "@/lib/bitacora";
import { ROLES } from "@/lib/vocabulario";

export type ResultadoDeInvitacion = {
  error?: string;
  errores?: Record<string, string>;
};

const esquema = z
  .object({
    token: z.string().min(10),
    nombreCompleto: z
      .string()
      .trim()
      .min(3, "Escriba su nombre como quiere que lo vea el laboratorio.")
      .max(120),
    telefono: z
      .string()
      .trim()
      .max(20)
      .optional()
      .transform((v) => (v ? v : undefined)),
    contrasena: z
      .string()
      .min(8, "Su contraseña necesita al menos 8 caracteres."),
    repetida: z.string(),
  })
  .refine((datos) => datos.contrasena === datos.repetida, {
    path: ["repetida"],
    message: "Las dos contraseñas no son iguales.",
  });

/**
 * Nace una cuenta (SKILL.md O-1).
 *
 * Es la única puerta: sin una invitación vigente no se puede crear una cuenta
 * en Mileo. Primero se da de alta en Supabase Auth desde el servidor y en
 * seguida se registra en Usuario marcando el vale como usado dentro de la
 * misma transacción.
 */
export async function aceptarInvitacion(
  _anterior: ResultadoDeInvitacion,
  datos: FormData,
): Promise<ResultadoDeInvitacion> {
  const leido = esquema.safeParse({
    token: datos.get("token"),
    nombreCompleto: datos.get("nombreCompleto"),
    telefono: datos.get("telefono") || undefined,
    contrasena: datos.get("contrasena"),
    repetida: datos.get("repetida"),
  });

  if (!leido.success) {
    const errores: Record<string, string> = {};
    for (const problema of leido.error.issues) {
      errores[String(problema.path[0])] = problema.message;
    }
    return { errores };
  }

  const invitacion = await prisma.invitacion.findUnique({
    where: { token: leido.data.token },
  });

  if (!invitacion || invitacion.aceptadaEn || invitacion.expiraEn < new Date()) {
    return {
      error:
        "Esta invitación ya no sirve. Pídale otra a quien se la mandó y se la genera en un minuto.",
    };
  }

  const yaExiste = await prisma.usuario.findUnique({
    where: { correo: invitacion.correo },
  });
  if (yaExiste) {
    return {
      error: "Ese correo ya tiene cuenta en Mileo. Entre con su contraseña.",
    };
  }

  const supabaseAdmin = crearClienteSupabaseAdmin();
  const { data: altaAuth, error: errorAuth } =
    await supabaseAdmin.auth.admin.createUser({
      email: invitacion.correo,
      password: leido.data.contrasena,
      email_confirm: true,
      user_metadata: {
        nombreCompleto: leido.data.nombreCompleto,
      },
    });

  if (errorAuth || !altaAuth.user) {
    return {
      error:
        "No pude activar su cuenta con ese correo. Si ya tenía acceso antes, entre con su contraseña.",
    };
  }

  try {
    await prisma.$transaction(async (bd) => {
      const creado = await bd.usuario.create({
        data: {
          supabaseId: altaAuth.user.id,
          correo: invitacion.correo,
          nombreCompleto: leido.data.nombreCompleto,
          telefono: leido.data.telefono ?? null,
          rol: invitacion.rol,
          clinicaId: invitacion.clinicaId,
          invitadoPorId: invitacion.creadaPorId,
        },
      });

      // El mismo vale no sirve dos veces: se marca usado aquí dentro.
      await bd.invitacion.update({
        where: { id: invitacion.id, aceptadaEn: null },
        data: { aceptadaEn: new Date() },
      });

      await registrarEvento(bd, {
        tipo: "USUARIO_INVITADO",
        resumen: `${creado.nombreCompleto} aceptó su invitación y entró como ${ROLES[creado.rol].toLowerCase()}.`,
        usuarioId: creado.id,
        datos: { correo: creado.correo, rol: creado.rol },
      });
    });
  } catch (error) {
    await supabaseAdmin.auth.admin.deleteUser(altaAuth.user.id);
    throw error;
  }

  const supabase = await crearClienteSupabaseServidor();
  await supabase.auth.signInWithPassword({
    email: invitacion.correo,
    password: leido.data.contrasena,
  });

  // El aviso de privacidad se pide en el primer ingreso, no aquí: así queda
  // registrado con la cuenta ya creada, con su fecha y su versión.
  redirect("/aviso-de-privacidad");
}
