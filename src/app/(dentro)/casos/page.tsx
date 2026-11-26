import type { Metadata } from "next";
import { exigirUsuario, esDelLaboratorio } from "@/lib/autorizacion";
import {
  casosQueLeTocan,
  casosEnCurso,
  borradoresDeLaClinica,
  casosEntregados,
} from "@/lib/casos";
import { ListaDeCasos } from "./ListaDeCasos";

export const metadata: Metadata = { title: "Casos · Mileo" };

export default async function PaginaDeCasos({
  searchParams,
}: PageProps<"/casos">) {
  const usuario = await exigirUsuario();
  const delLaboratorio = esDelLaboratorio(usuario);
  const consulta = await searchParams;
  const busquedaInicial =
    typeof consulta.buscar === "string" ? consulta.buscar : "";

  const [leTocan, enCurso, borradores, entregados] = await Promise.all([
    casosQueLeTocan(usuario),
    casosEnCurso(usuario),
    borradoresDeLaClinica(usuario),
    casosEntregados(usuario),
  ]);

  return (
    <ListaDeCasos
      delLaboratorio={delLaboratorio}
      leTocan={leTocan}
      enCurso={enCurso}
      entregados={entregados}
      borradores={borradores}
      busquedaInicial={busquedaInicial}
    />
  );
}
