"use client";

import { useEffect, useId, useState } from "react";
import { Campo } from "@/componentes/Campo";
import {
  cotizar,
  entregaElegida,
  type CatalogoDeCotizacion,
  type EntregaCotizada,
  type UnidadParaCotizar,
} from "@/lib/cotizador";
import { TRABAJOS } from "@/lib/trabajos";
import { cn } from "@/lib/utilidades";

/**
 * Precio y fecha de entrega del caso, calculados con lo que el doctor lleva
 * puesto en el odontograma.
 *
 * Lo primero que se le pregunta es para cuándo lo necesita: estándar o rápida,
 * cada una con su fecha y su total, lado a lado, para que el recargo se vea
 * antes de aceptarlo y no al final. La elección NO vive aquí: la manda quien usa
 * el componente (`entregaRapida`), porque es un dato del caso que se guarda y el
 * laboratorio tiene que ver. Al enviar, el servidor vuelve a calcular
 * (`congelarCotizacion`): esta pantalla sólo ayuda a decidir.
 *
 * La rápida depende de la hora y del tamaño del puente, así que puede dejar de
 * valer mientras el doctor arma el caso. Si estaba marcada y deja de valer, aquí
 * se desmarca y se le dice por qué: lo que se ve y lo que se guarda no pueden
 * ser distintos.
 *
 * Es un estimado: lo que manda es lo que el laboratorio confirma al aceptar el
 * caso, y por eso las piezas sin precio en la lista se dicen ("se cotiza
 * aparte") en vez de contarse en cero ni inventarse.
 *
 * Las unidades pueden traer anotaciones (antagonista, diente vecino): no se
 * fabrican ni se cobran, y aquí se quitan.
 *
 * El reloj es el del navegador, y sólo se pinta la entrega cuando ya se sabe la
 * hora: en el servidor sería otra y la pantalla parpadearía al hidratarse.
 */

const pesos = (centavos: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: centavos % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(centavos / 100);

/** "AAAA-MM-DD" -> "jueves 12 de noviembre". */
const fechaLarga = (fecha: string) =>
  new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  })
    .format(new Date(`${fecha}T12:00:00Z`))
    .replace(",", "");

function enDias(desde: number | null, hasta: number | null): string {
  if (hasta === null) return "";
  if (hasta === 0) return "El mismo día";
  if (hasta === 1) return "Al día siguiente";
  return desde !== null && desde !== hasta
    ? `De ${desde} a ${hasta} días hábiles`
    : `En ${hasta} días hábiles`;
}

export function CalculadoraDePrecios({
  unidades,
  catalogo,
  entregaRapida,
  alCambiarEntregaRapida,
  llegaEn,
  className,
}: {
  unidades: UnidadParaCotizar[];
  catalogo: CatalogoDeCotizacion;
  /** El doctor pidió entrega rápida. Se guarda en `Caso.entregaRapida`. */
  entregaRapida: boolean;
  alCambiarEntregaRapida: (rapida: boolean) => void;
  /**
   * Cuándo llega el caso al laboratorio. Sin él, ahora mismo: es lo que
   * conviene mientras el doctor arma el caso.
   */
  llegaEn?: Date;
  className?: string;
}) {
  const grupo = useId();
  const [ahora, setAhora] = useState<Date | null>(null);
  const [pruebas, setPruebas] = useState("0");
  const [avisoDeRapida, setAvisoDeRapida] = useState<string | null>(null);

  const llegaMs = llegaEn?.getTime();
  useEffect(() => {
    if (llegaMs !== undefined) {
      setAhora(new Date(llegaMs));
      return;
    }
    setAhora(new Date());
    // La hora límite se pasa en cualquier minuto: se mantiene al día.
    const reloj = setInterval(() => setAhora(new Date()), 60_000);
    return () => clearInterval(reloj);
  }, [llegaMs]);

  const fabricables = unidades.filter((u) => !TRABAJOS[u.rol].esAnotacion);

  const cotizacion = cotizar(catalogo, fabricables, {
    llegaEn: ahora ?? new Date(),
    pruebas: Number(pruebas) || 0,
  });

  // Sin la hora del navegador no se decide nada: la del servidor es otra.
  const eleccion = cotizacion && ahora ? entregaElegida(cotizacion, entregaRapida) : null;
  const motivoPerdido = eleccion && !eleccion.ok ? eleccion.motivo : null;

  // La rápida estaba marcada y ya no se puede: se desmarca aquí mismo para que
  // lo que se ve y lo que se guarda sean lo mismo.
  useEffect(() => {
    if (motivoPerdido === null) return;
    setAvisoDeRapida(motivoPerdido);
    alCambiarEntregaRapida(false);
  }, [motivoPerdido, alCambiarEntregaRapida]);

  if (!cotizacion) {
    return (
      <section
        aria-label="Precio y fecha de entrega"
        className={cn("rounded-tarjeta bg-superficie p-4", className)}
      >
        <h3 className="text-subtitulo font-semibold text-primario">
          Precio y fecha de entrega
        </h3>
        <p className="mt-1 text-menor text-secundario">
          Agregue dientes al odontograma y aquí le digo cuánto cuesta y cuándo
          se entrega.
        </p>
      </section>
    );
  }

  const { estandar, rapida } = cotizacion;
  const rapidaMarcada = eleccion?.ok === true && eleccion.rapida;
  // Mientras se desmarca, o antes de saber la hora, se enseña la estándar.
  const elegida = eleccion?.ok ? eleccion.entrega : estandar;

  return (
    <section
      aria-label="Precio y fecha de entrega"
      className={cn("flex flex-col gap-4 rounded-tarjeta bg-superficie p-4", className)}
    >
      <div>
        <h3 className="text-subtitulo font-semibold text-primario">
          Precio y fecha de entrega
        </h3>
        <p className="text-minimo text-secundario">
          Es un estimado: el laboratorio lo confirma al aceptar el caso.
        </p>
      </div>

      {/* Lo primero: para cuándo lo necesita. Sólo con la hora ya conocida. */}
      {ahora && estandar.fecha ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-menor font-medium text-primario">
            ¿Para cuándo lo necesita?
          </legend>

          <OpcionDeEntrega
            grupo={grupo}
            nombre="Estándar"
            entrega={estandar}
            marcada={!rapidaMarcada}
            alEscoger={() => alCambiarEntregaRapida(false)}
          />
          {rapida ? (
            <OpcionDeEntrega
              grupo={grupo}
              nombre="Entrega rápida"
              entrega={rapida}
              marcada={rapidaMarcada}
              alEscoger={() => {
                setAvisoDeRapida(null);
                alCambiarEntregaRapida(true);
              }}
            />
          ) : (
            <p className="text-minimo text-secundario">
              Ninguna pieza de este caso tiene entrega rápida.
            </p>
          )}

          {avisoDeRapida ? (
            <p
              role="status"
              className="rounded-control bg-superficie-suave p-3 text-minimo text-primario"
            >
              Se quitó la entrega rápida. {avisoDeRapida}
            </p>
          ) : null}

          {cotizacion.llegada.ajustada ? (
            <p className="text-minimo text-secundario">
              El laboratorio no trabaja el día en que llega el caso: los días se
              cuentan desde el {fechaLarga(cotizacion.llegada.fecha)}.
            </p>
          ) : null}
        </fieldset>
      ) : null}

      {cotizacion.admitePruebas ? (
        <Campo
          etiqueta="Pruebas con el paciente"
          type="number"
          inputMode="numeric"
          min="0"
          max="5"
          step="1"
          value={pruebas}
          onChange={(e) => setPruebas(e.target.value)}
          ayuda="Cada prueba suma la ida y vuelta al consultorio."
        />
      ) : null}

      {/* Renglones: lo que se cobra, pieza por pieza. */}
      <ul className="flex flex-col divide-y divide-borde">
        {cotizacion.lineas.map((linea) => (
          <li
            key={linea.clave}
            className="flex items-baseline justify-between gap-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-menor text-primario">
                {linea.diente !== null
                  ? `Diente ${linea.diente}`
                  : `Arcada ${linea.arcada?.toLowerCase() ?? ""}`}{" "}
                · {TRABAJOS[linea.rol].nombre}
              </p>
              <p className="text-minimo text-secundario">
                {linea.tarifa?.nombre ?? "No está en la lista de precios"}
              </p>
            </div>
            <p
              className={cn(
                "shrink-0 text-menor tabular-nums",
                linea.precioCentavos === null ? "text-secundario" : "text-primario",
              )}
            >
              {linea.precioCentavos === null
                ? "Se cotiza aparte"
                : linea.incluida
                  ? "Incluido"
                  : pesos(linea.precioCentavos)}
            </p>
          </li>
        ))}
      </ul>

      {cotizacion.sinPrecio > 0 ? (
        <p className="rounded-control bg-superficie-suave p-3 text-minimo text-secundario">
          {cotizacion.sinPrecio === 1
            ? "Una pieza no está en la lista de precios: el laboratorio se la cotiza al aceptar el caso. No cuenta en el total ni en la fecha."
            : `${cotizacion.sinPrecio} piezas no están en la lista de precios: el laboratorio se las cotiza al aceptar el caso. No cuentan en el total ni en la fecha.`}
        </p>
      ) : null}

      {/* Total. Se anuncia: cambia mientras el doctor escoge. */}
      <dl aria-live="polite" className="flex flex-col gap-1 border-t border-borde pt-3">
        <div className="flex justify-between text-menor text-secundario">
          <dt>Subtotal</dt>
          <dd className="tabular-nums">{pesos(cotizacion.subtotalCentavos)}</dd>
        </div>
        {ahora && rapidaMarcada && elegida.recargoPct !== 0 ? (
          <div className="flex justify-between text-menor text-secundario">
            <dt>
              Entrega rápida
              {elegida.recargoPct !== null ? ` (+${elegida.recargoPct}%)` : ""}
            </dt>
            <dd className="tabular-nums">
              {elegida.recargoPorConfirmar
                ? "Por confirmar"
                : pesos(elegida.recargoCentavos)}
            </dd>
          </div>
        ) : null}
        <div className="flex justify-between text-subtitulo font-semibold text-primario">
          <dt>Total</dt>
          <dd className="tabular-nums">
            {pesos(ahora ? elegida.totalCentavos : cotizacion.subtotalCentavos)}
          </dd>
        </div>
        {cotizacion.sinPrecio > 0 ? (
          <p className="text-minimo text-secundario">Sin las piezas por cotizar.</p>
        ) : null}
      </dl>
    </section>
  );
}

/** Una forma de entrega: se ve, se escoge, y si no se puede, dice por qué. */
function OpcionDeEntrega({
  grupo,
  nombre,
  entrega,
  marcada,
  alEscoger,
}: {
  grupo: string;
  nombre: string;
  entrega: EntregaCotizada;
  marcada: boolean;
  alEscoger: () => void;
}) {
  const disponible = entrega.disponible && entrega.fecha !== null;

  return (
    <label
      className={cn(
        "flex items-start gap-3 rounded-control border p-3",
        disponible ? "cursor-pointer" : "cursor-not-allowed opacity-80",
        marcada && disponible
          ? "border-accion bg-superficie-suave"
          : "border-borde hover:bg-superficie-suave",
      )}
    >
      <input
        type="radio"
        name={`entrega-${grupo}`}
        checked={marcada && disponible}
        disabled={!disponible}
        onChange={alEscoger}
        className="mt-1 size-4 shrink-0 accent-[var(--rol-accion)]"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="text-menor font-medium text-primario">{nombre}</span>
          {disponible ? (
            <span className="text-menor font-medium text-primario tabular-nums">
              {pesos(entrega.totalCentavos)}
            </span>
          ) : null}
        </span>

        {disponible && entrega.fecha ? (
          <>
            <span className="text-menor text-primario">
              {entrega.desde
                ? `Entre el ${fechaLarga(entrega.desde)} y el ${fechaLarga(entrega.fecha)}`
                : fechaLarga(entrega.fecha)}
            </span>
            <span className="text-minimo text-secundario">
              {enDias(entrega.diasHabilesDesde, entrega.diasHabiles)}
            </span>
            {entrega.recargoPorConfirmar ? (
              <span className="text-minimo text-secundario">
                Lleva un recargo que el laboratorio confirma.
              </span>
            ) : entrega.recargoPct ? (
              <span className="text-minimo text-secundario">
                Incluye {entrega.recargoPct}% de recargo (+{pesos(entrega.recargoCentavos)}).
              </span>
            ) : null}
            {entrega.condiciones.map((condicion) => (
              <span key={condicion} className="text-minimo text-secundario">
                {condicion}
              </span>
            ))}
          </>
        ) : (
          <span className="text-minimo text-secundario">
            No disponible. {entrega.motivo}
          </span>
        )}
      </span>
    </label>
  );
}
