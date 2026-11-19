"use client";

import { useState, useTransition } from "react";
import type { Rol } from "@/generated/prisma/enums";
import { cambiarActivo, cambiarRol, reenviarAcceso } from "./acciones";
import { ETIQUETAS_DE_ROL, ROLES_EN_ORDEN } from "./roles";

const BOTON =
    "area-tactil rounded-control border border-borde px-3 text-cuerpo text-primario hover:bg-primario/5 disabled:opacity-60";

/** El rol, el acceso y, si aún no entra, el reenvío del acceso. */
export function ControlesDeUsuario({
    id,
    nombre,
    rol,
    activo,
    pendiente,
    esYo,
}: {
    id: string;
    nombre: string;
    rol: Rol;
    activo: boolean;
    /** Todavía no entra con su contraseña temporal ni elige la suya. */
    pendiente: boolean;
    esYo: boolean;
}) {
    const [enCurso, empezar] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [aviso, setAviso] = useState<string | null>(null);

    function correr(accion: () => Promise<{ error?: string }>, exito?: string) {
        empezar(async () => {
            const resultado = await accion();
            setError(resultado.error ?? null);
            setAviso(resultado.error ? null : (exito ?? null));
        });
    }

    return (
        <div className="flex flex-col items-start gap-1 sm:items-end">
            <div className="flex flex-wrap items-center gap-2">
                <label>
                    <span className="sr-only">Rol de {nombre}</span>
                    <select
                        value={rol}
                        disabled={esYo || enCurso}
                        onChange={(e) => correr(() => cambiarRol(id, e.target.value as Rol))}
                        className="area-tactil rounded-control border border-borde bg-superficie px-2 text-cuerpo text-primario disabled:opacity-60"
                    >
                        {ROLES_EN_ORDEN.map((r) => (
                            <option key={r} value={r}>
                                {ETIQUETAS_DE_ROL[r]}
                            </option>
                        ))}
                    </select>
                </label>
                {pendiente && activo ? (
                    <button
                        type="button"
                        onClick={() =>
                            correr(() => reenviarAcceso(id), "Acceso enviado por correo.")
                        }
                        disabled={enCurso}
                        className={BOTON}
                    >
                        Reenviar acceso
                        <span className="sr-only"> a {nombre}</span>
                    </button>
                ) : null}
                <button
                    type="button"
                    onClick={() => correr(() => cambiarActivo(id, !activo))}
                    disabled={esYo || enCurso}
                    className={BOTON}
                >
                    {activo ? "Desactivar" : "Activar"}
                    <span className="sr-only"> a {nombre}</span>
                </button>
            </div>
            {error ? (
                <p role="alert" className="text-menor text-red-600">
                    {error}
                </p>
            ) : null}
            {aviso ? (
                <p role="status" className="text-menor text-secundario">
                    {aviso}
                </p>
            ) : null}
        </div>
    );
}