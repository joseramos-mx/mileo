/**
 * El vigilante de Mileo (SKILL.md O-3 y O-4).
 *
 *   npm run vigilar
 *
 * Corre solo, cada hora, sin que nadie lo pida. Hace tres cosas:
 *
 * 1. **Marca en riesgo** los casos que llevan en su etapa más del tiempo
 *    estándar, o que ya se pasaron de su fecha. Encola el aviso al doctor con
 *    el motivo y la fecha nueva. Criterio de O-3: al exceder el tiempo estándar
 *    de una etapa, el caso se marca en riesgo y sale el aviso sin intervención
 *    humana.
 *
 * 2. **Recuerda la aprobación** a las 24 y a las 48 horas. Si a las 48 sigue sin
 *    respuesta, marca el caso en riesgo y recorre la fecha con aviso (O-4).
 *
 * 3. **Recorre la fecha** cuando el retraso ya es un hecho, y lo dice antes de
 *    que llegue el día. Avisar un retraso antes de que ocurra vale más que
 *    evitarlo (verdad #3 del producto).
 *
 * Es idempotente: correrlo diez veces seguidas no manda diez avisos. El candado
 * está en la clave única de la cola de avisos.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { registrarEvento } from "../src/lib/bitacora.js";
import {
  avisarA,
  avisoDeRecordatorio,
  avisoDeRiesgo,
} from "../src/lib/avisos.js";
import { HORAS_ESTANDAR, sumarDiasHabiles } from "../src/lib/etapas.js";
import { cargarAmbiente } from "./ambiente.mjs";

const ambiente = cargarAmbiente();
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const ahora = new Date();

function horasDesde(fecha: Date) {
  return (ahora.getTime() - fecha.getTime()) / 3_600_000;
}

async function main() {
  const casos = await prisma.caso.findMany({
    where: {
      esBorrador: false,
      etapa: { notIn: ["ENTREGADO"] },
    },
    include: {
      paciente: { select: { folio: true, iniciales: true } },
      eventos: {
        where: { tipo: "ETAPA_CAMBIADA" },
        orderBy: { secuencia: "desc" },
        take: 1,
        select: { creadoEn: true },
      },
    },
  });

  let enRiesgo = 0;
  let recordatorios = 0;
  let fechasRecorridas = 0;
  let avisosEncolados = 0;

  for (const caso of casos) {
    const desdeCuando = caso.eventos[0]?.creadoEn ?? caso.enviadoEn ?? caso.creadoEn;
    const horasEnEtapa = horasDesde(desdeCuando);
    const estandar = HORAS_ESTANDAR[caso.etapa];

    const paraAviso = {
      id: caso.id,
      folio: caso.folio,
      etapa: caso.etapa,
      fechaEntregaComprometida: caso.fechaEntregaComprometida,
      paciente: caso.paciente,
    };

    // --- 2. Recordatorios de aprobación -----------------------------------
    if (caso.etapa === "ESPERANDO_APROBACION") {
      for (const horas of [24, 48]) {
        if (horasEnEtapa >= horas) {
          const encolados = await avisarA(
            prisma,
            caso.doctorId,
            avisoDeRecordatorio(paraAviso, horas),
          );
          if (encolados > 0) {
            recordatorios++;
            avisosEncolados += encolados;
          }
        }
      }
    }

    // --- 1 y 3. Riesgo y fecha recorrida ----------------------------------
    const seTardo = Boolean(estandar && horasEnEtapa > estandar);
    const seLePaso = Boolean(
      caso.fechaEntregaComprometida && caso.fechaEntregaComprometida < ahora,
    );
    const enPausa = caso.etapa === "EN_PAUSA";

    if (!seTardo && !seLePaso && !enPausa) continue;

    const motivo = enPausa
      ? "El caso está detenido y el reloj sigue corriendo."
      : caso.etapa === "ESPERANDO_APROBACION"
        ? "Sigo esperando su aprobación para poder fabricar."
        : seLePaso
          ? "Ya pasó la fecha que le prometí."
          : `El caso lleva más de lo normal en ${caso.etapa
              .toLowerCase()
              .replaceAll("_", " ")}.`;

    // Cuando el retraso ya es un hecho, se recorre la fecha y se dice.
    let fechaNueva: Date | null = null;
    if (seLePaso && caso.fechaEntregaComprometida) {
      fechaNueva = sumarDiasHabiles(ahora, 2);
    }

    const yaEstabaEnRiesgo = caso.enRiesgo && caso.motivoRiesgo === motivo;

    if (!yaEstabaEnRiesgo || fechaNueva) {
      await prisma.$transaction(async (bd) => {
        await bd.caso.update({
          where: { id: caso.id },
          data: {
            enRiesgo: true,
            motivoRiesgo: motivo,
            ...(fechaNueva ? { fechaEntregaComprometida: fechaNueva } : {}),
          },
        });

        await registrarEvento(bd, {
          tipo: fechaNueva ? "FECHA_RECORRIDA" : "RIESGO_MARCADO",
          resumen: fechaNueva
            ? `Mileo recorrió la fecha del caso ${caso.folio} y le avisó al doctor. ${motivo}`
            : `Mileo marcó en riesgo el caso ${caso.folio}. ${motivo}`,
          casoId: caso.id,
          datos: {
            motivo,
            horasEnEtapa: Math.round(horasEnEtapa),
            ...(fechaNueva ? { fechaNueva: fechaNueva.toISOString() } : {}),
          },
        });
      });

      if (fechaNueva) fechasRecorridas++;
      else enRiesgo++;
    }

    const encolados = await avisarA(
      prisma,
      caso.doctorId,
      avisoDeRiesgo({ ...paraAviso, fechaEntregaComprometida: fechaNueva ?? caso.fechaEntregaComprometida }, motivo, fechaNueva),
    );
    avisosEncolados += encolados;
  }

  console.log(`Vigilante de ${ambiente}`);
  console.log(`  casos revisados     : ${casos.length}`);
  console.log(`  marcados en riesgo  : ${enRiesgo}`);
  console.log(`  fechas recorridas   : ${fechasRecorridas}`);
  console.log(`  recordatorios       : ${recordatorios}`);
  console.log(`  avisos encolados    : ${avisosEncolados}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
