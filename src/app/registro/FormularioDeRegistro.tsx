"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";
import { Eye, EyeSlash, EnvelopeSimple } from "@phosphor-icons/react";
import { Campo } from "@/componentes/Campo";
import { Boton } from "@/componentes/Boton";
import { registrar, type ResultadoRegistro } from "./acciones";

/**
 * El formulario de registro de clínicas, en dos pasos.
 *
 * Paso 1, "Sus datos": nombre, correo y contraseña (con confirmación).
 * Paso 2, "Su clínica": nombre de la clínica, ciudad y WhatsApp.
 *
 * Solo lo indispensable para entrar y hacer un pedido. La dirección de entrega
 * no se pide aquí: se completa en ajustes, antes de enviar el primer caso. Los
 * campos obligatorios no llevan "(obligatorio)", igual que en la portada; el
 * WhatsApp se entiende opcional porque no lleva marca.
 *
 * Los dos pasos viven en el mismo <form> (el segundo oculto mientras tanto), así
 * que al final se envía todo junto a la misma acción. Cada paso se valida al
 * avanzar, por eso el formulario lleva `noValidate`: si no, el navegador
 * bloquearía el envío por campos del paso que no se está viendo.
 */

const TITULOS_PASO = { 1: "Sus datos", 2: "Su clínica" } as const;

type Paso = 1 | 2;

function BotonOjo({
  visible,
  alAlternar,
  textoVer,
  textoOcultar,
}: {
  visible: boolean;
  alAlternar: () => void;
  textoVer: string;
  textoOcultar: string;
}) {
  return (
    <button
      type="button"
      onClick={alAlternar}
      aria-pressed={visible}
      className="area-tactil flex items-center justify-center rounded-control text-secundario hover:text-primario"
    >
      {visible ? (
        <EyeSlash aria-hidden="true" size={18} />
      ) : (
        <Eye aria-hidden="true" size={18} />
      )}
      <span className="sr-only">{visible ? textoOcultar : textoVer}</span>
    </button>
  );
}

/** Lo que le falta a una contraseña para ser válida (vacío si cumple todo). */
function requisitosFaltantes(contrasena: string): string[] {
  const reglas: [boolean, string][] = [
    [contrasena.length >= 8, "8 caracteres como mínimo"],
    [/\p{Lu}/u.test(contrasena), "una mayúscula"],
    [/\p{Ll}/u.test(contrasena), "una minúscula"],
    [/\d/.test(contrasena), "un número"],
    [/[^\p{L}\p{N}\s]/u.test(contrasena), "un símbolo (por ejemplo ! # $ %)"],
  ];
  return reglas.filter(([cumple]) => !cumple).map(([, texto]) => texto);
}

/** Revisa los campos de un paso; al primero inválido le muestra el aviso nativo. */
function validarPaso(contenedor: RefObject<HTMLDivElement | null>): boolean {
  const campos = contenedor.current?.querySelectorAll("input") ?? [];
  for (const campo of campos) {
    if (!campo.checkValidity()) {
      campo.reportValidity();
      return false;
    }
  }
  return true;
}

export function FormularioDeRegistro() {
  const [resultado, accion, enviando] = useActionState<
    ResultadoRegistro,
    FormData
  >(registrar, {});
  const [paso, setPaso] = useState<Paso>(1);
  const [verContrasena, setVerContrasena] = useState(false);
  const [verConfirmacion, setVerConfirmacion] = useState(false);
  // Para volver al formulario desde "revise su correo" sin perder lo escrito.
  const [ocultoPara, setOcultoPara] = useState<ResultadoRegistro | null>(null);
  // Error que se detecta en el navegador (contraseña corta o que no coincide).
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  const formulario = useRef<HTMLFormElement>(null);
  const paso1 = useRef<HTMLDivElement>(null);
  const paso2 = useRef<HTMLDivElement>(null);
  const primeraVez = useRef(true);

  // Al cambiar de paso, el cursor pasa al primer campo del paso nuevo.
  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false;
      return;
    }
    const actual = paso === 1 ? paso1 : paso2;
    actual.current?.querySelector("input")?.focus();
  }, [paso]);

  const valores = resultado.valores;
  const error = errorLocal ?? resultado.error;

  function continuar() {
    if (!validarPaso(paso1) || !formulario.current) return;

    const datos = new FormData(formulario.current);
    const contrasena = String(datos.get("contrasena") ?? "");
    const confirmacion = String(datos.get("confirmarContrasena") ?? "");

    const faltantes = requisitosFaltantes(contrasena);
    if (faltantes.length > 0) {
      setErrorLocal(`A la contraseña le falta: ${faltantes.join(", ")}.`);
      return;
    }
    if (contrasena !== confirmacion) {
      setErrorLocal("Las contraseñas no coinciden. Escríbalas de nuevo.");
      return;
    }

    setErrorLocal(null);
    setPaso(2);
  }

  // En el paso 1 el envío (botón o Enter) solo avanza. En el paso 2 se revisan
  // los campos y, si todo está bien, el formulario se va a la acción. Con
  // preventDefault la acción no corre y lo escrito se conserva.
  function alEnviar(e: FormEvent<HTMLFormElement>) {
    if (paso === 1) {
      e.preventDefault();
      continuar();
      return;
    }
    if (!validarPaso(paso2)) e.preventDefault();
  }

  if (resultado.enviadoA && ocultoPara !== resultado) {
    return (
      <div role="status" className="mt-12 flex flex-col items-center gap-4 text-center">
        <EnvelopeSimple aria-hidden="true" size={40} className="text-primario" />
        <h1 className="text-titulo font-normal text-primario">
          Revise su correo
        </h1>
        <p className="text-menor text-secundario">
          Le mandamos un enlace a{" "}
          <span className="font-medium text-primario">
            {resultado.enviadoA}
          </span>
          . Ábralo para confirmar su cuenta y empezar a hacer pedidos.
        </p>
        <p className="text-menor text-secundario">
          ¿No le llegó? Revise la carpeta de correo no deseado o{" "}
          <button
            type="button"
            onClick={() => setOcultoPara(resultado)}
            className="font-medium text-primario underline underline-offset-4"
          >
            vuelva a intentarlo
          </button>
          .
        </p>
      </div>
    );
  }

  return (
    <>
      <h1 className="mt-4 text-center text-titulo font-normal text-primario">
        Cree su cuenta
      </h1>
      <p className="mt-2 text-center text-menor text-secundario">
        Registre su clínica y mande su primer caso hoy.
      </p>

      <ol aria-hidden="true" className="mt-4 flex gap-2">
        {([1, 2] as const).map((n) => (
          <li
            key={n}
            className={`h-1 flex-1 rounded-full ${
              n <= paso ? "bg-primario" : "bg-primario/20"
            }`}
          />
        ))}
      </ol>
      <p className="mt-1.5 text-menor text-secundario">
        Paso {paso} de 2 · {TITULOS_PASO[paso]}
      </p>

      <form
        ref={formulario}
        action={accion}
        onSubmit={alEnviar}
        // Al corregir cualquier campo se quita el aviso local.
        onChange={() => errorLocal && setErrorLocal(null)}
        noValidate
        className="mt-4 flex flex-col gap-3"
      >
        {/* Paso 1: quién es y cómo entra */}
        <div
          ref={paso1}
          className={paso === 1 ? "flex flex-col gap-3" : "hidden"}
        >
          <Campo
            etiqueta="Su nombre completo"
            name="nombreCompleto"
            type="text"
            autoComplete="name"
            placeholder="Dra. Ana Pérez"
            defaultValue={valores?.nombreCompleto}
            requerido
            marcaRequerido={false}
            autoFocus
          />

          <Campo
            etiqueta="Correo"
            name="correo"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="doctor@suclinica.mx"
            defaultValue={valores?.correo}
            requerido
            marcaRequerido={false}
          />

          <Campo
            etiqueta="Contraseña"
            name="contrasena"
            type={verContrasena ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            requerido
            marcaRequerido={false}
            sufijo={
              <BotonOjo
                visible={verContrasena}
                alAlternar={() => setVerContrasena((v) => !v)}
                textoVer="Ver la contraseña"
                textoOcultar="Ocultar la contraseña"
              />
            }
          />

          <Campo
            etiqueta="Confirme su contraseña"
            name="confirmarContrasena"
            type={verConfirmacion ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Repítala"
            requerido
            marcaRequerido={false}
            sufijo={
              <BotonOjo
                visible={verConfirmacion}
                alAlternar={() => setVerConfirmacion((v) => !v)}
                textoVer="Ver la confirmación de la contraseña"
                textoOcultar="Ocultar la confirmación de la contraseña"
              />
            }
          />
        </div>

        {/* Paso 2: de qué clínica y cómo avisarle */}
        <div
          ref={paso2}
          className={paso === 2 ? "flex flex-col gap-3" : "hidden"}
        >
          <Campo
            etiqueta="Nombre de la clínica"
            name="nombreClinica"
            type="text"
            autoComplete="organization"
            placeholder="Clínica Dental Sonrisa"
            defaultValue={valores?.nombreClinica}
            requerido
            marcaRequerido={false}
          />

          <Campo
            etiqueta="Ciudad"
            name="ciudad"
            type="text"
            autoComplete="address-level2"
            placeholder="Durango"
            defaultValue={valores?.ciudad}
            requerido
            marcaRequerido={false}
          />

          <Campo
            etiqueta="WhatsApp"
            name="telefono"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="618 123 4567"
            defaultValue={valores?.telefono}
          />
        </div>

        {/* Trampa para robots: escondido para las personas y para el lector de
            pantalla; un robot lo llena y así se descarta el registro. */}
        <div aria-hidden="true" className="sr-only">
          <label>
            No llenar este campo
            <input type="text" name="sitio" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        {/* El error se anuncia sin robar el foco de donde está el doctor. */}
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

        <div className="mt-1 flex flex-col gap-3">
          <Boton
            type="submit"
            tono="principal"
            ancho="completo"
            disabled={enviando}
          >
            {paso === 1
              ? "Continuar"
              : enviando
                ? "Creando su cuenta…"
                : "Crear cuenta"}
          </Boton>

          {paso === 2 && (
            <button
              type="button"
              onClick={() => {
                setErrorLocal(null);
                setPaso(1);
              }}
              disabled={enviando}
              className="area-tactil self-center text-menor font-medium text-secundario underline underline-offset-4 hover:text-primario"
            >
              Atrás
            </button>
          )}
        </div>
      </form>
    </>
  );
}