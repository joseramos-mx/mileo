"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  CaretUpDown,
  Gear,
  MagnifyingGlass,
  PaperPlaneTilt,
  Plus,
  SidebarSimple,
  SignOut,
} from "@phosphor-icons/react";
import { salir } from "@/app/acciones-sesion";
import {
  APOYO,
  DESTINOS_DE_LA_CLINICA,
  DESTINOS_DEL_LABORATORIO,
  estaActivo,
  type Destino,
} from "@/componentes/Navegacion";
import { cn } from "@/lib/utilidades";

/**
 * La barra lateral de escritorio: marca y botón para plegarla, buscador,
 * secciones, ayuda, la invitación a mandar un caso y la cuenta al pie.
 *
 * Plegada se queda en íconos. La preferencia va en una cookie y no en el
 * navegador porque el servidor la lee antes de pintar: así no hay parpadeo de
 * ancha a angosta al cargar.
 */

export const COOKIE_DE_LA_BARRA = "mileo-barra-plegada";

function guardarPreferencia(plegada: boolean) {
  document.cookie = `${COOKIE_DE_LA_BARRA}=${plegada ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
}

export function BarraLateral({
  delLaboratorio,
  plegadaAlInicio,
  marca,
  marcaCompacta,
  usuario,
}: {
  delLaboratorio: boolean;
  plegadaAlInicio: boolean;
  /** El logotipo completo y el asterisco solo; los pinta el servidor. */
  marca: ReactNode;
  marcaCompacta: ReactNode;
  usuario: { nombre: string; correo: string; fotoUrl: string | null };
}) {
  const [plegada, setPlegada] = useState(plegadaAlInicio);
  const buscador = useRef<HTMLInputElement>(null);
  const destinos = delLaboratorio
    ? DESTINOS_DEL_LABORATORIO
    : DESTINOS_DE_LA_CLINICA;

  function cambiar(siguiente: boolean) {
    setPlegada(siguiente);
    guardarPreferencia(siguiente);
  }

  // ⌘K / Ctrl+K lleva al buscador desde cualquier pantalla. Si la barra está
  // plegada, primero se abre.
  useEffect(() => {
    function alTeclear(evento: KeyboardEvent) {
      if (
        (evento.metaKey || evento.ctrlKey) &&
        evento.key.toLowerCase() === "k"
      ) {
        evento.preventDefault();
        setPlegada(false);
        guardarPreferencia(false);
        requestAnimationFrame(() => buscador.current?.focus());
      }
    }
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, []);

  return (
    <header
      className={cn(
        "relative isolate hidden shrink-0 flex-col gap-4 overflow-hidden bg-app p-4 transition-[width] duration-200 lg:flex",
        plegada ? "w-[4.75rem]" : "w-72",
      )}
    >
      {/* Luz de fondo: le da al vidrio algo que desenfocar. Y en vez de un
          borde duro, la orilla derecha es una línea que se desvanece. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -left-24 -z-10 size-96 rounded-full bg-accion/15 blur-3xl"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-32 -z-10 size-72 rounded-full bg-accion/8 blur-3xl"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-px bg-linear-to-b from-transparent via-primario/10 to-transparent"
      />

      {/* --- Marca y plegar ----------------------------------------------- */}
      <div
        className={cn(
          "flex items-center pt-1",
          plegada ? "flex-col gap-3" : "justify-between pl-2",
        )}
      >
        <Link href="/" className="flex h-9 items-center">
          {plegada ? marcaCompacta : marca}
        </Link>
        <button
          type="button"
          onClick={() => cambiar(!plegada)}
          aria-expanded={!plegada}
          className="flex size-9 items-center justify-center rounded-control text-secundario transition-colors hover:bg-primario/5 hover:text-primario"
        >
          <SidebarSimple aria-hidden="true" size={20} />
          <span className="sr-only">
            {plegada ? "Abrir la barra lateral" : "Plegar la barra lateral"}
          </span>
        </button>
      </div>

      <hr className="linea-suave" />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden">
        {/* --- Buscador ----------------------------------------------------- */}
        {plegada ? (
          <button
            type="button"
            onClick={() => {
              cambiar(false);
              requestAnimationFrame(() => buscador.current?.focus());
            }}
            className="vidrio vidrio-toque mx-auto flex size-11 items-center justify-center rounded-tarjeta text-secundario hover:text-primario"
          >
            <MagnifyingGlass aria-hidden="true" size={18} />
            <span className="sr-only">Buscar un caso o un paciente</span>
          </button>
        ) : (
          <Buscador referencia={buscador} />
        )}

        {/* --- Secciones ---------------------------------------------------- */}
        <nav aria-label="Secciones de Mileo">
          <ul className="flex flex-col gap-1">
            {destinos.map((destino) => (
              <li key={destino.href}>
                <Enlace destino={destino} plegada={plegada} principal />
              </li>
            ))}
          </ul>
        </nav>

        <hr className="linea-suave" />

        {/* --- Ayuda -------------------------------------------------------- */}
        <nav aria-label="Ayuda" className="flex flex-col gap-1">
          {plegada ? null : (
            <p className="px-3 pb-1 text-minimo font-medium tracking-wide text-secundario uppercase">
              Ayuda
            </p>
          )}
          <ul className="flex flex-col gap-1">
            {APOYO.map((destino) => (
              <li key={destino.nombre}>
                <Enlace destino={destino} plegada={plegada} />
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* --- Mandar un caso (sólo la clínica) ------------------------------ */}
      {delLaboratorio ? null : plegada ? (
        <Link
          href="/casos/nuevo"
          className="mx-auto flex size-11 items-center justify-center rounded-tarjeta bg-accion text-sobre-accion hover:bg-accion-encima"
        >
          <Plus aria-hidden="true" size={18} weight="bold" />
          <span className="sr-only">Nuevo caso</span>
        </Link>
      ) : (
        <div className="vidrio relative rounded-contenedor p-4">
          <p className="flex items-center gap-2 text-cuerpo font-semibold text-primario">
            <PaperPlaneTilt aria-hidden="true" size={18} />
            Envíe su próximo caso
          </p>
          <p className="mt-1.5 text-menor text-secundario">
            Suba el escaneo y el laboratorio lo recibe en el momento.
          </p>
          <Link
            href="/casos/nuevo"
            className="area-tactil mt-4 flex w-full items-center justify-center gap-1.5 rounded-tarjeta bg-accion text-cuerpo font-medium text-sobre-accion shadow-[0_6px_20px_-6px] shadow-accion/70 transition-colors hover:bg-accion-encima"
          >
            <Plus aria-hidden="true" size={16} weight="bold" />
            Nuevo caso
          </Link>
        </div>
      )}

      {/* --- La cuenta ---------------------------------------------------- */}
      <Cuenta {...usuario} plegada={plegada} />
    </header>
  );
}

function sinSuscripcion() {
  return () => {};
}

function Buscador({
  referencia,
}: {
  referencia: React.RefObject<HTMLInputElement | null>;
}) {
  const router = useRouter();
  const consulta = useSearchParams();
  const [texto, setTexto] = useState(consulta.get("buscar") ?? "");
  // En el servidor no se sabe el sistema: se pinta "Ctrl" y el navegador lo
  // corrige sin advertencia de hidratación.
  const esMac = useSyncExternalStore(
    sinSuscripcion,
    () => /mac|iphone|ipad/i.test(navigator.platform),
    () => false,
  );

  function buscar(evento: React.FormEvent) {
    evento.preventDefault();
    const limpio = texto.trim();
    router.push(
      limpio ? `/casos?buscar=${encodeURIComponent(limpio)}` : "/casos",
    );
  }

  return (
    <form onSubmit={buscar} role="search">
      <label className="relative flex items-center">
        <span className="sr-only">Buscar un caso o un paciente</span>
        <MagnifyingGlass
          aria-hidden="true"
          size={16}
          className="pointer-events-none absolute left-3 text-secundario"
        />
        <input
          ref={referencia}
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar…"
          className="vidrio area-tactil w-full rounded-tarjeta border-0 pr-20 pl-9 text-cuerpo text-primario outline-none placeholder:text-secundario focus-visible:ring-2 focus-visible:ring-foco"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-2 flex gap-1"
        >
          <Tecla>{esMac ? "⌘" : "Ctrl"}</Tecla>
          <Tecla>K</Tecla>
        </span>
      </label>
    </form>
  );
}

function Tecla({ children }: { children: ReactNode }) {
  return (
    <kbd className="vidrio flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 font-sans text-minimo text-secundario">
      {children}
    </kbd>
  );
}

function Enlace({
  destino: { href, nombre, icono: Icono },
  plegada,
  principal = false,
}: {
  destino: Destino;
  plegada: boolean;
  principal?: boolean;
}) {
  const ruta = usePathname();
  const activo = principal && estaActivo(ruta, href);

  return (
    <Link
      href={href}
      aria-current={activo ? "page" : undefined}
      title={plegada ? nombre : undefined}
      className={cn(
        "relative flex h-11 items-center gap-3 overflow-hidden rounded-tarjeta text-cuerpo transition-colors",
        plegada ? "justify-center" : "px-3",
        activo
          ? "vidrio-fuerte text-primario"
          : "text-secundario hover:bg-primario/5 hover:text-primario",
      )}
    >
      {activo ? (
        // El brillo azul de la orilla derecha marca dónde está la persona.
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-2/3 bg-linear-to-r from-transparent to-accion/20"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-2.5 right-0 w-0.5 rounded-l-full bg-accion/80 shadow-[0_0_14px_4px] shadow-accion/50"
          />
        </>
      ) : null}
      <Icono aria-hidden="true" size={20} className="relative shrink-0" />
      <span className={cn("relative truncate", plegada && "sr-only")}>
        {nombre}
      </span>
    </Link>
  );
}

function Cuenta({
  nombre,
  correo,
  fotoUrl,
  plegada,
}: {
  nombre: string;
  correo: string;
  fotoUrl: string | null;
  plegada: boolean;
}) {
  const [abierta, setAbierta] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  // Se cierra con Escape o al tocar fuera.
  useEffect(() => {
    if (!abierta) return;
    function alTocar(evento: MouseEvent) {
      if (!caja.current?.contains(evento.target as Node)) setAbierta(false);
    }
    function alTeclear(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAbierta(false);
    }
    document.addEventListener("mousedown", alTocar);
    document.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("mousedown", alTocar);
      document.removeEventListener("keydown", alTeclear);
    };
  }, [abierta]);

  const iniciales = nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join("");

  return (
    <div ref={caja} className="relative">
      {abierta ? (
        <div className="vidrio-fuerte absolute bottom-full left-0 z-20 mb-2 w-56 rounded-tarjeta p-1">
          <Link
            href="/configuracion"
            onClick={() => setAbierta(false)}
            className="flex h-10 items-center gap-3 rounded-control px-3 text-cuerpo text-primario hover:bg-primario/5"
          >
            <Gear aria-hidden="true" size={18} />
            Configuración
          </Link>
          <form action={salir}>
            <button
              type="submit"
              className="flex h-10 w-full items-center gap-3 rounded-control px-3 text-cuerpo text-primario hover:bg-primario/5"
            >
              <SignOut aria-hidden="true" size={18} />
              Salir de Mileo
            </button>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setAbierta((previo) => !previo)}
        aria-expanded={abierta}
        className={cn(
          "vidrio vidrio-toque flex w-full items-center gap-3 rounded-contenedor text-left",
          plegada ? "justify-center p-1.5" : "p-2.5",
        )}
      >
        {fotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fotoUrl}
            alt=""
            className="size-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primario/10 text-menor font-semibold text-primario"
          >
            {iniciales}
          </span>
        )}
        <span className={cn("min-w-0 flex-1", plegada && "sr-only")}>
          <span className="block truncate text-cuerpo font-semibold text-primario">
            {nombre}
          </span>
          <span className="block truncate text-menor text-secundario">
            {correo}
          </span>
        </span>
        {plegada ? null : (
          <CaretUpDown
            aria-hidden="true"
            size={16}
            className="shrink-0 text-secundario"
          />
        )}
        <span className="sr-only">Opciones de la cuenta</span>
      </button>
    </div>
  );
}
