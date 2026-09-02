"use client";

import { Trash } from "@phosphor-icons/react";
import { TRABAJOS } from "@/lib/trabajos";
import { MATERIALES, METODOS, nombreDelDiente } from "@/lib/vocabulario";
import {
  nombreDelPuente,
  puentesDe,
  type UnidadDelCaso,
} from "@/lib/puentes";
import { cn } from "@/lib/utilidades";

/**
 * Lo que lleva el caso, renglón por renglón.
 *
 * Es una tabla de verdad, con el mismo orden de columnas que la lista de
 * trabajos del escáner —diente, tipo, método, material, color— para que quien
 * captura no tenga que traducir de una pantalla a otra. Va debajo del
 * odontograma y a todo lo ancho: así se lee de corrido y ningún renglón se
 * corta.
 *
 * Tocar un renglón abre ese diente en el odontograma, y el renglón del diente
 * abierto queda marcado. La marca no es sólo el color de fondo (§7): lleva
 * `aria-selected` y el diente queda anunciado arriba.
 */
export function TablaDelCaso({
  unidades,
  abierto,
  alAbrir,
  alQuitar,
}: {
  unidades: UnidadDelCaso[];
  abierto: number | null;
  alAbrir: (diente: number) => void;
  alQuitar: (diente: number) => void;
}) {
  if (unidades.length === 0) {
    return (
      <p className="rounded-contenedor border border-borde bg-superficie p-6 text-cuerpo text-secundario">
        Toque en el odontograma los dientes de este caso. Aquí va apareciendo lo
        que lleva.
      </p>
    );
  }

  // A qué puente pertenece cada diente, para decirlo en su renglón.
  const puenteDelDiente = new Map<number, string>();
  for (const grupo of puentesDe(unidades).values()) {
    if (grupo.length < 2) continue;
    const nombre = nombreDelPuente(grupo);
    for (const u of grupo) puenteDelDiente.set(u.diente, nombre);
  }

  return (
    <div className="overflow-hidden rounded-contenedor border border-borde bg-superficie">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] border-collapse text-left">
          <caption className="sr-only">
            Lo que lleva el caso: el diente, qué se le va a hacer, con qué se
            fabrica, de qué material y en qué color.
          </caption>
          <thead>
            <tr className="border-b border-borde bg-superficie-suave">
              <Encabezado>Diente</Encabezado>
              <Encabezado>Qué se le hace</Encabezado>
              <Encabezado>Método</Encabezado>
              <Encabezado>Material</Encabezado>
              <Encabezado>Color</Encabezado>
              <th scope="col" className="px-3 py-2">
                <span className="sr-only">Quitar</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {unidades.map((unidad) => {
              const tipo = TRABAJOS[unidad.rol];
              const enPuente = puenteDelDiente.get(unidad.diente);
              const puesto = abierto === unidad.diente;

              return (
                <tr
                  key={unidad.diente}
                  aria-selected={puesto}
                  onClick={() => alAbrir(unidad.diente)}
                  className={cn(
                    "cursor-pointer border-b border-borde last:border-b-0",
                    puesto ? "bg-proceso-fondo" : "hover:bg-superficie-suave",
                  )}
                >
                  <th scope="row" className="px-3 py-2 font-normal">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        alAbrir(unidad.diente);
                      }}
                      className="alto-tactil text-left"
                    >
                      <span className="block text-menor font-medium text-primario">
                        {unidad.diente}
                        <span className="sr-only">
                          , {nombreDelDiente(unidad.diente)}
                        </span>
                      </span>
                      {enPuente ? (
                        <span className="block text-minimo text-secundario">
                          Puente {enPuente}
                        </span>
                      ) : null}
                    </button>
                  </th>

                  <td className="px-3 py-2 text-menor text-primario">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        style={{ backgroundColor: tipo.color }}
                        className="size-2.5 shrink-0 rounded-[3px]"
                      />
                      {tipo.nombre}
                    </span>
                  </td>

                  <Celda>{unidad.metodo ? METODOS[unidad.metodo] : "—"}</Celda>
                  <Celda>
                    {unidad.material ? MATERIALES[unidad.material] : "—"}
                  </Celda>
                  <Celda>{unidad.color ?? "—"}</Celda>

                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        alQuitar(unidad.diente);
                      }}
                      className="area-tactil inline-flex items-center justify-center rounded-control text-secundario hover:bg-superficie-suave hover:text-primario"
                    >
                      <Trash aria-hidden="true" size={16} />
                      <span className="sr-only">
                        Quitar el diente {unidad.diente} del caso
                      </span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Encabezado({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="px-3 py-2 text-minimo font-medium text-secundario"
    >
      {children}
    </th>
  );
}

function Celda({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 text-menor text-secundario">{children}</td>;
}
