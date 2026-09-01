"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Circle } from "@phosphor-icons/react";
import type { Indicacion } from "@/generated/prisma/enums";
import { Boton } from "@/componentes/Boton";
import { Campo, CampoDeTexto } from "@/componentes/Campo";
import { ZonaDeArchivos } from "@/componentes/ZonaDeArchivos";
import {
  FOTOS_OBLIGATORIAS,
  revisarCalidad,
  type PiezaDelKit,
} from "@/lib/calidad";
import { cerrarControlDeCalidad } from "./acciones";

type ArchivoEnPantalla = {
  id: string;
  nombre: string;
  tipo: string;
  estado: string;
  bytesTotales: number;
};

/**
 * Control de calidad (SKILL.md O-6).
 *
 * Todo el formulario vive en estado de React y la acción recibe datos, no el
 * formulario del navegador: si el servidor rechaza el envío —por ejemplo porque
 * hace falta autorización de dirección— quien está revisando no pierde nada de
 * lo que ya marcó (§6.6).
 */
export function FormularioDeCalidad({
  casoId,
  indicacion,
  piezasDelKit,
  chocaConElDiseno,
  archivos,
}: {
  casoId: string;
  indicacion: Indicacion;
  piezasDelKit: PiezaDelKit[];
  chocaConElDiseno: boolean;
  archivos: ArchivoEnPantalla[];
}) {
  const router = useRouter();
  const [kit, setKit] = useState<string[]>([]);
  const [numeroDeGuia, setNumeroDeGuia] = useState("");
  const [enlaceDeRastreo, setEnlaceDeRastreo] = useState("");
  const [autorizaCorreo, setAutorizaCorreo] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pideAutorizacion, setPideAutorizacion] = useState(chocaConElDiseno);
  const [guardando, empezar] = useTransition();

  const puntos = revisarCalidad({ indicacion, archivos }, kit);
  const listo = puntos.every((p) => p.cumplido);

  function alternarPieza(clave: string) {
    setKit((previas) =>
      previas.includes(clave)
        ? previas.filter((c) => c !== clave)
        : [...previas, clave],
    );
  }

  function cerrar() {
    empezar(async () => {
      const resultado = await cerrarControlDeCalidad({
        casoId,
        kit,
        numeroDeGuia,
        enlaceDeRastreo,
        autorizaCorreo,
        motivo,
      });

      if (resultado.necesitaAutorizacion) setPideAutorizacion(true);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setError(null);
      if (resultado.listo) router.push(resultado.listo);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* --- Las dos fotos obligatorias (O-6) ------------------------------ */}
      <section aria-labelledby="fotos" className="flex flex-col gap-4">
        <div>
          <h2 id="fotos" className="text-subtitulo font-semibold text-primario">
            Las dos fotos
          </h2>
          <p className="mt-1 text-menor text-secundario">
            Sin ellas no puedo marcar el caso como enviado. Son la prueba de
            cómo salió la pieza del laboratorio.
          </p>
        </div>

        {FOTOS_OBLIGATORIAS.map((foto) => (
          <ZonaDeArchivos
            key={foto.tipo}
            casoId={casoId}
            tipo={foto.tipo}
            etiqueta={foto.nombre}
            ayuda={foto.ayuda}
            yaSubidos={archivos
              .filter((a) => a.tipo === foto.tipo && a.estado === "COMPLETO")
              .map((a) => ({
                id: a.id,
                nombre: a.nombre,
                bytesTotales: a.bytesTotales,
                tipo: foto.tipo,
              }))}
            alCambiar={() => router.refresh()}
          />
        ))}
      </section>

      {/* --- El kit -------------------------------------------------------- */}
      <fieldset className="flex flex-col gap-3 rounded-contenedor border border-borde bg-superficie p-4">
        <legend className="text-subtitulo font-semibold text-primario">
          Lo que va en la caja
        </legend>
        <p className="text-menor text-secundario">
          Marque cada cosa conforme la mete. Lo que falte, el doctor lo va a
          pedir por teléfono.
        </p>

        {piezasDelKit.map((pieza) => (
          <label
            key={pieza.clave}
            className="area-tactil flex items-center gap-3"
          >
            <input
              type="checkbox"
              name="kit"
              value={pieza.clave}
              checked={kit.includes(pieza.clave)}
              onChange={() => alternarPieza(pieza.clave)}
              className="size-5 accent-accion"
            />
            <span className="text-cuerpo text-primario">
              {pieza.nombre}
              {pieza.obligatoria ? null : (
                <span className="text-secundario"> (si aplica)</span>
              )}
            </span>
          </label>
        ))}
      </fieldset>

      {/* --- La guía ------------------------------------------------------- */}
      <section className="flex flex-col gap-4">
        <h2 className="text-subtitulo font-semibold text-primario">
          Cómo se va
        </h2>
        <Campo
          etiqueta="Número de guía"
          name="numeroDeGuia"
          autoComplete="off"
          value={numeroDeGuia}
          onChange={(e) => setNumeroDeGuia(e.target.value)}
          ayuda="Para que el doctor sepa dónde va su caso."
        />
        <Campo
          etiqueta="Enlace de rastreo"
          name="enlaceDeRastreo"
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="https://"
          value={enlaceDeRastreo}
          onChange={(e) => setEnlaceDeRastreo(e.target.value)}
        />
      </section>

      {/* --- Lo que falta -------------------------------------------------- */}
      <section
        aria-labelledby="repaso"
        className="flex flex-col gap-3 rounded-contenedor border border-borde bg-superficie p-4"
      >
        <h2 id="repaso" className="text-subtitulo font-semibold text-primario">
          Antes de mandarlo
        </h2>
        <ul className="flex flex-col gap-2">
          {puntos.map((punto) => (
            <li key={punto.clave} className="flex items-start gap-2.5">
              {punto.cumplido ? (
                <CheckCircle
                  aria-hidden="true"
                  size={20}
                  weight="fill"
                  className="mt-0.5 shrink-0 text-terminado"
                />
              ) : (
                <Circle
                  aria-hidden="true"
                  size={20}
                  className="mt-0.5 shrink-0 text-secundario"
                />
              )}
              <div>
                <p className="text-cuerpo text-primario">
                  {punto.titulo}
                  <span className="sr-only">
                    {punto.cumplido ? ": listo" : ": falta"}
                  </span>
                </p>
                {!punto.cumplido ? (
                  <p className="text-menor text-secundario">{punto.queHacer}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* --- Autorización de dirección ------------------------------------- */}
      {pideAutorizacion ? (
        <fieldset className="flex flex-col gap-4 rounded-contenedor border border-pendiente/40 bg-pendiente-fondo p-4">
          <legend className="text-menor font-medium text-pendiente-texto">
            Autorización de dirección
          </legend>
          <Campo
            etiqueta="Correo de dirección"
            name="autorizaCorreo"
            type="email"
            inputMode="email"
            value={autorizaCorreo}
            onChange={(e) => setAutorizaCorreo(e.target.value)}
            ayuda="Quien autoriza que la misma persona cierre diseño y calidad."
          />
          <CampoDeTexto
            etiqueta="Por qué se autoriza"
            name="motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            ayuda="Queda escrito en la bitácora del caso, para siempre."
          />
        </fieldset>
      ) : null}

      <p
        role="alert"
        aria-live="polite"
        className={
          error
            ? "rounded-control border border-pendiente/40 bg-pendiente-fondo px-3 py-2 text-menor text-pendiente-texto"
            : "sr-only"
        }
      >
        {error ?? ""}
      </p>

      <Boton
        type="button"
        tono="principal"
        tamano="grande"
        ancho="completo"
        disabled={!listo || guardando}
        onClick={cerrar}
      >
        {guardando ? "Guardando…" : "Cerrar calidad y mandar el caso"}
      </Boton>

      {!listo ? (
        <p className="text-center text-minimo text-secundario">
          En cuanto estén las dos fotos y el kit completo se activa el botón.
        </p>
      ) : null}
    </div>
  );
}
