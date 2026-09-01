"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Center } from "@react-three/drei";
import type * as THREE from "three";
import { MarcoDeImagen } from "@/componentes/MarcoDeImagen";
import {
  materialDeLaPieza,
  traerMalla,
  type MallaLeida,
} from "@/lib/malla-cliente";
import { cn } from "@/lib/utilidades";

/**
 * Un cuadro del diseño del caso, sacado de su propia malla.
 *
 * Es la misma geometría que gira el doctor en la pantalla de aprobación, sólo
 * que quieta: no se puede girar y no se pinta cuadro a cuadro, así que no gasta
 * batería ni distrae mientras alguien lee el inicio (§5.5).
 *
 * Va sobre fondo neutro claro, como todo lo que enseña una pieza (§5.1). Si el
 * caso todavía no tiene diseño, se enseña el marco con la descripción (§9).
 */
export function VistaDelDiseno({
  archivoDeMallaId,
  descripcion,
  className,
}: {
  /** La malla ligera del caso, o null si todavía no hay diseño. */
  archivoDeMallaId: string | null;
  descripcion: string;
  className?: string;
}) {
  const [malla, setMalla] = useState<MallaLeida | null>(null);
  const [fallo, setFallo] = useState(false);
  const viva = useRef<THREE.BufferGeometry | null>(null);

  useEffect(() => {
    if (!archivoDeMallaId) return;

    const abortador = new AbortController();
    let cancelado = false;

    traerMalla(archivoDeMallaId, undefined, abortador.signal)
      .then((leida) => {
        if (cancelado) return;
        viva.current = leida.geometria;
        setMalla(leida);
      })
      .catch(() => {
        if (!cancelado) setFallo(true);
      });

    return () => {
      cancelado = true;
      abortador.abort();
      viva.current?.dispose();
      viva.current = null;
    };
  }, [archivoDeMallaId]);

  // Sin diseño todavía, o no se pudo traer: el marco dice qué va aquí.
  if (!archivoDeMallaId || fallo) {
    return (
      <MarcoDeImagen
        proporcion="4/3"
        etiqueta={descripcion}
        className={className}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={descripcion}
      className={cn(
        "aspect-4/3 w-full overflow-hidden rounded-tarjeta bg-superficie",
        className,
      )}
    >
      {malla ? <Cuadro geometria={malla.geometria} /> : null}
    </div>
  );
}

function Cuadro({ geometria }: { geometria: THREE.BufferGeometry }) {
  const material = useMemo(() => materialDeLaPieza(), []);
  useEffect(() => () => material.dispose(), [material]);

  return (
    <Canvas
      // Un solo cuadro: se pinta cuando hace falta y se queda quieto.
      frameloop="demand"
      camera={{ position: [0, 0, 4.2], fov: 35 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <color attach="background" args={["#ffffff"]} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[3, 4, 5]} intensity={1.5} />
      <directionalLight position={[-4, -2, -3]} intensity={0.5} />

      <Center>
        <mesh geometry={geometria} material={material} rotation={[-0.5, 0.4, 0]} />
      </Center>
    </Canvas>
  );
}
