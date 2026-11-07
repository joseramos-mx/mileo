import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { configuracionPublicaSupabase } from "./configuracion";

/**
 * Cliente de Supabase ligado a las cookies de la peticion actual (Server
 * Components, Server Actions y Route Handlers).
 */
export async function crearClienteSupabaseServidor() {
  const { url, clavePublica } = configuracionPublicaSupabase();
  const almacen = await cookies();

  return createServerClient(url, clavePublica, {
    cookies: {
      getAll() {
        return almacen.getAll();
      },
      setAll(porGuardar) {
        try {
          for (const { name, value, options } of porGuardar) {
            almacen.set(name, value, options);
          }
        } catch {
          // En un Server Component de solo lectura Next no permite escribir
          // cookies; src/proxy.ts se encarga de refrescar la sesion antes.
        }
      },
    },
  });
}

/**
 * Cliente administrativo de Supabase (solo en el servidor).
 *
 * Se usa unicamente para dar de alta cuentas al aceptar una invitacion cerrada,
 * de modo que el registro publico permanezca cerrado.
 */
export function crearClienteSupabaseAdmin() {
  const { url } = configuracionPublicaSupabase();
  const claveServicio = (
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  )?.trim();

  if (!claveServicio) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY en su archivo .env para administrar cuentas de Supabase Auth.",
    );
  }

  return createClient(url, claveServicio, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

