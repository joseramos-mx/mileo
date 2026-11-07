import { createBrowserClient } from "@supabase/ssr";
import { configuracionPublicaSupabase } from "./configuracion";

export function crearClienteSupabaseNavegador() {
  const { url, clavePublica } = configuracionPublicaSupabase();
  return createBrowserClient(url, clavePublica);
}

