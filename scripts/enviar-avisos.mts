/**
 * Entrega los avisos que están en la cola (SKILL.md O-3).
 *
 *   npm run avisos
 *
 * Corre cada pocos minutos. Toma los pendientes, los entrega por su canal y
 * marca el resultado. Si el proveedor está caído, el aviso se queda pendiente y
 * se reintenta en la corrida siguiente: ningún aviso se pierde y ningún caso se
 * detiene por eso.
 *
 * ⚠️ Mientras el Product Owner no elija proveedor (§12.3), este guion no
 * inventa entregas: cuenta cuántos avisos están esperando y lo dice. Un aviso
 * marcado como enviado que nunca salió es peor que no tenerlo.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { entregar, hayProveedor } from "../src/lib/mensajeria.js";
import { cargarAmbiente } from "./ambiente.mjs";

const ambiente = cargarAmbiente();
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const MAXIMO_DE_INTENTOS = 5;
const POR_CORRIDA = 200;

async function main() {
  const pendientes = await prisma.aviso.findMany({
    where: { estado: "PENDIENTE", intentos: { lt: MAXIMO_DE_INTENTOS } },
    orderBy: { creadoEn: "asc" },
    take: POR_CORRIDA,
    include: {
      usuario: {
        select: { correo: true, telefono: true, nombreCompleto: true },
      },
    },
  });

  let entregados = 0;
  let fallidos = 0;
  let esperandoProveedor = 0;

  for (const aviso of pendientes) {
    if (!hayProveedor(aviso.canal)) {
      esperandoProveedor++;
      continue;
    }

    const resultado = await entregar({
      id: aviso.id,
      canal: aviso.canal,
      asunto: aviso.asunto,
      cuerpo: aviso.cuerpo,
      destinatario: {
        correo: aviso.usuario?.correo ?? aviso.destinoCorreo ?? "",
        telefono: aviso.usuario?.telefono ?? aviso.destinoTelefono,
        nombre: aviso.usuario?.nombreCompleto ?? aviso.destinoCorreo ?? "",
      },
    });

    if (resultado.entregado) {
      await prisma.aviso.update({
        where: { id: aviso.id },
        data: {
          estado: "ENVIADO",
          enviadoEn: new Date(),
          intentos: { increment: 1 },
          ultimoError: null,
        },
      });
      entregados++;
    } else {
      const intentos = aviso.intentos + 1;
      await prisma.aviso.update({
        where: { id: aviso.id },
        data: {
          intentos,
          ultimoError: resultado.motivo,
          // Se rinde sólo después de varios intentos, y lo deja escrito.
          estado: intentos >= MAXIMO_DE_INTENTOS ? "FALLIDO" : "PENDIENTE",
        },
      });
      fallidos++;
    }
  }

  const enCola = await prisma.aviso.count({ where: { estado: "PENDIENTE" } });

  console.log(`Avisos de ${ambiente}`);
  console.log(`  entregados          : ${entregados}`);
  console.log(`  con problema        : ${fallidos}`);
  console.log(`  esperando proveedor : ${esperandoProveedor}`);
  console.log(`  quedan en la cola   : ${enCola}`);

  if (esperandoProveedor > 0) {
    console.log(
      "\n  Falta configurar el proveedor de correo o de WhatsApp (SKILL.md §12.3).\n" +
        "  Los avisos se quedan en la cola; no se pierde ninguno.",
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
