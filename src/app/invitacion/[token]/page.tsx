import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/vocabulario";
import { Marca } from "@/componentes/Marca";
import { FormularioDeInvitacion } from "./FormularioDeInvitacion";

export const metadata: Metadata = { title: "Su invitación · Mileo" };

/**
 * Aceptar una invitación (SKILL.md O-1).
 *
 * En Mileo se entra sólo por invitación: no existe registro abierto. Esta es la
 * única pantalla donde nace una cuenta, y sólo con un vale vigente que el
 * laboratorio, o el doctor para su asistente, generó antes.
 */
export default async function PaginaDeInvitacion({
  params,
}: PageProps<"/invitacion/[token]">) {
  const { token } = await params;

  const invitacion = await prisma.invitacion.findUnique({
    where: { token },
    include: {
      creadaPor: { select: { nombreCompleto: true } },
      clinica: { select: { nombre: true } },
    },
  });

  if (!invitacion) notFound();

  const vencida = invitacion.expiraEn < new Date();
  const yaAceptada = invitacion.aceptadaEn !== null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <Marca />

      {yaAceptada || vencida ? (
        <>
          <h1 className="text-titulo font-semibold text-primario">
            {yaAceptada
              ? "Esta invitación ya se usó"
              : "Esta invitación ya venció"}
          </h1>
          <p className="text-cuerpo text-secundario">
            {yaAceptada
              ? "La cuenta ya existe. Entre con su correo y su contraseña."
              : "Las invitaciones duran 14 días. Pídale otra a quien se la mandó y se la genera en un minuto."}
          </p>
          <a
            href="/entrar"
            className="text-cuerpo text-enlace underline underline-offset-4"
          >
            Ir a la pantalla de entrada
          </a>
        </>
      ) : (
        <>
          <div>
            <h1 className="text-titulo font-semibold text-primario">
              {invitacion.creadaPor.nombreCompleto} lo invitó a Mileo
            </h1>
            <p className="mt-2 text-cuerpo text-secundario">
              Su cuenta va a ser de {ROLES[invitacion.rol].toLowerCase()}
              {invitacion.clinica ? ` en ${invitacion.clinica.nombre}` : ""}.
              Escoja una contraseña y ya puede entrar.
            </p>
          </div>

          <FormularioDeInvitacion
            token={token}
            correo={invitacion.correo}
            rol={invitacion.rol}
          />
        </>
      )}
    </main>
  );
}
