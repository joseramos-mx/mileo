"use client";

import { useActionState } from "react";
import { elegirContrasena, type ResultadoContrasena } from "./acciones";

const CAMPO =
    "area-tactil w-full rounded-control border border-borde bg-superficie px-3 text-cuerpo text-primario outline-none focus-visible:ring-2 focus-visible:ring-foco";

export function FormularioDeContrasena() {
    const [estado, accion, enviando] = useActionState<
        ResultadoContrasena,
        FormData
    >(elegirContrasena, {});

    return (
        <form action={accion} className="grid gap-4">
            <label className="grid gap-1.5 text-cuerpo">
                Contraseña nueva
                <input
                    name="contrasena"
                    type="password"
                    required
                    minLength={8}
                    maxLength={72}
                    autoComplete="new-password"
                    className={CAMPO}
                />
            </label>

            <label className="grid gap-1.5 text-cuerpo">
                Repítala
                <input
                    name="confirmacion"
                    type="password"
                    required
                    minLength={8}
                    maxLength={72}
                    autoComplete="new-password"
                    className={CAMPO}
                />
            </label>

            {estado.error ? (
                <p role="alert" className="text-menor text-red-600">
                    {estado.error}
                </p>
            ) : null}

            <button
                type="submit"
                disabled={enviando}
                className="area-tactil rounded-tarjeta bg-accion px-4 text-cuerpo font-medium text-sobre-accion hover:bg-accion-encima disabled:opacity-60"
            >
                {enviando ? "Guardando…" : "Guardar contraseña"}
            </button>
        </form>
    );
}