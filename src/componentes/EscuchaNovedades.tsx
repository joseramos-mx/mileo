"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Mantiene la pantalla al día sin que nadie tenga que recargar (SKILL.md O-5).
 *
 * Cuando el laboratorio mueve una tarjeta, el doctor lo ve en su pantalla en
 * segundos. Sólo escucha mientras la pestaña está a la vista: en el celular,
 * gastar batería en una pantalla que nadie mira es una falta de respeto.
 */
export function EscuchaNovedades() {
  const router = useRouter();

  useEffect(() => {
    let fuente: EventSource | null = null;
    let pendiente = false;

    /**
     * Nunca se mueve la pantalla debajo del dedo de quien está capturando.
     * Si hay un campo con el foco puesto, la novedad se guarda y se aplica en
     * cuanto la persona suelta el campo.
     */
    function estaCapturando() {
      const activo = document.activeElement;
      if (!activo) return false;
      const etiqueta = activo.tagName;
      return (
        etiqueta === "INPUT" ||
        etiqueta === "SELECT" ||
        etiqueta === "TEXTAREA" ||
        (activo as HTMLElement).isContentEditable
      );
    }

    function actualizar() {
      if (estaCapturando()) {
        pendiente = true;
        return;
      }
      pendiente = false;
      router.refresh();
    }

    function alSoltarElCampo() {
      if (pendiente) actualizar();
    }

    function conectar() {
      if (fuente) return;
      fuente = new EventSource("/api/novedades");
      fuente.addEventListener("novedad", actualizar);
      fuente.onerror = () => {
        fuente?.close();
        fuente = null;
        // El navegador vuelve a intentar al cambiar de visibilidad o al
        // volver a montar. No se insiste en un bucle apretado.
      };
    }

    function desconectar() {
      fuente?.close();
      fuente = null;
    }

    function alCambiarVisibilidad() {
      if (document.visibilityState === "visible") conectar();
      else desconectar();
    }

    if (document.visibilityState === "visible") conectar();
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    document.addEventListener("focusout", alSoltarElCampo);

    return () => {
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      document.removeEventListener("focusout", alSoltarElCampo);
      desconectar();
    };
  }, [router]);

  return null;
}
