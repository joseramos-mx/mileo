import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  configuracionPublicaSupabase,
  tieneConfiguracionPublicaSupabase,
} from "@/lib/supabase/configuracion";

/**
 * Proxy de Next.js 16 para mantener fresca la sesion de Supabase Auth en las
 * cookies antes de renderizar Server Components o ejecutar rutas.
 */
export async function proxy(request: NextRequest) {
  if (!tieneConfiguracionPublicaSupabase()) {
    return NextResponse.next({ request });
  }

  let respuesta = NextResponse.next({ request });
  const { url, clavePublica } = configuracionPublicaSupabase();

  const supabase = createServerClient(url, clavePublica, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(porGuardar) {
        for (const { name, value } of porGuardar) {
          request.cookies.set(name, value);
        }
        respuesta = NextResponse.next({ request });
        for (const { name, value, options } of porGuardar) {
          respuesta.cookies.set(name, value, options);
        }
      },
    },
  });

  await supabase.auth.getUser();

  return respuesta;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};

