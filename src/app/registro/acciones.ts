"use server";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { Rol } from "@/generated/prisma/enums";
import { crearClienteSupabaseAdmin } from "@/lib/supabase/servidor";
import { enviarCorreo } from "@/lib/correo/enviar";
import {
  plantillaVerificacion,
  plantillaYaTieneCuenta,
} from "@/lib/correo/plantillas";
import {
  RUTA_DE_ENTRADA,
  RUTA_DE_VERIFICACION,
  urlBase,
} from "@/lib/rutas-publicas";

/**
 * Registro abierto de clínicas (reemplaza el "solo por invitación" de O-1).
 *
 * Cómo se arma, y por qué:
 *
 * 1. La cuenta nace INACTIVA (`activo: false`) y sin confirmar en Supabase. Con
 *    eso `entrar` y `usuarioActual` ya la rechazan sin tocar nada más.
 * 2. El enlace de confirmación lo genera Supabase (admin.generateLink) pero lo
 *    manda Mileo por Resend: así no dependemos del SMTP de Supabase.
 * 3. Al confirmar (/verificar) la cuenta pasa a activa y la persona entra.
 *
 * La pantalla contesta lo mismo si el correo ya existía o no: decir cuál de las
 * dos sería regalarle al atacante la lista de clínicas. El dueño del correo sí
 * se entera, por correo.
 */

export type ResultadoRegistro = {
  error?: string;
  /** Si viene, el correo salió (o parece que salió) y se enseña "revise su correo". */
  enviadoA?: string;
  /** Lo que escribió, para no hacerle teclear todo de nuevo si algo falla. */
  valores?: {
    nombreCompleto: string;
    nombreClinica: string;
    ciudad: string;
    correo: string;
    telefono: string;
  };
};

const ESPERA_ENTRE_CORREOS_MS = 60_000;

const mensajeGeneral =
  "No pudimos crear su cuenta en este momento. Vuelva a intentarlo en unos minutos.";

/** Normaliza el teléfono a formato internacional; vacío si no lo dieron. */
const esquemaTelefono = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s\-().]/g, ""))
  .refine(
    (v) => v === "" || /^\+?\d{10,15}$/.test(v),
    "Escriba un teléfono de 10 dígitos.",
  )
  .transform((v) => {
    if (v === "") return undefined;
    if (v.startsWith("+")) return v;
    return v.length === 10 ? `+52${v}` : `+${v}`;
  });

const esquemaRegistro = z.object({
  nombreCompleto: z
    .string()
    .trim()
    .min(3, "Escriba su nombre completo.")
    .max(120, "El nombre es demasiado largo."),
  nombreClinica: z
    .string()
    .trim()
    .min(2, "Escriba el nombre de su clínica.")
    .max(120, "El nombre de la clínica es demasiado largo."),
  ciudad: z
    .string()
    .trim()
    .max(80, "El nombre de la ciudad es demasiado largo.")
    .transform((v) => v || undefined),
  correo: z.string().trim().toLowerCase().email("Escriba un correo válido."),
  telefono: esquemaTelefono,
  contrasena: z
    .string()
    .min(8, "La contraseña necesita al menos 8 caracteres.")
    .max(72, "La contraseña es demasiado larga (máximo 72 caracteres)."),
});

const leer = (datos: FormData, campo: string) => String(datos.get(campo) ?? "");

/**
 * Freno de mano contra quien use el formulario para llenarle el correo a un
 * tercero. Vive en la memoria del servidor, así que en un despliegue sin
 * estado es de mejor esfuerzo; el freno de verdad es un captcha (ver notas).
 */
const ultimoAvisoDeCuentaExistente = new Map<string, number>();

type UsuarioDeRegistro = {
  id: string;
  nombreCompleto: string;
  activo: boolean;
  supabaseId: string | null;
  clinicaId: string | null;
  invitadoPorId: string | null;
  creadoEn: Date;
};

/**
 * Una cuenta "pendiente" es la de alguien que se registró y nunca confirmó el
 * correo. Se exige que Supabase la tenga sin confirmar y que no venga de una
 * invitación: así nunca se confunde con la cuenta de alguien real.
 */
async function esCuentaPendiente(
  admin: SupabaseClient,
  u: UsuarioDeRegistro,
): Promise<boolean> {
  if (u.activo || !u.supabaseId || u.invitadoPorId) return false;
  const { data, error } = await admin.auth.admin.getUserById(u.supabaseId);
  if (error || !data.user) return false;
  return !data.user.email_confirmed_at;
}

/** Borra un intento de registro que nunca se confirmó (y su clínica, si quedó sola). */
async function descartarPendiente(
  admin: SupabaseClient,
  u: Pick<UsuarioDeRegistro, "id" | "clinicaId" | "supabaseId">,
) {
  await prisma.$transaction(async (tx) => {
    await tx.usuario.delete({ where: { id: u.id } });
    if (u.clinicaId) {
      const quedan = await tx.usuario.count({ where: { clinicaId: u.clinicaId } });
      if (quedan === 0) await tx.clinica.delete({ where: { id: u.clinicaId } });
    }
  });
  if (u.supabaseId) await admin.auth.admin.deleteUser(u.supabaseId);
}

async function avisarQueYaTieneCuenta(correo: string, nombre?: string) {
  const ahora = Date.now();
  const ultimo = ultimoAvisoDeCuentaExistente.get(correo) ?? 0;
  if (ahora - ultimo < ESPERA_ENTRE_CORREOS_MS) return;
  ultimoAvisoDeCuentaExistente.set(correo, ahora);

  try {
    await enviarCorreo({
      para: correo,
      ...plantillaYaTieneCuenta({
        nombre: nombre?.split(/\s+/)[0],
        enlaceEntrada: `${urlBase()}${RUTA_DE_ENTRADA}`,
      }),
    });
  } catch (error) {
    // Que no salga este aviso no debe delatar nada en pantalla.
    console.error("[registro] No se pudo avisar de cuenta existente:", error);
  }
}

export async function registrar(
  _anterior: ResultadoRegistro,
  datos: FormData,
): Promise<ResultadoRegistro> {
  // Trampa para robots: este campo va escondido y una persona nunca lo llena.
  // Se contesta como si todo hubiera salido bien, sin hacer nada.
  if (leer(datos, "sitio") !== "") {
    return { enviadoA: leer(datos, "correo").trim().toLowerCase() };
  }

  const valores = {
    nombreCompleto: leer(datos, "nombreCompleto"),
    nombreClinica: leer(datos, "nombreClinica"),
    ciudad: leer(datos, "ciudad"),
    correo: leer(datos, "correo"),
    telefono: leer(datos, "telefono"),
  };

  const leido = esquemaRegistro.safeParse({
    ...valores,
    contrasena: leer(datos, "contrasena"),
  });
  if (!leido.success) {
    return { error: leido.error.issues[0].message, valores };
  }
  const d = leido.data;

  try {
    const admin = crearClienteSupabaseAdmin();

    // --- ¿Ya existe ese correo? -----------------------------------------
    const existente = await prisma.usuario.findUnique({
      where: { correo: d.correo },
    });

    if (existente) {
      if (!(await esCuentaPendiente(admin, existente))) {
        await avisarQueYaTieneCuenta(d.correo, existente.nombreCompleto);
        return { enviadoA: d.correo, valores };
      }
      // Intento anterior sin confirmar: si fue hace menos de un minuto, no se
      // manda otro correo; si no, se reemplaza por este intento.
      if (Date.now() - existente.creadoEn.getTime() < ESPERA_ENTRE_CORREOS_MS) {
        return { enviadoA: d.correo, valores };
      }
      await descartarPendiente(admin, existente);
    }

    // --- Cuenta en Supabase y enlace de confirmación ---------------------
    const { data: enlace, error: errorDeEnlace } =
      await admin.auth.admin.generateLink({
        type: "signup",
        email: d.correo,
        password: d.contrasena,
      });

    if (errorDeEnlace || !enlace?.properties || !enlace.user) {
      if (
        errorDeEnlace?.code === "email_exists" ||
        /already|registered/i.test(errorDeEnlace?.message ?? "")
      ) {
        await avisarQueYaTieneCuenta(d.correo);
        return { enviadoA: d.correo, valores };
      }
      if (errorDeEnlace?.code === "weak_password") {
        return {
          error: "Esa contraseña es muy fácil de adivinar. Pruebe con otra.",
          valores,
        };
      }
      console.error("[registro] Supabase no generó el enlace:", errorDeEnlace);
      return { error: mensajeGeneral, valores };
    }

    const supabaseId = enlace.user.id;
    const codigo = enlace.properties.hashed_token;

    // --- Clínica y usuario en Mileo (inactivo hasta confirmar) -----------
    let usuario: { id: string; clinicaId: string | null };
    try {
      const clinica = await prisma.clinica.create({
        data: {
          nombre: d.nombreClinica,
          ciudad: d.ciudad,
          usuarios: {
            create: {
              supabaseId,
              correo: d.correo,
              nombreCompleto: d.nombreCompleto,
              telefono: d.telefono,
              rol: Rol.CLINICA,
              activo: false,
            },
          },
        },
        include: { usuarios: true },
      });
      usuario = clinica.usuarios[0];
    } catch (error) {
      await admin.auth.admin.deleteUser(supabaseId);
      throw error;
    }

    // --- El correo --------------------------------------------------------
    try {
      await enviarCorreo({
        para: d.correo,
        ...plantillaVerificacion({
          nombre: d.nombreCompleto.split(/\s+/)[0],
          enlace: `${urlBase()}${RUTA_DE_VERIFICACION}?token_hash=${encodeURIComponent(codigo)}`,
        }),
      });
    } catch (error) {
      // Sin correo no hay cuenta: se deshace todo para que pueda reintentar
      // enseguida, sin quedar atorado en la espera de un minuto.
      console.error("[registro] No salió el correo de confirmación:", error);
      await descartarPendiente(admin, {
        id: usuario.id,
        clinicaId: usuario.clinicaId,
        supabaseId,
      });
      return {
        error:
          "No pudimos mandarle el correo de confirmación. Revise que esté bien escrito e inténtelo de nuevo.",
        valores,
      };
    }

    return { enviadoA: d.correo, valores };
  } catch (error) {
    console.error("[registro] Error inesperado:", error);
    return { error: mensajeGeneral, valores };
  }
}
