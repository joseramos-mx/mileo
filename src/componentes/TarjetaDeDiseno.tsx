import Link from "next/link";
import { ArrowRight, ChatCircleDots } from "@phosphor-icons/react/dist/ssr";
import type { DisenoReciente } from "@/lib/inicio";
import { VistaDelDiseno } from "@/componentes/VistaDelDiseno";
import { fechaCorta, cuandoFalta, paraMaquina } from "@/lib/fechas";
import { cn } from "@/lib/utilidades";

/**
 * Lo último que pasó con un diseño, como en el diseño entregado.
 *
 * La mitad izquierda es un cuadro del diseño de **ese** caso, sacado de la
 * misma malla ligera que el doctor gira en la pantalla de aprobación, y va
 * siempre sobre fondo neutro claro: ahí se ve la pieza y eso no se juzga sobre
 * negro (§5.1). La mitad derecha cuenta qué pasó y qué sigue, con fecha
 * concreta.
 *
 * Los botones son los que de verdad existen hoy. El diseño entregado dibuja
 * "Editar / Cancelar / Rehacer": rehacer es O-7 y va después del piloto (§11),
 * así que aquí no se pinta un botón que no haría nada.
 */
export function TarjetaDeDiseno({ diseno }: { diseno: DisenoReciente }) {
  const leToca = diseno.etapa === "ESPERANDO_APROBACION";

  return (
    // shrink-0: dentro de una columna que se desplaza, los hijos se encogen por
    // omisión y la tarjeta acaba cortando su propio texto.
    <article className="siempre-claro shrink-0 overflow-hidden rounded-contenedor">
      <div className="flex flex-col sm:flex-row">
        {/* --- La vista del caso ------------------------------------------- */}
        <div className="flex items-center justify-center bg-superficie p-4 sm:w-2/5">
          <VistaDelDiseno
            archivoDeMallaId={diseno.vistaId}
            descripcion={`Vista del diseño del paciente ${diseno.paciente}`}
          />
        </div>

        {/* --- Qué pasó y qué sigue ---------------------------------------- */}
        <div className="flex flex-1 flex-col gap-3 bg-superficie-marcada p-5">
          <div>
            <h3
              className={cn(
                "text-subtitulo font-semibold",
                diseno.tono === "aprobado" && "text-enlace",
                diseno.tono === "validacion" && "text-validacion",
                diseno.tono === "ajuste" && "text-pendiente-texto",
              )}
            >
              {diseno.titulo}
            </h3>
            <p className="mt-0.5 text-cuerpo text-primario">{diseno.detalle}</p>
          </div>

          <div>
            <p className="text-menor font-medium text-enlace">
              Su entrega se estima
            </p>
            {diseno.fechaEntregaComprometida ? (
              <p className="text-menor text-primario">
                <time dateTime={paraMaquina(diseno.fechaEntregaComprometida)}>
                  {fechaCorta(diseno.fechaEntregaComprometida)}
                </time>
                {" · "}
                {cuandoFalta(diseno.fechaEntregaComprometida)}
              </p>
            ) : (
              <p className="text-menor text-primario">
                Se la confirmo en cuanto acepte el caso.
              </p>
            )}
          </div>

          <div className="mt-auto flex flex-wrap gap-x-5 gap-y-1 pt-2">
            <Link
              href={`/casos/${diseno.casoId}`}
              className="alto-tactil inline-flex items-center gap-1.5 text-menor font-medium text-primario hover:text-enlace"
            >
              <ArrowRight aria-hidden="true" size={15} />
              {leToca ? "Revisar el diseño" : "Ver el caso"}
            </Link>
            <Link
              href={`/casos/${diseno.casoId}#chat`}
              className="alto-tactil inline-flex items-center gap-1.5 text-menor font-medium text-primario hover:text-enlace"
            >
              <ChatCircleDots aria-hidden="true" size={15} />
              Escribirle a su técnico
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
