import type { Metadata } from "next";
import Link from "next/link";
import { exigirUsuario } from "@/lib/autorizacion";
import { EstadoVacio } from "@/componentes/EstadoVacio";

export const metadata: Metadata = { title: "Facturación · Mileo" };

/**
 * Facturación (O-9).
 *
 * Va después del piloto con los tres doctores. SKILL.md §11 lo dice claro:
 * construir esto antes de tener sus comentarios es un antipatrón. La sección
 * está en la navegación porque el diseño entregado la enseña, y la pantalla
 * dice la verdad en vez de fingir datos.
 */
export default async function PaginaFacturacion() {
  await exigirUsuario();

  return (
    <EstadoVacio
      titulo="Su estado de cuenta llega después del piloto"
      explicacion="Aquí va a ver su estado de cuenta del mes, con el desempeño del laboratorio: cuántos casos salieron a tiempo y cuántos se rehicieron. Un adeudo nunca detiene un caso."
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
