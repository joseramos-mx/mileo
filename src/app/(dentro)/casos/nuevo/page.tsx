import type { Metadata } from "next";
import Link from "next/link";
import { exigirUsuario } from "@/lib/autorizacion";
import { PasosDelCaso, pasosDelAlta } from "@/componentes/PasosDelCaso";
import { FormularioDeCaso } from "./FormularioDeCaso";

export const metadata: Metadata = { title: "Crear caso · Mileo" };

/**
 * Alta de caso, primer paso (SKILL.md O-2).
 *
 * Alta de caso, paso 1: el paciente y la indicación.
 *
 * El orden de la cascada es exacto: indicación → diente → tipo → material →
 * color. Aquí va la indicación; el diente y lo demás vienen en el paso 2, ya
 * con el odontograma, y los archivos en el 3.
 *
 * Celular primero: se usa de pie, con prisa, a veces con guantes (§6.2).
 */
export default async function PaginaDeCasoNuevo() {
  await exigirUsuario();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Link
          href="/"
          className="text-menor text-enlace underline underline-offset-4"
        >
          Regresar al inicio
        </Link>

        <PasosDelCaso pasos={pasosDelAlta()} actual={1} />

        <div>
          <h1 className="text-titulo font-semibold text-primario">
            Crear caso
          </h1>
          <p className="mt-1 text-cuerpo text-secundario">
            Guardo lo que escriba conforme avanza; si se sale, lo encuentra
            igual.
          </p>
        </div>
      </header>

      <FormularioDeCaso />
    </div>
  );
}
