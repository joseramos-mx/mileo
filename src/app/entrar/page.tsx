import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/sesion";
import {
  diapositivasDeLaPortada,
  marcasDeLaPortada,
} from "@/lib/entrada-servidor";
import { Marca } from "@/componentes/Marca";
import { CarruselDeEntrada } from "@/componentes/CarruselDeEntrada";
import { MarcasCompatibles } from "@/componentes/MarcasCompatibles";
import { FormularioDeEntrada } from "./FormularioDeEntrada";

export const metadata: Metadata = { title: "Entrar · Mileo" };

/**
 * La portada de Mileo (SKILL.md O-1).
 *
 * Una sola pantalla, sin desplazamiento: el formulario a la izquierda sobre
 * fondo oscuro, y a la derecha un solo panel recortado —pegado al borde— con la
 * foto arriba y las marcas compatibles abajo.
 *
 * Va siempre oscura, sin importar el tema que tenga puesto la persona: es la
 * portada y ahí no se juzga ningún color. Adentro, Mileo es claro por omisión
 * (§5.1).
 */
export default async function PaginaDeEntrada() {
  if (await usuarioActual()) redirect("/");

  const diapositivas = diapositivasDeLaPortada();
  const marcas = marcasDeLaPortada();

  return (
    <main className="siempre-oscuro grid h-dvh grid-cols-1 overflow-hidden bg-app lg:grid-cols-2">
      {/* --- El formulario ------------------------------------------------ */}
      {/* Se desplaza por dentro si hace falta: con el texto al 200% tiene que
          seguir alcanzándose (§7), sin que la pantalla entera se mueva. */}
      <div className="flex items-center justify-center overflow-y-auto px-6 py-10">
        <div className="w-full max-w-xs">
          <div className="flex justify-center">
            <Marca tamano="grande" />
          </div>

          <h1 className="mt-12 text-center text-titulo font-normal text-primario">
            Inicie sesión en su cuenta
          </h1>
          <p className="mt-2 text-center text-menor text-secundario">
            Escriba sus datos para entrar.
          </p>

          <FormularioDeEntrada />

          <p className="mt-8 text-center text-menor text-secundario">
            ¿No tiene cuenta?{" "}
            <a
              className="font-medium text-primario underline underline-offset-4"
              href="https://wa.me/526181234567"
            >
              Escríbale al laboratorio
            </a>{" "}
            y le mandamos su invitación.
          </p>
        </div>
      </div>

      {/* --- El panel ------------------------------------------------------ */}
      {/* Un solo recorte: redondeado del lado izquierdo, a ras del borde
          derecho. Dentro van la foto y las marcas, sin costura entre las dos. */}
      <div className="hidden py-2 lg:flex">
        <div className="flex flex-1 flex-col overflow-hidden rounded-l-panel">
          <CarruselDeEntrada diapositivas={diapositivas} />
          <MarcasCompatibles marcas={marcas} />
        </div>
      </div>
    </main>
  );
}
