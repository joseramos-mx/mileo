"use client";

import { useActionState, useId, useState } from "react";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import { elegirContrasena, type ResultadoContrasena } from "./acciones";

// Sin `px-3`: a la derecha se deja lugar para el ojito.
const CAMPO =
    "area-tactil w-full rounded-control border border-borde bg-superficie pr-12 pl-3 text-cuerpo text-primario outline-none focus-visible:ring-2 focus-visible:ring-foco";

/** Un campo de contraseña con su ojito para verla u ocultarla. */
function CampoDeContrasena({
    nombre,
    etiqueta,
    ayuda,
}: {
    nombre: string;
    etiqueta: string;
    ayuda?: string;
}) {
    const id = useId();
    const [visible, setVisible] = useState(false);

    return (
        <div className="grid gap-1.5">
            <label htmlFor={id} className="text-cuerpo">
                {etiqueta}
            </label>
            <div className="relative">
                <input
                    id={id}
                    name={nombre}
                    type={visible ? "text" : "password"}
                    required
                    minLength={8}
                    maxLength={72}
                    autoComplete="new-password"
                    aria-describedby={ayuda ? `${id}-ayuda` : undefined}
                    className={CAMPO}
                />
                <button
                    type="button"
                    onClick={() => setVisible((v) => !v)}
                    aria-pressed={visible}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-control text-secundario hover:text-primario focus-visible:ring-2 focus-visible:ring-foco"
                >
                    {visible ? (
                        <EyeSlash aria-hidden="true" size={20} />
                    ) : (
                        <Eye aria-hidden="true" size={20} />
                    )}
                    <span className="sr-only">
                        {visible ? "Ocultar" : "Mostrar"} {etiqueta.toLowerCase()}
                    </span>
                </button>
            </div>
            {ayuda ? (
                <span id={`${id}-ayuda`} className="text-menor text-secundario">
                    {ayuda}
                </span>
            ) : null}
        </div>
    );
}

export function FormularioDeContrasena() {
    const [estado, accion, enviando] = useActionState<
        ResultadoContrasena,
        FormData
    >(elegirContrasena, {});

    return (
        <form action={accion} className="grid gap-4">
            <CampoDeContrasena
                nombre="contrasena"
                etiqueta="Contraseña nueva"
                ayuda="Mínimo 8 caracteres, con una mayúscula, una minúscula, un número y un símbolo."
            />

            <CampoDeContrasena nombre="confirmacion" etiqueta="Repítala" />

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