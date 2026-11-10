"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { crearClienteSupabaseServidor } from "@/lib/supabase/servidor";
import { registrarEvento } from "@/lib/bitacora";

export type ResultadoVerificacion = { error?: string };

const enlaceVencido =
  "Este enlace ya se usó o venció. Vuelva a registrarse con el mismo correo y le mandamos otro.";

/**
 * Confirma el correo de una cuenta nueva y la deja entrar.
 *
 * Se hace con un botón y no al abrir el enlace a propósito: muchos correos
 * (Outlook, filtros de la empresa) abren los enlaces por su cuenta para
 * revisarlos, y eso gastaría el enlace de un solo uso antes de que la persona
 * lo abriera.
 */
export async function confirmarCorreo(
  _anterior: ResultadoVerificacion,
  datos: FormData,
): Promise<ResultadoVerificacion> {
  const codigo = String(datos.get("token_hash") ?? "");
  if (!codigo) return { error: enlaceVencido };

  const supabase = await crearClienteSupabaseServidor();
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: codigo,
    type: "signup",
  });

  if (error || !data.user) return { error: enlaceVencido };

  const usuario = await prisma.usuario.findUnique({
    where: { supabaseId: data.user.id },
  });

  if (!usuario) {
    await supabase.auth.signOut();
    return { error: enlaceVencido };
  }

  if (!usuario.activo) {
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { activo: true },
    });

    await registrarEvento(prisma, {
      tipo: "USUARIO_REGISTRADO",
      resumen: `${usuario.nombreCompleto} creó su cuenta en Mileo.`,
      usuarioId: usuario.id,
    });
  }

  redirect("/");
}
