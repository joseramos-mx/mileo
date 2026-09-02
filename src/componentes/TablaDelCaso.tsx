"use client";

import { Trash } from "@phosphor-icons/react";
import { TRABAJOS } from "@/lib/trabajos";
import {
  ARCADAS_EN_PALABRAS,
  MATERIALES,
  METODOS,
  RETENCIONES,
  nombreDelColor,
  nombreDelDiente,
} from "@/lib/vocabulario";
import {
  nombreDelTramo,
  tramosDe,
  type UnidadDelCaso,
} from "@/lib/tramos";
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
  alQuitar: (unidad: UnidadDelCaso) => void;
}) {
  if (unidades.length === 0) {
    return (
      <p className="rounded-contenedor border border-borde bg-superficie p-6 text-cuerpo text-secundario">
        Toque en el odontograma los dientes de este caso. Aquí va apareciendo lo
        que lleva.
      </p>
    );
  }

  // A qué tramo pertenece cada diente, para decirlo en su renglón.
  const tramoDelDiente = new Map<number, string>();
  for (const grupo of tramosDe(unidades).values()) {
    if (grupo.length < 2) continue;
    const nombre = nombreDelTramo(grupo);
    for (const u of grupo) tramoDelDiente.set(u.diente, nombre);
  }

  /** Sobre qué va la unidad: un diente, o una arcada entera. */
  const sobreQue = (unidad: UnidadDelCaso) => {
    if (unidad.diente === null) {
      return {
        titulo: unidad.arcada ? ARCADAS_EN_PALABRAS[unidad.arcada] : "Arcada",
        debajo: "Arcada entera",
        paraLeer: "no va en un diente, va en la arcada completa",
        clave: `a-${unidad.arcada}-${unidad.rol}`,
      };
    }
    const tramo = tramoDelDiente.get(unidad.diente);
    return {
      titulo: String(unidad.diente),
      debajo: tramo ? `Tramo ${tramo}` : null,
      paraLeer: nombreDelDiente(unidad.diente),
      clave: `d-${unidad.diente}`,
    };
  };

  return (
    <div className="min-w-0 overflow-hidden rounded-contenedor border border-borde bg-superficie">
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
              const donde = sobreQue(unidad);
              const detalles = detallesDe(unidad);
              const puesto =
                unidad.diente !== null && abierto === unidad.diente;

              return (
                <tr
                  key={donde.clave}
                  aria-selected={puesto}
                  onClick={() =>
                    unidad.diente !== null && alAbrir(unidad.diente)
                  }
                  className={cn(
                    "border-b border-borde last:border-b-0",
                    unidad.diente !== null && "cursor-pointer",
                    puesto ? "bg-proceso-fondo" : "hover:bg-superficie-suave",
                  )}
                >
                  <th scope="row" className="px-3 py-2 font-normal">
                    <span className="alto-tactil flex flex-col justify-center">
                      <span className="block text-menor font-medium text-primario">
                        {donde.titulo}
                        <span className="sr-only">, {donde.paraLeer}</span>
                      </span>
                      {donde.debajo ? (
                        <span className="block text-minimo text-secundario">
                          {donde.debajo}
                        </span>
                      ) : null}
                    </span>
                  </th>

                  <td className="px-3 py-2 text-menor text-primario">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        style={{ backgroundColor: tipo.color }}
                        className="size-2.5 shrink-0 rounded-[3px]"
                      />
                      {/* Lo que el tipo pregunta de mas va debajo del nombre y
                          no en columnas propias: son campos de unos cuantos
                          tipos, y una columna vacia en veinticinco renglones no
                          dice nada. */}
                      <span className="min-w-0">
                        {tipo.nombre}
                        {detalles.length > 0 ? (
                          <span className="block text-minimo text-secundario">
                            {detalles.join(" \u00b7 ")}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </td>

                  <Celda>{unidad.metodo ? METODOS[unidad.metodo] : "\u2014"}</Celda>
                  <Celda>
                    {unidad.material ? MATERIALES[unidad.material] : "\u2014"}
                  </Celda>
                  <Celda>
                    {unidad.color ? nombreDelColor(unidad.color) : "\u2014"}
                  </Celda>

                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        alQuitar(unidad);
                      }}
                      className="area-tactil inline-flex items-center justify-center rounded-control text-secundario hover:bg-superficie-suave hover:text-primario"
                    >
                      <Trash aria-hidden="true" size={16} />
                      <span className="sr-only">
                        Quitar {tipo.nombre.toLowerCase()} de {donde.titulo}
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

/** Lo que este tipo de trabajo pregunta de mas, dicho en corto. */
function detallesDe(unidad: UnidadDelCaso) {
  const partes: string[] = [];
  if (unidad.esImplante) partes.push("Sobre implante");
  if (unidad.sistemaImplante) partes.push(unidad.sistemaImplante);
  if (unidad.retencion) partes.push(RETENCIONES[unidad.retencion]);
  if (unidad.espesorAlivioMm !== null) {
    partes.push(`Alivio ${unidad.espesorAlivioMm} mm`);
  }
  if (unidad.grosorMm !== null) partes.push(`${unidad.grosorMm} mm de grosor`);
  if (unidad.colorBase) partes.push(`Enc\u00eda ${unidad.colorBase}`);
  if (unidad.colorDientes) {
    partes.push(`Dientes ${nombreDelColor(unidad.colorDientes)}`);
  }
  if (unidad.troqueles) partes.push("Con troqueles");
  return partes;
}
