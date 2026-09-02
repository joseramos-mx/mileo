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
    etiqueta: "Escaneo de la preparación",
    ayuda: "La arcada que preparó, como la exporta su escáner.",
  },
  {
    tipo: "ESCANEO_ANTAGONISTA",
    etiqueta: "Escaneo del antagonista",
    ayuda: "La arcada opuesta. Sin ella no puedo ajustar la oclusión.",
  },
  {
    tipo: "REGISTRO_MORDIDA",
    etiqueta: "Registro de mordida",
    ayuda: "El registro con el que monto el caso.",
  },
  {
    tipo: "FOTO_COLOR",
    etiqueta: "Foto del color",
    ayuda: "Opcional, pero ayuda mucho a que el color quede a la primera.",
  },
];

/**
 * Los archivos del caso (SKILL.md O-2).
 *
 * Un apartado por cada cosa que el laboratorio necesita, en vez de una sola
 * pila donde después nadie sabe qué es qué. Cada subida se reanuda sola si se
 * cae la señal.
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
          Recibo STL, PLY, OBJ, DICOM y ZIP, venga de la marca que venga.{" "}
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
