import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/sesion";
import { RUTA_DE_ENTRADA } from "@/lib/rutas-publicas";
import { Marca } from "@/componentes/Marca";
import { PortadaDividida } from "@/componentes/PortadaDividida";
import { FormularioDeRegistro } from "./FormularioDeRegistro";

export const metadata: Metadata = { title: "Crear cuenta · Mileo" };

/**
 * El registro de clínicas. Mismo marco que la portada: formulario a la
 * izquierda sobre fondo oscuro, y a la derecha el panel con la foto y las
 * marcas compatibles. Siempre oscuro, igual que la portada.
 */
export default async function PaginaDeRegistro() {
  if (await usuarioActual()) redirect("/");

  return (
    <PortadaDividida>
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
    </PortadaDividida>
  );
}
