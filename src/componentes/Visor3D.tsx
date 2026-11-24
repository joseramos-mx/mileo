"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  ArrowClockwise,
  ArrowsOutCardinal,
  CornersOut,
  CornersIn,
  DotsThreeVertical,
  Eye,
  EyeSlash,
  ListBullets,
  Lock,
  MagnifyingGlassPlus,
  MinusSquare,
  PlusSquare,
} from "@phosphor-icons/react";
import { Boton } from "@/componentes/Boton";
import { traerMalla, type MallaLeida } from "@/lib/malla-cliente";
import { cn } from "@/lib/utilidades";

/**
 * Visor 3D estilo Medit Link (SKILL.md §5.4 "Viewer3D", §9, O-4).
 *
 * Incluye:
 * - Panel izquierdo colapsable en árbol ("Attachment" -> "3D Data" -> mallas)
 *   con control de visibilidad (ojo) y menú de opacidad por archivo.
 * - Barra vertical derecha con las 6 herramientas de Medit Link:
 *   1. Mover (Pan)
 *   2. Rotar
 *   3. Zoom
 *   4. Ajustar a pantalla (Zoom Fit)
 *   5. Textura / Color (Color dental vs Monocromático de estudio)
 *   6. Modo de malla 3D (Sólido / Sólido + alambre / Alambre)
 * - Cubo interactivo 3D de orientación ("caras" +X, -X, +Y, -Y, +Z, -Z) en la
 *   esquina inferior derecha sincronizado en tiempo real con la cámara.
 * - Adaptación al tema oscuro (tonos grises/carbón diferenciados del fondo
 *   negro de la página) y al tema claro.
 */

export type EstadoDelVisor = "cargando" | "listo" | "no-pude";

export type ArchivoDeVista3D = {
  archivoDeMallaId: string;
  archivoOriginalId: string;
  nombre: string;
};

export type ImagenDeVistaDiseno = {
  id: string;
  nombre: string;
};

function esArchivoRestauracion(nombre: string): boolean {
  return (
    nombre.startsWith("[Restauración]") ||
    nombre.startsWith("[Restauracion]") ||
    /\b(restauraci[oó]n|inlay|onlay|crown|corona|cad)\b/i.test(nombre)
  );
}

type HerramientaActiva = "pan" | "rotar" | "zoom";
type ModoMalla = "solido" | "solido-alambre" | "alambre";
type CaraCubo = "+X" | "-X" | "+Y" | "-Y" | "+Z" | "-Z";

const VECTORES_CARA: Record<
  CaraCubo,
  { pos: [number, number, number]; up: [number, number, number] }
> = {
  "+Z": { pos: [0, 0, 1], up: [0, 1, 0] },
  "-Z": { pos: [0, 0, -1], up: [0, 1, 0] },
  "+X": { pos: [1, 0, 0], up: [0, 1, 0] },
  "-X": { pos: [-1, 0, 0], up: [0, 1, 0] },
  "+Y": { pos: [0, 1, 0], up: [0, 0, -1] },
  "-Y": { pos: [0, -1, 0], up: [0, 0, 1] },
};

export function Visor3D({
  archivoDeMallaId,
  archivoOriginalId,
  archivos,
  imagenes = [],
  descripcion,
  alCambiarEstado,
  className,
}: {
  archivoDeMallaId?: string | null;
  archivoOriginalId?: string;
  archivos?: ArchivoDeVista3D[];
  imagenes?: ImagenDeVistaDiseno[];
  descripcion: string;
  alCambiarEstado?: (estado: EstadoDelVisor) => void;
  className?: string;
}) {
  const listaDeArchivos = useMemo<ArchivoDeVista3D[]>(() => {
    if (archivos && archivos.length > 0) return archivos;
    if (archivoDeMallaId && archivoOriginalId) {
      return [
        {
          archivoDeMallaId,
          archivoOriginalId,
          nombre: "Conjunto completo",
        },
      ];
    }
    return [];
  }, [archivos, archivoDeMallaId, archivoOriginalId]);

  // Tema activo (por omisión Mileo arranca en oscuro salvo data-tema="claro")
  const [temaClaro, setTemaClaro] = useState(() =>
    typeof document !== "undefined"
      ? document.documentElement.getAttribute("data-tema") === "claro"
      : false,
  );

  useEffect(() => {
    const raiz = document.documentElement;
    const obs = new MutationObserver(() => {
      setTemaClaro(raiz.getAttribute("data-tema") === "claro");
    });
    obs.observe(raiz, { attributes: true, attributeFilter: ["data-tema"] });
    return () => obs.disconnect();
  }, []);

  // Visibilidad inicial: si hay conjunto completo, se enciende junto con las
  // restauraciones para que se vean ensamblados en su posición real de Exocad;
  // si no hay conjunto completo, se encienden todas las piezas.
  const [visibles, setVisibles] = useState<Record<number, boolean>>(() => {
    const inicial: Record<number, boolean> = { 0: true };
    const tieneConjunto = listaDeArchivos.some((a) =>
      a.nombre.startsWith("[Conjunto completo]"),
    );
    listaDeArchivos.forEach((a, idx) => {
      if (
        !tieneConjunto ||
        a.nombre.startsWith("[Restauración]") ||
        a.nombre.startsWith("[Restauracion]") ||
        /\b(restauraci[oó]n|inlay|onlay|crown|corona|cad)\b/i.test(a.nombre)
      ) {
        inicial[idx] = true;
      }
    });
    return inicial;
  });
  const [opacidades, setOpacidades] = useState<Record<number, number>>({});
  const [menuAbiertoIdx, setMenuAbiertoIdx] = useState<number | null>(null);

  // Árbol izquierdo estilo Medit Link
  const [panelArbolAbierto, setPanelArbolAbierto] = useState(true);
  const [abiertoAttachment, setAbiertoAttachment] = useState(true);
  const [abierto3DData, setAbierto3DData] = useState(true);
  const [abiertoModelos, setAbiertoModelos] = useState(true);
  const [abiertoRestauraciones, setAbiertoRestauraciones] = useState(true);
  const [abiertoImagenes, setAbiertoImagenes] = useState(true);
  const [imagenActivaId, setImagenActivaId] = useState<string | null>(() =>
    listaDeArchivos.length === 0 && imagenes[0] ? imagenes[0].id : null,
  );

  // Herramientas de la barra derecha
  const [herramienta, setHerramienta] = useState<HerramientaActiva>("rotar");
  const [conColor, setConColor] = useState(true);
  const [modoMalla, setModoMalla] = useState<ModoMalla>("solido");
  const [pantallaCompleta, setPantallaCompleta] = useState(false);

  // Carga y caché de mallas
  const [mallasCargadas, setMallasCargadas] = useState<
    Record<string, MallaLeida>
  >({});
  const [avance, setAvance] = useState(0);
  const [error, setError] = useState(false);
  const [intento, setIntento] = useState(0);
  const cacheDeMallas = useRef<Map<string, MallaLeida>>(new Map());

  // Referencias de contenedor, objetivo de cámara y cubo de orientación
  const contenedorRef = useRef<HTMLDivElement>(null);
  const objetivoRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const cuboDomRef = useRef<HTMLDivElement>(null);
  const [peticionVista, setPeticionVista] = useState<{
    cara?: CaraCubo;
    fit?: boolean;
    zoomDelta?: number;
    seq: number;
  } | null>(null);

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
    function alCambiarFullscreen() {
      setPantallaCompleta(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", alCambiarFullscreen);
    return () =>
      document.removeEventListener("fullscreenchange", alCambiarFullscreen);
  }, []);

  const indicesVisibles = useMemo(
    () =>
      listaDeArchivos
        .map((_, idx) => idx)
        .filter((idx) => Boolean(visibles[idx])),
    [listaDeArchivos, visibles],
  );

  useEffect(() => {
    let cancelado = false;
    const faltantes = indicesVisibles
      .map((idx) => listaDeArchivos[idx])
      .filter(
        (item): item is ArchivoDeVista3D =>
          Boolean(item) && !cacheDeMallas.current.has(item.archivoDeMallaId),
      );

    if (faltantes.length === 0) {
      if (indicesVisibles.length > 0) {
        alCambiarEstado?.("listo");
      }
      return;
    }

    async function cargarFaltantes() {
      setError(false);
      setAvance(0);
      alCambiarEstado?.("cargando");

      try {
        for (let i = 0; i < faltantes.length; i++) {
          const archivo = faltantes[i];
          const armada = await traerMalla(
            archivo.archivoDeMallaId,
            (porcentaje) => {
              if (!cancelado) {
                const global = Math.round(
                  ((i + porcentaje / 100) / faltantes.length) * 100,
                );
                setAvance(global);
              }
            },
          );
          if (cancelado) {
            armada.geometria.dispose();
            return;
          }
          cacheDeMallas.current.set(archivo.archivoDeMallaId, armada);
          setMallasCargadas((prev) => ({
            ...prev,
            [archivo.archivoDeMallaId]: armada,
          }));
        }

        if (!cancelado) {
          setAvance(100);
          alCambiarEstado?.("listo");
        }
      } catch (falla) {
        if (!cancelado) {
          console.error("No se pudo abrir la vista del diseño:", falla);
          setError(true);
          alCambiarEstado?.("no-pude");
        }
      }
    }

    void cargarFaltantes();

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicesVisibles.join(","), intento, listaDeArchivos]);

  const indicesModelos = useMemo(
    () =>
      listaDeArchivos
        .map((_, idx) => idx)
        .filter((idx) => !esArchivoRestauracion(listaDeArchivos[idx].nombre)),
    [listaDeArchivos],
  );

  const indicesRestauraciones = useMemo(
    () =>
      listaDeArchivos
        .map((_, idx) => idx)
        .filter((idx) => esArchivoRestauracion(listaDeArchivos[idx].nombre)),
    [listaDeArchivos],
  );

  const todasVisibles =
    listaDeArchivos.length > 0 &&
    listaDeArchivos.every((_, idx) => Boolean(visibles[idx]));
  const algunaVisible = indicesVisibles.length > 0;

  function alternarTodas() {
    setImagenActivaId(null);
    if (todasVisibles) {
      setVisibles({});
    } else {
      const nuevo: Record<number, boolean> = {};
      listaDeArchivos.forEach((_, idx) => {
        nuevo[idx] = true;
      });
      setVisibles(nuevo);
    }
  }

  function alternarGrupo(indices: number[]) {
    setImagenActivaId(null);
    const todosEncendidos =
      indices.length > 0 && indices.every((idx) => Boolean(visibles[idx]));
    setVisibles((prev) => {
      const copia = { ...prev };
      for (const idx of indices) {
        copia[idx] = !todosEncendidos;
      }
      return copia;
    });
  }

  function alternarArchivo(idx: number) {
    setImagenActivaId(null);
    setVisibles((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  }

  function aislarArchivo(idx: number) {
    setImagenActivaId(null);
    setVisibles({ [idx]: true });
    setMenuAbiertoIdx(null);
  }

  function cambiarOpacidad(idx: number, valor: number) {
    setOpacidades((prev) => ({ ...prev, [idx]: valor }));
    setVisibles((prev) => ({ ...prev, [idx]: true }));
    setMenuAbiertoIdx(null);
  }

  function alternarModoMalla() {
    setModoMalla((actual) => {
      if (actual === "solido") return "solido-alambre";
      if (actual === "solido-alambre") return "alambre";
      return "solido";
    });
  }

  async function alternarPantallaCompleta() {
    const el = contenedorRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      setPantallaCompleta((v) => !v);
    }
  }

  const mallasParaPintar = indicesVisibles
    .map((idx) => {
      const info = listaDeArchivos[idx];
      if (!info) return null;
      const leida = mallasCargadas[info.archivoDeMallaId];
      if (!leida) return null;
      const esRestauracion =
        info.nombre.startsWith("[Restauración]") ||
        info.nombre.startsWith("[Restauracion]") ||
        /\b(restauraci[oó]n|inlay|onlay|crown|corona|cad)\b/i.test(info.nombre);
      return {
        id: info.archivoOriginalId,
        geometria: leida.geometria,
        opacidad: opacidades[idx] ?? 1,
        esRestauracion,
      };
    })
    .filter(
      (
        x,
      ): x is {
        id: string;
        geometria: THREE.BufferGeometry;
        opacidad: number;
        esRestauracion: boolean;
      } => x !== null,
    );

  // Marco de coordenadas compartido en milímetros (Exocad): todas las mallas
  // cargadas comparten el mismo centro y factor de escala global para que la
  // restauración embone exactamente donde fue diseñada dentro de la arcada.
  const transformacionCompartida = useMemo(() => {
    const todasCargadas = Object.values(mallasCargadas);
    const fuente =
      todasCargadas.length > 0
        ? todasCargadas.map((m) => m.geometria)
        : mallasParaPintar.map((m) => m.geometria);

    const cajaUnion = new THREE.Box3();
    for (const geom of fuente) {
      if (!geom.boundingBox) geom.computeBoundingBox();
      if (geom.boundingBox) {
        cajaUnion.union(geom.boundingBox);
      }
    }

    if (cajaUnion.isEmpty()) {
      return {
        escala: 1,
        posicion: [0, 0, 0] as [number, number, number],
      };
    }

    const esferaUnion = new THREE.Sphere();
    cajaUnion.getBoundingSphere(esferaUnion);
    const radio = esferaUnion.radius > 1e-5 ? esferaUnion.radius : 1;
    const escala = 1 / radio;
    const c = esferaUnion.center;

    return {
      escala,
      posicion: [-c.x * escala, -c.y * escala, -c.z * escala] as [
        number,
        number,
        number,
      ],
    };
  }, [mallasCargadas, mallasParaPintar]);

  const cargandoAlguna =
    algunaVisible && mallasParaPintar.length < indicesVisibles.length && !error;

  const colorFondoCanvas = temaClaro ? "#eef0f4" : "#181c23";

  const imagenActiva =
    imagenes.find((img) => img.id === imagenActivaId) ?? null;

  function renderFilaArchivo3D(idx: number) {
    const item = listaDeArchivos[idx];
    if (!item) return null;
    const esVisible = Boolean(visibles[idx]) && !imagenActiva;
    const opacidadActual = opacidades[idx] ?? 1;

    return (
      <li
        key={item.archivoOriginalId}
        className={cn(
          "relative flex items-center justify-between rounded-sm px-2 py-1",
          temaClaro ? "hover:bg-white/80" : "hover:bg-[#1b2029]",
        )}
      >
        <button
          type="button"
          onClick={() => alternarArchivo(idx)}
          title={item.nombre}
          className={cn(
            "min-w-0 flex-1 truncate pr-2 text-left text-[12.5px]",
            esVisible ? "font-medium" : "opacity-55",
          )}
        >
          {item.nombre}
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => alternarArchivo(idx)}
            title={
              esVisible ? `Ocultar ${item.nombre}` : `Mostrar ${item.nombre}`
            }
            className={cn(
              "rounded-xs p-0.5 opacity-80 hover:opacity-100",
              temaClaro ? "hover:bg-[#eef0f4]" : "hover:bg-[#262d3a]",
            )}
          >
            {esVisible ? (
              <Eye aria-hidden="true" size={16} />
            ) : (
              <EyeSlash aria-hidden="true" size={16} />
            )}
          </button>

          <button
            type="button"
            onClick={() =>
              setMenuAbiertoIdx(menuAbiertoIdx === idx ? null : idx)
            }
            title="Opciones de visualización"
            className={cn(
              "rounded-xs p-0.5 opacity-80 hover:opacity-100",
              temaClaro ? "hover:bg-[#eef0f4]" : "hover:bg-[#262d3a]",
            )}
          >
            <DotsThreeVertical aria-hidden="true" size={15} />
          </button>
        </div>

        {menuAbiertoIdx === idx ? (
          <div
            className={cn(
              "absolute top-full right-0 z-30 mt-1 w-40 rounded-md border p-1.5 text-[12px] shadow-md",
              temaClaro
                ? "border-[#dcdfe6] bg-white text-[#2c313a]"
                : "border-[#2c3340] bg-[#161a22] text-[#e7ebf2]",
            )}
          >
            <p className="px-2 py-1 text-[11px] font-semibold opacity-65">
              Opacidad de malla
            </p>
            {[1, 0.65, 0.35].map((valor) => (
              <button
                key={valor}
                type="button"
                onClick={() => cambiarOpacidad(idx, valor)}
                className={cn(
                  "flex w-full items-center justify-between rounded-xs px-2 py-1 text-left",
                  temaClaro ? "hover:bg-[#eef0f4]" : "hover:bg-[#232936]",
                  opacidadActual === valor && "font-semibold text-[#4b91ff]",
                )}
              >
                <span>{Math.round(valor * 100)}%</span>
                {opacidadActual === valor ? <span>✓</span> : null}
              </button>
            ))}
            {listaDeArchivos.length > 1 ? (
              <button
                type="button"
                onClick={() => aislarArchivo(idx)}
                className={cn(
                  "mt-1 w-full border-t px-2 pt-1.5 pb-1 text-left",
                  temaClaro
                    ? "border-[#eef0f4] hover:bg-[#eef0f4]"
                    : "border-[#2c3340] hover:bg-[#232936]",
                )}
              >
                Ver solo este archivo
              </button>
            ) : null}
          </div>
        ) : null}
      </li>
    );
  }

  return (
    <div
      ref={contenedorRef}
      className={cn(
        "overflow-hidden rounded-contenedor border select-none",
        temaClaro
          ? "border-[#d6dae1] bg-[#eef0f4] text-[#2c313a]"
          : "border-[#2c3340] bg-[#181c23] text-[#e7ebf2]",
        pantallaCompleta && "fixed inset-0 z-50 rounded-none border-0",
        className,
      )}
    >
      <div
        className={cn(
          "relative w-full overflow-hidden",
          temaClaro ? "bg-[#eef0f4]" : "bg-[#181c23]",
          pantallaCompleta
            ? "h-[calc(100vh-44px)]"
            : error
              ? "min-h-72"
              : "aspect-16/10 min-h-[500px] lg:min-h-[580px]",
        )}
      >
        {/* Escena 3D principal */}
        {!imagenActiva && mallasParaPintar.length > 0 ? (
          <EscenaMedit
            mallas={mallasParaPintar}
            transformacion={transformacionCompartida}
            descripcion={descripcion}
            herramienta={herramienta}
            conColor={conColor}
            modoMalla={modoMalla}
            colorFondo={colorFondoCanvas}
            objetivoRef={objetivoRef}
            cuboDomRef={cuboDomRef}
            peticionVista={peticionVista}
          />
        ) : null}

        {/* Vista de imagen seleccionada desde el árbol */}
        {imagenActiva ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/archivos/${imagenActiva.id}/contenido`}
              alt={`${imagenActiva.nombre} — ${descripcion}`}
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              className="max-h-full max-w-full rounded-md object-contain shadow-md"
            />
            {listaDeArchivos.length > 0 ? (
              <button
                type="button"
                onClick={() => setImagenActivaId(null)}
                className={cn(
                  "mt-3 rounded-md border px-3 py-1.5 text-menor font-medium shadow-xs",
                  temaClaro
                    ? "border-[#dcdfe6] bg-white text-[#2c313a] hover:bg-[#f0f2f5]"
                    : "border-[#2c3340] bg-[#11151b] text-[#e7ebf2] hover:bg-[#1b2029]",
                )}
              >
                Volver a la vista 3D
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Estado de carga o error */}
        {!imagenActiva && (cargandoAlguna || error || !algunaVisible) && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            {error ? (
              <div
                className={cn(
                  "pointer-events-auto flex flex-col items-center gap-3 rounded-lg border p-5 shadow-sm",
                  temaClaro
                    ? "border-[#d6dae1] bg-white/95 text-[#2c313a]"
                    : "border-[#2c3340] bg-[#11151b]/95 text-[#e7ebf2]",
                )}
              >
                <p className="text-cuerpo font-medium">
                  No pude abrir la vista 3D del diseño.
                </p>
                <p className="text-menor text-secundario">
                  Puede volver a intentarlo o avisarle a su técnico en el chat.
                </p>
                <Boton
                  type="button"
                  onClick={() => {
                    cacheDeMallas.current.clear();
                    setMallasCargadas({});
                    setIntento((i) => i + 1);
                  }}
                >
                  <ArrowClockwise aria-hidden="true" size={16} />
                  Volver a intentar
                </Boton>
              </div>
            ) : !algunaVisible ? (
              <p
                className={cn(
                  "rounded-md px-3 py-1.5 text-menor shadow-xs",
                  temaClaro
                    ? "bg-white/85 text-[#606775]"
                    : "border border-[#2c3340] bg-[#11151b]/90 text-[#a8acb2]",
                )}
              >
                Todos los archivos están ocultos. Active el ícono del ojo en el
                árbol izquierdo para mostrarlos.
              </p>
            ) : (
              <div
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg px-5 py-4 shadow-xs",
                  temaClaro
                    ? "bg-white/90 text-[#2c313a]"
                    : "border border-[#2c3340] bg-[#11151b]/90 text-[#e7ebf2]",
                )}
              >
                <p className="text-menor font-medium">
                  Cargando datos 3D… {avance}%
                </p>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={avance}
                  aria-label="Carga de la vista del diseño"
                  className={cn(
                    "h-1.5 w-48 overflow-hidden rounded-full",
                    temaClaro ? "bg-[#dcdfe6]" : "bg-[#2c3340]",
                  )}
                >
                  <div
                    className="h-full rounded-full bg-[#2b7de9] transition-[width] duration-200"
                    style={{ width: `${avance}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Botón superior izquierdo para mostrar/ocultar el árbol (como en Medit Link) */}
        <div className="absolute top-3 left-3 z-20 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setPanelArbolAbierto((v) => !v)}
            title={
              panelArbolAbierto
                ? "Ocultar árbol de archivos"
                : "Mostrar árbol de archivos"
            }
            aria-expanded={panelArbolAbierto}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md border transition-colors",
              temaClaro
                ? panelArbolAbierto
                  ? "border-[#c6cbd4] bg-white text-[#2c313a] shadow-xs"
                  : "border-[#d6dae1] bg-white/85 text-[#606775] hover:bg-white hover:text-[#2c313a]"
                : panelArbolAbierto
                  ? "border-[#3c4454] bg-[#11151b] text-[#e7ebf2] shadow-xs"
                  : "border-[#2c3340] bg-[#11151b]/80 text-[#a8acb2] hover:bg-[#11151b] hover:text-white",
            )}
          >
            <ListBullets aria-hidden="true" size={18} weight="bold" />
          </button>

          {/* Árbol de archivos estilo Medit Link: Attachment -> 3D Data (Quijadas / Restauraciones) + Imágenes */}
          {panelArbolAbierto ? (
            <div
              className={cn(
                "w-64 rounded-md border p-2 text-[13px] shadow-sm backdrop-blur-xs sm:w-72",
                temaClaro
                  ? "border-[#dcdfe6] bg-[#f4f5f8]/95 text-[#2c313a]"
                  : "border-[#2c3340] bg-[#11151b]/95 text-[#e7ebf2]",
              )}
            >
              {/* Nivel 1: Attachment */}
              <div
                className={cn(
                  "flex items-center justify-between rounded-sm px-2 py-1.5 shadow-2xs",
                  temaClaro ? "bg-white" : "bg-[#1b2029]",
                )}
              >
                <button
                  type="button"
                  onClick={() => setAbiertoAttachment((v) => !v)}
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-left font-medium"
                >
                  {abiertoAttachment ? (
                    <MinusSquare
                      aria-hidden="true"
                      size={15}
                      className="shrink-0 opacity-70"
                    />
                  ) : (
                    <PlusSquare
                      aria-hidden="true"
                      size={15}
                      className="shrink-0 opacity-70"
                    />
                  )}
                  <span className="truncate">Attachment</span>
                </button>
                <div className="flex items-center gap-1">
                  {listaDeArchivos.length > 0 ? (
                    <button
                      type="button"
                      onClick={alternarTodas}
                      title={
                        todasVisibles
                          ? "Ocultar todos los modelos"
                          : "Mostrar todos los modelos"
                      }
                      className={cn(
                        "rounded-xs p-0.5 opacity-80 hover:opacity-100",
                        temaClaro
                          ? "hover:bg-[#eef0f4]"
                          : "hover:bg-[#262d3a]",
                      )}
                    >
                      {algunaVisible && !imagenActiva ? (
                        <Eye aria-hidden="true" size={16} />
                      ) : (
                        <EyeSlash aria-hidden="true" size={16} />
                      )}
                    </button>
                  ) : null}
                  <DotsThreeVertical
                    aria-hidden="true"
                    size={15}
                    className="opacity-50"
                  />
                </div>
              </div>

              {abiertoAttachment ? (
                <div className="mt-1 flex flex-col gap-1 pl-3">
                  {/* Nivel 2A: 3D Data */}
                  {listaDeArchivos.length > 0 ? (
                    <div>
                      <div className="flex items-center justify-between rounded-sm px-2 py-1">
                        <button
                          type="button"
                          onClick={() => setAbierto3DData((v) => !v)}
                          className="flex min-w-0 flex-1 items-center gap-1.5 text-left font-medium"
                        >
                          {abierto3DData ? (
                            <MinusSquare
                              aria-hidden="true"
                              size={15}
                              className="shrink-0 opacity-70"
                            />
                          ) : (
                            <PlusSquare
                              aria-hidden="true"
                              size={15}
                              className="shrink-0 opacity-70"
                            />
                          )}
                          <span className="truncate">3D Data</span>
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={alternarTodas}
                            title={
                              todasVisibles
                                ? "Ocultar 3D Data"
                                : "Mostrar 3D Data"
                            }
                            className={cn(
                              "rounded-xs p-0.5 opacity-80 hover:opacity-100",
                              temaClaro
                                ? "hover:bg-white"
                                : "hover:bg-[#1b2029]",
                            )}
                          >
                            {algunaVisible && !imagenActiva ? (
                              <Eye aria-hidden="true" size={16} />
                            ) : (
                              <EyeSlash aria-hidden="true" size={16} />
                            )}
                          </button>
                          <DotsThreeVertical
                            aria-hidden="true"
                            size={15}
                            className="opacity-50"
                          />
                        </div>
                      </div>

                      {/* Nivel 3 dentro de 3D Data: separado en Quijadas / Modelos y Restauraciones */}
                      {abierto3DData ? (
                        <div className="mt-0.5 flex flex-col gap-1 pl-3">
                          {/* Sub-sección 1: Quijadas y conjunto completo */}
                          {indicesModelos.length > 0 ? (
                            <div>
                              <div className="flex items-center justify-between rounded-sm px-2 py-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setAbiertoModelos((v) => !v)
                                  }
                                  className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-[12.5px] font-medium"
                                >
                                  {abiertoModelos ? (
                                    <MinusSquare
                                      aria-hidden="true"
                                      size={14}
                                      className="shrink-0 opacity-70"
                                    />
                                  ) : (
                                    <PlusSquare
                                      aria-hidden="true"
                                      size={14}
                                      className="shrink-0 opacity-70"
                                    />
                                  )}
                                  <span className="truncate">
                                    Quijadas y conjunto
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    alternarGrupo(indicesModelos)
                                  }
                                  title="Alternar visibilidad de quijadas y conjunto"
                                  className={cn(
                                    "rounded-xs p-0.5 opacity-80 hover:opacity-100",
                                    temaClaro
                                      ? "hover:bg-white"
                                      : "hover:bg-[#1b2029]",
                                  )}
                                >
                                  {indicesModelos.some((i) => visibles[i]) &&
                                  !imagenActiva ? (
                                    <Eye aria-hidden="true" size={15} />
                                  ) : (
                                    <EyeSlash aria-hidden="true" size={15} />
                                  )}
                                </button>
                              </div>
                              {abiertoModelos ? (
                                <ul className="mt-0.5 flex flex-col gap-0.5 pl-4">
                                  {indicesModelos.map((idx) =>
                                    renderFilaArchivo3D(idx),
                                  )}
                                </ul>
                              ) : null}
                            </div>
                          ) : null}

                          {/* Sub-sección 2: Restauraciones */}
                          {indicesRestauraciones.length > 0 ? (
                            <div>
                              <div className="flex items-center justify-between rounded-sm px-2 py-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setAbiertoRestauraciones((v) => !v)
                                  }
                                  className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-[12.5px] font-medium"
                                >
                                  {abiertoRestauraciones ? (
                                    <MinusSquare
                                      aria-hidden="true"
                                      size={14}
                                      className="shrink-0 opacity-70"
                                    />
                                  ) : (
                                    <PlusSquare
                                      aria-hidden="true"
                                      size={14}
                                      className="shrink-0 opacity-70"
                                    />
                                  )}
                                  <span className="truncate">
                                    Restauraciones
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    alternarGrupo(indicesRestauraciones)
                                  }
                                  title="Alternar visibilidad de restauraciones"
                                  className={cn(
                                    "rounded-xs p-0.5 opacity-80 hover:opacity-100",
                                    temaClaro
                                      ? "hover:bg-white"
                                      : "hover:bg-[#1b2029]",
                                  )}
                                >
                                  {indicesRestauraciones.some(
                                    (i) => visibles[i],
                                  ) && !imagenActiva ? (
                                    <Eye aria-hidden="true" size={15} />
                                  ) : (
                                    <EyeSlash aria-hidden="true" size={15} />
                                  )}
                                </button>
                              </div>
                              {abiertoRestauraciones ? (
                                <ul className="mt-0.5 flex flex-col gap-0.5 pl-4">
                                  {indicesRestauraciones.map((idx) =>
                                    renderFilaArchivo3D(idx),
                                  )}
                                </ul>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Nivel 2B: Nueva sección de Imágenes dentro del árbol Attachment */}
                  {imagenes.length > 0 ? (
                    <div>
                      <div className="flex items-center justify-between rounded-sm px-2 py-1">
                        <button
                          type="button"
                          onClick={() => setAbiertoImagenes((v) => !v)}
                          className="flex min-w-0 flex-1 items-center gap-1.5 text-left font-medium"
                        >
                          {abiertoImagenes ? (
                            <MinusSquare
                              aria-hidden="true"
                              size={15}
                              className="shrink-0 opacity-70"
                            />
                          ) : (
                            <PlusSquare
                              aria-hidden="true"
                              size={15}
                              className="shrink-0 opacity-70"
                            />
                          )}
                          <span className="truncate">Imágenes</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setImagenActivaId(
                              imagenActiva ? null : (imagenes[0]?.id ?? null),
                            )
                          }
                          title={
                            imagenActiva
                              ? "Ocultar imagen y volver al visor 3D"
                              : "Mostrar imagen en el visor"
                          }
                          className={cn(
                            "rounded-xs p-0.5 opacity-80 hover:opacity-100",
                            temaClaro
                              ? "hover:bg-white"
                              : "hover:bg-[#1b2029]",
                          )}
                        >
                          {imagenActiva ? (
                            <Eye aria-hidden="true" size={16} />
                          ) : (
                            <EyeSlash aria-hidden="true" size={16} />
                          )}
                        </button>
                      </div>

                      {abiertoImagenes ? (
                        <ul className="mt-0.5 flex flex-col gap-0.5 pl-4">
                          {imagenes.map((img) => {
                            const activa = imagenActivaId === img.id;
                            return (
                              <li
                                key={img.id}
                                className={cn(
                                  "flex items-center justify-between rounded-sm px-2 py-1",
                                  temaClaro
                                    ? "hover:bg-white/80"
                                    : "hover:bg-[#1b2029]",
                                )}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setImagenActivaId(activa ? null : img.id)
                                  }
                                  title={img.nombre}
                                  className={cn(
                                    "min-w-0 flex-1 truncate pr-2 text-left text-[12.5px]",
                                    activa ? "font-medium" : "opacity-55",
                                  )}
                                >
                                  {img.nombre}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setImagenActivaId(activa ? null : img.id)
                                  }
                                  title={
                                    activa
                                      ? `Ocultar ${img.nombre}`
                                      : `Mostrar ${img.nombre}`
                                  }
                                  className={cn(
                                    "rounded-xs p-0.5 opacity-80 hover:opacity-100",
                                    temaClaro
                                      ? "hover:bg-[#eef0f4]"
                                      : "hover:bg-[#262d3a]",
                                  )}
                                >
                                  {activa ? (
                                    <Eye aria-hidden="true" size={16} />
                                  ) : (
                                    <EyeSlash aria-hidden="true" size={16} />
                                  )}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Botón de pantalla completa arriba a la derecha (como en Medit Link) */}
        <button
          type="button"
          onClick={() => void alternarPantallaCompleta()}
          title={
            pantallaCompleta
              ? "Salir de pantalla completa"
              : "Pantalla completa"
          }
          className={cn(
            "absolute top-3 right-3 z-20 flex h-8 w-8 items-center justify-center rounded-md border shadow-2xs transition-colors",
            temaClaro
              ? "border-[#dcdfe6] bg-white/90 text-[#606775] hover:bg-white hover:text-[#2c313a]"
              : "border-[#2c3340] bg-[#11151b]/90 text-[#a8acb2] hover:bg-[#11151b] hover:text-white",
          )}
        >
          {pantallaCompleta ? (
            <CornersIn aria-hidden="true" size={17} />
          ) : (
            <CornersOut aria-hidden="true" size={17} />
          )}
        </button>

        {/* Barra de herramientas derecha estilo Medit Link (las 6 herramientas de la imagen) */}
        <div
          role="toolbar"
          aria-label="Herramientas del visor 3D"
          className={cn(
            "absolute top-1/2 right-3 z-20 flex -translate-y-1/2 flex-col items-center gap-1 rounded-md border px-1.5 py-2 shadow-sm",
            temaClaro
              ? "border-[#dcdfe6] bg-white"
              : "border-[#2c3340] bg-[#11151b]/95",
          )}
        >
          {/* 1. Mover (Pan) */}
          <button
            type="button"
            onClick={() => setHerramienta("pan")}
            aria-pressed={herramienta === "pan"}
            title="Mover (Pan)"
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-sm transition-colors",
              herramienta === "pan"
                ? "text-[#4b91ff]"
                : temaClaro
                  ? "text-[#606775] hover:bg-[#f0f2f5] hover:text-[#2c313a]"
                  : "text-[#a8acb2] hover:bg-[#1b2029] hover:text-white",
            )}
          >
            <ArrowsOutCardinal aria-hidden="true" size={20} weight="regular" />
          </button>

          {/* 2. Rotar */}
          <button
            type="button"
            onClick={() => setHerramienta("rotar")}
            aria-pressed={herramienta === "rotar"}
            title="Rotar modelo"
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-sm transition-colors",
              herramienta === "rotar"
                ? "text-[#4b91ff]"
                : temaClaro
                  ? "text-[#606775] hover:bg-[#f0f2f5] hover:text-[#2c313a]"
                  : "text-[#a8acb2] hover:bg-[#1b2029] hover:text-white",
            )}
          >
            <IconoRotarMedit />
          </button>

          {/* 3. Zoom */}
          <button
            type="button"
            onClick={() => {
              if (herramienta === "zoom") {
                setPeticionVista((prev) => ({
                  zoomDelta: -0.5,
                  seq: (prev?.seq ?? 0) + 1,
                }));
              } else {
                setHerramienta("zoom");
              }
            }}
            aria-pressed={herramienta === "zoom"}
            title="Acercar / Alejar (Zoom)"
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-sm transition-colors",
              herramienta === "zoom"
                ? "text-[#4b91ff]"
                : temaClaro
                  ? "text-[#606775] hover:bg-[#f0f2f5] hover:text-[#2c313a]"
                  : "text-[#a8acb2] hover:bg-[#1b2029] hover:text-white",
            )}
          >
            <MagnifyingGlassPlus aria-hidden="true" size={20} />
          </button>

          {/* 4. Zoom Fit (encuadrar en pantalla) */}
          <button
            type="button"
            onClick={() =>
              setPeticionVista((prev) => ({
                fit: true,
                seq: (prev?.seq ?? 0) + 1,
              }))
            }
            title="Ajustar modelo a la pantalla"
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-sm transition-colors",
              temaClaro
                ? "text-[#606775] hover:bg-[#f0f2f5] hover:text-[#2c313a]"
                : "text-[#a8acb2] hover:bg-[#1b2029] hover:text-white",
            )}
          >
            <IconoZoomFitMedit />
          </button>

          {/* 5. Textura / Color (esfera arcoíris de Medit Link) */}
          <button
            type="button"
            onClick={() => setConColor((v) => !v)}
            aria-pressed={conColor}
            title={
              conColor
                ? "Cambiar a modelo monocromático (yeso)"
                : "Mostrar color dental"
            }
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-sm transition-opacity",
              conColor ? "opacity-100" : "opacity-55 hover:opacity-85",
            )}
          >
            <IconoEsferaColorMedit />
          </button>

          {/* 6. Modo de visualización de malla (cubo 3D con fondo celeste activo) */}
          <button
            type="button"
            onClick={alternarModoMalla}
            title={
              modoMalla === "solido"
                ? "Vista sólida (clic para sólido + malla)"
                : modoMalla === "solido-alambre"
                  ? "Vista sólido + malla (clic para solo alambre)"
                  : "Vista de alambre (clic para vista sólida)"
            }
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-sm transition-colors",
              temaClaro
                ? modoMalla === "solido"
                  ? "bg-[#bfe0ff]"
                  : modoMalla === "solido-alambre"
                    ? "bg-[#d8ecff] ring-1 ring-[#2b7de9]"
                    : "bg-[#f0f2f5]"
                : modoMalla === "solido"
                  ? "bg-[#1e3a5f]"
                  : modoMalla === "solido-alambre"
                    ? "bg-[#1e3a5f] ring-1 ring-[#4b91ff]"
                    : "bg-[#1b2029]",
            )}
          >
            <IconoCuboModoMedit modo={modoMalla} />
          </button>
        </div>

        {/* Cubo 3D de orientación ("caras" +X, -X, +Y, -Y, +Z, -Z) abajo a la derecha */}
        <div
          aria-label="Cubo de orientación de caras 3D"
          className="absolute right-6 bottom-5 z-20 flex h-16 w-16 items-center justify-center"
          style={{ perspective: "260px" }}
        >
          <div
            ref={cuboDomRef}
            className="relative h-11 w-11"
            style={{
              transformStyle: "preserve-3d",
              transform: "matrix3d(1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1)",
            }}
          >
            {(
              [
                { cara: "+Z" as const, transform: "translateZ(22px)" },
                {
                  cara: "-Z" as const,
                  transform: "rotateY(180deg) translateZ(22px)",
                },
                {
                  cara: "+X" as const,
                  transform: "rotateY(90deg) translateZ(22px)",
                },
                {
                  cara: "-X" as const,
                  transform: "rotateY(-90deg) translateZ(22px)",
                },
                {
                  cara: "+Y" as const,
                  transform: "rotateX(90deg) translateZ(22px)",
                },
                {
                  cara: "-Y" as const,
                  transform: "rotateX(-90deg) translateZ(22px)",
                },
              ] as const
            ).map(({ cara, transform }) => (
              <CaraDelCubo
                key={cara}
                etiqueta={cara}
                transform={transform}
                temaClaro={temaClaro}
                alElegir={(c) =>
                  setPeticionVista((prev) => ({
                    cara: c,
                    seq: (prev?.seq ?? 0) + 1,
                  }))
                }
              />
            ))}
          </div>
        </div>
      </div>

      {/* Pie discreto de seguridad */}
      <div
        className={cn(
          "flex items-center justify-between gap-2 border-t px-3 py-2 text-minimo",
          temaClaro
            ? "border-[#dcdfe6] bg-white text-[#606775]"
            : "border-[#2c3340] bg-[#11151b] text-[#a8acb2]",
        )}
      >
        <span>
          {herramienta === "pan"
            ? "Modo mover activo · Arrastre para desplazar el modelo"
            : herramienta === "zoom"
              ? "Modo zoom activo · Arrastre o use la rueda para acercar"
              : "Modo rotar activo · Toque una cara del cubo (+X, +Y, +Z) para alinear la vista"}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1">
          <Lock aria-hidden="true" size={13} />
          Solo lectura en visor
        </span>
      </div>
    </div>
  );
}

function CaraDelCubo({
  etiqueta,
  transform,
  temaClaro,
  alElegir,
}: {
  etiqueta: CaraCubo;
  transform: string;
  temaClaro: boolean;
  alElegir: (cara: CaraCubo) => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        alElegir(etiqueta);
      }}
      title={`Ver cara ${etiqueta}`}
      style={{
        transform,
        backfaceVisibility: "hidden",
      }}
      className={cn(
        "absolute inset-0 flex items-center justify-center border text-[12px] font-bold tracking-tight shadow-2xs transition-colors",
        temaClaro
          ? "border-[#b5bcc7] bg-[#f8f9fb]/95 text-[#333942] hover:bg-[#e3f0ff] hover:text-[#2b7de9]"
          : "border-[#3c4454] bg-[#222834]/95 text-[#e7ebf2] hover:bg-[#1e3a5f] hover:text-[#77acff]",
      )}
    >
      {etiqueta}
    </button>
  );
}

function IconoRotarMedit() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 4a8 8 0 0 1 6.93 12" />
      <path d="M12 20a8 8 0 0 1-6.93-12" strokeDasharray="2.5 3" />
      <polyline points="15 4 12 4 12 7" />
    </svg>
  );
}

function IconoZoomFitMedit() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="10.5" cy="10.5" r="6.5" />
      <rect x="8" y="8" width="5" height="5" rx="0.6" />
      <line x1="15.5" y1="15.5" x2="20" y2="20" />
    </svg>
  );
}

function IconoEsferaColorMedit() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="rounded-full"
    >
      <defs>
        <radialGradient id="medit-rainbow" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="28%" stopColor="#ff4fd8" />
          <stop offset="55%" stopColor="#ffbb00" />
          <stop offset="78%" stopColor="#16d64d" />
          <stop offset="100%" stopColor="#1769ff" />
        </radialGradient>
      </defs>
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="url(#medit-rainbow)"
        stroke="#8d96a5"
        strokeWidth="0.7"
      />
    </svg>
  );
}

function IconoCuboModoMedit({ modo }: { modo: ModoMalla }) {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <polygon
        points="12,3 20,7.5 12,12 4,7.5"
        fill={modo === "alambre" ? "none" : "#eef1f6"}
        stroke="#7d8696"
        strokeWidth="1.4"
      />
      <polygon
        points="4,7.5 12,12 12,21 4,16.5"
        fill={modo === "alambre" ? "none" : "#9aa3b2"}
        stroke="#7d8696"
        strokeWidth="1.4"
      />
      <polygon
        points="20,7.5 12,12 12,21 20,16.5"
        fill={modo === "alambre" ? "none" : "#d8dde6"}
        stroke="#7d8696"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function LucesDeEstudio() {
  const luzPrincipal = useRef<THREE.DirectionalLight>(null);
  const luzRelleno = useRef<THREE.DirectionalLight>(null);
  const luzContraluz = useRef<THREE.DirectionalLight>(null);

  useFrame(({ camera }) => {
    const derecha = new THREE.Vector3(1, 0, 0).applyQuaternion(
      camera.quaternion,
    );
    const arriba = new THREE.Vector3(0, 1, 0).applyQuaternion(
      camera.quaternion,
    );
    const frente = camera.position.clone().normalize();

    if (luzPrincipal.current) {
      luzPrincipal.current.position
        .copy(frente)
        .multiplyScalar(5)
        .addScaledVector(derecha, 2.2)
        .addScaledVector(arriba, 2.6);
    }
    if (luzRelleno.current) {
      luzRelleno.current.position
        .copy(frente)
        .multiplyScalar(4.5)
        .addScaledVector(derecha, -2.8)
        .addScaledVector(arriba, -1.2);
    }
    if (luzContraluz.current) {
      luzContraluz.current.position
        .copy(frente)
        .multiplyScalar(-4)
        .addScaledVector(arriba, 3);
    }
  });

  return (
    <>
      <hemisphereLight args={["#ffffff", "#e5d7c6", 0.7]} />
      <directionalLight
        ref={luzPrincipal}
        position={[2.5, 3, 5]}
        intensity={1.55}
      />
      <directionalLight
        ref={luzRelleno}
        position={[-3, -1.5, 4]}
        intensity={0.65}
      />
      <directionalLight
        ref={luzContraluz}
        position={[0, 3, -4]}
        intensity={0.35}
      />
    </>
  );
}

function ControlesLibres360({
  herramienta,
  objetivoRef,
  cuboDomRef,
  peticionVista,
}: {
  herramienta: HerramientaActiva;
  objetivoRef: React.RefObject<THREE.Vector3>;
  cuboDomRef: React.RefObject<HTMLDivElement | null>;
  peticionVista: {
    cara?: CaraCubo;
    fit?: boolean;
    zoomDelta?: number;
    seq: number;
  } | null;
}) {
  const { camera, gl } = useThree();
  const matrizAux = useMemo(() => new THREE.Matrix4(), []);
  const quatAux = useMemo(() => new THREE.Quaternion(), []);
  const velRotacion = useRef({ dx: 0, dy: 0 });

  // Rotación libre 360° relativa a los ejes actuales de la pantalla (sin bloqueo polar)
  const rotarRespectoAPantalla = useMemo(
    () => (dx: number, dy: number) => {
      const objetivo = objetivoRef.current;
      const offset = camera.position.clone().sub(objetivo);
      const distancia = offset.length();
      if (distancia < 1e-5) return;

      const frente = offset.clone().negate().normalize();
      const arriba = camera.up.clone().normalize();
      const derecha = new THREE.Vector3().crossVectors(frente, arriba).normalize();
      if (derecha.lengthSq() < 1e-5) {
        derecha.set(1, 0, 0);
      }
      const arribaOrto = new THREE.Vector3()
        .crossVectors(derecha, frente)
        .normalize();

      const velocidad = 0.0075;
      const qHorizontal = new THREE.Quaternion().setFromAxisAngle(
        arribaOrto,
        -dx * velocidad,
      );
      const qVertical = new THREE.Quaternion().setFromAxisAngle(
        derecha,
        -dy * velocidad,
      );
      const qTotal = qHorizontal.multiply(qVertical);

      offset.applyQuaternion(qTotal);
      arribaOrto.applyQuaternion(qTotal);

      camera.position.copy(objetivo).add(offset);
      camera.up.copy(arribaOrto);
      camera.lookAt(objetivo);
    },
    [camera, objetivoRef],
  );

  const desplazarRespectoAPantalla = useMemo(
    () => (dx: number, dy: number) => {
      const objetivo = objetivoRef.current;
      const offset = camera.position.clone().sub(objetivo);
      const distancia = offset.length();
      const frente = offset.clone().negate().normalize();
      const derecha = new THREE.Vector3()
        .crossVectors(frente, camera.up)
        .normalize();
      const arriba = new THREE.Vector3()
        .crossVectors(derecha, frente)
        .normalize();

      const factor = distancia * 0.0016;
      const delta = derecha
        .multiplyScalar(-dx * factor)
        .addScaledVector(arriba, dy * factor);

      objetivo.add(delta);
      camera.position.add(delta);
    },
    [camera, objetivoRef],
  );

  const aplicarZoom = useMemo(
    () => (factorEscala: number) => {
      const objetivo = objetivoRef.current;
      const dir = camera.position.clone().sub(objetivo);
      const nuevaDist = THREE.MathUtils.clamp(
        dir.length() * factorEscala,
        0.9,
        10,
      );
      dir.normalize().multiplyScalar(nuevaDist);
      camera.position.copy(objetivo).add(dir);
    },
    [camera, objetivoRef],
  );

  useEffect(() => {
    const dom = gl.domElement;

    let arrastrando = false;
    let botonActivo = 0;
    let ultimoX = 0;
    let ultimoY = 0;
    const punteros = new Map<number, { x: number; y: number }>();
    let distanciaPellizcoPrevia: number | null = null;

    function alPresionar(e: PointerEvent) {
      punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
      dom.setPointerCapture(e.pointerId);
      arrastrando = true;
      botonActivo = e.button;
      ultimoX = e.clientX;
      ultimoY = e.clientY;
      velRotacion.current = { dx: 0, dy: 0 };

      if (punteros.size === 2) {
        const pts = Array.from(punteros.values());
        distanciaPellizcoPrevia = Math.hypot(
          pts[0].x - pts[1].x,
          pts[0].y - pts[1].y,
        );
      }
    }

    function alMover(e: PointerEvent) {
      if (!arrastrando || !punteros.has(e.pointerId)) return;
      punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (punteros.size === 2) {
        const pts = Array.from(punteros.values());
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (distanciaPellizcoPrevia && distanciaPellizcoPrevia > 5) {
          aplicarZoom(distanciaPellizcoPrevia / dist);
        }
        distanciaPellizcoPrevia = dist;
        return;
      }

      const dx = e.clientX - ultimoX;
      const dy = e.clientY - ultimoY;
      ultimoX = e.clientX;
      ultimoY = e.clientY;

      // Clic derecho o botón central o Shift siempre mueven (Pan)
      if (botonActivo === 2 || botonActivo === 1 || e.shiftKey || herramienta === "pan") {
        desplazarRespectoAPantalla(dx, dy);
      } else if (herramienta === "zoom") {
        aplicarZoom(1 + dy * 0.006);
      } else {
        rotarRespectoAPantalla(dx, dy);
        velRotacion.current = { dx, dy };
      }
    }

    function alSoltar(e: PointerEvent) {
      punteros.delete(e.pointerId);
      if (dom.hasPointerCapture(e.pointerId)) {
        dom.releasePointerCapture(e.pointerId);
      }
      if (punteros.size < 2) {
        distanciaPellizcoPrevia = null;
      }
      if (punteros.size === 0) {
        arrastrando = false;
      }
    }

    function alGirarRueda(e: WheelEvent) {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.09 : 0.91;
      aplicarZoom(factor);
    }

    function alMenuContextual(e: MouseEvent) {
      e.preventDefault();
    }

    dom.addEventListener("pointerdown", alPresionar);
    dom.addEventListener("pointermove", alMover);
    dom.addEventListener("pointerup", alSoltar);
    dom.addEventListener("pointercancel", alSoltar);
    dom.addEventListener("wheel", alGirarRueda, { passive: false });
    dom.addEventListener("contextmenu", alMenuContextual);

    return () => {
      dom.removeEventListener("pointerdown", alPresionar);
      dom.removeEventListener("pointermove", alMover);
      dom.removeEventListener("pointerup", alSoltar);
      dom.removeEventListener("pointercancel", alSoltar);
      dom.removeEventListener("wheel", alGirarRueda);
      dom.removeEventListener("contextmenu", alMenuContextual);
    };
  }, [
    gl,
    herramienta,
    rotarRespectoAPantalla,
    desplazarRespectoAPantalla,
    aplicarZoom,
  ]);

  useEffect(() => {
    if (!peticionVista) return;
    const objetivo = objetivoRef.current;
    velRotacion.current = { dx: 0, dy: 0 };

    if (peticionVista.fit) {
      objetivo.set(0, 0, 0);
      camera.position.set(0, 0, 3.8);
      camera.up.set(0, 1, 0);
      camera.lookAt(0, 0, 0);
      return;
    }

    if (typeof peticionVista.zoomDelta === "number") {
      aplicarZoom(peticionVista.zoomDelta < 0 ? 0.85 : 1.15);
      return;
    }

    if (peticionVista.cara) {
      const def = VECTORES_CARA[peticionVista.cara];
      const distancia = THREE.MathUtils.clamp(
        camera.position.distanceTo(objetivo),
        2.0,
        9,
      );
      camera.position.set(
        objetivo.x + def.pos[0] * distancia,
        objetivo.y + def.pos[1] * distancia,
        objetivo.z + def.pos[2] * distancia,
      );
      camera.up.set(def.up[0], def.up[1], def.up[2]);
      camera.lookAt(objetivo);
    }
  }, [peticionVista, camera, objetivoRef, aplicarZoom]);

  useFrame(() => {
    // Inercia suave al soltar la rotación
    const v = velRotacion.current;
    if (Math.abs(v.dx) > 0.08 || Math.abs(v.dy) > 0.08) {
      rotarRespectoAPantalla(v.dx, v.dy);
      v.dx *= 0.84;
      v.dy *= 0.84;
    } else {
      v.dx = 0;
      v.dy = 0;
    }

    const el = cuboDomRef.current;
    if (!el) return;

    quatAux.copy(camera.quaternion).invert();
    matrizAux.makeRotationFromQuaternion(quatAux);
    const e = matrizAux.elements;

    const cssMatrix = [
      e[0],
      -e[1],
      e[2],
      0,
      -e[4],
      e[5],
      -e[6],
      0,
      e[8],
      -e[9],
      e[10],
      0,
      0,
      0,
      0,
      1,
    ].join(",");

    el.style.transform = `matrix3d(${cssMatrix})`;
  });

  return null;
}

function PiezaMalla({
  geometria,
  opacidad,
  conColor,
  esRestauracion,
  modoMalla,
}: {
  geometria: THREE.BufferGeometry;
  opacidad: number;
  conColor: boolean;
  esRestauracion: boolean;
  modoMalla: ModoMalla;
}) {
  const materialPrincipal = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: conColor
          ? esRestauracion
            ? "#fbfaf7"
            : "#e6d2bc"
          : esRestauracion
            ? "#eef1f6"
            : "#cfd4dc",
        roughness: conColor ? (esRestauracion ? 0.25 : 0.4) : 0.52,
        metalness: 0.03,
        clearcoat: conColor ? (esRestauracion ? 0.28 : 0.12) : 0.04,
        clearcoatRoughness: 0.3,
        reflectivity: 0.55,
        side: THREE.DoubleSide,
        transparent: opacidad < 1,
        opacity: opacidad,
        wireframe: modoMalla === "alambre",
      }),
    [conColor, esRestauracion, opacidad, modoMalla],
  );

  const materialAlambre = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#6b7280",
        wireframe: true,
        transparent: true,
        opacity: 0.25 * opacidad,
      }),
    [opacidad],
  );

  useEffect(() => {
    return () => {
      materialPrincipal.dispose();
      materialAlambre.dispose();
    };
  }, [materialPrincipal, materialAlambre]);

  return (
    <group>
      <mesh geometry={geometria} material={materialPrincipal} />
      {modoMalla === "solido-alambre" ? (
        <mesh geometry={geometria} material={materialAlambre} />
      ) : null}
    </group>
  );
}

function EscenaMedit({
  mallas,
  transformacion,
  descripcion,
  herramienta,
  conColor,
  modoMalla,
  colorFondo,
  objetivoRef,
  cuboDomRef,
  peticionVista,
}: {
  mallas: {
    id: string;
    geometria: THREE.BufferGeometry;
    opacidad: number;
    esRestauracion: boolean;
  }[];
  transformacion: {
    escala: number;
    posicion: [number, number, number];
  };
  descripcion: string;
  herramienta: HerramientaActiva;
  conColor: boolean;
  modoMalla: ModoMalla;
  colorFondo: string;
  objetivoRef: React.RefObject<THREE.Vector3>;
  cuboDomRef: React.RefObject<HTMLDivElement | null>;
  peticionVista: {
    cara?: CaraCubo;
    fit?: boolean;
    zoomDelta?: number;
    seq: number;
  } | null;
}) {
  return (
    <Canvas
      className="touch-none"
      camera={{ position: [0, 0, 3.8], fov: 35 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
      aria-label={descripcion}
      role="img"
    >
      <color attach="background" args={[colorFondo]} />
      <LucesDeEstudio />

      <group
        scale={transformacion.escala}
        position={transformacion.posicion}
      >
        {mallas.map((m) => (
          <PiezaMalla
            key={m.id}
            geometria={m.geometria}
            opacidad={m.opacidad}
            conColor={conColor}
            esRestauracion={m.esRestauracion}
            modoMalla={modoMalla}
          />
        ))}
      </group>

      <ControlesLibres360
        herramienta={herramienta}
        objetivoRef={objetivoRef}
        cuboDomRef={cuboDomRef}
        peticionVista={peticionVista}
      />
    </Canvas>
  );
}
