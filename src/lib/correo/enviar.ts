import "server-only";
import { Resend } from "resend";

/**
 * Envío de correo por Resend.
 *
 * Los correos de Mileo se escriben en código (ver plantillas.ts) y se mandan
 * desde aquí, no desde las plantillas ni el SMTP de Supabase.
 *
 * CORREO_REMITENTE lleva el nombre y el correo, p. ej. "Mileo <hola@su-dominio.mx>",
 * y el dominio tiene que estar verificado en Resend.
 */

let cliente: Resend | null = null;

export type CorreoParaEnviar = {
  para: string;
  asunto: string;
  html: string;
  texto: string;
};

export async function enviarCorreo({
  para,
  asunto,
  html,
  texto,
}: CorreoParaEnviar): Promise<void> {
  const llave = process.env.RESEND_API_KEY;
  const de = process.env.CORREO_REMITENTE;

  if (!llave || !de) {
    throw new Error("Faltan RESEND_API_KEY o CORREO_REMITENTE en el entorno.");
  }

  cliente ??= new Resend(llave);

  const { error } = await cliente.emails.send({
    from: de,
    to: para,
    subject: asunto,
    html,
    text: texto,
  });

  if (error) throw new Error(`Resend rechazó el correo: ${error.message}`);
}
