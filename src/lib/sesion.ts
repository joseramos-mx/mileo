import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { crearClienteSupabaseServidor } from "@/lib/supabase/servidor";
import type { Rol } from "@/generated/prisma/enums";

/**
 * Sesiones de Mileo sobre Supabase Auth (SKILL.md O-1).
 *
 * Supabase Auth valida y refresca el token criptográfico en cookies; aquí se
 * cruza contra `Usuario` en PostgreSQL para traer el rol (`ADMIN`,
 * `LABORATORIO` o `CLINICA`), su clínica y comprobar que siga activo.
 */

export type UsuarioEnSesion = {
  id: string;
  correo: string;
  nombreCompleto: string;
  rol: Rol;
  clinicaId: string | null;
  fotoUrl: string | null;
  avisoPrivacidadAceptadoEn: Date | null;
  avisoPrivacidadVersion: string | null;
  /** Si ve el catalogo entero de trabajos o la lista corta. */
  catalogoCompleto: boolean;
};

export async function cerrarSesion() {
  const supabase = await crearClienteSupabaseServidor();
  await supabase.auth.signOut();
}

/**
 * Quién está usando Mileo en esta petición, o null.
 * Se memoriza por petición: varias partes de la pantalla pueden preguntarlo sin
 * pegarle a Supabase ni a la base cada vez.
 */
export const usuarioActual = cache(
  async (): Promise<UsuarioEnSesion | null> => {
    const supabase = await crearClienteSupabaseServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    let usuario = await prisma.usuario.findUnique({
      where: { supabaseId: user.id },
    });

    // Si la cuenta ya existía en Usuario y es su primer ingreso tras enlazar
    // Supabase Auth, se guarda su supabaseId para siempre.
    if (!usuario && user.email) {
      const porCorreo = await prisma.usuario.findUnique({
        where: { correo: user.email.toLowerCase() },
      });
      if (porCorreo && !porCorreo.supabaseId) {
        usuario = await prisma.usuario.update({
          where: { id: porCorreo.id },
          data: { supabaseId: user.id },
        });
      }
    }

    if (!usuario || !usuario.activo) return null;

    return {
      id: usuario.id,
      correo: usuario.correo,
      nombreCompleto: usuario.nombreCompleto,
      rol: usuario.rol,
      clinicaId: usuario.clinicaId,
      fotoUrl: usuario.fotoUrl,
      avisoPrivacidadAceptadoEn: usuario.avisoPrivacidadAceptadoEn,
      avisoPrivacidadVersion: usuario.avisoPrivacidadVersion,
      catalogoCompleto: usuario.catalogoCompleto,
    };
  },
);
