import type { Metadata } from "next";
import Link from "next/link";
import { exigirUsuario } from "@/lib/autorizacion";
import { siguienteFolioDePaciente } from "@/lib/casos";
import { PasosDelCaso, pasosDelAlta } from "@/componentes/PasosDelCaso";
import { FormularioDeCaso } from "./FormularioDeCaso";

export const metadata: Metadata = { title: "Crear caso · Mileo" };

/**
 * Alta de caso, primer paso (SKILL.md O-2).
 *
 * Alta de caso, paso 1: de quién es el caso.
 *
 * Sólo el paciente. Lo que se le va a hacer se captura diente por diente en el
 * paso 2, con el odontograma y el catálogo completo enfrente; preguntar aquí
 * "qué necesita" era pedir el mismo dato dos veces y en desorden.
 *
 * Celular primero: se usa de pie, con prisa, a veces con guantes (§6.2).
 */
export default async function PaginaDeCasoNuevo() {
  const usuario = await exigirUsuario();
  const folioSugerido = usuario.clinicaId
    ? await siguienteFolioDePaciente(usuario.clinicaId)
    : "1";

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

      <FormularioDeCaso folioSugerido={folioSugerido} />
    </div>
  );
}
