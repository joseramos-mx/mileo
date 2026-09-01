import { prisma } from "@/lib/prisma";
import { exigirLaboratorio } from "@/lib/autorizacion";
import { paraTarjeta, seleccionDeTarjeta } from "@/lib/casos";
import { TarjetaDeCaso } from "@/componentes/TarjetaDeCaso";
import { EstadoVacio } from "@/componentes/EstadoVacio";
import { ListaConEntrada } from "@/componentes/ListaConEntrada";
import { REJILLA_DE_CASOS } from "@/componentes/RejillaDeCasos";
import { BotonEnlace } from "@/componentes/Boton";
import { diasFaltantes } from "@/lib/fechas";

/**
 * "Requiere atención" (SKILL.md O-5).
 *
 * Cruza la fecha de entrega contra la etapa actual. Es la primera pantalla de
 * la mañana del laboratorio, así que muestra sólo lo que está en riesgo de no
 * llegar a tiempo, ordenado por urgencia.
 */
export async function RequiereAtencion() {
  await exigirLaboratorio();

  const casos = await prisma.caso.findMany({
    where: {
      esBorrador: false,
      etapa: { notIn: ["ENTREGADO"] },
    },
    select: {
      ...seleccionDeTarjeta,
      prioridad: true,
      doctor: { select: { nombreCompleto: true } },
    },
    orderBy: [{ fechaEntregaComprometida: "asc" }],
  });

  const requierenAtencion = casos.filter((caso) => {
    if (caso.enRiesgo) return true;
    if (caso.etapa === "EN_PAUSA" || caso.etapa === "REHACER") return true;
    if (caso.etapa === "RECIBIDO" || caso.etapa === "EN_REVISION") return true;
    if (!caso.fechaEntregaComprometida) return false;
    return diasFaltantes(caso.fechaEntregaComprometida) <= 2;
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-cuerpo text-secundario">Buen día</p>
          <h1 className="mt-1 text-titulo font-semibold text-primario">
            {requierenAtencion.length === 0
              ? "Nada requiere atención"
              : requierenAtencion.length === 1
                ? "1 caso requiere atención"
                : `${requierenAtencion.length} casos requieren atención`}
          </h1>
        </div>
        <BotonEnlace href="/tablero" tono="principal">
          Abrir el tablero
        </BotonEnlace>
      </header>

      {requierenAtencion.length === 0 ? (
        <EstadoVacio
          titulo="Todo va a tiempo"
          explicacion={
            "Ningún caso está detenido ni cerca de su fecha de entrega. " +
            "Los casos del día siguen en el tablero."
          }
          accion={
            <BotonEnlace href="/tablero" tono="principal">
              Abrir el tablero
            </BotonEnlace>
          }
        />
      ) : (
        <ListaConEntrada className={REJILLA_DE_CASOS}>
          {requierenAtencion.map((caso) => (
            <div key={caso.id} className="flex flex-col gap-1">
              <p className="text-minimo text-secundario">
                {caso.folio} · {caso.doctor.nombreCompleto}
              </p>
              <TarjetaDeCaso caso={paraTarjeta(caso)} />
            </div>
          ))}
        </ListaConEntrada>
      )}
    </div>
  );
}
