/**
 * Variables de entorno de Supabase Auth.
 *
 * Acepta tanto los nombres actuales del panel de Supabase
 * (NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY) como los
 * clasicos (NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY).
 */

export function configuracionPublicaSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const clavePublica = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )?.trim();

  if (!url || !clavePublica) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en su archivo .env.",
    );
  }

  return { url, clavePublica };
}

export function tieneConfiguracionPublicaSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const clavePublica = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )?.trim();
  return Boolean(url && clavePublica);
}

