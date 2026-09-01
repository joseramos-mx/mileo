"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { abrirSesion } from "@/lib/sesion";
import { registrarEvento } from "@/lib/bitacora";

/** Validación en el borde: nada entra al sistema sin pasar por un esquema. */
const esquemaEntrada = z.object({
  correo: z.string().trim().toLowerCase().email(),
  contrasena: z.string().min(1),
});

export type ResultadoEntrada = { error?: string };

export async function entrar(
  _anterior: ResultadoEntrada,
  datos: FormData,
): Promise<ResultadoEntrada> {
  const leido = esquemaEntrada.safeParse({
    correo: datos.get("correo"),
    contrasena: datos.get("contrasena"),
  });

  // Un solo mensaje para correo desconocido y contraseña equivocada: decir
  // cuál de los dos falló le regalaría al atacante la lista de doctores.
  const noCoincide =
    "El correo o la contraseña no coinciden. Vuelva a intentarlo.";

  if (!leido.success) return { error: noCoincide };

  const usuario = await prisma.usuario.findUnique({
    where: { correo: leido.data.correo },
  });

  if (!usuario?.hashContrasena || !usuario.activo) {
    // Se gasta el mismo tiempo que en un intento válido para no delatar
    // por la demora si el correo existe.
    await bcrypt.compare(leido.data.contrasena, "$2b$10$" + "x".repeat(53));
    return { error: noCoincide };
  }

  const coincide = await bcrypt.compare(
    leido.data.contrasena,
    usuario.hashContrasena,
  );
  if (!coincide) return { error: noCoincide };

  await abrirSesion(usuario.id);

  await registrarEvento(prisma, {
    tipo: "USUARIO_INGRESO",
    resumen: `${usuario.nombreCompleto} entró a Mileo.`,
    usuarioId: usuario.id,
  });

  redirect("/");
}
