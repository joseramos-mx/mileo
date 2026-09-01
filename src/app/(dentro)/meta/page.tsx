import type { Metadata } from "next";
import Link from "next/link";
import { exigirUsuario } from "@/lib/autorizacion";
import { EstadoVacio } from "@/componentes/EstadoVacio";

export const metadata: Metadata = { title: "Meta · Mileo" };

/**
 * Meta (O-8).
 *
 * Va después del piloto con los tres doctores. SKILL.md §11 lo dice claro:
 * construir esto antes de tener sus comentarios es un antipatrón. La sección
 * está en la navegación porque el diseño entregado la enseña, y la pantalla
 * dice la verdad en vez de fingir datos.
 */
export default async function PaginaMeta() {
  await exigirUsuario();

  return (
    <EstadoVacio
      titulo="Su meta del mes llega después del piloto"
      explicacion="Aquí va a ver sus puntos del mes, cuánto le falta para la meta y qué caso se la completa. Lo abrimos en cuanto terminen las primeras semanas de prueba con los doctores del piloto."
      ayuda={
        <Link
          className="text-enlace underline underline-offset-4"
          href="/ayuda"
        >
          Escribirle al laboratorio
        </Link>
      }
    />
  );
}
