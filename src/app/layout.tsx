import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--fuente-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mileo",
  description:
    "Suba su escaneo, siga su caso y apruebe el diseño desde donde esté. " +
    "El laboratorio digital de RMS Zahnfacturing.",
};

export const viewport: Viewport = {
  // Zoom hasta 200% sin romper el layout (SKILL.md §7): nunca se bloquea.
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

/**
 * El tema se decide antes del primer pintado para que nadie vea un destello.
 * Oscuro por omisión, como el diseño entregado; el claro es un interruptor del
 * usuario que se guarda en su navegador. Las pantallas donde se juzga color van
 * claras siempre, pase lo que pase (SKILL.md §5.1).
 */
const guionTema = `
try {
  var t = localStorage.getItem("mileo-tema");
  if (t === "claro") document.documentElement.dataset.tema = "claro";
} catch (e) {}
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-MX" className={`${jakarta.variable} h-full`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: guionTema }} />
      </head>
      <body className="min-h-full bg-app font-sans text-cuerpo text-primario">
        {children}
      </body>
    </html>
  );
}
