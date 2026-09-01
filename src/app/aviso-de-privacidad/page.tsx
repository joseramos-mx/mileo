import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { usuarioActual } from "@/lib/sesion";
import { registrarEvento } from "@/lib/bitacora";
import { VERSION_AVISO_PRIVACIDAD } from "@/lib/autorizacion";
import { Marca } from "@/componentes/Marca";
import { Boton } from "@/componentes/Boton";

export const metadata: Metadata = { title: "Aviso de privacidad · Mileo" };

/**
 * Aviso de privacidad aceptado al primer ingreso, con fecha y versión
 * registradas (SKILL.md O-1). Queda además un evento en la bitácora.
 */
async function aceptar() {
  "use server";

  const usuario = await usuarioActual();
  if (!usuario) redirect("/entrar");

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: {
      avisoPrivacidadVersion: VERSION_AVISO_PRIVACIDAD,
      avisoPrivacidadAceptadoEn: new Date(),
    },
  });

  await registrarEvento(prisma, {
    tipo: "AVISO_PRIVACIDAD_ACEPTADO",
    resumen: `${usuario.nombreCompleto} aceptó el aviso de privacidad versión ${VERSION_AVISO_PRIVACIDAD}.`,
    usuarioId: usuario.id,
    datos: { version: VERSION_AVISO_PRIVACIDAD },
  });

  revalidatePath("/", "layout");
  redirect("/");
}

export default async function PaginaDeAviso() {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/entrar");
  if (usuario.avisoPrivacidadVersion === VERSION_AVISO_PRIVACIDAD) redirect("/");

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-6 py-12">
      <Marca />

      <div>
        <h1 className="text-titulo font-semibold text-primario">
          Aviso de privacidad
        </h1>
        <p className="mt-1 text-menor text-secundario">
          Versión {VERSION_AVISO_PRIVACIDAD} · RMS Zahnfacturing, Durango,
          México
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-contenedor border border-borde bg-superficie p-6 text-cuerpo text-secundario">
        <p>
          RMS Zahnfacturing usa los datos de este sistema únicamente para
          fabricar y entregar los casos que usted nos encarga: escaneos,
          archivos de diseño, folio e iniciales del paciente, y la comunicación
          sobre cada caso.
        </p>
        <p>
          El paciente se identifica por folio e iniciales. El nombre completo es
          opcional y sólo se guarda si usted lo escribe.
        </p>
        <p>
          No vendemos ni compartimos sus datos con terceros ajenos a la
          fabricación de sus casos. Puede pedir en cualquier momento el acceso,
          la corrección o el borrado de la información de un paciente
          escribiendo a{" "}
          <a
            className="font-medium text-enlace underline underline-offset-4"
            href="mailto:privacidad@rmszahn.mx"
          >
            privacidad@rmszahn.mx
          </a>
          .
        </p>
        <p>
          Guardamos los archivos de cada caso mientras el caso esté activo y
          durante el periodo de garantía del trabajo. Después se borran.
        </p>
        <p className="text-menor">
          Al aceptar, queda registrada la fecha y la versión de este aviso junto
          a su cuenta.
        </p>
      </div>

      <form action={aceptar} className="flex flex-col gap-3">
        <Boton type="submit" tono="principal" tamano="grande">
          Acepto el aviso de privacidad
        </Boton>
        <a
          href="/salir"
          className="self-center text-menor text-enlace underline underline-offset-4"
        >
          Salir sin aceptar
        </a>
      </form>
    </main>
  );
}
