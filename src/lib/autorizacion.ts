import "server-only";
import { redirect } from "next/navigation";
import { usuarioActual, type UsuarioEnSesion } from "@/lib/sesion";
import type { Rol } from "@/generated/prisma/enums";

/**
 * Quién puede hacer qué (SKILL.md O-1).
 *
 * Los permisos existen desde el inicio aunque el laboratorio hoy sean cuatro
 * personas que rotan de rol. Todas las reglas viven aquí para que ninguna
 * pantalla invente la suya.
 */

export const VERSION_AVISO_PRIVACIDAD = "2026-01";

export const ROLES_DEL_LABORATORIO: Rol[] = [
  "ADMISION",
  "DISENO",
  "MANUFACTURA",
  "ACABADO",
  "CALIDAD",
  "DIRECCION",
];

export const ROLES_DE_LA_CLINICA: Rol[] = ["DOCTOR", "ASISTENTE"];

export function esDelLaboratorio(usuario: UsuarioEnSesion) {
  return ROLES_DEL_LABORATORIO.includes(usuario.rol);
}

export function esDeLaClinica(usuario: UsuarioEnSesion) {
  return ROLES_DE_LA_CLINICA.includes(usuario.rol);
}

/** Sólo el doctor aprueba diseños. La asistente sube y consulta (O-1). */
export function puedeAprobarDisenos(usuario: UsuarioEnSesion) {
  return usuario.rol === "DOCTOR";
}

/** La asistente no ve facturación (O-1). */
export function puedeVerFacturacion(usuario: UsuarioEnSesion) {
  return usuario.rol === "DOCTOR" || usuario.rol === "DIRECCION";
}

/** El doctor puede invitar asistentes a su propia clínica (O-1). */
export function puedeInvitar(usuario: UsuarioEnSesion) {
  return usuario.rol === "DOCTOR" || usuario.rol === "DIRECCION";
}

/** A qué roles puede invitar cada quien. No existe registro abierto. */
export function rolesQuePuedeInvitar(usuario: UsuarioEnSesion): Rol[] {
  if (usuario.rol === "DIRECCION") {
    return [...ROLES_DEL_LABORATORIO, "DOCTOR"];
  }
  if (usuario.rol === "DOCTOR") return ["ASISTENTE"];
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
 * Un doctor no ve casos de otro (criterio de aceptación de O-1); el laboratorio
 * los ve todos.
 */
export function filtroDeCasos(usuario: UsuarioEnSesion) {
  if (esDelLaboratorio(usuario)) return {};
  if (usuario.rol === "DOCTOR") return { doctorId: usuario.id };
  // La asistente ve los casos de su clínica, no los de otra.
  return { clinicaId: usuario.clinicaId ?? "sin-clinica" };
}
