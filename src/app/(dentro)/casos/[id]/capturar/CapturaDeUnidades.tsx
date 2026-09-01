"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { Indicacion } from "@/generated/prisma/enums";
import { DetalleDelDiente, Odontograma } from "@/componentes/Odontograma";
import { MATERIALES, ROLES_DE_UNIDAD, nombreDelDiente } from "@/lib/vocabulario";
import {
  nombreDelPuente,
  ordenarPorBoca,
  puentesDe,
  quitar,
  type UnidadDelCaso,
} from "@/lib/puentes";
import { useTresColumnas } from "@/lib/pantalla";
import { guardarUnidades } from "../../acciones";

export type UnidadCapturada = UnidadDelCaso;

/**
 * La cascada del caso (SKILL.md O-2): diente → rol → material → color.
 *
 * El diente se escoge en el odontograma, sobre el dibujo que entregó diseño, y
 * nunca escribiéndolo. Al tocarlo se abre su panel al lado con qué se le va a
 * hacer, de qué material y en qué color; ahí mismo se une con el vecino para
 * armar un puente.
 *
 * Abajo queda el resumen de lo capturado, agrupado por puente, para revisarlo
 * de un vistazo sin ir tocando diente por diente.
 *
 * Todo se guarda solo, con una pausa de un segundo. Nunca se pierde trabajo
 * (§6.6).
 */
export function CapturaDeUnidades({
  casoId,
  indicacion,
  unidadesIniciales,
}: {
  casoId: string;
  indicacion: Indicacion;
  unidadesIniciales: UnidadCapturada[];
}) {
  const [unidades, setUnidades] = useState<UnidadCapturada[]>(
    ordenarPorBoca(unidadesIniciales),
  );
  const [guardado, setGuardado] = useState<"limpio" | "guardando" | "guardado">(
    "limpio",
  );
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<number | null>(null);
  const tresColumnas = useTresColumnas();
  const [, empezar] = useTransition();
  const primeraVez = useRef(true);

  // Guardado automático del borrador.
  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false;
      return;
    }

    setGuardado("guardando");
    const temporizador = setTimeout(() => {
      empezar(async () => {
        const resultado = await guardarUnidades(casoId, unidades);
        if (resultado.error) {
          setError(resultado.error);
          setGuardado("limpio");
        } else {
          setError(null);
          setGuardado("guardado");
        }
      });
    }, 1000);

    return () => clearTimeout(temporizador);
  }, [casoId, unidades]);

  // El material y el color son obligatorios: al final del panel del catálogo
  // quedaban abajo del pliegue y se pasaban por alto. Van arriba, donde se
  // vean sin desplazarse, del lado que quepa.
  const detalle = (
    <DetalleDelDiente
      diente={abierto}
      unidades={unidades}
      alCambiar={setUnidades}
      alQuitar={(diente) => {
        setUnidades(quitar(unidades, diente));
        setAbierto(null);
      }}
    />
  );

  return (
    <section aria-labelledby="unidades" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="unidades" className="text-subtitulo font-semibold text-primario">
          ¿En qué dientes?
        </h2>
        <p aria-live="polite" className="text-minimo text-secundario">
          {guardado === "guardando"
            ? "Guardando…"
            : guardado === "guardado"
              ? "Guardado"
              : ""}
        </p>
      </div>

      {/* En pantalla ancha, el detalle del diente y el resumen van al lado del
          odontograma y no debajo: es lo que el doctor revisa mientras captura,
          y bajarlo a buscar lo obligaba a perder de vista el dibujo. */}
      <div
        className={
          "grid gap-4 min-[1440px]:grid-cols-[minmax(0,1fr)_20rem] " +
          "2xl:grid-cols-[minmax(0,1fr)_24rem]"
        }
      >
        <Odontograma
          indicacion={indicacion}
          unidades={unidades}
          abierto={abierto}
          alAbrir={setAbierto}
          alCambiar={setUnidades}
          /* Cuando no caben tres columnas, el detalle se va al principio del
             catálogo. Es un solo componente: nunca hay dos formularios del
             mismo diente en la pantalla. */
          detalle={tresColumnas ? undefined : detalle}
        />

        <div className="flex min-w-0 flex-col gap-3 min-[1440px]:max-h-[min(62vh,38rem)] min-[1440px]:overflow-y-auto">
          {tresColumnas ? detalle : null}
          <ResumenDelCaso unidades={unidades} />
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-control border border-pendiente/40 bg-pendiente-fondo px-3 py-2 text-menor text-pendiente-texto"
        >
          {error}
        </p>
      ) : null}

    </section>
  );
}

/** Lo que lleva el caso, agrupado por puente. */
function ResumenDelCaso({ unidades }: { unidades: UnidadCapturada[] }) {
  const puentes = puentesDe(unidades);
  const sueltas = unidades.filter((u) => !u.puenteId);

  if (unidades.length === 0) {
    return (
      <p className="text-cuerpo text-secundario">
        Toque en el odontograma los dientes de este caso.
      </p>
    );
  }

  return (
    <>
      <h3 className="text-menor font-medium text-primario">
        Lo que lleva el caso
      </h3>

      {[...puentes.values()]
        .filter((grupo) => grupo.length > 1)
        .map((grupo) => (
          <div
            key={grupo[0].puenteId}
            className="rounded-tarjeta border border-borde bg-superficie p-3"
          >
            <p className="text-menor font-medium text-primario">
              Puente {nombreDelPuente(grupo)}
              <span className="font-normal text-secundario">
                {" · "}
                {grupo.length} unidades unidas
              </span>
            </p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {grupo.map((unidad) => (
                <li key={unidad.diente}>
                  <RenglonDeUnidad unidad={unidad} />
                </li>
              ))}
            </ul>
          </div>
        ))}

      {sueltas.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {sueltas.map((unidad) => (
            <li
              key={unidad.diente}
              className="rounded-tarjeta border border-borde bg-superficie p-3"
            >
              <RenglonDeUnidad unidad={unidad} />
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

/** Un diente capturado, dicho completo. */
function RenglonDeUnidad({ unidad }: { unidad: UnidadCapturada }) {
  return (
    <>
      <p className="text-menor text-primario">
        <span className="font-medium">Diente {unidad.diente}</span>
        <span className="text-secundario">
          {" · "}
          {nombreDelDiente(unidad.diente)}
        </span>
      </p>
      <p className="text-minimo text-secundario">
        {[
          ROLES_DE_UNIDAD[unidad.rol],
          unidad.material ? MATERIALES[unidad.material] : null,
          unidad.color ? `color ${unidad.color}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {unidad.notas ? (
        <p className="text-minimo text-secundario">Nota: {unidad.notas}</p>
      ) : null}
    </>
  );
}
