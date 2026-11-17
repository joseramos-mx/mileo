"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowsClockwise,
  CheckCircle,
  MapPin,
  Package,
  Truck,
} from "@phosphor-icons/react";
import { Boton } from "@/componentes/Boton";

type EventoRastreo = {
  date: string;
  status: string;
  description: string;
  location: string;
};

type DatosRastreo = {
  trackingNumber: string;
  carrier: string;
  serviceDescription: string;
  status: string;
  estimatedDelivery: string | null;
  trackUrl: string | null;
  events: EventoRastreo[];
};

const PASOS_ENVIO = [
  { clave: "CREATED", titulo: "Guía creada" },
  { clave: "PICKED_UP", titulo: "Recolectado" },
  { clave: "IN_TRANSIT", titulo: "En tránsito" },
  { clave: "OUT_FOR_DELIVERY", titulo: "En reparto" },
  { clave: "DELIVERED", titulo: "Entregado" },
] as const;

function indicePasoDesdeEstado(estadoCrudo: string): number {
  const s = estadoCrudo.toLowerCase();
  if (s.includes("deliver") || s.includes("entreg")) return 4;
  if (s.includes("out for") || s.includes("reparto")) return 3;
  if (s.includes("transit") || s.includes("tránsito") || s.includes("transito"))
    return 2;
  if (s.includes("pick") || s.includes("recolect")) return 1;
  return 0;
}

function etiquetaEstadoEspanol(estadoCrudo: string): string {
  const idx = indicePasoDesdeEstado(estadoCrudo);
  return PASOS_ENVIO[idx]?.titulo ?? "Guía creada";
}

export function PanelRastreoEnvio({
  casoId,
  numeroGuia,
  servicioNombre,
  urlRastreo,
}: {
  casoId: string;
  numeroGuia: string;
  servicioNombre: string | null;
  urlRastreo: string | null;
}) {
  const [datos, setDatos] = useState<DatosRastreo | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const consultarRastreo = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const resp = await fetch("/api/envia/rastrear", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ casoId }),
      });
      const json = (await resp.json()) as {
        rastreo?: DatosRastreo;
        error?: string;
      };
      if (!resp.ok || !json.rastreo) {
        setError(json.error ?? "No pude consultar el rastreo.");
      } else {
        setDatos(json.rastreo);
      }
    } catch {
      setError("Error de red al consultar la trayectoria.");
    } finally {
      setCargando(false);
    }
  }, [casoId]);

  useEffect(() => {
    let activo = true;
    fetch("/api/envia/rastrear", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ casoId }),
    })
      .then((resp) =>
        resp.json().then((json: { rastreo?: DatosRastreo; error?: string }) => ({
          ok: resp.ok,
          json,
        })),
      )
      .then(({ ok, json }) => {
        if (!activo) return;
        if (!ok || !json.rastreo) {
          setError(json.error ?? "No pude consultar el rastreo.");
        } else {
          setDatos(json.rastreo);
        }
      })
      .catch(() => {
        if (activo) setError("Error de red al consultar la trayectoria.");
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [casoId]);

  const estadoActual = datos?.status ?? "Created";
  const pasoActual = indicePasoDesdeEstado(estadoActual);
  const enlaceExterno = datos?.trackUrl || urlRastreo;

  return (
    <section
      aria-labelledby="rastreo-envio"
      className="flex flex-col gap-4 rounded-contenedor border border-borde bg-superficie p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Truck
            aria-hidden="true"
            size={22}
            className="mt-0.5 shrink-0 text-accion"
          />
          <div>
            <h2
              id="rastreo-envio"
              className="text-subtitulo font-semibold text-primario"
            >
              Trayectoria del envío
            </h2>
            <p className="mt-0.5 text-menor text-secundario">
              {servicioNombre ? `${servicioNombre} · ` : ""}
              Guía <strong>{numeroGuia}</strong> · Estado:{" "}
              <strong className="text-primario">
                {etiquetaEstadoEspanol(estadoActual)}
              </strong>
            </p>
            {datos?.estimatedDelivery ? (
              <p className="mt-0.5 text-minimo text-secundario">
                Entrega estimada: {datos.estimatedDelivery}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Boton
            type="button"
            disabled={cargando}
            onClick={() => void consultarRastreo()}
          >
            <ArrowsClockwise
              aria-hidden="true"
              size={16}
              className={cargando ? "animate-spin" : ""}
            />
            {cargando ? "Actualizando…" : "Actualizar"}
          </Boton>
          {enlaceExterno ? (
            <a
              href={enlaceExterno}
              target="_blank"
              rel="noopener noreferrer"
              className="text-menor text-enlace underline underline-offset-4"
            >
              Ver en Envia.com
            </a>
          ) : null}
        </div>
      </div>

      {/* Barra de progreso de 5 pasos */}
      <ol className="grid grid-cols-5 gap-2 rounded-tarjeta border border-borde bg-superficie-suave p-3.5">
        {PASOS_ENVIO.map((paso, idx) => {
          const completado = idx <= pasoActual;
          const esActual = idx === pasoActual;
          return (
            <li
              key={paso.clave}
              className="flex flex-col items-center gap-1.5 text-center"
            >
              <div
                className={
                  completado
                    ? "flex h-7 w-7 items-center justify-center rounded-full bg-terminado text-white"
                    : "flex h-7 w-7 items-center justify-center rounded-full border border-borde bg-superficie text-secundario"
                }
              >
                {completado ? (
                  <CheckCircle aria-hidden="true" size={16} weight="fill" />
                ) : (
                  <Package aria-hidden="true" size={14} />
                )}
              </div>
              <span
                className={
                  esActual
                    ? "text-minimo font-semibold text-primario"
                    : completado
                      ? "text-minimo font-medium text-terminado-texto"
                      : "text-minimo text-secundario"
                }
              >
                {paso.titulo}
              </span>
            </li>
          );
        })}
      </ol>

      {error ? (
        <p
          role="alert"
          className="rounded-control border border-pendiente/40 bg-pendiente-fondo px-3 py-2 text-menor text-pendiente-texto"
        >
          {error}
        </p>
      ) : null}

      {/* Línea de tiempo cronológica */}
      {datos && datos.events.length > 0 ? (
        <ol className="flex flex-col gap-3 border-l-2 border-borde pl-4">
          {datos.events.map((ev, i) => (
            <li key={`${ev.date}-${i}`} className="relative flex flex-col gap-0.5">
              <span
                aria-hidden="true"
                className={
                  i === 0
                    ? "absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-accion"
                    : "absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-borde"
                }
              />
              <div className="flex flex-wrap items-center gap-2 text-minimo text-secundario">
                {ev.date ? <span>{ev.date}</span> : null}
                {ev.location ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin aria-hidden="true" size={12} />
                    {ev.location}
                  </span>
                ) : null}
              </div>
              <p className="text-menor font-medium text-primario">
                {ev.description || ev.status}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-menor text-secundario">
          {cargando
            ? "Consultando movimientos con la paquetería…"
            : "Guía generada en Envia.com. En cuanto la paquetería escanee el paquete aparecerán aquí los movimientos de su trayectoria."}
        </p>
      )}
    </section>
  );
}
