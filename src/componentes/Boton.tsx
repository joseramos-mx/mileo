import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import Link from "next/link";
import { cn } from "@/lib/utilidades";

/**
 * Botón (SKILL.md §5.4 "Button").
 *
 * Una acción principal por pantalla (§6.1): un solo elemento con relleno azul.
 * Todo lo demás es texto o borde. Si una pantalla necesita una variante nueva,
 * se agrega aquí como prop, nunca copiando el componente (§11).
 *
 * Botones con verbo: "Entrar", "Crear caso", "Aprobar". Nunca "Enviar"
 * genérico (§8).
 */

const estilos = cva(
  [
    // Área táctil mínima de 44x44 px (§7): se cumple aquí, no en cada pantalla.
    "area-tactil inline-flex items-center justify-center gap-2",
    "rounded-control px-4 font-medium",
    "transition-colors duration-150",
    "disabled:cursor-not-allowed disabled:opacity-50",
  ],
  {
    variants: {
      tono: {
        principal:
          "bg-accion text-sobre-accion hover:bg-accion-encima border border-transparent",
        borde:
          "border border-borde bg-superficie text-primario hover:bg-superficie-suave",
        texto: "text-enlace underline-offset-4 hover:underline px-2",
      },
      tamano: {
        normal: "text-cuerpo",
        grande: "min-h-13 text-realce px-6",
      },
      ancho: {
        automatico: "",
        completo: "w-full",
      },
    },
    defaultVariants: {
      tono: "borde",
      tamano: "normal",
      ancho: "automatico",
    },
  },
);

type Estilos = VariantProps<typeof estilos>;

export function Boton({
  tono,
  tamano,
  ancho,
  className,
  ...props
}: ComponentProps<"button"> & Estilos) {
  return (
    <button
      className={cn(estilos({ tono, tamano, ancho }), className)}
      {...props}
    />
  );
}

/** Mismo botón, pero navega. Salidas siempre disponibles (§6.9). */
export function BotonEnlace({
  tono,
  tamano,
  ancho,
  className,
  ...props
}: ComponentProps<typeof Link> & Estilos) {
  return (
    <Link
      className={cn(estilos({ tono, tamano, ancho }), className)}
      {...props}
    />
  );
}
