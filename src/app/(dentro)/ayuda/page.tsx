import type { Metadata } from "next";
import Link from "next/link";
import { ChatCircleDots, WhatsappLogo, Envelope } from "@phosphor-icons/react/dist/ssr";
import { exigirUsuario } from "@/lib/autorizacion";

export const metadata: Metadata = { title: "Ayuda · Mileo" };

/**
 * Salidas siempre disponibles (SKILL.md §6.9): ayuda y chat desde cualquier
 * pantalla, para que nadie se sienta atrapado a media captura.
 */
export default async function PaginaDeAyuda() {
  await exigirUsuario();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <header>
        <h1 className="text-titulo font-semibold text-primario">
          ¿En qué le ayudo?
        </h1>
        <p className="mt-1 text-cuerpo text-secundario">
          Del laboratorio le contesta una persona, de lunes a viernes de 9 a 6.
        </p>
      </header>

      <ul className="flex flex-col gap-3">
        <li>
          <a
            href="https://wa.me/526181234567"
            className="flex items-center gap-3 rounded-tarjeta border border-borde bg-superficie p-4 hover:bg-superficie-suave"
          >
            <WhatsappLogo aria-hidden="true" size={22} className="text-secundario" />
            <span>
              <span className="block text-cuerpo font-medium text-primario">
                WhatsApp
              </span>
              <span className="block text-menor text-secundario">
                618 123 4567 · lo más rápido
              </span>
            </span>
          </a>
        </li>
        <li>
          <a
            href="mailto:soporte@rmszahn.mx"
            className="flex items-center gap-3 rounded-tarjeta border border-borde bg-superficie p-4 hover:bg-superficie-suave"
          >
            <Envelope aria-hidden="true" size={22} className="text-secundario" />
            <span>
              <span className="block text-cuerpo font-medium text-primario">
                Correo
              </span>
              <span className="block text-menor text-secundario">
                soporte@rmszahn.mx
              </span>
            </span>
          </a>
        </li>
        <li>
          <Link
            href="/ayuda/guias-de-exportacion"
            className="flex items-center gap-3 rounded-tarjeta border border-borde bg-superficie p-4 hover:bg-superficie-suave"
          >
            <ChatCircleDots aria-hidden="true" size={22} className="text-secundario" />
            <span>
              <span className="block text-cuerpo font-medium text-primario">
                Cómo exportar desde mi escáner
              </span>
              <span className="block text-menor text-secundario">
                Paso a paso por marca
              </span>
            </span>
          </Link>
        </li>
      </ul>
    </div>
  );
}
