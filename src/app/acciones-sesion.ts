"use server";

import { redirect } from "next/navigation";
import { cerrarSesion } from "@/lib/sesion";

/** Salir siempre disponible, desde cualquier pantalla (SKILL.md §6.9). */
export async function salir() {
  await cerrarSesion();
  redirect("/entrar");
}
