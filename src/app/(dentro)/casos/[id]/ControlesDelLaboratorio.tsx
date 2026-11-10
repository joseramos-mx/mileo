"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Etapa } from "@/generated/prisma/enums";
import { Boton, BotonEnlace } from "@/componentes/Boton";
import { ChipDeEtapa } from "@/componentes/ChipDeEtapa";
import { ZonaDeArchivos } from "@/componentes/ZonaDeArchivos";
import { ETAPAS } from "@/lib/vocabulario";
import { etapasPosiblesDesde } from "@/lib/etapas";
import { fechaConHora } from "@/lib/fechas";
import {
  cambiarEtapa,
  mandarDisenoAAprobacion,
  solicitarImpresionDeTicket,
} from "./acciones";
import { ejecutar } from "@/lib/acciones-cliente";

const EXTENSIONES_IMAGEN = ["jpg", "jpeg", "png", "webp", "heic"];

function esImagen(nombre: string) {
  const ext = nombre.toLowerCase().split(".").pop() ?? "";
  return EXTENSIONES_IMAGEN.includes(ext);
}

function esQuijadaSuperior(nombre: string) {
  return (
    nombre.startsWith("[Quijada superior]") ||
    /\b(quijada superior|arcada superior)\b/i.test(nombre)
  );
}

function esQuijadaInferior(nombre: string) {
  return (
    nombre.startsWith("[Quijada inferior]") ||
    /\b(quijada inferior|arcada inferior)\b/i.test(nombre)
  );
}

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

  const disenosImagenes = disenos.filter((d) => esImagen(d.nombre));
  const disenos3D = disenos.filter((d) => !esImagen(d.nombre));
  const disenosSuperior = disenos3D.filter((d) => esQuijadaSuperior(d.nombre));
  const disenosInferior = disenos3D.filter((d) => esQuijadaInferior(d.nombre));
  const disenosConjunto = disenos3D.filter(
    (d) => !esQuijadaSuperior(d.nombre) && !esQuijadaInferior(d.nombre),
  );

  const tieneAlMenosUno = disenos.length > 0;

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

      {etapa === "ACEPTADO" ||
      etapa === "EN_DISENO" ||
      etapa === "ESPERANDO_APROBACION" ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-tarjeta border border-borde bg-superficie-suave p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-cuerpo font-semibold text-primario">
                Archivos 3D del diseño (suba al menos uno)
              </p>
              <span
                className={
                  tieneAlMenosUno
                    ? "rounded-full border border-terminado/40 bg-terminado-fondo px-2.5 py-0.5 text-minimo font-medium text-terminado-texto"
                    : "rounded-full border border-borde bg-superficie px-2.5 py-0.5 text-minimo font-medium text-secundario"
                }
              >
                {tieneAlMenosUno
                  ? `Listo (${disenos.length} ${disenos.length === 1 ? "archivo subido" : "archivos subidos"})`
                  : "Suba al menos 1 archivo"}
              </span>
            </div>
            <p className="mt-1 text-menor text-secundario">
              No es obligatorio llenar los tres apartados: puede subir{" "}
              <strong>sólo el conjunto completo</strong>,{" "}
              <strong>las dos quijadas por separado</strong>, o los tres. Con{" "}
              <strong>al menos un archivo</strong> ya puede mandarlo a
              aprobación:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-menor text-secundario">
              <li>
                <strong className="text-primario">Conjunto completo:</strong>{" "}
                ambas quijadas juntas con el diseño (si lo sube, se muestra
                primero por defecto en el visor).
              </li>
              <li>
                <strong className="text-primario">
                  Quijada superior / inferior separadas:
                </strong>{" "}
                cada arcada por separado para alternarlas con el botón del ojo
                (una a la vez).
              </li>
            </ul>
          </div>

          <ZonaDeArchivos
            casoId={casoId}
            tipo="DISENO"
            idCampo="archivos-diseno-conjunto"
            prefijoNombre="[Conjunto completo] "
            etiqueta="Conjunto completo (ambas quijadas juntas) · Opcional"
            ayuda="STL con las dos quijadas juntas. Si lo sube, se renderiza primero al abrir el visor."
            yaSubidos={disenosConjunto.map((d) => ({
              id: d.id,
              nombre: d.nombre,
              bytesTotales: d.bytes,
              tipo: "DISENO" as const,
            }))}
            alCambiar={() => router.refresh()}
          />

          <ZonaDeArchivos
            casoId={casoId}
            tipo="DISENO"
            idCampo="archivos-diseno-superior"
            prefijoNombre="[Quijada superior] "
            etiqueta="Quijada superior (separada) · Opcional"
            ayuda="STL separado de la quijada superior."
            yaSubidos={disenosSuperior.map((d) => ({
              id: d.id,
              nombre: d.nombre,
              bytesTotales: d.bytes,
              tipo: "DISENO" as const,
            }))}
            alCambiar={() => router.refresh()}
          />

          <ZonaDeArchivos
            casoId={casoId}
            tipo="DISENO"
            idCampo="archivos-diseno-inferior"
            prefijoNombre="[Quijada inferior] "
            etiqueta="Quijada inferior (separada) · Opcional"
            ayuda="STL separado de la quijada inferior."
            yaSubidos={disenosInferior.map((d) => ({
              id: d.id,
              nombre: d.nombre,
              bytesTotales: d.bytes,
              tipo: "DISENO" as const,
            }))}
            alCambiar={() => router.refresh()}
          />

          <ZonaDeArchivos
            casoId={casoId}
            tipo="DISENO"
            idCampo="archivos-diseno-imagenes"
            etiqueta="Imágenes o capturas del diseño · Opcional"
            ayuda="Capturas o fotos (PNG, JPG, WEBP) para acompañar la vista 3D."
            yaSubidos={disenosImagenes.map((d) => ({
              id: d.id,
              nombre: d.nombre,
              bytesTotales: d.bytes,
              tipo: "DISENO" as const,
            }))}
            alCambiar={() => router.refresh()}
          />
        </div>
      ) : null}

      {tieneAlMenosUno &&
      (etapa === "ACEPTADO" ||
        etapa === "EN_DISENO" ||
        etapa === "ESPERANDO_APROBACION") ? (
        <div className="flex flex-col gap-2">
          <p className="text-menor text-secundario">
            Mandar a aprobación prepara la vista 3D de los archivos STL que haya
            subido (con su botón de ojo por archivo) para que el doctor los
            revise.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Boton
              type="button"
              tono="principal"
              disabled={trabajando}
              onClick={() =>
                empezar(async () => {
                  const resultado = await ejecutar(() =>
                    mandarDisenoAAprobacion(casoId),
                  );
                  if (resultado.error) setError(resultado.error);
                })
              }
            >
              {etapa === "ESPERANDO_APROBACION"
                ? "Actualizar vistas y mandar a aprobación"
                : `Mandar a aprobación (${disenos.length === 1 ? disenos[0].nombre : `${disenos.length} archivos`})`}
            </Boton>
            {etapa === "ESPERANDO_APROBACION" ? (
              <ChipDeEtapa
                etapa="ESPERANDO_APROBACION"
                texto="Esperando aprobación"
              />
            ) : null}
          </div>
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
                  const resultado = await ejecutar(() =>
                    cambiarEtapa(casoId, destino),
                  );
                  if (resultado.error) setError(resultado.error);
                })
              }
            >
              {ETAPAS[destino].nombre}
            </Boton>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-menor font-medium text-primario">
          Ticket
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Boton
            type="button"
            disabled={trabajando}
            onClick={() =>
              empezar(async () => {
                const resultado = await ejecutar(() =>
                  solicitarImpresionDeTicket(casoId),
                );
                if (resultado.error) setError(resultado.error);
              })
            }
          >
            Mandar a imprimir Ticket
          </Boton>
          <BotonEnlace href={`/casos/${casoId}/ticket`}>
            Ver vista previa del ticket
          </BotonEnlace>
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
