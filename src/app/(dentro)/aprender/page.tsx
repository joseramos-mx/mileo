import type { Metadata } from "next";
import Link from "next/link";
import { exigirUsuario } from "@/lib/autorizacion";
import { EstadoVacio } from "@/componentes/EstadoVacio";

export const metadata: Metadata = { title: "Aprender · Mileo" };

/**
 * Aprender (O-2).
 *
 * Va después del piloto con los tres doctores. SKILL.md §11 lo dice claro:
 * construir esto antes de tener sus comentarios es un antipatrón. La sección
 * está en la navegación porque el diseño entregado la enseña, y la pantalla
 * dice la verdad en vez de fingir datos.
 */
export default async function PaginaAprender() {
  await exigirUsuario();

  return (
    <EstadoVacio
      titulo="Guías para sacarle todo a su escáner"
      explicacion="Por ahora tengo las guías de exportación por marca de escáner. Vaya a Ayuda y las encuentra ahí; pronto sumo los videos del laboratorio."
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
