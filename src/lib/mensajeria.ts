// Sin "server-only" a proposito: este modulo lo usan tanto la aplicacion
// como los guiones de cron (vigilar-riesgos, enviar-avisos), que corren
// en Node y no dentro de Next.
import fsp from "node:fs/promises";
import path from "node:path";
import type { CanalDeAviso } from "@/generated/prisma/enums";

/**
 * Entrega de avisos (SKILL.md O-3).
 *
 * ⚠️ Pendiente del Product Owner (§12.3): falta decidir el proveedor de
 * WhatsApp Business API y el de correo. Mientras no estén configurados, Mileo
 * **no finge que mandó nada**: los avisos se quedan en la cola, en estado
 * pendiente, y el guion de entrega lo dice en voz alta. Un aviso marcado como
 * enviado que nunca salió es peor que no tenerlo.
 *
 * Cuando el PO decida, basta con llenar las variables de ambiente. Los dos
 * caminos son un POST de JSON, así que casi cualquier proveedor entra sin
 * cambiar código:
 *
 *   MILEO_CORREO_URL     https://api.proveedor.mx/correos
 *   MILEO_CORREO_TOKEN   la llave
 *   MILEO_CORREO_DESDE   avisos@rmszahn.mx
 *
 *   MILEO_WHATSAPP_URL   https://graph.facebook.com/v21.0/<id>/messages
 *   MILEO_WHATSAPP_TOKEN la llave
 *
 * En desarrollo se puede poner MILEO_AVISOS_TRANSPORTE=registro para que los
 * avisos se escriban en almacen/avisos.log y se marquen como entregados.
 */

export type AvisoParaEntregar = {
  id: string;
  canal: CanalDeAviso;
  asunto: string;
  cuerpo: string;
  destinatario: { correo: string; telefono: string | null; nombre: string };
};

export type ResultadoDeEntrega =
  | { entregado: true; por: string }
  | { entregado: false; motivo: string; sinProveedor?: boolean };

export function hayProveedor(canal: CanalDeAviso) {
  if (process.env.MILEO_AVISOS_TRANSPORTE === "registro") return true;
  if (canal === "CORREO") {
    return Boolean(process.env.MILEO_CORREO_URL && process.env.MILEO_CORREO_TOKEN);
  }
  return Boolean(
    process.env.MILEO_WHATSAPP_URL && process.env.MILEO_WHATSAPP_TOKEN,
  );
}

export async function entregar(
  aviso: AvisoParaEntregar,
): Promise<ResultadoDeEntrega> {
  if (process.env.MILEO_AVISOS_TRANSPORTE === "registro") {
    return escribirEnElRegistro(aviso);
  }

  if (aviso.canal === "CORREO") return porCorreo(aviso);
  return porWhatsapp(aviso);
}

// ------------------------------------------------------------------ correo

async function porCorreo(
  aviso: AvisoParaEntregar,
): Promise<ResultadoDeEntrega> {
  const url = process.env.MILEO_CORREO_URL;
  const token = process.env.MILEO_CORREO_TOKEN;
  const desde = process.env.MILEO_CORREO_DESDE ?? "avisos@rmszahn.mx";

  if (!url || !token) {
    return {
      entregado: false,
      sinProveedor: true,
      motivo: "Falta configurar el proveedor de correo (§12.3).",
    };
  }

  try {
    const respuesta = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        from: desde,
        to: aviso.destinatario.correo,
        subject: aviso.asunto,
        text: aviso.cuerpo,
      }),
    });

    if (!respuesta.ok) {
      return {
        entregado: false,
        motivo: `El proveedor de correo contestó ${respuesta.status}.`,
      };
    }
    return { entregado: true, por: "correo" };
  } catch (falla) {
    return {
      entregado: false,
      motivo: falla instanceof Error ? falla.message : "Error de red.",
    };
  }
}

// ---------------------------------------------------------------- whatsapp

async function porWhatsapp(
  aviso: AvisoParaEntregar,
): Promise<ResultadoDeEntrega> {
  const url = process.env.MILEO_WHATSAPP_URL;
  const token = process.env.MILEO_WHATSAPP_TOKEN;

  if (!url || !token) {
    return {
      entregado: false,
      sinProveedor: true,
      motivo: "Falta configurar el proveedor de WhatsApp (§12.3).",
    };
  }
  if (!aviso.destinatario.telefono) {
    return { entregado: false, motivo: "La persona no tiene teléfono." };
  }

  try {
    const respuesta = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: aviso.destinatario.telefono,
        type: "text",
        text: { body: `${aviso.asunto}\n\n${aviso.cuerpo}` },
      }),
    });

    if (!respuesta.ok) {
      return {
        entregado: false,
        motivo: `El proveedor de WhatsApp contestó ${respuesta.status}.`,
      };
    }
    return { entregado: true, por: "whatsapp" };
  } catch (falla) {
    return {
      entregado: false,
      motivo: falla instanceof Error ? falla.message : "Error de red.",
    };
  }
}

// ---------------------------------------------------------------- registro

async function escribirEnElRegistro(
  aviso: AvisoParaEntregar,
): Promise<ResultadoDeEntrega> {
  const carpeta = path.resolve(
    process.cwd(),
    process.env.MILEO_ALMACEN_ARCHIVOS ?? "./almacen/archivos",
    "..",
  );
  await fsp.mkdir(carpeta, { recursive: true });

  const renglon =
    [
      new Date().toISOString(),
      aviso.canal,
      aviso.canal === "CORREO"
        ? aviso.destinatario.correo
        : (aviso.destinatario.telefono ?? "sin-telefono"),
      aviso.asunto,
      aviso.cuerpo.replaceAll("\n", " "),
    ].join(" | ") + "\n";

  await fsp.appendFile(path.join(carpeta, "avisos.log"), renglon, "utf8");
  return { entregado: true, por: "registro" };
}
