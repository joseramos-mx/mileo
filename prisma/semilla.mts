/**
 * Semilla de Mileo.
 *
 * Idempotente: se puede correr las veces que haga falta. En produccion crea
 * unicamente al equipo del laboratorio; el caso de demostracion solo aparece en
 * desarrollo.
 */
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { registrarEvento } from "../src/lib/bitacora.js";
import { cargarAmbiente } from "../scripts/ambiente.mjs";

const ambiente = cargarAmbiente();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const CONTRASENA_DEMO = "mileo1234";
const VERSION_AVISO_PRIVACIDAD = "2026-01";

async function main() {
  const hash = await bcrypt.hash(CONTRASENA_DEMO, 10);

  // --- El laboratorio: 4 personas que rotan de rol (SKILL.md §1) ------------
  const equipo = [
    {
      correo: "direccion@rmszahn.mx",
      nombreCompleto: "Rosa Maria Salas",
      rol: "DIRECCION" as const,
    },
    {
      correo: "admision@rmszahn.mx",
      nombreCompleto: "Luis Trevino",
      rol: "ADMISION" as const,
    },
    {
      correo: "diseno@rmszahn.mx",
      nombreCompleto: "Karla Nunez",
      rol: "DISENO" as const,
    },
    {
      correo: "calidad@rmszahn.mx",
      nombreCompleto: "Hector Rios",
      rol: "CALIDAD" as const,
    },
  ];

  const equipoCreado = [];
  for (const persona of equipo) {
    const usuario = await prisma.usuario.upsert({
      where: { correo: persona.correo },
      update: {},
      create: {
        ...persona,
        hashContrasena: hash,
        avisoPrivacidadVersion: VERSION_AVISO_PRIVACIDAD,
        avisoPrivacidadAceptadoEn: new Date(),
      },
    });
    equipoCreado.push(usuario);
  }
  const direccion = equipoCreado[0];
  console.log(`Equipo del laboratorio listo (${equipoCreado.length} personas).`);

  if (ambiente === "produccion") {
    console.log("Ambiente de produccion: no se siembra caso de demostracion.");
    return;
  }

  // --- Una clinica con su doctor y su asistente ----------------------------
  const clinica = await prisma.clinica.upsert({
    where: { id: "clinica-prodental" },
    update: {},
    create: {
      id: "clinica-prodental",
      nombre: "Clinica Prodental",
      ciudad: "Durango",
    },
  });

  // El escaner en comodato de la clinica, para la tarjeta del inicio.
  const escanerDeDemostracion = {
    marca: "3Shape",
    modelo: "TRIOS 5",
    fotoUrl: "/escaners/trios 5.png",
  };
  await prisma.escaner.upsert({
    where: { clinicaId: clinica.id },
    update: escanerDeDemostracion,
    create: {
      clinicaId: clinica.id,
      ...escanerDeDemostracion,
      estado: "LISTO",
      licenciaVenceEn: new Date(Date.now() + 122 * 24 * 60 * 60 * 1000),
    },
  });

  const doctor = await prisma.usuario.upsert({
    where: { correo: "juan.valverde@prodental.mx" },
    update: {},
    create: {
      correo: "juan.valverde@prodental.mx",
      nombreCompleto: "Juan Valverde",
      telefono: "+526181234567",
      rol: "DOCTOR",
      hashContrasena: hash,
      clinicaId: clinica.id,
      invitadoPorId: direccion.id,
      avisoPrivacidadVersion: VERSION_AVISO_PRIVACIDAD,
      avisoPrivacidadAceptadoEn: new Date(),
    },
  });

  await prisma.usuario.upsert({
    where: { correo: "recepcion@prodental.mx" },
    update: {},
    create: {
      correo: "recepcion@prodental.mx",
      nombreCompleto: "Ana Beltran",
      rol: "ASISTENTE",
      hashContrasena: hash,
      clinicaId: clinica.id,
      invitadoPorId: doctor.id,
      avisoPrivacidadVersion: VERSION_AVISO_PRIVACIDAD,
      avisoPrivacidadAceptadoEn: new Date(),
    },
  });

  // --- Un caso de 3 unidades con materiales distintos (criterio de O-0) ----
  const folio = "C-2026-0001";
  const yaExiste = await prisma.caso.findUnique({ where: { folio } });
  if (yaExiste) {
    console.log(`El caso ${folio} ya existia. Semilla lista.`);
    return;
  }

  const paciente = await prisma.paciente.upsert({
    where: { clinicaId_folio: { clinicaId: clinica.id, folio: "932" } },
    update: {},
    create: {
      clinicaId: clinica.id,
      folio: "932",
      iniciales: "M.L.R.",
    },
  });

  await prisma.$transaction(async (bd) => {
    const caso = await bd.caso.create({
      data: {
        folio,
        clinicaId: clinica.id,
        doctorId: doctor.id,
        creadoPorId: doctor.id,
        pacienteId: paciente.id,
        indicacion: "CORONA_Y_PUENTE",
        etapa: "RECIBIDO",
        esBorrador: false,
        enviadoEn: new Date(),
        unidades: {
          create: [
            {
              diente: 11,
              rol: "CORONA",
              material: "ZIRCONIO_MONOLITICO",
              color: "A1",
            },
            {
              diente: 12,
              rol: "CARILLA",
              material: "DISILICATO_DE_LITIO",
              color: "A1",
            },
            {
              diente: 13,
              rol: "PROVISIONAL",
              material: "PMMA",
              color: "A2",
            },
          ],
        },
      },
      include: { unidades: true },
    });

    await registrarEvento(bd, {
      tipo: "CASO_CREADO",
      resumen: `El doctor ${doctor.nombreCompleto} creo el caso ${caso.folio} con ${caso.unidades.length} unidades.`,
      casoId: caso.id,
      usuarioId: doctor.id,
      etapaNueva: "RECIBIDO",
    });

    for (const unidad of caso.unidades) {
      await registrarEvento(bd, {
        tipo: "UNIDAD_AGREGADA",
        resumen: `Se agrego el diente ${unidad.diente}: ${unidad.rol} en ${unidad.material}.`,
        casoId: caso.id,
        usuarioId: doctor.id,
        datos: {
          diente: unidad.diente,
          rol: unidad.rol,
          material: unidad.material,
          color: unidad.color,
        },
      });
    }

    await registrarEvento(bd, {
      tipo: "CASO_ENVIADO",
      resumen: `La clinica envio el caso ${caso.folio} al laboratorio.`,
      casoId: caso.id,
      usuarioId: doctor.id,
    });

    console.log(`Caso ${caso.folio} creado con ${caso.unidades.length} unidades.`);
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
