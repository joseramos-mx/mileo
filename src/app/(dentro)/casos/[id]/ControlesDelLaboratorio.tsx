"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Etapa } from "@/generated/prisma/enums";
import { Boton, BotonEnlace } from "@/componentes/Boton";
import { ZonaDeArchivos } from "@/componentes/ZonaDeArchivos";
import { ETAPAS } from "@/lib/vocabulario";
import { etapasPosiblesDesde } from "@/lib/etapas";
import { fechaConHora } from "@/lib/fechas";
import { cambiarEtapa, mandarDisenoAAprobacion } from "./acciones";

/**
 * Lo que sólo ve el laboratorio: mover la etapa, mandar el diseño a aprobación
 * y la bitácora del caso.
 *
 * La bitácora es inmutable y encadenada por hash en la base de datos (O-0). Se
 * enseña aquí porque es la protección legal y comercial del laboratorio: cada
 * renglón dice quién hizo qué y cuándo.
 */
export function ControlesDelLaboratorio({
  casoId,
  etapa,
  tieneAprobacion,
  tieneCalidad,
  disenos,
  eventos,
}: {
  casoId: string;
  etapa: Etapa;
  tieneAprobacion: boolean;
  tieneCalidad: boolean;
  disenos: { id: string; nombre: string; bytes: number }[];
  eventos: { id: string; resumen: string; creadoEn: string; hash: string }[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [trabajando, empezar] = useTransition();

  // El bloqueo duro tambien se ve: sin aprobacion registrada del doctor, pasar
  // a fabricacion ni siquiera se ofrece. El servidor lo rechaza de todas
  // formas, pero ensenar un boton que va a fallar es faltarle al respeto a
  // quien lo aprieta.
  const posibles = etapasPosiblesDesde(etapa).filter(
    (destino) =>
      (destino !== "EN_FABRICACION" || tieneAprobacion) &&
      // Salir del laboratorio se hace desde la pantalla de calidad, con sus
      // dos fotos y su kit (O-6), no moviendo una etapa a mano.
      (destino !== "LISTO_Y_EN_CAMINO" || tieneCalidad),
  );

  return (
    <section
      aria-labelledby="laboratorio"
      className="flex flex-col gap-5 rounded-contenedor border border-borde bg-superficie p-5"
    >
      <h2 id="laboratorio" className="text-subtitulo font-semibold text-primario">
        Laboratorio
      </h2>

      <p
        role="alert"
        aria-live="polite"
        className={
          error
            ? "rounded-control border border-pendiente/40 bg-pendiente-fondo px-3 py-2 text-menor text-pendiente-texto"
            : "sr-only"
        }
      >
        {error ?? ""}
      </p>

      {etapa === "EN_DISENO" ? (
        <div className="flex flex-col gap-2">
          <p className="text-menor font-medium text-primario">
            Subir el diseño
          </p>
          <ZonaDeArchivos
            casoId={casoId}
            tipo="DISENO"
            etiqueta="Diseño terminado"
            ayuda="El STL que sale de su programa de diseño."
            yaSubidos={disenos.map((d) => ({
              id: d.id,
              nombre: d.nombre,
              bytesTotales: d.bytes,
              tipo: "DISENO" as const,
            }))}
            alCambiar={() => router.refresh()}
          />
        </div>
      ) : null}

      {disenos.length > 0 && etapa === "EN_DISENO" ? (
        <div className="flex flex-col gap-2">
          <p className="text-menor text-secundario">
            Mandar a aprobación prepara la vista ligera del diseño. Al doctor
            nunca se le manda el archivo original.
          </p>
          {disenos.map((diseno) => (
            <Boton
              key={diseno.id}
              type="button"
              tono="principal"
              disabled={trabajando}
              onClick={() =>
                empezar(async () => {
                  const resultado = await mandarDisenoAAprobacion(
                    casoId,
                    diseno.id,
                  );
                  if (resultado.error) setError(resultado.error);
                })
              }
              className="self-start"
            >
              Mandar a aprobación: {diseno.nombre}
            </Boton>
          ))}
        </div>
      ) : null}

      {etapa === "EN_CONTROL_DE_CALIDAD" && !tieneCalidad ? (
        <div className="flex flex-col gap-2">
          <p className="text-menor text-secundario">
            Para que el caso salga del laboratorio hacen falta las dos fotos y
            el kit completo.
          </p>
          <BotonEnlace
            href={`/casos/${casoId}/calidad`}
            tono="principal"
            className="self-start"
          >
            Abrir control de calidad
          </BotonEnlace>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <p className="text-menor font-medium text-primario">Mover la etapa</p>
        {!tieneAprobacion ? (
          <p className="text-menor text-secundario">
            Este caso todavía no tiene aprobación del doctor, así que no puede
            pasar a fabricación.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {posibles.map((destino) => (
            <Boton
              key={destino}
              type="button"
              disabled={trabajando}
              onClick={() =>
                empezar(async () => {
                  const resultado = await cambiarEtapa(casoId, destino);
                  if (resultado.error) setError(resultado.error);
                })
              }
            >
              {ETAPAS[destino].nombre}
            </Boton>
          ))}
        </div>
      </div>

      <details className="rounded-tarjeta border border-borde">
        <summary className="area-tactil flex cursor-pointer items-center px-3 text-cuerpo text-primario">
          Bitácora del caso ({eventos.length})
        </summary>
        <ol className="flex flex-col gap-3 border-t border-borde p-3">
          {eventos.map((evento) => (
            <li key={evento.id}>
              <p className="text-cuerpo text-primario">{evento.resumen}</p>
              <p className="text-minimo text-secundario">
                <time dateTime={evento.creadoEn}>
                  {fechaConHora(new Date(evento.creadoEn))}
                </time>
                {" · "}
                <span title="Huella encadenada del evento">
                  {evento.hash.slice(0, 12)}
                </span>
              </p>
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}
