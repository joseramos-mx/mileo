import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import type { Etapa } from "@/generated/prisma/enums";
import { ChipDeEtapa, colorDeEtapa } from "@/componentes/ChipDeEtapa";
import { MarcoDeImagen } from "@/componentes/MarcoDeImagen";
import { VistaDelDiseno } from "@/componentes/VistaDelDiseno";
import { ETAPAS } from "@/lib/vocabulario";
import { escalaDelRender, RENDERS_3D } from "@/lib/entrada";
import {
  cuandoFalta,
  fechaCorta,
  fechaEnPalabras,
  paraMaquina,
} from "@/lib/fechas";
import { cn } from "@/lib/utilidades";

/**
 * Tarjeta de caso (SKILL.md §5.4 "CaseCard").
 *
 * Una sola tarjeta para todo el sistema. El doctor aprende el patrón una vez y
 * lo reconoce en el inicio, en sus casos y en la bandeja del laboratorio
 * (§6.11). Cuatro renglones, siempre en el mismo orden:
 *
 *   1. Cuándo se entrega — el dato que le importa. Debajo, de quién es.
 *   2. Qué se está fabricando, con la pieza a un lado.
 *   3. Quién lo está haciendo. Si nadie todavía, el renglón no existe: decir
 *      "sin técnico asignado" es ruido que el doctor no puede accionar.
 *   4. Una sola acción.
 *
 * El estado lo dice el chip y nada más. Antes había además un mosaico grande
 * con un avión: la misma información dos veces, y el avión ganaba la mirada
 * sobre la fecha de entrega. La franja de 4 px del borde izquierdo repite el
 * color —no la información— para poder barrer una lista larga de un vistazo.
 *
 * Nada de relleno azul aquí adentro: el azul lleno es de la acción principal de
 * la pantalla, y una lista de doce tarjetas con doce botones azules deja al
 * doctor sin saber qué apretar.
 */

export type CasoParaTarjeta = {
  id: string;
  folio: string;
  etapa: Etapa;
  fechaEntregaComprometida: Date | null;
  enRiesgo: boolean;
  paciente: { folio: string; iniciales: string };
  /** "2 unidades · 14, 15" */
  unidades: string;
  /** "Zirconio monolítico A1" */
  materialYColor: string;
  /**
   * El retrato del diseño de este caso, cuando el laboratorio ya lo mandó.
   * Manda sobre el render genérico: es su pieza, no un diente de catálogo.
   */
  vistaId: string | null;
  /** El render de la pieza, si el equipo de diseño ya lo entregó. */
  pieza: { ruta: string; escala: number } | null;
  tecnico: { nombre: string; fotoUrl: string | null } | null;
};

/** 380 px, como pidió el diseño; nunca más ancha que su columna. */
const ANCHO = "w-full max-w-[23.75rem]";

/**
 * Alto fijo para que el esqueleto de carga mida exactamente lo mismo y la
 * lista no brinque cuando llegan los datos.
 */
const ALTO = "min-h-56";

export function TarjetaDeCaso({
  caso,
  className,
}: {
  caso: CasoParaTarjeta;
  className?: string;
}) {
  const entrega = caso.fechaEntregaComprometida;

  return (
    <Link
      href={`/casos/${caso.id}`}
      aria-label={
        `Caso del paciente ${caso.paciente.folio}, ` +
        `${ETAPAS[caso.etapa].nombre.toLowerCase()}, ` +
        (entrega
          ? `entrega el ${fechaEnPalabras(entrega)}`
          : "todavía sin fecha de entrega") +
        (caso.enRiesgo ? ", va con retraso" : "")
      }
      className={cn(
        "group relative flex flex-col gap-3 overflow-hidden",
        "rounded-tarjeta border border-borde bg-superficie p-4 pl-5",
        "transition-colors duration-150 hover:border-borde-encima",
        ANCHO,
        ALTO,
        className,
      )}
    >
      {/* Franja del color del estado, para barrer la lista de un vistazo. No
          lleva información propia: el chip ya la dice con letras (§7). */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          colorDeEtapa(caso.etapa),
        )}
      />

      {/* 1 · Cuándo se entrega, y de quién es el caso. */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {entrega ? (
            /* La fecha y el "en 3 días" no se parten por dentro: si no caben
               en un renglón, el corte va justo en el punto medio. */
            <p className="text-realce font-semibold text-primario">
              <time
                className="whitespace-nowrap"
                dateTime={paraMaquina(entrega)}
              >
                {fechaCorta(entrega)}
              </time>{" "}
              <span className="whitespace-nowrap">
                · {cuandoFalta(entrega)}
              </span>
            </p>
          ) : (
            <p className="text-realce font-semibold wrap-break-word text-primario">
              Sin fecha hasta que lo acepte
            </p>
          )}

          <p className="mt-0.5 text-menor wrap-break-word text-secundario">
            Paciente {caso.paciente.folio} · {caso.paciente.iniciales}
          </p>

          {caso.enRiesgo ? (
            <p className="mt-0.5 text-menor font-medium text-pendiente-texto">
              Va con retraso
            </p>
          ) : null}
        </div>

        <ChipDeEtapa etapa={caso.etapa} className="shrink-0" />
      </div>

      {/* 2 · Qué se está fabricando. */}
      <div className="flex min-w-0 items-center gap-3">
        <Pieza vistaId={caso.vistaId} pieza={caso.pieza} />
        <div className="min-w-0">
          <p className="text-menor wrap-break-word text-primario">
            {caso.unidades}
          </p>
          <p className="text-menor wrap-break-word text-secundario">
            {caso.materialYColor}
          </p>
        </div>
      </div>

      {/* 3 · Quién lo está haciendo. Sin técnico, no hay renglón. */}
      {caso.tecnico ? (
        <div className="flex min-w-0 items-center gap-2">
          <Cara tecnico={caso.tecnico} />
          <p className="min-w-0 text-menor wrap-break-word text-secundario">
            Su técnico: {caso.tecnico.nombre}
          </p>
        </div>
      ) : null}

      {/* 4 · Una sola acción. */}
      <span className="alto-tactil mt-auto flex items-center gap-1.5 text-menor font-medium text-enlace group-hover:underline">
        Ver caso
        <ArrowRight aria-hidden="true" size={16} />
      </span>
    </Link>
  );
}

/**
 * La miniatura de la pieza, 40×40.
 *
 * Si el caso ya tiene diseño, es el retrato de **ese** diseño: el doctor
 * reconoce su caso desde la lista sin abrirlo. Si todavía no, va el render
 * genérico de la indicación, y si tampoco lo hay, el marco punteado — nunca un
 * cuadro vacío (§9).
 *
 * Va al lado de un texto que ya dice qué lleva el caso, así que es decorativa:
 * anunciarla otra vez sería repetirle lo mismo a quien usa lector de pantalla.
 */
function Pieza({
  vistaId,
  pieza,
}: {
  vistaId: CasoParaTarjeta["vistaId"];
  pieza: CasoParaTarjeta["pieza"];
}) {
  if (vistaId) {
    return (
      <VistaDelDiseno
        archivoDeMallaId={vistaId}
        descripcion=""
        proporcion="1/1"
        className="size-10 shrink-0 rounded-control"
      />
    );
  }

  if (!pieza) {
    return (
      <MarcoDeImagen
        proporcion="1/1"
        etiqueta=""
        className="size-10 shrink-0 rounded-control p-0"
      />
    );
  }

  const render = RENDERS_3D.find((r) => r.ruta === pieza.ruta);

  return (
    <span className="size-10 shrink-0 overflow-hidden rounded-control">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={encodeURI(pieza.ruta)}
        alt=""
        style={
          render
            ? { transform: `scale(${escalaDelRender(render, pieza.escala)})` }
            : undefined
        }
        className="size-full object-contain"
      />
    </span>
  );
}

/** La cara de quien está haciendo el caso: del otro lado hay una persona (§8). */
function Cara({
  tecnico,
}: {
  tecnico: NonNullable<CasoParaTarjeta["tecnico"]>;
}) {
  if (!tecnico.fotoUrl) {
    return (
      <MarcoDeImagen
        proporcion="1/1"
        etiqueta=""
        className="size-7 shrink-0 rounded-full p-0"
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={tecnico.fotoUrl}
      alt=""
      className="size-7 shrink-0 rounded-full object-cover"
    />
  );
}

/**
 * La misma tarjeta mientras cargan los datos. Mide exactamente igual, así que
 * cuando llega el caso nada se mueve de lugar (§5.5).
 */
export function TarjetaDeCasoCargando({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex flex-col gap-3 rounded-tarjeta border border-borde bg-superficie p-4 pl-5",
        ANCHO,
        ALTO,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <Hueso className="h-[1.55rem] w-40" />
          <Hueso className="h-[1.18rem] w-28" />
        </div>
        <Hueso className="h-6 w-24 rounded-full" />
      </div>

      <div className="flex items-center gap-3">
        <Hueso className="size-10 shrink-0" />
        <div className="flex flex-col gap-1">
          <Hueso className="h-[1.18rem] w-32" />
          <Hueso className="h-[1.18rem] w-40" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Hueso className="size-7 shrink-0 rounded-full" />
        <Hueso className="h-[1.18rem] w-36" />
      </div>

      <Hueso className="mt-auto h-11 w-20" />
    </div>
  );
}

function Hueso({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "block rounded-control bg-superficie-suave motion-safe:animate-pulse",
        className,
      )}
    />
  );
}
