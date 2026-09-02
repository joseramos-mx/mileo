"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { DetalleDelDiente, Odontograma } from "@/componentes/Odontograma";
import { TablaDelCaso } from "@/componentes/TablaDelCaso";
import {
  conMetodoValido,
  ordenarPorBoca,
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
 * hacer, de qué material, con qué método y en qué color; el puente se arma en
 * el riel del mismo dibujo.
 *
 * Abajo, a todo lo ancho, la tabla de lo capturado: se va llenando conforme se
 * tocan dientes y se lee de corrido, renglón por renglón.
 *
 * Todo se guarda solo, con una pausa de un segundo. Nunca se pierde trabajo
 * (§6.6).
 */
export function CapturaDeUnidades({
  casoId,
  unidadesIniciales,
}: {
  casoId: string;
  unidadesIniciales: UnidadCapturada[];
}) {
  // Los casos capturados antes de que existiera el método vienen sin él. Se
  // les pone el que corresponde a su material —el mismo que ofrecería la
  // pantalla— y se guardan solos, para que nadie tenga que abrir diente por
  // diente sólo a confirmar lo obvio.
  const [unidades, setUnidades] = useState<UnidadCapturada[]>(() =>
    ordenarPorBoca(
      unidadesIniciales.map((u) => ({
        ...u,
        ...conMetodoValido(u.material, u.metodo),
      })),
    ),
  );
  const faltabaMetodo = unidadesIniciales.some(
    (u) => u.material !== null && u.metodo === null,
  );
  const [guardado, setGuardado] = useState<"limpio" | "guardando" | "guardado">(
    "limpio",
  );
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<number | null>(null);
  const tresColumnas = useTresColumnas();
  const [, empezar] = useTransition();
  // Si hubo que rellenar el método, la primera pasada sí guarda.
  const primeraVez = useRef(!faltabaMetodo);

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

      {/* En pantalla ancha, el detalle del diente va al lado del odontograma:
          es lo que se llena mirando el dibujo. */}
      <div
        className={
          "grid gap-4 min-[1440px]:grid-cols-[minmax(0,1fr)_20rem] " +
          "2xl:grid-cols-[minmax(0,1fr)_24rem]"
        }
      >
        <Odontograma
          unidades={unidades}
          abierto={abierto}
          alAbrir={setAbierto}
          alCambiar={setUnidades}
          /* Cuando no caben tres columnas, el detalle se va al principio del
             catálogo. Es un solo componente: nunca hay dos formularios del
             mismo diente en la pantalla. */
          detalle={tresColumnas ? undefined : detalle}
        />

        {/* Esta columna no se desplaza por dentro: recortaba los recuadros.
            Crece con la página, y el detalle se queda pegado arriba para no
            perderlo de vista. */}
        <div className="flex min-w-0 flex-col gap-3">
          {tresColumnas ? (
            <div className="min-[1440px]:sticky min-[1440px]:top-0 min-[1440px]:z-10">
              {detalle}
            </div>
          ) : null}
        </div>
      </div>

      {/* Lo que lleva el caso, debajo y a todo lo ancho: se va llenando
          conforme se tocan dientes, y ningún renglón queda cortado. */}
      <TablaDelCaso
        unidades={unidades}
        abierto={abierto}
        alAbrir={setAbierto}
        alQuitar={(diente) => {
          setUnidades(quitar(unidades, diente));
          if (abierto === diente) setAbierto(null);
        }}
      />

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
