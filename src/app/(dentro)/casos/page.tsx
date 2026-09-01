import type { Metadata } from "next";
import { exigirUsuario, esDelLaboratorio } from "@/lib/autorizacion";
import {
  casosQueLeTocan,
  casosEnCurso,
  borradoresDeLaClinica,
  casosEntregados,
} from "@/lib/casos";
import { TarjetaDeCaso, type CasoParaTarjeta } from "@/componentes/TarjetaDeCaso";
import { TablaDeBorradores } from "@/componentes/TablaDeBorradores";
import { EstadoVacio } from "@/componentes/EstadoVacio";
import { ListaConEntrada } from "@/componentes/ListaConEntrada";
import { REJILLA_DE_CASOS } from "@/componentes/RejillaDeCasos";
import { BotonEnlace } from "@/componentes/Boton";

export const metadata: Metadata = { title: "Casos · Mileo" };

export default async function PaginaDeCasos() {
  const usuario = await exigirUsuario();
  const delLaboratorio = esDelLaboratorio(usuario);

  const [leTocan, enCurso, borradores, entregados] = await Promise.all([
    casosQueLeTocan(usuario),
    casosEnCurso(usuario),
    borradoresDeLaClinica(usuario),
    casosEntregados(usuario),
  ]);

  const grupos: { titulo: string; casos: CasoParaTarjeta[] }[] = [
    {
      titulo: delLaboratorio ? "Esperan al doctor" : "Le toca a usted",
      casos: leTocan,
    },
    {
      titulo: delLaboratorio ? "En el taller" : "En el laboratorio",
      casos: enCurso,
    },
    { titulo: "Entregados", casos: entregados },
  ].filter((grupo) => grupo.casos.length > 0);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-titulo font-semibold text-primario">
          {delLaboratorio ? "Casos" : "Mis casos"}
        </h1>
        {!delLaboratorio ? (
          <BotonEnlace href="/casos/nuevo" tono="principal">
            Crear caso
          </BotonEnlace>
        ) : null}
      </header>

      {borradores.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-subtitulo font-semibold text-primario">
            Sin terminar de capturar
          </h2>
          <TablaDeBorradores borradores={borradores} />
        </section>
      ) : null}

      {grupos.length === 0 && borradores.length === 0 ? (
        <EstadoVacio
          titulo={
            delLaboratorio
              ? "Todavía no llega ningún caso"
              : "Aquí van a aparecer sus casos"
          }
          explicacion={
            delLaboratorio
              ? "En cuanto una clínica mande un caso, aparece aquí para revisarlo."
              : "Cree un caso y suba el escaneo desde el equipo que ya tiene. Recibo STL, PLY, OBJ, DICOM y ZIP."
          }
          accion={
            delLaboratorio ? undefined : (
              <BotonEnlace href="/casos/nuevo" tono="principal" tamano="grande">
                Crear mi primer caso
              </BotonEnlace>
            )
          }
        />
      ) : (
        grupos.map((grupo) => (
          <section key={grupo.titulo} className="flex flex-col gap-3">
            <h2 className="text-subtitulo font-semibold text-primario">
              {grupo.titulo}
            </h2>
            <ListaConEntrada className={REJILLA_DE_CASOS}>
              {grupo.casos.map((caso) => (
                <TarjetaDeCaso key={caso.id} caso={caso} />
              ))}
            </ListaConEntrada>
          </section>
        ))
      )}
    </div>
  );
}
