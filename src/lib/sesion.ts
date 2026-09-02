import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { Rol } from "@/generated/prisma/enums";

/**
 * Sesiones de Mileo (SKILL.md O-1).
 *
 * La cookie sólo lleva un identificador aleatorio; en la base se guarda su
 * hash. Así, ni con acceso de lectura a la base se pueden suplantar sesiones, y
 * cerrar sesión o dar de baja a alguien surte efecto de inmediato.
 */

const NOMBRE_COOKIE = "mileo_sesion";
const DIAS_DE_VIGENCIA = 30;

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

function hashDelToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function abrirSesion(usuarioId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiraEn = new Date(
    Date.now() + DIAS_DE_VIGENCIA * 24 * 60 * 60 * 1000,
  );

  await prisma.sesion.create({
    data: { usuarioId, tokenHash: hashDelToken(token), expiraEn },
  });

  const almacen = await cookies();
  almacen.set(NOMBRE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiraEn,
  });
}

export async function cerrarSesion() {
  const almacen = await cookies();
  const token = almacen.get(NOMBRE_COOKIE)?.value;
  if (token) {
    await prisma.sesion.deleteMany({ where: { tokenHash: hashDelToken(token) } });
  }
  almacen.delete(NOMBRE_COOKIE);
}

/**
 * Quién está usando Mileo en esta petición, o null.
 * Se memoriza por petición: varias partes de la pantalla pueden preguntarlo sin
 * pegarle a la base cada vez.
 */
export const usuarioActual = cache(
  async (): Promise<UsuarioEnSesion | null> => {
    const almacen = await cookies();
    const token = almacen.get(NOMBRE_COOKIE)?.value;
    if (!token) return null;

    const sesion = await prisma.sesion.findUnique({
      where: { tokenHash: hashDelToken(token) },
      include: { usuario: true },
    });

    if (!sesion || sesion.expiraEn < new Date()) return null;
    if (!sesion.usuario.activo) return null;

    const { usuario } = sesion;
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
