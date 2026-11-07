import "server-only";
import { redirect } from "next/navigation";
import { usuarioActual, type UsuarioEnSesion } from "@/lib/sesion";
import type { Rol } from "@/generated/prisma/enums";

/**
 * Quién puede hacer qué (SKILL.md O-1).
 *
 * Tres roles en toda la plataforma:
 *   - ADMIN: administración general, invitaciones y autorizaciones.
 *   - LABORATORIO: quienes fabrican las piezas (admisión, diseño, taller y calidad).
 *   - CLINICA: dentistas y clínicas que escanean, piden piezas y aprueban diseños.
 */

export const VERSION_AVISO_PRIVACIDAD = "2026-01";

export const ROLES_DEL_LABORATORIO: Rol[] = ["ADMIN", "LABORATORIO"];

export const ROLES_DE_LA_CLINICA: Rol[] = ["CLINICA"];

export function esDelLaboratorio(usuario: UsuarioEnSesion) {
  return ROLES_DEL_LABORATORIO.includes(usuario.rol);
}

export function esDeLaClinica(usuario: UsuarioEnSesion) {
  return ROLES_DE_LA_CLINICA.includes(usuario.rol);
}

/** La clínica aprueba los diseños de sus casos (O-1). */
export function puedeAprobarDisenos(usuario: UsuarioEnSesion) {
  return usuario.rol === "CLINICA";
}

/** Clínica y administración ven facturación (O-1). */
export function puedeVerFacturacion(usuario: UsuarioEnSesion) {
  return usuario.rol === "CLINICA" || usuario.rol === "ADMIN";
}

/** Administración invita a cualquier rol; una clínica puede invitar a colegas de su clínica. */
export function puedeInvitar(usuario: UsuarioEnSesion) {
  return usuario.rol === "ADMIN" || usuario.rol === "CLINICA";
}

/** A qué roles puede invitar cada quien. No existe registro abierto. */
export function rolesQuePuedeInvitar(usuario: UsuarioEnSesion): Rol[] {
  if (usuario.rol === "ADMIN") {
    return ["ADMIN", "LABORATORIO", "CLINICA"];
  }
  if (usuario.rol === "CLINICA") return ["CLINICA"];
  return [];
}

export function puedeMoverEtapas(usuario: UsuarioEnSesion) {
  return esDelLaboratorio(usuario);
}

// ------------------------------------------------------------------ guardas

/**
 * Exige sesión. Si falta el aviso de privacidad, lo pide antes que nada:
 * queda registrado con fecha y versión al primer ingreso (O-1).
 */
export async function exigirUsuario(): Promise<UsuarioEnSesion> {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/entrar");

  if (usuario.avisoPrivacidadVersion !== VERSION_AVISO_PRIVACIDAD) {
    redirect("/aviso-de-privacidad");
  }

  return usuario;
}

export async function exigirRol(roles: Rol[]): Promise<UsuarioEnSesion> {
  const usuario = await exigirUsuario();
  if (!roles.includes(usuario.rol)) redirect("/");
  return usuario;
}

export async function exigirLaboratorio(): Promise<UsuarioEnSesion> {
  return exigirRol(ROLES_DEL_LABORATORIO);
}

/**
 * El filtro con el que un usuario puede ver casos.
 * Una clínica nunca ve casos de otra; el laboratorio y administración los ven todos.
 */
export function filtroDeCasos(usuario: UsuarioEnSesion) {
  if (esDelLaboratorio(usuario)) return {};
  if (usuario.clinicaId) return { clinicaId: usuario.clinicaId };
  return { doctorId: usuario.id };
}
