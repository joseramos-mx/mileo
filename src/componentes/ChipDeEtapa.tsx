import {
  ArrowsClockwise,
  CheckCircle,
  Cube,
  Gear,
  HandTap,
  MagnifyingGlass,
  PaperPlaneTilt,
  PenNib,
  SealCheck,
  ShieldCheck,
  Tray,
  Warning,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import type { Etapa } from "@/generated/prisma/enums";
import { ETAPAS } from "@/lib/vocabulario";
import { cn } from "@/lib/utilidades";

/**
 * Chip de etapa (SKILL.md §5.4 "StatusChip").
 *
 * Un solo elemento dice el estado: ícono y texto viven dentro del mismo chip.
 * No hay íconos de estado sueltos por la tarjeta —un avión grande arriba y el
 * chip abajo era la misma información dicha dos veces.
 *
 * El ícono va aria-hidden: quien usa lector de pantalla oye el nombre de la
 * etapa, no "imagen". Y el color nunca va solo (§7); el texto siempre está.
 *
 * Tres tonos, tres preguntas:
 *   ámbar — le toca al doctor
 *   azul  — lo tiene el laboratorio
 *   verde — ya salió de aquí
 */

const ICONOS: Record<Etapa, Icon> = {
  RECIBIDO: Tray,
  EN_REVISION: MagnifyingGlass,
  ACEPTADO: SealCheck,
  EN_DISENO: PenNib,
  ESPERANDO_APROBACION: HandTap,
  EN_FABRICACION: Gear,
  EN_CONTROL_DE_CALIDAD: ShieldCheck,
  LISTO_Y_EN_CAMINO: PaperPlaneTilt,
  ENTREGADO: CheckCircle,
  EN_PAUSA: Warning,
  REHACER: ArrowsClockwise,
};

/** Por si alguna etapa nueva se queda sin ícono: un cubo antes que nada. */
const DE_RESERVA: Icon = Cube;

/** El color plano del estado. Es el de la franja lateral de la tarjeta. */
export function colorDeEtapa(etapa: Etapa) {
  const { tono } = ETAPAS[etapa];
  if (tono === "pendiente") return "bg-pendiente";
  if (tono === "terminado") return "bg-terminado";
  return "bg-proceso";
}

export function ChipDeEtapa({
  etapa,
  className,
}: {
  etapa: Etapa;
  className?: string;
}) {
  const { nombre, tono } = ETAPAS[etapa];
  const Icono = ICONOS[etapa] ?? DE_RESERVA;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
        "max-w-full text-minimo font-medium text-balance",
        tono === "pendiente" &&
          "border-pendiente/40 bg-pendiente-fondo text-pendiente-texto",
        tono === "terminado" &&
          "border-terminado/40 bg-terminado-fondo text-terminado-texto",
        tono === "proceso" &&
          "border-proceso/40 bg-proceso-fondo text-proceso-texto",
        className,
      )}
    >
      <Icono aria-hidden="true" size={16} weight="fill" className="shrink-0" />
      {nombre}
    </span>
  );
}
