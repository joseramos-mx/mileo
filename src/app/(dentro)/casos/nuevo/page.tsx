import type { Metadata } from "next";
import Link from "next/link";
import { exigirUsuario } from "@/lib/autorizacion";
import { FormularioDeCaso } from "./FormularioDeCaso";

export const metadata: Metadata = { title: "Crear caso · Mileo" };

/**
 * Alta de caso, primer paso (SKILL.md O-2).
 *
 * El orden de la cascada es exacto: indicación → diente → tipo → material →
 * color. Aquí va la indicación; el diente y lo demás vienen en la siguiente
 * pantalla, ya con el odontograma.
 *
 * Celular primero: se usa de pie, con prisa, a veces con guantes (§6.2).
 */
export default async function PaginaDeCasoNuevo() {
  await exigirUsuario();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <header>
        <Link
          href="/"
          className="text-menor text-enlace underline underline-offset-4"
        >
          Regresar al inicio
        </Link>
        <h1 className="mt-2 text-titulo font-semibold text-primario">
          Crear caso
        </h1>
        <p className="mt-1 text-cuerpo text-secundario">
          Paso 1 de 2. Guardo lo que escriba conforme avanza; si se sale, lo
          encuentra igual.
        </p>
      </header>

      <FormularioDeCaso />
    </div>
  );
}
