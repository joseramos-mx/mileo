"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChatCircleDots,
  Folders,
  Gear,
  GraduationCap,
  House,
  Kanban,
  PencilSimple,
  Question,
  Receipt,
  Target,
  Tray,
  Warning,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { cn } from "@/lib/utilidades";

/**
 * Navegación de Mileo.
 *
 * En escritorio vive en la barra lateral (`BarraLateral`). En celular baja al
 * pie, al alcance del pulgar.
 */

export type Destino = {
  href: string;
  nombre: string;
  /** Nombre para la barra de abajo, donde no caben los nombres largos. */
  corto?: string;
  icono: Icon;
};

export const DESTINOS_DE_LA_CLINICA: Destino[] = [
  { href: "/", nombre: "Inicio", icono: House },
  { href: "/casos", nombre: "Casos", icono: Folders },
  { href: "/meta", nombre: "Meta", icono: Target },
  {
    href: "/facturacion",
    nombre: "Facturación",
    corto: "Facturas",
    icono: Receipt,
  },
  { href: "/aprender", nombre: "Aprender", icono: GraduationCap },
  {
    href: "/configuracion",
    nombre: "Configuración",
    corto: "Ajustes",
    icono: Gear,
  },
];

export const DESTINOS_DEL_LABORATORIO: Destino[] = [
  { href: "/", nombre: "Requiere atención", corto: "Atención", icono: Warning },
  { href: "/mi-bandeja", nombre: "Mi bandeja", corto: "Bandeja", icono: Tray },
  { href: "/tablero", nombre: "Tablero", icono: Kanban },
  { href: "/casos", nombre: "Casos", icono: Folders },
  {
    href: "/configuracion",
    nombre: "Configuración",
    corto: "Ajustes",
    icono: Gear,
  },
];

/** Los enlaces de apoyo del pie de la barra lateral. */
export const APOYO: Destino[] = [
  { href: "/ayuda", nombre: "Comentarios", icono: PencilSimple },
  { href: "/ayuda", nombre: "Soporte", icono: Question },
  { href: "/ayuda", nombre: "Chat en vivo", icono: ChatCircleDots },
];

export function estaActivo(ruta: string, href: string) {
  if (href === "/") return ruta === "/";
  return ruta === href || ruta.startsWith(`${href}/`);
}

export function NavegacionInferior({ destinos }: { destinos: Destino[] }) {
  const ruta = usePathname();

  return (
    <nav
      aria-label="Secciones de Mileo"
      className="shrink-0 border-t border-borde bg-superficie lg:hidden"
    >
      <ul className="flex">
        {destinos.map(({ href, nombre, corto, icono: Icono }) => {
          const activo = estaActivo(ruta, href);
          return (
            // min-w-0 para que los renglones puedan encogerse: con el texto
            // al 200%, "Facturación" y "Configuración" empujaban la página
            // entera a lo ancho (§7, zoom al 200%).
            <li key={href} className="min-w-0 flex-1">
              <Link
                href={href}
                aria-current={activo ? "page" : undefined}
                className={cn(
                  "alto-tactil flex flex-col items-center justify-center gap-1 px-1 py-2",
                  "text-minimo",
                  activo ? "font-medium text-primario" : "text-secundario",
                )}
              >
                <Icono
                  aria-hidden="true"
                  size={22}
                  weight={activo ? "fill" : "regular"}
                />
                <span className="w-full text-center leading-tight wrap-break-word hyphens-auto">
                  {corto ?? nombre}
                </span>
                {corto ? <span className="sr-only">{nombre}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
