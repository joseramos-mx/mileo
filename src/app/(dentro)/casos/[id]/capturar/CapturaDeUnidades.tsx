"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { Arcada } from "@/generated/prisma/enums";
import { DetalleDelDiente, Odontograma } from "@/componentes/Odontograma";
import { TablaDelCaso } from "@/componentes/TablaDelCaso";
import { Pestanas } from "@/componentes/Pestanas";
import {
  conMetodoValido,
  ordenarPorBoca,
  conDiente,
  quitarUnidad,
  unidadDeArcada,
  type UnidadDelCaso,
} from "@/lib/tramos";
import { useTresColumnas } from "@/lib/pantalla";
import { CamposDeLaArcada, VistaDeArcadas } from "./VistaDeArcadas";
import { cambiarCatalogo, guardarUnidades } from "../../acciones";

export type UnidadCapturada = UnidadDelCaso;

/**
 * La cascada del caso (SKILL.md O-2): diente → rol → material → color.
 *
 * El diente se escoge en el odontograma, sobre el dibujo que entregó diseño, y
 * nunca escribiéndolo. Al tocarlo se abre su panel al lado con qué se le va a
 * hacer, de qué material, con qué método y en qué color; el puente se arma en
 * el riel del mismo dibujo.
 *
 * Dos pestañas, porque no todo se asigna a un diente: en Dientes va el
 * odontograma con lo que se pone diente por diente y por tramos; en Arcadas,
 * lo que va sobre una arcada entera —prótesis, guarda, modelo— y la marca del
 * antagonista, sobre el dibujo de maxilar y mandíbula.
 *
 * Cambiar de pestaña no borra nada: los dos paneles se quedan montados y el
 * estado de las unidades es uno solo, aquí arriba.
 *
 * Abajo, a todo lo ancho y bajo las dos, la tabla de lo capturado: se lee de
 * corrido venga de donde venga cada renglón.
 *
 * Todo se guarda solo, con una pausa de un segundo. Nunca se pierde trabajo
 * (§6.6).
 */
export function CapturaDeUnidades({
  casoId,
  catalogoCompleto: catalogoInicial,
  unidadesIniciales,
}: {
  casoId: string;
  /** Si este doctor ve el catálogo entero o la lista corta. */
  catalogoCompleto: boolean;
  unidadesIniciales: UnidadCapturada[];
}) {
  const [catalogoCompleto, setCatalogoCompleto] = useState(catalogoInicial);
  const [pestana, setPestana] = useState("dientes");
  const [arcadaAbierta, setArcadaAbierta] = useState<Arcada | null>(null);
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

  const cambiarElCatalogo = (completo: boolean) => {
    setCatalogoCompleto(completo);
    // Se le queda encendido en su perfil: quien trabaja con el catálogo
    // entero lo hace siempre.
    empezar(() => void cambiarCatalogo(completo));
  };

  const quitarDeLaArcada = (unidad: UnidadDelCaso) =>
    setUnidades(quitarUnidad(unidades, unidad));

  const camposDeArcada = (
    <CamposDeLaArcada
      arcada={arcadaAbierta}
      unidades={unidades}
      alCambiar={setUnidades}
      alQuitar={quitarDeLaArcada}
    />
  );

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

  const enDientes = conDiente(unidades).length;
  const enArcadas = unidades.filter((u) => u.diente === null).length;

  return (
    <section aria-labelledby="unidades" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="unidades" className="text-subtitulo font-semibold text-primario">
          ¿Qué lleva el caso?
        </h2>
        <p aria-live="polite" className="text-minimo text-secundario">
          {guardado === "guardando"
            ? "Guardando…"
            : guardado === "guardado"
              ? "Guardado"
              : ""}
        </p>
      </div>

      {/* Dos pestañas y no dos pantallas: lo que se captura en una sigue ahí
          al volver, porque los dos paneles se quedan montados. */}
      <Pestanas
        puesta={pestana}
        alCambiar={setPestana}
        pestanas={[
          {
            clave: "dientes",
            titulo: "Dientes",
            cuantas: enDientes,
            contenido: (
              <>
                {/* En pantalla ancha, el detalle del diente va al lado del
                    odontograma: es lo que se llena mirando el dibujo. */}
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
                    catalogoCompleto={catalogoCompleto}
                    alCambiarCatalogo={cambiarElCatalogo}
                    /* Cuando no caben tres columnas, el detalle se va al
                       principio del catálogo. Es un solo componente: nunca hay
                       dos formularios del mismo diente en la pantalla. */
                    detalle={tresColumnas ? undefined : detalle}
                  />

                  {/* Esta columna no se desplaza por dentro: recortaba los
                      recuadros. Crece con la página, y el detalle se queda
                      pegado arriba para no perderlo de vista. */}
                  <div className="flex min-w-0 flex-col gap-3">
                    {tresColumnas ? (
                      <div className="min-[1440px]:sticky min-[1440px]:top-0 min-[1440px]:z-10">
                        {detalle}
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            ),
          },
          {
            clave: "arcadas",
            titulo: "Arcadas",
            cuantas: enArcadas,
            contenido: (
              // Las mismas tres columnas que Dientes: el dibujo, el catálogo
              // pegado a él, y los campos aparte.
              <div
                className={
                  "grid gap-4 min-[1440px]:grid-cols-[minmax(0,1fr)_20rem] " +
                  "2xl:grid-cols-[minmax(0,1fr)_24rem]"
                }
              >
                <VistaDeArcadas
                  unidades={unidades}
                  abierta={arcadaAbierta}
                  alAbrir={setArcadaAbierta}
                  catalogoCompleto={catalogoCompleto}
                  alAgregar={(arcada, rol) =>
                    setUnidades(
                      ordenarPorBoca([
                        ...unidades,
                        unidadDeArcada(arcada, rol),
                      ]),
                    )
                  }
                  alQuitar={quitarDeLaArcada}
                  detalle={tresColumnas ? undefined : camposDeArcada}
                />

                <div className="flex min-w-0 flex-col gap-3">
                  {tresColumnas ? (
                    <div className="min-[1440px]:sticky min-[1440px]:top-0 min-[1440px]:z-10 flex flex-col gap-3">
                      {camposDeArcada}
                    </div>
                  ) : null}
                </div>
              </div>
            ),
          },
        ]}
      />

      {/* Lo que lleva el caso, debajo de las dos pestañas y a todo lo ancho:
          se lee de corrido, venga de donde venga cada renglón. */}
      <TablaDelCaso
        unidades={unidades}
        abierto={abierto}
        alAbrir={(diente) => {
          setPestana("dientes");
          setAbierto(diente);
        }}
        alQuitar={(unidad) => {
          setUnidades(quitarUnidad(unidades, unidad));
          if (abierto === unidad.diente) setAbierto(null);
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
