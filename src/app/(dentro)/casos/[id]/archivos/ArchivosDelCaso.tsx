"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ZonaDeArchivos } from "@/componentes/ZonaDeArchivos";
import type { TipoDeArchivoSubido } from "@/lib/subida";

type ArchivoEnPantalla = {
  id: string;
  nombre: string;
  tipo: string;
  estado: string;
  bytesTotales: number;
};

const APARTADOS: {
  tipo: TipoDeArchivoSubido;
  etiqueta: string;
  ayuda: string;
}[] = [
  {
    tipo: "ESCANEO_PREPARACION",
    etiqueta: "Escaneo de la preparación o conjunto completo",
    ayuda: "La arcada que preparó o el archivo con el conjunto junto.",
  },
  {
    tipo: "ESCANEO_ANTAGONISTA",
    etiqueta: "Escaneo del antagonista (opcional si ya viene en el conjunto)",
    ayuda: "La arcada opuesta por separado, si no la incluyó arriba.",
  },
  {
    tipo: "REGISTRO_MORDIDA",
    etiqueta: "Registro de mordida (opcional)",
    ayuda: "El registro con el que monto el caso, si viene en archivo aparte.",
  },
  {
    tipo: "FOTO_COLOR",
    etiqueta: "Foto del color (opcional)",
    ayuda: "Opcional, pero ayuda mucho a que el color quede a la primera.",
  },
];

/**
 * Los archivos del caso (SKILL.md O-2).
 *
 * Basta con subir al menos un archivo de escaneo (ya sea el conjunto completo
 * o las quijadas por separado) para poder mandar el caso al laboratorio.
 */
export function ArchivosDelCaso({
  casoId,
  archivos,
}: {
  casoId: string;
  archivos: ArchivoEnPantalla[];
}) {
  const router = useRouter();

  return (
    <section aria-labelledby="archivos" className="flex flex-col gap-4">
      <div>
        <h2 id="archivos" className="text-subtitulo font-semibold text-primario">
          Sus archivos
        </h2>
        <p className="mt-1 text-menor text-secundario">
          Suba al menos un archivo (el conjunto completo o las quijadas por
          separado). Recibo STL, PLY, OBJ, DICOM y ZIP.{" "}
          <Link
            href="/ayuda/guias-de-exportacion"
            className="text-enlace underline underline-offset-4"
          >
            Ver cómo exportar desde su escáner
          </Link>
        </p>
      </div>

      {APARTADOS.map((apartado) => (
        <div key={apartado.tipo} className="flex flex-col gap-2">
          <ZonaDeArchivos
            casoId={casoId}
            tipo={apartado.tipo}
            etiqueta={apartado.etiqueta}
            ayuda={apartado.ayuda}
            yaSubidos={archivos
              .filter((a) => a.tipo === apartado.tipo && a.estado === "COMPLETO")
              .map((a) => ({
                id: a.id,
                nombre: a.nombre,
                bytesTotales: a.bytesTotales,
                tipo: apartado.tipo,
              }))}
            alCambiar={() => router.refresh()}
          />
        </div>
      ))}
    </section>
  );
}
