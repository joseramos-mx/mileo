import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/sesion";
import {
  diapositivasDeLaPortada,
  marcasDeLaPortada,
} from "@/lib/entrada-servidor";
import { RUTA_DE_ENTRADA } from "@/lib/rutas-publicas";
import { Marca } from "@/componentes/Marca";
import { CarruselDeEntrada } from "@/componentes/CarruselDeEntrada";
import { MarcasCompatibles } from "@/componentes/MarcasCompatibles";
import { FormularioDeRegistro } from "./FormularioDeRegistro";

export const metadata: Metadata = { title: "Crear cuenta · Mileo" };

/**
 * El registro de clínicas. Mismo marco que la portada: formulario a la
 * izquierda sobre fondo oscuro, y a la derecha el panel con la foto y las
 * marcas compatibles. Siempre oscuro, igual que la portada.
 */
export default async function PaginaDeRegistro() {
  if (await usuarioActual()) redirect("/");

  const diapositivas = diapositivasDeLaPortada();
  const marcas = marcasDeLaPortada();

  return (
    <main className="siempre-oscuro grid h-dvh grid-cols-1 overflow-hidden bg-app lg:grid-cols-2">
      {/* --- El formulario ------------------------------------------------ */}
      {/* Se desplaza por dentro si hace falta, para que con el texto al 200%
          siga alcanzándose todo sin que se mueva la pantalla entera (§7). */}
      <div className="flex justify-center overflow-y-auto px-6 py-10">
        <div className="my-auto w-full max-w-xs">
          <div className="flex justify-center">
            <Marca tamano="grande" />
          </div>

          <FormularioDeRegistro />

          <p className="mt-8 text-center text-menor text-secundario">
            ¿Ya tiene cuenta?{" "}
            <Link
              className="font-medium text-primario underline underline-offset-4"
              href={RUTA_DE_ENTRADA}
            >
              Inicie sesión
            </Link>
          </p>
        </div>
      </div>

      {/* --- El panel ------------------------------------------------------ */}
      <div className="hidden py-2 lg:flex">
        <div className="flex flex-1 flex-col overflow-hidden rounded-l-panel">
          <CarruselDeEntrada diapositivas={diapositivas} />
          <MarcasCompatibles marcas={marcas} />
        </div>
      </div>
    </main>
  );
}
