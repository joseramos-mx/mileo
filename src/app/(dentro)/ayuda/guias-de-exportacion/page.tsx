import type { Metadata } from "next";
import Link from "next/link";
import { exigirUsuario } from "@/lib/autorizacion";

export const metadata: Metadata = {
  title: "Cómo exportar desde su escáner · Mileo",
};

/**
 * Guías de exportación (SKILL.md O-2).
 *
 * Mileo es agnóstico de marca: esa es su única ventaja estructural. Esta
 * pantalla lo demuestra en la práctica.
 *
 * ⚠️ Pendiente del Product Owner (§12.6): confirmar qué marcas cubrir el primer
 * día y revisar los pasos con el laboratorio. Los enlaces apuntan a la
 * documentación oficial de cada fabricante para no quedar desactualizados.
 */

const MARCAS = [
  {
    nombre: "3Shape TRIOS",
    pasos: [
      "En TRIOS, abra el caso y elija Exportar.",
      "Escoja el formato STL, con la casilla de arcadas por separado.",
      "Guarde la carpeta y súbala a Mileo tal cual, o comprimida en ZIP.",
    ],
    enlace: "https://www.3shape.com/es/support",
  },
  {
    nombre: "Medit i500 / i700",
    pasos: [
      "En Medit Link, entre al caso y elija Exportar datos del caso.",
      "Marque STL y las dos arcadas más el registro de mordida.",
      "Suba a Mileo la carpeta o el ZIP que genera.",
    ],
    enlace: "https://www.medit.com/support",
  },
  {
    nombre: "Straumann / Dental Wings",
    pasos: [
      "Desde el módulo de escaneo, elija Exportar como archivo abierto.",
      "Escoja STL o PLY.",
      "Suba los archivos a Mileo.",
    ],
    enlace: "https://www.straumann.com",
  },
  {
    nombre: "Carestream, Planmeca y otros",
    pasos: [
      "Busque la opción de exportación abierta o sin cifrar.",
      "Escoja STL, PLY u OBJ. Si su equipo sólo da DICOM, también lo recibo.",
      "Si no encuentra la opción, escríbanos por WhatsApp y lo vemos juntos.",
    ],
    enlace: null,
  },
];

export default async function PaginaDeGuias() {
  await exigirUsuario();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header>
        <Link
          href="/ayuda"
          className="text-menor text-enlace underline underline-offset-4"
        >
          Regresar a ayuda
        </Link>
        <h1 className="mt-2 text-titulo font-semibold text-primario">
          Cómo exportar desde su escáner
        </h1>
        <p className="mt-1 text-cuerpo text-secundario">
          Recibo STL, PLY, OBJ, DICOM y ZIP, venga de la marca que venga. No
          necesita cambiar de equipo ni instalar nada.
        </p>
      </header>

      {MARCAS.map((marca) => (
        <section
          key={marca.nombre}
          className="rounded-contenedor border border-borde bg-superficie p-5"
        >
          <h2 className="text-subtitulo font-semibold text-primario">
            {marca.nombre}
          </h2>
          <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-cuerpo text-secundario">
            {marca.pasos.map((paso) => (
              <li key={paso}>{paso}</li>
            ))}
          </ol>
          {marca.enlace ? (
            <a
              href={marca.enlace}
              className="mt-3 inline-block text-menor text-enlace underline underline-offset-4"
            >
              Documentación oficial de {marca.nombre}
            </a>
          ) : null}
        </section>
      ))}
    </div>
  );
}
