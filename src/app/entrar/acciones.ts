"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { crearClienteSupabaseServidor } from "@/lib/supabase/servidor";
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

  const supabase = await crearClienteSupabaseServidor();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: leido.data.correo,
    password: leido.data.contrasena,
  });

  if (error || !data.user) {
    return { error: noCoincide };
  }

  let usuario = await prisma.usuario.findUnique({
    where: { supabaseId: data.user.id },
  });

  if (!usuario) {
    const porCorreo = await prisma.usuario.findUnique({
      where: { correo: leido.data.correo },
    });
    if (porCorreo && !porCorreo.supabaseId) {
      usuario = await prisma.usuario.update({
        where: { id: porCorreo.id },
        data: { supabaseId: data.user.id },
      });
    }
  }

  if (!usuario || !usuario.activo) {
    await supabase.auth.signOut();
    return { error: noCoincide };
  }

  await registrarEvento(prisma, {
    tipo: "USUARIO_INGRESO",
    resumen: `${usuario.nombreCompleto} entró a Mileo.`,
    usuarioId: usuario.id,
  });

  redirect("/");
}
