"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus, X } from "@phosphor-icons/react";
import { crearUsuario, type EstadoDelFormulario } from "./acciones";
import { ETIQUETAS_DE_ROL, ROLES_EN_ORDEN } from "./roles";

const CAMPO =
  "area-tactil w-full rounded-control border border-borde bg-superficie px-3 text-cuerpo text-primario outline-none focus-visible:ring-2 focus-visible:ring-foco";

/** El botón "Agregar usuario" y el modal con su formulario. */
export function NuevoUsuario({
  clinicas,
}: {
  clinicas: { id: string; nombre: string }[];
}) {
  const modal = useRef<HTMLDialogElement>(null);
  const formulario = useRef<HTMLFormElement>(null);
  const [rol, setRol] = useState("LABORATORIO");
  const [estado, accion, enviando] = useActionState<
    EstadoDelFormulario,
    FormData
  >(crearUsuario, {});

  // Al crearse el usuario, se cierra y se limpia.
  useEffect(() => {
    if (estado.ok) {
      modal.current?.close();
      formulario.current?.reset();
    }
  }, [estado]);

  return (
    <>
      <button
        type="button"
        onClick={() => modal.current?.showModal()}
        className="area-tactil flex items-center gap-1.5 rounded-tarjeta bg-accion px-4 text-cuerpo font-medium text-sobre-accion transition-colors hover:bg-accion-encima"
      >
        <Plus aria-hidden="true" size={16} weight="bold" />
        Agregar usuario
      </button>

      <dialog
        ref={modal}
        aria-labelledby="titulo-nuevo-usuario"
        className="vidrio-fuerte m-auto w-[calc(100%-2rem)] max-w-md rounded-contenedor p-6 text-primario backdrop:bg-black/40"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="titulo-nuevo-usuario"
              className="text-xl font-semibold text-primario"
            >
              Agregar usuario
            </h2>
            <p className="mt-1 text-menor text-secundario">
              Le llega un correo con una contraseña temporal. Al entrar elige su
              propia contraseña.
            </p>
          </div>
          <button
            type="button"
            onClick={() => modal.current?.close()}
            className="area-tactil flex items-center justify-center rounded-control text-secundario hover:bg-primario/5"
          >
            <X aria-hidden="true" size={18} />
            <span className="sr-only">Cerrar</span>
          </button>
        </div>

        <form ref={formulario} action={accion} className="mt-5 grid gap-4">
          <label className="grid gap-1.5 text-cuerpo">
            Nombre completo
            <input
              name="nombreCompleto"
              required
              autoComplete="off"
              className={CAMPO}
            />
          </label>

          <label className="grid gap-1.5 text-cuerpo">
            Correo
            <input
              name="correo"
              type="email"
              required
              autoComplete="off"
              className={CAMPO}
            />
          </label>

          <label className="grid gap-1.5 text-cuerpo">
            Rol
            <select
              name="rol"
              value={rol}
              onChange={(e) => setRol(e.target.value)}
              className={CAMPO}
            >
              {ROLES_EN_ORDEN.map((r) => (
                <option key={r} value={r}>
                  {ETIQUETAS_DE_ROL[r]}
                </option>
              ))}
            </select>
          </label>

          {rol === "CLINICA" ? (
            <label className="grid gap-1.5 text-cuerpo">
              Clínica
              <select name="clinicaId" defaultValue="" className={CAMPO}>
                <option value="">Sin clínica</option>
                {clinicas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {estado.error ? (
            <p role="alert" className="text-menor text-red-600">
              {estado.error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => modal.current?.close()}
              className="area-tactil rounded-tarjeta border border-borde px-4 text-cuerpo text-primario hover:bg-primario/5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="area-tactil rounded-tarjeta bg-accion px-4 text-cuerpo font-medium text-sobre-accion hover:bg-accion-encima disabled:opacity-60"
            >
              {enviando ? "Enviando…" : "Crear y enviar acceso"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}