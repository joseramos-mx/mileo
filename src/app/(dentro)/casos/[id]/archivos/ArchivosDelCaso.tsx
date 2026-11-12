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

type ApartadoDeArchivo = {
  tipo: TipoDeArchivoSubido;
  etiqueta: string;
  ayuda: string;
  prefijoNombre?: string;
};

const APARTADOS_BASE: ApartadoDeArchivo[] = [
  {
    tipo: "ESCANEO_PREPARACION",
    etiqueta: "Escaneo de la preparación",
    ayuda: "La arcada que preparó o el archivo del conjunto completo.",
  },
  {
    tipo: "ESCANEO_ANTAGONISTA",
    etiqueta: "Escaneo del antagonista",
    ayuda: "La arcada opuesta del paciente.",
  },
  {
    tipo: "REGISTRO_MORDIDA",
    etiqueta: "Registro de mordida",
    ayuda: "El registro de mordida con el que se monta el caso.",
  },
  {
    tipo: "FOTO_COLOR",
    etiqueta: "Foto del color",
    ayuda: "Foto con buena luz para igualar el tono del paciente.",
  },
];

const APARTADO_IMPLANTES_DIGITALES: ApartadoDeArchivo = {
  tipo: "OTRO",
  etiqueta: "Archivo sobre implantes digitales",
  ayuda:
    "Escaneo con cuerpo de escaneo (scanbody), librería digital o archivo del implante.",
  prefijoNombre: "[Implante digital] ",
};

/**
 * Los archivos del caso (SKILL.md O-2).
 *
 * Todos los apartados mostrados son obligatorios para poder mandar el caso
 * al laboratorio. Si el caso incluye trabajos sobre implante, se exige además
 * el archivo sobre implantes digitales.
 */
export function ArchivosDelCaso({
  casoId,
  esSobreImplante,
  archivos,
}: {
  casoId: string;
  esSobreImplante: boolean;
  archivos: ArchivoEnPantalla[];
}) {
  const router = useRouter();
  const apartados = esSobreImplante
    ? [...APARTADOS_BASE, APARTADO_IMPLANTES_DIGITALES]
    : APARTADOS_BASE;

  return (
    <section aria-labelledby="archivos" className="flex flex-col gap-4">
      <div>
        <h2 id="archivos" className="text-subtitulo font-semibold text-primario">
          Sus archivos
        </h2>
        <p className="mt-1 text-menor text-secundario">
          Todos los archivos de esta pantalla son obligatorios para mandar el
          caso. Recibo STL, PLY, OBJ, DICOM y ZIP (e imágenes para la foto del
          color).{" "}
          <Link
            href="/ayuda/guias-de-exportacion"
            className="text-enlace underline underline-offset-4"
          >
            Ver cómo exportar desde su escáner
          </Link>
        </p>
      </div>

      {apartados.map((apartado) => (
        <div key={apartado.tipo} className="flex flex-col gap-2">
          <ZonaDeArchivos
            casoId={casoId}
            tipo={apartado.tipo}
            etiqueta={apartado.etiqueta}
            ayuda={apartado.ayuda}
            prefijoNombre={apartado.prefijoNombre}
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
