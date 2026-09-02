"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  UploadSimple,
  Trash,
  CheckCircle,
  Plus,
  WifiSlash,
} from "@phosphor-icons/react";
import { Boton } from "@/componentes/Boton";
import { cn } from "@/lib/utilidades";
import { enTamano } from "@/lib/formato";
import {
  subirArchivo,
  quitarArchivo,
  type AvanceDeSubida,
  type TipoDeArchivoSubido,
} from "@/lib/subida";

/**
 * Zona de archivos (SKILL.md §5.4 "FileDropzone", O-2).
 *
 * Se arrastra o se escoge. Barra de progreso por archivo y reanudación si se
 * cae la señal, nunca reinicio (§6.6). En el celular, el botón abre la cámara o
 * los archivos del teléfono.
 *
 * En cuanto hay algo subido, el recuadro punteado se quita y deja su lugar a la
 * lista: con tres apartados llenos, tres recuadros de invitación no invitan a
 * nada y alargan la pantalla. Para mandar otro archivo del mismo apartado queda
 * el botón de arriba, junto a los botes de basura. Soltar un archivo encima
 * sigue funcionando igual, esté abierto o no.
 */

export type ArchivoYaSubido = {
  id: string;
  nombre: string;
  bytesTotales: number;
  tipo: TipoDeArchivoSubido;
};

type EnPantalla = AvanceDeSubida & {
  clave: string;
  nombre: string;
  tipo: TipoDeArchivoSubido;
};

const ACEPTA_ESCANEO = ".stl,.ply,.obj,.dcm,.dicom,.zip";
const ACEPTA_FOTO = "image/*";

const TIPOS_DE_FOTO = [
  "FOTO_COLOR",
  "FOTO_CALIDAD_AJUSTE",
  "FOTO_CALIDAD_COLOR",
];

export function ZonaDeArchivos({
  casoId,
  tipo,
  etiqueta,
  ayuda,
  yaSubidos,
  alCambiar,
}: {
  casoId: string;
  tipo: TipoDeArchivoSubido;
  etiqueta: string;
  ayuda: string;
  yaSubidos: ArchivoYaSubido[];
  /** Se llama cuando termina o se quita un archivo, para refrescar la pantalla. */
  alCambiar: () => void;
}) {
  const [enCurso, setEnCurso] = useState<EnPantalla[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const esFoto = TIPOS_DE_FOTO.includes(tipo);
  const abortos = useRef(new Map<string, AbortController>());

  useEffect(() => {
    const controles = abortos.current;
    return () => {
      for (const control of controles.values()) control.abort();
    };
  }, []);

  const recibir = useCallback(
    async (archivos: FileList | null) => {
      if (!archivos) return;

      for (const archivo of Array.from(archivos)) {
        const clave = `${archivo.name}-${archivo.size}-${Date.now()}`;
        const control = new AbortController();
        abortos.current.set(clave, control);

        setEnCurso((previos) => [
          ...previos,
          {
            clave,
            nombre: archivo.name,
            tipo,
            archivoId: null,
            bytesRecibidos: 0,
            bytesTotales: archivo.size,
            estado: "esperando",
          },
        ]);

        try {
          await subirArchivo({
            casoId,
            archivo,
            tipo,
            senal: control.signal,
            alAvanzar: (avance) =>
              setEnCurso((previos) =>
                previos.map((p) => (p.clave === clave ? { ...p, ...avance } : p)),
              ),
          });

          setEnCurso((previos) => previos.filter((p) => p.clave !== clave));
          alCambiar();
        } catch {
          // El estado de error ya quedó en la tarjeta del archivo.
        } finally {
          abortos.current.delete(clave);
        }
      }
    },
    [casoId, tipo, alCambiar],
  );

  async function quitar(archivoId: string) {
    await quitarArchivo(archivoId);
    alCambiar();
  }

  const hayAlgo = enCurso.length > 0 || yaSubidos.length > 0;

  // El campo va escondido y se abre con un botón, pero sigue necesitando su
  // etiqueta: quien navega con lector de pantalla lo encuentra en la lista de
  // campos del formulario.
  const campo = (
    <input
      ref={entrada}
      type="file"
      multiple
      accept={esFoto ? ACEPTA_FOTO : ACEPTA_ESCANEO}
      // En el celular, para una foto conviene abrir la camara de una vez.
      {...(esFoto ? { capture: "environment" as const } : {})}
      className="sr-only"
      id={`archivos-${tipo}`}
      aria-label={etiqueta}
      onChange={(e) => {
        void recibir(e.target.files);
        e.target.value = "";
      }}
    />
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setArrastrando(true);
      }}
      onDragLeave={() => setArrastrando(false)}
      onDrop={(e) => {
        e.preventDefault();
        setArrastrando(false);
        void recibir(e.dataTransfer.files);
      }}
      className={cn(
        "flex flex-col gap-2 rounded-contenedor",
        arrastrando && hayAlgo && "outline-2 outline-offset-4 outline-accion",
      )}
    >
      {hayAlgo ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-cuerpo font-medium text-primario">{etiqueta}</p>
          <Boton type="button" onClick={() => entrada.current?.click()}>
            <Plus aria-hidden="true" size={16} weight="bold" />
            {esFoto ? "Agregar otra foto" : "Agregar otro archivo"}
            <span className="sr-only"> a {etiqueta.toLowerCase()}</span>
          </Boton>
          {campo}
        </div>
      ) : (
        <div
          className={cn(
            "flex flex-col items-center gap-3 rounded-contenedor border border-dashed p-6 text-center",
            arrastrando
              ? "border-accion bg-superficie-suave"
              : "border-borde bg-superficie",
          )}
        >
          <UploadSimple
            aria-hidden="true"
            size={24}
            className="text-secundario"
          />
          <div>
            <p className="text-cuerpo font-medium text-primario">{etiqueta}</p>
            <p className="mt-1 text-menor text-secundario">{ayuda}</p>
          </div>

          {campo}
          <Boton type="button" onClick={() => entrada.current?.click()}>
            {esFoto ? "Tomar o escoger la foto" : "Escoger archivos"}
          </Boton>
          <p className="text-minimo text-secundario">
            {esFoto
              ? "Una foto con buena luz. También puede arrastrarla aquí."
              : "STL, PLY, OBJ, DICOM o ZIP. También puede arrastrarlos aquí."}
          </p>
        </div>
      )}

      {hayAlgo && (
        <ul className="flex flex-col gap-2">
          {enCurso.map((archivo) => (
            <li
              key={archivo.clave}
              className="rounded-tarjeta border border-borde bg-superficie p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 flex-1 truncate text-cuerpo text-primario">
                  {archivo.nombre}
                </p>
                <p className="shrink-0 text-menor text-secundario">
                  {enTamano(archivo.bytesRecibidos)} de{" "}
                  {enTamano(archivo.bytesTotales)}
                </p>
              </div>

              <Progreso
                recibidos={archivo.bytesRecibidos}
                totales={archivo.bytesTotales}
                nombre={archivo.nombre}
              />

              <p
                aria-live="polite"
                className={cn(
                  "mt-1.5 flex items-center gap-1.5 text-menor",
                  archivo.estado === "error"
                    ? "text-pendiente-texto"
                    : "text-secundario",
                )}
              >
                {archivo.estado === "sin-senal" ? (
                  <WifiSlash aria-hidden="true" size={14} />
                ) : null}
                {archivo.mensaje ??
                  (archivo.estado === "esperando"
                    ? "Preparando…"
                    : "Subiendo. Puede seguir capturando mientras tanto.")}
              </p>
            </li>
          ))}

          {yaSubidos.map((archivo) => (
            <li
              key={archivo.id}
              className="flex items-center justify-between gap-3 rounded-tarjeta border border-borde bg-superficie p-3"
            >
              <div className="flex min-w-0 items-center gap-2">
                <CheckCircle
                  aria-hidden="true"
                  size={18}
                  weight="fill"
                  className="shrink-0 text-terminado"
                />
                <div className="min-w-0">
                  <p className="truncate text-cuerpo text-primario">
                    {archivo.nombre}
                  </p>
                  <p className="text-menor text-secundario">
                    Listo · {enTamano(archivo.bytesTotales)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void quitar(archivo.id)}
                className="area-tactil flex items-center justify-center rounded-control text-secundario hover:text-primario"
              >
                <Trash aria-hidden="true" size={18} />
                <span className="sr-only">Quitar {archivo.nombre}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Progreso({
  recibidos,
  totales,
  nombre,
}: {
  recibidos: number;
  totales: number;
  nombre: string;
}) {
  const porcentaje = totales === 0 ? 0 : Math.round((recibidos / totales) * 100);

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={porcentaje}
      aria-label={`Subida de ${nombre}`}
      className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-superficie-suave"
    >
      <div
        className="h-full rounded-full bg-accion transition-[width] duration-200"
        style={{ width: `${porcentaje}%` }}
      />
    </div>
  );
}
