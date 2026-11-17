import "server-only";

export type DireccionEnvia = {
  name: string;
  company: string;
  email: string;
  phone: string;
  street: string;
  number: string;
  district: string;
  city: string;
  state: string;
  country: "MX";
  postalCode: string;
};

export type TarifaEnvia = {
  carrier: string;
  carrierDescription: string;
  service: string;
  serviceDescription: string;
  deliveryEstimate: string;
  totalPriceCentavos: number;
  currency: string;
};

export type GuiaGeneradaEnvia = {
  carrier: string;
  service: string;
  shipmentId: number;
  trackingNumber: string;
  trackUrl: string;
  labelUrl: string;
  totalPriceCentavos: number;
};

const PAQUETERIAS_MX = ["estafeta", "fedex", "dhl", "redpack", "ups"] as const;

export function tieneEnvia(): boolean {
  return Boolean(process.env.ENVIA_API_TOKEN?.trim());
}

function urlApiEnvia(): string {
  return (process.env.ENVIA_API_URL || "https://api-test.envia.com").replace(
    /\/+$/,
    "",
  );
}

function tokenEnvia(): string {
  const token = process.env.ENVIA_API_TOKEN?.trim();
  if (!token) throw new Error("ENVIA_API_TOKEN no está configurado.");
  return token;
}

export function construirDestinoDesdeClinica(clinica: {
  nombre: string;
  ciudad: string | null;
  codigoPostal: string | null;
  calle: string | null;
  numeroExterior: string | null;
  colonia: string | null;
  estadoEnvio: string | null;
  telefonoEnvio: string | null;
  correoEnvio: string | null;
}, doctor?: { nombreCompleto: string; correo: string; telefono: string | null }): DireccionEnvia | null {
  if (
    !clinica.codigoPostal ||
    !clinica.calle ||
    !clinica.estadoEnvio ||
    !clinica.ciudad
  ) {
    return null;
  }

  return {
    name: doctor?.nombreCompleto || clinica.nombre,
    company: clinica.nombre,
    email: clinica.correoEnvio || doctor?.correo || "clinica@heymileo.com",
    phone: (clinica.telefonoEnvio || doctor?.telefono || "5512345678").replace(
      /\D/g,
      "",
    ).slice(-10) || "5512345678",
    street: clinica.calle,
    number: clinica.numeroExterior || "S/N",
    district: clinica.colonia || "Centro",
    city: clinica.ciudad,
    state: clinica.estadoEnvio,
    country: "MX",
    postalCode: clinica.codigoPostal,
  };
}

export function direccionOrigenLaboratorio(): DireccionEnvia {
  return {
    name: process.env.ENVIA_ORIGEN_NOMBRE || "RMS Zahnfacturing",
    company: process.env.ENVIA_ORIGEN_NOMBRE || "RMS Zahnfacturing",
    email: process.env.ENVIA_ORIGEN_CORREO || "envios@rmszahnfacturing.com",
    phone: process.env.ENVIA_ORIGEN_TELEFONO || "8112345678",
    street: process.env.ENVIA_ORIGEN_CALLE || "Av. Constitución",
    number: process.env.ENVIA_ORIGEN_NUMERO || "100",
    district: process.env.ENVIA_ORIGEN_COLONIA || "Centro",
    city: process.env.ENVIA_ORIGEN_CIUDAD || "Monterrey",
    state: process.env.ENVIA_ORIGEN_ESTADO || "NL",
    country: "MX",
    postalCode: process.env.ENVIA_ORIGEN_CP || "64000",
  };
}

function paqueteDentalEstandar(folioCaso?: string) {
  return [
    {
      content: folioCaso
        ? `Trabajo dental caso ${folioCaso}`
        : "Trabajo dental protésico",
      amount: 1,
      type: "box",
      dimensions: { length: 15, width: 15, height: 10 },
      weight: 1,
      weightUnit: "KG",
      lengthUnit: "CM",
      declaredValue: 0,
    },
  ];
}

async function consultarTarifasPaqueteria(
  carrier: string,
  origin: DireccionEnvia,
  destination: DireccionEnvia,
): Promise<TarifaEnvia[]> {
  try {
    const resp = await fetch(`${urlApiEnvia()}/ship/rate/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenEnvia()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        origin,
        destination,
        packages: paqueteDentalEstandar(),
        shipment: { carrier, type: 1 },
        settings: { currency: "MXN" },
      }),
      cache: "no-store",
    });

    if (!resp.ok) return [];
    const json = (await resp.json().catch(() => null)) as {
      data?: Array<{
        carrier?: string;
        carrierDescription?: string;
        service?: string;
        serviceDescription?: string;
        deliveryEstimate?: string;
        dropOff?: number;
        totalPrice?: number;
        currency?: string;
      }>;
    } | null;

    if (!json || !Array.isArray(json.data)) return [];

    return json.data
      .filter(
        (t) =>
          typeof t.carrier === "string" &&
          typeof t.service === "string" &&
          typeof t.totalPrice === "number" &&
          t.totalPrice > 0 &&
          (t.dropOff === undefined || t.dropOff === 0),
      )
      .map((t) => ({
        carrier: t.carrier!,
        carrierDescription: t.carrierDescription || t.carrier!.toUpperCase(),
        service: t.service!,
        serviceDescription: t.serviceDescription || t.service!,
        deliveryEstimate: t.deliveryEstimate || "Por confirmar",
        totalPriceCentavos: Math.round(t.totalPrice! * 100),
        currency: t.currency || "MXN",
      }));
  } catch {
    return [];
  }
}

/**
 * Cotiza tarifas reales en Envia.com consultando en paralelo las principales
 * paqueterías de México y ordenando de menor a mayor costo.
 */
export async function cotizarEnvioEnvia(
  destination: DireccionEnvia,
): Promise<TarifaEnvia[]> {
  const origin = direccionOrigenLaboratorio();
  const esSandbox = urlApiEnvia().includes("api-test.envia.com");
  const paqueterias = esSandbox
    ? PAQUETERIAS_MX.filter((c) => c !== "estafeta")
    : [...PAQUETERIAS_MX];

  const resultados = await Promise.all(
    paqueterias.map((carrier) =>
      consultarTarifasPaqueteria(carrier, origin, destination),
    ),
  );
  return resultados
    .flat()
    .sort((a, b) => a.totalPriceCentavos - b.totalPriceCentavos);
}

/**
 * Genera la guía de envío PDF y número de rastreo en Envia.com.
 */
export async function generarGuiaEnvia({
  destination,
  carrier,
  service,
  folioCaso,
}: {
  destination: DireccionEnvia;
  carrier: string;
  service: string;
  folioCaso: string;
}): Promise<GuiaGeneradaEnvia> {
  const origin = direccionOrigenLaboratorio();
  const tamanosPrueba = ["STOCK_4X6", "PAPER_8.5X11", "PAPER_4X6"] as const;
  let ultimoDetalle = "No se pudo generar la guía.";

  for (const printSize of tamanosPrueba) {
    const resp = await fetch(`${urlApiEnvia()}/ship/generate/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenEnvia()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        origin,
        destination,
        packages: paqueteDentalEstandar(folioCaso),
        shipment: { carrier, service, type: 1 },
        settings: {
          printFormat: "PDF",
          printSize,
          currency: "MXN",
        },
      }),
      cache: "no-store",
    });

    const json = (await resp.json().catch(() => null)) as {
      meta?: string;
      error?: { message?: string; description?: string };
      data?: Array<{
        carrier?: string;
        service?: string;
        shipmentId?: number;
        trackingNumber?: string;
        trackUrl?: string;
        label?: string;
        totalPrice?: number;
      }>;
    } | null;

    const primero = json?.data?.[0];
    if (resp.ok && primero?.trackingNumber && primero.label) {
      return {
        carrier: primero.carrier || carrier,
        service: primero.service || service,
        shipmentId: primero.shipmentId ?? 0,
        trackingNumber: primero.trackingNumber,
        trackUrl: primero.trackUrl || "",
        labelUrl: primero.label,
        totalPriceCentavos: Math.round((primero.totalPrice ?? 0) * 100),
      };
    }

    ultimoDetalle =
      json?.error?.description ||
      json?.error?.message ||
      `Envia.com respondió ${resp.status}`;

    const esErrorDeTamano =
      ultimoDetalle.toLowerCase().includes("invalid option") ||
      ultimoDetalle.toLowerCase().includes("print");
    if (!esErrorDeTamano) {
      break;
    }
  }

  throw new Error(`No pude generar la guía en Envia.com: ${ultimoDetalle}`);
}

export type EventoRastreoEnvia = {
  date: string;
  status: string;
  description: string;
  location: string;
};

export type RastreoEnvia = {
  trackingNumber: string;
  carrier: string;
  serviceDescription: string;
  status: string;
  estimatedDelivery: string | null;
  trackUrl: string | null;
  events: EventoRastreoEnvia[];
};

/**
 * Consulta la trayectoria y eventos de rastreo en tiempo real en Envia.com.
 */
export async function rastrearEnvioEnvia(
  trackingNumber: string,
): Promise<RastreoEnvia | null> {
  const resp = await fetch(`${urlApiEnvia()}/ship/generaltrack/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenEnvia()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ trackingNumbers: [trackingNumber] }),
    cache: "no-store",
  });

  if (!resp.ok) return null;

  const json = (await resp.json().catch(() => null)) as {
    data?: Array<{
      trackingNumber?: string;
      carrier?: string;
      serviceDescription?: string;
      status?: string;
      estimatedDelivery?: string | null;
      trackUrl?: string | null;
      events?: Array<{
        date?: string;
        status?: string;
        description?: string;
        location?: string;
      }>;
    }>;
  } | null;

  const item = json?.data?.[0];
  if (!item) return null;

  const events: EventoRastreoEnvia[] = Array.isArray(item.events)
    ? item.events.map((ev) => ({
        date: ev.date || "",
        status: ev.status || "",
        description: ev.description || "",
        location: ev.location || "",
      }))
    : [];

  return {
    trackingNumber: item.trackingNumber || trackingNumber,
    carrier: item.carrier || "",
    serviceDescription: item.serviceDescription || "",
    status: item.status || "Created",
    estimatedDelivery: item.estimatedDelivery || null,
    trackUrl: item.trackUrl || null,
    events,
  };
}
