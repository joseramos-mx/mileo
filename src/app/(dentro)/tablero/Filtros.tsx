"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { PRIORIDADES } from "@/lib/vocabulario";

/**
 * Filtros del tablero (SKILL.md O-5): por doctor, por fecha y por prioridad.
 *
 * Van en la dirección de la pantalla, no en memoria: el laboratorio puede
 * guardar el enlace de "lo de esta semana del doctor Valverde" y volver a él, o
 * pasárselo a quien lo releve.
 */
export function Filtros({
  doctores,
}: {
  doctores: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const consulta = useSearchParams();

  function cambiar(clave: string, valor: string) {
    const nueva = new URLSearchParams(consulta.toString());
    if (valor) nueva.set(clave, valor);
    else nueva.delete(clave);
    router.push(`/tablero?${nueva.toString()}`);
  }

  const hayFiltros = ["doctor", "cuando", "prioridad"].some((c) =>
    consulta.get(c),
  );

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-minimo text-secundario">Doctor</span>
        <select
          value={consulta.get("doctor") ?? ""}
          onChange={(e) => cambiar("doctor", e.target.value)}
          className="area-tactil rounded-control border border-borde bg-superficie px-3 text-menor text-primario"
        >
          <option value="">Todos</option>
          {doctores.map((doctor) => (
            <option key={doctor.id} value={doctor.id}>
              {doctor.nombre}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-minimo text-secundario">Fecha de entrega</span>
        <select
          value={consulta.get("cuando") ?? ""}
          onChange={(e) => cambiar("cuando", e.target.value)}
          className="area-tactil rounded-control border border-borde bg-superficie px-3 text-menor text-primario"
        >
          <option value="">Cualquiera</option>
          <option value="hoy">Hoy</option>
          <option value="semana">Esta semana</option>
          <option value="vencidos">Ya se pasó</option>
          <option value="sin-fecha">Sin fecha todavía</option>
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-minimo text-secundario">Prioridad</span>
        <select
          value={consulta.get("prioridad") ?? ""}
          onChange={(e) => cambiar("prioridad", e.target.value)}
          className="area-tactil rounded-control border border-borde bg-superficie px-3 text-menor text-primario"
        >
          <option value="">Cualquiera</option>
          {Object.entries(PRIORIDADES).map(([clave, nombre]) => (
            <option key={clave} value={clave}>
              {nombre}
            </option>
          ))}
        </select>
      </label>

      {hayFiltros ? (
        <button
          type="button"
          onClick={() => router.push("/tablero")}
          className="area-tactil rounded-control px-2 text-menor text-enlace underline underline-offset-4"
        >
          Quitar los filtros
        </button>
      ) : null}
    </div>
  );
}
