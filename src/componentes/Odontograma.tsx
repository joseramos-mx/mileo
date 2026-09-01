"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import type { Indicacion, Material, RolDeUnidad } from "@/generated/prisma/enums";
import { Trash } from "@phosphor-icons/react";
import {
  ENLACES,
  TRAZOS,
  VISTA_COMPLETA,
  VISTA_SUPERIOR,
  VISTA_INFERIOR,
  type EnlaceDeDientes,
} from "@/lib/odontograma-trazos";
import {
  ARCADAS,
  arcadaDe,
  conMaterialValido,
  esSuperior,
  nombreDelPuente,
  desunir,
  estanUnidos,
  ordenarPorBoca,
  puenteDe,
  quitar,
  conectar,
  unidadNueva,
  type UnidadDelCaso,
} from "@/lib/puentes";
import {
  COLORES_VITA,
  INDICACIONES,
  MATERIALES,
  MATERIALES_POR_ROL,
  QUE_ES_CADA_ROL,
  ROLES_DE_UNIDAD,
  ROLES_SIN_COLOR,
  nombreDelDiente,
} from "@/lib/vocabulario";
import { CampoDeSeleccion, CampoDeTexto } from "@/componentes/Campo";
import { Boton } from "@/componentes/Boton";
import { cn } from "@/lib/utilidades";

/**
 * Odontograma (SKILL.md §5.4 "ToothChart", O-2).
 *
 * Es el dibujo que entregó diseño —`public/odontograma.svg`, arcada superior e
 * inferior vistas desde oclusal—, no una rejilla de botones ni un diente
 * inventado en CSS (§9). El guion `npm run marcar:odontograma` le pone a cada
 * diente su número FDI por posición y deja los trazos en un módulo; aquí sólo
 * se pintan.
 *
 * Cuatro estados, y ninguno depende sólo del color (§7): cada diente lleva su
 * número escrito y un aria-label que dice en qué va.
 *
 *   sin trabajo   contorno, cuerpo en blanco
 *   con trabajo   cuerpo relleno
 *   póntico       cuerpo con relleno tenue: no se apoya en nada
 *   seleccionado  anillo azul, y su panel abierto al lado
 *
 * Va siempre sobre fondo claro, aunque el tema sea oscuro: aquí se señala un
 * diente y el gris del tema oscuro estorba (§5.1).
 *
 * Los puentes se arman en el riel que trae el mismo dibujo: un nodo por diente
 * y una línea entre cada par de vecinos. Cada línea es un interruptor —tocarla
 * une los dos dientes, volver a tocarla los separa— y se pinta encendida
 * cuando van unidos. Es el único lugar donde se une o se separa: el panel del
 * diente explica el puente, pero no lo arma.
 *
 * Con teclado son dos paradas de tabulador, no sesenta: la primera entra al
 * riel y la segunda a los dientes, y dentro de cada uno se recorre con las
 * flechas. Izquierda y derecha mueven a lo largo de la arcada, arriba y abajo
 * cambian de arcada, Inicio y Fin van a los extremos, y Enter o espacio
 * acciona.
 */

export type UnidadEnOdontograma = UnidadDelCaso;

/** El número del diente, en unidades del dibujo. */
const TAMANO_DEL_NUMERO = 11;

export function Odontograma({
  indicacion,
  unidades,
  alCambiar,
  className,
}: {
  indicacion: Indicacion;
  unidades: UnidadEnOdontograma[];
  alCambiar: (unidades: UnidadEnOdontograma[]) => void;
  className?: string;
}) {
  const [abierto, setAbierto] = useState<number | null>(null);
  const [enfocado, setEnfocado] = useState<number>(
    unidades[0]?.diente ?? ARCADAS[0][0],
  );
  const [arcadaVisible, setArcadaVisible] = useState<"superior" | "inferior">(
    "superior",
  );
  const [enlaceEnfocado, setEnlaceEnfocado] = useState(0);
  const [aviso, setAviso] = useState("");
  const dientesEnPantalla = useRef(new Map<number, SVGGElement>());
  const enlacesEnPantalla = useRef(new Map<string, SVGGElement>());

  const angosta = useAngosta();
  const rolesPermitidos = INDICACIONES[indicacion].roles;
  const porDiente = new Map(unidades.map((u) => [u.diente, u]));

  /** En el celular sólo se ve una arcada a la vez: no caben las dos. */
  const vista = !angosta
    ? VISTA_COMPLETA
    : arcadaVisible === "superior"
      ? VISTA_SUPERIOR
      : VISTA_INFERIOR;

  const arribaVisible = arcadaVisible === "superior";
  const visibles = !angosta
    ? TRAZOS
    : TRAZOS.filter((t) => esSuperior(t.numero) === arribaVisible);
  // El enlace de la línea media (11-21, 31-41) es de la misma arcada que sus
  // dos dientes, así que basta con mirar uno.
  const enlacesVisibles = !angosta
    ? ENLACES
    : ENLACES.filter((e) => esSuperior(e.a) === arribaVisible);

  function abrir(diente: number) {
    const unidad = porDiente.get(diente);
    if (!unidad) {
      // Tocar un diente vacío lo agrega al caso. Tocar uno que ya está sólo lo
      // abre: nadie borra un diente configurado por un toque de más.
      const nueva = unidadNueva(diente, rolesPermitidos[0]);
      alCambiar(ordenarPorBoca([...unidades, nueva]));
      setAviso(
        `Agregué el diente ${diente} como ${ROLES_DE_UNIDAD[nueva.rol].toLowerCase()}.`,
      );
    }
    setAbierto(diente);
    setEnfocado(diente);
  }

  /** Mueve el foco a otro diente sin cambiar la selección. */
  function moverFoco(diente: number) {
    if (angosta && esSuperior(diente) !== (arcadaVisible === "superior")) {
      setArcadaVisible(esSuperior(diente) ? "superior" : "inferior");
    }
    setEnfocado(diente);
    // El nodo puede no existir todavía si acabamos de cambiar de arcada.
    requestAnimationFrame(() =>
      dientesEnPantalla.current.get(diente)?.focus({ preventScroll: false }),
    );
  }

  /** El interruptor de una línea del riel: une o separa los dos dientes. */
  function alternarEnlace(enlace: EnlaceDeDientes) {
    const unidos = estanUnidos(unidades, enlace.a, enlace.b);
    const clave = `p-${enlace.a}-${enlace.b}`;
    alCambiar(
      unidos
        ? desunir(unidades, enlace.a, enlace.b, `${clave}-corte`)
        : conectar(unidades, enlace.a, enlace.b, clave),
    );
    setAviso(
      unidos
        ? `Separé el diente ${enlace.a} del ${enlace.b}.`
        : `Uní el diente ${enlace.a} con el ${enlace.b}.`,
    );
  }

  /** Recorre el riel con las flechas, como los dientes. */
  function alTeclearEnlace(evento: React.KeyboardEvent, posicion: number) {
    if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault();
      alternarEnlace(enlacesVisibles[posicion]);
      return;
    }

    const destino: Record<string, number | undefined> = {
      ArrowRight: posicion + 1,
      ArrowLeft: posicion - 1,
      Home: 0,
      End: enlacesVisibles.length - 1,
    };
    const siguiente = destino[evento.key];
    if (siguiente === undefined) return;
    evento.preventDefault();
    if (siguiente < 0 || siguiente >= enlacesVisibles.length) return;

    setEnlaceEnfocado(siguiente);
    const e = enlacesVisibles[siguiente];
    requestAnimationFrame(() =>
      enlacesEnPantalla.current.get(`${e.a}-${e.b}`)?.focus(),
    );
  }

  function alTeclear(evento: React.KeyboardEvent, diente: number) {
    const arcada = arcadaDe(diente);
    if (!arcada) return;
    const i = arcada.indexOf(diente);
    const otra = ARCADAS.find((a) => a !== arcada)!;

    const destino: Record<string, number | undefined> = {
      ArrowRight: arcada[i + 1],
      ArrowLeft: arcada[i - 1],
      ArrowDown: esSuperior(diente) ? otra[i] : undefined,
      ArrowUp: esSuperior(diente) ? undefined : otra[i],
      Home: arcada[0],
      End: arcada[arcada.length - 1],
    };

    if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault();
      abrir(diente);
      return;
    }

    const siguiente = destino[evento.key];
    if (siguiente === undefined) return;
    evento.preventDefault();
    moverFoco(siguiente);
  }

  return (
    <div
      className={cn(
        "siempre-claro grid gap-4 rounded-contenedor bg-diente-lienzo p-4",
        "lg:grid-cols-[minmax(0,1fr)_20rem]",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-3">
        {angosta ? (
          <>
            <CambioDeArcada valor={arcadaVisible} alCambiar={setArcadaVisible} />
            {/* En el celular la arcada no cabe entera. Se avisa, en vez de
                encoger los dientes hasta que no se lea el número ni se
                atinen con el dedo (§7). */}
            <p className="text-minimo text-secundario">
              Deslice el dibujo a los lados para ver el resto de la arcada.
            </p>
          </>
        ) : null}

        {/* En pantalla angosta el dibujo no se encoge por debajo de lo que se
            puede tocar con el dedo: se desplaza a lo ancho (§7). */}
        <div className="overflow-x-auto">
          <svg
            viewBox={vista}
            role="group"
            aria-label="Odontograma. Toque un diente para agregarlo al caso, o la línea entre dos dientes para unirlos en un puente."
            className="h-auto w-full min-w-[34rem] lg:min-w-0"
          >
            {/* El riel del dibujo: primero, porque los dientes van encima.
                Cada línea es el interruptor de un puente. */}
            <g role="group" aria-label="Uniones entre dientes">
              {enlacesVisibles.map((enlace, posicion) => (
                <Enlace
                  key={`${enlace.a}-${enlace.b}`}
                  enlace={enlace}
                  unido={estanUnidos(unidades, enlace.a, enlace.b)}
                  enfocable={enlaceEnfocado === posicion}
                  alAlternar={() => alternarEnlace(enlace)}
                  alTeclear={(e) => alTeclearEnlace(e, posicion)}
                  registrar={(nodo) => {
                    const clave = `${enlace.a}-${enlace.b}`;
                    if (nodo) enlacesEnPantalla.current.set(clave, nodo);
                    else enlacesEnPantalla.current.delete(clave);
                  }}
                />
              ))}

              {/* Los nodos, uno por diente. Se encienden con el diente. */}
              {visibles.map((trazo) => (
                <circle
                  key={trazo.numero}
                  aria-hidden="true"
                  cx={trazo.nodo.x}
                  cy={trazo.nodo.y}
                  r={trazo.nodo.r}
                  strokeWidth={1}
                  className={cn(
                    "pointer-events-none stroke-diente-contorno",
                    porDiente.get(trazo.numero)?.puenteId
                      ? "fill-diente-puente stroke-diente-puente"
                      : "fill-diente-cuerpo",
                  )}
                />
              ))}
            </g>

            {/* Los dientes. */}
            <g role="group" aria-label="Dientes">
              {visibles.map((trazo) => (
                <Diente
                  key={trazo.numero}
                  trazo={trazo}
                  unidad={porDiente.get(trazo.numero) ?? null}
                  abierto={abierto === trazo.numero}
                  enfocable={enfocado === trazo.numero}
                  alAbrir={() => abrir(trazo.numero)}
                  alTeclear={(e) => alTeclear(e, trazo.numero)}
                  registrar={(nodo) => {
                    if (nodo) dientesEnPantalla.current.set(trazo.numero, nodo);
                    else dientesEnPantalla.current.delete(trazo.numero);
                  }}
                />
              ))}
            </g>

            {/* Los números al final, para que nada se los tape. Van fuera del
                diente porque son sólo dibujo: lo que anuncia el lector de
                pantalla es el aria-label del diente. */}
            <g aria-hidden="true" className="pointer-events-none">
              {visibles.map((trazo) => (
                <text
                  key={trazo.numero}
                  x={trazo.cx}
                  y={trazo.cy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={TAMANO_DEL_NUMERO}
                  fontWeight={600}
                  className="fill-diente-numero"
                >
                  {trazo.numero}
                </text>
              ))}
            </g>
          </svg>
        </div>

        <Leyenda />
      </div>

      <PanelDelDiente
        diente={abierto}
        unidades={unidades}
        rolesPermitidos={rolesPermitidos}
        alCambiar={alCambiar}
        alCerrar={() => setAbierto(null)}
        alAvisar={setAviso}
      />

      {/* Lo que acaba de pasar, para quien no ve el dibujo. */}
      <p aria-live="polite" className="sr-only">
        {aviso}
      </p>
    </div>
  );
}

/**
 * Una línea del riel: el interruptor de un puente entre dos dientes vecinos.
 *
 * La línea que se ve es la del dibujo, de 8 unidades. Encima va otra
 * transparente y mucho más gruesa: es la que recibe el dedo, para que el área
 * de toque llegue a lo que pide §7 sin engordar el dibujo.
 */
function Enlace({
  enlace,
  unido,
  enfocable,
  alAlternar,
  alTeclear,
  registrar,
}: {
  enlace: EnlaceDeDientes;
  unido: boolean;
  enfocable: boolean;
  alAlternar: () => void;
  alTeclear: (evento: React.KeyboardEvent) => void;
  registrar: (nodo: SVGGElement | null) => void;
}) {
  return (
    <g
      ref={registrar}
      data-enlace={`${enlace.a}-${enlace.b}`}
      role="switch"
      tabIndex={enfocable ? 0 : -1}
      aria-checked={unido}
      aria-label={`Unir el diente ${enlace.a} con el ${enlace.b} en un puente`}
      onClick={alAlternar}
      onKeyDown={alTeclear}
      className="cursor-pointer"
    >
      <line
        x1={enlace.x1}
        y1={enlace.y1}
        x2={enlace.x2}
        y2={enlace.y2}
        strokeWidth={unido ? 10 : 8}
        strokeLinecap="round"
        className={unido ? "stroke-diente-puente" : "stroke-diente-contorno"}
      />
      {/* Sólo para el dedo: no se ve, pero es lo que se toca. */}
      <line
        x1={enlace.x1}
        y1={enlace.y1}
        x2={enlace.x2}
        y2={enlace.y2}
        stroke="transparent"
        strokeWidth={26}
        strokeLinecap="round"
      />
    </g>
  );
}

/** Un diente del dibujo, con su estado y su nombre dicho completo. */
function Diente({
  trazo,
  unidad,
  abierto,
  enfocable,
  alAbrir,
  alTeclear,
  registrar,
}: {
  trazo: (typeof TRAZOS)[number];
  unidad: UnidadDelCaso | null;
  abierto: boolean;
  enfocable: boolean;
  alAbrir: () => void;
  alTeclear: (evento: React.KeyboardEvent) => void;
  registrar: (nodo: SVGGElement | null) => void;
}) {
  const esPontico = unidad?.rol === "PONTICO";

  const comoEsta = !unidad
    ? "sin trabajo"
    : esPontico
      ? `póntico de ${MATERIALES[unidad.material].toLowerCase()}`
      : `${ROLES_DE_UNIDAD[unidad.rol].toLowerCase()} de ${MATERIALES[
          unidad.material
        ].toLowerCase()}${unidad.color ? ` color ${unidad.color}` : ""}`;

  return (
    <g
      ref={registrar}
      id={`d-${trazo.numero}`}
      data-diente={trazo.numero}
      role="button"
      tabIndex={enfocable ? 0 : -1}
      aria-pressed={abierto}
      aria-label={`Diente ${trazo.numero}, ${nombreDelDiente(trazo.numero)}: ${comoEsta}.`}
      onClick={alAbrir}
      onKeyDown={alTeclear}
      className="cursor-pointer"
    >
      {/* Cuerpo: lo que se rellena según el trabajo. */}
      <path
        d={trazo.cuerpo}
        className={cn(
          !unidad && "fill-diente-cuerpo",
          unidad && !esPontico && "fill-diente-trabajo",
          esPontico && "fill-diente-pontico",
        )}
      />

      {/* Contorno: el trazo gris que entregó diseño. Se oscurece cuando el
          diente lleva trabajo, para que se distinga sin depender del relleno. */}
      <path
        d={trazo.contorno}
        className={
          unidad ? "fill-diente-trabajo-contorno" : "fill-diente-contorno"
        }
      />

      {/* Anillo del diente abierto. Refuerza; no es lo único que lo dice: su
          panel está abierto al lado y el número queda anunciado. */}
      {abierto ? (
        <path
          d={trazo.cuerpo}
          fill="none"
          strokeWidth={5}
          className="stroke-diente-anillo"
        />
      ) : null}

    </g>
  );
}

/** Qué significa cada relleno, escrito. El color nunca va solo (§7). */
function Leyenda() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-minimo text-secundario">
      {[
        ["fill-diente-cuerpo stroke-diente-contorno", "Sin trabajo"],
        ["fill-diente-trabajo stroke-diente-trabajo-contorno", "Con trabajo"],
        ["fill-diente-pontico stroke-diente-trabajo-contorno", "Póntico"],
      ].map(([clases, texto]) => (
        <li key={texto} className="flex items-center gap-1.5">
          <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3">
            <rect
              x="1"
              y="1"
              width="10"
              height="10"
              rx="3"
              strokeWidth="1.5"
              className={clases}
            />
          </svg>
          {texto}
        </li>
      ))}
    </ul>
  );
}

/** En el celular, una arcada a la vez. */
function CambioDeArcada({
  valor,
  alCambiar,
}: {
  valor: "superior" | "inferior";
  alCambiar: (valor: "superior" | "inferior") => void;
}) {
  return (
    <div
      role="group"
      aria-label="Qué arcada se ve"
      className="flex gap-1 rounded-control bg-superficie p-1"
    >
      {(["superior", "inferior"] as const).map((cual) => (
        <button
          key={cual}
          type="button"
          aria-pressed={valor === cual}
          onClick={() => alCambiar(cual)}
          className={cn(
            "alto-tactil flex-1 rounded-control px-3 text-menor font-medium",
            valor === cual
              ? "bg-accion text-sobre-accion"
              : "text-secundario hover:bg-superficie-suave",
          )}
        >
          Arcada {cual}
        </button>
      ))}
    </div>
  );
}

/**
 * El panel del diente abierto: qué se le va a hacer, de qué material y en qué
 * color, y con qué vecino va unido.
 */
function PanelDelDiente({
  diente,
  unidades,
  rolesPermitidos,
  alCambiar,
  alCerrar,
  alAvisar,
}: {
  diente: number | null;
  unidades: UnidadDelCaso[];
  rolesPermitidos: RolDeUnidad[];
  alCambiar: (unidades: UnidadDelCaso[]) => void;
  alCerrar: () => void;
  alAvisar: (aviso: string) => void;
}) {
  const unidad = unidades.find((u) => u.diente === diente) ?? null;

  if (diente === null || !unidad) {
    return (
      <aside className="rounded-tarjeta bg-superficie p-4 text-menor text-secundario">
        <p>
          Toque un diente del odontograma. Aquí le pregunto qué se le va a
          hacer, de qué material y en qué color.
        </p>
        <p className="mt-2">
          Para armar un puente, toque la línea que une dos dientes. Vuelva a
          tocarla para separarlos.
        </p>
      </aside>
    );
  }

  const grupo = puenteDe(unidades, diente);
  const enPuente = Boolean(grupo && grupo.length > 1);
  const materiales = MATERIALES_POR_ROL[unidad.rol];
  const llevaColor = !ROLES_SIN_COLOR.includes(unidad.rol);


  const cambiar = (cambio: Partial<UnidadDelCaso>) =>
    alCambiar(
      unidades.map((u) => (u.diente === diente ? { ...u, ...cambio } : u)),
    );

  return (
    <aside
      aria-label={`Diente ${diente}`}
      className="flex flex-col gap-4 rounded-tarjeta bg-superficie p-4"
      onKeyDown={(e) => {
        if (e.key === "Escape") alCerrar();
      }}
    >
      <div>
        <h3 className="text-subtitulo font-semibold text-primario">
          Diente {diente}
        </h3>
        <p className="text-minimo text-secundario">
          {nombreDelDiente(diente)}
        </p>
      </div>

      {enPuente && grupo ? (
        <div className="flex flex-col gap-2 rounded-control bg-superficie-suave p-3">
          <p className="text-menor font-medium text-primario">
            Puente {nombreDelPuente(grupo)}
          </p>
          <p className="text-minimo text-secundario">
            {ROLES_DE_UNIDAD[unidad.rol]}. {QUE_ES_CADA_ROL[unidad.rol]}
          </p>
          <p className="text-minimo text-secundario">
            En un puente el papel de cada pieza lo manda su lugar: las de los
            extremos son pilares y las de en medio, pónticos. Para separarlo,
            toque la línea que une los dos dientes en el odontograma.
          </p>
        </div>
      ) : (
        <CampoDeSeleccion
          etiqueta="Qué se le va a hacer"
          requerido
          value={unidad.rol}
          onChange={(e) =>
            cambiar(conMaterialValido(e.target.value as RolDeUnidad, unidad))
          }
          ayuda={QUE_ES_CADA_ROL[unidad.rol]}
        >
          {rolesPermitidos.map((rol) => (
            <option key={rol} value={rol}>
              {ROLES_DE_UNIDAD[rol]}
            </option>
          ))}
        </CampoDeSeleccion>
      )}

      <CampoDeSeleccion
        etiqueta="Material"
        requerido
        value={unidad.material}
        onChange={(e) => cambiar({ material: e.target.value as Material })}
      >
        {materiales.map((material) => (
          <option key={material} value={material}>
            {MATERIALES[material]}
          </option>
        ))}
      </CampoDeSeleccion>

      {llevaColor ? (
        <CampoDeSeleccion
          etiqueta="Color"
          requerido
          value={unidad.color ?? "A2"}
          onChange={(e) => cambiar({ color: e.target.value })}
        >
          {COLORES_VITA.map((color) => (
            <option key={color} value={color}>
              {color}
            </option>
          ))}
        </CampoDeSeleccion>
      ) : null}

      <CampoDeTexto
        etiqueta="Notas de este diente"
        value={unidad.notas ?? ""}
        onChange={(e) => cambiar({ notas: e.target.value || null })}
        ayuda="Opcional. Lo que el técnico tenga que saber de esta pieza."
      />

      <Boton
        type="button"
        tono="borde"
        onClick={() => {
          alCambiar(quitar(unidades, diente));
          alAvisar(`Quité el diente ${diente} del caso.`);
          alCerrar();
        }}
      >
        <Trash aria-hidden="true" size={16} />
        Quitar el diente {diente} del caso
      </Boton>
    </aside>
  );
}

/**
 * Si la pantalla es angosta. En el servidor se pinta la boca completa y al
 * montar se ajusta: así el HTML no depende de un tamaño que ahí no se conoce.
 */
function useAngosta() {
  return useSyncExternalStore(
    (avisar) => {
      const consulta = window.matchMedia("(max-width: 1023px)");
      consulta.addEventListener("change", avisar);
      return () => consulta.removeEventListener("change", avisar);
    },
    () => window.matchMedia("(max-width: 1023px)").matches,
    () => false,
  );
}
