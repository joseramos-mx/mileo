"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Center } from "@react-three/drei";
import * as THREE from "three";
import { ArrowClockwise, DownloadSimple } from "@phosphor-icons/react";
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
 * - Estado de carga con progreso real, no un giro indeterminado.
 * - Órbita con inercia suave; nada de rotación automática permanente.
 * - Al desmontar se liberan geometría y material.
 * - Quien no pueda usar el visor tiene la descripción del caso en texto y la
 *   descarga del archivo.
 */

export type EstadoDelVisor = "cargando" | "listo" | "no-pude";

export function Visor3D({
  archivoDeMallaId,
  archivoOriginalId,
  descripcion,
  alCambiarEstado,
  className,
}: {
  /** El archivo de la malla ligera, no el diseño original. */
  archivoDeMallaId: string;
  /** Para la descarga alternativa. */
  archivoOriginalId: string;
  /** Qué se está viendo, en palabras. Es la alternativa al visor (§7). */
  descripcion: string;
  /**
   * Si el diseño llegó a verse o no. Lo usa la aprobación: nadie tiene que
   * poder aprobar a ciegas un diseño que el visor no alcanzó a enseñarle.
   */
  alCambiarEstado?: (estado: EstadoDelVisor) => void;
  className?: string;
}) {
  const [avance, setAvance] = useState(0);
  const [malla, setMalla] = useState<MallaLeida | null>(null);
  const [error, setError] = useState(false);
  const [intento, setIntento] = useState(0);
  const geometriaViva = useRef<THREE.BufferGeometry | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      setError(false);
      setAvance(0);
      alCambiarEstado?.("cargando");

      try {
        const armada = await traerMalla(archivoDeMallaId, (porcentaje) => {
          if (!cancelado) setAvance(porcentaje);
        });
        if (cancelado) return;

        geometriaViva.current = armada.geometria;
        setMalla(armada);
        setAvance(100);
        alCambiarEstado?.("listo");
      } catch (falla) {
        if (!cancelado) {
          // Lo que trae la excepción es para la consola, no para el doctor:
          // "Failed to fetch" no le dice nada a nadie y no está ni en español
          // (§8). Lo que necesita saber es que no se ve y qué puede hacer.
          console.error("No se pudo abrir la vista del diseño:", falla);
          setError(true);
          alCambiarEstado?.("no-pude");
        }
      }
    }

    void cargar();

    return () => {
      cancelado = true;
      geometriaViva.current?.dispose();
      geometriaViva.current = null;
    };
    // `alCambiarEstado` no va en las dependencias a propósito: si el padre la
    // vuelve a crear en cada pintada, meterla aquí recargaría la malla entera
    // una y otra vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archivoDeMallaId, intento]);

  return (
    // Excepción no negociable de §5.1: esta pantalla va sobre fondo neutro
    // claro aunque el doctor tenga el tema oscuro puesto.
    <div
      className={cn(
        "siempre-claro overflow-hidden rounded-contenedor border border-borde",
        className,
      )}
    >
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
          <Escena geometria={malla.geometria} descripcion={descripcion} />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            {error ? (
              <>
                <p className="text-cuerpo text-primario">
                  No pude abrir la vista de su diseño.
                </p>
                <p className="text-menor text-secundario">
                  Puede volver a intentarlo o descargar el diseño y abrirlo en su
                  programa.
                </p>
                <Boton type="button" onClick={() => setIntento((i) => i + 1)}>
                  <ArrowClockwise aria-hidden="true" size={16} />
                  Volver a intentar
                </Boton>
              </>
            ) : (
              <>
                <p className="text-cuerpo text-primario">
                  Preparando la vista de su diseño
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
          href={`/api/archivos/${archivoOriginalId}/contenido?descargar`}
          className="area-tactil inline-flex items-center gap-2 rounded-control text-menor text-enlace underline underline-offset-4"
        >
          <DownloadSimple aria-hidden="true" size={16} />
          Descargar el diseño
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
      // Cámara y luces fijas: el color de la pieza no debe cambiar con el
      // encuadre. La geometría llega normalizada a radio 1, así que a 4.2 de
      // distancia con 35 grados de campo la pieza entra completa y con aire
      // alrededor, venga una carilla o un modelo de arcada entera.
      camera={{ position: [0, 0, 4.2], fov: 35 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
      // La escena es decorativa para el lector de pantalla: la información va
      // en el texto de al lado, que es la alternativa real (§7).
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
