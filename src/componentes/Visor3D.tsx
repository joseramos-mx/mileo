"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Center } from "@react-three/drei";
import * as THREE from "three";
import {
  ArrowClockwise,
  DownloadSimple,
  Eye,
  EyeSlash,
} from "@phosphor-icons/react";
import { Boton } from "@/componentes/Boton";
import {
  materialDeLaPieza,
  traerMalla,
  type MallaLeida,
} from "@/lib/malla-cliente";
import { cn } from "@/lib/utilidades";

/**
 * Visor 3D (SKILL.md §5.4 "Viewer3D", §9, O-4).
 *
 * Reglas que este componente cumple a propósito:
 *
 * - Fondo neutro claro siempre, sin importar el tema activo. El doctor juzga
 *   color aquí; sobre negro no se puede.
 * - Se sirve una malla ligera derivada, nunca el archivo original.
 * - Si hay varios archivos 3D (1. Conjunto completo, 2. Quijada superior,
 *   3. Quijada inferior), renderiza primero el conjunto completo y muestra un
 *   botón con ícono de ojo por cada archivo para alternar uno a la vez.
 * - Estado de carga con progreso real, no un giro indeterminado.
 * - Órbita con inercia suave; nada de rotación automática permanente.
 * - Al desmontar se liberan geometría y material.
 * - Quien no pueda usar el visor tiene la descripción del caso en texto y la
 *   descarga del archivo.
 */

export type EstadoDelVisor = "cargando" | "listo" | "no-pude";

export type ArchivoDeVista3D = {
  archivoDeMallaId: string;
  archivoOriginalId: string;
  nombre: string;
};

export function Visor3D({
  archivoDeMallaId,
  archivoOriginalId,
  archivos,
  descripcion,
  alCambiarEstado,
  className,
}: {
  /** El archivo de la malla ligera principal, no el diseño original. */
  archivoDeMallaId: string;
  /** Para la descarga alternativa. */
  archivoOriginalId: string;
  /**
   * Lista completa de archivos 3D del diseño (el primero es el conjunto
   * completo y luego cada quijada por separado).
   */
  archivos?: ArchivoDeVista3D[];
  /** Qué se está viendo, en palabras. Es la alternativa al visor (§7). */
  descripcion: string;
  /**
   * Si el diseño llegó a verse o no. Lo usa la aprobación: nadie tiene que
   * poder aprobar a ciegas un diseño que el visor no alcanzó a enseñarle.
   */
  alCambiarEstado?: (estado: EstadoDelVisor) => void;
  className?: string;
}) {
  const listaDeArchivos = useMemo<ArchivoDeVista3D[]>(() => {
    if (archivos && archivos.length > 0) return archivos;
    return [
      {
        archivoDeMallaId,
        archivoOriginalId,
        nombre: "Conjunto completo",
      },
    ];
  }, [archivos, archivoDeMallaId, archivoOriginalId]);

  const [indiceActivo, setIndiceActivo] = useState(0);
  const activo = listaDeArchivos[indiceActivo] ?? listaDeArchivos[0];

  const [avance, setAvance] = useState(0);
  const [malla, setMalla] = useState<MallaLeida | null>(null);
  const [error, setError] = useState(false);
  const [intento, setIntento] = useState(0);
  const cacheDeMallas = useRef<Map<string, MallaLeida>>(new Map());

  useEffect(() => {
    const guardadas = cacheDeMallas.current;
    return () => {
      for (const item of guardadas.values()) {
        item.geometria.dispose();
      }
      guardadas.clear();
    };
  }, []);

  useEffect(() => {
    let cancelado = false;
    const idMallaActiva = activo.archivoDeMallaId;

    async function cargar() {
      const yaEnCache = cacheDeMallas.current.get(idMallaActiva);
      if (yaEnCache) {
        setError(false);
        setMalla(yaEnCache);
        setAvance(100);
        alCambiarEstado?.("listo");
        return;
      }

      setError(false);
      setMalla(null);
      setAvance(0);
      alCambiarEstado?.("cargando");

      try {
        const armada = await traerMalla(idMallaActiva, (porcentaje) => {
          if (!cancelado) setAvance(porcentaje);
        });
        if (cancelado) {
          armada.geometria.dispose();
          return;
        }

        cacheDeMallas.current.set(idMallaActiva, armada);
        setMalla(armada);
        setAvance(100);
        alCambiarEstado?.("listo");
      } catch (falla) {
        if (!cancelado) {
          console.error("No se pudo abrir la vista del diseño:", falla);
          setError(true);
          alCambiarEstado?.("no-pude");
        }
      }
    }

    void cargar();

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo.archivoDeMallaId, intento]);

  return (
    // Excepción no negociable de §5.1: esta pantalla va sobre fondo neutro
    // claro aunque el doctor tenga el tema oscuro puesto.
    <div
      className={cn(
        "siempre-claro overflow-hidden rounded-contenedor border border-borde",
        className,
      )}
    >
      {/* Selector de archivos con ícono de ojo: muestra uno a la vez, arrancando por el conjunto completo. */}
      <div className="flex flex-col gap-2 border-b border-borde bg-superficie p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-minimo font-semibold uppercase tracking-wide text-secundario">
            Archivos 3D del diseño (toque el ojo para ver uno a la vez)
          </p>
          <span className="text-minimo text-secundario">
            Mostrando {indiceActivo + 1} de {listaDeArchivos.length}
          </span>
        </div>
        <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
          {listaDeArchivos.map((item, idx) => {
            const visible = idx === indiceActivo;
            return (
              <button
                key={item.archivoOriginalId}
                type="button"
                aria-pressed={visible}
                onClick={() => setIndiceActivo(idx)}
                title={
                  visible
                    ? `Viendo ahora: ${item.nombre}`
                    : `Mostrar ${item.nombre} y ocultar el actual`
                }
                className={cn(
                  "area-tactil inline-flex items-center gap-2 rounded-control border px-3 py-1.5 text-left text-menor transition-colors",
                  visible
                    ? "border-accion bg-accion/10 font-semibold text-primario"
                    : "border-borde bg-superficie-suave text-secundario hover:border-primario/40 hover:text-primario",
                )}
              >
                {visible ? (
                  <Eye
                    aria-hidden="true"
                    size={18}
                    weight="fill"
                    className="shrink-0 text-accion"
                  />
                ) : (
                  <EyeSlash
                    aria-hidden="true"
                    size={18}
                    className="shrink-0 text-secundario"
                  />
                )}
                <span className="truncate">{item.nombre}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Con el diseño a la vista manda la proporción del visor. Sin él, el
          hueco se encoge a lo que dice: dejar el recuadro entero vacío empuja
          los botones abajo del pliegue, y el doctor tiene que buscarlos. */}
      <div
        className={cn(
          "relative w-full bg-superficie-suave",
          error ? "min-h-56" : "aspect-4/3",
        )}
      >
        {malla ? (
          <Escena
            geometria={malla.geometria}
            descripcion={`${descripcion} (${activo.nombre})`}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            {error ? (
              <>
                <p className="text-cuerpo text-primario">
                  No pude abrir la vista de {activo.nombre}.
                </p>
                <p className="text-menor text-secundario">
                  Puede volver a intentarlo o descargar el diseño y abrirlo en su
                  programa.
                </p>
                <Boton
                  type="button"
                  onClick={() => {
                    cacheDeMallas.current.delete(activo.archivoDeMallaId);
                    setIntento((i) => i + 1);
                  }}
                >
                  <ArrowClockwise aria-hidden="true" size={16} />
                  Volver a intentar
                </Boton>
              </>
            ) : (
              <>
                <p className="text-cuerpo text-primario">
                  Preparando la vista de {activo.nombre}
                </p>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={avance}
                  aria-label="Carga de la vista del diseño"
                  className="h-1.5 w-48 overflow-hidden rounded-full bg-borde"
                >
                  <div
                    className="h-full rounded-full bg-accion transition-[width] duration-200"
                    style={{ width: `${avance}%` }}
                  />
                </div>
                <p className="text-menor text-secundario">{avance}%</p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-borde bg-superficie p-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-menor text-secundario">
          {error
            ? "Ábralo en su programa para revisarlo."
            : "Gire con el dedo. Pellizque para acercar."}
        </p>
        <a
          href={`/api/archivos/${activo.archivoOriginalId}/contenido?descargar`}
          className="area-tactil inline-flex items-center gap-2 rounded-control text-menor text-enlace underline underline-offset-4"
        >
          <DownloadSimple aria-hidden="true" size={16} />
          Descargar {listaDeArchivos.length > 1 ? activo.nombre : "el diseño"}
        </a>
      </div>
    </div>
  );
}

function Escena({
  geometria,
  descripcion,
}: {
  geometria: THREE.BufferGeometry;
  descripcion: string;
}) {
  const material = useMemo(() => materialDeLaPieza(), []);

  useEffect(() => () => material.dispose(), [material]);

  return (
    <Canvas
      camera={{ position: [0, 0, 4.2], fov: 35 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
      aria-label={descripcion}
      role="img"
    >
      <color attach="background" args={["#f7faff"]} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[3, 4, 5]} intensity={1.5} />
      <directionalLight position={[-4, -2, -3]} intensity={0.5} />

      <Center>
        <mesh geometry={geometria} material={material} />
      </Center>

      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        autoRotate={false}
        minDistance={1.6}
        maxDistance={9}
      />
    </Canvas>
  );
}
