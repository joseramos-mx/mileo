import type { Metadata } from "next";
import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { exigirUsuario, esDelLaboratorio } from "@/lib/autorizacion";
import { casosQueLeTocan, borradoresDeLaClinica } from "@/lib/casos";
import {
  casosEnCurso,
  disenosRecientes,
  escanerDeLaClinica,
} from "@/lib/inicio";
import { RENDERS_3D } from "@/lib/entrada";
import { PanelDeBienvenida } from "@/componentes/PanelDeBienvenida";
import { TarjetaDeEscaner } from "@/componentes/TarjetaDeEscaner";
import { TarjetaDeDiseno } from "@/componentes/TarjetaDeDiseno";
import { TarjetaDeCaso } from "@/componentes/TarjetaDeCaso";
import { TablaDeBorradores } from "@/componentes/TablaDeBorradores";
import { EstadoVacio } from "@/componentes/EstadoVacio";
import { BotonEnlace } from "@/componentes/Boton";
import { RequiereAtencion } from "@/app/(dentro)/RequiereAtencion";

export const metadata: Metadata = { title: "Inicio · Mileo" };

/**
 * El inicio del doctor (SKILL.md §6.10).
 *
 * No es un tablero: es una bandeja de pendientes. Lo más grande de la pantalla
 * dice cuántos casos necesitan de él; abajo, el estado de sus casos y lo último
 * que pasó con cada diseño. Nada que no pueda accionar.
 *
 * En escritorio el panel de bienvenida y el recuadro de abajo llenan
 * exactamente lo que queda de ventana: el recuadro se estira a lo que sobra y
 * lo que no cabe se desplaza dentro de sus columnas, en vez de alargar la
 * página. Los borradores quedan después del recuadro.
 */
export default async function PaginaDeInicio() {
  const usuario = await exigirUsuario();

  // El laboratorio abre en "requiere atención": es su primera pantalla de la
  // mañana (O-5).
  if (esDelLaboratorio(usuario)) return <RequiereAtencion />;

  const [leTocan, borradores, enCurso, disenos, escaner] = await Promise.all([
    casosQueLeTocan(usuario),
    borradoresDeLaClinica(usuario),
    casosEnCurso(usuario),
    disenosRecientes(usuario),
    escanerDeLaClinica(usuario),
  ]);

  const nombreDePila = usuario.nombreCompleto.split(" ")[0];
  const sinNada =
    leTocan.length === 0 && enCurso.length === 0 && borradores.length === 0;

  // Qué renders 3D ya entregó el equipo de diseño. Se pregunta una vez, aquí,
  // y no una vez por tarjeta.
  const renders = Object.fromEntries(
    RENDERS_3D.map((render) => [
      render.ruta,
      fs.existsSync(path.join(process.cwd(), "public", render.ruta)),
    ]),
  );

  if (sinNada) {
    return (
      <div className="flex flex-col gap-4">
        <PanelDeBienvenida
          nombreDePila={nombreDePila}
          cuantosLeTocan={0}
          puedeCrearCasos
          renders={renders}
        />
        <EstadoVacio
          titulo="Aquí van a aparecer sus casos"
          explicacion={
            "Para empezar, cree un caso y suba el escaneo desde el equipo que ya tiene. " +
            "Mileo recibe STL, PLY, OBJ, DICOM y ZIP, venga de la marca que venga."
          }
          accion={
            <BotonEnlace href="/casos/nuevo" tono="principal" tamano="grande">
              Crear mi primer caso
            </BotonEnlace>
          }
          ayuda={
            <Link
              className="text-enlace underline underline-offset-4"
              href="/ayuda/guias-de-exportacion"
            >
              Ver cómo exportar desde mi escáner
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Lo que cabe en una pantalla: la bienvenida y el recuadro. */}
      <div className="flex flex-col gap-4 lg:h-[calc(100dvh-6rem)]">
        <PanelDeBienvenida
          nombreDePila={nombreDePila}
          cuantosLeTocan={leTocan.length}
          puedeCrearCasos
          renders={renders}
        />

        <div className="grid grid-cols-1 gap-3 border-t border-borde pt-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[19rem_minmax(0,1fr)_23.75rem]">
          <TarjetaDeEscaner escaner={escaner} />

          {/* Lo último que pasó con cada diseño. */}
          <div className="flex min-w-0 flex-col gap-3 overflow-y-auto sin-barra">
            {disenos.length === 0 ? (
              <p className="rounded-contenedor bg-superficie p-6 text-cuerpo text-secundario">
                Todavía no hay diseños en curso. En cuanto su técnico termine
                uno, se lo mando aquí para que lo apruebe.
              </p>
            ) : (
              disenos.map((diseno) => (
                <TarjetaDeDiseno key={diseno.casoId} diseno={diseno} />
              ))
            )}
          </div>

          {/* El estado de cada caso, con la misma tarjeta que en todas las
              demás pantallas. Lo que no cabe se desplaza dentro de la columna. */}
          <aside
            aria-labelledby="en-curso"
            className="flex min-w-0 flex-col gap-3 overflow-y-auto sin-barra"
          >
            <h2 id="en-curso" className="sr-only">
              Sus casos en curso
            </h2>

            {enCurso.map((caso) => (
              <TarjetaDeCaso key={caso.id} caso={caso} className="shrink-0" />
            ))}

            <Link
              href="/casos"
              className="alto-tactil relative inline-flex w-fit shrink-0 items-center rounded-full bg-accion px-6 text-cuerpo font-medium text-sobre-accion transition-colors duration-150 hover:bg-accion-encima"
            >
              Ver mis casos
              {leTocan.length > 0 ? (
                <>
                  <span
                    aria-hidden="true"
                    className="absolute -top-1 -right-1 size-3 rounded-full bg-pendiente"
                  />
                  <span className="sr-only">
                    , {leTocan.length} necesitan de usted
                  </span>
                </>
              ) : null}
            </Link>
          </aside>
        </div>
      </div>

      {/* Los borradores van después del recuadro, no adentro. */}
      {borradores.length > 0 ? (
        <section
          aria-labelledby="borradores"
          className="flex flex-col gap-3 border-t border-borde pt-4"
        >
          <div>
            <h2
              id="borradores"
              className="text-subtitulo font-semibold text-primario"
            >
              Sin terminar de capturar
            </h2>
            <p className="text-menor text-secundario">
              Guardé lo que llevaba. Puede continuar donde se quedó.
            </p>
          </div>
          <TablaDeBorradores borradores={borradores} />
        </section>
      ) : null}
    </div>
  );
}
