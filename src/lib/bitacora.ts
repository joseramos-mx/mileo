import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { Etapa, TipoEvento } from "@/generated/prisma/enums";

/**
 * Bitacora inmutable del caso (SKILL.md O-0).
 *
 * Todo cambio de etapa, archivo, aprobacion o acceso pasa por aqui. La base de
 * datos rechaza UPDATE y DELETE sobre la tabla y encadena cada evento por hash
 * con el anterior, asi que este modulo solo tiene que escribir; la garantia no
 * depende de que alguien recuerde llamarlo bien.
 *
 * La `cadena` agrupa los eslabones: los eventos de un caso se encadenan entre
 * si, y lo que no pertenece a ningun caso va a la cadena "sistema".
 */

export const CADENA_SISTEMA = "sistema";

/** Acepta tanto el cliente normal como el de dentro de una transaccion. */
export type ClienteBd = PrismaClient | Prisma.TransactionClient;

export type EntradaBitacora = {
  tipo: TipoEvento;
  /** En espanol, en tiempo pasado y legible para una persona. */
  resumen: string;
  casoId?: string | null;
  usuarioId?: string | null;
  etapaAnterior?: Etapa | null;
  etapaNueva?: Etapa | null;
  datos?: Prisma.InputJsonValue;
};

export async function registrarEvento(bd: ClienteBd, entrada: EntradaBitacora) {
  return bd.eventoBitacora.create({
    data: {
      cadena: entrada.casoId ?? CADENA_SISTEMA,
      tipo: entrada.tipo,
      resumen: entrada.resumen,
      casoId: entrada.casoId ?? null,
      usuarioId: entrada.usuarioId ?? null,
      etapaAnterior: entrada.etapaAnterior ?? null,
      etapaNueva: entrada.etapaNueva ?? null,
      ...(entrada.datos === undefined ? {} : { datos: entrada.datos }),
    },
  });
}

export type EslabonRoto = {
  cadena: string;
  secuencia: bigint;
  evento: string;
  motivo: string;
};

/**
 * Recorre la bitacora completa y devuelve los eslabones rotos.
 * Arreglo vacio = bitacora integra.
 */
export async function verificarBitacora(bd: ClienteBd): Promise<EslabonRoto[]> {
  return bd.$queryRaw<EslabonRoto[]>`SELECT * FROM mileo_bitacora_verificar()`;
}
