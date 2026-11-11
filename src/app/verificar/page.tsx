import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { usuarioActual } from "@/lib/sesion";
import { RUTA_DE_REGISTRO } from "@/lib/rutas-publicas";
import { Marca } from "@/componentes/Marca";
import { PortadaDividida } from "@/componentes/PortadaDividida";
import { FormularioDeVerificacion } from "./FormularioDeVerificacion";

export const metadata: Metadata = { title: "Confirmar correo · Mileo" };

/**
 * A donde llega la persona desde el correo de confirmación. Mismo marco que la
 * portada y el registro.
 */
export default async function PaginaDeVerificacion({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string }>;
}) {
  if (await usuarioActual()) redirect("/");

  const { token_hash: codigo } = await searchParams;

  return (
    <PortadaDividida>
      <div className="flex justify-center">
        <Marca tamano="grande" />
      </div>

      {codigo ? (
        <>
          <h1 className="mt-12 text-center text-titulo font-normal text-primario">
            Confirme su correo
          </h1>
          <p className="mt-2 text-center text-menor text-secundario">
            Un clic más y su cuenta queda lista.
          </p>
          <FormularioDeVerificacion codigo={codigo} />
        </>
      ) : (
        <>
          <h1 className="mt-12 text-center text-titulo font-normal text-primario">
            Este enlace no es válido
          </h1>
          <p className="mt-2 text-center text-menor text-secundario">
            Abra el enlace desde el correo que le mandamos, o{" "}
            <Link
              className="font-medium text-primario underline underline-offset-4"
              href={RUTA_DE_REGISTRO}
            >
              regístrese de nuevo
            </Link>
            .
          </p>
        </>
      )}
    </PortadaDividida>
  );
}
