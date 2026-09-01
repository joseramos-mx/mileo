import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import {
  exigirUsuario,
  puedeInvitar,
  rolesQuePuedeInvitar,
  VERSION_AVISO_PRIVACIDAD,
} from "@/lib/autorizacion";
import { ROLES } from "@/lib/vocabulario";
import { fechaLarga } from "@/lib/fechas";
import { InterruptorDeTema } from "@/componentes/InterruptorDeTema";
import { Avisos } from "./Avisos";
import { Invitaciones } from "./Invitaciones";

export const metadata: Metadata = { title: "Configuración · Mileo" };

export default async function PaginaDeConfiguracion() {
  const usuario = await exigirUsuario();

  const [completo, invitaciones] = await Promise.all([
    prisma.usuario.findUniqueOrThrow({
      where: { id: usuario.id },
      select: {
        avisoPorCorreo: true,
        avisoPorWhatsapp: true,
        telefono: true,
        clinica: { select: { nombre: true } },
      },
    }),
    puedeInvitar(usuario)
      ? prisma.invitacion.findMany({
          where: { creadaPorId: usuario.id },
          orderBy: { creadoEn: "desc" },
          take: 20,
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-8">
      <h1 className="text-titulo font-semibold text-primario">Configuración</h1>

      <section className="flex flex-col gap-2 rounded-contenedor border border-borde bg-superficie p-5">
        <h2 className="text-subtitulo font-semibold text-primario">Su cuenta</h2>
        <dl className="flex flex-col gap-1 text-cuerpo">
          <div className="flex justify-between gap-3">
            <dt className="text-secundario">Nombre</dt>
            <dd className="text-primario">{usuario.nombreCompleto}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-secundario">Correo</dt>
            <dd className="text-primario">{usuario.correo}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-secundario">Rol</dt>
            <dd className="text-primario">{ROLES[usuario.rol]}</dd>
          </div>
          {completo.clinica ? (
            <div className="flex justify-between gap-3">
              <dt className="text-secundario">Clínica</dt>
              <dd className="text-primario">{completo.clinica.nombre}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-3">
            <dt className="text-secundario">Aviso de privacidad</dt>
            <dd className="text-primario">
              Versión {VERSION_AVISO_PRIVACIDAD}
              {usuario.avisoPrivacidadAceptadoEn
                ? `, aceptado el ${fechaLarga(usuario.avisoPrivacidadAceptadoEn)}`
                : ""}
            </dd>
          </div>
        </dl>
      </section>

      <Avisos
        porCorreo={completo.avisoPorCorreo}
        porWhatsapp={completo.avisoPorWhatsapp}
        telefono={completo.telefono}
      />

      {puedeInvitar(usuario) ? (
        <Invitaciones
          roles={rolesQuePuedeInvitar(usuario)}
          invitaciones={invitaciones.map((i) => ({
            id: i.id,
            correo: i.correo,
            rol: i.rol,
            aceptada: i.aceptadaEn !== null,
            expiraEn: i.expiraEn.toISOString(),
          }))}
        />
      ) : null}

      <section className="flex flex-col items-start gap-3 rounded-contenedor border border-borde bg-superficie p-5">
        <h2 className="text-subtitulo font-semibold text-primario">
          Cómo se ve Mileo
        </h2>
        <p className="text-menor text-secundario">
          El tema claro es el que recomiendo en el consultorio, donde hay mucha
          luz. Las pantallas donde se juzga color se quedan claras de todos
          modos.
        </p>
        <InterruptorDeTema />
      </section>
    </div>
  );
}
