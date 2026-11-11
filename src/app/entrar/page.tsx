import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/sesion";
import { RUTA_DE_REGISTRO } from "@/lib/rutas-publicas";
import { Marca } from "@/componentes/Marca";
import { PortadaDividida } from "@/componentes/PortadaDividida";
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

  return (
    <PortadaDividida>
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

      {/* Más ancha que el formulario: en una línea, centrada por igual a los
          dos lados. En un celular angosto sí se parte, para no salirse. */}
      <p className="mt-8 flex justify-center text-center text-menor text-secundario sm:-mx-12">
        <span className="sm:whitespace-nowrap">
          ¿No tiene cuenta?{" "}
          <Link
            className="font-medium text-primario underline underline-offset-4"
            href={RUTA_DE_REGISTRO}
          >
            Cree una
          </Link>{" "}
          y haga su primer pedido hoy.
        </span>
      </p>
    </PortadaDividida>
  );
}
