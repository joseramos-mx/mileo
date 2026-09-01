import Link from "next/link";
import { CheckCircle, WarningCircle, WifiSlash } from "@phosphor-icons/react/dist/ssr";
import type { EstadoDelEscaner } from "@/generated/prisma/enums";
import { MarcoDeImagen } from "@/componentes/MarcoDeImagen";
import { diasFaltantes } from "@/lib/fechas";

/**
 * El escáner de la clínica, como en el diseño entregado.
 *
 * Si la clínica no tiene escáner dado de alta, la tarjeta lo dice en vez de
 * inventar una licencia y un estado: el comodato completo es O-8 y va después
 * del piloto (§11).
 */

const ESTADOS: Record<
  EstadoDelEscaner,
  { texto: string; icono: typeof CheckCircle; clase: string }
> = {
  LISTO: {
    texto: "Listo para escanear",
    icono: CheckCircle,
    clase: "text-terminado",
  },
  REQUIERE_REVISION: {
    texto: "Necesita revisión",
    icono: WarningCircle,
    clase: "text-pendiente",
  },
  SIN_CONEXION: {
    texto: "Sin conexión",
    icono: WifiSlash,
    clase: "text-secundario",
  },
};

export function TarjetaDeEscaner({
  escaner,
}: {
  escaner: {
    marca: string;
    modelo: string;
    estado: EstadoDelEscaner;
    licenciaVenceEn: Date | null;
    fotoUrl: string | null;
  } | null;
}) {
  if (!escaner) {
    return (
      <section
        aria-labelledby="escaner"
        className="flex flex-col gap-3 rounded-contenedor bg-superficie p-6"
      >
        <h2 id="escaner" className="text-subtitulo font-semibold text-primario">
          Su escáner
        </h2>
        <p className="text-cuerpo text-secundario">
          Todavía no tengo dado de alta su equipo. Dígame cuál usa y se lo
          registro para avisarle de su licencia y su mantenimiento.
        </p>
        <Link
          href="/ayuda"
          className="text-cuerpo text-enlace underline underline-offset-4"
        >
          Escribirle al laboratorio
        </Link>
      </section>
    );
  }

  const { texto, icono: Icono, clase } = ESTADOS[escaner.estado];
  const dias = escaner.licenciaVenceEn
    ? diasFaltantes(escaner.licenciaVenceEn)
    : null;

  return (
    <section
      aria-labelledby="escaner"
      className="flex h-full shrink-0 gap-4 overflow-hidden rounded-contenedor bg-superficie p-4 max-lg:min-h-[22rem] sm:p-6"
    >
      {/* La foto del equipo, de arriba abajo. La entrega el equipo de diseño (§9). */}
      {/* El ancho va en proporción y no en rem fijos: con el texto al 200% una
          columna fija se come la tarjeta entera (§7). */}
      {/* La foto ocupa el alto del recuadro, de un lado, bien espaciada. */}
      <div className="flex w-[38%] max-w-40 shrink-0 items-center justify-center py-2">
        {escaner.fotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={encodeURI(escaner.fotoUrl)}
            alt=""
            className="h-full max-h-full w-full object-contain"
          />
        ) : (
          <MarcoDeImagen
            proporcion="llenar"
            etiqueta={`Foto del escáner ${escaner.marca} ${escaner.modelo}`}
          />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto sin-barra">
        {dias !== null ? (
          <p className="text-menor wrap-break-word text-secundario">
            <span className="font-semibold text-primario">
              Su licencia vence en
            </span>
            <br />
            {dias} días
          </p>
        ) : null}

        <h2
          id="escaner"
          className="mt-auto pt-6 text-titulo font-semibold text-primario"
        >
          Su escáner
        </h2>
        <p className="mt-1 text-menor text-secundario">
          {escaner.marca} {escaner.modelo}
        </p>

        <p className="mt-3 flex items-center gap-2 text-cuerpo text-primario">
          <Icono aria-hidden="true" size={18} weight="fill" className={clase} />
          {texto}
        </p>

        {/* Van pegados como en el diseño, pero con alto suficiente para que
            sean dos objetivos distintos de tocar (§7, 24 px mínimo). */}
        <div className="mt-3 flex flex-col">
          <Link
            href="/ayuda"
            className="inline-flex w-fit items-center py-2 text-menor text-secundario underline underline-offset-4 hover:text-primario"
          >
            Necesito ayuda
          </Link>
          <Link
            href="/aprender"
            className="inline-flex w-fit items-center py-2 text-menor text-secundario underline underline-offset-4 hover:text-primario"
          >
            Más información
          </Link>
        </div>
      </div>
    </section>
  );
}
