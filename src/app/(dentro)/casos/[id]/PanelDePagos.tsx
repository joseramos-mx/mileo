"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle,
  CreditCard,
  FilePdf,
  MapPin,
  Package,
  PauseCircle,
  Truck,
  XCircle,
} from "@phosphor-icons/react";
import { Boton } from "@/componentes/Boton";
import { ejecutar } from "@/lib/acciones-cliente";
import { ESTADOS_MEXICO_ENVIA } from "@/lib/estados-mexico";
import {
  cambiarEtapa,
  dejarPagoPendienteClinica,
  evaluarCasoLaboratorio,
  rechazarCotizacionClinica,
  solicitarLiquidacion,
} from "./acciones";
import type { Etapa, ModalidadEnvio } from "@/generated/prisma/enums";

type TarifaEnviaCliente = {
  carrier: string;
  carrierDescription: string;
  service: string;
  serviceDescription: string;
  deliveryEstimate: string;
  totalPriceCentavos: number;
  currency: string;
};

type DireccionClinica = {
  ciudad: string;
  codigoPostal: string;
  calle: string;
  numeroExterior: string;
  colonia: string;
  estadoEnvio: string;
  telefonoEnvio: string;
  correoEnvio: string;
};

type InfoEnvioEnvia = {
  carrier: string | null;
  servicioNombre: string | null;
  numeroGuia: string | null;
  urlEtiquetaPdf: string | null;
  urlRastreo: string | null;
};

function pesos(centavos: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: centavos % 100 === 0 ? 0 : 2,
  }).format(centavos / 100);
}

export function PanelDePagos({
  casoId,
  etapa,
  delLaboratorio,
  totalCentavos,
  montoOriginalCentavos,
  motivoCambioPrecio,
  anticipoCentavos,
  anticipoPagado,
  liquidacionPagada,
  modalidadEnvioActual,
  costoEnvioActualCentavos,
  costosEnvio,
  motivoCierre,
  clinicaDireccion,
  envioEnvia,
}: {
  casoId: string;
  etapa: Etapa;
  delLaboratorio: boolean;
  totalCentavos: number | null;
  montoOriginalCentavos: number | null;
  motivoCambioPrecio: string | null;
  anticipoCentavos: number | null;
  anticipoPagado: boolean;
  liquidacionPagada: boolean;
  modalidadEnvioActual: ModalidadEnvio | null;
  costoEnvioActualCentavos: number | null;
  costosEnvio: {
    localCentavos: number;
    nacionalCentavos: number;
    recoleccionCentavos: number;
  };
  motivoCierre: string | null;
  clinicaDireccion: DireccionClinica;
  envioEnvia: InfoEnvioEnvia;
}) {
  const router = useRouter();
  const [trabajando, empezar] = useTransition();
  const [pagandoStripe, setPagandoStripe] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estado de evaluación inicial (Laboratorio)
  const [montoPesos, setMontoPesos] = useState(
    totalCentavos ? String(totalCentavos / 100) : "",
  );
  const [motivoCambioPrecioInput, setMotivoCambioPrecioInput] = useState(
    motivoCambioPrecio ?? "",
  );
  const [modoLab, setModoLab] = useState<"ninguno" | "correccion" | "declinar">(
    "ninguno",
  );
  const [motivoLab, setMotivoLab] = useState("");

  // Estado de liquidación final (Clínica) y Envia.com
  const [modalidadEnvio, setModalidadEnvio] = useState<ModalidadEnvio>(
    modalidadEnvioActual ?? "NACIONAL",
  );
  const direccionCompleta = Boolean(
    clinicaDireccion.codigoPostal &&
      clinicaDireccion.calle &&
      clinicaDireccion.ciudad &&
      clinicaDireccion.estadoEnvio,
  );
  const [editandoDireccion, setEditandoDireccion] =
    useState(!direccionCompleta);
  const [dir, setDir] = useState<DireccionClinica>(clinicaDireccion);
  const [tarifasEnvia, setTarifasEnvia] = useState<TarifaEnviaCliente[]>([]);
  const [tarifaSeleccionada, setTarifaSeleccionada] =
    useState<TarifaEnviaCliente | null>(null);
  const [cotizandoEnvia, setCotizandoEnvia] = useState(false);
  const [generandoGuia, setGenerandoGuia] = useState(false);

  async function cotizarEnvia() {
    setError(null);
    setCotizandoEnvia(true);
    try {
      const resp = await fetch("/api/envia/cotizar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          casoId,
          ...(editandoDireccion || !direccionCompleta ? { direccion: dir } : {}),
        }),
      });
      const datos = (await resp.json()) as {
        tarifas?: TarifaEnviaCliente[];
        error?: string;
        requiereDireccion?: boolean;
      };
      if (!resp.ok || !datos.tarifas) {
        if (datos.requiereDireccion) setEditandoDireccion(true);
        setError(datos.error ?? "No pude cotizar el envío en Envia.com.");
        setCotizandoEnvia(false);
        return;
      }
      setTarifasEnvia(datos.tarifas);
      setTarifaSeleccionada(datos.tarifas[0] ?? null);
      setEditandoDireccion(false);
    } catch {
      setError("Error de red al consultar Envia.com.");
    } finally {
      setCotizandoEnvia(false);
    }
  }

  async function generarGuiaManual() {
    setError(null);
    setGenerandoGuia(true);
    try {
      const resp = await fetch("/api/envia/guia", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ casoId }),
      });
      const datos = (await resp.json()) as { error?: string };
      if (!resp.ok) {
        setError(datos.error ?? "No pude generar la guía en Envia.com.");
        setGenerandoGuia(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Error de red al conectar con Envia.com.");
    } finally {
      setGenerandoGuia(false);
    }
  }

  async function iniciarCheckoutStripe(
    tipo: "ANTICIPO" | "LIQUIDACION",
    modalidad?: ModalidadEnvio,
  ) {
    setError(null);
    setPagandoStripe(true);
    try {
      const usaEnvia =
        tipo === "LIQUIDACION" &&
        modalidad !== "RECOLECCION" &&
        tarifaSeleccionada !== null;

      const resp = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          casoId,
          tipo,
          ...(modalidad ? { modalidadEnvio: modalidad } : {}),
          ...(usaEnvia && tarifaSeleccionada
            ? {
                enviaCarrier: tarifaSeleccionada.carrier,
                enviaServicio: tarifaSeleccionada.service,
                enviaServicioNombre: `${tarifaSeleccionada.carrierDescription} · ${tarifaSeleccionada.serviceDescription}`,
                enviaCostoCentavos: tarifaSeleccionada.totalPriceCentavos,
              }
            : {}),
        }),
      });
      const datos = (await resp.json()) as { url?: string; error?: string };
      if (!resp.ok || !datos.url) {
        setError(datos.error ?? "No pude abrir la pasarela de pago Stripe.");
        setPagandoStripe(false);
        return;
      }
      window.location.href = datos.url;
    } catch {
      setError("Error de red al conectar con Stripe.");
      setPagandoStripe(false);
    }
  }

  // 1. Casos cerrados (DECLINADO / CANCELADO)
  if (etapa === "DECLINADO" || etapa === "CANCELADO") {
    return (
      <section className="rounded-contenedor border border-pendiente/40 bg-pendiente-fondo p-4">
        <div className="flex items-start gap-2.5">
          <XCircle
            aria-hidden="true"
            size={20}
            weight="fill"
            className="mt-0.5 shrink-0 text-pendiente-texto"
          />
          <div>
            <p className="text-cuerpo font-semibold text-pendiente-texto">
              {etapa === "DECLINADO"
                ? "Caso declinado por el laboratorio"
                : "Caso cancelado por la clínica"}
            </p>
            {motivoCierre ? (
              <p className="mt-1 text-menor text-pendiente-texto">
                Motivo: {motivoCierre}
              </p>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  // 2. Evaluación y cotización inicial (Laboratorio en RECIBIDO o EN_REVISION)
  if (delLaboratorio && (etapa === "RECIBIDO" || etapa === "EN_REVISION")) {
    const montoNumerico = Number(montoPesos);
    const totalPreview =
      Number.isFinite(montoNumerico) && montoNumerico > 0
        ? Math.round(montoNumerico * 100)
        : null;
    const anticipoPreview = totalPreview ? Math.round(totalPreview / 2) : null;
    const precioFueCambiado =
      totalCentavos !== null &&
      totalCentavos > 0 &&
      totalPreview !== null &&
      totalPreview !== totalCentavos;

    return (
      <section className="flex flex-col gap-4 rounded-contenedor border border-borde bg-superficie p-5">
        <div>
          <h2 className="text-subtitulo font-semibold text-primario">
            Evaluación inicial y cotización
          </h2>
          <p className="mt-1 text-menor text-secundario">
            Revise la viabilidad y los archivos del caso. Puede aceptar y pedir
            el anticipo del 50%, solicitar corrección de archivos o declinar.
          </p>
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-control border border-pendiente/40 bg-pendiente-fondo px-3 py-2 text-menor text-pendiente-texto"
          >
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 rounded-tarjeta border border-borde bg-superficie-suave p-3.5">
          <label
            htmlFor="monto-total-caso"
            className="text-menor font-medium text-primario"
          >
            Costo total del trabajo (MXN)
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              id="monto-total-caso"
              type="number"
              min="1"
              step="0.01"
              value={montoPesos}
              onChange={(e) => setMontoPesos(e.target.value)}
              placeholder={
                totalCentavos
                  ? String(totalCentavos / 100)
                  : "Ej. 2400 (requiere cotización)"
              }
              className="w-52 rounded-control border border-borde bg-superficie px-3 py-2 text-cuerpo text-primario"
            />
            {anticipoPreview ? (
              <span className="text-menor text-secundario">
                Anticipo 50%:{" "}
                <strong className="text-primario">
                  {pesos(anticipoPreview)}
                </strong>
              </span>
            ) : (
              <span className="text-menor text-pendiente-texto">
                Sin precio asignado (requiere cotización).
              </span>
            )}
          </div>

          {precioFueCambiado ? (
            <div className="mt-2 flex flex-col gap-1.5 border-t border-borde pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="motivo-cambio-precio"
                  className="text-menor font-medium text-primario"
                >
                  Motivo del cambio de precio (obligatorio)
                </label>
                <span className="text-minimo text-secundario">
                  Precio original: {pesos(totalCentavos)}
                </span>
              </div>
              <textarea
                id="motivo-cambio-precio"
                rows={2}
                value={motivoCambioPrecioInput}
                onChange={(e) => setMotivoCambioPrecioInput(e.target.value)}
                placeholder="Ej. Se ajustó por aditamento adicional o complejidad del caso."
                className="w-full rounded-control border border-borde bg-superficie px-3 py-2 text-cuerpo text-primario"
              />
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Boton
            type="button"
            tono="principal"
            disabled={trabajando}
            onClick={() => {
              setError(null);
              if (
                precioFueCambiado &&
                motivoCambioPrecioInput.trim().length < 5
              ) {
                setError(
                  "Indique el motivo por el cual cambió el precio antes de aceptar el caso.",
                );
                return;
              }
              empezar(async () => {
                const res = await ejecutar(() =>
                  evaluarCasoLaboratorio(casoId, {
                    decision: "ACEPTAR",
                    montoTotalPesos:
                      Number.isFinite(montoNumerico) && montoNumerico > 0
                        ? montoNumerico
                        : undefined,
                    ...(precioFueCambiado
                      ? { motivoCambioPrecio: motivoCambioPrecioInput.trim() }
                      : {}),
                  }),
                );
                if (res.error) setError(res.error);
                else router.refresh();
              });
            }}
          >
            {trabajando
              ? "Procesando…"
              : "Aceptar y solicitar anticipo (50%)"}
          </Boton>

          <Boton
            type="button"
            disabled={trabajando}
            onClick={() => {
              setError(null);
              setModoLab(modoLab === "correccion" ? "ninguno" : "correccion");
            }}
          >
            Solicitar corrección de archivos
          </Boton>

          <Boton
            type="button"
            disabled={trabajando}
            onClick={() => {
              setError(null);
              setModoLab(modoLab === "declinar" ? "ninguno" : "declinar");
            }}
          >
            Declinar caso
          </Boton>
        </div>

        {modoLab !== "ninguno" ? (
          <div className="flex flex-col gap-3 rounded-tarjeta border border-borde bg-superficie-suave p-3.5">
            <label
              htmlFor="motivo-lab"
              className="text-menor font-medium text-primario"
            >
              {modoLab === "correccion"
                ? "¿Qué archivos faltan o deben corregirse?"
                : "Motivo para declinar el caso"}
            </label>
            <textarea
              id="motivo-lab"
              rows={2}
              value={motivoLab}
              onChange={(e) => setMotivoLab(e.target.value)}
              placeholder={
                modoLab === "correccion"
                  ? "Ej. Falta el archivo de mordida o el STL superior está incompleto."
                  : "Ej. Espacio protésico insuficiente para el diseño solicitado."
              }
              className="w-full rounded-control border border-borde bg-superficie px-3 py-2 text-cuerpo text-primario"
            />
            <div className="flex gap-2">
              <Boton
                type="button"
                tono="principal"
                disabled={trabajando}
                onClick={() => {
                  setError(null);
                  empezar(async () => {
                    const res = await ejecutar(() =>
                      evaluarCasoLaboratorio(casoId, {
                        decision:
                          modoLab === "correccion" ? "CORRECCION" : "DECLINAR",
                        motivo: motivoLab,
                      }),
                    );
                    if (res.error) setError(res.error);
                    else {
                      setModoLab("ninguno");
                      setMotivoLab("");
                      router.refresh();
                    }
                  });
                }}
              >
                {modoLab === "correccion"
                  ? "Regresar al paso 3 para corrección"
                  : "Confirmar declinación"}
              </Boton>
              <Boton
                type="button"
                onClick={() => {
                  setModoLab("ninguno");
                  setMotivoLab("");
                }}
              >
                Cancelar
              </Boton>
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  // 3. Autorización de pago inicial (Clínica en ESPERANDO_PAGO o EN_PAUSA sin anticipo)
  if (
    !anticipoPagado &&
    (etapa === "ESPERANDO_PAGO" || etapa === "EN_PAUSA") &&
    totalCentavos
  ) {
    const anticipo = anticipoCentavos ?? Math.round(totalCentavos / 2);
    const restante = totalCentavos - anticipo;

    return (
      <section className="flex flex-col gap-4 rounded-contenedor border border-pendiente/40 bg-superficie p-5">
        <div className="flex items-start gap-2.5">
          <CreditCard
            aria-hidden="true"
            size={22}
            className="mt-0.5 shrink-0 text-pendiente-texto"
          />
          <div>
            <h2 className="text-subtitulo font-semibold text-primario">
              Autorización y anticipo (50%)
            </h2>
            <p className="mt-1 text-menor text-secundario">
              {delLaboratorio
                ? "Esperando a que la clínica cubra el anticipo del 50% para liberar el inicio de diseño."
                : "Cubra el 50% de anticipo con Stripe para liberar el inicio del diseño 3D."}
            </p>
          </div>
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-control border border-pendiente/40 bg-pendiente-fondo px-3 py-2 text-menor text-pendiente-texto"
          >
            {error}
          </p>
        ) : null}

        <div className="grid gap-3 rounded-tarjeta border border-borde bg-superficie-suave p-4 sm:grid-cols-3">
          <div>
            <p className="text-minimo text-secundario">Costo total del caso</p>
            <p className="text-realce font-semibold text-primario">
              {pesos(totalCentavos)}
            </p>
          </div>
          <div>
            <p className="text-minimo text-secundario">Anticipo a pagar (50%)</p>
            <p className="text-realce font-semibold text-primario">
              {pesos(anticipo)}
            </p>
          </div>
          <div>
            <p className="text-minimo text-secundario">
              Restante al terminar (+ envío)
            </p>
            <p className="text-realce font-medium text-secundario">
              {pesos(restante)}
            </p>
          </div>
        </div>

        {motivoCambioPrecio ? (
          <div className="rounded-tarjeta border border-pendiente/40 bg-pendiente-fondo p-3.5 text-menor text-pendiente-texto">
            <p className="font-semibold">
              Ajuste de precio por el laboratorio
              {montoOriginalCentavos
                ? ` (${pesos(montoOriginalCentavos)} → ${pesos(totalCentavos)})`
                : ""}
            </p>
            <p className="mt-1">Motivo: {motivoCambioPrecio}</p>
          </div>
        ) : null}

        {!delLaboratorio ? (
          <div className="flex flex-wrap gap-2">
            <Boton
              type="button"
              tono="principal"
              disabled={pagandoStripe || trabajando}
              onClick={() => void iniciarCheckoutStripe("ANTICIPO")}
            >
              <CreditCard aria-hidden="true" size={18} />
              {pagandoStripe
                ? "Abriendo Stripe…"
                : `Pagar anticipo (${pesos(anticipo)})`}
            </Boton>

            {etapa !== "EN_PAUSA" ? (
              <Boton
                type="button"
                disabled={pagandoStripe || trabajando}
                onClick={() => {
                  setError(null);
                  empezar(async () => {
                    const res = await ejecutar(() =>
                      dejarPagoPendienteClinica(casoId),
                    );
                    if (res.error) setError(res.error);
                    else router.refresh();
                  });
                }}
              >
                <PauseCircle aria-hidden="true" size={18} />
                Dejar pago pendiente
              </Boton>
            ) : null}

            <Boton
              type="button"
              disabled={pagandoStripe || trabajando}
              onClick={() => {
                setError(null);
                empezar(async () => {
                  const res = await ejecutar(() =>
                    rechazarCotizacionClinica(casoId),
                  );
                  if (res.error) setError(res.error);
                  else router.refresh();
                });
              }}
            >
              Rechazar y cancelar caso
            </Boton>
          </div>
        ) : null}
      </section>
    );
  }

  // 4. Notificación de trabajo terminado -> solicitar liquidación (Laboratorio)
  if (
    delLaboratorio &&
    !liquidacionPagada &&
    (etapa === "EN_FABRICACION" || etapa === "EN_CONTROL_DE_CALIDAD")
  ) {
    return (
      <section className="flex flex-col gap-3 rounded-contenedor border border-borde bg-superficie p-5">
        <div>
          <h2 className="text-subtitulo font-semibold text-primario">
            Liquidación final (50% restante + envío)
          </h2>
          <p className="mt-1 text-menor text-secundario">
            Cuando el producto esté terminado, notifique a la clínica para que
            elija su modalidad de envío y liquide el 50% restante antes del
            despacho.
          </p>
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-control border border-pendiente/40 bg-pendiente-fondo px-3 py-2 text-menor text-pendiente-texto"
          >
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Boton
            type="button"
            tono="principal"
            disabled={trabajando}
            onClick={() => {
              setError(null);
              empezar(async () => {
                const res = await ejecutar(() => solicitarLiquidacion(casoId));
                if (res.error) setError(res.error);
                else router.refresh();
              });
            }}
          >
            <Truck aria-hidden="true" size={18} />
            {trabajando
              ? "Notificando…"
              : "Notificar terminado y solicitar liquidación"}
          </Boton>
        </div>
      </section>
    );
  }

  // 5. Liquidación final (Clínica en ESPERANDO_LIQUIDACION)
  if (etapa === "ESPERANDO_LIQUIDACION" && !liquidacionPagada && totalCentavos) {
    const anticipo = anticipoCentavos ?? Math.round(totalCentavos / 2);
    const restante = totalCentavos - anticipo;
    const requierePaqueteria = modalidadEnvio !== "RECOLECCION";
    const costoEnvioSeleccionado = requierePaqueteria
      ? (tarifaSeleccionada?.totalPriceCentavos ?? 0)
      : costosEnvio.recoleccionCentavos;
    const totalLiquidar = restante + costoEnvioSeleccionado;
    const listoParaPagar =
      modalidadEnvio === "RECOLECCION" || tarifaSeleccionada !== null;

    return (
      <section className="flex flex-col gap-4 rounded-contenedor border border-pendiente/40 bg-superficie p-5">
        <div className="flex items-start gap-2.5">
          <Truck
            aria-hidden="true"
            size={22}
            className="mt-0.5 shrink-0 text-pendiente-texto"
          />
          <div>
            <h2 className="text-subtitulo font-semibold text-primario">
              Liquidación final (50% restante + envío)
            </h2>
            <p className="mt-1 text-menor text-secundario">
              {delLaboratorio
                ? "Esperando a que la clínica elija modalidad de envío y liquide el saldo para despachar."
                : "Su trabajo está terminado. Elija cómo desea recibirlo, cotice su envío real con Envia.com y cubra el 50% restante."}
            </p>
          </div>
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-control border border-pendiente/40 bg-pendiente-fondo px-3 py-2 text-menor text-pendiente-texto"
          >
            {error}
          </p>
        ) : null}

        {!delLaboratorio ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setModalidadEnvio("NACIONAL")}
                className={
                  requierePaqueteria
                    ? "rounded-tarjeta border-2 border-accion bg-accion/10 p-3 text-left"
                    : "rounded-tarjeta border border-borde bg-superficie-suave p-3 text-left hover:border-primario/40"
                }
              >
                <p className="text-menor font-semibold text-primario">
                  Envío por paquetería (Envia.com)
                </p>
                <p className="mt-0.5 text-minimo text-secundario">
                  {tarifaSeleccionada
                    ? `${tarifaSeleccionada.carrierDescription} · ${pesos(tarifaSeleccionada.totalPriceCentavos)}`
                    : "Cotizar tarifa real por código postal"}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setModalidadEnvio("RECOLECCION")}
                className={
                  modalidadEnvio === "RECOLECCION"
                    ? "rounded-tarjeta border-2 border-accion bg-accion/10 p-3 text-left"
                    : "rounded-tarjeta border border-borde bg-superficie-suave p-3 text-left hover:border-primario/40"
                }
              >
                <p className="text-menor font-semibold text-primario">
                  Recolección en sucursal
                </p>
                <p className="mt-0.5 text-cuerpo font-bold text-primario">
                  {pesos(costosEnvio.recoleccionCentavos)}
                </p>
              </button>
            </div>

            {requierePaqueteria ? (
              <div className="flex flex-col gap-3 rounded-tarjeta border border-borde bg-superficie-suave p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-menor font-semibold text-primario">
                    <MapPin aria-hidden="true" size={16} />
                    <span>Dirección de entrega de la clínica</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditandoDireccion(!editandoDireccion)}
                    className="text-minimo text-enlace underline underline-offset-4"
                  >
                    {editandoDireccion ? "Ocultar formulario" : "Editar dirección"}
                  </button>
                </div>

                {!editandoDireccion && dir.codigoPostal ? (
                  <p className="text-menor text-secundario">
                    {dir.calle} {dir.numeroExterior}, Col. {dir.colonia}, CP{" "}
                    {dir.codigoPostal}, {dir.ciudad} ({dir.estadoEnvio}) · Tel.{" "}
                    {dir.telefonoEnvio}
                  </p>
                ) : null}

                {editandoDireccion ? (
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <div>
                      <label className="text-minimo text-secundario">
                        Calle *
                      </label>
                      <input
                        type="text"
                        value={dir.calle}
                        onChange={(e) =>
                          setDir({ ...dir, calle: e.target.value })
                        }
                        placeholder="Ej. Av. Insurgentes Sur"
                        className="mt-1 w-full rounded-control border border-borde bg-superficie px-3 py-1.5 text-menor text-primario"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-minimo text-secundario">
                          Número *
                        </label>
                        <input
                          type="text"
                          value={dir.numeroExterior}
                          onChange={(e) =>
                            setDir({ ...dir, numeroExterior: e.target.value })
                          }
                          placeholder="1602"
                          className="mt-1 w-full rounded-control border border-borde bg-superficie px-3 py-1.5 text-menor text-primario"
                        />
                      </div>
                      <div>
                        <label className="text-minimo text-secundario">
                          Código postal *
                        </label>
                        <input
                          type="text"
                          maxLength={5}
                          value={dir.codigoPostal}
                          onChange={(e) =>
                            setDir({ ...dir, codigoPostal: e.target.value })
                          }
                          placeholder="03940"
                          className="mt-1 w-full rounded-control border border-borde bg-superficie px-3 py-1.5 text-menor text-primario"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-minimo text-secundario">
                        Colonia *
                      </label>
                      <input
                        type="text"
                        value={dir.colonia}
                        onChange={(e) =>
                          setDir({ ...dir, colonia: e.target.value })
                        }
                        placeholder="Crédito Constructor"
                        className="mt-1 w-full rounded-control border border-borde bg-superficie px-3 py-1.5 text-menor text-primario"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-minimo text-secundario">
                          Ciudad *
                        </label>
                        <input
                          type="text"
                          value={dir.ciudad}
                          onChange={(e) =>
                            setDir({ ...dir, ciudad: e.target.value })
                          }
                          placeholder="Ciudad de México"
                          className="mt-1 w-full rounded-control border border-borde bg-superficie px-3 py-1.5 text-menor text-primario"
                        />
                      </div>
                      <div>
                        <label className="text-minimo text-secundario">
                          Estado *
                        </label>
                        <select
                          value={dir.estadoEnvio}
                          onChange={(e) =>
                            setDir({ ...dir, estadoEnvio: e.target.value })
                          }
                          className="mt-1 w-full rounded-control border border-borde bg-superficie px-2 py-1.5 text-menor text-primario"
                        >
                          {ESTADOS_MEXICO_ENVIA.map((est) => (
                            <option key={est.codigo} value={est.codigo}>
                              {est.nombre}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-minimo text-secundario">
                        Teléfono (10 dígitos) *
                      </label>
                      <input
                        type="tel"
                        value={dir.telefonoEnvio}
                        onChange={(e) =>
                          setDir({ ...dir, telefonoEnvio: e.target.value })
                        }
                        placeholder="5512345678"
                        className="mt-1 w-full rounded-control border border-borde bg-superficie px-3 py-1.5 text-menor text-primario"
                      />
                    </div>
                    <div>
                      <label className="text-minimo text-secundario">
                        Correo para guía
                      </label>
                      <input
                        type="email"
                        value={dir.correoEnvio}
                        onChange={(e) =>
                          setDir({ ...dir, correoEnvio: e.target.value })
                        }
                        placeholder="clinica@ejemplo.com"
                        className="mt-1 w-full rounded-control border border-borde bg-superficie px-3 py-1.5 text-menor text-primario"
                      />
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <Boton
                    type="button"
                    disabled={cotizandoEnvia}
                    onClick={() => void cotizarEnvia()}
                  >
                    <Package aria-hidden="true" size={16} />
                    {cotizandoEnvia
                      ? "Cotizando en Envia.com…"
                      : tarifasEnvia.length > 0
                        ? "Actualizar tarifas de envío"
                        : "Cotizar envíos en Envia.com"}
                  </Boton>
                </div>

                {tarifasEnvia.length > 0 ? (
                  <div className="flex flex-col gap-2 border-t border-borde pt-3">
                    <p className="text-minimo font-medium text-primario">
                      Seleccione una paquetería (tarifas reales Envia.com):
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {tarifasEnvia.map((t) => {
                        const activa =
                          tarifaSeleccionada?.carrier === t.carrier &&
                          tarifaSeleccionada?.service === t.service;
                        return (
                          <button
                            key={`${t.carrier}-${t.service}`}
                            type="button"
                            onClick={() => setTarifaSeleccionada(t)}
                            className={
                              activa
                                ? "flex items-center justify-between rounded-tarjeta border-2 border-accion bg-accion/10 p-3 text-left"
                                : "flex items-center justify-between rounded-tarjeta border border-borde bg-superficie p-3 text-left hover:border-primario/40"
                            }
                          >
                            <div>
                              <p className="text-menor font-semibold text-primario">
                                {t.carrierDescription}
                              </p>
                              <p className="text-minimo text-secundario">
                                {t.serviceDescription} · {t.deliveryEstimate}
                              </p>
                            </div>
                            <span className="text-cuerpo font-bold text-primario">
                              {pesos(t.totalPriceCentavos)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}

        <div className="grid gap-3 rounded-tarjeta border border-borde bg-superficie-suave p-4 sm:grid-cols-3">
          <div>
            <p className="text-minimo text-secundario">50% restante</p>
            <p className="text-realce font-medium text-primario">
              {pesos(restante)}
            </p>
          </div>
          <div>
            <p className="text-minimo text-secundario">Costo de envío</p>
            <p className="text-realce font-medium text-primario">
              {requierePaqueteria && !tarifaSeleccionada
                ? "Por cotizar"
                : pesos(costoEnvioSeleccionado)}
            </p>
          </div>
          <div>
            <p className="text-minimo text-secundario">Total a liquidar</p>
            <p className="text-realce font-semibold text-primario">
              {pesos(totalLiquidar)}
            </p>
          </div>
        </div>

        {!delLaboratorio ? (
          <div>
            <Boton
              type="button"
              tono="principal"
              disabled={pagandoStripe || !listoParaPagar}
              onClick={() =>
                void iniciarCheckoutStripe("LIQUIDACION", modalidadEnvio)
              }
            >
              <CreditCard aria-hidden="true" size={18} />
              {pagandoStripe
                ? "Abriendo Stripe…"
                : !listoParaPagar
                  ? "Cotice y seleccione paquetería primero"
                  : `Liquidar con Stripe (${pesos(totalLiquidar)})`}
            </Boton>
          </div>
        ) : null}
      </section>
    );
  }

  // 6. Resumen cuando ya hay pagos confirmados
  if (anticipoPagado || liquidacionPagada) {
    return (
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-tarjeta border border-terminado/40 bg-terminado-fondo p-4 text-menor text-terminado-texto">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <CheckCircle aria-hidden="true" size={18} weight="fill" />
            <span>
              {liquidacionPagada
                ? `Pago total liquidado (${pesos((totalCentavos ?? 0) + (costoEnvioActualCentavos ?? 0))}${
                    modalidadEnvioActual
                      ? ` · ${
                          modalidadEnvioActual === "LOCAL"
                            ? "Envío local"
                            : modalidadEnvioActual === "NACIONAL"
                              ? "Envío nacional"
                              : "Recolección en sucursal"
                        }`
                      : ""
                  }).`
                : `Anticipo del 50% confirmado (${pesos(anticipoCentavos ?? 0)}).`}
            </span>
          </div>
          {motivoCambioPrecio ? (
            <p className="pl-6 text-minimo text-terminado-texto/90">
              Ajuste de precio
              {montoOriginalCentavos && totalCentavos
                ? ` (${pesos(montoOriginalCentavos)} → ${pesos(totalCentavos)})`
                : ""}
              : {motivoCambioPrecio}
            </p>
          ) : null}
          {liquidacionPagada && envioEnvia.numeroGuia ? (
            <p className="pl-6 text-minimo text-terminado-texto">
              Guía Envia.com
              {envioEnvia.servicioNombre ? ` (${envioEnvia.servicioNombre})` : ""}:{" "}
              <strong>{envioEnvia.numeroGuia}</strong>
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {delLaboratorio && liquidacionPagada && envioEnvia.urlEtiquetaPdf ? (
            <a
              href={envioEnvia.urlEtiquetaPdf}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-control border border-terminado/40 bg-superficie px-3 py-1.5 text-menor font-medium text-primario hover:bg-superficie-suave"
            >
              <FilePdf aria-hidden="true" size={16} />
              Descargar guía PDF
            </a>
          ) : null}

          {liquidacionPagada && envioEnvia.urlRastreo ? (
            <a
              href={envioEnvia.urlRastreo}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-control border border-terminado/40 bg-superficie px-3 py-1.5 text-menor font-medium text-primario hover:bg-superficie-suave"
            >
              <Truck aria-hidden="true" size={16} />
              Rastrear envío
            </a>
          ) : null}

          {delLaboratorio &&
          liquidacionPagada &&
          envioEnvia.carrier &&
          !envioEnvia.numeroGuia ? (
            <Boton
              type="button"
              tono="principal"
              disabled={generandoGuia}
              onClick={() => void generarGuiaManual()}
            >
              <Package aria-hidden="true" size={16} />
              {generandoGuia
                ? "Generando guía…"
                : "Generar guía en Envia.com"}
            </Boton>
          ) : null}

          {delLaboratorio && liquidacionPagada && etapa === "ESPERANDO_LIQUIDACION" && (
          <Boton
            type="button"
            tono="principal"
            disabled={trabajando}
            onClick={() => {
              setError(null);
              empezar(async () => {
                const res = await ejecutar(() =>
                  cambiarEtapa(casoId, "LISTO_Y_EN_CAMINO"),
                );
                if (res.error) setError(res.error);
                else router.refresh();
              });
            }}
          >
            <Truck aria-hidden="true" size={16} />
            Despachar pedido (Listo y en camino)
          </Boton>
        )}
        </div>

        {error && (
          <p className="w-full text-chico text-riesgo" role="alert">
            {error}
          </p>
        )}
      </section>
    );
  }

  return null;
}

